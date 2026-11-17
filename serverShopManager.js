import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDirectoryData, saveDirectoryData, bumpPromotedServer, getBumpStatus } from './directoryManager.js';
import { getServerLedgerSummary, recordLedgerTransaction } from './ledgerManager.js';
import { getAdminSettings } from './premiumManager.js';
import { sendComponentV2Dm } from './discordNotificationManager.js';
import { recordAuditAction } from './adminManager.js';
import { getPool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SHOP_ITEMS_FILE = path.join(DATA_DIR, 'shop_items.json');

// Default initial items living in DB / admin settings (Item 4)
export const DEFAULT_SHOP_ITEMS = [
  {
    id: 'item_auto_bump_1d',
    name: 'Auto bump, 1 day',
    effect: 'auto_bump',
    durationMs: 24 * 60 * 60 * 1000, // 24 hours
    price: 15,
    isActive: true,
    description: 'The bot automatically bumps your server when the cooldown ends for 24 hours (gives 0 credits).'
  },
  {
    id: 'item_featured_spot_1d',
    name: 'Featured spot on Earn credits, 24 hours',
    effect: 'featured_spot',
    durationMs: 24 * 60 * 60 * 1000, // 24 hours
    price: 40,
    isActive: true,
    description: 'Places your community at the top of the Earn credits directory for 24 hours.'
  },
  {
    id: 'item_listing_highlight_7d',
    name: 'Listing highlight, 7 days',
    effect: 'listing_highlight',
    durationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    price: 30,
    isActive: true,
    description: 'Highlights your community card in the directory with an accent border for 7 days.'
  },
  {
    id: 'item_extra_advertiser_30d',
    name: 'Extra advertiser seat, 30 days',
    effect: 'extra_advertiser',
    durationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    price: 20,
    isActive: true,
    description: 'Unlocks an additional advertiser slot for your community for 30 days.'
  }
];

function normalizeShopItemsList(loadedItems) {
  const map = new Map();
  for (const def of DEFAULT_SHOP_ITEMS) {
    map.set(def.id, { ...def });
  }
  if (Array.isArray(loadedItems)) {
    for (const it of loadedItems) {
      if (!it || it.id === 'item_2x_bumps' || it.effect === 'double_bumps') continue;
      if (it.id === 'item_auto_bump_1d' && Number(it.price) === 100) {
        it.price = 15;
      }
      map.set(it.id, { ...(map.get(it.id) || {}), ...it });
    }
  }
  return Array.from(map.values()).filter(it => it.id !== 'item_2x_bumps' && it.effect !== 'double_bumps' && it.id !== 'item_premium_1m');
}

function ensureShopFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SHOP_ITEMS_FILE)) {
    fs.writeFileSync(SHOP_ITEMS_FILE, JSON.stringify({ items: DEFAULT_SHOP_ITEMS }, null, 2), 'utf8');
  }
}

/** Load all shop items from PostgreSQL with local JSON fallback */
export async function loadShopItems() {
  const pool = getPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM shop_items ORDER BY id ASC');
      if (res.rows.length > 0) {
        const dbItems = res.rows.map(r => ({
          id: r.id,
          name: r.name,
          effect: r.effect,
          durationMs: Number(r.duration_ms),
          price: Number(r.price),
          isActive: Boolean(r.is_active),
          description: r.description || ''
        }));
        return normalizeShopItemsList(dbItems);
      }
    } catch (err) {
      // Table might not exist yet; will fall back to JSON
    }
  }

  ensureShopFile();
  try {
    const raw = fs.readFileSync(SHOP_ITEMS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeShopItemsList(parsed?.items);
    fs.writeFileSync(SHOP_ITEMS_FILE, JSON.stringify({ items: normalized }, null, 2), 'utf8');
    return normalized;
  } catch {
    return DEFAULT_SHOP_ITEMS;
  }
}

