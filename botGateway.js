/**
 * ConnectingERLC Discord Gateway Service
 * 
 * Maintains 24/7 Discord Gateway WebSocket presence for the ConnectingERLC bots.
 * Shows bots as "Online" on Discord with custom presence.
 * Supports multi-bot connections concurrently (guild bot + bump bot).
 * Automatically handles heartbeats, resumes, and reconnects.
 */

import fs from 'fs';
import path from 'path';
import { GLOBAL_BOT_COMMANDS, handleInteraction, hashCommands } from './botCommands.js';
import { deployCommands, currentDeployHash } from './scripts/deploy_commands.mjs';
import { loadCheckinReminders, sendCheckinReminderDM } from './checkinReminderManager.js';
import { deliverDueBumpReminders } from './bumpReminderManager.js';
import { checkAndSendStreakAlerts } from './streakAlertManager.js';
import { getPromotedServers, processMaturePendingJoins } from './directoryManager.js';

const activeGateways = new Map();
let globalSchedulerTimer = null;
let lastKnownPresenceString = 'https://connectingerlc.xyz';

export function getLiveStatsPresenceString() {
  return 'https://connectingerlc.xyz';
}

export function normalizeBotToken(raw) {
  if (!raw) return '';
  let tok = String(raw).trim();
  // Strip quotes if user pasted with quotes
  tok = tok.replace(/^["'`]|["'`]$/g, '').trim();
  // Strip "Bot " prefix if present
  tok = tok.replace(/^Bot\s+/i, '').trim();
  // Strip quotes again just in case
  tok = tok.replace(/^["'`]|["'`]$/g, '').trim();
  return tok;
}

export function getBotGatewayStatus() {
  const instances = Array.from(activeGateways.values());
  const connected = instances.some(i => i.botConnected);
  const totalGuilds = instances.reduce((sum, i) => sum + (i.botGuildsCount || 0), 0);
  const primaryUser = instances.find(i => i.botUserData)?.botUserData || null;
  const anyError = instances.find(i => i.botLastError)?.botLastError || null;
  const firstLogin = instances.find(i => i.botLoginTime)?.botLoginTime || null;

  return {
    connected,
    status: connected ? 'Connected' : (anyError ? 'Error' : 'Offline'),
    error: anyError,
    user: primaryUser,
    guildsCount: totalGuilds,
    loginTime: firstLogin,
    activity: getLiveStatsPresenceString()
  };
}

export async function updateBotAvatar(token, imageBufferOrDataUri) {
  if (!token) throw new Error('No bot token provided');
  const cleanToken = token.trim().replace(/^Bot\s+/i, '');
  let dataUri = imageBufferOrDataUri;
  if (Buffer.isBuffer(imageBufferOrDataUri)) {
    dataUri = `data:image/png;base64,${imageBufferOrDataUri.toString('base64')}`;
  }
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${cleanToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ avatar: dataUri })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update Discord bot avatar: ${err}`);
  }
  const updated = await res.json();
  const inst = activeGateways.get(cleanToken);
  if (inst && inst.botUserData) {
    inst.botUserData.avatar = updated.avatar;
  }
  console.log('[DISCORD BOT] Successfully updated bot avatar via Discord REST API.');
  return updated;
}

export async function updateBotBanner(token, imageBufferOrDataUri) {
  if (!token) throw new Error('No bot token provided');
  const cleanToken = token.trim().replace(/^Bot\s+/i, '');
  let dataUri = imageBufferOrDataUri;
  if (Buffer.isBuffer(imageBufferOrDataUri)) {
    dataUri = `data:image/jpeg;base64,${imageBufferOrDataUri.toString('base64')}`;
  }
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${cleanToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ banner: dataUri })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update Discord bot banner: ${err}`);
  }
  const updated = await res.json();
  const inst = activeGateways.get(cleanToken);
  if (inst && inst.botUserData) {
    inst.botUserData.banner = updated.banner;
  }
  console.log('[DISCORD BOT] Successfully updated bot banner via Discord REST API.');
  return updated;
}

export function startBotGateway(token, onGuildEvent) {
  if (!token) {
    console.warn('[DISCORD BOT] No bot token provided. Gateway service skipped.');
    return null;
  }

  const cleanToken = normalizeBotToken(token);
  if (activeGateways.has(cleanToken)) {
    return activeGateways.get(cleanToken);
  }

  const inst = {
    cleanToken,
    ws: null,
    heartbeatTimer: null,
    reconnectTimer: null,
    lastSequence: null,
    sessionId: null,
    resumeGatewayUrl: null,
    isShuttingDown: false,
    reconnectAttempts: 0,
    botConnected: false,
    botLastError: null,
    botUserData: null,
    botGuildsCount: 0,
    botLoginTime: null,
    lastAckAt: Date.now(),
    watchdog: null,
    hardResetDone: false
  };

  function connect() {
    if (inst.isShuttingDown) return;

    const gatewayUrl = inst.resumeGatewayUrl || 'wss://gateway.discord.gg/?v=10&encoding=json';
    console.log(`[DISCORD BOT] Connecting to Discord Gateway (${inst.resumeGatewayUrl ? 'resume' : 'new session'})...`);

    try {
      inst.ws = new WebSocket(gatewayUrl);
    } catch (err) {
      console.error('[DISCORD BOT] Gateway connection error:', err.message);
      inst.botConnected = false;
      inst.botLastError = err.message || 'Connection error';
      scheduleReconnect();
      return;
    }

    inst.ws.onopen = () => {
      console.log('[DISCORD BOT] WebSocket connection established.');
      inst.reconnectAttempts = 0;
      inst.lastAckAt = Date.now();
    };

    inst.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handlePayload(payload);
      } catch (err) {
        console.error('[DISCORD BOT] Error parsing gateway payload:', err.message);
      }
    };

    inst.ws.onclose = (event) => {
      console.warn(`[DISCORD BOT] Gateway connection closed (code: ${event.code}, reason: ${event.reason || 'None'}).`);
      inst.botConnected = false;
      clearInterval(inst.heartbeatTimer);
      if (!inst.isShuttingDown) {
        if (event.code === 4004) {
          console.error('[DISCORD BOT] Gateway 4004 Authentication Failed. Retrying in 10s in case token is being updated...');
          inst.botLastError = 'Invalid bot token (code 4004)';
          setTimeout(connect, 10000);
          return;
        }
        inst.botLastError = event.reason || `Gateway closed with code ${event.code}`;
        scheduleReconnect();
      }
    };

    inst.ws.onerror = (err) => {
      console.error('[DISCORD BOT] Gateway error:', err.message || err);
      inst.botLastError = err.message || 'Gateway socket error';
    };
  }

  function handlePayload(payload) {
    const { op, d, s, t } = payload;
    if (op === 11) inst.lastAckAt = Date.now();
    if (s !== null && s !== undefined) {
      inst.lastSequence = s;
    }

    switch (op) {
      case 10: { // Hello
        const heartbeatInterval = d.heartbeat_interval;
        console.log(`[DISCORD BOT] Received Hello (Heartbeat: ${heartbeatInterval}ms).`);
        startHeartbeat(heartbeatInterval);

        if (inst.sessionId && inst.lastSequence !== null) {
          console.log('[DISCORD BOT] Attempting to Resume session...');
          send(6, {
            token: cleanToken,
            session_id: inst.sessionId,
            seq: inst.lastSequence
          });
        } else {
          console.log('[DISCORD BOT] Sending Identify...');
          send(2, {
            token: cleanToken,
            intents: 1 | 2, // GUILDS (1) | GUILD_MEMBERS (2)
            properties: {
              os: process.platform,
              browser: 'ConnectingERLC',
              device: 'ConnectingERLC'
            },
            presence: {
              status: 'online',
              activities: [
                {
                  name: getLiveStatsPresenceString(),
                  type: 3 // Watching
                }
              ],
              afk: false
            }
          });
        }
        break;
      }

      case 11: { // Heartbeat ACK
        break;
      }

      case 1: { // Heartbeat requested by Discord
        sendHeartbeat();
        break;
      }

      case 7: { // Reconnect requested by Discord
        console.log('[DISCORD BOT] Reconnect requested by gateway.');
        inst.ws?.close(4000, 'Discord requested reconnect');
        break;
      }

      case 9: { // Invalid Session
        console.warn(`[DISCORD BOT] Invalid session. Resumable: ${d}`);
        if (!d) {
          inst.sessionId = null;
          inst.lastSequence = null;
          inst.resumeGatewayUrl = null;
        }
        setTimeout(() => {
          if (inst.ws && inst.ws.readyState === WebSocket.OPEN) {
            inst.ws.close(4000, 'Invalid session reconnect');
          }
        }, 1500);
        break;
      }

      case 0: { // Dispatch event
        handleDispatch(t, d);
        break;
      }
    }
  }

  function handleDispatch(type, data) {
    if (type === 'READY') {
      inst.sessionId = data.session_id;
      inst.resumeGatewayUrl = data.resume_gateway_url ? `${data.resume_gateway_url}?v=10&encoding=json` : null;
      inst.botConnected = true;
      inst.botLastError = null;
      inst.botUserData = data.user;
      inst.botGuildsCount = Array.isArray(data.guilds) ? data.guilds.length : 0;
      inst.botLoginTime = new Date().toISOString();

      const botTag = `${data.user.username}#${data.user.discriminator || '0'}`;
      const livePresence = getLiveStatsPresenceString();
      console.log(`\n======================================================`);
      console.log(`  [DISCORD BOT] ConnectingERLC is ONLINE as ${botTag}  `);
      console.log(`  Status: WATCHING "${livePresence}"              `);
      console.log(`  Connected to ${data.guilds.length} Discord servers  `);
      console.log(`======================================================\n`);

      // 5-minute presence refresh timer respecting Discord presence rate limits
      if (!inst.presenceTimer) {
        inst.presenceTimer = setInterval(() => {
          try {
            const currentPresence = getLiveStatsPresenceString();
            if (inst.ws && inst.ws.readyState === WebSocket.OPEN) {
              send(3, {
                since: null,
                activities: [
                  {
                    name: currentPresence,
                    type: 3
                  }
                ],
                status: 'online',
                afk: false
              });
            }
          } catch (pErr) {
            console.warn('[DISCORD BOT] Error refreshing presence:', pErr.message);
          }
        }, 5 * 60 * 1000);
        if (inst.presenceTimer.unref) inst.presenceTimer.unref();
      }

      // Check if custom avatar file exists in assets or data
      const possibleAvatarPaths = [
        path.join(process.cwd(), 'assets', 'bot-avatar.png'),
        path.join(process.cwd(), 'assets', 'bot-avatar.jpg'),
        path.join(process.cwd(), 'data', 'bot-avatar.png'),
      ];
      for (const p of possibleAvatarPaths) {
        if (fs.existsSync(p)) {
          try {
            const buf = fs.readFileSync(p);
            updateBotAvatar(cleanToken, buf).catch((err) => {
              console.warn('[DISCORD BOT] Automatic avatar file update skipped/notice:', err.message);
            });
            break;
          } catch {}
        }
      }

      // Check if custom banner file exists in assets or data
      const possibleBannerPaths = [
        path.join(process.cwd(), 'assets', 'bot-banner.jpg'),
        path.join(process.cwd(), 'assets', 'bot-banner.png'),
        path.join(process.cwd(), 'data', 'bot-banner.jpg'),
      ];
      for (const bp of possibleBannerPaths) {
        if (fs.existsSync(bp)) {
          try {
            const buf = fs.readFileSync(bp);
            updateBotBanner(cleanToken, buf).catch((err) => {
              console.warn('[DISCORD BOT] Automatic banner file update skipped/notice:', err.message);
            });
            break;
          } catch {}
        }
      }

      // Register global slash commands if definitions changed
      const appId = data.application?.id || data.user?.id;
      if (appId) {
        const hashFile = path.join(process.cwd(), 'data', 'command_definitions_hash.txt');
        let prevHash = '';
        try {
          if (fs.existsSync(hashFile)) prevHash = fs.readFileSync(hashFile, 'utf8').trim();
        } catch {}
        const currentHash = currentDeployHash();
        if (prevHash !== currentHash) {
          console.log('[DISCORD BOT] Command definitions changed or not yet initialized. Running deployCommands...');
          deployCommands({ token: cleanToken, applicationId: appId }).catch((err) => {
            console.warn('[DISCORD BOT] Slash commands registration warning:', err.message);
          });
        }
      }

      // Start Daily Check-in reminder background scheduler (once across all bots)
      if (!globalSchedulerTimer) {
        globalSchedulerTimer = setInterval(async () => {
          try {
            const activeToken = Array.from(activeGateways.values()).find(g => g.botConnected)?.cleanToken || cleanToken;
            const reminders = loadCheckinReminders();
            const servers = getPromotedServers(true);
            const now = Date.now();

            for (const [userId, serverMap] of Object.entries(reminders)) {
              for (const [serverId, pref] of Object.entries(serverMap)) {
                if (!pref || !pref.enabled) continue;
                const lastReminded = pref.lastRemindedAt ? new Date(pref.lastRemindedAt).getTime() : 0;
                if (now - lastReminded >= 24 * 60 * 60 * 1000) {
                  const s = servers.find(sv => String(sv.id) === String(serverId) || String(sv.guildId) === String(serverId));
                  await sendCheckinReminderDM({
                    token: activeToken,
                    userId,
                    serverId,
                    serverName: s?.name || pref.serverName || 'your community server'
                  }).catch((err) => {
                    console.warn(`[CHECKIN SCHEDULER] Could not deliver reminder to ${userId}:`, err.message);
                  });
                }
              }
            }
            // Deliver due bump reminders
            await deliverDueBumpReminders(activeToken).catch((err) => {
              console.warn('[BUMP REMINDERS] Error delivering due reminders:', err.message);
            });

            // Check streak alerts (36h after last checkin)
            await checkAndSendStreakAlerts(activeToken).catch((err) => {
              console.warn('[STREAK ALERTS] Error checking streak alerts:', err.message);
            });

            // Process mature pending joins (members who stayed >= 2 minutes)
            await processMaturePendingJoins(activeToken).catch((err) => {
              console.warn('[PENDING JOINS] Error processing mature joins:', err.message);
            });
          } catch (schedulerErr) {
            console.warn('[CHECKIN SCHEDULER] Error during cycle:', schedulerErr.message);
          }
        }, 60 * 1000);
      }

      if (onGuildEvent) {
        onGuildEvent('READY', data);
      }
    } else if (type === 'INTERACTION_CREATE') {
      handleInteraction(data, cleanToken).catch((err) => {
        console.error('[DISCORD BOT] Interaction handling error:', err.message);
      });
    } else if (type === 'GUILD_CREATE') {
      if (onGuildEvent) {
        onGuildEvent('GUILD_CREATE', data);
      }
    } else if (type === 'GUILD_DELETE') {
      if (onGuildEvent) {
        onGuildEvent('GUILD_DELETE', data);
      }
    } else if (type === 'GUILD_MEMBER_ADD') {
      if (onGuildEvent) {
        onGuildEvent('GUILD_MEMBER_ADD', data);
      }
    } else if (type === 'GUILD_MEMBER_REMOVE') {
      if (onGuildEvent) {
        onGuildEvent('GUILD_MEMBER_REMOVE', data);
      }
    }
  }

  function startHeartbeat(interval) {
    clearInterval(inst.heartbeatTimer);
    const initialDelay = Math.floor(Math.random() * interval * 0.5);
    setTimeout(() => {
      sendHeartbeat();
      inst.heartbeatTimer = setInterval(sendHeartbeat, interval);
    }, initialDelay);
  }

  function sendHeartbeat() {
    if (inst.ws && inst.ws.readyState === WebSocket.OPEN) {
      // No ACK for 90s means a zombie connection: close it so onclose reconnects
      if (Date.now() - inst.lastAckAt > 90000) {
        console.warn('[DISCORD BOT] No heartbeat ACK for 90s. Closing zombie connection.');
        try { inst.ws.close(4000, 'Heartbeat timeout'); } catch {}
        return;
      }
      send(1, inst.lastSequence);
    }
  }

  function send(op, data) {
    if (inst.ws && inst.ws.readyState === WebSocket.OPEN) {
      inst.ws.send(JSON.stringify({ op, d: data }));
    }
  }

  function scheduleReconnect() {
    clearTimeout(inst.reconnectTimer);
    inst.reconnectAttempts++;
    const delay = Math.min(30000, Math.pow(2, inst.reconnectAttempts) * 1000);
    console.log(`[DISCORD BOT] Reconnecting in ${Math.round(delay / 1000)}s...`);
    inst.reconnectTimer = setTimeout(connect, delay);
  }

  function hardReset() {
    console.error('[DISCORD BOT] Gateway down for over 2 minutes. Restarting bot connection from scratch.');
    clearTimeout(inst.reconnectTimer);
    clearInterval(inst.heartbeatTimer);
    const old = inst.ws;
    if (old) {
      old.onclose = null; old.onerror = null; old.onmessage = null; old.onopen = null;
      try { old.close(1000, 'Watchdog restart'); } catch {}
    }
    inst.sessionId = null;
    inst.resumeGatewayUrl = null;
    inst.lastSequence = null;
    inst.reconnectAttempts = 0;
    inst.hardResetDone = true;
    connect();
  }

  // Watchdog: gateway down > 2 min -> restart the connection; > 4 min -> exit so Railway restarts the service
  let downSince = null;
  inst.watchdog = setInterval(() => {
    if (inst.isShuttingDown) return;
    if (inst.botConnected) { downSince = null; inst.hardResetDone = false; return; }
    if (/4004|4013|4014/.test(String(inst.botLastError || ''))) return; // permanent errors: do not loop
    if (!downSince) downSince = Date.now();
    const down = Date.now() - downSince;
    if (down > 240000) {
      console.error('[DISCORD BOT] Gateway still down after restart (4+ min). Exiting for platform restart.');
      process.exit(1);
    } else if (down > 120000 && !inst.hardResetDone) {
      hardReset();
    }
  }, 15000);

  connect();

  const handle = {
    stop() {
      inst.isShuttingDown = true;
      inst.botConnected = false;
      clearInterval(inst.heartbeatTimer);
      clearInterval(inst.presenceTimer);
      clearTimeout(inst.reconnectTimer);
      clearInterval(inst.watchdog);
      if (inst.ws) {
        inst.ws.close(1000, 'Process shutting down');
      }
      activeGateways.delete(cleanToken);
    }
  };

  activeGateways.set(cleanToken, inst);
  return handle;
}
