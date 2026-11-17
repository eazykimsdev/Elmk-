import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { loadDirectoryData, saveDirectoryData } from './directoryManager.js';
import { getServerLedgerSummary, recordLedgerTransaction } from './ledgerManager.js';
import { recordAuditAction } from './adminManager.js';
import { siteUrl } from './shared/siteUrl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'admin_settings.json');

const DEFAULT_SETTINGS = {
  premium_price_credits: 500,
  premium_duration_days: 30,
  max_advertisers_per_server: 5,
  premium_ad_guild_id: process.env.DISCORD_MAIN_GUILD_ID || '',
  premium_ad_channel_id: process.env.PREMIUM_AD_CHANNEL_ID || '',
  premium_ad_cooldown_hours: 6,
  bump_reward_credits: 2,
  daily_bump_cap_per_server: 24,
  bug_report_reward_credits: 50,
  join_reward_credits: 2,
  premium_join_reward_credits: 5,
  daily_join_reward_cap_per_server: 50,
  daily_checkin_reward_credits: 10,
  join_minimum_stay_seconds: 120,
  join_retention_window_hours: 72,
  recruiter_reward_credits: 4,
  premium_perks: [
    'Members earn 5 credits per verified join (instead of 2)',
    'Animated GIF banners on your public server page and directory listing',
    'Priority directory placement and Premium community badge',
    'Broadcast announcements to the Premium Ads channel every 6 hours'
  ]
};

function safeRead(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return fallback;
}

function safeWrite(filePath, data) {
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
    return true;
  } catch {
    return false;
  }
}

export function getAdminSettings() {
  const loaded = safeRead(SETTINGS_FILE, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...loaded };
}

export function updateAdminSettings(patch = {}, actor = null) {
  const current = getAdminSettings();
  const updated = { ...current, ...patch };
  safeWrite(SETTINGS_FILE, updated);
  if (actor) {
    recordAuditAction({
      actor: typeof actor === 'string' ? actor : (actor?.username || actor?.id || 'Admin'),
      action: 'update_admin_settings',
      target: 'system',
      targetType: 'settings',
      reason: 'Admin updated platform settings',
      before: current,
      after: updated
    });
  }
  return updated;
}

export function isServerPremium(server, now = Date.now()) {
  if (!server) return false;
  if (!server.premiumUntil) return false;
  const exp = typeof server.premiumUntil === 'number' ? server.premiumUntil : new Date(server.premiumUntil).getTime();
  return Number.isFinite(exp) && exp > now;
}

const buyLocks = new Set();

export async function buyServerPremium(serverId, userId, options = {}) {
  const sid = String(serverId);
  const now = options.now || Date.now();
  const idempotencyKey = options.idempotencyKey || null;

  if (buyLocks.has(sid)) {
    const err = new Error('Purchase is already processing for this server.');
    err.code = 'CONCURRENT_PURCHASE';
    throw err;
  }

  buyLocks.add(sid);
  try {
    const data = loadDirectoryData();
    const server = data.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
    if (!server) {
      throw new Error('Server not found in directory.');
    }

    const settings = getAdminSettings();
    const rawPricePerMonth = Number(settings.premium_price_credits);
    if (!Number.isFinite(rawPricePerMonth) || rawPricePerMonth <= 0) {
      throw new Error('Price not set');
    }
    const validMonths = [1, 2, 3, 6, 12];
    const months = validMonths.includes(Number(options.months)) ? Number(options.months) : 1;
    const price = rawPricePerMonth * months;
    const baseDurationDays = Number(settings.premium_duration_days) || 30;
    const durationDays = baseDurationDays * months;
    const durationMs = durationDays * 24 * 3600 * 1000;

    // Check server balance
    const summary = getServerLedgerSummary(sid);
    const balance = Number(summary.balance || 0);

    if (balance < price) {
      const err = new Error(`Insufficient credits in server balance. Required: ${price} credits, Current: ${balance} credits.`);
      err.code = 'INSUFFICIENT_CREDITS';
      err.required = price;
      err.current = balance;
      throw err;
    }

    // Determine new premium expiry date: extends if already active
    const currentExp = server.premiumUntil && Number(server.premiumUntil) > now
      ? Number(server.premiumUntil)
      : now;
    const newExp = currentExp + durationMs;

    // Record append-only ledger transaction (reason: "premium 30 days")
    const ledgerTx = recordLedgerTransaction({
      serverId: sid,
      guildId: sid,
      userId: userId ? String(userId) : null,
      type: 'spent',
      amount: price,
      reason: `premium ${durationDays} days`,
      description: `Purchased premium server subscription (${durationDays} days)`,
      idempotencyKey: idempotencyKey || `premium_${sid}_${now}`,
      guildName: server.name
    });

    // Update server in the same database transaction / persist step
    server.is_premium = true;
    server.premiumUntil = newExp;
    server.premium_reminder_sent = false;
    server.updatedAt = now;
    saveDirectoryData(data);

    return {
      ok: true,
      serverId: sid,
      daysAdded: durationDays,
      premiumUntil: newExp,
      price,
      txId: ledgerTx.id
    };
  } finally {
    buyLocks.delete(sid);
  }
}

