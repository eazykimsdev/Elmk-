/**
 * Durable data storage.
 *
 * The app keeps its state in JSON files under data/. Railway wipes the container
 * disk on every deploy, so this module mirrors that folder into PostgreSQL:
 *   - restoreDataDir(): at boot, copies every saved file from Postgres back into data/
 *   - startDataSync():  every few seconds, saves new/changed files (and deletions) to Postgres,
 *                       and does a final save when the process is told to stop.
 * Without DATABASE_URL this does nothing and the app behaves as before.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SKIP_DIRS = new Set(['backups', 'node_modules']);
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const SYNC_INTERVAL_MS = 5000;

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL || null;
let pool = null;
const known = new Map(); // relative path -> sha1 of what Postgres already has

function getPool() {
  if (!DATABASE_URL) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 8000,
    });
    pool.on('error', (e) => console.error('[DATA SYNC] idle client error:', e.message));
  }
  return pool;
}

export function getSyncPool() {
  return getPool();
}

async function ensureTable(p) {
  await p.query(`CREATE TABLE IF NOT EXISTS app_files (
    path TEXT PRIMARY KEY,
    content BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

function walk(dir, base = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name), path.posix.join(base, entry.name)));
    } else if (entry.isFile() && !entry.name.endsWith('.tmp')) {
      out.push(path.posix.join(base, entry.name));
    }
  }
  return out;
}

const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

export async function restoreDataDir() {
  const p = getPool();
  if (!p) {
    console.log('[DATA SYNC] No DATABASE_URL — using local files only.');
    return;
  }
  try {
    await ensureTable(p);
    const { rows } = await p.query('SELECT path, content FROM app_files');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    for (const r of rows) {
      const target = path.join(DATA_DIR, r.path);
      if (!path.resolve(target).startsWith(path.resolve(DATA_DIR) + path.sep)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, r.content);
      known.set(r.path, sha(r.content));
    }
    console.log(`[DATA SYNC] Restored ${rows.length} file(s) from PostgreSQL into ${DATA_DIR}`);
  } catch (err) {
    console.error('[DATA SYNC] Restore failed, continuing with local files:', err.message);
  } finally {
    // Seed fallback: ensure crucial initial files (users, servers, changelog) exist
    const seedDir = path.join(process.cwd(), 'seeds');
    if (fs.existsSync(seedDir)) {
      for (const entry of fs.readdirSync(seedDir)) {
        if (!entry.endsWith('.json')) continue;
        const target = path.join(DATA_DIR, entry);
        if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
          try {
            fs.copyFileSync(path.join(seedDir, entry), target);
            console.log(`[DATA SYNC] Seeded default ${entry} from seeds/`);
          } catch {}
        }
      }
    }
  }
}

let flushing = false;
export async function flushDataDir() {
  const p = getPool();
  if (!p || flushing) return;
  flushing = true;
  try {
    const present = new Set();
    for (const rel of walk(DATA_DIR)) {
      present.add(rel);
      const full = path.join(DATA_DIR, rel);
      let buf;
      try {
        const st = fs.statSync(full);
        if (st.size > MAX_FILE_BYTES) continue;
        buf = fs.readFileSync(full);
      } catch { continue; }
      const h = sha(buf);
      if (known.get(rel) === h) continue;
      await p.query(
        `INSERT INTO app_files (path, content, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (path) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
        [rel, buf]
      );
      known.set(rel, h);
    }
    for (const rel of [...known.keys()]) {
      if (!present.has(rel)) {
        await p.query('DELETE FROM app_files WHERE path = $1', [rel]);
        known.delete(rel);
      }
    }
  } catch (err) {
    console.error('[DATA SYNC] Save to PostgreSQL failed (will retry):', err.message);
  } finally {
    flushing = false;
  }
}

export function startDataSync() {
  if (!getPool()) return;
  const timer = setInterval(flushDataDir, SYNC_INTERVAL_MS);
  timer.unref();
  let stopping = false;
  const stop = async (sig) => {
    if (stopping) return;
    stopping = true;
    try { await flushDataDir(); } catch { /* ignore */ }
    process.exit(sig === 'SIGINT' ? 130 : 0);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  console.log(`[DATA SYNC] Saving ${DATA_DIR} to PostgreSQL every ${SYNC_INTERVAL_MS / 1000}s.`);
}
