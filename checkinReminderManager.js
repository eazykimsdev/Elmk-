import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPromotedServers } from './directoryManager.js';
import { loadPartnershipsData } from './partnershipsManager.js';
import { buildDailyCheckinReminderV2Panel } from './discordNotificationManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const REMINDERS_FILE = path.join(DATA_DIR, 'checkin_reminders.json');

// Clear UTC rule:
// Streak resets at lastCheckinMs (UTC) + 48 hours.
// Warning window is strictly the final 2 hours before resetAtMs (0 < resetAtMs - nowMs <= 2 hours).
export const STREAK_RESET_WINDOW_MS = 48 * 3600 * 1000;
export const STREAK_WARNING_WINDOW_MS = 2 * 3600 * 1000;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadCheckinReminders() {
  try {
    if (fs.existsSync(REMINDERS_FILE)) {
      return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8') || '{}');
    }
  } catch (err) {
    console.warn('[CHECKIN REMINDERS] Error loading file:', err.message);
  }
  return {};
}

export function saveCheckinReminders(data) {
  try {
    const tmp = `${REMINDERS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, REMINDERS_FILE);
    return true;
  } catch (err) {
    console.error('[CHECKIN REMINDERS] Error saving file:', err);
    return false;
  }
}

/**
 * Calculate the exact UTC reset time and whether a check-in warning should be sent right now.
 */
export function evaluateCheckinWarningWindow({
  lastCheckin,
  nowMs = Date.now(),
  lastRemindedForCheckin = null
} = {}) {
  const lastCheckinMs = typeof lastCheckin === 'string' ? Date.parse(lastCheckin) : Number(lastCheckin || 0);
  if (!Number.isFinite(lastCheckinMs) || lastCheckinMs <= 0) {
    return {
      shouldSend: false,
      reason: 'no_last_checkin',
      lastCheckinMs: null,
      resetAtMs: null,
      remainingMs: null
    };
  }

  const resetAtMs = lastCheckinMs + STREAK_RESET_WINDOW_MS;
  const remainingMs = resetAtMs - Number(nowMs);

  if (remainingMs <= 0) {
    return {
      shouldSend: false,
      reason: 'already_expired',
      lastCheckinMs,
      resetAtMs,
      remainingMs
    };
  }

  if (remainingMs > STREAK_WARNING_WINDOW_MS) {
    return {
      shouldSend: false,
      reason: 'outside_warning_window',
      lastCheckinMs,
      resetAtMs,
      remainingMs
    };
  }

  if (lastRemindedForCheckin && Number(lastRemindedForCheckin) === lastCheckinMs) {
    return {
      shouldSend: false,
      reason: 'already_reminded_for_cycle',
      lastCheckinMs,
      resetAtMs,
      remainingMs
    };
  }

  return {
    shouldSend: true,
    reason: 'within_warning_window',
    lastCheckinMs,
    resetAtMs,
    remainingMs
  };
}

/**
 * Toggle or set reminder status for a user on a server
 */
export function setReminderPreference({ userId, serverId, enabled = true }) {
  const uid = String(userId);
  const sid = String(serverId);
  const data = loadCheckinReminders();
  if (!data[uid]) {
    data[uid] = {};
  }

  const servers = getPromotedServers(true);
  const server = servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  const serverName = server?.name || 'Community Server';

  data[uid][sid] = {
    enabled: Boolean(enabled),
    serverId: sid,
    serverName,
    updatedAt: new Date().toISOString(),
    lastRemindedAt: data[uid][sid]?.lastRemindedAt || null,
    lastRemindedForCheckin: data[uid][sid]?.lastRemindedForCheckin || null,
    lastDeliveryStatus: data[uid][sid]?.lastDeliveryStatus || 'ok'
  };

  saveCheckinReminders(data);
  return data[uid][sid];
}

export function getReminderPreference(userId, serverId) {
  const uid = String(userId);
  const sid = String(serverId);
  const data = loadCheckinReminders();
  return data[uid]?.[sid] || { enabled: false, serverId: sid, lastDeliveryStatus: 'ok' };
}

/**
 * Build the Discord Components V2 payload for Check-In Reminder
 * No embeds, no dash lines, no emojis, no green, orange accent, real Separator
 */
export function buildCheckinReminderV2Payload({
  serverId,
  serverName,
  serverIconUrl = null,
  resetAtMs = null,
  includeTurnOffButton = true
}) {
  return buildDailyCheckinReminderV2Panel({
    guildId: serverId,
    serverName: serverName || 'Community Server',
    serverIconUrl,
    resetAtMs,
    includeTurnOffButton
  });
}

/**
 * Dispatch Check-In Reminder DM via Discord REST only when within the real warning window
 */
export async function sendCheckinReminderDM({
  token,
  userId,
  serverId,
  serverName,
  serverIconUrl = null,
  nowMs = Date.now(),
  fetchImpl = globalThis.fetch,
  forceWithoutWindowCheck = false
}) {
  const cleanToken = (token || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!cleanToken) {
    throw new Error('Bot token is not configured.');
  }

  const uid = String(userId);
  const sid = String(serverId || '');
  const data = loadCheckinReminders();
  const pref = data[uid]?.[sid] || {};

  const pData = loadPartnershipsData();
  const ach = pData?.achievements?.[uid] || null;
  const evalRes = evaluateCheckinWarningWindow({
    lastCheckin: ach?.lastCheckin,
    nowMs,
    lastRemindedForCheckin: pref.lastRemindedForCheckin
  });

  if (!forceWithoutWindowCheck && !evalRes.shouldSend) {
    return { sent: false, ...evalRes };
  }

  // 1. Open DM channel
  const dmRes = await fetchImpl('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: {
      Authorization: `Bot ${cleanToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ recipient_id: uid })
  });

  if (!dmRes.ok) {
    const errText = await dmRes.text();
    if (data[uid]?.[sid]) {
      data[uid][sid].lastDeliveryStatus = 'failed_dm_closed';
      saveCheckinReminders(data);
    }
    throw new Error(`Cannot open DM with user ${uid}: ${errText}`);
  }

  const dmChannel = await dmRes.json();
  const payload = buildCheckinReminderV2Payload({
    serverId: sid,
    serverName,
    serverIconUrl,
    resetAtMs: evalRes.resetAtMs || (nowMs + STREAK_WARNING_WINDOW_MS),
    includeTurnOffButton: Boolean(sid)
  });

  // 2. Post Components V2 Message
  const msgRes = await fetchImpl(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${cleanToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!msgRes.ok) {
    const errText = await msgRes.text();
    if (data[uid]?.[sid]) {
      data[uid][sid].lastDeliveryStatus = 'failed_send';
      saveCheckinReminders(data);
    }
    throw new Error(`Cannot send DM message to user ${uid}: ${errText}`);
  }

  // Mark success and record lastRemindedForCheckin so it is never sent twice for the same cycle
  if (!data[uid]) data[uid] = {};
  if (!data[uid][sid]) data[uid][sid] = { enabled: true, serverId: sid, serverName };
  data[uid][sid].lastRemindedAt = new Date(nowMs).toISOString();
  data[uid][sid].lastRemindedForCheckin = evalRes.lastCheckinMs || nowMs;
  data[uid][sid].lastDeliveryStatus = 'ok';
  saveCheckinReminders(data);

  const message = await msgRes.json();
  return { sent: true, message, payload, ...evalRes };
}
