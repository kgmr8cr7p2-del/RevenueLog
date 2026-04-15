import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

const root = process.cwd();
const sourceIndex = path.join(root, 'index.source.html');
const rootIndex = path.join(root, 'index.html');
const distDir = path.join(root, 'dist');
const rootAssets = path.join(root, 'assets');

await fs.copyFile(sourceIndex, rootIndex);
await build();

await fs.rm(rootAssets, { recursive: true, force: true });
await fs.cp(path.join(distDir, 'assets'), rootAssets, { recursive: true });
await fs.copyFile(path.join(distDir, 'index.html'), rootIndex);
await fs.copyFile(path.join(distDir, 'config.js'), path.join(root, 'config.js'));
