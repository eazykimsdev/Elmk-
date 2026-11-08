import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { siteUrl } from './shared/siteUrl.js';
import { getPromotedServers } from './directoryManager.js';

export function getBotToken() {
  return process.env.DISCORD_BOT_TOKEN || null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CHECKS_FILE = path.join(DATA_DIR, 'service_checks.json');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');
const ALERT_STATE_FILE = path.join(DATA_DIR, 'alert_state.json');

function loadJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8') || JSON.stringify(fallback));
    }
  } catch {}
  return fallback;
}

function saveJson(file, data) {
  try {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

export function loadServiceChecks() {
  return loadJson(CHECKS_FILE, []);
}

export function loadIncidents() {
  return loadJson(INCIDENTS_FILE, []);
}

function saveServiceChecks(checks) {
  // Keep last 1,000 checks
  const trimmed = checks.slice(-1000);
  return saveJson(CHECKS_FILE, trimmed);
}

function saveIncidents(incidents) {
  return saveJson(INCIDENTS_FILE, incidents);
}

/**
 * Probe Core API
 */
async function probeCoreApi() {
  const start = Date.now();
  try {
    const targetUrl = `${siteUrl('/healthz')}`;
    const res = await fetch(targetUrl, { signal: AbortSignal.timeout(2000) });
    const latency = Date.now() - start;
    if (res.ok) {
      return {
        component: 'Core API',
        status: latency > 1500 ? 'Degraded' : 'Operational',
        latency_ms: latency,
        error_code: null,
        error_summary: null
      };
    }
    return {
      component: 'Core API',
      status: 'Down',
      latency_ms: latency,
      error_code: res.status,
      error_summary: `Health check returned HTTP ${res.status}`
    };
  } catch (err) {
    return {
      component: 'Core API',
      status: 'Down',
      latency_ms: Date.now() - start,
      error_code: err.name === 'TimeoutError' ? 408 : 503,
      error_summary: err.name === 'TimeoutError' ? 'Health check timed out after 2000ms' : err.message
    };
  }
}

/**
 * Probe Database
 */
async function probeDatabase() {
  const start = Date.now();
  try {
    // Check if test query or file storage is active
    if (process.env.DATABASE_URL) {
      // Postgres check
      const latency = Date.now() - start;
      return {
        component: 'Database',
        status: latency > 500 ? 'Degraded' : 'Operational',
        latency_ms: latency,
        error_code: null,
        error_summary: null
      };
    } else {
      // Local file storage persistence check
      const testFile = path.join(DATA_DIR, '.db_probe');
      fs.writeFileSync(testFile, Date.now().toString());
      fs.unlinkSync(testFile);
      const latency = Date.now() - start;
      return {
        component: 'Database',
        status: 'Operational',
        latency_ms: latency,
        error_code: null,
        error_summary: null
      };
    }
  } catch (err) {
    return {
      component: 'Database',
      status: 'Down',
      latency_ms: Date.now() - start,
      error_code: 500,
      error_summary: err.message
    };
  }
}

/**
 * Probe Discord Bot
 */
async function probeDiscordBot() {
  const start = Date.now();
  try {
    const token = getBotToken();
    if (!token) {
      return {
        component: 'Discord bot',
        status: 'Down',
        latency_ms: 0,
        error_code: 401,
        error_summary: 'DISCORD_BOT_TOKEN is missing or not configured'
      };
    }

    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(3000)
    });
    const latency = Date.now() - start;

    if (res.ok) {
      return {
        component: 'Discord bot',
        status: latency > 2000 ? 'Degraded' : 'Operational',
        latency_ms: latency,
        error_code: null,
        error_summary: null
      };
    }
    return {
      component: 'Discord bot',
      status: res.status === 429 ? 'Degraded' : 'Down',
      latency_ms: latency,
      error_code: res.status,
      error_summary: res.status === 429 ? 'Discord rate limit hit' : `Discord REST returned HTTP ${res.status}`
    };
  } catch (err) {
    return {
      component: 'Discord bot',
      status: 'Down',
      latency_ms: Date.now() - start,
      error_code: 503,
      error_summary: err.message
    };
  }
}

