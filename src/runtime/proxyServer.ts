import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { listModelOptions } from '../models/catalog.ts';
import { getDefaultProxyConfig, type ProxyConfig } from './proxyConfig.ts';
import {
  buildRequestBody,
  normalizeBaseUrl,
  resolveRouteForModel,
} from './router.ts';

export interface OpenProxyServerOptions {
  port?: number;
  proxyConfig?: ProxyConfig;
}

export interface OpenProxyServer {
  url: string;
  close(): Promise<void>;
}

async function readRequestBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function openProxyServer({
  port = 8787,
  proxyConfig = getDefaultProxyConfig(),
}: OpenProxyServerOptions = {}): Promise<OpenProxyServer> {
  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        res.writeHead(400).end('Bad request');
        return;
      }

      if (req.method !== 'POST' || !req.url.startsWith('/v1/chat/completions')) {
        res.writeHead(404).end('Not found');
        return;
      }

      const bodyText = await readRequestBody(req);
      const payload = bodyText ? JSON.parse(bodyText) : {};
      const modelName = typeof payload.model === 'string' ? payload.model : 'gpt-4.1-mini';
      const route = resolveRouteForModel(modelName, listModelOptions(), proxyConfig.targets);
      const upstreamUrl = normalizeBaseUrl(route.target.baseUrl);
      const requestBody = buildRequestBody(payload, route);

      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (route.target.apiKey) {
        headers.authorization = `Bearer ${route.target.apiKey}`;
      }

      const upstreamResponse = await fetch(`${upstreamUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: requestBody,
      });

      res.writeHead(upstreamResponse.status, Object.fromEntries(upstreamResponse.headers.entries()));
      if (upstreamResponse.body) {
        for await (const chunk of upstreamResponse.body) {
          res.write(chunk);
        }
      }
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(`Ryft proxy error: ${message}`);
    }
  });

  await new Promise<void>(resolve => server.listen(port, () => resolve()));
  const address = server.address() as AddressInfo | null;
  const resolvedPort = address?.port ?? port;
  return {
    url: `http://127.0.0.1:${resolvedPort}/v1`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = await openProxyServer();
  console.log(`Ryft proxy ready at ${server.url}`);
}
