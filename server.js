import 'dotenv/config';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

import { createDashboardRouter, createDiscordCallbackRouter, handleBotGatewayEvent, fetchRealBotGuilds } from './api.js';
import { startBotGateway, normalizeBotToken } from './botGateway.js';
import { processMaturePendingJoins } from './directoryManager.js';
import { validateProductionEnvironment } from './shared/productionCheck.js';
import { query as dbQuery, isPostgresConnected } from './db.js';
import { isMaintenanceActive } from './siteStateManager.js';
import { startSystemMonitor } from './monitorJob.js';
import { seedDataDir } from './dataSync.js';

try { seedDataDir(); } catch {}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Startup diagnostics (printed immediately)
console.log(`[CONNECTINGERLC STARTUP] Entry: ${__filename} | Node: ${process.version} | Platform: ${process.platform} | CWD: ${process.cwd()}`);

// Normalize bot token and client credentials aliases across process.env
const startupBotToken = normalizeBotToken(process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || '');
if (startupBotToken) {
  process.env.DISCORD_BOT_TOKEN = startupBotToken;
  process.env.DISCORD_TOKEN = startupBotToken;
  process.env.CONNECTINGERLC_BOT_TOKEN = startupBotToken;
}

// Startup validation in production mode (Round 13 Section 1 & 8)
const envValidation = validateProductionEnvironment(process.env);
if (!envValidation.valid) {
  console.error('[STARTUP VALIDATION FAILED]', envValidation.error);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8080;

// Railway and most hosts sit behind a proxy: needed for secure cookies and real client IPs.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Strict CORS configuration with credentials support (Section 1.3 / Security Round 2 Item 24)
const ALLOWED_ORIGINS = new Set([
  'https://connectingerlc.xyz',
  'https://www.connectingerlc.xyz',
  'https://web-production-24b30e62.up.railway.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
]);
if (process.env.APP_ORIGIN) {
  try { ALLOWED_ORIGINS.add(new URL(process.env.APP_ORIGIN).origin); } catch {}
}
if (process.env.SITE_URL) {
  try { ALLOWED_ORIGINS.add(new URL(process.env.SITE_URL).origin); } catch {}
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile, server-to-server, curl) or allowlisted origins
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS request blocked by origin security policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Cookie', 'X-Requested-With', 'Accept']
}));

// Attack 1: Request smuggling prevention (reject conflicting or duplicate content-length/transfer-encoding)
app.use((req, res, next) => {
  const cl = req.headers['content-length'];
  const te = req.headers['transfer-encoding'];
  if (cl && te) {
    return res.status(400).json({ error: 'Bad Request: Conflicting Content-Length and Transfer-Encoding headers' });
  }
  if (Array.isArray(cl)) {
    return res.status(400).json({ error: 'Bad Request: Multiple Content-Length headers' });
  }
  next();
});

// Attack 7: Cache poisoning prevention (set proper Vary and Cache-Control)
app.use((req, res, next) => {
  res.set('Vary', 'Accept-Encoding, Cookie, Authorization, Origin');
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  next();
});

// Security headers with strict CSP, HSTS, X-Frame-Options, X-Content-Type-Options
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; img-src 'self' https://cdn.discordapp.com https://media.discordapp.net data: blob: https:; media-src 'self' https: data: blob:; connect-src 'self' https: ws: wss:; font-src 'self' https: data:;");
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// Attack 12 / Item 32: Prototype pollution guard
function hasPrototypePollution(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 10) return false;
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true;
    if (obj[key] && typeof obj[key] === 'object' && hasPrototypePollution(obj[key], depth + 1)) return true;
  }
  return false;
}

app.use((req, res, next) => {
  if (hasPrototypePollution(req.body) || hasPrototypePollution(req.query) || hasPrototypePollution(req.params)) {
    return res.status(400).json({ error: 'Invalid property name in payload: prototype pollution attempt detected' });
  }
  next();
});