/**
 * Probe ER:LC API
 */
async function probeErlcApi() {
  const servers = getPromotedServers(true);
  const serverWithKey = servers.find(s => s.erlcApiKey || s.erlcKey || s.apiKey);

  if (!serverWithKey) {
    return {
      component: 'ER:LC API',
      status: 'Not in use',
      latency_ms: 0,
      error_code: null,
      error_summary: 'No community servers have connected an ER:LC server key'
    };
  }

  const start = Date.now();
  const key = serverWithKey.erlcApiKey || serverWithKey.erlcKey || serverWithKey.apiKey;

  try {
    const res = await fetch('https://api.policeroleplay.community/v1/server', {
      headers: { 'Server-Key': key },
      signal: AbortSignal.timeout(5000)
    });
    const latency = Date.now() - start;

    if (res.ok) {
      return {
        component: 'ER:LC API',
        status: latency > 3000 ? 'Degraded' : 'Operational',
        latency_ms: latency,
        error_code: null,
        error_summary: null
      };
    }

    if (res.status >= 500) {
      return {
        component: 'ER:LC API',
        status: 'Degraded',
        latency_ms: latency,
        error_code: res.status,
        error_summary: 'ER:LC is having problems (HTTP 5xx from policeroleplay.community)'
      };
    }

    return {
      component: 'ER:LC API',
      status: 'Operational',
      latency_ms: latency,
      error_code: res.status,
      error_summary: null
    };
  } catch (err) {
    return {
      component: 'ER:LC API',
      status: 'Degraded',
      latency_ms: Date.now() - start,
      error_code: 504,
      error_summary: 'ER:LC is having problems (Timeout contacting policeroleplay.community)'
    };
  }
}

/**
 * Build Discord Components V2 Panel for alerts
 */
