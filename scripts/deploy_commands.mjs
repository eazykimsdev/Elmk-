/**
 * ConnectingERLC Slash Commands Deployment
 *
 * Global commands only:
 *  1. ONE bulk overwrite (PUT /applications/{id}/commands) with GLOBAL_BOT_COMMANDS.
 *  2. Clear every guild-scoped command (PUT [] per guild) so nothing shows twice.
 *  3. Verify: list global commands and fail if any name appears more than once.
 */

import { GLOBAL_BOT_COMMANDS, hashCommands } from '../botCommands.js';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const HASH_FILE = path.join(DATA_DIR, 'command_definitions_hash.txt');
const API = 'https://discord.com/api/v10';

// Suffix forces one re-run after the switch from guild+global to global-only.
export function currentDeployHash() {
  return `${hashCommands(GLOBAL_BOT_COMMANDS)}|global-only-v2`;
}

export function decodeBotIdFromToken(token) {
  try {
    const raw = String(token || '').trim().replace(/^Bot\s+/i, '');
    const firstPart = raw.split('.')[0];
    if (!firstPart) return null;
    const decoded = Buffer.from(firstPart, 'base64').toString('utf8');
    return /^\d{17,20}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export async function deployCommands({ token: passedToken = null, applicationId: passedAppId = null } = {}) {
  const token = (passedToken || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  const applicationId = (passedAppId || decodeBotIdFromToken(token) || process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '').trim();

  if (!token || !applicationId) {
    console.warn('[COMMANDS DEPLOY] Missing token or application id. Skipping.');
    return { skipped: true, reason: 'missing_credentials' };
  }
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };

  // Each command defined once
  const names = GLOBAL_BOT_COMMANDS.map((c) => c.name);
  const dupDefs = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupDefs.length) throw new Error(`Duplicate command definitions: ${[...new Set(dupDefs)].join(', ')}`);

  // 1. Single global overwrite
  const putRes = await fetch(`${API}/applications/${applicationId}/commands`, {
    method: 'PUT', headers, body: JSON.stringify(GLOBAL_BOT_COMMANDS)
  });
  if (!putRes.ok) throw new Error(`Global overwrite failed: ${await putRes.text()}`);

  // 2. Clear all guild-scoped commands
  const clearedGuilds = [];
  const gRes = await fetch(`${API}/users/@me/guilds?limit=200`, { headers });
  if (gRes.ok) {
    const guilds = await gRes.json();
    for (const g of Array.isArray(guilds) ? guilds : []) {
      try {
        const r = await fetch(`${API}/applications/${applicationId}/guilds/${g.id}/commands`, {
          method: 'PUT', headers, body: '[]'
        });
        if (r.ok) clearedGuilds.push(g.id);
        else if (r.status === 429) {
          const wait = Number((await r.json().catch(() => ({}))).retry_after || 1);
          await new Promise((res) => setTimeout(res, wait * 1000));
        }
      } catch {}
    }
  }

  // 3. Verify
  const listRes = await fetch(`${API}/applications/${applicationId}/commands`, { headers });
  const registered = listRes.ok ? (await listRes.json()).map((c) => c.name) : [];
  const dups = registered.filter((n, i) => registered.indexOf(n) !== i);
  console.log(`[COMMANDS DEPLOY] Global: ${registered.join(', ')} | guilds cleared: ${clearedGuilds.length}`);
  if (dups.length) throw new Error(`Duplicates still registered: ${dups.join(', ')}`);

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HASH_FILE, currentDeployHash(), 'utf8');
  } catch {}

  return { success: true, registered, clearedGuilds: clearedGuilds.length };
}

// Direct CLI execution
if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  deployCommands()
    .then((res) => { console.log('[COMMANDS DEPLOY FINISHED]', res); process.exit(0); })
    .catch((err) => { console.error('[COMMANDS DEPLOY FATAL]', err); process.exit(1); });
}
