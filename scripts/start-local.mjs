// `npm run start:local`: starts the local SQLite API and `ng serve` in the local-db
// configuration (which proxies /api to it). Stop both with Ctrl+C.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT, startApi } from '../server/main.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const ngCli = join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');

if (!existsSync(ngCli)) {
  console.error('Angular CLI niet gevonden. Voer eerst `npm ci` uit.');
  process.exit(1);
}

let api;
try {
  api = await startApi({ port: Number(process.env.PORT ?? DEFAULT_PORT) });
} catch (error) {
  console.error(
    error && error.code === 'EADDRINUSE'
      ? 'De API-poort is al in gebruik. Draait `npm run api` al in een ander venster?'
      : error,
  );
  process.exit(1);
}
console.log(`Lokale database: ${api.file}`);

const ng = spawn(
  process.execPath,
  [ngCli, 'serve', '--configuration', 'local-db', ...process.argv.slice(2)],
  {
    cwd: root,
    stdio: 'inherit',
  },
);

const stop = (code) => api.close().then(() => process.exit(code ?? 0));
ng.on('exit', stop);
process.on('SIGINT', () => ng.kill('SIGINT'));
process.on('SIGTERM', () => ng.kill('SIGTERM'));
