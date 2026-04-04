import type { ProviderTarget } from './router.ts';

export interface ProxyConfig {
  targets: Record<string, ProviderTarget>;
}

export function getDefaultProxyConfig(): ProxyConfig {
  const openaiBaseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const openaiApiKey = process.env.OPENAI_API_KEY ?? '';
  const localBaseUrl = process.env.RYFT_LOCAL_BASE_URL ?? openaiBaseUrl;
  const localApiKey = process.env.RYFT_LOCAL_API_KEY ?? openaiApiKey;
  return {
    targets: {
      default: {
        name: 'default',
        baseUrl: openaiBaseUrl,
        apiKey: openaiApiKey,
      },
      OpenAI: {
        name: 'OpenAI',
        baseUrl: openaiBaseUrl,
        apiKey: openaiApiKey,
      },
      'Local Proxy': {
        name: 'Local Proxy',
        baseUrl: localBaseUrl,
        apiKey: localApiKey,
      },
    },
  };
}
