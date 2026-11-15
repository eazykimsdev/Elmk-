/**
 * One-time import from Cloudflare D1 into this app's PostgreSQL storage.
 *
 * Runs at boot only when IMPORT_D1=true and CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and
 * CLOUDFLARE_D1_DATABASE_ID are set. It only READS from D1. It:
 *   1. copies every D1 table, unchanged, into the matching PostgreSQL table (archive, safe to re-run)
 *   2. builds the directory listings (promoted_servers.json) and credit ledger (ledger.json) the
 *      website reads, without overwriting servers or transactions that already exist
 * A marker row stops it from running twice. Set IMPORT_D1_FORCE=true to run again.
 */
import fs from 'node:fs';
import path from 'node:path';
import { initPostgresSchema, getPool } from './db.js';
import { getSyncPool } from './dataSync.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const TABLES = [
  'network', 'affiliates', 'applications', 'guild_config', 'config_changes', 'guild_stats',
  'credit_ledger', 'checkins', 'promotions', 'page_views', 'join_clicks', 'partnerships',
  'notifications', 'listing', 'reviews', 'meta', 'sessions', 'login_attempts',
];

async function d1(sql) {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: acct, CLOUDFLARE_D1_DATABASE_ID: db } = process.env;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/d1/database/${db}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(`D1 query failed: ${JSON.stringify(body.errors)}`);
  return body.result[0].results;
}

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); } catch { return fallback; }
};
const writeJson = (file, data) => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
};

async function archiveTable(pool, table) {
  const rows = await d1(`SELECT * FROM ${table}`);
  if (!rows.length) return { table, d1: 0, copied: 0 };
  let copied = 0;
  for (const row of rows) {
    const cols = Object.keys(row);
    const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT DO NOTHING`;
    const r = await pool.query(sql, cols.map((c) => row[c]));
    copied += r.rowCount;
  }
  return { table, d1: rows.length, copied };
}

function buildServers(network, stats, listing, existing) {
  const statsById = new Map(stats.map((s) => {
    let data = {};
    try { data = JSON.parse(s.data || '{}'); } catch { /* ignore */ }
    return [s.id, { ...data, members: s.members }];
  }));
  const listingById = new Map(listing.map((l) => [l.id, l]));
  const have = new Set(existing.map((s) => s.id));
  const added = [];
  for (const n of network) {
    if (have.has(n.id)) continue;
    const st = statsById.get(n.id) || {};
    const li = listingById.get(n.id);
    let tags = [];
    try { tags = JSON.parse(li?.tags || '[]'); } catch { /* ignore */ }
    const category = li?.category || 'Roleplay Server';
    const icon = n.icon || `https://cdn.discordapp.com/icons/${n.id}/default.png`;
    added.push({
      id: n.id,
      guildId: n.id,
      name: n.name,
      icon,
      iconUrl: icon,
      category,
      categories: [category],
      language: li?.language || 'English',
      summary: li?.tagline || '',
      description: li?.description || n.ad || '',
      tags,
      rewardCoins: 2,
      inviteUrl: n.invite || '',
      bannerUrl: n.banner || '',
      memberCount: n.members || st.members || 0,
      bumps: n.bumps || st.bumps || 0,
      lastBumpedAt: st.lastBump || n.updated_at,
      ownerUsername: st.ownerName || null,
      owner_display_name: st.ownerName || null,
      ownerAvatar: st.ownerAvatar || null,
      createdAt: st.joinedAt || n.updated_at,
      updatedAt: Number(n.updated_at) || Date.now(),
      reviews: [],
    });
  }
  return added;
}

export async function importD1IfRequested() {
  if (process.env.IMPORT_D1 !== 'true') return;
  const need = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID'].filter((k) => !process.env[k]);
  if (need.length) { console.error(`[D1 IMPORT] Missing variables: ${need.join(', ')} — skipping.`); return; }
  const sync = getSyncPool();
  if (!sync) { console.error('[D1 IMPORT] No DATABASE_URL — skipping.'); return; }

  try {
    await sync.query(`CREATE TABLE IF NOT EXISTS migration_state (k TEXT PRIMARY KEY, v TEXT NOT NULL, at TIMESTAMPTZ DEFAULT NOW())`);
    const done = await sync.query(`SELECT 1 FROM migration_state WHERE k = 'd1_import'`);
    if (done.rowCount && process.env.IMPORT_D1_FORCE !== 'true') {
      console.log('[D1 IMPORT] Already done earlier — skipping. (Set IMPORT_D1_FORCE=true to run again.)');
      return;
    }
    console.log('[D1 IMPORT] Starting import from Cloudflare D1 (read-only)...');
    await initPostgresSchema();
    const pool = getPool() || sync;
    const report = [];
    for (const t of TABLES) report.push(await archiveTable(pool, t));
    console.table(report);

    // Website data files
    const [network, stats, listing, ledger] = await Promise.all([
      d1('SELECT * FROM network'), d1('SELECT * FROM guild_stats'), d1('SELECT * FROM listing'),
      d1('SELECT * FROM credit_ledger ORDER BY id'),
    ]);
    const dir = readJson('promoted_servers.json', { servers: [], userBalances: {}, userJoins: {}, userJoinRecords: {}, bumpCooldowns: {} });
    dir.servers = Array.isArray(dir.servers) ? dir.servers : [];
    const addedServers = buildServers(network, stats, listing, dir.servers);
    dir.servers.push(...addedServers);
    writeJson('promoted_servers.json', dir);

    const led = readJson('ledger.json', { transactions: [], pending: [] });
    led.transactions = Array.isArray(led.transactions) ? led.transactions : [];
    const haveTx = new Set(led.transactions.map((t) => String(t.id)));
    let addedTx = 0;
    for (const l of ledger) {
      const id = `d1_${l.id}`;
      if (haveTx.has(id)) continue;
      led.transactions.unshift({
        id,
        guildId: l.guild_id,
        amount: l.amount,
        type: l.reason === 'checkin' ? 'checkin' : 'bump',
        description: l.note || `D1 ${l.reason}`,
        userId: l.user_id || null,
        timestamp: new Date(Number(l.created_at)).toISOString(),
      });
      addedTx++;
    }
    writeJson('ledger.json', led);

    await sync.query(
      `INSERT INTO migration_state (k, v) VALUES ('d1_import', $1) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, at = NOW()`,
      [JSON.stringify({ servers: addedServers.length, transactions: addedTx, tables: report })]
    );
    console.log(`[D1 IMPORT] Done. Added ${addedServers.length} server listing(s) and ${addedTx} credit transaction(s).`);
  } catch (err) {
    console.error('[D1 IMPORT] FAILED — nothing was marked done, it will retry on next start:', err.message);
  }
}
