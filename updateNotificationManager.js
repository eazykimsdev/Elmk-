import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'update_subscriptions.json');
const NOTIFICATIONS_SENT_FILE = path.join(DATA_DIR, 'update_notifications_sent.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadSubscriptions() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8') || '[]');
    }
  } catch {}
  return [];
}

export function saveSubscriptions(subs) {
  try {
    const tmp = `${SUBSCRIPTIONS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(subs, null, 2), 'utf8');
    fs.renameSync(tmp, SUBSCRIPTIONS_FILE);
  } catch {}
}

export function loadSentLog() {
  try {
    if (fs.existsSync(NOTIFICATIONS_SENT_FILE)) {
      return JSON.parse(fs.readFileSync(NOTIFICATIONS_SENT_FILE, 'utf8') || '{}');
    }
  } catch {}
  return {};
}

export function saveSentLog(log) {
  try {
    const tmp = `${NOTIFICATIONS_SENT_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(log, null, 2), 'utf8');
    fs.renameSync(tmp, NOTIFICATIONS_SENT_FILE);
  } catch {}
}

/**
 * Subscribe a user to receive a DM when a specific update drops.
 * Does NOT send a repeating timer DM.
 */
export function subscribeToUpdate(userId, updateId = 'daily_checkin_release') {
  if (!userId) throw new Error('Missing userId');
  const subs = loadSubscriptions();
  const existing = subs.find(s => s.userId === userId && s.updateId === updateId);
  if (!existing) {
    subs.push({
      userId,
      updateId,
      subscribedAt: Date.now()
    });
    saveSubscriptions(subs);
  }
  return { success: true, subscribed: true, updateId };
}

/**
 * Check if a user is subscribed
 */
export function isUserSubscribed(userId, updateId = 'daily_checkin_release') {
  const subs = loadSubscriptions();
  return subs.some(s => s.userId === userId && s.updateId === updateId);
}

/**
 * Build Components V2 panel for update drop announcement:
 * - Real Separators (type: 14)
 * - Zero embeds
 * - Zero emojis
 * - MessageFlags.IsComponentsV2 (32768)
 */
export function buildUpdateDropV2Panel({
  updateTitle = 'ConnectingERLC Platform Update',
  updateText = 'The update has dropped. You can now claim daily allowance rewards.',
  actionUrl = 'https://connectingerlc.com'
} = {}) {
  return {
    flags: 32768, // MessageFlags.IsComponentsV2
    components: [
      {
        type: 17, // Container
        accent_color: 0xC42B35,
        components: [
          {
            type: 10, // TextDisplay
            content: `### ${updateTitle}\n${updateText}`
          },
          {
            type: 14, // Real Separator
            divider: true
          },
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Open Platform',
                url: actionUrl
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Trigger the update drop notification:
 * Sends exactly one DM per subscriber, then marks as sent so it never repeats.
 * If user has closed DMs (Discord 50007 / 403), do not fail.
 */
export async function triggerUpdateDrop(updateId = 'daily_checkin_release', botToken, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const token = (botToken || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');

  const subs = loadSubscriptions().filter(s => s.updateId === updateId);
  const sentLog = loadSentLog();
  const updateKey = `sent_${updateId}`;
  sentLog[updateKey] = sentLog[updateKey] || {};

  const results = {
    sent: 0,
    alreadySent: 0,
    closedDMs: 0,
    errors: 0
  };

  const payload = buildUpdateDropV2Panel({
    updateTitle: options.title || 'ConnectingERLC Update Live',
    updateText: options.text || 'The update has dropped. Check-in allowances and rewards are now active on your dashboard.',
    actionUrl: options.actionUrl || 'https://connectingerlc.com/dashboard'
  });

  for (const sub of subs) {
    if (sentLog[updateKey][sub.userId]) {
      results.alreadySent++;
      continue;
    }

    if (!token) {
      sentLog[updateKey][sub.userId] = { sentAt: Date.now(), simulated: true };
      results.sent++;
      continue;
    }

    try {
      // 1. Open DM channel
      const chanRes = await fetchImpl('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipient_id: sub.userId })
      });

      if (!chanRes.ok) {
        results.closedDMs++;
        sentLog[updateKey][sub.userId] = { attemptedAt: Date.now(), status: 'closed_dms' };
        continue;
      }

      const chan = await chanRes.json();
      if (!chan?.id) {
        results.closedDMs++;
        continue;
      }

      // 2. Dispatch Components V2 message
      const msgRes = await fetchImpl(`https://discord.com/api/v10/channels/${chan.id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (msgRes.ok) {
        results.sent++;
        sentLog[updateKey][sub.userId] = { sentAt: Date.now(), status: 'delivered' };
      } else {
        // e.g. 50007 Cannot send messages to this user (closed DMs) - DO NOT FAIL
        results.closedDMs++;
        sentLog[updateKey][sub.userId] = { attemptedAt: Date.now(), status: 'closed_dms' };
      }
    } catch (err) {
      // Closed DMs or network glitch - do not fail
      results.closedDMs++;
      sentLog[updateKey][sub.userId] = { attemptedAt: Date.now(), status: 'closed_dms', error: err.message };
    }
  }

  saveSentLog(sentLog);
  return results;
}
