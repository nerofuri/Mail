// Storage layer with two backends:
//   - Postgres (when DATABASE_URL is set) — persistent, for hosting.
//   - Local JSON file (fallback) — for local development.
// Both expose the same primitives: getAll / get / put / del.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;

// Managed Postgres (Neon, Supabase, …) requires TLS; local Postgres usually
// doesn't. Enable SSL unless the host is local or DATABASE_SSL=disable.
function sslFor(url) {
  if (process.env.DATABASE_SSL === 'disable') return false;
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return false;
  } catch {
    /* fall through */
  }
  return { rejectUnauthorized: false };
}

// --- Postgres backend -----------------------------------------------------
async function createPostgres(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: url,
    ssl: sslFor(url),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // CRITICAL: serverless Postgres (Neon, Supabase, …) closes idle connections.
  // Without this handler, that idle-client error crashes the whole process.
  pool.on('error', (err) => {
    console.error('[db] idle connection error (ignored):', err.message);
  });

  // Run a query with one retry, to ride out a connection the DB dropped while
  // idle or a brief wake-from-suspend.
  const q = async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.warn('[db] query retry after:', err.message);
      return await pool.query(text, params);
    }
  };

  await q(
    `CREATE TABLE IF NOT EXISTS packages (
       tracking_number TEXT PRIMARY KEY,
       data JSONB NOT NULL
     )`
  );

  return {
    async getAll() {
      const { rows } = await q('SELECT data FROM packages');
      return rows.map((r) => r.data);
    },
    async get(tn) {
      const { rows } = await q(
        'SELECT data FROM packages WHERE tracking_number = $1',
        [tn]
      );
      return rows[0] ? rows[0].data : null;
    },
    async put(pkg) {
      await q(
        `INSERT INTO packages (tracking_number, data)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (tracking_number) DO UPDATE SET data = EXCLUDED.data`,
        [pkg.trackingNumber, JSON.stringify(pkg)]
      );
    },
    async del(tn) {
      const { rowCount } = await q(
        'DELETE FROM packages WHERE tracking_number = $1',
        [tn]
      );
      return rowCount > 0;
    },
  };
}

// --- File backend (fallback) ----------------------------------------------
function createFileStore() {
  const DATA_DIR = join(__dirname, 'data');
  const DATA_FILE = join(DATA_DIR, 'packages.json');
  let cache = null;

  async function load() {
    if (cache) return cache;
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
    if (!existsSync(DATA_FILE)) {
      cache = {};
      return cache;
    }
    try {
      cache = JSON.parse((await readFile(DATA_FILE, 'utf8')) || '{}');
    } catch {
      cache = {};
    }
    return cache;
  }
  async function persist() {
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  }
  return {
    async getAll() {
      return Object.values(await load());
    },
    async get(tn) {
      return (await load())[tn] || null;
    },
    async put(pkg) {
      const db = await load();
      db[pkg.trackingNumber] = pkg;
      await persist();
    },
    async del(tn) {
      const db = await load();
      if (!db[tn]) return false;
      delete db[tn];
      await persist();
      return true;
    },
  };
}

let impl;
if (DATABASE_URL) {
  try {
    impl = await createPostgres(DATABASE_URL);
    console.log('[db] Using Postgres storage (persistent).');
  } catch (err) {
    // Don't take the whole site down over a bad/unreachable DATABASE_URL —
    // stay up on file storage and log loudly so it can be fixed.
    console.error(
      '[db] Could NOT connect to Postgres — check DATABASE_URL. Falling back to ' +
        'ephemeral file storage (data will NOT persist). Error:',
      err.message
    );
    impl = createFileStore();
  }
} else {
  impl = createFileStore();
  console.log(
    '[db] Using local file storage. Set DATABASE_URL for persistent storage.'
  );
}

export const getAll = () => impl.getAll();
export const get = (tn) => impl.get(tn);
export const put = (pkg) => impl.put(pkg);
export const del = (tn) => impl.del(tn);
