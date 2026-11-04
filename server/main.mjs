// Starts the local API: `npm run api` (or together with the app: `npm run start:local`).
//
// Environment variables:
//   PORT               port to listen on (default 3333)
//   GELDOVERZICHT_DB   database file (default .local-data/geldoverzicht.db in the project)
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApi } from './api.mjs';
import { openDatabase } from './database.mjs';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

export const DEFAULT_PORT = 3333;
export const DEFAULT_DATABASE = resolve(PROJECT_ROOT, '.local-data', 'geldoverzicht.db');

/**
 * Opens the database and starts listening on 127.0.0.1 only.
 * @param {{ port?: number, file?: string }} [options] port 0 picks a free port
 * @returns {Promise<{ server: import('node:http').Server, port: number, file: string, close: () => Promise<void> }>}
 */
export function startApi({ port = DEFAULT_PORT, file = DEFAULT_DATABASE } = {}) {
  const repository = openDatabase(file);
  const server = createServer(createApi({ repository }));
  return new Promise((resolvePromise, reject) => {
    server.once('error', (error) => {
      repository.close();
      reject(error);
    });
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolvePromise({
        server,
        port: typeof address === 'object' && address ? address.port : port,
        file,
        close: () =>
          new Promise((done) =>
            server.close(() => {
              repository.close();
              done();
            }),
          ),
      });
    });
  });
}

// Run directly: `node server/main.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const file = process.env.GELDOVERZICHT_DB
    ? resolve(process.env.GELDOVERZICHT_DB)
    : DEFAULT_DATABASE;
  try {
    const api = await startApi({ port, file });
    console.log(`Lokale database: ${api.file}`);
    console.log(`API: http://127.0.0.1:${api.port}/api (alleen bereikbaar vanaf deze computer)`);
    const stop = () => api.close().then(() => process.exit(0));
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (error) {
    const inUse = error && error.code === 'EADDRINUSE';
    console.error(
      inUse
        ? `Poort ${port} is al in gebruik. Draait de API al? Of kies een andere met PORT=...`
        : error,
    );
    process.exit(1);
  }
}
