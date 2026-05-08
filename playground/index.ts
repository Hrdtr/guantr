/// <reference types="node" />
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const entries = readdirSync('./playground', { recursive: true, withFileTypes: true });
for (const entry of entries) {
  if (entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
    execSync(`pnpm jiti ${entry.parentPath}/${entry.name}`, { stdio: 'inherit' });
  }
}
