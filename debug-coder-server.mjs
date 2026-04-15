#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)));
const projectRoot = __dirname;

console.log(`Project root: ${projectRoot}`);
console.log(`\nSpawning coder-server...`);

const child = spawn('npx', ['tsx', 'src/mcp/servers/coder-server.ts'], {
  cwd: projectRoot,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production' },
});

let buffer = '';
let timedOut = false;
const timeout = setTimeout(() => {
  console.log('\n❌ Timeout waiting for server response');
  timedOut = true;
  child.kill();
  process.exit(1);
}, 5000);

child.stdout?.on('data', (data) => {
  const text = data.toString();
  console.log(`[stdout] ${text}`);
  buffer += text;
  
  // Try to parse JSON lines
  const lines = buffer.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line && line.startsWith('{')) {
      try {
        const msg = JSON.parse(line);
        console.log(`[parsed] ${JSON.stringify(msg)}`);
      } catch (e) {
        // not JSON
      }
    }
  }
  buffer = lines[lines.length - 1];
});

child.stderr?.on('data', (data) => {
  console.log(`[stderr] ${data.toString().trim()}`);
});

child.on('exit', (code) => {
  clearTimeout(timeout);
  if (!timedOut) {
    console.log(`\nServer exited with code ${code}`);
  }
});

// Give server time to start
setTimeout(() => {
  if (timedOut) return;
  
  console.log('\nSending initialize request...');
  child.stdin?.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'debug', version: '1.0' },
    },
  }) + '\n');
  
  setTimeout(() => {
    if (timedOut) return;
    
    console.log('\nSending tools/list request...');
    child.stdin?.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    }) + '\n');
    
    setTimeout(() => {
      if (timedOut) return;
      console.log('\nClosing stdin...');
      child.stdin?.end();
    }, 1000);
  }, 1000);
}, 500);
