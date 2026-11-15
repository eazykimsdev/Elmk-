import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query as dbQuery, isPostgresConnected, getPool } from './db.js';
import { recordLedgerTransaction, loadLedgerData, saveLedgerData } from './ledgerManager.js';
import { recordAuditAction } from './adminManager.js';
import { isUserBanned } from './adminManager.js';
import { checkBlacklist } from './blacklistManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const GIVEAWAY_FILE = path.join(DATA_DIR, 'launch_giveaway.json');

// In-memory mutex for strictly serializing concurrent claims in JSON storage mode
class AsyncMutex {
  constructor() {
    this._locked = false;
    this._queue = [];
  }
  async acquire() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }
  release() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next();
    } else {
      this._locked = false;
    }
  }
  async runExclusive(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

const claimMutex = new AsyncMutex();

/**
 * Default settings (stored in settings file/database, not hardcoded in logic)
 */
const DEFAULT_SETTINGS = {
  enabled: true,
  title: 'Launch Giveaway',
  max_claims: 20,
  credits_amount: 200,
  started_at: 1730000000000,
  support_server_url: process.env.SUPPORT_INVITE_URL || 'https://discord.gg/connectingerlc'
};

function safeRead(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn(`[GIVEAWAY] Failed to read ${filePath}:`, err.message);
  }
  return fallback;
}

