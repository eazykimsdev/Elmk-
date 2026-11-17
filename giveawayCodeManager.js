/**
 * Giveaway Code Manager
 * 
 * Replaces legacy promo codes with a transaction-safe Giveaway Code system:
 * - Admin creates codes (custom typed or crypto-random), amount, max uses, start/end dates, 1 use per server, active toggle.
 * - Owners redeem on the dashboard.
 * - Enforces: code valid, not expired, uses left, server not used yet, server really listed (isServerListable), nobody blacklisted.
 * - Uses atomic database transactions + UNIQUE constraint so the last spot cannot be claimed twice.
 * - Sends owner a Components V2 DM with real Separators, no embeds, no emojis, orange or theme accent.
 * - Records an append-only ledger transaction with reason 'giveaway code'.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { query, getPool, isPostgresConnected } from './db.js';
import { isUserBanned, recordAuditAction } from './adminManager.js';
import { checkBlacklist } from './blacklistManager.js';
import { getPromotedServers, isServerListable, saveDirectoryData, loadDirectoryData } from './directoryManager.js';
import { recordLedgerTransaction, getServerLedgerSummary } from './ledgerManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CODES_FILE = path.join(DATA_DIR, 'giveaway_codes.json');
const REDEMPTIONS_FILE = path.join(DATA_DIR, 'giveaway_code_redemptions.json');

const BRAND_ORANGE = 16347158; // #F97316
const CHRISTMAS_RED = 12856117; // #C42B35

function getThemeAccent() {
  const currentTheme = String(process.env.THEME || '').toLowerCase();
  return currentTheme === 'christmas' ? CHRISTMAS_RED : BRAND_ORANGE;
}

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CODES_FILE)) {
    fs.writeFileSync(CODES_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(REDEMPTIONS_FILE)) {
    fs.writeFileSync(REDEMPTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

export function loadCodesFile() {
  ensureFiles();
  try {
    const raw = fs.readFileSync(CODES_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function saveCodesFile(list) {
  ensureFiles();
  try {
    const tmp = `${CODES_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmp, CODES_FILE);
    return true;
  } catch (err) {
    console.error('[GIVEAWAY CODES] Error saving codes file:', err.message);
    return false;
  }
}

export function loadRedemptionsFile() {
  ensureFiles();
  try {
    const raw = fs.readFileSync(REDEMPTIONS_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function saveRedemptionsFile(list) {
  ensureFiles();
  try {
    const tmp = `${REDEMPTIONS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmp, REDEMPTIONS_FILE);
    return true;
  } catch (err) {
    console.error('[GIVEAWAY CODES] Error saving redemptions file:', err.message);
    return false;
  }
}

/**
 * Generate a random crypto giveaway code (e.g. GW-A1B2-C3D4)
 */
export function generateCryptoCode() {
  const chunk1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const chunk2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `GW-${chunk1}-${chunk2}`;
}

/**
 * Create a new giveaway code (Admin)
 */
