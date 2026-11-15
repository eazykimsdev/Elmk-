import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPartnershipsData } from './partnershipsManager.js';
import { getPromotedServers } from './directoryManager.js';
import { evaluateCheckinWarningWindow } from './checkinReminderManager.js';
import { buildDailyCheckinReminderV2Panel } from './discordNotificationManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const USER_SETTINGS_FILE = path.join(DATA_DIR, 'user_settings.json');
const STREAK_ALERTS_LOG_FILE = path.join(DATA_DIR, 'streak_alerts_log.json');

export const STREAK_ALERT_HOURS = 46; // 2 hours before the 48-hour UTC streak reset

function loadUserSettings() {
  try {
    if (fs.existsSync(USER_SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8') || '{}');
    }
  } catch {}
  return {};
}

export function loadStreakAlertsLog() {
  try {
    if (fs.existsSync(STREAK_ALERTS_LOG_FILE)) {
      return JSON.parse(fs.readFileSync(STREAK_ALERTS_LOG_FILE, 'utf8') || '{}');
    }
  } catch {}
  return {};
}

export function saveStreakAlertsLog(data) {
  try {
    const tmp = `${STREAK_ALERTS_LOG_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, STREAK_ALERTS_LOG_FILE);
  } catch (err) {
    console.error('[STREAK ALERT] Error saving log:', err.message);
  }
}

/**
 * Check and send due streak alerts using the unified UTC reset rule:
 * resetAtMs = lastCheckinMs + 48 hours, warning window = final 2 hours before resetAtMs.
 * Never sends twice for the same lastCheckin timestamp.
 */
export async function checkAndSendStreakAlerts(botToken, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.nowMs ? Number(options.nowMs) : Date.now();
  if (!botToken) return { sentCount: 0, deliveries: [] };
  const cleanToken = String(botToken).trim().replace(/^Bot\s+/i, '');

  const userSettings = loadUserSettings();
  const partnershipsData = loadPartnershipsData();
  const achievements = partnershipsData.achievements || {};
  const alertsLog = loadStreakAlertsLog();
  const servers = getPromotedServers(true);
  const deliveries = [];

  for (const [userId, ach] of Object.entries(achievements)) {
    if (!ach || !ach.lastCheckin) continue;
    const settings = userSettings[userId] || {};

    // Switch "Streak alert" must be enabled (or check-in reminder enabled)
    if (settings.streakAlerts === false || settings.streak_alert_enabled === false) continue;
    if (!settings.streakAlerts && !settings.streak_alert_enabled && !options.ignoreSettingCheck) continue;

    const lastAlertedFor = alertsLog[userId] || null;
    const evalRes = evaluateCheckinWarningWindow({
      lastCheckin: ach.lastCheckin,
      nowMs: now,
      lastRemindedForCheckin: lastAlertedFor
    });

    if (!evalRes.shouldSend) {
      continue;
    }

    const userServer = servers.find((s) => String(s.ownerId) === String(userId));
    const payload = buildDailyCheckinReminderV2Panel({
      guildId: userServer?.id || '',
      serverName: userServer?.name || 'ConnectingERLC',
      serverIconUrl: userServer?.icon || userServer?.iconUrl || null,
      resetAtMs: evalRes.resetAtMs
    });

    try {
      const dmRes = await fetchImpl('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          Authorization: `Bot ${cleanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipient_id: userId })
      });
      if (!dmRes.ok) continue;
      const dmChannel = await dmRes.json();

      const sendRes = await fetchImpl(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${cleanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (sendRes.ok) {
        alertsLog[userId] = evalRes.lastCheckinMs;
        saveStreakAlertsLog(alertsLog);
        deliveries.push({ userId, resetAtMs: evalRes.resetAtMs, payload });
      }
    } catch (err) {
      console.warn(`[STREAK ALERT] Delivery failed for ${userId}:`, err.message);
    }
  }

  return { sentCount: deliveries.length, deliveries };
}