function safeWrite(filePath, data) {
  try {
    const tmp = `${filePath}.tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
    return true;
  } catch (err) {
    console.error(`[GIVEAWAY] Failed to write ${filePath}:`, err.message);
    return false;
  }
}

function loadGiveawayData() {
  const data = safeRead(GIVEAWAY_FILE, {
    settings: { ...DEFAULT_SETTINGS },
    claims: []
  });
  if (!data.settings) data.settings = { ...DEFAULT_SETTINGS };
  if (!Array.isArray(data.claims)) data.claims = [];
  return data;
}

function saveGiveawayData(data) {
  return safeWrite(GIVEAWAY_FILE, data);
}

/**
 * Initialize PostgreSQL tables if PostgreSQL is connected
 */
export async function initGiveawayPostgresSchema() {
  if (!isPostgresConnected()) return false;
  const sql = `
    CREATE TABLE IF NOT EXISTS launch_giveaway_settings (
      id INT PRIMARY KEY DEFAULT 1,
      enabled BOOLEAN NOT NULL DEFAULT true,
      max_claims INT NOT NULL DEFAULT 20,
      credits_amount INT NOT NULL DEFAULT 200,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      support_server_url TEXT NOT NULL DEFAULT 'https://discord.gg/connectingerlc'
    );
    INSERT INTO launch_giveaway_settings (id, enabled, max_claims, credits_amount, started_at, support_server_url)
    VALUES (1, true, 20, 200, NOW(), 'https://discord.gg/connectingerlc')
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS launch_giveaway_claims (
      id BIGSERIAL PRIMARY KEY,
      spot_number INT NOT NULL UNIQUE,
      server_id VARCHAR(64) NOT NULL UNIQUE,
      server_name VARCHAR(256) NOT NULL,
      server_icon TEXT,
      owner_user_id VARCHAR(64) NOT NULL UNIQUE,
      owner_username VARCHAR(128) NOT NULL,
      credits_awarded INT NOT NULL,
      dm_sent BOOLEAN NOT NULL DEFAULT false,
      dm_error TEXT,
      show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_giveaway_claims_server ON launch_giveaway_claims (server_id);
    CREATE INDEX IF NOT EXISTS idx_giveaway_claims_user ON launch_giveaway_claims (owner_user_id);
  `;
  try {
    await dbQuery(sql);
    return true;
  } catch (err) {
    console.error('[GIVEAWAY] Failed to init postgres schema:', err.message);
    return false;
  }
}

/**
 * Read current giveaway settings
 */
export async function getGiveawaySettings() {
  if (isPostgresConnected()) {
    try {
      const res = await dbQuery('SELECT * FROM launch_giveaway_settings WHERE id = 1 LIMIT 1');
      if (res && res.rows && res.rows[0]) {
        const row = res.rows[0];
        return {
          enabled: Boolean(row.enabled),
          max_claims: Number(row.max_claims || 20),
          credits_amount: Number(row.credits_amount || 200),
          started_at: row.started_at ? new Date(row.started_at).getTime() : DEFAULT_SETTINGS.started_at,
          support_server_url: row.support_server_url || DEFAULT_SETTINGS.support_server_url
        };
      }
    } catch (err) {
      console.warn('[GIVEAWAY] Postgres settings read failed, using JSON fallback:', err.message);
    }
  }

  const data = loadGiveawayData();
  return {
    ...DEFAULT_SETTINGS,
    ...(data.settings || {})
  };
}

/**
 * Update giveaway settings (Admin)
 */
export async function updateGiveawaySettings(patch = {}, actor = null) {
  const current = await getGiveawaySettings();
  const updated = {
    ...current,
    ...patch,
    title: patch.title !== undefined ? String(patch.title || 'Launch Giveaway').trim() : (current.title || 'Launch Giveaway'),
    max_claims: patch.max_claims !== undefined ? Math.max(1, parseInt(patch.max_claims, 10) || 20) : current.max_claims,
    credits_amount: patch.credits_amount !== undefined ? Math.max(1, parseInt(patch.credits_amount, 10) || 200) : current.credits_amount,
    enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
    support_server_url: patch.support_server_url !== undefined ? String(patch.support_server_url).trim() : current.support_server_url
  };

  if (isPostgresConnected()) {
    try {
      await dbQuery(
        `UPDATE launch_giveaway_settings 
         SET enabled = $1, max_claims = $2, credits_amount = $3, support_server_url = $4
         WHERE id = 1`,
        [updated.enabled, updated.max_claims, updated.credits_amount, updated.support_server_url]
      );
    } catch (err) {
      console.warn('[GIVEAWAY] Postgres settings update error:', err.message);
    }
  }

  const data = loadGiveawayData();
  data.settings = updated;
  saveGiveawayData(data);

  if (actor) {
    recordAuditAction({
      actor,
      action: 'giveaway_settings_update',
      target: 'launch_giveaway',
      targetType: 'settings',
      reason: `Admin updated giveaway settings (${updated.max_claims} spots, ${updated.credits_amount} cr)`,
      before: JSON.stringify(current),
      after: JSON.stringify(updated)
    });
  }

  return updated;
}

/**
 * Reset giveaway claims to start a fresh giveaway round (Admin)
 */
export async function resetGiveawayClaims(actor = null) {
  if (isPostgresConnected()) {
    try {
      await dbQuery('DELETE FROM launch_giveaway_claims');
    } catch (err) {
      console.warn('[GIVEAWAY] Postgres claims reset error:', err.message);
    }
  }

  const data = loadGiveawayData();
  const previousCount = Array.isArray(data.claims) ? data.claims.length : 0;
  data.claims = [];
  data.settings = {
    ...DEFAULT_SETTINGS,
    ...(data.settings || {}),
    started_at: Date.now()
  };
  saveGiveawayData(data);

  if (actor) {
    recordAuditAction({
      actor,
      action: 'giveaway_claims_reset',
      target: 'launch_giveaway',
      targetType: 'settings',
      reason: `Admin reset giveaway claims (cleared ${previousCount} previous claims for new round)`,
      before: JSON.stringify({ claimsCount: previousCount }),
      after: JSON.stringify({ claimsCount: 0, started_at: data.settings.started_at })
    });
  }

  return { settings: data.settings, claims: [] };
}

/**
 * Toggle giveaway enabled state (Admin)
 */
export async function toggleGiveaway(enabled, actor = null) {
  const current = await getGiveawaySettings();
  const newEnabled = Boolean(enabled);
  return updateGiveawaySettings({ enabled: newEnabled }, actor);
}

/**
 * Get all giveaway claims
 */
export async function getGiveawayClaims() {
  if (isPostgresConnected()) {
    try {
      const res = await dbQuery('SELECT * FROM launch_giveaway_claims ORDER BY spot_number ASC');
      if (res && res.rows) {
        return res.rows.map((r) => ({
          id: String(r.id),
          spot_number: Number(r.spot_number),
          server_id: String(r.server_id),
          server_name: r.server_name,
          server_icon: r.server_icon,
          owner_user_id: String(r.owner_user_id),
          owner_username: r.owner_username,
          credits_awarded: Number(r.credits_awarded),
          dm_sent: Boolean(r.dm_sent),
          dm_error: r.dm_error || null,
          show_on_dashboard: Boolean(r.show_on_dashboard),
          created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
        }));
      }
    } catch (err) {
      console.warn('[GIVEAWAY] Postgres claims read error, fallback to JSON:', err.message);
    }
  }

  const data = loadGiveawayData();
  return (data.claims || []).sort((a, b) => a.spot_number - b.spot_number);
}

/**
 * Get public giveaway status for banners
 */
export async function getGiveawayPublicStatus() {
  const settings = await getGiveawaySettings();
  const claims = await getGiveawayClaims();
  const claimsCount = claims.length;
  const spotsLeft = Math.max(0, settings.max_claims - claimsCount);
  const active = Boolean(settings.enabled && spotsLeft > 0);

  return {
    active,
    enabled: settings.enabled,
    totalSpots: settings.max_claims,
    spotsLeft,
    claimsCount,
    creditsAmount: settings.credits_amount
  };
}

/**
 * Build Components V2 Panel for the giveaway reward DM
 */
export function buildGiveawayV2Panel({
  serverName,
  serverIconUrl,
  serverId,
  spotNumber,
  maxClaims,
  amount,
  supportServerUrl,
  siteUrl = 'https://connectingerlc.xyz'
}) {
  const dashboardUrl = `${siteUrl}/dashboard/${serverId}`;
  const inviteUrl = supportServerUrl || 'https://discord.gg/connectingerlc';

  return {
    flags: 32768, // MessageFlags.IsComponentsV2
    components: [
      {
        type: 17, // Container
        accent_color: 16347158, // Brand Orange #F97316 (Zero green)
        components: [
          {
            type: 10, // TextDisplay
            content: `# Launch Giveaway Winner\nCongratulations! **${serverName}** is one of the first ${maxClaims} servers listed on ConnectingERLC. Enjoy your **${amount} credits**.`
          },
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 10, // TextDisplay
            content: `**Spot ${spotNumber} of ${maxClaims} Claimed**\nServer: **${serverName}**\nReward: **${amount} credits** (deposited to server treasury)\n\nCredits allow your community to climb directory rankings, bump to the top of discovery, and grow active members.`
          },
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Open dashboard',
                url: dashboardUrl
              },
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Join our server',
                url: inviteUrl
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Dispatch DM to server owner with fallback handling
 */
