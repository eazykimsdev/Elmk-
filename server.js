import 'dotenv/config';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

import { createDashboardRouter, createDiscordCallbackRouter, handleBotGatewayEvent, fetchRealBotGuilds } from './web/api.js';
import { startBotGateway } from './botGateway.js';
import { validateProductionEnvironment } from './shared/productionCheck.js';
import { query as dbQuery, isPostgresConnected } from './db.js';

dotenv.config();

// Startup validation in production mode (Round 13 Section 1 & 8)
const envValidation = validateProductionEnvironment(process.env);
if (!envValidation.valid) {
  console.error('[STARTUP VALIDATION FAILED]', envValidation.error);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;

// Railway and most hosts sit behind a proxy: needed for secure cookies and real client IPs.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// CORS configuration with credentials support (Section 1.3)
app.use(cors({
  origin: (origin, callback) => {
    // In development or server-to-server, allow all origins with credentials
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Cookie', 'X-Requested-With', 'Accept']
}));

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

// Production Health Check for Railway & orchestrators
app.get('/healthz', async (req, res) => {
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

  const isHealthy = dbStatus !== 'down';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'connectingerlc',
    uptime: Math.round(process.uptime()),
    database: {
      status: dbStatus,
      latency_ms: dbLatency,
      connected: isPostgresConnected()
    },
    timestamp: new Date().toISOString()
  });
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api', createDashboardRouter());
app.use('/auth/discord', createDiscordCallbackRouter());

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

const server = app.listen(PORT, () => {
  console.log(`[CONNECTINGERLC WEB API] Dashboard backend listening on http://localhost:${PORT}`);

  // Start 24/7 Discord Gateway presence for ConnectingERLC bot
  const botToken = (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim();
  if (botToken) {
    startBotGateway(botToken, (type, data) => {
      handleBotGatewayEvent(type, data);
    });
    fetchRealBotGuilds(true).then((guilds) => {
      console.log(`[BOT GUILDS] Pre-cached ${guilds.length} bot guilds on server startup.`);
    }).catch((err) => {
      console.warn('[BOT GUILDS] Pre-caching bot guilds failed:', err.message);
    });
  }
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[CONNECTINGERLC WEB API] Port ${PORT} is already in use by another instance. Web dashboard active on previous instance.`);
  } else {
    console.error('[CONNECTINGERLC WEB API] Server error:', err);
  }
});

export default app;
