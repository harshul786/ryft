#!/usr/bin/env node

import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const baseDir = __dirname;
const packsDir = join(baseDir, 'packs');

console.log(`Base dir: ${baseDir}`);
console.log(`Packs dir: ${packsDir}`);
console.log(`Packs dir exists: ${existsSync(packsDir)}`);

if (existsSync(packsDir)) {
  const entries = readdirSync(packsDir, { withFileTypes: false });
  console.log(`\nPacks found: ${entries.join(', ')}`);
  
  for (const entry of entries) {
    const packPath = join(packsDir, entry);
    if (statSync(packPath).isDirectory()) {
      const packJsonPath = join(packPath, 'pack.json');
      console.log(`\n${entry}:`);
      console.log(`  - pack.json exists: ${existsSync(packJsonPath)}`);
      
      if (existsSync(packJsonPath)) {
        try {
          const packDef = JSON.parse(readFileSync(packJsonPath, 'utf-8'));
          console.log(`  - name: ${packDef.name}`);
          console.log(`  - servers: ${packDef.mcpServers?.map((s) => s.id).join(', ') || 'none'}`);
          
          if (packDef.mcpServers && packDef.mcpServers.length > 0) {
            packDef.mcpServers.forEach((server) => {
              const command = `${server.command} ${(server.args || []).join(' ')}`;
              console.log(`    * ${server.id}: ${command}`);
            });
          }
        } catch (e) {
          console.log(`  - ERROR parsing pack.json: ${e.message}`);
        }
      }
    }
  }
}