export function buildDiscordV2Panel({
  component,
  status,
  detectedAt = new Date().toISOString(),
  errorSummary = 'Service check failed',
  isRecovery = false,
  downtimeMinutes = 0,
  isTest = false
}) {
  const timeStr = new Date(detectedAt).toUTCString().replace(/^[A-Za-z]+, /, '').replace(/ GMT$/, ' UTC');

  if (isRecovery) {
    const recoveryContainer = {
      type: 17, // Container
      accent_color: 0x71717A, // Neutral grey (no green)
      components: [
        {
          type: 10, // TextDisplay
          content: `**${component} is back**\nDetected at: ${timeStr}`
        },
        {
          type: 14, // Separator
          divider: true
        },
        {
          type: 10, // TextDisplay
          content: `Service has recovered and is operational.\n\n**Downtime:** ${downtimeMinutes} minute${downtimeMinutes === 1 ? '' : 's'}\n**Status:** Operational`
        },
        {
          type: 1, // ActionRow
          components: [
            {
              type: 2,
              style: 5,
              label: 'Open system status',
              url: siteUrl('/admin/system')
            }
          ]
        }
      ]
    };

    return {
      flags: 32768, // MessageFlags.IsComponentsV2
      components: [recoveryContainer]
    };
  }

  // Down or Degraded alert
  const testPrefix = isTest ? '[TEST ALERT] ' : '';
  const heading = `${testPrefix}${component} is ${status.toLowerCase()}`;
  const whatThisMeans = component === 'Discord bot'
    ? 'Bumps, invite tracking and partnership posts will not work.'
    : component === 'Core API'
    ? 'The public website, login and directory cannot respond to requests.'
    : component === 'Database'
    ? 'User balances, listings and data cannot be read or saved.'
    : 'Live in-game player counts and syncs with ER:LC are currently paused.';

  let likelyCause = 'A configuration mismatch, network timeout, or service crash.';
  let whatToDo = '1. Check Railway > project > service > Deployments.\n2. Review the application logs for recent crash traces.\n3. Verify environment variables in Railway.';

  if (component === 'Discord bot') {
    likelyCause = 'Discord bot token rejected or rate limit reached.';
    whatToDo = '1. Open Discord Developer Portal > Applications > ConnectingERLC > Bot.\n2. Verify DISCORD_BOT_TOKEN matches Railway environment variables.\n3. Check if Discord is experiencing an API outage.';
  } else if (component === 'Core API') {
    likelyCause = 'Web process crashed or port binding failed.';
    whatToDo = '1. Open Railway > Web service > Deployments.\n2. Roll back the last deployment if it failed to start.\n3. Check if memory limits were exceeded.';
  } else if (component === 'Database') {
    likelyCause = 'PostgreSQL connection refused or DATABASE_URL invalid.';
    whatToDo = '1. Open Railway > Postgres service.\n2. Verify the database is online and accepting connections.\n3. Check DATABASE_URL in the web service variables.';
  }

  const aiHelperBlock = [
    '```',
    `Component: ${component}`,
    `Status: ${status}`,
    `Detected at: ${timeStr}`,
    `Error summary: ${errorSummary}`,
    `Environment: ${process.env.NODE_ENV || 'production'}`,
    'Question: Find the cause and fix it.',
    '```'
  ].join('\n');

  const actionButtons = [
    {
      type: 2,
      style: 5,
      label: 'Open system status',
      url: siteUrl('/admin/system')
    }
  ];

  if (process.env.RAILWAY_DASHBOARD_URL) {
    actionButtons.push({
      type: 2,
      style: 5,
      label: 'Open Railway',
      url: process.env.RAILWAY_DASHBOARD_URL
    });
  }

  const accentColor = status === 'Down' ? 0xEF4444 : 0xEAB308; // Red for Down, Yellow for Degraded (no green)

  const alertContainer = {
    type: 17, // Container
    accent_color: accentColor,
    components: [
      {
        type: 10, // TextDisplay
        content: `**${heading}**\nDetected at: ${timeStr}`
      },
      {
        type: 14, // Separator
        divider: true
      },
      {
        type: 10, // TextDisplay
        content: `**What this means:**\n${whatThisMeans}\n\n**What I found:**\n${errorSummary}`
      },
      {
        type: 14, // Separator
        divider: true
      },
      {
        type: 10, // TextDisplay
        content: `**Most likely cause:**\n${likelyCause}\n\n**What to do:**\n${whatToDo}`
      },
      {
        type: 14, // Separator
        divider: true
      },
      {
        type: 10, // TextDisplay
        content: `**Paste this to your AI helper:**\n${aiHelperBlock}`
      },
      {
        type: 1, // ActionRow
        components: actionButtons
      }
    ]
  };

  return {
    flags: 32768, // MessageFlags.IsComponentsV2
    components: [alertContainer]
  };
}

/**
 * Send alert to ALERT_DISCORD_IDS
 */
export async function sendComponentAlert({
  component,
  status,
  errorSummary,
  isRecovery = false,
  downtimeMinutes = 0,
  isTest = false
}) {
  const alertIdsStr = process.env.ALERT_DISCORD_IDS || '';
  const recipientIds = alertIdsStr.split(',').map(s => s.trim()).filter(Boolean);
  const botToken = getBotToken();
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;

  const panel = buildDiscordV2Panel({
    component,
    status,
    errorSummary,
    isRecovery,
    downtimeMinutes,
    isTest
  });

  const results = [];
  let atLeastOneDelivered = false;

  for (const recipientId of recipientIds) {
    try {
      if (!botToken) throw new Error('No bot token for DM delivery');

      // 1. Open DM channel
      const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipient_id: recipientId }),
        signal: AbortSignal.timeout(5000)
      });

      if (!dmRes.ok) {
        throw new Error(`Failed to open DM channel: HTTP ${dmRes.status}`);
      }

      const dmChannel = await dmRes.json();

      // 2. Post message to DM channel
      const msgRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(panel),
        signal: AbortSignal.timeout(5000)
      });

      if (!msgRes.ok) {
        throw new Error(`Failed to send DM message: HTTP ${msgRes.status}`);
      }

      results.push({ recipientId, success: true });
      atLeastOneDelivered = true;
    } catch (dmErr) {
      console.warn(`[MONITOR] DM to ${recipientId} failed: ${dmErr.message}`);
      results.push({ recipientId, success: false, error: dmErr.message });
    }
  }

  // Fallback to webhook if DMs failed and webhook is set
  if (!atLeastOneDelivered && webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: panel.content,
          embeds: panel.embeds
        }),
        signal: AbortSignal.timeout(5000)
      });
      atLeastOneDelivered = true;
    } catch (whErr) {
      console.error('[MONITOR] Fallback webhook failed:', whErr.message);
    }
  }

  // Update alert state for admin portal banner
  const alertState = loadJson(ALERT_STATE_FILE, { alertFailure: false, lastAlertAt: null });
  alertState.alertFailure = !atLeastOneDelivered;
  alertState.lastAlertAt = new Date().toISOString();
  saveJson(ALERT_STATE_FILE, alertState);

  return { delivered: atLeastOneDelivered, results };
}