export function grantServerPremium(serverId, days, reason, actor = 'Admin', options = {}) {
  const sid = String(serverId);
  const now = options.now || Date.now();
  const numDays = Math.max(1, Number(days) || 30);
  const durationMs = numDays * 24 * 3600 * 1000;

  const data = loadDirectoryData();
  const server = data.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) throw new Error('Server not found in directory');

  const beforeExp = server.premiumUntil || null;
  const currentExp = server.premiumUntil && Number(server.premiumUntil) > now
    ? Number(server.premiumUntil)
    : now;
  const newExp = currentExp + durationMs;

  server.is_premium = true;
  server.premiumUntil = newExp;
  server.premium_reminder_sent = false;
  server.premium_granted_by = typeof actor === 'string' ? actor : (actor?.username || actor?.id || 'Admin');
  server.premium_grant_reason = reason || 'Admin grant';
  server.updatedAt = now;
  saveDirectoryData(data);

  recordAuditAction({
    actor: typeof actor === 'string' ? actor : (actor?.username || actor?.id || 'Admin'),
    action: 'grant_premium',
    target: server.name || sid,
    targetType: 'server',
    reason: reason || 'Manual grant from Admin Portal',
    before: { premiumUntil: beforeExp },
    after: { premiumUntil: newExp, days: numDays }
  });

  return { ok: true, serverId: sid, premiumUntil: newExp, days: numDays };
}

export function removeServerPremium(serverId, reason, actor = 'Admin', options = {}) {
  const sid = String(serverId);
  const now = options.now || Date.now();

  const data = loadDirectoryData();
  const server = data.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) throw new Error('Server not found in directory');

  const beforeExp = server.premiumUntil || null;
  server.is_premium = false;
  server.premiumUntil = null;
  server.premium_reminder_sent = false;
  server.updatedAt = now;
  saveDirectoryData(data);

  recordAuditAction({
    actor: typeof actor === 'string' ? actor : (actor?.username || actor?.id || 'Admin'),
    action: 'remove_premium',
    target: server.name || sid,
    targetType: 'server',
    reason: reason || 'Revocation from Admin Portal',
    before: { premiumUntil: beforeExp },
    after: { premiumUntil: null }
  });

  return { ok: true, serverId: sid };
}

export async function checkPremiumReminders(options = {}) {
  const data = loadDirectoryData();
  const servers = data.servers || [];
  const now = options.now || Date.now();
  const fetchFn = options.fetchFn || fetch;
  const THREE_DAYS = 3 * 24 * 3600 * 1000;

  const botToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
  let sentCount = 0;
  let expiredCount = 0;

  for (const server of servers) {
    if (!server.premiumUntil) continue;
    const exp = Number(server.premiumUntil);

    // When premium ends, server loses premium status
    if (exp <= now) {
      if (server.is_premium) {
        server.is_premium = false;
        expiredCount++;
      }
      continue;
    }

    // Check if within 3 days of expiry and reminder hasn't been sent yet
    const timeLeft = exp - now;
    if (timeLeft <= THREE_DAYS && !server.premium_reminder_sent) {
      server.premium_reminder_sent = true;
      sentCount++;

      // Send DM to owner
      const ownerId = server.ownerId || server.owner_discord_id;
      if (ownerId && (botToken || options.fetchFn || options.sendDmFn)) {
        try {
          const daysLeft = Math.max(1, Math.ceil(timeLeft / (24 * 3600 * 1000)));
          const fixUrl = siteUrl(`/dashboard/${server.id}/promote`);
          const payload = {
            flags: 32768, // Components V2
            components: [
              {
                type: 17, // Container (No accent_color = no color on the side)
                components: [
                  {
                    type: 10,
                    content: `### ${server.name}\n\nYour server's Premium subscription expires in **${daysLeft} day${daysLeft === 1 ? '' : 's'}**.\n\nRenew in Promote Server to keep your premium features active.`
                  },
                  { type: 14, divider: true },
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 5, label: 'Renew Premium', url: fixUrl }
                    ]
                  }
                ]
              }
            ]
          };

          if (options.sendDmFn) {
            await options.sendDmFn(String(ownerId), payload);
          } else {
            const cleanToken = (botToken || 'TEST_TOKEN').trim().replace(/^Bot\s+/i, '');
            const dmRes = await fetchFn('https://discord.com/api/v10/users/@me/channels', {
              method: 'POST',
              headers: { Authorization: `Bot ${cleanToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipient_id: String(ownerId) }),
              signal: AbortSignal.timeout(6000)
            });
            if (dmRes.ok) {
              const dmChannel = await dmRes.json();
              await fetchFn(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bot ${cleanToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(6000)
              });
            }
          }
        } catch {}
      }
    }
  }

  saveDirectoryData(data);
  return { sentCount, expiredCount };
}

let reminderTimer = null;
export function startPremiumReminderJob() {
  if (reminderTimer) return;
  setTimeout(() => {
    checkPremiumReminders().catch(() => {});
  }, 60000);

  // Check every hour
  reminderTimer = setInterval(() => {
    checkPremiumReminders().catch(() => {});
  }, 3600 * 1000);
}