/** Save shop items to PostgreSQL with JSON fallback */
export async function saveShopItems(items) {
  ensureShopFile();
  try {
    fs.writeFileSync(SHOP_ITEMS_FILE, JSON.stringify({ items }, null, 2), 'utf8');
  } catch (err) {
    console.error('[SHOP] Error saving JSON items:', err.message);
  }

  const pool = getPool();
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS shop_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          effect TEXT NOT NULL,
          duration_ms BIGINT NOT NULL,
          price INTEGER NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          description TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      for (const it of items) {
        await pool.query(`
          INSERT INTO shop_items (id, name, effect, duration_ms, price, is_active, description, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            effect = EXCLUDED.effect,
            duration_ms = EXCLUDED.duration_ms,
            price = EXCLUDED.price,
            is_active = EXCLUDED.is_active,
            description = EXCLUDED.description,
            updated_at = NOW()
        `, [it.id, it.name, it.effect, it.durationMs, it.price, it.isActive, it.description || '']);
      }
    } catch (err) {
      console.warn('[SHOP] Error syncing items to PostgreSQL:', err.message);
    }
  }
}

/** Mutex to prevent double-clicks and concurrent tab purchases */
const purchaseLocks = new Map();

/** Check if a server has an active boost of a specific effect */
export function hasActiveBoost(serverId, effect) {
  if (!serverId || !effect) return false;
  const sid = String(serverId);
  const dir = loadDirectoryData();
  const server = dir.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) return false;

  const now = Date.now();
  if (effect === 'premium') {
    return Number(server.premiumUntil || 0) > now;
  }

  const boost = server.boosts?.[effect];
  return Boolean(boost && Number(boost.activeUntil || 0) > now);
}

/** Get all active boosts and their remaining time for a server */
export function getServerActiveBoosts(serverId) {
  if (!serverId) return [];
  const sid = String(serverId);
  const dir = loadDirectoryData();
  const server = dir.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) return [];

  const now = Date.now();
  const boosts = [];

  // Check premium boost
  if (Number(server.premiumUntil || 0) > now) {
    const leftMs = Number(server.premiumUntil) - now;
    boosts.push({
      effect: 'premium',
      name: 'Premium',
      activeUntil: Number(server.premiumUntil),
      remainingSeconds: Math.ceil(leftMs / 1000),
      formattedTimeLeft: formatDuration(leftMs),
    });
  }

  // Check custom boosts (auto_bump, featured_spot, listing_highlight, extra_advertiser)
  const BOOST_LABELS = {
    auto_bump: 'Auto Bump',
    featured_spot: 'Featured Spot on Earn Credits',
    listing_highlight: 'Listing Highlight',
    extra_advertiser: 'Extra Advertiser Seat'
  };
  if (server.boosts && typeof server.boosts === 'object') {
    for (const [effect, b] of Object.entries(server.boosts)) {
      if (effect === 'double_bumps' || effect === 'premium') continue;
      if (b && Number(b.activeUntil || 0) > now) {
        const leftMs = Number(b.activeUntil) - now;
        const name = BOOST_LABELS[effect] || effect;
        boosts.push({
          effect,
          name,
          seats: effect === 'extra_advertiser' ? Number(b.seats || 1) : undefined,
          activeUntil: Number(b.activeUntil),
          remainingSeconds: Math.ceil(leftMs / 1000),
          formattedTimeLeft: formatDuration(leftMs),
        });
      }
    }
  }

  return boosts;
}

