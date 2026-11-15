import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPromotedServers, getBumpStatus, BUMP_COOLDOWN_HOURS } from './directoryManager.js';
import { buildBumpReadyV2Panel } from './discordNotificationManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const BUMP_REMINDERS_FILE = path.join(DATA_DIR, 'bump_reminders.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeReminderEntry(r) {
  if (!r || typeof r !== 'object') return null;
  const guildId = String(r.guild_id || r.server_id || '').trim();
  if (!guildId) return null;
  const userId = r.user_id ? String(r.user_id).trim() : null;
  return {
    guild_id: guildId,
    server_id: guildId,
    user_id: userId,
    due_at: Number(r.due_at || 0) || 0,
    bump_cycle_id: Number(r.bump_cycle_id || 0) || 0,
    sent: Boolean(r.sent),
    sent_at: r.sent_at || null,
    created_at: r.created_at || new Date().toISOString()
  };
}

export function loadBumpReminders() {
  try {
    if (fs.existsSync(BUMP_REMINDERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(BUMP_REMINDERS_FILE, 'utf8') || '[]');
      if (!Array.isArray(data)) return [];
      return data.map(normalizeReminderEntry).filter(Boolean);
    }
  } catch (err) {
    console.warn('[BUMP REMINDERS] Error loading file:', err.message);
  }
  return [];
}