export async function createGiveawayCode({
  code,
  amount = 100,
  maxUses = 50,
  startsAt = null,
  expiresAt = null,
  isActive = true,
  createdBy = 'Admin'
} = {}) {
  const cleanCode = (code && String(code).trim()) ? String(code).trim().toUpperCase() : generateCryptoCode();
  const cleanAmount = Math.max(1, parseInt(amount, 10) || 100);
  const cleanMaxUses = Math.max(1, parseInt(maxUses, 10) || 50);
  const id = `gwc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const codeObj = {
    id,
    code: cleanCode,
    amount: cleanAmount,
    maxUses: cleanMaxUses,
    usesCount: 0,
    isActive: Boolean(isActive),
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    createdBy: String(createdBy || 'Admin'),
    createdAt: nowIso
  };

  if (isPostgresConnected()) {
    try {
      await query(
        `INSERT INTO giveaway_codes 
         (id, code, amount, max_uses, uses_count, is_active, starts_at, expires_at, created_by, created_at)
         VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9)`,
        [
          codeObj.id,
          codeObj.code,
          codeObj.amount,
          codeObj.maxUses,
          codeObj.isActive,
          codeObj.startsAt,
          codeObj.expiresAt,
          codeObj.createdBy,
          codeObj.createdAt
        ]
      );
    } catch (err) {
      if (err.code === '23505') {
        throw new Error(`Giveaway code "${cleanCode}" already exists.`);
      }
      throw err;
    }
  }

  const all = loadCodesFile();
  if (all.some((c) => c.code.toUpperCase() === cleanCode)) {
    throw new Error(`Giveaway code "${cleanCode}" already exists.`);
  }
  all.unshift(codeObj);
  saveCodesFile(all);

  recordAuditAction({
    actor: { username: createdBy },
    action: 'create_giveaway_code',
    target: codeObj.id,
    targetType: 'giveaway_code',
    reason: `Created giveaway code ${cleanCode} (${cleanAmount} cr, ${cleanMaxUses} max uses)`
  });

  return codeObj;
}

/**
 * List all giveaway codes
 */
export async function getGiveawayCodes() {
  if (isPostgresConnected()) {
    try {
      const res = await query(
        `SELECT id, code, amount, max_uses as "maxUses", uses_count as "usesCount",
                is_active as "isActive", starts_at as "startsAt", expires_at as "expiresAt",
                created_by as "createdBy", created_at as "createdAt"
         FROM giveaway_codes
         ORDER BY created_at DESC`
      );
      if (res && Array.isArray(res.rows)) {
        return res.rows.map(r => ({
          ...r,
          amount: Number(r.amount),
          maxUses: Number(r.maxUses),
          usesCount: Number(r.usesCount),
          isActive: Boolean(r.isActive)
        }));
      }
    } catch (err) {
      console.error('[GIVEAWAY CODES] Postgres query error:', err.message);
    }
  }
  return loadCodesFile();
}

/**
 * Toggle code active state
 */
export async function toggleGiveawayCode(id, isActive, actor = null) {
  const activeBool = Boolean(isActive);

  if (isPostgresConnected()) {
    try {
      await query(`UPDATE giveaway_codes SET is_active = $1 WHERE id = $2`, [activeBool, id]);
    } catch (err) {
      console.error('[GIVEAWAY CODES] Toggle error in Postgres:', err.message);
    }
  }

  const all = loadCodesFile();
  const match = all.find(c => c.id === id);
  if (match) {
    match.isActive = activeBool;
    saveCodesFile(all);
  }

  recordAuditAction({
    actor: actor || { username: 'Admin' },
    action: 'toggle_giveaway_code',
    target: id,
    targetType: 'giveaway_code',
    reason: `Giveaway code ${match?.code || id} set to ${activeBool ? 'active' : 'inactive'}`
  });

  return { success: true, id, isActive: activeBool };
}

/**
 * Delete a giveaway code
 */
export async function deleteGiveawayCode(id, actor = null) {
  if (isPostgresConnected()) {
    try {
      await query(`DELETE FROM giveaway_codes WHERE id = $1`, [id]);
    } catch (err) {
      console.error('[GIVEAWAY CODES] Delete error in Postgres:', err.message);
    }
  }

  const all = loadCodesFile();
  const filtered = all.filter(c => c.id !== id);
  saveCodesFile(filtered);

  const redemptions = loadRedemptionsFile();
  saveRedemptionsFile(redemptions.filter(r => r.codeId !== id));

  recordAuditAction({
    actor: actor || { username: 'Admin' },
    action: 'delete_giveaway_code',
    target: id,
    targetType: 'giveaway_code',
    reason: `Deleted giveaway code ${id}`
  });

  return { success: true, id };
}

/**
 * Get all redemptions for a giveaway code
 */
export async function getGiveawayRedemptions(codeId = null) {
  if (isPostgresConnected()) {
    try {
      let sql = `
        SELECT id, code_id as "codeId", code, server_id as "serverId",
               server_name as "serverName", user_id as "userId",
               username, amount, redeemed_at as "redeemedAt"
        FROM giveaway_code_redemptions
      `;
      const params = [];
      if (codeId) {
        sql += ` WHERE code_id = $1`;
        params.push(codeId);
      }
      sql += ` ORDER BY redeemed_at DESC`;
      const res = await query(sql, params);
      if (res && Array.isArray(res.rows)) {
        return res.rows;
      }
    } catch (err) {
      console.error('[GIVEAWAY CODES] Redemptions query error:', err.message);
    }
  }

  const all = loadRedemptionsFile();
  if (codeId) {
    return all.filter(r => r.codeId === codeId);
  }
  return all;
}

// In-memory mutex for JSON mode concurrency safety
let jsonMutexPromise = Promise.resolve();
function withJsonLock(fn) {
  const result = jsonMutexPromise.then(() => fn());
  jsonMutexPromise = result.catch(() => {});
  return result;
}

/**
 * Build Components V2 DM payload for giveaway code redemption
 */
export function buildGiveawayRedemptionV2Payload({ serverName, code, amount, newBalance }) {
  return {
    flags: 32768, // MessageFlags.IsComponentsV2
    components: [
      {
        type: 17, // Container (No accent_color = no color on the side)
        components: [
          {
            type: 10, // TextDisplay
            content: `### Giveaway Code Redeemed: ${serverName}\n**${amount} credits** were deposited to **${serverName}**'s community treasury.`
          },
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 10, // TextDisplay
            content: `Code: \`${code}\`\nNew Server Balance: **${newBalance} credits**`
          }
        ]
      }
    ]
  };
}