function formatDuration(ms) {
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/**
 * Purchase a shop item for a server:
 * - Checks owner/manager permissions
 * - Uses server balance
 * - Prevents double clicks and concurrent tabs via lock
 * - Writes append-only ledger entry + boost date in same transaction
 * - Buying same item again extends it
 */
export async function buyShopItem({
  serverId,
  itemId,
  buyerUserId,
  buyerUsername = 'Manager',
  isManager = false,
  isOwner = false
}) {
  if (!serverId) throw new Error('Server ID is required.');
  if (!itemId) throw new Error('Item ID is required.');
  const sid = String(serverId);

  if (!isOwner && !isManager) {
    throw new Error('Unauthorized: only server owners and managers can purchase items with the server treasury balance.');
  }

  // Prevent simultaneous purchases for the same server
  if (purchaseLocks.get(sid)) {
    const err = new Error('A purchase transaction is currently processing for this server. Please wait.');
    err.code = 'PURCHASE_IN_PROGRESS';
    throw err;
  }

  purchaseLocks.set(sid, true);

  try {
    const items = await loadShopItems();
    const item = items.find(i => i.id === itemId);
    if (!item || !item.isActive) {
      throw new Error('This shop item is currently not available.');
    }

    const dirData = loadDirectoryData();
    const server = dirData.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
    if (!server) {
      throw new Error('Server not found in community directory.');
    }

    const ledgerSummary = getServerLedgerSummary(sid);
    const balance = ledgerSummary.balance;

    if (balance < item.price) {
      const err = new Error(`Not enough credits. ${item.name} costs ${item.price} credits, but your server treasury only has ${balance} credits.`);
      err.code = 'INSUFFICIENT_CREDITS';
      err.required = item.price;
      err.balance = balance;
      throw err;
    }

    const now = Date.now();
    const durationMs = Number(item.durationMs || 86400000);

    // Initialize boosts container if missing
    if (!server.boosts || typeof server.boosts !== 'object') {
      server.boosts = {};
    }

    let activeUntil = now;
    if (item.effect === 'premium') {
      const currentExpiry = Number(server.premiumUntil || 0);
      activeUntil = (currentExpiry > now ? currentExpiry : now) + durationMs;
      server.premiumUntil = activeUntil;
      server.is_premium = true;
      server.boosts.premium = {
        activeUntil,
        reminderSent: false,
        purchasedAt: now,
      };
    } else {
      const currentBoost = server.boosts[item.effect];
      const currentExpiry = Number(currentBoost?.activeUntil || 0);
      activeUntil = (currentExpiry > now ? currentExpiry : now) + durationMs;
      const prevSeats = currentExpiry > now ? Number(currentBoost?.seats || 0) : 0;
      server.boosts[item.effect] = {
        activeUntil,
        seats: item.effect === 'extra_advertiser' ? Math.max(1, prevSeats + 1) : undefined,
        reminderSent: false,
        purchasedAt: now,
      };
    }

    // Record append-only ledger entry in same transaction
    const idempotencyKey = `shop_buy_${sid}_${item.id}_${now}`;
    const tx = recordLedgerTransaction({
      guildId: sid,
      serverId: sid,
      userId: `guild_${sid}`,
      type: 'spent',
      amount: item.price,
      reason: 'server shop purchase',
      description: `Purchased ${item.name} (-${item.price} cr)`,
      triggeredBy: buyerUsername ? `${buyerUsername} (Server Manager)` : 'Server Manager',
      idempotencyKey,
      guildName: server.name || 'Server'
    });

    server.balance = Math.max(0, balance - item.price);
    server.credits = server.balance;
    saveDirectoryData(dirData);

    return {
      success: true,
      item,
      activeUntil,
      remainingSeconds: Math.ceil((activeUntil - now) / 1000),
      formattedTimeLeft: formatDuration(activeUntil - now),
      newBalance: server.balance,
      transactionId: tx.id
    };
  } finally {
    purchaseLocks.delete(sid);
  }
}

/** Admin: Grant or remove a boost manually with an audit log */
export async function adminManageBoost({
  serverId,
  effect,
  action, // 'grant' | 'revoke'
  durationDays = 1,
  reason,
  adminUser
}) {
  if (!serverId || !effect) throw new Error('Server ID and effect are required.');
  const sid = String(serverId);
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw new Error('An administrative reason is required.');

  const dirData = loadDirectoryData();
  const server = dirData.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) throw new Error('Server not found.');

  if (!server.boosts || typeof server.boosts !== 'object') {
    server.boosts = {};
  }

  const now = Date.now();
  if (action === 'grant') {
    const durationMs = Number(durationDays || 1) * 86400000;
    const currentExpiry = effect === 'premium'
      ? Number(server.premiumUntil || 0)
      : Number(server.boosts[effect]?.activeUntil || 0);

    const activeUntil = (currentExpiry > now ? currentExpiry : now) + durationMs;

    if (effect === 'premium') {
      server.premiumUntil = activeUntil;
      server.is_premium = true;
      server.boosts.premium = { activeUntil, reminderSent: false, grantedByAdmin: true };
    } else {
      server.boosts[effect] = { activeUntil, reminderSent: false, grantedByAdmin: true };
    }

    recordAuditAction({
      action: 'GRANT_SERVER_BOOST',
      actor: adminUser?.username || 'Admin',
      actorRole: adminUser?.role || 'Admin',
      target: sid,
      reason: `Granted ${effect} for ${durationDays}d: ${cleanReason}`
    });

    saveDirectoryData(dirData);
    return { success: true, serverId: sid, effect, activeUntil };
  } else if (action === 'revoke') {
    if (effect === 'premium') {
      server.premiumUntil = 0;
      server.is_premium = false;
      if (server.boosts.premium) server.boosts.premium.activeUntil = 0;
    } else if (server.boosts[effect]) {
      server.boosts[effect].activeUntil = 0;
    }

    recordAuditAction({
      action: 'REVOKE_SERVER_BOOST',
      actor: adminUser?.username || 'Admin',
      actorRole: adminUser?.role || 'Admin',
      target: sid,
      reason: `Revoked ${effect}: ${cleanReason}`
    });

    saveDirectoryData(dirData);
    return { success: true, serverId: sid, effect, revoked: true };
  }

  throw new Error(`Invalid action: ${action}`);
}

