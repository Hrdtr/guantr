/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const entries = readdirSync('./playground', { recursive: true, withFileTypes: true });
for (const entry of entries) {
  if (entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
    execFileSync('pnpm', ['jiti', join(entry.parentPath, entry.name)], { stdio: 'inherit' });
  }
}