// Production Health Check for Railway & orchestrators (MUST always pass 200 even during maintenance)
app.get(['/healthz', '/health'], async (req, res) => {
  const start = Date.now();
  let dbStatus = 'operational';
  let dbLatency = 0;

  if (process.env.DATABASE_URL) {
    try {
      const dbRes = await dbQuery('SELECT 1 AS ok');
      dbLatency = Date.now() - start;
      if (!dbRes) {
        dbStatus = 'fallback_mode';
      }
    } catch (err) {
      dbStatus = 'degraded';
      dbLatency = Date.now() - start;
    }
  }

  res.status(200).json({
    status: 'healthy',
    service: 'connectingerlc',
    uptime: Math.round(process.uptime()),
    database: {
      status: dbStatus,
      latency_ms: dbLatency,
      connected: isPostgresConnected()
    },
    maintenance: isMaintenanceActive(),
    timestamp: new Date().toISOString()
  });
});

app.get('/status', (req, res, next) => {
  if (req.accepts('html')) {
    return next();
  }
  res.status(200).json({
    status: 'online',
    maintenance: isMaintenanceActive(),
    timestamp: new Date().toISOString()
  });
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
const dashboardRouter = createDashboardRouter();
app.use('/api', dashboardRouter);
app.use('/auth/discord', createDiscordCallbackRouter());

// Discovery invite redirect: connectingerlc.xyz/discovery/:serverId/invite
app.get('/discovery/:serverId/invite', (req, res, next) => {
  const queryStr = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  req.url = `/discovery/${req.params.serverId}/invite${queryStr}`;
  dashboardRouter(req, res, next);
});
app.get('/discovery/:serverId', (req, res) => {
  res.redirect(`/discovery/${req.params.serverId}/invite`);
});

// /api/health, /api/status, Discord login and the dashboard settings all live in web/api.js.

// ─── SERVE FRONTEND STATIC FILES IN PRODUCTION ──────────────────────────────
const candidatePaths = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'web', 'dist'),
  path.join(__dirname, 'WEBSITE', 'artifacts', 'testaa-preview', 'dist', 'public'),
  path.join(__dirname, 'zip-repl-1', 'artifacts', 'testaa-preview', 'dist', 'public')
];

const webDistPath = candidatePaths.find(p => fs.existsSync(p));
console.log('[CONNECTINGERLC WEB] Serving frontend from:', webDistPath || 'NOT FOUND');

if (webDistPath) {
  app.use(express.static(webDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
      return res.sendFile(path.join(webDistPath, 'index.html'));
    }
    next();
  });
}

// Last line of defence: any thrown error becomes a clean response, never a crash.
app.use((err, req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  console.error('[CONNECTINGERLC WEB API] Unhandled route error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CONNECTINGERLC WEB API] Dashboard backend listening on 0.0.0.0:${PORT}`);

  // Start 24/7 Discord Gateway presence for ConnectingERLC#0281 bot
  const primaryToken = normalizeBotToken(process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '');
  const knownTokens = [
    primaryToken
  ].filter(Boolean);
  const uniqueTokens = [...new Set(knownTokens)];

  for (const tok of uniqueTokens) {
    try {
      startBotGateway(tok, (type, data) => {
        handleBotGatewayEvent(type, data);
      });
    } catch (gwErr) {
      console.warn('[DISCORD BOT] Could not start gateway for token:', gwErr.message);
    }
  }

  // Request header and connection timeouts (Attack 1: HTTP/2 and slowloris mitigation)
  server.headersTimeout = 60000;
  server.requestTimeout = 30000;

  fetchRealBotGuilds(true).then((guilds) => {
    console.log(`[BOT GUILDS] Pre-cached ${guilds.length} bot guilds on server startup.`);
  }).catch((err) => {
    console.warn('[BOT GUILDS] Pre-caching bot guilds failed:', err.message);
  });

  // Start continuous scheduled system monitor checks
  try {
    startSystemMonitor();
  } catch (mErr) {
    console.warn('[MONITOR] Could not start system monitor:', mErr.message);
  }

  // Continuously process mature pending joins (minimum stay verified)
  setInterval(() => {
    processMaturePendingJoins().catch((err) => {
      console.warn('[PENDING JOINS] Periodic check warning:', err.message);
    });
  }, 15000);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[CONNECTINGERLC WEB API] Port ${PORT} is already in use by another instance. Web dashboard active on previous instance.`);
  } else {
    console.error('[CONNECTINGERLC WEB API] Server error:', err);
  }
});

export default app;