export async function sendGiveawayRewardDM({
  ownerUserId,
  serverName,
  serverIconUrl,
  serverId,
  spotNumber,
  maxClaims,
  amount,
  supportServerUrl,
  siteUrl = 'https://connectingerlc.xyz'
}) {
  const botToken = (
    process.env.DISCORD_BOT_TOKEN ||
    process.env.CONNECTINGERLC_BOT_TOKEN ||
    process.env.DISCORD_TOKEN ||
    ''
  ).trim().replace(/^Bot\s+/i, '');

  if (!botToken || !ownerUserId) {
    return { success: false, closedDms: true, error: 'No bot token or owner ID provided' };
  }

  const payload = buildGiveawayV2Panel({
    serverName,
    serverIconUrl,
    serverId,
    spotNumber,
    maxClaims,
    amount,
    supportServerUrl,
    siteUrl
  });

  try {
    // 1. Open DM channel with owner
    const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: String(ownerUserId) })
    });

    if (!dmRes.ok) {
      console.warn(`[GIVEAWAY DM] Could not open DM with owner ${ownerUserId}: HTTP ${dmRes.status}`);
      return { success: false, closedDms: true, error: `HTTP ${dmRes.status}` };
    }

    const dmChannel = await dmRes.json();
    if (!dmChannel?.id) {
      return { success: false, closedDms: true, error: 'No DM channel returned' };
    }

    // 2. Send Components V2 message
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text().catch(() => '');
      console.warn(`[GIVEAWAY DM] Discord rejected DM message: HTTP ${msgRes.status} ${errText}`);
      return { success: false, closedDms: true, error: `HTTP ${msgRes.status}: ${errText}` };
    }

    return { success: true, closedDms: false };
  } catch (err) {
    console.warn('[GIVEAWAY DM] Network error delivering DM:', err.message);
    return { success: false, closedDms: true, error: err.message };
  }
}

