// HTTP API for the local SQLite database, built on `node:http` only.
//
// Privacy and safety: the server only listens on 127.0.0.1 (see main.mjs), only accepts
// requests addressed to localhost (protects against DNS rebinding), rejects requests from
// other websites (Origin check) and only accepts JSON bodies (forces a CORS preflight,
// which is never answered).
import { ValidationError, parseSettings, parseTransactions } from './validation.mjs';

const MAX_BODY_BYTES = 25 * 1024 * 1024;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Hostname from a `Host` header value like `localhost:3333` or `[::1]:3333`. */
function hostnameOf(host) {
  if (!host) return '';
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
  return host.split(':')[0];
}

function isLocalOrigin(origin) {
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** @param {import('node:http').IncomingMessage} request */
async function readJson(request) {
  const type = request.headers['content-type'] ?? '';
  if (!type.startsWith('application/json')) {
    throw new HttpError(415, 'Gebruik Content-Type: application/json.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Het verzoek is te groot.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Ongeldige JSON.');
  }
}

/** @param {import('node:http').ServerResponse} response */
function send(response, status, body) {
  const json = body === undefined ? '' : JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(json);
}

/**
 * Creates the request handler.
 * @param {{ repository: ReturnType<typeof import('./database.mjs').openDatabase> }} options
 */
export function createApi({ repository }) {
  const routes = {
    'GET /api/health': () => ({
      status: 200,
      body: { ok: true, database: repository.file, transactions: repository.countTransactions() },
    }),
    'GET /api/transactions': () => ({ status: 200, body: repository.listTransactions() }),
    'POST /api/transactions': async (request) => ({
      status: 200,
      body: repository.addTransactions(parseTransactions(await readJson(request))),
    }),
    'DELETE /api/transactions': () => ({
      status: 200,
      body: { deleted: repository.clearTransactions() },
    }),
    'GET /api/settings': () => ({ status: 200, body: repository.readSettings() }),
    'PUT /api/settings': async (request) => {
      repository.writeSettings(parseSettings(await readJson(request)));
      return { status: 200, body: { ok: true } };
    },
  };

  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   */
  return async function handle(request, response) {
    try {
      if (!LOCAL_HOSTNAMES.has(hostnameOf(request.headers.host))) {
        throw new HttpError(403, 'Alleen bereikbaar via localhost.');
      }
      const origin = request.headers.origin;
      if (origin && !isLocalOrigin(origin)) {
        throw new HttpError(403, 'Verzoeken van andere websites zijn niet toegestaan.');
      }
      const path = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '');
      const route = routes[`${request.method} ${path}`];
      if (!route) throw new HttpError(404, 'Onbekend adres.');
      const { status, body } = await route(request);
      send(response, status, body);
    } catch (error) {
      if (error instanceof HttpError) send(response, error.status, { error: error.message });
      else if (error instanceof ValidationError) send(response, 400, { error: error.message });
      else {
        console.error(error);
        send(response, 500, { error: 'Er ging iets mis in de lokale database.' });
      }
    }
  };
}