export function saveBumpReminders(reminders) {
  try {
    const normalized = (Array.isArray(reminders) ? reminders : [])
      .map(normalizeReminderEntry)
      .filter(Boolean);
    const tmp = `${BUMP_REMINDERS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2), 'utf8');
    fs.renameSync(tmp, BUMP_REMINDERS_FILE);
    return true;
  } catch (err) {
    console.error('[BUMP REMINDERS] Error saving file:', err.message);
    return false;
  }
}

/**
 * Cancel or replace any older reminder for a server and schedule one reminder
 * at the exact cooldown end from the database.
 */
export function scheduleServerBumpReminder(guildId, dueAtMs = null, bumpCycleId = null) {
  const gid = String(guildId || '').trim();
  if (!gid) return null;

  const servers = getPromotedServers(true);
  const server = servers.find((s) => String(s.id) === gid || String(s.guildId) === gid);
  const cooldownMs = (BUMP_COOLDOWN_HOURS || 1) * 3600 * 1000;
  const lastBump = Number(bumpCycleId || server?.lastBumpedAt || Date.now());
  const exactDueAt = Number(dueAtMs || server?.nextBumpAt || (lastBump + cooldownMs));

  const reminders = loadBumpReminders();
  // Keep user-specific DM reminders for this guild, updating their due_at & resetting sent=false for the new cycle,
  // and replace any server-channel reminder row so there is exactly one scheduled reminder for the server.
  const keptUsers = new Set();
  const nextList = [];

  for (const r of reminders) {
    if (r.guild_id !== gid) {
      nextList.push(r);
      continue;
    }
    if (r.user_id && !keptUsers.has(r.user_id)) {
      keptUsers.add(r.user_id);
      nextList.push({
        guild_id: gid,
        server_id: gid,
        user_id: r.user_id,
        due_at: exactDueAt,
        bump_cycle_id: lastBump,
        sent: false,
        sent_at: null,
        created_at: new Date().toISOString()
      });
    }
  }

  // Always schedule one server-level reminder entry at exactDueAt
  nextList.push({
    guild_id: gid,
    server_id: gid,
    user_id: null,
    due_at: exactDueAt,
    bump_cycle_id: lastBump,
    sent: false,
    sent_at: null,
    created_at: new Date().toISOString()
  });

  saveBumpReminders(nextList);
  return {
    guild_id: gid,
    due_at: exactDueAt,
    bump_cycle_id: lastBump
  };
}

export function addBumpReminder(userIdOrObj, guildIdArg) {
  const userId = typeof userIdOrObj === 'object' ? userIdOrObj?.userId : userIdOrObj;
  const guildId = typeof userIdOrObj === 'object' ? userIdOrObj?.guildId : guildIdArg;
  if (!userId || !guildId) return false;
  const uid = String(userId).trim();
  const gid = String(guildId).trim();

  const servers = getPromotedServers(true);
  const server = servers.find((s) => String(s.id) === gid || String(s.guildId) === gid);
  const cooldownMs = (BUMP_COOLDOWN_HOURS || 1) * 3600 * 1000;
  const lastBump = Number(server?.lastBumpedAt || Date.now());
  const exactDueAt = Number(server?.nextBumpAt || (lastBump + cooldownMs));

  // Remove any older duplicate reminder for this user+guild and replace with exact cooldown end
  const reminders = loadBumpReminders().filter(
    (r) => !(r.guild_id === gid && r.user_id === uid)
  );

  reminders.push({
    user_id: uid,
    guild_id: gid,
    server_id: gid,
    due_at: exactDueAt,
    bump_cycle_id: lastBump,
    sent: false,
    sent_at: null,
    created_at: new Date().toISOString()
  });

  saveBumpReminders(reminders);
  return true;
}

export function removeBumpReminder(userIdOrObj, guildIdArg) {
  const userId = typeof userIdOrObj === 'object' ? userIdOrObj?.userId : userIdOrObj;
  const guildId = typeof userIdOrObj === 'object' ? userIdOrObj?.guildId : guildIdArg;
  if (!userId || !guildId) return false;
  const uid = String(userId).trim();
  const gid = String(guildId).trim();
  let reminders = loadBumpReminders();
  const initialLen = reminders.length;
  reminders = reminders.filter((r) => !(r.user_id === uid && r.guild_id === gid));
  if (reminders.length !== initialLen) {
    saveBumpReminders(reminders);
    return true;
  }
  return false;
}

export function hasBumpReminder(userIdOrObj, guildIdArg) {
  const userId = typeof userIdOrObj === 'object' ? userIdOrObj?.userId : userIdOrObj;
  const guildId = typeof userIdOrObj === 'object' ? userIdOrObj?.guildId : guildIdArg;
  if (!userId || !guildId) return false;
  const uid = String(userId).trim();
  const gid = String(guildId).trim();
  const reminders = loadBumpReminders();
  return reminders.some((r) => r.user_id === uid && r.guild_id === gid && !r.sent);
}

export function getPendingBumpReminders(guildId) {
  const gid = String(guildId).trim();
  const reminders = loadBumpReminders();
  return reminders.filter((r) => r.guild_id === gid && !r.sent);
}

/**
 * Deliver due bump reminders
 * - Re-reads database before sending to verify cooldown is really over
 * - Sends once only per bump cycle and persists to disk (survives bot restarts)
 */
export async function deliverDueBumpReminders(botToken, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.nowMs ? Number(options.nowMs) : Date.now();
  const cleanToken = String(botToken || '').trim().replace(/^Bot\s+/i, '');
  if (!cleanToken) return { sentCount: 0, deliveries: [] };

  const reminders = loadBumpReminders();
  if (reminders.length === 0) return { sentCount: 0, deliveries: [] };

  // Re-read fresh database state
  const servers = getPromotedServers(true);
  const cooldownMs = (BUMP_COOLDOWN_HOURS || 1) * 3600 * 1000;

  const byGuild = new Map();
  for (const r of reminders) {
    if (!byGuild.has(r.guild_id)) byGuild.set(r.guild_id, []);
    byGuild.get(r.guild_id).push(r);
  }

  const updatedReminders = [];
  const deliveries = [];

  for (const [guildId, guildReminders] of byGuild.entries()) {
    const s = servers.find((sv) => String(sv.id) === guildId || String(sv.guildId) === guildId);
    if (!s) {
      continue;
    }

    // Re-check database cooldown state before sending
    const status = getBumpStatus(guildId);
    const dbLastBump = Number(s.lastBumpedAt || status.lastBumpedAt || 0);
    const dbNextBumpAt = Math.max(
      Number(s.nextBumpAt || 0),
      Number(status.nextBumpAt || 0),
      dbLastBump ? dbLastBump + cooldownMs : 0
    );

    // Filter only unsent reminders
    const unsent = guildReminders.filter((r) => !r.sent);
    if (unsent.length === 0) {
      // Keep sent record for the current cycle so it can never re-send in the same cycle
      const latestSent = guildReminders.find((r) => r.sent && r.bump_cycle_id === dbLastBump);
      if (latestSent) updatedReminders.push(latestSent);
      continue;
    }

    // Check max due_at across reminders & database cooldown
    const reminderDueAt = Math.max(...unsent.map((r) => Number(r.due_at || 0)), dbNextBumpAt);

    // If cooldown is NOT really over in the database, do NOT send!
    if ((dbNextBumpAt && now < dbNextBumpAt) || (reminderDueAt && now < reminderDueAt)) {
      // Ensure reminders have synchronized due_at from DB
      for (const r of unsent) {
        updatedReminders.push({
          ...r,
          due_at: reminderDueAt,
          bump_cycle_id: dbLastBump || r.bump_cycle_id
        });
      }
      continue;
    }

    // Check if we already sent for this dbLastBump cycle
    const alreadySentForCycle = guildReminders.some(
      (r) => r.sent && dbLastBump > 0 && Number(r.bump_cycle_id) === dbLastBump
    );
    if (alreadySentForCycle) {
      const sentRecord = guildReminders.find((r) => r.sent && Number(r.bump_cycle_id) === dbLastBump);
      if (sentRecord) updatedReminders.push(sentRecord);
      continue;
    }

    // Cooldown is genuinely over! Send once only.
    const bumpChannelId = s.bumpChannelId || s.bump_channel_id || s.notifications?.bump_channel_id || null;
    const bumpRoleId = s.bumpRoleId || s.bump_role_id || null;
    const postBumpReady = Boolean(s.bumpReadyNoticeEnabled ?? s.bumpNoticeEnabled ?? Boolean(bumpChannelId));
    const userReminders = unsent.filter((r) => Boolean(r.user_id));

    // 1. Post to configured bump channel if enabled
    if (bumpChannelId && postBumpReady) {
      const userIds = Array.from(new Set(userReminders.map((r) => r.user_id).filter(Boolean)));
      const mentionParts = [];
      if (bumpRoleId) mentionParts.push(`<@&${bumpRoleId}>`);
      for (const uid of userIds.slice(0, 10)) mentionParts.push(`<@${uid}>`);
      const mentionText = mentionParts.join(' ');
      const allowedMentions = {
        users: userIds.slice(0, 10),
        roles: bumpRoleId ? [String(bumpRoleId)] : [],
        parse: []
      };

      const channelPayload = buildBumpReadyV2Panel({
        guildId,
        serverName: s.name,
        serverIconUrl: s.icon || s.iconUrl,
        slug: s.slug || s.id,
        mentionText,
        allowedMentions
      });

      try {
        const res = await fetchImpl(`https://discord.com/api/v10/channels/${bumpChannelId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(channelPayload)
        });
        if (res.ok) {
          deliveries.push({ type: 'channel', guildId, channelId: bumpChannelId, payload: channelPayload });
        } else {
          console.warn(`[BUMP REMINDER] Failed to post in channel ${bumpChannelId}: HTTP ${res.status}`);
        }
      } catch (err) {
        console.warn(`[BUMP REMINDER] Channel post error for ${guildId}:`, err.message);
      }
    }

    // 2. Deliver direct DM reminder to each user who requested "Remind me"
    const deliveredUsers = new Set();
    for (const r of userReminders) {
      if (!r.user_id || deliveredUsers.has(r.user_id)) continue;
      deliveredUsers.add(r.user_id);

      try {
        const dmRes = await fetchImpl('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: {
            Authorization: `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipient_id: r.user_id })
        });
        if (!dmRes.ok) continue;
        const dmChannel = await dmRes.json();

        const dmPayload = buildBumpReadyV2Panel({
          guildId,
          serverName: s.name,
          serverIconUrl: s.icon || s.iconUrl,
          slug: s.slug || s.id
        });

        const sendRes = await fetchImpl(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dmPayload)
        });

        if (sendRes.ok) {
          deliveries.push({ type: 'dm', guildId, userId: r.user_id, payload: dmPayload });
        }
      } catch (err) {
        console.warn(`[BUMP REMINDER] Error delivering DM to ${r.user_id}:`, err.message);
      }
    }

    // Record a single sent marker for this guild & bump cycle so it never fires twice
    updatedReminders.push({
      guild_id: guildId,
      server_id: guildId,
      user_id: null,
      due_at: reminderDueAt,
      bump_cycle_id: dbLastBump,
      sent: true,
      sent_at: new Date(now).toISOString(),
      created_at: new Date(now).toISOString()
    });
  }

  saveBumpReminders(updatedReminders);
  return { sentCount: deliveries.length, deliveries };
}