/**
 * Process giveaway claim upon server listing
 * Thread-safe and concurrency-safe across PostgreSQL transactions and JSON Mutex
 */
export async function tryClaimLaunchGiveaway({
  server,
  ownerUser,
  botInGuild = true,
  isNewListing = true,
  siteUrl = 'https://connectingerlc.xyz'
}) {
  if (!server || !server.id) {
    return { claimed: false, reason: 'Invalid server' };
  }

  // Rule 2: Must be a new listing made after the giveaway started (migrated servers do not count)
  if (!isNewListing || server.migrated) {
    return { claimed: false, reason: 'Not a new listing' };
  }

  // Rule 2: Bot must be in the server
  if (!botInGuild) {
    return { claimed: false, reason: 'Bot not in server' };
  }

  const ownerUserId = String(
    (ownerUser && typeof ownerUser === 'object' ? ownerUser.id : ownerUser) ||
    server.ownerId ||
    ''
  ).trim();

  const ownerUsername = String(
    (ownerUser && typeof ownerUser === 'object' && (ownerUser.username || ownerUser.globalName)) ||
    server.ownerUsername ||
    server.owner_display_name ||
    'Community Owner'
  );

  if (!ownerUserId) {
    return { claimed: false, reason: 'Missing owner ID' };
  }

  // Rule 6: Blacklisted users and servers do not count
  if (isUserBanned(ownerUserId)) {
    return { claimed: false, reason: 'Owner is banned' };
  }
  const blCheckUser = checkBlacklist({ userId: ownerUserId });
  if (blCheckUser?.blocked) {
    return { claimed: false, reason: 'Owner is blacklisted' };
  }
  const blCheckServer = checkBlacklist({ discordId: server.id });
  if (blCheckServer?.blocked) {
    return { claimed: false, reason: 'Server is blacklisted' };
  }

  // Concurrency-safe execution: Postgres transaction or in-memory Mutex for JSON
  if (isPostgresConnected()) {
    const pool = getPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Lock settings row
        const settingsRes = await client.query('SELECT * FROM launch_giveaway_settings WHERE id = 1 FOR UPDATE');
        const settingsRow = settingsRes?.rows?.[0] || DEFAULT_SETTINGS;
        if (!settingsRow.enabled) {
          await client.query('ROLLBACK');
          return { claimed: false, reason: 'Giveaway disabled' };
        }

        const maxClaims = Number(settingsRow.max_claims || 20);
        const creditsAmount = Number(settingsRow.credits_amount || 200);

        // Check if server already claimed
        const serverCheck = await client.query('SELECT id FROM launch_giveaway_claims WHERE server_id = $1', [server.id]);
        if (serverCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return { claimed: false, reason: 'Server already claimed' };
        }

        // Check if user already claimed
        const userCheck = await client.query('SELECT id FROM launch_giveaway_claims WHERE owner_user_id = $1', [ownerUserId]);
        if (userCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return { claimed: false, reason: 'User already claimed for another server' };
        }

        // Check total spots count
        const countRes = await client.query('SELECT COUNT(*)::int AS count FROM launch_giveaway_claims');
        const currentCount = countRes.rows[0]?.count || 0;
        if (currentCount >= maxClaims) {
          await client.query('ROLLBACK');
          return { claimed: false, reason: 'All giveaway spots have been claimed' };
        }

        const spotNumber = currentCount + 1;

        // Insert claim with UNIQUE constraints
        const insertRes = await client.query(
          `INSERT INTO launch_giveaway_claims 
           (spot_number, server_id, server_name, server_icon, owner_user_id, owner_username, credits_awarded, dm_sent, dm_error, show_on_dashboard)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            spotNumber,
            server.id,
            server.name || `Server ${server.id}`,
            server.iconUrl || server.icon || null,
            ownerUserId,
            ownerUsername,
            creditsAmount,
            false,
            null,
            false
          ]
        );

        await client.query('COMMIT');
        const claimRow = insertRes.rows[0];

        // Append-only ledger transaction with reason "launch giveaway"
        recordLedgerTransaction({
          userId: ownerUserId,
          guildId: server.id,
          guildName: server.name || `Server ${server.id}`,
          guildIconUrl: server.iconUrl || server.icon || null,
          type: 'earned',
          amount: creditsAmount,
          reason: 'launch_giveaway',
          description: `Launch giveaway reward: spot #${spotNumber} of ${maxClaims} (+${creditsAmount} cr)`,
          triggeredBy: 'ConnectingERLC Platform (Launch Giveaway)',
          status: 'posted'
        });

        // Dispatch Components V2 panel DM
        const dmResult = await sendGiveawayRewardDM({
          ownerUserId,
          serverName: server.name || `Server ${server.id}`,
          serverIconUrl: server.iconUrl || server.icon || null,
          serverId: server.id,
          spotNumber,
          maxClaims,
          amount: creditsAmount,
          supportServerUrl: settingsRow.support_server_url,
          siteUrl
        });

        // Update DM status in database
        await dbQuery(
          `UPDATE launch_giveaway_claims 
           SET dm_sent = $1, dm_error = $2, show_on_dashboard = $3 
           WHERE id = $4`,
          [
            dmResult.success,
            dmResult.error || null,
            Boolean(dmResult.closedDms),
            claimRow.id
          ]
        );

        return {
          claimed: true,
          spotNumber,
          maxClaims,
          creditsAmount,
          dmSent: dmResult.success,
          closedDms: Boolean(dmResult.closedDms)
        };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[GIVEAWAY] Transaction error during claim:', err.message);
        return { claimed: false, reason: err.message };
      } finally {
        client.release();
      }
    }
  }

  // JSON storage mode with Mutex
  return await claimMutex.runExclusive(async () => {
    const data = loadGiveawayData();
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(data.settings || {})
    };

    if (!settings.enabled) {
      return { claimed: false, reason: 'Giveaway disabled' };
    }

    const maxClaims = Number(settings.max_claims || 20);
    const creditsAmount = Number(settings.credits_amount || 200);

    // Check unique server
    const serverExists = data.claims.some((c) => String(c.server_id) === String(server.id));
    if (serverExists) {
      return { claimed: false, reason: 'Server already claimed' };
    }

    // Check unique user
    const userExists = data.claims.some((c) => String(c.owner_user_id) === String(ownerUserId));
    if (userExists) {
      return { claimed: false, reason: 'User already claimed for another server' };
    }

    // Check spots remaining
    if (data.claims.length >= maxClaims) {
      return { claimed: false, reason: 'All giveaway spots have been claimed' };
    }

    const spotNumber = data.claims.length + 1;
    const claimRecord = {
      id: `claim_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      spot_number: spotNumber,
      server_id: String(server.id),
      server_name: server.name || `Server ${server.id}`,
      server_icon: server.iconUrl || server.icon || null,
      owner_user_id: String(ownerUserId),
      owner_username: ownerUsername,
      credits_awarded: creditsAmount,
      dm_sent: false,
      dm_error: null,
      show_on_dashboard: false,
      created_at: new Date().toISOString()
    };

    data.claims.push(claimRecord);
    saveGiveawayData(data);

    // Append-only ledger transaction with reason "launch giveaway"
    recordLedgerTransaction({
      userId: ownerUserId,
      guildId: server.id,
      guildName: server.name || `Server ${server.id}`,
      guildIconUrl: server.iconUrl || server.icon || null,
      type: 'earned',
      amount: creditsAmount,
      reason: 'launch_giveaway',
      description: `Launch giveaway reward: spot #${spotNumber} of ${maxClaims} (+${creditsAmount} cr)`,
      triggeredBy: 'ConnectingERLC Platform (Launch Giveaway)',
      status: 'posted'
    });

    // Dispatch Components V2 panel DM
    const dmResult = await sendGiveawayRewardDM({
      ownerUserId,
      serverName: server.name || `Server ${server.id}`,
      serverIconUrl: server.iconUrl || server.icon || null,
      serverId: server.id,
      spotNumber,
      maxClaims,
      amount: creditsAmount,
      supportServerUrl: settings.support_server_url,
      siteUrl
    });

    claimRecord.dm_sent = dmResult.success;
    claimRecord.dm_error = dmResult.error || null;
    claimRecord.show_on_dashboard = Boolean(dmResult.closedDms);
    saveGiveawayData(data);

    return {
      claimed: true,
      spotNumber,
      maxClaims,
      creditsAmount,
      dmSent: dmResult.success,
      closedDms: Boolean(dmResult.closedDms)
    };
  });
}

