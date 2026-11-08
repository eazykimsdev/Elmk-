/**
 * ConnectingERLC Discord Gateway Service
 * 
 * Maintains 24/7 Discord Gateway WebSocket presence for the ConnectingERLC bot.
 * Shows bot as "Online" on Discord with custom presence.
 * Automatically handles heartbeats, resumes, and reconnects.
 */

import fs from 'fs';
import path from 'path';
import { registerGlobalCommands, handleInteraction } from './botCommands.js';

let ws = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let lastSequence = null;
let sessionId = null;
let resumeGatewayUrl = null;
let isShuttingDown = false;
let reconnectAttempts = 0;

let botConnected = false;
let botLastError = null;
let botUserData = null;
let botGuildsCount = 0;
let botLoginTime = null;

export function getBotGatewayStatus() {
  return {
    connected: botConnected,
    status: botConnected ? 'Connected' : (botLastError ? 'Error' : 'Offline'),
    error: botLastError,
    user: botUserData,
    guildsCount: botGuildsCount,
    loginTime: botLoginTime
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
  if (botUserData) {
    botUserData.avatar = updated.avatar;
  }
  console.log('[DISCORD BOT] Successfully updated bot avatar via Discord REST API.');
  return updated;
}

export function startBotGateway(token, onGuildEvent) {
  if (!token) {
    console.warn('[DISCORD BOT] No bot token provided. Gateway service skipped.');
    botConnected = false;
    botLastError = 'No bot token configured';
    return;
  }

  const cleanToken = token.trim().replace(/^Bot\s+/i, '');
  isShuttingDown = false;
  botConnected = false;
  botLastError = null;

  function connect() {
    if (isShuttingDown) return;

    const gatewayUrl = resumeGatewayUrl || 'wss://gateway.discord.gg/?v=10&encoding=json';
    console.log(`[DISCORD BOT] Connecting to Discord Gateway (${resumeGatewayUrl ? 'resume' : 'new session'})...`);

    try {
      ws = new WebSocket(gatewayUrl);
    } catch (err) {
      console.error('[DISCORD BOT] Gateway connection error:', err.message);
      botConnected = false;
      botLastError = err.message || 'Connection error';
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      console.log('[DISCORD BOT] WebSocket connection established.');
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handlePayload(payload);
      } catch (err) {
        console.error('[DISCORD BOT] Error parsing gateway payload:', err.message);
      }
    };

    ws.onclose = (event) => {
      console.warn(`[DISCORD BOT] Gateway connection closed (code: ${event.code}, reason: ${event.reason || 'None'}).`);
      botConnected = false;
      clearInterval(heartbeatTimer);
      if (!isShuttingDown) {
        // Opcode 4004 = Authentication Failed (do not reconnect blindly)
        if (event.code === 4004) {
          console.error('[DISCORD BOT] FATAL: Invalid bot token (4004). Stopping gateway.');
          botLastError = 'Invalid bot token (code 4004)';
          return;
        }
        botLastError = event.reason || `Gateway closed with code ${event.code}`;
        scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      console.error('[DISCORD BOT] Gateway error:', err.message || err);
      botLastError = err.message || 'Gateway socket error';
    };
  }

  function handlePayload(payload) {
    const { op, d, s, t } = payload;
    if (s !== null && s !== undefined) {
      lastSequence = s;
    }

    switch (op) {
      case 10: { // Hello
        const heartbeatInterval = d.heartbeat_interval;
        console.log(`[DISCORD BOT] Received Hello (Heartbeat: ${heartbeatInterval}ms).`);
        startHeartbeat(heartbeatInterval);

        if (sessionId && lastSequence !== null) {
          // Resume
          console.log('[DISCORD BOT] Attempting to Resume session...');
          send(6, {
            token: cleanToken,
            session_id: sessionId,
            seq: lastSequence
          });
        } else {
          // Identify
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
                  name: '🦃 Happy Thanksgiving',
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
        ws.close(4000, 'Discord requested reconnect');
        break;
      }

      case 9: { // Invalid Session
        console.warn(`[DISCORD BOT] Invalid session. Resumable: ${d}`);
        if (!d) {
          sessionId = null;
          lastSequence = null;
          resumeGatewayUrl = null;
        }
        setTimeout(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close(4000, 'Invalid session reconnect');
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
      sessionId = data.session_id;
      resumeGatewayUrl = data.resume_gateway_url ? `${data.resume_gateway_url}?v=10&encoding=json` : null;
      botConnected = true;
      botLastError = null;
      botUserData = data.user;
      botGuildsCount = Array.isArray(data.guilds) ? data.guilds.length : 0;
      botLoginTime = new Date().toISOString();

      const botTag = `${data.user.username}#${data.user.discriminator || '0'}`;
      console.log(`\n======================================================`);
      console.log(`  [DISCORD BOT] ConnectingERLC is ONLINE as ${botTag}  `);
      console.log(`  Status: WATCHING "🦃 Happy Thanksgiving"              `);
      console.log(`  Connected to ${data.guilds.length} Discord servers  `);
      console.log(`======================================================\n`);

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

      // Register exactly 3 global slash commands (/bump, /stats, /info)
      const appId = data.application?.id || data.user?.id;
      if (appId) {
        registerGlobalCommands(cleanToken, appId).catch((err) => {
          console.warn('[DISCORD BOT] Slash commands registration warning:', err.message);
        });
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
    }
  }

  function startHeartbeat(interval) {
    clearInterval(heartbeatTimer);
    // Initial jitter as per Discord API docs
    const initialDelay = Math.floor(Math.random() * interval * 0.5);
    setTimeout(() => {
      sendHeartbeat();
      heartbeatTimer = setInterval(sendHeartbeat, interval);
    }, initialDelay);
  }

  function sendHeartbeat() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      send(1, lastSequence);
    }
  }

  function send(op, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op, d: data }));
    }
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectAttempts++;
    const delay = Math.min(30000, Math.pow(2, reconnectAttempts) * 1000);
    console.log(`[DISCORD BOT] Reconnecting in ${Math.round(delay / 1000)}s...`);
    reconnectTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    stop() {
      isShuttingDown = true;
      botConnected = false;
      clearInterval(heartbeatTimer);
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.close(1000, 'Process shutting down');
      }
    }
  };
}