/**
 * Dispatch Components V2 DM to Discord server owner
 */
export async function sendGiveawayRedemptionDM({ ownerId, serverName, code, amount, newBalance }) {
  if (!ownerId) return { delivered: false, note: 'No owner ID provided' };

  const token = (process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) return { delivered: false, note: 'No bot token configured' };

  try {
    // 1. Open DM channel
    const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: String(ownerId) })
    });

    if (!dmRes.ok) {
      return { delivered: false, note: `Failed to open DM channel (status: ${dmRes.status})` };
    }

    const dmChan = await dmRes.json();
    const payload = buildGiveawayRedemptionV2Payload({ serverName, code, amount, newBalance });

    // 2. Send Components V2 DM
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${dmChan.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return { delivered: msgRes.ok, note: msgRes.ok ? 'Delivered' : `Failed with status ${msgRes.status}` };
  } catch (err) {
    return { delivered: false, note: err.message || 'Network error' };
  }
}

/**
 * Redeem a giveaway code for a server.
 * Guarantees atomic transaction and checks:
 * - Code exists and valid
 * - Code is active
 * - Code within start and end time
 * - Uses left
 * - Server has not already used this code
 * - Server is really listed (isServerListable)
 * - Nobody involved is blacklisted
 */
export async function redeemGiveawayCode({ code, serverId, userId, username = 'Discord User' }) {
  if (!code || !String(code).trim()) {
    return { success: false, error: 'Please enter a giveaway code.' };
  }
  if (!serverId) {
    return { success: false, error: 'Server ID is required to redeem giveaway codes.' };
  }

  const cleanCode = String(code).trim().toUpperCase();
  const cleanSid = String(serverId).trim();
  const cleanUid = String(userId).trim();

  // 1. Check server exists and passes isServerListable
  const dirData = loadDirectoryData();
  const server = dirData.servers.find(s => String(s.id) === cleanSid || String(s.guildId) === cleanSid);
  if (!server) {
    return { success: false, error: 'Server not found in community directory.' };
  }

  if (!isServerListable(server)) {
    return {
      success: false,
      error: 'Your server must be listed in the public directory with an invite, description, and category before redeeming giveaway codes.'
    };
  }

  // 2. Check blacklist / banned
  if (cleanUid && isUserBanned(cleanUid)) {
    return { success: false, error: 'Account is restricted from claiming rewards.' };
  }
  const blUser = checkBlacklist({ userId: cleanUid });
  if (blUser?.blocked) {
    return { success: false, error: 'Account is restricted.' };
  }
  const blServer = checkBlacklist({ discordId: cleanSid });
  if (blServer?.blocked) {
    return { success: false, error: 'Server is restricted.' };
  }

  const now = Date.now();

  // 3. Concurrency-Safe Transaction Execution
  if (isPostgresConnected()) {
    const pool = getPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Select and lock code row
        const codeRes = await client.query(
          `SELECT * FROM giveaway_codes WHERE UPPER(code) = $1 FOR UPDATE`,
          [cleanCode]
        );

        if (codeRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Invalid giveaway code.' };
        }

        const codeRow = codeRes.rows[0];

        if (!codeRow.is_active) {
          await client.query('ROLLBACK');
          return { success: false, error: 'This giveaway code is currently disabled.' };
        }

        if (codeRow.starts_at && new Date(codeRow.starts_at).getTime() > now) {
          await client.query('ROLLBACK');
          return { success: false, error: 'This giveaway code has not started yet.' };
        }

        if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < now) {
          await client.query('ROLLBACK');
          return { success: false, error: 'This giveaway code has expired.' };
        }

        const maxUses = Number(codeRow.max_uses || 0);
        const usesCount = Number(codeRow.uses_count || 0);

        if (usesCount >= maxUses) {
          await client.query('ROLLBACK');
          return { success: false, error: 'This giveaway code has reached its maximum uses.' };
        }

        // Check if server already redeemed this code
        const prevRedemption = await client.query(
          `SELECT id FROM giveaway_code_redemptions WHERE code_id = $1 AND server_id = $2`,
          [codeRow.id, cleanSid]
        );

        if (prevRedemption.rows.length > 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'This server has already redeemed this giveaway code.' };
        }

        const redemptionId = `gwred_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const creditAmount = Number(codeRow.amount);

        // Insert redemption with UNIQUE(code_id, server_id)
        await client.query(
          `INSERT INTO giveaway_code_redemptions 
           (id, code_id, code, server_id, server_name, user_id, username, amount, redeemed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            redemptionId,
            codeRow.id,
            codeRow.code,
            cleanSid,
            server.name || `Server ${cleanSid}`,
            cleanUid,
            username,
            creditAmount
          ]
        );

        // Increment code uses
        await client.query(
          `UPDATE giveaway_codes SET uses_count = uses_count + 1 WHERE id = $1`,
          [codeRow.id]
        );

        // Record append-only ledger transaction (reason: 'giveaway code')
        recordLedgerTransaction({
          userId: cleanUid,
          type: 'earned',
          amount: creditAmount,
          reason: 'giveaway code',
          description: `Redeemed giveaway code ${codeRow.code} (+${creditAmount} cr)`,
          guildId: cleanSid,
          serverId: cleanSid,
          guildName: server.name || 'Community Server',
          status: 'posted',
          idempotencyKey: `giveaway_code_${codeRow.id}_${cleanSid}`
        });

        // Update server balance
        server.credits = Number(server.credits || 0) + creditAmount;
        server.balance = Number(server.balance || 0) + creditAmount;
        saveDirectoryData(dirData);

        await client.query('COMMIT');

        // Send Components V2 DM to server owner
        sendGiveawayRedemptionDM({
          ownerId: server.ownerId || cleanUid,
          serverName: server.name,
          code: codeRow.code,
          amount: creditAmount,
          newBalance: server.balance
        }).catch(() => {});

        return {
          success: true,
          amount: creditAmount,
          newBalance: server.balance,
          serverName: server.name,
          code: codeRow.code
        };
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
          return { success: false, error: 'This server has already redeemed this giveaway code.' };
        }
        return { success: false, error: err.message || 'Transaction failed.' };
      } finally {
        client.release();
      }
    }
  }

  // JSON Mode with Mutex Lock
  return withJsonLock(async () => {
    const codes = loadCodesFile();
    const codeObj = codes.find(c => c.code.toUpperCase() === cleanCode);

    if (!codeObj) {
      return { success: false, error: 'Invalid giveaway code.' };
    }

    if (!codeObj.isActive) {
      return { success: false, error: 'This giveaway code is currently disabled.' };
    }

    if (codeObj.startsAt && new Date(codeObj.startsAt).getTime() > now) {
      return { success: false, error: 'This giveaway code has not started yet.' };
    }

    if (codeObj.expiresAt && new Date(codeObj.expiresAt).getTime() < now) {
      return { success: false, error: 'This giveaway code has expired.' };
    }

    const usesCount = Number(codeObj.usesCount || 0);
    const maxUses = Number(codeObj.maxUses || 0);

    if (usesCount >= maxUses) {
      return { success: false, error: 'This giveaway code has reached its maximum uses.' };
    }

    const redemptions = loadRedemptionsFile();
    const alreadyUsed = redemptions.some(
      r => r.codeId === codeObj.id && String(r.serverId) === cleanSid
    );

    if (alreadyUsed) {
      return { success: false, error: 'This server has already redeemed this giveaway code.' };
    }

    const creditAmount = Number(codeObj.amount || 100);
    const redemptionId = `gwred_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    codeObj.usesCount = usesCount + 1;
    saveCodesFile(codes);

    redemptions.unshift({
      id: redemptionId,
      codeId: codeObj.id,
      code: codeObj.code,
      serverId: cleanSid,
      serverName: server.name || `Server ${cleanSid}`,
      userId: cleanUid,
      username,
      amount: creditAmount,
      redeemedAt: new Date().toISOString()
    });
    saveRedemptionsFile(redemptions);

    // Record append-only ledger transaction (reason: 'giveaway code')
    recordLedgerTransaction({
      userId: cleanUid,
      type: 'earned',
      amount: creditAmount,
      reason: 'giveaway code',
      description: `Redeemed giveaway code ${codeObj.code} (+${creditAmount} cr)`,
      guildId: cleanSid,
      serverId: cleanSid,
      guildName: server.name || 'Community Server',
      status: 'posted',
      idempotencyKey: `giveaway_code_${codeObj.id}_${cleanSid}`
    });

    server.credits = Number(server.credits || 0) + creditAmount;
    server.balance = Number(server.balance || 0) + creditAmount;
    saveDirectoryData(dirData);

    // Send Components V2 DM to server owner
    sendGiveawayRedemptionDM({
      ownerId: server.ownerId || cleanUid,
      serverName: server.name,
      code: codeObj.code,
      amount: creditAmount,
      newBalance: server.balance
    }).catch(() => {});

    return {
      success: true,
      amount: creditAmount,
      newBalance: server.balance,
      serverName: server.name,
      code: codeObj.code
    };
  });
}