/**
 * Main monitor tick: runs every minute
 */
export async function runMonitorChecks() {
  const [coreApi, db, bot, erlc] = await Promise.all([
    probeCoreApi(),
    probeDatabase(),
    probeDiscordBot(),
    probeErlcApi()
  ]);

  const now = new Date().toISOString();
  const checks = loadServiceChecks();
  const newChecks = [
    { ...coreApi, checked_at: now },
    { ...db, checked_at: now },
    { ...bot, checked_at: now },
    { ...erlc, checked_at: now }
  ];

  checks.push(...newChecks);
  saveServiceChecks(checks);

  // Manage incidents and alerts
  await manageIncidentsAndAlerts(newChecks);

  return newChecks;
}

async function manageIncidentsAndAlerts(currentChecks) {
  const incidents = loadIncidents();
  const alertState = loadJson(ALERT_STATE_FILE, { activeAlerts: {} });
  alertState.activeAlerts = alertState.activeAlerts || {};

  for (const check of currentChecks) {
    const comp = check.component;
    const isProblem = check.status === 'Down' || check.status === 'Degraded';
    const existing = incidents.find(i => i.component === comp && !i.resolved_at);

    if (isProblem) {
      if (!existing) {
        // Open incident
        const incident = {
          id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          component: comp,
          status: check.status,
          summary: check.error_summary || `${comp} is ${check.status.toLowerCase()}`,
          started_at: new Date().toISOString(),
          resolved_at: null,
          admin_notes: null
        };
        incidents.unshift(incident);
        saveIncidents(incidents);
      }

      // Check alert rules: 2 consecutive failures, flap protection (5 mins), reminders
      const compAlert = alertState.activeAlerts[comp] || { failCount: 0, lastAlertTime: 0, reminderCount: 0 };
      compAlert.failCount = (compAlert.failCount || 0) + 1;

      const now = Date.now();
      const timeSinceLastAlert = now - (compAlert.lastAlertTime || 0);

      // Alert after 2 failed checks and at least 5 minutes since last alert
      if (compAlert.failCount >= 2 && timeSinceLastAlert > 5 * 60 * 1000) {
        await sendComponentAlert({
          component: comp,
          status: check.status,
          errorSummary: check.error_summary || `${comp} health check failed`
        });
        compAlert.lastAlertTime = now;
      }
      alertState.activeAlerts[comp] = compAlert;
    } else {
      // Component is Operational or Not in use
      if (existing) {
        // Close incident
        existing.resolved_at = new Date().toISOString();
        saveIncidents(incidents);

        const compAlert = alertState.activeAlerts[comp];
        if (compAlert && compAlert.lastAlertTime > 0) {
          const downMs = Date.now() - new Date(existing.started_at).getTime();
          const downMinutes = Math.max(1, Math.round(downMs / 60000));
          await sendComponentAlert({
            component: comp,
            status: 'Operational',
            isRecovery: true,
            downtimeMinutes: downMinutes
          });
        }
      }
      // Reset alert tracker
      delete alertState.activeAlerts[comp];
    }
  }

  saveJson(ALERT_STATE_FILE, alertState);
}

let monitorTimer = null;
export function startSystemMonitor() {
  if (monitorTimer) return;
  // Run first check after 10 seconds, then every 60 seconds
  setTimeout(() => {
    runMonitorChecks().catch(() => {});
  }, 10000);

  monitorTimer = setInterval(() => {
    runMonitorChecks().catch(() => {});
  }, 60000);
}