/**
 * Get claim for user or server to show dashboard notification
 */
export async function getClaimForUserOrServer(userId, serverId) {
  const claims = await getGiveawayClaims();
  const found = claims.find(
    (c) =>
      (serverId && String(c.server_id) === String(serverId)) ||
      (userId && String(c.owner_user_id) === String(userId))
  );
  return found || null;
}

/**
 * Dismiss dashboard notification
 */
export async function dismissGiveawayDashboardNotification(claimId) {
  if (isPostgresConnected()) {
    try {
      await dbQuery('UPDATE launch_giveaway_claims SET show_on_dashboard = false WHERE id = $1', [claimId]);
      return true;
    } catch {}
  }

  const data = loadGiveawayData();
  const c = data.claims.find((item) => String(item.id) === String(claimId));
  if (c) {
    c.show_on_dashboard = false;
    saveGiveawayData(data);
    return true;
  }
  return false;
}

/**
 * Clear giveaway test data (used by verification tests to remove test records)
 */
export async function clearGiveawayTestData(testServerIds = [], testUserIds = []) {
  if (isPostgresConnected()) {
    try {
      if (testServerIds.length > 0) {
        await dbQuery(
          'DELETE FROM launch_giveaway_claims WHERE server_id = ANY($1) OR owner_user_id = ANY($2)',
          [testServerIds, testUserIds]
        );
      }
    } catch (err) {
      console.warn('[GIVEAWAY] Postgres test data cleanup error:', err.message);
    }
  }

  const data = loadGiveawayData();
  const sidSet = new Set(testServerIds.map(String));
  const uidSet = new Set(testUserIds.map(String));
  data.claims = data.claims.filter(
    (c) => !sidSet.has(String(c.server_id)) && !uidSet.has(String(c.owner_user_id))
  );
  saveGiveawayData(data);

  // Clean ledger entries matching test server IDs
  const ledgerData = loadLedgerData();
  ledgerData.transactions = ledgerData.transactions.filter(
    (tx) => !sidSet.has(String(tx.guildId)) && !uidSet.has(String(tx.userId))
  );
  saveLedgerData(ledgerData);

  return true;
}