/** Check active boosts and send 24h expiration reminder DM to server owners */
export async function checkBoostReminders() {
  const dirData = loadDirectoryData();
  const now = Date.now();
  const REMINDER_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

  let notificationsSent = 0;

  for (const server of dirData.servers) {
    if (!server.ownerId) continue;
    const boosts = server.boosts || {};

    for (const [effect, b] of Object.entries(boosts)) {
      if (!b || !b.activeUntil) continue;
      const timeLeft = Number(b.activeUntil) - now;

      // Active and within 24 hours of ending, reminder not sent yet
      if (timeLeft > 0 && timeLeft <= REMINDER_THRESHOLD && !b.reminderSent) {
        const effectName = effect === 'double_bumps' ? '2x Bumps' : (effect === 'auto_bump' ? 'Auto Bump' : 'Premium');
        const container = {
          type: 17, // V2 Container
          components: [
            {
              type: 10, // Text display
              content: `### Boost Ending Soon: ${server.name}\nYour **${effectName}** boost for **${server.name}** expires in **${formatDuration(timeLeft)}**.\nYou can extend or renew it anytime from the Server Shop in your dashboard.`
            },
            {
              type: 14, // Real Separator
              divider: true,
              spacing: 1
            },
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 2, // Button
                  style: 5, // Link
                  label: 'Open Server Shop',
                  url: `https://connectingerlc.xyz/dashboard/${server.id}/shop`
                }
              ]
            }
          ]
        };

        const delivered = await sendComponentV2Dm(server.ownerId, container);
        b.reminderSent = true;
        notificationsSent++;
        console.log(`[SHOP] Sent 24h boost reminder DM for ${effectName} to owner of ${server.name} (delivered: ${delivered})`);
      }
    }
  }

  if (notificationsSent > 0) {
    saveDirectoryData(dirData);
  }

  return { notificationsSent };
}

/** Run automated bumps for all servers with active `auto_bump` boost */
export async function runAutoBumps() {
  const dirData = loadDirectoryData();
  const now = Date.now();
  const bumped = [];

  for (const server of dirData.servers) {
    const autoBump = server.boosts?.auto_bump;
    if (!autoBump || Number(autoBump.activeUntil || 0) <= now) continue;

    const status = getBumpStatus(server.id);
    if (status.canBump) {
      try {
        const res = bumpPromotedServer(server.id, 'auto_bump_system', {
          skipCredits: true, // Auto bumps give no credits
          isAutoBump: true
        });
        if (res.success) {
          bumped.push({ id: server.id, name: server.name });
          console.log(`[AUTO-BUMP] Successfully executed automated bump for ${server.name} (0 credits awarded).`);
        }
      } catch (err) {
        console.warn(`[AUTO-BUMP] Failed bump for ${server.name}:`, err.message);
      }
    }
  }

  return { count: bumped.length, servers: bumped };
}
