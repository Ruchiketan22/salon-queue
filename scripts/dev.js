import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('\x1b[33m%s\x1b[0m', '✂️ Starting Salon Queue Dev Environment (Server + Client)...');

const server = spawn(npxCmd, ['tsx', 'watch', 'server/server.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: process.env.PORT || '3001' }
});

const client = spawn(npxCmd, ['vite'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  console.log('\nStopping servers...');
  server.kill();
  client.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
