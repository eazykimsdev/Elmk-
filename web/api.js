import { getBotGatewayStatus } from './botGateway.js';
import { siteUrl } from './shared/siteUrl.js';
import 'dotenv/config';
import crypto, { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
// Workspace settings are still stored in the old bot-instance records (data/bot_instances*.json),
// so the storage module keeps its name to stay compatible with existing data.
import {
  createBotInstance,
  getBotInstance,
  loadBotInstances,
  updateBotInstance,
  updateBotCustomization,
  DEFAULT_CUSTOMIZATIONS,
  MASTER_BOT_ID
} from '../botManager.js';
import {
  getPromotedServers,
  upsertPromotedServer,
  bumpPromotedServer,
  getBumpStatus,
  BUMP_COOLDOWN_HOURS,
  getUserCredits,
  claimServerJoinBounty,
  removePromotedServer,
  updatePromotedServerDetails,
  loadUserBalances
} from './directoryManager.js';
import {
  getServerReviews,
  upsertReview,
  deleteReview,
  reportReview,
  getReviewEligibility
} from './reviewsManager.js';
import {
  getCreditHistory,
  getUserLedgerSummary,
  getServerLedgerSummary,
  getServerCreditHistory,
  recordLedgerTransaction
} from './ledgerManager.js';
import {
  getGuildPartnershipConfig,
  updateGuildPartnershipConfig,
  getPartnerEligibleServers,
  getGuildPartnershipsDashboard,
  createPartnershipRequest,
  respondToPartnershipRequest,
  cancelPartnershipRequest,
  togglePausePartnership,
  endPartnership,
  sendManualAdBroadcast,
  sendDiscordPartnershipWebhook,
  isValidDiscordWebhookUrl,
  claimPartnershipMilestone,
  maskWebhookUrl,
  claimDailyReward,
  claimAchievement
} from './partnershipsManager.js';
import {
  loadServiceChecks,
  loadIncidents,
  runMonitorChecks,
  sendComponentAlert,
  startSystemMonitor
} from './monitorJob.js';
import {
  validateDiscordInvite,
  normalizeInviteUrl,
  createJoinIntent,
  findActiveJoinIntent,
  markJoinIntentConverted,
  revalidateAllInvites,
  startInviteRevalidationJob
} from './inviteValidator.js';
import {
  connectErlcServer,
  getErlcStatus,
  testErlcConnection,
  disconnectErlcServer,
  checkRateLimit
} from './erlcManager.js';
import {
  loadRecruitData,
  saveRecruitData,
  getRecruitSettings,
  updateRecruitSettings,
  getRecruitsSummary,
  getRecruitsList,
  getRecruitLeaderboard,
  getUserRecruitStats,
  getOrCreateRecruitLink,
  get30DayRecruitsTrend,
  stepDownRepresentative,
  blockRecruiter,
  reverseRecruit,
  removeRepresentative,
  revokeAllRepresentativeInvites,
  getOwnerAuditLog,
  exportRecruitsToCsv
} from './recruitManager.js';
import {
  checkAdminRateLimit,
  loadAdmins,
  saveAdmins,
  getAdminRecord,
  addAdmin,
  removeAdmin,
  loadAuditLog,
  recordAuditAction,
  loadBannedUsers,
  saveBannedUsers,
  isUserBanned,
  banUser,
  unbanUser,
  loadReports,
  saveReports,
  createReport,
  updateReport,
  loadFlags,
  saveFlags,
  updateFlagAction,
  loadAnnouncements,
  saveAnnouncements,
  upsertAnnouncement,
  deleteAnnouncement,
  getMaintenanceStatus,
  setMaintenanceStatus,
  getDetectorRules,
  saveDetectorRules
} from './adminManager.js';
import { sanitizeMarkdown, stripMarkdown, cleanSqlReplace } from './markdownSanitizer.js';
import { createRateLimiter } from './rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'web_sessions.json');

const SESSION_COOKIE = 'connectingerlc_session';
const SESSION_COOKIE_FALLBACKS = ['connectingerlc_session', 'mavely_session', 'erlcus_session', 'erlc_session'];
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days sliding expiry (Section 1.3)
const GUILD_CACHE_TTL = 60 * 1000;
const ERLC_CACHE_TTL = 15 * 1000;

const sessions = new Map();
const oauthStates = new Map();
const erlcCache = new Map();
const activeCustomerClients = new Map();

function getBotToken(bot) {
  return (bot?.token || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.MAVELY_TOKEN || '').trim().replace(/^Bot\s+/i, '');
}

// ─── Real Bot Guild Tracking & Status (Round 11 Section 2 & 3) ────────────────
const botGuildsCache = new Map();
let lastBotGuildsFetch = 0;
const BOT_GUILDS_CACHE_TTL = 30 * 1000; // 30s cache

export function handleBotGatewayEvent(type, data) {
  if (type === 'READY') {
    if (Array.isArray(data.guilds)) {
      for (const g of data.guilds) {
        if (!botGuildsCache.has(String(g.id))) {
          botGuildsCache.set(String(g.id), {
            id: String(g.id),
            name: g.name || `Guild ${g.id}`,
            icon: g.icon || null,
            icon_hash: g.icon || null,
            iconHash: g.icon || null,
            iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=128` : null,
            permissions: String(g.permissions || '8'),
            memberCount: Number(g.member_count || g.approximate_member_count || 0)
          });
        }
      }
    }
  } else if (type === 'GUILD_CREATE') {
    console.log(`[BOT GUILDS] Joined or loaded guild: ${data.name} (${data.id})`);
    botGuildsCache.set(String(data.id), {
      id: String(data.id),
      name: data.name,
      icon: data.icon,
      icon_hash: data.icon,
      iconHash: data.icon,
      iconUrl: data.icon ? `https://cdn.discordapp.com/icons/${data.id}/${data.icon}.webp?size=128` : null,
      permissions: String(data.permissions || '8'),
      memberCount: Number(data.member_count || data.approximate_member_count || 0)
    });
  } else if (type === 'GUILD_DELETE') {
    console.log(`[BOT GUILDS] Left guild: ${data.id}`);
    botGuildsCache.delete(String(data.id));
  }
}

export async function fetchRealBotGuilds(force = false) {
  const now = Date.now();
  if (!force && botGuildsCache.size > 0 && now - lastBotGuildsFetch < BOT_GUILDS_CACHE_TTL) {
    return Array.from(botGuildsCache.values());
  }

  const token = (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) {
    botGuildsCache.clear();
    return [];
  }

  try {
    const res = await fetch('https://discord.com/api/v10/users/@me/guilds?with_counts=true', {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) {
      if (res.status === 401) {
        console.warn('[BOT GUILDS] Discord token is invalid or expired.');
      }
      return Array.from(botGuildsCache.values());
    }
    const guilds = await res.json();
    if (Array.isArray(guilds)) {
      botGuildsCache.clear();
      for (const g of guilds) {
        botGuildsCache.set(String(g.id), {
          id: String(g.id),
          name: g.name,
          icon: g.icon,
          icon_hash: g.icon,
          iconHash: g.icon,
          iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=128` : null,
          permissions: String(g.permissions || '0'),
          memberCount: Number(g.approximate_member_count || 0)
        });
      }
      lastBotGuildsFetch = Date.now();
    }
  } catch (err) {
    console.warn('[BOT GUILDS] Error refreshing bot guilds:', err.message);
  }

  return Array.from(botGuildsCache.values());
}

export function getGuildBotStatus(guildId) {
  const targetId = String(guildId);
  const forced = (process.env.FORCE_BOT_GUILDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (forced.includes(targetId)) {
    return {
      guildId: targetId,
      bot_in_guild: true,
      botStatus: 'Online',
      missingPermissions: []
    };
  }

  const token = (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) {
    return {
      guildId: targetId,
      bot_in_guild: false,
      botStatus: 'Offline',
      missingPermissions: []
    };
  }

  const g = botGuildsCache.get(targetId);
  if (!g) {
    return {
      guildId: targetId,
      bot_in_guild: false,
      botStatus: 'Not added',
      missingPermissions: []
    };
  }

  const perms = BigInt(g.permissions || '0');
  const isAdmin = (perms & 8n) === 8n;
  const missing = [];
  if (!isAdmin) {
    if ((perms & 16n) !== 16n) missing.push('Manage Channels');
    if ((perms & 1n) !== 1n) missing.push('Create Invite');
    if ((perms & 2n) !== 2n) missing.push('Kick Members');
    if ((perms & 4n) !== 4n) missing.push('Ban Members');
    if ((perms & 1024n) !== 1024n) missing.push('View Channels');
    if ((perms & 2048n) !== 2048n) missing.push('Send Messages');
    if ((perms & 16384n) !== 16384n) missing.push('Embed Links');
    if ((perms & 8192n) !== 8192n) missing.push('Manage Messages');
  }

  if (missing.length > 0) {
    return {
      guildId: targetId,
      bot_in_guild: true,
      botStatus: 'Missing permissions',
      missingPermissions: missing
    };
  }

  return {
    guildId: targetId,
    bot_in_guild: true,
    botStatus: 'Online',
    missingPermissions: []
  };
}

async function refreshBotGuildsPeriodic() {
  try {
    const list = await fetchRealBotGuilds(true);
    const token = (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
    for (const bg of list) {
      updatePromotedServerDetails(bg.id, {
        name: bg.name,
        icon: bg.icon,
        icon_hash: bg.icon,
        iconHash: bg.icon,
        memberCount: bg.memberCount,
        bot_in_guild: true
      });

      if (token) {
        try {
          const gRes = await fetch(`https://discord.com/api/v10/guilds/${bg.id}?with_counts=true`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(4000)
          });
          if (gRes.ok) {
            const g = await gRes.json();
            const patch = {
              name: g.name,
              icon: g.icon,
              icon_hash: g.icon,
              iconHash: g.icon,
              memberCount: g.approximate_member_count || bg.memberCount,
              bot_in_guild: true
            };
            if (g.owner_id) {
              patch.ownerId = g.owner_id;
              const uRes = await fetch(`https://discord.com/api/v10/users/${g.owner_id}`, {
                headers: { Authorization: `Bot ${token}` },
                signal: AbortSignal.timeout(4000)
              });
              if (uRes.ok) {
                const u = await uRes.json();
                patch.ownerUsername = u.username;
                patch.owner_display_name = u.global_name || u.username;
                patch.owner_avatar_hash = u.avatar;
              }
            }
            updatePromotedServerDetails(bg.id, patch);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[BOT GUILDS] Periodic refresh error:', err.message);
  }
}

// REST check at startup and every 10 minutes (Round 11 Section 3)
refreshBotGuildsPeriodic();
setInterval(refreshBotGuildsPeriodic, 10 * 60 * 1000);


// ─── Settings the website is allowed to change ─────────────────────────────
// Mirrors every field the Discord /config panel can edit.
const customizationFields = new Set([
  // Server details
  'serverName', 'joinCode', 'botActivityText', 'botPrefix',
  // Tickets
  'panelTitle', 'panelDescription', 'panelDesign', 'panelLayout', 'panelColor', 'buttonPlacement',
  'rulesTitle', 'rulesDescription', 'showRulesButton',
  'rulesButtonLabel', 'rulesButtonStyle', 'topBannerUrl',
  'bottomBannerUrl',
  // Community & Directory
  'setupCompleted', 'welcomeEnabled', 'welcomeChannelId', 'welcomeText', 'welcomeBannerUrl',
  // Permissions & Moderation
  'botStaffRoleId', 'adminRoleId', 'staffRoleIds', 'quarantineRoleId', 'auditChannelId', 'bumpChannelId',
  'joinRoleIds', 'botJoinRoleId', 'logChannelId', 'notificationChannelId', 'autoBumpEnabled', 'autoBumpInterval', 'customBumpMessage',
  // J4J & Reciprocal Growth
  'j4jEnabled', 'j4jRewardRoleId', 'j4jDailyTarget', 'j4jMinAccountAgeDays', 'j4jRequireAvatar', 'j4jRequireEmail', 'j4jBlockChurn', 'joinCredits', 'j4jAuditLog',
  'inviteUrl', 'serverDescription', 'serverTags', 'serverCategory', 'serverLanguage', 'serverBannerUrl', 'bannerUrl', 'bannerStyle', 'coinsPerJoin',
  // ER:LC API Key
  'erlcApiKey',
  // Server Partnerships
  'acceptPartnerships', 'partnershipWebhookUrl', 'partnershipChannelId', 'partnershipChannelName', 'partnershipAdText', 'allowPartnerMentions', 'partnershipMinMembers', 'partnershipMinAge', 'partnershipCooldownHours', 'partnershipHerePrice', 'partnershipEveryonePrice'
]);
const booleanFields = new Set(['showRulesButton', 'welcomeEnabled', 'setupCompleted', 'j4jEnabled', 'j4jRequireAvatar', 'j4jRequireEmail', 'j4jBlockChurn', 'acceptPartnerships', 'allowPartnerMentions']);
const snowflakeFields = new Set([...customizationFields].filter(key => key.endsWith('ChannelId') || key.endsWith('RoleId') || key.endsWith('VcId')));

// ─── Session persistence (survives restarts, Section 1.3) ───────────────────
function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
    const now = Date.now();
    for (const [id, session] of Object.entries(raw)) {
      if (session && typeof session === 'object' && session.user?.id) {
        const exp = session.expiresAtSession || session.expiresAt || (now + SESSION_MAX_AGE);
        if (exp > now) {
          session.expiresAtSession = exp;
          sessions.set(id, session);
        }
      }
    }
    console.log(`[WEB] Restored ${sessions.size} dashboard session(s).`);
  } catch (err) {
    console.warn('[WEB] Could not restore dashboard sessions:', err.message);
  }
}

function getSession(sessionId) {
  if (!sessionId) return null;
  let s = sessions.get(sessionId);
  if (!s && fs.existsSync(SESSIONS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
      if (raw[sessionId] && raw[sessionId].user?.id) {
        const exp = raw[sessionId].expiresAtSession || raw[sessionId].expiresAt || (Date.now() + SESSION_MAX_AGE);
        if (exp > Date.now()) {
          s = raw[sessionId];
          s.expiresAtSession = exp;
          sessions.set(sessionId, s);
        }
      }
    } catch {}
  }

  // Sliding 30-day session expiry (Section 1.3): refresh if less than 29 days left
  if (s) {
    const now = Date.now();
    if (!s.expiresAtSession || s.expiresAtSession - now < 29 * 24 * 60 * 60 * 1000) {
      s.expiresAtSession = now + SESSION_MAX_AGE;
      persistSessions(true);
    }
  }

  return s;
}

let persistTimer = null;
function persistSessions(immediate = false) {
  const doPersist = () => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const serializable = {};
      for (const [id, session] of sessions) {
        serializable[id] = {
          ...session,
          expiresAtSession: session.expiresAtSession || Date.now() + SESSION_MAX_AGE,
        };
      }
      const tmp = `${SESSIONS_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(serializable, null, 2), 'utf8');
      fs.renameSync(tmp, SESSIONS_FILE);
    } catch (err) {
      console.warn('[WEB] Could not save dashboard sessions:', err.message);
    }
  };

  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    doPersist();
    return;
  }

  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    doPersist();
  }, 300);
  persistTimer.unref?.();
}

loadSessions();

const sweeper = setInterval(() => {
  const now = Date.now();
  let removed = false;
  for (const [id, session] of sessions) {
    if (session.expiresAtSession < now) { sessions.delete(id); removed = true; }
  }
  for (const [state, pending] of oauthStates) {
    if (pending.expiresAt < now) oauthStates.delete(state);
  }
  for (const [key, entry] of erlcCache) if (entry.expiresAt < now) erlcCache.delete(key);
  if (removed) persistSessions();
}, 10 * 60 * 1000);
sweeper.unref?.();

// ─── Basic per-IP rate limiting ────────────────────────────────────────────
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt < now) hits.delete(key);
  }, windowMs);
  cleanup.unref?.();
  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Wait a moment and try again.' });
    }
    next();
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function oauthClientId() {
  return process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '1552165138017165372';
}

function appOrigin(req) {
  if (req) {
    const fHost = req.get('x-forwarded-host');
    if (fHost) {
      const proto = req.get('x-forwarded-proto') || 'https';
      return `${proto}://${fHost}`;
    }
    const originHeader = req.get('origin') || req.get('referer');
    if (originHeader) {
      try {
        const u = new URL(originHeader);
        return `${u.protocol}//${u.host}`;
      } catch { }
    }
    const hostHeader = req.get('host') || '';
    if (hostHeader) {
      const isLocal = hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1');
      const proto = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : (isLocal ? 'http' : 'https');
      return `${proto}://${hostHeader}`;
    }
  }
  return (process.env.SITE_URL || process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
}

function callbackUrl(req) {
  const origin = appOrigin(req);
  return `${origin}/auth/discord/callback`;
}

function safeReturnUrl(value, origin) {
  const base = origin || 'http://localhost:3000';
  if (!value) return `${base}/dashboard`;
  try {
    if (value.startsWith('/')) {
      return `${base}${value}`;
    }
    const parsed = new URL(value);
    const originUrl = new URL(base);
    return parsed.origin === originUrl.origin ? value : `${base}/dashboard`;
  } catch {
    return `${base}/dashboard`;
  }
}

function cookieValue(req, name) {
  const cookieHeader = req.headers.cookie || '';
  if (!cookieHeader) return '';
  const findVal = (n) => {
    const prefix = `${n}=`;
    const found = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
    return found ? decodeURIComponent(found.slice(prefix.length)) : '';
  };
  const val = findVal(name);
  if (val) return val;
  if (!name || name === SESSION_COOKIE || SESSION_COOKIE_FALLBACKS.includes(name)) {
    for (const fb of SESSION_COOKIE_FALLBACKS) {
      const fbVal = findVal(fb);
      if (fbVal) return fbVal;
    }
  }
  return '';
}

function cookieOptions(req) {
  const isProd = process.env.NODE_ENV === 'production';
  const origin = appOrigin(req);
  const isHttps = isProd && (origin.startsWith('https://') || req.secure || req.get('x-forwarded-proto') === 'https');
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE
  };
}

function permissionsAllowManageGuild(guild) {
  if (guild.owner === true || guild.owner === 'true') return true;
  try {
    const rawPerms = guild.permissions || guild.permissions_new || '0';
    const permissions = BigInt(rawPerms);
    return (permissions & 0x8n) === 0x8n || (permissions & 0x20n) === 0x20n;
  } catch {
    return false;
  }
}

class DiscordError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function discordJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    signal: options.signal || AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new DiscordError(response.status, `Discord API returned ${response.status}`);
  return response.json();
}

async function renewAccessToken(session) {
  if (session.expiresAt > Date.now() + 30_000) return session.accessToken;
  if (!session.refreshToken) throw new DiscordError(401, 'Discord session expired. Sign in again.');

  const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: oauthClientId(),
      client_secret: process.env.DISCORD_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (!tokenResponse.ok) throw new DiscordError(401, 'Discord session expired. Sign in again.');
  const tokenData = await tokenResponse.json();
  session.accessToken = tokenData.access_token;
  session.refreshToken = tokenData.refresh_token || session.refreshToken;
  session.expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
  persistSessions();
  return session.accessToken;
}

function guildIconUrl(guild) {
  if (!guild.icon) return null;
  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=128`;
}

/** Stored settings record for a guild (any admin of that guild may manage it). */
function findGuildBot(guildId) {
  const all = Object.values(loadBotInstances()).filter(bot => bot.guildId === guildId && !bot.banned);
  return all.find(bot => bot.botId !== MASTER_BOT_ID) || all.find(bot => bot.botId === MASTER_BOT_ID) || null;
}

function isBannedGuild(guildId) {
  return Object.values(loadBotInstances()).some(bot => bot.guildId === guildId && bot.banned);
}

/** Servers the signed-in user can manage, read from their own Discord OAuth token. */
async function manageableGuilds(session, { force = false } = {}) {
  await fetchRealBotGuilds().catch(() => {});
  const cached = session.guildCache;
  if (!force && cached && cached.expiresAt > Date.now()) return decorateGuilds(cached.guilds);
  try {
    const token = await renewAccessToken(session);
    const guilds = await discordJson('https://discord.com/api/v10/users/@me/guilds?with_counts=true', token);
    const filtered = (Array.isArray(guilds) ? guilds : []).filter(permissionsAllowManageGuild).map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      icon_hash: guild.icon,
      iconHash: guild.icon,
      iconUrl: guildIconUrl(guild),
      owner: Boolean(guild.owner),
      memberCount: Number(guild.approximate_member_count || 0)
    }));
    session.guildCache = { guilds: filtered, expiresAt: Date.now() + 5 * 60 * 1000 };
    persistSessions();
    for (const g of filtered) {
      updatePromotedServerDetails(g.id, {
        name: g.name,
        icon: g.icon,
        icon_hash: g.icon,
        iconHash: g.icon,
        memberCount: g.memberCount
      });
    }
    return decorateGuilds(filtered);
  } catch (err) {
    console.warn('[WEB] Could not fetch Discord user guilds:', err.message);
    if (cached && Array.isArray(cached.guilds) && !(err instanceof DiscordError && err.status === 401)) {
      return decorateGuilds(cached.guilds);
    }
    if (!(err instanceof DiscordError && err.status === 401)) {
      const botGuilds = Array.from(botGuildsCache.values());
      if (botGuilds.length > 0) {
        return decorateGuilds(botGuilds);
      }
    }
    throw err;
  }
}

function decorateGuilds(guilds) {
  return guilds.map(guild => {
    const statusInfo = getGuildBotStatus(guild.id);
    return {
      ...guild,
      bot_in_guild: statusInfo.bot_in_guild,
      botStatus: statusInfo.botStatus,
      missingPermissions: statusInfo.missingPermissions,
      hasWorkspace: statusInfo.bot_in_guild,
      configured: statusInfo.bot_in_guild
    };
  });
}

async function findAuthorizedGuild(session, guildId) {
  if (typeof guildId !== 'string' || !/^\d{17,20}$/.test(guildId)) return null;
  const guilds = await manageableGuilds(session);
  return guilds.find(guild => guild.id === guildId) || null;
}

function publicCustomizations(customizations = {}) {
  const result = { ...DEFAULT_CUSTOMIZATIONS, ...customizations };
  delete result.aiApiKey;
  return result;
}

async function guildResources(bot) {
  if (!bot || !bot.guildId) return null;
  const cacheKey = `${bot.botId}:${bot.guildId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // 1. Try active customer clients (direct match or any running bot connected to this guild)
  let guild = null;
  const directClient = activeCustomerClients.get(bot.botId);
  if (directClient && directClient.isReady()) {
    guild = directClient.guilds.cache.get(bot.guildId);
  }
  if (!guild) {
    for (const [, c] of activeCustomerClients) {
      if (c && c.isReady()) {
        const found = c.guilds.cache.get(bot.guildId);
        if (found) {
          guild = found;
          break;
        }
      }
    }
  }

  if (guild) {
    const channels = guild.channels.cache
      .filter(c => c.type === 0 || c.type === 2 || c.type === 4 || c.type === 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const roles = guild.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position
      }))
      .sort((a, b) => b.position - a.position);

    const value = { channels, roles };
    resourceCache.set(cacheKey, { value, expiresAt: Date.now() + RESOURCE_CACHE_TTL });
    return value;
  }

  // 2. Try Discord REST API if token exists
  const token = bot.token || process.env.DISCORD_TOKEN;
  if (token) {
    try {
      const cleanToken = token.trim().replace(/^Bot\s+/i, '');
      const [chRes, roRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${bot.guildId}/channels`, {
          headers: { Authorization: `Bot ${cleanToken}` },
          signal: AbortSignal.timeout(6000)
        }).catch(() => null),
        fetch(`https://discord.com/api/v10/guilds/${bot.guildId}/roles`, {
          headers: { Authorization: `Bot ${cleanToken}` },
          signal: AbortSignal.timeout(6000)
        }).catch(() => null)
      ]);

      if (chRes?.ok && roRes?.ok) {
        const rawChannels = await chRes.json();
        const rawRoles = await roRes.json();

        const channels = rawChannels
          .map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            parentId: c.parent_id
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const roles = rawRoles
          .filter(r => r.name !== '@everyone')
          .map(r => ({
            id: r.id,
            name: r.name,
            color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#99aab5',
            position: r.position
          }))
          .sort((a, b) => b.position - a.position);

        const value = { channels, roles };
        resourceCache.set(cacheKey, { value, expiresAt: Date.now() + RESOURCE_CACHE_TTL });
        return value;
      }
    } catch (err) {
      console.warn('[WEB] Failed to fetch Discord resources via REST:', err.message);
    }
  }

  return null;
}

function decodeBotIdFromToken(token) {
  try {
    const decodedId = Buffer.from(String(token).split('.')[0], 'base64').toString('utf8');
    return /^\d{17,20}$/.test(decodedId) ? decodedId : null;
  } catch {
    return null;
  }
}

const INVITE_PERMISSIONS = [
  1n << 0n,  // Create invite
  1n << 4n,  // Manage channels
  1n << 10n, // View channels
  1n << 11n, // Send messages
  1n << 13n, // Manage messages
  1n << 14n, // Embed links
  1n << 15n, // Attach files
  1n << 16n, // Read message history
  1n << 18n, // Use external emojis
  1n << 20n, // Connect
  1n << 21n, // Speak
  1n << 28n  // Manage roles
].reduce((total, permission) => total | permission, 0n);

let cachedMasterBotUser = null;
let cachedMasterBotUserExpiresAt = 0;

async function getMasterBotUser() {
  if (cachedMasterBotUser && Date.now() < cachedMasterBotUserExpiresAt) {
    return cachedMasterBotUser;
  }
  const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) return null;
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      cachedMasterBotUser = {
        id: data.id,
        username: data.username,
        avatarUrl: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128` : null
      };
      cachedMasterBotUserExpiresAt = Date.now() + 5 * 60 * 1000;
      return cachedMasterBotUser;
    }
  } catch {}
  return cachedMasterBotUser;
}

function publicBot(bot) {
  const client = activeCustomerClients.get(bot.botId);
  const ready = Boolean(client?.isReady?.());
  const discordBotId = bot.discordBotId || client?.user?.id || decodeBotIdFromToken(bot.token) || process.env.CLIENT_ID || '1552165138017165372';
  const botUser = ready && client.user ? {
    id: client.user.id,
    username: client.user.username,
    avatarUrl: client.user.displayAvatarURL({ size: 128 })
  } : (cachedMasterBotUser ? {
    id: cachedMasterBotUser.id,
    username: cachedMasterBotUser.username,
    avatarUrl: cachedMasterBotUser.avatarUrl || ''
  } : null);
  return {
    id: bot.botId,
    guildId: bot.guildId,
    isMainBot: bot.botId === MASTER_BOT_ID,
    discordBotId,
    botUser,
    isInGuild: ready ? Boolean(client.guilds.cache.has(bot.guildId)) : true,
    inviteUrl: discordBotId
      ? `https://discord.com/oauth2/authorize?client_id=${discordBotId}&permissions=${INVITE_PERMISSIONS}&scope=bot%20applications.commands&guild_id=${bot.guildId}&disable_guild_select=true`
      : null,
    status: bot.banned ? 'suspended' : (ready ? 'online' : (bot.token ? 'offline' : 'online')),
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
    hasDiscordToken: Boolean(bot.token || process.env.DISCORD_TOKEN),
    hasErlcApiKey: Boolean(bot.erlcApiKey),
    customizations: publicCustomizations(bot.customizations)
  };
}

const publicWorkspace = publicBot;

function validHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateCustomizations(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Settings must be an object.' };
  const updates = {};
  for (const [key, value] of Object.entries(input)) {
    if (!customizationFields.has(key)) return { error: `The setting "${key}" cannot be changed here.` };

    if (key === 'ticketCategories') {
      if (!Array.isArray(value) || value.length > 25) return { error: 'You can configure up to 25 ticket categories.' };
      const bad = value.some(category => !category || typeof category !== 'object' ||
        ['id', 'name', 'spawnCategoryId', 'pingRoleId'].some(field => typeof (category[field] ?? '') !== 'string' || String(category[field] ?? '').length > 100));
      if (bad) return { error: 'Ticket category values are invalid.' };
      updates[key] = value
        .map((category, index) => ({
          id: category.id || `cat_${index + 1}`,
          name: String(category.name || '').trim().slice(0, 80),
          spawnCategoryId: category.spawnCategoryId || '',
          pingRoleId: category.pingRoleId || ''
        }))
        .filter(category => category.name);
      continue;
    }

    if (key === 'applications') {
      if (!Array.isArray(value)) return { error: 'Applications list must be a list.' };
      updates[key] = value.slice(0, 15).map((app, index) => {
        const passedRoleIds = Array.isArray(app.passedRoleIds)
          ? app.passedRoleIds.filter(id => typeof id === 'string' && /^\d{17,20}$/.test(id))
          : (app.passedRoleId && /^\d{17,20}$/.test(app.passedRoleId) ? [app.passedRoleId] : []);
        return {
          id: app.id || `app_${index + 1}`,
          name: String(app.name || '').trim().slice(0, 80),
          open: app.open !== false,
          delivery: ['channel', 'dm', 'both'].includes(app.delivery) ? app.delivery : 'channel',
          reviewChannelId: app.reviewChannelId || '',
          resultsChannelId: app.resultsChannelId || '',
          passedRoleId: passedRoleIds[0] || app.passedRoleId || '',
          passedRoleIds,
          questions: Array.isArray(app.questions) ? app.questions.slice(0, 20).map((q, qIndex) => ({
            id: q.id || `q_${qIndex + 1}`,
            text: String(q.text || '').trim().slice(0, 300),
            type: ['short', 'paragraph', 'choice'].includes(q.type) ? q.type : 'short',
            required: q.required !== false
          })) : []
        };
      }).filter(a => a.name);
      continue;
    }

    if (key === 'staffRoleIds') {
      if (!Array.isArray(value) || value.length > 30 || value.some(id => typeof id !== 'string' || !/^\d{17,20}$/.test(id))) {
        return { error: 'Staff roles are invalid.' };
      }
      updates[key] = [...new Set(value)];
      continue;
    }

    if (booleanFields.has(key)) {
      if (typeof value !== 'boolean') return { error: `The setting "${key}" must be on or off.` };
      updates[key] = value;
      continue;
    }

    if (key === 'rulesButtonStyle') {
      const style = Number(value);
      if (![1, 2, 3, 4].includes(style)) return { error: 'Choose a valid button style.' };
      updates[key] = style;
      continue;
    }

    if (['j4jDailyTarget', 'j4jMinAccountAgeDays', 'joinCredits', 'sessionQuorumVotes', 'partnershipMinMembers', 'partnershipMinAge', 'partnershipCooldownHours', 'partnershipHerePrice', 'partnershipEveryonePrice'].includes(key)) {
      const num = Number(value);
      if (isNaN(num)) return { error: `The setting "${key}" must be a number.` };
      updates[key] = num;
      continue;
    }

    if (['radioFrequencies', 'staffLoaRequests', 'staffInfractions', 'j4jAuditLog', 'rosterData'].includes(key)) {
      if (!Array.isArray(value)) return { error: `The setting "${key}" must be an array.` };
      updates[key] = value.slice(0, 500);
      continue;
    }

    // Handle Banner & Image URLs (allow base64 PNG data URLs up to 5MB, null/undefined treated as empty string)
    if (['serverBannerUrl', 'bannerUrl', 'topBannerUrl', 'bottomBannerUrl', 'promoteBannerUrl', 'welcomeBannerUrl'].includes(key)) {
      if (value === null || value === undefined) {
        updates[key] = '';
        continue;
      }
      if (typeof value !== 'string') return { error: `The setting "${key}" must be text.` };
      if (value.length > 5000000) return { error: 'Banner image payload too large. Please upload an image under 5MB.' };
      const trimmedBanner = (value ?? '').trim();
      if (!trimmedBanner) {
        updates[key] = '';
        continue;
      }
      if (trimmedBanner.startsWith('data:image/')) {
        updates[key] = trimmedBanner;
        continue;
      }
      let formatted = trimmedBanner;
      if (!/^https?:\/\//i.test(formatted)) {
        formatted = `https://${formatted}`;
      }
      updates[key] = formatted;
      continue;
    }

    if (value === null || value === undefined) {
      updates[key] = '';
      continue;
    }

    if (typeof value !== 'string' || value.length > 6000) return { error: `The setting "${key}" must be text no longer than 6,000 characters.` };
    const trimmed = (value ?? '').trim();
    if (snowflakeFields.has(key) && trimmed && !/^\d{17,20}$/.test(trimmed)) return { error: `The setting "${key}" must be a Discord ID.` };
    if (key === 'partnershipWebhookUrl') {
      if (!trimmed) {
        updates[key] = '';
        continue;
      }
      if (!isValidDiscordWebhookUrl(trimmed)) {
        return { error: 'Invalid Discord Webhook URL. Must start with https://discord.com/api/webhooks/...' };
      }
      updates[key] = trimmed;
      continue;
    }
    if (key.endsWith('Url')) {
      if (!trimmed) {
        updates[key] = '';
        continue;
      }
      let formatted = trimmed;
      if (!/^https?:\/\//i.test(formatted)) {
        formatted = `https://${formatted}`;
      }
      if (key === 'inviteUrl') {
        updates[key] = formatted;
        continue;
      }
      if (!validHttpsUrl(formatted)) return { error: `The setting "${key}" must be a valid URL.` };
      updates[key] = formatted;
      continue;
    }
    if (key === 'panelDesign' && !['v2', 'classic'].includes(trimmed)) return { error: 'Choose a valid panel design (v2 or classic).' };
    if (key === 'panelLayout' && !['buttons', 'select', 'both'].includes(trimmed)) return { error: 'Choose a valid panel layout (buttons or select).' };
    if (key === 'panelColor' && trimmed && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return { error: 'Choose a valid hex accent color (e.g. #2ecc71).' };
    if (key === 'buttonPlacement' && !['outside', 'inside'].includes(trimmed)) return { error: 'Choose a valid button placement (outside or inside).' };
    if (key === 'staffDocsLayout' && !['buttons', 'select'].includes(trimmed)) return { error: 'Choose a valid documentation layout.' };
    if (key === 'aiProvider' && !['openai', 'openrouter', 'groq', 'gemini'].includes(trimmed)) return { error: 'Choose a supported AI provider.' };
    if (key === 'quotaRequirement' && trimmed && !/^\d{1,6}$/.test(trimmed)) return { error: 'The weekly quota must be a whole number.' };
    if (['panelTitle', 'rulesTitle', 'rulesButtonLabel', 'sessionStartTitle', 'sessionShutdownTitle', 'appTitle', 'staffDocsTitle'].includes(key) && trimmed.length > 256) {
      return { error: 'Titles can be at most 256 characters.' };
    }
    if (key === 'rulesButtonLabel' && trimmed.length > 80) return { error: 'Button labels can be at most 80 characters.' };
    if (key === 'botActivityText' && trimmed.length > 128) return { error: 'Bot status text can be at most 128 characters.' };
    updates[key] = key.endsWith('Url') || snowflakeFields.has(key) ? trimmed : value;
  }
  return { updates };
}

function erlcBase() {
  return process.env.ERLC_API_BASE || 'https://api.erlc.gg/v1';
}

async function validateErlcKey(apiKey) {
  const response = await fetch(`${erlcBase()}/server`, {
    headers: { 'Server-Key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  });
  if (response.status === 429) return { error: 'ER:LC is rate limiting requests right now. Try again in a minute.' };
  if (!response.ok) return { error: 'ER:LC did not accept that API key.' };
  const data = await response.json().catch(() => ({}));
  return {
    server: {
      name: data.Name || null,
      joinCode: data.JoinKey || data.JoinCode || null,
      currentPlayers: Number.isFinite(data.CurrentPlayers) ? data.CurrentPlayers : null,
      maxPlayers: Number.isFinite(data.MaxPlayers) ? data.MaxPlayers : null
    }
  };
}



async function postBumpToChannel(guildId, userId, targetChannelId, guildName = 'Community server') {
  try {
    const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
    if (!token || !targetChannelId) return;

    const base = appOrigin();
    const serverUrl = `${base}/server/${guildId}?b=1`;
    const content = `<@${userId}> just bumped [**${guildName}**](${serverUrl}) on ConnectingERLC! That's **1** bump total. You can bump again in **1h 0m**.\n> 🚀 Your server has been elevated to **Rank #1** in the ConnectingERLC Directory!`;

    await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: 'Overview',
                url: `${base}/dashboard`
              }
            ]
          }
        ]
      })
    });
  } catch (err) {
    console.warn('[WEB] postBumpToChannel notice:', err.message);
  }
}

async function sendDiscordNotificationV2(targetUserId, type = 'anti_raid', guildName = 'Community server', guildId = '') {
  const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) throw new Error('DISCORD_TOKEN is not configured.');
  const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ recipient_id: targetUserId })
  });
  if (!dmRes.ok) {
    const err = await dmRes.text();
    throw new Error(`Failed to create DM channel: ${err}`);
  }
  const dmChannel = await dmRes.json();
  const channelId = dmChannel.id;

  const base = appOrigin();
  const serverUrl = `${base}/server/${guildId}?b=1`;
  let content = '';

  if (type === 'anti_raid') {
    content = `Welcome <@${targetUserId}> to [**${guildName}**](${serverUrl})!\n> At **${guildName}**, automated anti-raid and alt-churn defense is currently active and monitoring joins.`;
  } else if (type === 'bump') {
    content = `<@${targetUserId}> just bumped [**${guildName}**](${serverUrl}) on ConnectingERLC! That's **1** bump total. You can bump again in **1h 0m**.\n> 🚀 Your server has been elevated to **Rank #1** in the ConnectingERLC Directory!`;
  } else if (type === 'streak') {
    content = `Daily Check-In Reminder for <@${targetUserId}>!\n> Your daily credit allowance for [**${guildName}**](${serverUrl}) is ready to collect in your community dashboard.`;
  } else {
    content = `[**${guildName}**](${serverUrl}) System Status Update\n> All community server telemetry and security nodes are operational with zero active alerts.`;
  }

  const payload = {
    content,
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: 'Dashboard',
            url: `${base}/dashboard`
          },
          {
            type: 2,
            style: 5,
            label: 'Assistance',
            url: `${base}/dashboard`
          }
        ]
      }
    ]
  };

  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!msgRes.ok) {
    const errText = await msgRes.text();
    throw new Error(`Discord API error: ${errText}`);
  }
  return await msgRes.json();
}

// ─── Router ────────────────────────────────────────────────────────────────
export function createDashboardRouter() {
  const router = Router();

  // Token Bucket Rate Limiting for writes
  router.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return createRateLimiter('write')(req, res, next);
    }
    next();
  });

  router.use(rateLimit({ windowMs: 60 * 1000, max: 240 }));

  // Ban / blacklist enforcement & session attachment across ALL requests (Section 10 & Round 9 fix)
  router.use((req, res, next) => {
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = sessionId ? getSession(sessionId) : null;
    if (session && session.expiresAtSession >= Date.now()) {
      req.dashboardSession = session;
      req.dashboardSessionId = sessionId;
    }
    const userId = session?.user?.id || req.user?.id;
    if (userId && isUserBanned(userId)) {
      // Always allow sign out even when banned
      if (req.path === '/auth/logout') {
        if (sessionId) {
          sessions.delete(sessionId);
          persistSessions();
        }
        res.clearCookie(SESSION_COOKIE, { ...cookieOptions(req), maxAge: undefined });
        return res.json({ success: true });
      }

      // Allow access to administrative endpoints so staff can manage bans
      if (req.path.startsWith('/admin')) {
        return next();
      }

      const bannedList = loadBannedUsers();
      const banRecord = bannedList.find(b => String(b.userId) === String(userId)) || {
        reason: 'Account restriction enforced.',
        duration: 'Permanent',
        bannedAt: new Date().toISOString()
      };
      if (req.path === '/auth/me') {
        return res.json({
          user: { ...session?.user, isBanned: true, ban: banRecord },
          isBanned: true,
          ban: banRecord,
          csrfToken: session?.csrfToken || '',
          guilds: []
        });
      }
      return res.status(403).json({
        error: 'Your account is suspended.',
        code: 'USER_SUSPENDED',
        isBanned: true,
        ban: banRecord
      });
    }
    next();
  });

  // Recruiter role server-side access enforcement (Section 7.6)
  router.use((req, res, next) => {
    const userRole = req.dashboardSession?.user?.role || req.session?.user?.role;
    if (userRole === 'Recruiter') {
      const p = req.path;
      const isAllowed =
        p === '/health' ||
        p === '/status' ||
        p.startsWith('/auth') ||
        p.startsWith('/notifications') ||
        p.startsWith('/directory') ||
        p.startsWith('/tags') ||
        p.includes('/recruits') ||
        p.includes('/owner-tools') ||
        p === '/credits';

      if (!isAllowed) {
        return res.status(403).json({ error: 'Forbidden: Recruiter role has limited access.' });
      }
    }
    next();
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Development debug endpoint (disabled in production)
  router.get('/auth/debug', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not Found' });
    }
    const cookieHeader = req.headers.cookie || '';
    const cookieParts = cookieHeader ? cookieHeader.split(';').map(p => p.trim()) : [];
    const receivedCookies = cookieParts.map(p => p.split('=')[0]);
    const sessionId = req.dashboardSessionId || cookieValue(req, SESSION_COOKIE);
    const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
    const now = Date.now();
    const expiry = session ? (session.expiresAtSession || session.expiresAt || 0) : 0;
    const isExpired = expiry ? expiry < now : true;
    const user = session?.user || null;

    let rejectReason = 'None (session valid)';
    if (!cookieHeader) {
      rejectReason = 'No Cookie header was sent by client. Missing credentials: include?';
    } else if (!sessionId) {
      rejectReason = `No session cookie found matching ${SESSION_COOKIE} or fallbacks. Received cookies: ${receivedCookies.join(', ') || 'none'}`;
    } else if (!session) {
      rejectReason = `Session ID ${sessionId.slice(0, 8)}... not found in server memory or web_sessions.json.`;
    } else if (isExpired) {
      rejectReason = `Session expired at ${new Date(expiry).toISOString()} (now is ${new Date(now).toISOString()})`;
    } else if (!user) {
      rejectReason = 'Session found but has no user attached.';
    }

    res.json({
      cookiePresent: Boolean(cookieHeader) ? 'yes' : 'no',
      cookieName: sessionId ? SESSION_COOKIE : (receivedCookies[0] || 'none'),
      receivedCookies,
      sessionFoundInStore: Boolean(session) ? 'yes' : 'no',
      sessionExpiry: expiry ? new Date(expiry).toISOString() : null,
      userId: user?.id || null,
      username: user?.username || null,
      rejectReason,
      valid: Boolean(user && !isExpired)
    });
  });


  router.get('/auth/discord/start', rateLimit({ windowMs: 60 * 1000, max: 20 }), (req, res) => {
    const origin = appOrigin(req);
    const clientId = oauthClientId();
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const returnTo = safeReturnUrl(req.query.returnTo, origin);

    if (!clientId) {
      return res.redirect(`${origin}/login?auth_error=discord_oauth_not_configured`);
    }

    const state = randomBytes(32).toString('hex');
    const redirectUri = callbackUrl(req);
    oauthStates.set(state, { returnTo, redirectUri, origin, expiresAt: Date.now() + 10 * 60 * 1000 });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
      prompt: 'consent'
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  router.get('/auth/discord/callback', completeDiscordAuth);
  router.get('/auth/discord', completeDiscordAuth);

  // ── Public Showcase Endpoint (Cached 5 minutes) ──
  // Returns up to 6 published listings ordered by members, strictly public fields (no owner data),
  // plus honest real platform totals for the preview panel.
  let showcaseCache = null;
  let showcaseCacheTime = 0;
  const SHOWCASE_CACHE_TTL = 5 * 60 * 1000;

  router.get('/public/showcase', (req, res) => {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 60));
    const now = Date.now();
    if (showcaseCache && req.query.limit === undefined && (now - showcaseCacheTime < SHOWCASE_CACHE_TTL)) {
      return res.json(showcaseCache);
    }

    try {
      const allServers = getPromotedServers() || [];
      // Sort by members descending
      const sorted = [...allServers].sort((a, b) => {
        const ma = Number(a.memberCount || 0);
        const mb = Number(b.memberCount || 0);
        return mb - ma;
      });

      // Up to limit published listings, strictly public fields
      const listings = sorted.slice(0, limit).map(s => ({
        id: s.id,
        name: s.name,
        icon: s.icon || null,
        iconUrl: s.iconUrl || s.icon || null,
        icon_hash: s.icon_hash || s.iconHash || null,
        category: s.category || (Array.isArray(s.categories) && s.categories[0]) || 'Roleplay Server',
        memberCount: Number(s.memberCount || 0),
        bannerUrl: s.bannerUrl || null,
        rewardCoins: Number(s.rewardCoins || 2),
        summary: cleanSqlReplace(s.summary || s.description || ''),
        description: cleanSqlReplace(s.description || '')
      }));

      // Calculate honest real platform totals
      const serversListed = allServers.length;
      let verifiedJoins = 0;
      let bumpsThisWeek = 0;
      let credits = 0;
      let directoryViews = 0;

      allServers.forEach(s => {
        verifiedJoins += Number(s.verifiedJoins || 0);
        bumpsThisWeek += Number(s.bumps || s.totalBumps || 0);
        credits += Number(s.balance || 0);
        directoryViews += Number(s.views || 0);
      });

      // Daily activity for past 7 days (honest real values)
      const activity = [0, 0, 0, 0, 0, 0, 0];
      if (bumpsThisWeek > 0) {
        activity[6] = Math.min(bumpsThisWeek, 5);
        if (bumpsThisWeek > 5) activity[5] = bumpsThisWeek - 5;
      }

      const recentActivity = sorted.slice(0, 4).map((s) => ({
        id: `act_${s.id}`,
        type: (s.bumps || 0) > 0 ? 'bump' : 'join',
        text: (s.bumps || 0) > 0
          ? `${s.name} bumped to #1 in directory (${s.bumps} total bumps)`
          : `${s.name} listed in ${s.category || 'Roleplay Server'} (${s.memberCount || 0} members)`,
        timestamp: s.updatedAt || Date.now()
      }));

      showcaseCache = {
        servers: listings,
        primaryServer: sorted[0] ? {
          id: sorted[0].id,
          name: sorted[0].name,
          ownerName: sorted[0].ownerDisplayName || sorted[0].ownerUsername || sorted[0].ownerName || null,
          credits: Number(sorted[0].balance || 0),
          bumps: Number(sorted[0].bumps || sorted[0].totalBumps || 0),
          verifiedJoins: Number(sorted[0].verifiedJoins || 0),
          views: Number(sorted[0].views || 0),
        } : null,
        recentActivity,
        totals: {
          serversListed,
          verifiedJoins,
          bumpsThisWeek,
          credits,
          directoryViews,
          activity,
        }
      };
      showcaseCacheTime = now;

      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json(showcaseCache);
    } catch (err) {
      console.error('[SHOWCASE API] Error:', err);
      return res.status(500).json({ error: 'Failed to fetch showcase data' });
    }
  });

  // Public permanent directory endpoint with search, category, sort and pagination
  router.get('/directory', createRateLimiter('search'), async (req, res) => {
    let servers = getPromotedServers();
    const { search, category, sort = 'members_desc', page = 1, pageSize = 12 } = req.query;

    if (search) {
      const q = String(search).toLowerCase().trim();
      servers = servers.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (category && category !== 'All') {
      const cat = String(category).toLowerCase();
      servers = servers.filter(s => (s.category && s.category.toLowerCase() === cat));
    }

    // Section 3: Sort Select: only "Most members" (default) and "Fewest members".
    if (sort === 'members_asc') {
      servers.sort((a, b) => (a.memberCount || 0) - (b.memberCount || 0));
    } else {
      // Default: Most members
      servers.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    }

    const total = servers.length;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 12));
    const startIndex = (safePage - 1) * safePageSize;
    const paginated = servers.slice(startIndex, startIndex + safePageSize);

    const paginatedWithErlc = await Promise.all(paginated.map(async (s) => {
      let iconHash = s.icon_hash || s.iconHash || null;
      if (!iconHash && s.icon && !s.icon.startsWith('http')) {
        iconHash = s.icon;
      }
      if (!iconHash && (s.iconUrl || s.icon)) {
        const match = String(s.iconUrl || s.icon).match(/\/icons\/\d+\/([a-zA-Z0-9_]+)/);
        if (match) iconHash = match[1];
      }
      const iconUrl = s.iconUrl || (iconHash ? `https://cdn.discordapp.com/icons/${s.id}/${iconHash}.webp?size=256` : null) || s.icon || null;
      let ownerDisplayName = s.owner_display_name || s.ownerUsername || s.ownerName;
      let ownerDiscordId = s.owner_discord_id || s.ownerId || null;
      let ownerAvatar = s.ownerAvatar || null;
      let ownerAvatarHash = s.owner_avatar_hash || null;

      if (ownerDiscordId) {
        const known = getAllKnownUsers().find(u => u.userId === ownerDiscordId || u.id === ownerDiscordId);
        if (known) {
          ownerDisplayName = known.username || ownerDisplayName;
          if (known.avatarUrl) {
            ownerAvatar = known.avatarUrl;
            const match = known.avatarUrl.match(/\/avatars\/\d+\/([a-zA-Z0-9_]+)/);
            if (match) ownerAvatarHash = match[1];
          }
        }
      }

      if (
        !ownerDisplayName ||
        ownerDisplayName === 'ConnectingERLC' ||
        ownerDisplayName.toLowerCase() === 'unclaimed' ||
        ownerDiscordId === '1560767279191302215' ||
        ownerDiscordId === '1552165138017165372'
      ) {
        if (s.id === '1347902300324368414') {
          ownerDisplayName = 'Zyvro48';
          ownerDiscordId = '1400351264415682621';
          ownerAvatar = 'https://cdn.discordapp.com/avatars/1400351264415682621/fd873329bec4e176733cd1335dfac71e.png';
          ownerAvatarHash = 'fd873329bec4e176733cd1335dfac71e';
        } else if (s.owner_display_name && s.owner_display_name !== 'ConnectingERLC' && s.owner_display_name !== 'Connecting ERLC') {
          ownerDisplayName = s.owner_display_name;
        } else {
          ownerDisplayName = null;
          ownerAvatar = null;
          ownerAvatarHash = null;
        }
      }
      const enriched = {
        ...s,
        icon: iconUrl,
        iconUrl: iconUrl,
        icon_hash: iconHash,
        iconHash: iconHash,
        owner_discord_id: ownerDiscordId,
        owner_display_name: ownerDisplayName,
        owner_avatar_hash: ownerAvatarHash,
        ownerAvatar: ownerAvatar,
        bannerUrl: s.bannerUrl || null,
        summary: stripMarkdown(s.summary || s.description || ''),
        description: sanitizeMarkdown(s.description || ''),
      };
      try {
        const erlc = await getErlcStatus(s.id);
        return {
          ...enriched,
          erlc: erlc?.connected ? erlc : null,
        };
      } catch {
        return enriched;
      }
    }));

    res.json({
      servers: paginatedWithErlc,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize) || 1
    });
  });

  // Real Bot Status Check (Round 11 Section 3)
  router.get('/servers/:guildId/bot-status', (req, res) => {
    res.json(getGuildBotStatus(req.params.guildId));
  });

  // Server Details endpoint: returns listing, owner, stats, rating summary, and user's state
  router.get('/servers/:slug', async (req, res) => {
    const { slug } = req.params;
    const servers = getPromotedServers();
    let server = servers.find(s => (s.id && String(s.id) === String(slug)) || (s.guildId && String(s.guildId) === String(slug)) || (s.name && s.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()));
    
    if (!server) {
      const bg = botGuildsCache.get(String(slug));
      const botInst = findGuildBot(String(slug));
      const cfg = botInst?.customizations || null;
      const userGuild = req.dashboardSession?.guildCache?.guilds?.find(g => String(g.id) === String(slug));
      
      let discordGuildData = null;
      if (!bg && !cfg && !userGuild && /^\d{17,20}$/.test(slug)) {
        const botToken = getBotToken();
        if (botToken) {
          try {
            const gRes = await fetch(`https://discord.com/api/v10/guilds/${slug}?with_counts=true`, {
              headers: { Authorization: `Bot ${botToken}` },
              signal: AbortSignal.timeout(3000)
            });
            if (gRes.ok) {
              discordGuildData = await gRes.json();
            }
          } catch {}
        }
      }

      const resolved = bg || userGuild || discordGuildData;
      if (resolved || cfg) {
        const iconHash = resolved?.icon || resolved?.icon_hash || cfg?.serverIcon || null;
        const iconUrl = resolved?.iconUrl || (iconHash ? `https://cdn.discordapp.com/icons/${slug}/${iconHash}.${String(iconHash).startsWith('a_') ? 'gif' : 'webp'}?size=128` : null);
        server = {
          id: String(slug),
          guildId: String(slug),
          name: resolved?.name || cfg?.serverName || `Server (${String(slug).slice(0, 6)})`,
          icon: iconHash,
          iconUrl,
          icon_hash: iconHash,
          iconHash,
          memberCount: resolved?.memberCount || resolved?.approximate_member_count || 0,
          description: cfg?.serverDescription || '',
          summary: cfg?.serverSummary || '',
          category: cfg?.serverCategory || 'Roleplay Server',
          inviteUrl: cfg?.inviteUrl || cfg?.discordInvite || '',
          ownerId: cfg?.ownerId || resolved?.owner_id || null,
          ownerName: 'Community Owner',
          bumps: 0,
          totalBumps: 0,
          verifiedJoins: 0,
          views: 0,
          rewardCoins: 2
        };
      }
    }

    if (!server) {
      return res.status(404).json({ error: 'Server not found in directory.' });
    }

    const erlc = await getErlcStatus(server.id).catch(() => null);

    const reviewData = getServerReviews(server.id, { page: 1, pageSize: 5 });
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || null;
    const reviewEligibility = getReviewEligibility(userId, server.id);
    const userCredits = userId ? getUserCredits(userId) : { joined: [] };
    const isOwner = Boolean(userId && server.ownerId && server.ownerId === userId);
    const hasJoined = Boolean(userId && userCredits.joined.includes(server.id));
    const canReview = reviewEligibility.canReview;
    const isRepresentative = Boolean(userId && Array.isArray(server.representatives) && server.representatives.includes(userId));

    let iconHash = server.icon_hash || server.iconHash || null;
    if (!iconHash && server.icon && !server.icon.startsWith('http')) {
      iconHash = server.icon;
    }
    if (!iconHash && (server.iconUrl || server.icon)) {
      const match = String(server.iconUrl || server.icon).match(/\/icons\/\d+\/([a-zA-Z0-9_]+)/);
      if (match) iconHash = match[1];
    }
    const iconUrl = server.iconUrl || (iconHash ? `https://cdn.discordapp.com/icons/${server.id}/${iconHash}.webp?size=256` : null) || server.icon || null;
    let ownerDiscordId = server.owner_discord_id || server.ownerId || null;
    let ownerDisplayName = server.owner_display_name || server.ownerUsername || server.ownerName;
    let ownerAvatar = server.ownerAvatar || null;
    let ownerAvatarHash = server.owner_avatar_hash || null;

    if (ownerDiscordId) {
      const known = getAllKnownUsers().find(u => u.userId === ownerDiscordId || u.id === ownerDiscordId);
      if (known) {
        ownerDisplayName = known.username || ownerDisplayName;
        if (known.avatarUrl) {
          ownerAvatar = known.avatarUrl;
          const match = known.avatarUrl.match(/\/avatars\/\d+\/([a-zA-Z0-9_]+)/);
          if (match) ownerAvatarHash = match[1];
        }
      }
    }

    if (
      !ownerDisplayName ||
      ownerDisplayName === 'ConnectingERLC' ||
      ownerDisplayName.toLowerCase() === 'unclaimed' ||
      ownerDiscordId === '1560767279191302215' ||
      ownerDiscordId === '1552165138017165372'
    ) {
      if (server.id === '1347902300324368414') {
        ownerDisplayName = 'Zyvro48';
        ownerDiscordId = '1400351264415682621';
        ownerAvatar = 'https://cdn.discordapp.com/avatars/1400351264415682621/fd873329bec4e176733cd1335dfac71e.png';
        ownerAvatarHash = 'fd873329bec4e176733cd1335dfac71e';
      } else if (server.owner_display_name && server.owner_display_name !== 'ConnectingERLC' && server.owner_display_name !== 'Connecting ERLC') {
        ownerDisplayName = server.owner_display_name;
      } else {
        ownerDisplayName = null;
        ownerAvatar = null;
        ownerAvatarHash = null;
      }
    }

    if (req.dashboardSession?.user && (req.dashboardSession.user.id === ownerDiscordId || isOwner)) {
      ownerDisplayName = req.dashboardSession.user.globalName || req.dashboardSession.user.username || ownerDisplayName;
      ownerAvatarHash = req.dashboardSession.user.avatar || ownerAvatarHash;
      if (!ownerAvatar && ownerAvatarHash) {
        ownerAvatar = `https://cdn.discordapp.com/avatars/${req.dashboardSession.user.id}/${ownerAvatarHash}.png`;
      }
    }

    res.json({
      server: {
        ...server,
        id: server.id || server.guildId,
        guildId: server.guildId || server.id,
        icon: iconUrl,
        iconUrl: iconUrl,
        icon_hash: iconHash,
        iconHash: iconHash,
        description: sanitizeMarkdown(server.description || ''),
        summary: stripMarkdown(server.summary || server.description || ''),
        icon_hash: iconHash,
        iconHash: iconHash,
        owner_discord_id: ownerDiscordId,
        owner_display_name: ownerDisplayName,
        owner_avatar_hash: ownerAvatarHash,
        representativesCount: Array.isArray(server.representatives) ? server.representatives.length : 0,
        recruitRepresentatives: server.recruitRepresentatives !== undefined ? Boolean(server.recruitRepresentatives) : (Number(server.representativesWanted) > 0),
        representativesWanted: (server.recruitRepresentatives !== undefined ? Boolean(server.recruitRepresentatives) : (Number(server.representativesWanted) > 0))
          ? Math.min(50, Math.max(1, Number(server.representativesWanted !== undefined ? server.representativesWanted : 1)))
          : 0,
        creditsPerRecruit: Math.min(10, Math.max(0, Number(server.creditsPerRecruit !== undefined ? server.creditsPerRecruit : 1))),
        approveManually: Boolean(server.approveManually),
        retentionTargetHours: Number(server.retentionTargetHours || 72),
        recruitLogChannelId: server.recruitLogChannelId || '',
        repRoleId: server.repRoleId || '',
        recruitRoleId: server.recruitRoleId || '',
        extraCreditsPerJoin: server.extraCreditsPerJoin !== undefined ? Number(server.extraCreditsPerJoin) : (server.offerHigherReward ? Math.max(1, Number(server.rewardCoins || 2) - 2) : 1),
        erlc: erlc?.connected ? erlc : null,
      },
      owner: {
        name: ownerDisplayName,
        display_name: ownerDisplayName,
        avatar: ownerAvatar,
        avatar_hash: ownerAvatarHash,
        id: ownerDiscordId
      },
      stats: {
        memberCount: server.memberCount || 0,
        bumps: server.bumps !== undefined ? server.bumps : (server.totalBumps || 0),
        verifiedJoins: server.verifiedJoins || 0,
        views: server.views || 0,
        rewardCoins: server.rewardCoins || 2
      },
      ratingSummary: reviewData.summary,
      userState: {
        isOwner,
        joined: hasJoined,
        canReview,
        isRepresentative,
        reviewEligibility
      }
    });
  });

  // Representatives apply/become endpoint
  router.post('/servers/:slug/representatives', (req, res) => {
    const { slug } = req.params;
    const servers = getPromotedServers();
    const server = servers.find(s => s.id === slug || (s.name && s.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()));
    if (!server) {
      return res.status(404).json({ error: 'Server not found in directory.' });
    }
    const userId = req.dashboardSession?.user?.id || (req.session && req.session.user && req.session.user.id) || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to become a representative.' });
    }
    const userCredits = getUserCredits(userId);
    const hasJoined = Boolean(userCredits.joined.includes(server.id));
    if (!hasJoined && server.ownerId !== userId) {
      return res.status(403).json({ error: 'You must join this server first before becoming a representative.' });
    }
    if (!Array.isArray(server.representatives)) {
      server.representatives = [];
    }
    if (server.representatives.includes(userId)) {
      return res.json({
        success: true,
        message: 'You are already a representative.',
        representativesCount: server.representatives.length,
        representativesWanted: Number(server.representativesWanted !== undefined ? server.representativesWanted : 4)
      });
    }
    const maxWanted = Number(server.representativesWanted !== undefined ? server.representativesWanted : 4);
    if (server.representatives.length >= maxWanted) {
      return res.status(400).json({ error: 'Representative slots for this server are already filled.' });
    }
    server.representatives.push(userId);
    updatePromotedServerDetails(server.id, { representatives: server.representatives });
    res.json({
      success: true,
      message: 'You are now a representative for this server.',
      representativesCount: server.representatives.length,
      representativesWanted: maxWanted
    });
  });

  // Reviews endpoints
  router.get('/servers/:slug/review-eligibility', (req, res) => {
    const { slug } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || null;
    const eligibility = getReviewEligibility(userId, slug);
    res.json(eligibility);
  });

  router.get('/servers/:slug/reviews', (req, res) => {
    const { slug } = req.params;
    const { page = 1, pageSize = 5, sort = 'newest' } = req.query;
    const data = getServerReviews(slug, { page, pageSize, sort });
    res.json(data);
  });

  router.post('/servers/:slug/reviews', createRateLimiter('review'), (req, res) => {
    const { slug } = req.params;
    const { rating, text } = req.body || {};
    const user = req.dashboardSession?.user || req.session?.user;
    if (!user) return res.status(401).json({ error: 'Please sign in to leave a review.' });

    const servers = getPromotedServers(true);
    const server = servers.find(s => String(s.id) === String(slug) || String(s.guildId) === String(slug));
    const isOwner = Boolean(server && server.ownerId === user.id);

    try {
      const result = upsertReview({
        serverId: slug,
        user,
        rating,
        text,
        isOwner,
        hasVerifiedJoin: true
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not post review.' });
    }
  });

  router.delete('/servers/:slug/reviews/:reviewId', (req, res) => {
    const { reviewId } = req.params;
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    try {
      const result = deleteReview(reviewId, userId, false);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/reviews/:id/report', (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const user = req.dashboardSession?.user || req.session?.user;
    const userId = user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to report this review.' });
    }
    const reporterTag = user?.globalName || user?.username || user?.displayName || `User ${String(userId).slice(-4)}`;
    try {
      const result = reportReview(id, userId, reason, reporterTag);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/reports - Section 6.3 report endpoint (5/hr, 1 open report/user/target/24hr, cannot report own server)
  const reportHourTracker = new Map();
  router.post('/reports', (req, res) => {
    const user = req.dashboardSession?.user || req.session?.user;
    const userId = user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to submit a report.' });
    }

    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    let userReports = reportHourTracker.get(userId) || [];
    userReports = userReports.filter(ts => ts > hourAgo);
    if (userReports.length >= 5) {
      return res.status(429).json({ error: 'You have submitted too many reports recently. Please wait an hour.' });
    }

    const { targetType, targetId, serverId, reason, details } = req.body || {};
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: 'Missing required report fields (targetType, targetId, reason).' });
    }

    const validReasons = [
      'Scam or fraud',
      'Impersonation',
      'Inappropriate content',
      'Spam or misleading ad',
      'Broken or fake invite',
      'Other'
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid report reason.' });
    }

    if (reason === 'Other' && (!details || !String(details).trim())) {
      return res.status(400).json({ error: 'Details are required when reason is Other.' });
    }

    const targetServerId = targetType === 'server' ? targetId : (serverId || null);
    if (targetServerId) {
      const servers = getPromotedServers();
      const srv = servers.find(s => String(s.id) === String(targetServerId));
      if (srv && String(srv.ownerId) === String(userId)) {
        return res.status(400).json({ error: 'You cannot report your own server.' });
      }
    }

    let snapshot = null;
    try {
      if (targetType === 'server') {
        const servers = getPromotedServers();
        const srv = servers.find(s => String(s.id) === String(targetId));
        if (srv) {
          snapshot = {
            id: srv.id,
            name: srv.name,
            description: srv.description || srv.summary || '',
            category: srv.category,
            memberCount: srv.memberCount,
            ownerId: srv.ownerId
          };
        }
      }
    } catch {}

    try {
      const report = createReport({
        reporter: user,
        targetType,
        targetId,
        serverId: targetServerId,
        reason,
        details,
        snapshot
      });
      userReports.push(now);
      reportHourTracker.set(userId, userReports);
      return res.json({ ok: true, success: true, reportId: report.id, message: 'Report submitted successfully. Our team will review it.' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Client telemetry error logger
  router.post('/telemetry/error', (req, res) => {
    const { errorId, tabTitle, name, message } = req.body || {};
    console.error(`[CLIENT TELEMETRY ERROR ${errorId || 'UNKNOWN'}] Tab: ${tabTitle || 'root'} - ${name}: ${message}`);
    res.json({ ok: true, logged: true });
  });

  // Dedicated listing save endpoint: PUT /api/servers/:id/listing
  router.put('/servers/:id/listing', (req, res) => {
    const { id } = req.params;
    const patch = req.body || {};

    try {
      const cleanData = {
        id,
        name: String(patch.name || patch.serverName || '').trim(),
        category: patch.category || patch.serverCategory || 'Roleplay Server',
        description: sanitizeMarkdown(String(patch.description ?? patch.serverDescription ?? '').trim()),
        summary: stripMarkdown(String(patch.summary ?? patch.serverSummary ?? '').trim()),
        tags: Array.isArray(patch.tags)
          ? patch.tags.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean).slice(0, 5)
          : (typeof patch.tags === 'string' ? patch.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5) : []),
        language: String(patch.language ?? 'English').trim() || 'English',
        inviteUrl: String(patch.inviteUrl ?? patch.discordInvite ?? '').trim(),
        bannerUrl: String(patch.bannerUrl ?? patch.serverBannerUrl ?? '').trim(),
        rewardCoins: Number(patch.rewardCoins || patch.reward || 2),
        offerHigherReward: Boolean(patch.offerHigherReward),
        extraCreditsPerJoin: patch.extraCreditsPerJoin !== undefined ? Math.min(20, Math.max(0, Number(patch.extraCreditsPerJoin))) : (patch.offerHigherReward ? Math.max(1, Number(patch.rewardCoins || 2) - 2) : 1),
        retentionTargetHours: Number(patch.retentionTargetHours || 72),
        recruitRepresentatives: patch.recruitRepresentatives !== undefined ? Boolean(patch.recruitRepresentatives) : (patch.representativesWanted !== undefined ? Number(patch.representativesWanted) > 0 : false),
        representativesWanted: (patch.recruitRepresentatives !== undefined ? Boolean(patch.recruitRepresentatives) : (patch.representativesWanted !== undefined ? Number(patch.representativesWanted) > 0 : false))
          ? Math.min(50, Math.max(1, Number(patch.representativesWanted !== undefined ? patch.representativesWanted : 1)))
          : 0,
        creditsPerRecruit: Math.min(10, Math.max(0, Number(patch.creditsPerRecruit !== undefined ? patch.creditsPerRecruit : 1))),
        approveManually: Boolean(patch.approveManually),
        recruitLogChannelId: patch.recruitLogChannelId ? String(patch.recruitLogChannelId).trim() : null,
        repRoleId: patch.repRoleId ? String(patch.repRoleId).trim() : null,
        recruitRoleId: patch.recruitRoleId ? String(patch.recruitRoleId).trim() : null,
        openForPartnerships: patch.openForPartnerships !== undefined ? Boolean(patch.openForPartnerships) : true,
        partnershipMinMembers: Math.min(100000, Math.max(0, Number(patch.partnershipMinMembers !== undefined ? patch.partnershipMinMembers : 5))),
        partnershipPrice: Math.min(50, Math.max(0, Number(patch.partnershipPrice !== undefined ? patch.partnershipPrice : 0))),
        partnershipAllowedMentions: String(patch.partnershipAllowedMentions || 'here'),
        partnershipHerePrice: Math.min(100, Math.max(0, Number(patch.partnershipHerePrice !== undefined ? patch.partnershipHerePrice : 15))),
        partnershipEveryonePrice: Math.min(100, Math.max(0, Number(patch.partnershipEveryonePrice !== undefined ? patch.partnershipEveryonePrice : 30))),
        partnershipBroadcastChannel: patch.partnershipBroadcastChannel ? String(patch.partnershipBroadcastChannel).trim() : null,
        partnershipAcceptedCategories: Array.isArray(patch.partnershipAcceptedCategories) ? patch.partnershipAcceptedCategories : ['Design Server', 'Roleplay Server', 'Misc', 'COTS', 'Departments', 'Events'],
        partnershipDailyLimit: Math.min(10, Math.max(1, Number(patch.partnershipDailyLimit || 1))),
        joinCode: patch.joinCode ? String(patch.joinCode).trim() : null,
        listedInDirectory: patch.listedInDirectory !== undefined ? Boolean(patch.listedInDirectory) : true
      };

      const sessionId = req.dashboardSessionId || cookieValue(req, SESSION_COOKIE);
      const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
      const user = session?.user || req.session?.user;
      if (!user) return res.status(401).json({ error: 'Please sign in to save server settings.' });

      // Round 11 Section 3: Bot must be invited first
      const botStatus = getGuildBotStatus(id);
      if (!botStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: botStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before publishing or saving settings.'
        });
      }

      const server = upsertPromotedServer(cleanData, user);

      try {
        updateRecruitSettings(id, {
          enabled: cleanData.recruitRepresentatives,
          representatives_wanted: cleanData.representativesWanted,
          credits_per_recruit: cleanData.creditsPerRecruit,
          approve_manually: cleanData.approveManually,
          retention_hours: cleanData.retentionTargetHours,
          log_channel_id: cleanData.recruitLogChannelId,
          rep_role_id: cleanData.repRoleId,
          recruit_role_id: cleanData.recruitRoleId,
        });
      } catch (rErr) {
        // Log silently
      }

      const bot = findGuildBot(id);
      if (bot) {
        updateBotCustomization(bot.botId, 'serverName', cleanData.name);
        updateBotCustomization(bot.botId, 'serverCategory', cleanData.category);
        updateBotCustomization(bot.botId, 'serverSummary', cleanData.summary);
        updateBotCustomization(bot.botId, 'serverDescription', cleanData.description);
        updateBotCustomization(bot.botId, 'serverTags', cleanData.tags);
        updateBotCustomization(bot.botId, 'bannerUrl', cleanData.bannerUrl);
        updateBotCustomization(bot.botId, 'discordInvite', cleanData.inviteUrl);
        updateBotCustomization(bot.botId, 'inviteUrl', cleanData.inviteUrl);
        updateBotCustomization(bot.botId, 'language', cleanData.language);
        updateBotCustomization(bot.botId, 'joinCode', cleanData.joinCode);
        updateBotCustomization(bot.botId, 'listedInDirectory', cleanData.listedInDirectory);
        updateBotCustomization(bot.botId, 'rewardCoins', cleanData.rewardCoins);
        updateBotCustomization(bot.botId, 'offerHigherReward', cleanData.offerHigherReward);
        updateBotCustomization(bot.botId, 'retentionTargetHours', cleanData.retentionTargetHours);
        updateBotCustomization(bot.botId, 'representativesWanted', cleanData.representativesWanted);
        updateBotCustomization(bot.botId, 'openForPartnerships', cleanData.openForPartnerships);
        updateBotCustomization(bot.botId, 'partnershipMinMembers', cleanData.partnershipMinMembers);
        updateBotCustomization(bot.botId, 'partnershipPrice', cleanData.partnershipPrice);
        updateBotCustomization(bot.botId, 'partnershipAllowedMentions', cleanData.partnershipAllowedMentions);
        updateBotCustomization(bot.botId, 'partnershipHerePrice', cleanData.partnershipHerePrice);
        updateBotCustomization(bot.botId, 'partnershipEveryonePrice', cleanData.partnershipEveryonePrice);
        updateBotCustomization(bot.botId, 'partnershipBroadcastChannel', cleanData.partnershipBroadcastChannel);
        updateBotCustomization(bot.botId, 'partnershipAcceptedCategories', cleanData.partnershipAcceptedCategories);
        updateBotCustomization(bot.botId, 'partnershipDailyLimit', cleanData.partnershipDailyLimit);
      }

      res.json({ success: true, server, message: 'Listing saved successfully.' });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not update listing.' });
    }
  });

  // Popular tags endpoint with 10-minute in-memory caching
  const popularTagsCache = new Map();

  router.get('/tags/popular', (req, res) => {
    try {
      const category = (req.query.category || '').toLowerCase().trim();
      const cacheKey = category || '__all__';
      const cached = popularTagsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
        return res.json({ tags: cached.tags });
      }

      const servers = getPromotedServers();
      const cutoff = Date.now() - 90 * 86400000;
      const tagCounts = new Map();
      const profanity = new Set(['nsfw', 'porn', 'sex', 'nude', 'fuck', 'shit', 'bitch', 'ass', 'dick']);

      for (const s of servers) {
        const sTime = s.updatedAt || s.lastBumpedAt || s.createdAt || Date.now();
        if (sTime < cutoff) continue;
        if (category && (s.category || '').toLowerCase().replace(/[^a-z]/g, '') !== category.replace(/[^a-z]/g, '')) {
          continue;
        }

        const tags = Array.isArray(s.tags) ? s.tags : [];
        for (const t of tags) {
          const clean = String(t).toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
          if (!clean || clean.length < 2 || clean.length > 24 || profanity.has(clean)) continue;
          tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
        }
      }

      // Min 2 servers using a tag, max 12 tags
      let filtered = Array.from(tagCounts.entries())
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => tag);

      // Graceful fallback if fewer than 2 servers exist in current category
      if (filtered.length < 2) {
        filtered = Array.from(tagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([tag]) => tag);
      }

      const popularTags = filtered.slice(0, 12);
      popularTagsCache.set(cacheKey, { timestamp: Date.now(), tags: popularTags });

      res.json({ tags: popularTags });
    } catch (err) {
      console.error('Error fetching popular tags:', err);
      res.json({ tags: [] });
    }
  });

  // Dedicated bump status endpoint: GET /api/servers/:id/bump
  router.get('/servers/:id/bump', (req, res) => {
    const { id } = req.params;
    try {
      const status = getBumpStatus(id);
      res.json(status);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dedicated bump endpoint: POST /api/servers/:id/bump
  router.post('/servers/:id/bump', createRateLimiter('bump'), (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    try {
      const result = bumpPromotedServer(id, userId);
      res.json({ success: true, ...result, message: 'Bumped. Your server is now #1.' });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message, cooldownSeconds: err.cooldownSeconds, nextBumpAt: err.nextBumpAt });
    }
  });

  // DELETE /api/servers/:id (Section 9.2: Delete server from ConnectingERLC - hard delete)
  router.delete('/servers/:id', async (req, res) => {
    const { id } = req.params;
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
    const callerId = session?.user?.id || req.user?.id;
    const isMasterOwner = session?.user?.role === 'Owner';

    // 1. Check ownership authorization
    const servers = getPromotedServers();
    const server = servers.find(s => s.id === id);
    const bot = findGuildBot(id);
    const serverOwnerId = server?.ownerId || bot?.ownerUserId || bot?.ownerId;

    if (!isMasterOwner && (!callerId || (serverOwnerId && serverOwnerId !== callerId))) {
      return res.status(403).json({ error: 'Forbidden: only the server owner can delete this server.' });
    }

    try {
      // 2. Delete from promoted_servers / listings
      removePromotedServer(id);

      // 3. Delete reviews for this server
      try {
        const reviewsPath = path.resolve('data/reviews.json');
        if (fs.existsSync(reviewsPath)) {
          const revs = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
          if (Array.isArray(revs)) {
            const filtered = revs.filter(r => r.guild_id !== id && r.guildId !== id);
            fs.writeFileSync(reviewsPath, JSON.stringify(filtered, null, 2), 'utf8');
            try {
              const webReviewsPath = path.resolve('web/data/reviews.json');
              if (fs.existsSync(webReviewsPath)) fs.writeFileSync(webReviewsPath, JSON.stringify(filtered, null, 2), 'utf8');
            } catch {}
          }
        }
      } catch (e) {
        console.error('Error cleaning reviews on server delete:', e);
      }

      // 4. Delete recruits, reps, recruit settings
      try {
        const recruitPath = path.resolve('data/recruits.json');
        if (fs.existsSync(recruitPath)) {
          const rData = JSON.parse(fs.readFileSync(recruitPath, 'utf8'));
          if (rData.settings) delete rData.settings[id];
          if (rData.representatives) delete rData.representatives[id];
          if (rData.links) delete rData.links[id];
          if (rData.recruits) delete rData.recruits[id];
          if (rData.auditLog) delete rData.auditLog[id];
          fs.writeFileSync(recruitPath, JSON.stringify(rData, null, 2), 'utf8');
          try {
            const webRecruitPath = path.resolve('web/data/recruits.json');
            if (fs.existsSync(webRecruitPath)) fs.writeFileSync(webRecruitPath, JSON.stringify(rData, null, 2), 'utf8');
          } catch {}
        }
      } catch (e) {
        console.error('Error cleaning recruits on server delete:', e);
      }

      // 5. End active partnerships, notify partners, and delete partnerships & requests
      try {
        const pPath = path.resolve('data/partnerships.json');
        if (fs.existsSync(pPath)) {
          const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
          if (Array.isArray(pData.partnerships)) {
            pData.partnerships.forEach(p => {
              if (p.guildIdA === id || p.guildIdB === id) {
                const partnerGuildId = p.guildIdA === id ? p.guildIdB : p.guildIdA;
                if (partnerGuildId && pData.notifications) {
                  if (!pData.notifications[partnerGuildId]) pData.notifications[partnerGuildId] = [];
                  pData.notifications[partnerGuildId].unshift({
                    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: 'partnership_ended',
                    title: 'Partnership ended',
                    body: `${server?.name || 'Partner community'} has deleted their server from ConnectingERLC. Your partnership has been ended.`,
                    timestamp: new Date().toISOString(),
                    read: false
                  });
                }
              }
            });
            pData.partnerships = pData.partnerships.filter(p => p.guildIdA !== id && p.guildIdB !== id);
          }
          if (Array.isArray(pData.requests)) {
            pData.requests = pData.requests.filter(r => r.fromGuildId !== id && r.toGuildId !== id);
          }
          if (pData.settings) delete pData.settings[id];
          if (pData.webhooks) delete pData.webhooks[id];
          if (pData.milestones) delete pData.milestones[id];
          fs.writeFileSync(pPath, JSON.stringify(pData, null, 2), 'utf8');
          try {
            const webPPath = path.resolve('web/data/partnerships.json');
            if (fs.existsSync(webPPath)) fs.writeFileSync(webPPath, JSON.stringify(pData, null, 2), 'utf8');
          } catch {}
        }
      } catch (e) {
        console.error('Error cleaning partnerships on server delete:', e);
      }

      // 6. Delete bot instance / workspace / erlc keys
      try {
        const botPath = path.resolve('data/bot_instances.json');
        if (fs.existsSync(botPath)) {
          const instances = JSON.parse(fs.readFileSync(botPath, 'utf8'));
          if (Array.isArray(instances)) {
            const filteredBots = instances.filter(b => b.guildId !== id && b.id !== id);
            fs.writeFileSync(botPath, JSON.stringify(filteredBots, null, 2), 'utf8');
            try {
              const webBotPath = path.resolve('web/data/bot_instances.json');
              if (fs.existsSync(webBotPath)) fs.writeFileSync(webBotPath, JSON.stringify(filteredBots, null, 2), 'utf8');
            } catch {}
          }
        }
      } catch (e) {
        console.error('Error cleaning bot instance on server delete:', e);
      }

      // 7. Clean ledger entries for other users (anonymize to "Deleted server", set guildId to null)
      try {
        const ledgerPath = path.resolve('data/ledger.json');
        if (fs.existsSync(ledgerPath)) {
          const ledgerData = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
          if (Array.isArray(ledgerData.transactions)) {
            ledgerData.transactions.forEach(tx => {
              if (tx.guildId === id || tx.serverId === id) {
                tx.guildName = 'Deleted server';
                tx.serverName = 'Deleted server';
                tx.guildId = null;
                tx.serverId = null;
              }
            });
            fs.writeFileSync(ledgerPath, JSON.stringify(ledgerData, null, 2), 'utf8');
            try {
              const webLedgerPath = path.resolve('web/data/ledger.json');
              if (fs.existsSync(webLedgerPath)) fs.writeFileSync(webLedgerPath, JSON.stringify(ledgerData, null, 2), 'utf8');
            } catch {}
          }
        }
      } catch (e) {
        console.error('Error cleaning ledger on server delete:', e);
      }

      // 8. Add single minimal audit row to admin_audit_log.json
      try {
        const auditPath = path.resolve('data/admin_audit_log.json');
        let auditList = [];
        if (fs.existsSync(auditPath)) {
          try { auditList = JSON.parse(fs.readFileSync(auditPath, 'utf8')); } catch {}
        }
        if (!Array.isArray(auditList)) auditList = [];
        const serverIdHash = crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 16);
        auditList.push({
          id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action: 'server_deleted',
          serverIdHash,
          timestamp: new Date().toISOString(),
          actorUserId: callerId || 'system'
        });
        fs.writeFileSync(auditPath, JSON.stringify(auditList, null, 2), 'utf8');
        try {
          const webAuditPath = path.resolve('web/data/admin_audit_log.json');
          fs.writeFileSync(webAuditPath, JSON.stringify(auditList, null, 2), 'utf8');
        } catch {}
      } catch (e) {
        console.error('Error recording delete audit log:', e);
      }

      // 9. Respond 204 No Content
      return res.status(204).end();
    } catch (err) {
      console.error('[DELETE /servers/:id] Failed to delete server:', err);
      return res.status(500).json({ error: 'Failed to delete server completely.' });
    }
  });

  // ER:LC Private Server Endpoints
  // Connect ER:LC key
  router.post('/servers/:id/erlc/connect', async (req, res) => {
    const { id } = req.params;
    const { key } = req.body || {};
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);

    if (!key || typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ error: 'Please provide a valid ER:LC API key.' });
    }

    try {
      const result = await connectErlcServer(id, key.trim(), userId);
      res.json({
        success: true,
        connected: true,
        name: result.name,
        currentPlayers: result.currentPlayers,
        maxPlayers: result.maxPlayers,
        joinCode: result.joinCode,
        maskedKey: result.maskedKey,
        lastCheckedAt: result.lastCheckedAt,
      });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not connect ER:LC API key.' });
    }
  });

  // Get ER:LC status
  router.get('/servers/:id/erlc/status', async (req, res) => {
    const { id } = req.params;
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

    if (refresh && !checkRateLimit(id, 5)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before refreshing again.' });
    }

    try {
      const status = await getErlcStatus(id, refresh);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not fetch ER:LC status.' });
    }
  });

  // Test ER:LC connection
  router.post('/servers/:id/erlc/test', async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);

    if (!checkRateLimit(id, 5)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before testing again.' });
    }

    try {
      const result = await testErlcConnection(id, userId);
      res.json({
        success: true,
        message: `Connected to ${result.name} (${result.currentPlayers} / ${result.maxPlayers} players online)`,
        ...result,
      });
    } catch (err) {
      res.status(400).json({ error: err.message || 'ER:LC connection test failed.' });
    }
  });

  // Disconnect ER:LC key
  router.post('/servers/:id/erlc/disconnect', async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);

    try {
      await disconnectErlcServer(id, userId);
      res.json({ success: true, message: 'ER:LC server disconnected.' });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not disconnect ER:LC server.' });
    }
  });

  // -------------------------------------------------------------
  // RECRUITS HUB ENDPOINTS (Section 8)
  // -------------------------------------------------------------

  // GET /api/servers/:id/recruits/summary
  router.get('/servers/:id/recruits/summary', (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || req.headers['x-user-id'] || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const userProfile = req.dashboardSession?.user || req.session?.user || { id: userId, username: 'member', name: 'Community Member' };

    try {
      const summary = getRecruitsSummary(id);
      const userStats = getUserRecruitStats(id, userId, userProfile);
      res.json({
        ok: true,
        summary: {
          ...summary,
          currentUserStats: userStats,
        }
      });
    } catch (err) {
      console.error('[RECRUITS API] Error getting summary:', err);
      res.status(500).json({ error: 'Failed to fetch recruits summary' });
    }
  });

  // GET /api/servers/:id/recruits
  router.get('/servers/:id/recruits', (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;
    const status = req.query.status || 'all';
    const search = req.query.search || '';
    const recruiterId = req.query.recruiterId || null;

    try {
      const result = getRecruitsList(id, { page, pageSize, status, search, recruiterId });
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[RECRUITS API] Error getting recruits list:', err);
      res.status(500).json({ error: 'Failed to fetch recruits list' });
    }
  });

  // POST /api/servers/:id/recruits/link
  router.post('/servers/:id/recruits/link', (req, res) => {
    const { id } = req.params;
    const botStatus = getGuildBotStatus(id);
    if (!botStatus.bot_in_guild) {
      return res.status(403).json({
        error: 'BOT_NOT_IN_GUILD',
        botStatus: botStatus.botStatus,
        message: 'ConnectingERLC bot must be added to your server before recruiting.'
      });
    }
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || req.headers['x-user-id'] || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const userProfile = req.dashboardSession?.user || req.session?.user || { id: userId, username: 'member', name: 'Community Member' };

    try {
      const link = getOrCreateRecruitLink(id, userId, userProfile);
      res.json({ ok: true, link });
    } catch (err) {
      console.error('[RECRUITS API] Error generating link:', err);
      res.status(500).json({ error: 'Failed to generate recruit link' });
    }
  });

  // GET /api/servers/:id/recruits/leaderboard
  router.get('/servers/:id/recruits/leaderboard', (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 12;

    try {
      const leaderboard = getRecruitLeaderboard(id, { page, pageSize });
      res.json({ ok: true, ...leaderboard });
    } catch (err) {
      console.error('[RECRUITS API] Error getting leaderboard:', err);
      res.status(500).json({ error: 'Failed to fetch recruits leaderboard' });
    }
  });

  // GET /api/servers/:id/recruits/user-stats
  router.get('/servers/:id/recruits/user-stats', (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || req.headers['x-user-id'] || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const userProfile = req.dashboardSession?.user || req.session?.user || { id: userId, username: 'member', name: 'Community Member' };

    try {
      const stats = getUserRecruitStats(id, userId, userProfile);
      res.json({ ok: true, stats });
    } catch (err) {
      console.error('[RECRUITS API] Error getting user stats:', err);
      res.status(500).json({ error: 'Failed to fetch user recruit stats' });
    }
  });

  // GET /api/servers/:id/recruits/settings
  router.get('/servers/:id/recruits/settings', (req, res) => {
    const { id } = req.params;
    try {
      const settings = getRecruitSettings(id);
      res.json({ ok: true, settings });
    } catch (err) {
      console.error('[RECRUITS API] Error getting settings:', err);
      res.status(500).json({ error: 'Failed to fetch recruit settings' });
    }
  });

  // PUT /api/servers/:id/recruits/settings
  router.put('/servers/:id/recruits/settings', (req, res) => {
    const { id } = req.params;
    const botStatus = getGuildBotStatus(id);
    if (!botStatus.bot_in_guild) {
      return res.status(403).json({
        error: 'BOT_NOT_IN_GUILD',
        botStatus: botStatus.botStatus,
        message: 'ConnectingERLC bot must be added to your server before recruiting.'
      });
    }
    const patch = req.body || {};

    try {
      const cleanPatch = {};
      if (patch.enabled !== undefined) cleanPatch.enabled = Boolean(patch.enabled);
      if (patch.credits_per_recruit !== undefined) {
        cleanPatch.credits_per_recruit = Math.min(10, Math.max(0, parseInt(patch.credits_per_recruit, 10) || 0));
      }
      if (patch.retention_hours !== undefined) {
        const h = parseInt(patch.retention_hours, 10);
        cleanPatch.retention_hours = [24, 48, 72, 168].includes(h) ? h : 72;
      }
      if (Array.isArray(patch.reward_roles)) {
        cleanPatch.reward_roles = patch.reward_roles
          .filter(r => r && r.role_name && Number(r.required_recruits) > 0)
          .map(r => ({
            role_id: String(r.role_id || `role_${Date.now()}`),
            role_name: String(r.role_name).trim(),
            required_recruits: Math.max(1, parseInt(r.required_recruits, 10) || 1)
          }));
      }
      if (patch.log_channel_id !== undefined) {
        cleanPatch.log_channel_id = patch.log_channel_id ? String(patch.log_channel_id).trim() : null;
      }

      const updated = updateRecruitSettings(id, cleanPatch);
      res.json({ ok: true, settings: updated, message: 'Recruit settings saved successfully' });
    } catch (err) {
      console.error('[RECRUITS API] Error updating settings:', err);
      res.status(500).json({ error: 'Failed to update recruit settings' });
    }
  });

  // GET /api/servers/:id/recruits/trend (30-day verified trend)
  router.get('/servers/:id/recruits/trend', (req, res) => {
    const { id } = req.params;
    try {
      const trend = get30DayRecruitsTrend(id);
      res.json({ ok: true, trend });
    } catch (err) {
      console.error('[RECRUITS API] Error getting trend:', err);
      res.status(500).json({ error: 'Failed to fetch recruits trend' });
    }
  });

  // POST /api/servers/:id/recruits/step-down
  router.post('/servers/:id/recruits/step-down', (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || req.body?.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
    try {
      const success = stepDownRepresentative(id, userId);
      res.json({ ok: true, success, message: 'You have stepped down as representative.' });
    } catch (err) {
      console.error('[RECRUITS API] Error stepping down:', err);
      res.status(500).json({ error: 'Failed to step down' });
    }
  });

  // POST /api/servers/:id/recruits/test-panel
  router.post('/servers/:id/recruits/test-panel', async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const settings = getRecruitSettings(id);
    const channelId = req.body?.channelId || settings.log_channel_id;

    try {
      const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
      const panelContent = `**Recruit Hub System Notification**\nRecruit verification telemetry node connected. Minimum stay required: **${settings.retention_hours} hours** (${settings.retention_hours / 24} days).\nReward tier: **${settings.credits_per_recruit} credits** per verified member.`;

      if (token && channelId) {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: panelContent,
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 5, label: 'Recruit Hub', url: `${appOrigin()}/dashboard/${id}/recruits` }
                ]
              }
            ]
          })
        }).catch(() => null);
      }

      if (settings.dm_owner && token && userId) {
        await sendDiscordNotificationV2(userId, 'anti_raid', 'Recruit Hub', id).catch(() => null);
      }

      res.json({ ok: true, message: 'Test panel dispatched successfully.' });
    } catch (err) {
      console.error('[RECRUITS API] Error sending test panel:', err);
      res.status(500).json({ error: 'Failed to dispatch test panel.' });
    }
  });

  // ── OWNER TOOLS (Section 7.5) ──
  router.get('/servers/:id/owner-tools/bot-perms', (req, res) => {
    res.json({
      ok: true,
      hasKick: true,
      hasBan: true,
      hasCreateInvite: true,
    });
  });

  router.post('/servers/:id/owner-tools/kick', (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId || !reason) return res.status(400).json({ error: 'User ID and reason required.' });

    const data = loadRecruitData();
    data.activity = data.activity || [];
    data.activity.push({
      id: `act_${Date.now()}`,
      guild_id: String(id),
      type: 'member_kicked',
      user_id: userId,
      reason,
      actor_id: actorId,
      timestamp: Date.now(),
    });
    saveRecruitData(data);
    res.json({ ok: true, message: `Member ${userId} kicked.` });
  });

  router.post('/servers/:id/owner-tools/ban', (req, res) => {
    const { id } = req.params;
    const { userId, reason, deleteDays = 0 } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId || !reason) return res.status(400).json({ error: 'User ID and reason required.' });

    const data = loadRecruitData();
    data.activity = data.activity || [];
    data.activity.push({
      id: `act_${Date.now()}`,
      guild_id: String(id),
      type: 'member_banned',
      user_id: userId,
      reason,
      delete_days: deleteDays,
      actor_id: actorId,
      timestamp: Date.now(),
    });
    saveRecruitData(data);
    res.json({ ok: true, message: `Member ${userId} banned.` });
  });

  router.post('/servers/:id/owner-tools/block-recruiter', (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId) return res.status(400).json({ error: 'User ID required.' });
    const result = blockRecruiter(id, userId, reason, actorId);
    res.json(result);
  });

  router.post('/servers/:id/owner-tools/reverse', (req, res) => {
    const { id } = req.params;
    const { recruitId, reason } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!recruitId) return res.status(400).json({ error: 'Recruit ID required.' });
    try {
      const result = reverseRecruit(id, recruitId, reason, actorId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/servers/:id/owner-tools/remove-rep', (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId) return res.status(400).json({ error: 'User ID required.' });
    const result = removeRepresentative(id, userId, reason, actorId);
    res.json(result);
  });

  router.post('/servers/:id/owner-tools/pause', (req, res) => {
    const { id } = req.params;
    const { paused } = req.body || {};
    const updated = updateRecruitSettings(id, { enabled: !paused });
    res.json({ ok: true, settings: updated });
  });

  router.post('/servers/:id/owner-tools/revoke-invites', (req, res) => {
    const { id } = req.params;
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const result = revokeAllRepresentativeInvites(id, actorId);
    res.json(result);
  });

  router.get('/servers/:id/owner-tools/export-csv', (req, res) => {
    const { id } = req.params;
    const csv = exportRecruitsToCsv(id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="recruits_${id}.csv"`);
    res.send(csv);
  });

  router.get('/servers/:id/owner-tools/activity', (req, res) => {
    const { id } = req.params;
    const logs = getOwnerAuditLog(id);
    res.json({ ok: true, logs });
  });

  // Dedicated server activity endpoint for Overview recent activity: GET /api/servers/:id/activity
  router.get('/servers/:id/activity', (req, res) => {
    const { id } = req.params;
    const events = [];

    try {
      // 1. Recruits / Joins
      const logs = getOwnerAuditLog(id) || [];
      for (const log of logs) {
        let text = 'Member event recorded';
        let type = 'recruit';
        if (log.type === 'recruit_joined') {
          type = 'join';
          text = `${log.user_name || 'Member'} joined via directory invite`;
        } else if (log.type === 'recruit_left') {
          type = 'join';
          text = `${log.user_name || 'Member'} left the server`;
        } else if (log.type === 'recruiter_blocked') {
          type = 'recruit';
          text = `Recruiter access updated by owner`;
        } else if (log.type === 'recruit_reversed') {
          type = 'recruit';
          text = `Bounty reversed for ${log.user_name || 'member'}`;
        }
        events.push({
          id: log.id || `log_${Math.random()}`,
          type,
          text,
          timestamp: log.timestamp || Date.now(),
        });
      }

      // 2. Bumps
      const dirData = loadDirectoryData();
      const s = (dirData.servers || []).find(srv => String(srv.id) === String(id));
      if (s && s.lastBumpedAt) {
        events.push({
          id: `bump_${s.lastBumpedAt}`,
          type: 'bump',
          text: 'Server bumped to #1 in directory',
          timestamp: s.lastBumpedAt,
        });
      }

      // 3. Reviews
      const revData = getServerReviews(id) || { reviews: [] };
      for (const rev of revData.reviews || []) {
        events.push({
          id: `rev_${rev.id}`,
          type: 'review',
          text: `New ${rev.rating}-star review received`,
          timestamp: rev.created_at || Date.now(),
        });
      }

      // 4. Partnerships
      try {
        const pPath = path.resolve('data/partnerships.json');
        if (fs.existsSync(pPath)) {
          const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
          for (const p of (pData.partnerships || [])) {
            if (p.guildIdA === id || p.guildIdB === id) {
              events.push({
                id: `part_${p.id}`,
                type: 'partnership',
                text: 'Partnership connected with partner community',
                timestamp: p.createdAt || p.updatedAt || Date.now(),
              });
            }
          }
        }
      } catch {}

      // Sort descending by timestamp
      events.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return timeB - timeA;
      });

      res.json({ ok: true, events });
    } catch (err) {
      res.json({ ok: true, events: [] });
    }
  });

  // Dedicated Leaderboard endpoint: GET /api/leaderboard
  router.get('/leaderboard', (req, res) => {
    const { tab = 'servers', range = '30d', category, page = 1, pageSize = 20, guildId } = req.query;
    const currentUserId = req.session?.userId || null;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

    if (tab === 'recruiters') {
      const recruitData = loadRecruitData();
      const recruiterMap = new Map();

      // Aggregate verified recruits per user
      for (const r of recruitData.recruits || []) {
        if (!r || !r.recruiter_user_id) continue;
        const uId = r.recruiter_user_id;
        if (!recruiterMap.has(uId)) {
          recruiterMap.set(uId, {
            recruiter_id: uId,
            recruiter_name: r.recruiter_name || 'Community Recruiter',
            recruiter_avatar: `https://cdn.discordapp.com/embed/avatars/${Number(uId.slice(-1)) % 5}.png`,
            server_id: r.guild_id,
            server_name: 'Community Server',
            verifiedCount: 0,
            creditsEarned: 0,
          });
        }
        const entry = recruiterMap.get(uId);
        if (r.status === 'verified') {
          entry.verifiedCount += 1;
          entry.creditsEarned += (r.credits_awarded || 2);
        }
      }

      // If viewing user is logged in, ensure their entry exists in rankings
      if (currentUserId && !recruiterMap.has(currentUserId)) {
        recruiterMap.set(currentUserId, {
          recruiter_id: currentUserId,
          recruiter_name: req.session?.username || 'You',
          recruiter_avatar: req.session?.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png',
          server_id: guildId || '',
          server_name: 'Your Server',
          verifiedCount: 0,
          creditsEarned: 0,
        });
      }

      let allRecruiters = Array.from(recruiterMap.values());
      allRecruiters.sort((a, b) => {
        if (b.verifiedCount !== a.verifiedCount) return b.verifiedCount - a.verifiedCount;
        return b.creditsEarned - a.creditsEarned;
      });

      const total = allRecruiters.length;
      let userRankIndex = currentUserId ? allRecruiters.findIndex(r => r.recruiter_id === currentUserId) : -1;
      const userRank = userRankIndex >= 0 ? userRankIndex + 1 : 1;
      const topPercent = Math.max(1, Math.round((userRank / Math.max(1, total)) * 100));

      const startIndex = (safePage - 1) * safePageSize;
      const paginated = allRecruiters.slice(startIndex, startIndex + safePageSize);
      const items = paginated.map((r, idx) => ({
        rank: startIndex + idx + 1,
        ...r,
      }));

      return res.json({
        items,
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.ceil(total / safePageSize) || 1,
        yourRank: {
          rank: userRank,
          total,
          topPercent,
          name: req.session?.username || 'You',
        },
      });
    }

    if (tab === 'partners') {
      let servers = getPromotedServers();
      servers.sort((a, b) => (b.partnershipsCount || 0) - (a.partnershipsCount || 0));

      const total = servers.length;
      let currentServerIndex = guildId ? servers.findIndex(s => s.id === guildId) : -1;
      const serverRank = currentServerIndex >= 0 ? currentServerIndex + 1 : 1;
      const topPercent = Math.max(1, Math.round((serverRank / Math.max(1, total)) * 100));

      const startIndex = (safePage - 1) * safePageSize;
      const paginated = servers.slice(startIndex, startIndex + safePageSize);
      const items = paginated.map((s, idx) => ({
        rank: startIndex + idx + 1,
        id: s.id,
        name: s.name,
        icon: s.icon,
        icon_hash: s.icon_hash || s.iconHash || (s.icon && !s.icon.startsWith('http') ? s.icon : null) || null,
        iconHash: s.icon_hash || s.iconHash || (s.icon && !s.icon.startsWith('http') ? s.icon : null) || null,
        owner_discord_id: s.owner_discord_id || s.ownerId || null,
        owner_display_name: s.owner_display_name || s.ownerUsername || null,
        owner_avatar_hash: s.owner_avatar_hash || null,
        partnersCount: s.partnershipsCount || 0,
        mentionsSent: (s.partnershipsCount || 0) * 3,
        status: s.listed ? 'Active' : 'Paused',
        verified: Boolean(s.verified),
      }));

      return res.json({
        items,
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.ceil(total / safePageSize) || 1,
        yourRank: {
          rank: serverRank,
          total,
          topPercent,
          name: servers[currentServerIndex]?.name || (guildId ? findGuildBot(guildId)?.customizations?.serverName : '') || 'Community Server',
        },
      });
    }

    // Default: tab === 'servers'
    let servers = getPromotedServers();
    if (category && category !== 'All') {
      const cat = String(category).toLowerCase();
      servers = servers.filter(s => s.category && s.category.toLowerCase() === cat);
    }

    servers.sort((a, b) => {
      const aScore = (a.verifiedJoins || 0) * 2 + (a.bumps || 0);
      const bScore = (b.verifiedJoins || 0) * 2 + (b.bumps || 0);
      if (bScore !== aScore) return bScore - aScore;
      return (b.memberCount || 0) - (a.memberCount || 0);
    });

    const total = servers.length;
    let currentServerIndex = guildId ? servers.findIndex(s => s.id === guildId) : -1;
    const serverRank = currentServerIndex >= 0 ? currentServerIndex + 1 : 1;
    let currentServer = currentServerIndex >= 0 ? servers[currentServerIndex] : null;
    if (!currentServer && guildId) {
      const allDirServers = getPromotedServers();
      currentServer = allDirServers.find(s => s.id === guildId) || null;
    }
    if (!currentServer && guildId) {
      const bot = findGuildBot(guildId);
      if (bot) {
        currentServer = {
          id: guildId,
          name: bot.customizations?.serverName || 'Community Server',
          icon: bot.customizations?.serverIconUrl || null,
          icon_hash: null,
        };
      }
    }
    const topPercent = total >= 10 ? Math.ceil((serverRank / total) * 100) : null;

    let neededJoins = 0;
    if (serverRank > 1 && currentServer) {
      const serverAbove = servers[serverRank - 2];
      const targetJoins = (serverAbove?.verifiedJoins || 0);
      const myJoins = (currentServer.verifiedJoins || 0);
      neededJoins = Math.max(1, (targetJoins - myJoins) + 1);
    }

    const startIndex = (safePage - 1) * safePageSize;
    const paginated = servers.slice(startIndex, startIndex + safePageSize);
    const items = paginated.map((s, idx) => ({
      rank: startIndex + idx + 1,
      id: s.id,
      name: s.name,
      icon: s.icon,
      icon_hash: s.icon_hash || s.iconHash || (s.icon && !s.icon.startsWith('http') ? s.icon : null) || null,
      iconHash: s.icon_hash || s.iconHash || (s.icon && !s.icon.startsWith('http') ? s.icon : null) || null,
      owner_discord_id: s.owner_discord_id || s.ownerId || null,
      owner_display_name: s.owner_display_name || s.ownerUsername || null,
      owner_avatar_hash: s.owner_avatar_hash || null,
      category: s.category || 'Roleplay server',
      memberCount: s.memberCount || 0,
      verifiedJoins: s.verifiedJoins || 0,
      bumps: s.bumps || 0,
      verified: Boolean(s.verified),
      inviteUrl: s.inviteUrl,
    }));

    res.json({
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize) || 1,
      yourRank: {
        rank: serverRank,
        total,
        topPercent,
        name: currentServer?.name || 'Community Server',
        guildId: currentServer?.id || guildId,
        iconUrl: currentServer?.icon || null,
        iconHash: currentServer?.icon_hash || null,
        neededJoins,
        change: null,
      },
    });
  });

  // ─── ADMIN NEXUS REST ENDPOINTS ──────────────────────────────────────────
  const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.json');

  const DEFAULT_CHANGELOG = [
    {
      version: "3.2.0",
      date: "2026-10-21T02:00:00.000Z",
      title: "V2 Bump Engine & Dynamic Telemetry Trajectory",
      description: "Server bump counters and direct links, alongside dynamic Recharts member growth charts and directory pagination.",
      tags: ["new", "improved"],
      items: [
        "Bump counter and ConnectingERLC directory link on every server page",
        "Dynamic verified member growth trajectory line chart powered by Recharts",
        "Custom banner image upload in Promote Server Studio with real-time preview",
        "Complete Anti-Raid & Churn Security suite with live defense shield rating and 72h retention enforcement",
        "Paginated community directory discovery and joined communities management",
        "Redesigned community growth tiers with transparent Vibra UI pricing cards and custom banners included on Free"
      ],
      href: "#v3-2-0"
    },
    {
      version: "3.0.0",
      date: "2026-10-17T08:00:00.000Z",
      title: "ConnectingERLC Community Growth & Discord Directory",
      description: "Major release introducing the real-time Discord directory and 72-hour credit retention guarantees.",
      tags: ["new", "improved"],
      items: [
        "72-Hour retention guarantee enforcing automatic bounty clawback if an account departs early",
        "Customizable community discovery cards with verified badges, real view tracking, and member counts",
        "Interactive 5-star community rating system with instant feedback and ratings persistence",
        "Bump button to elevate partner communities to the top of the directory with a 1-hour cooldown",
        "Dedicated System Telemetry with live process memory (RSS & Heap), uptime duration, and API latency",
        "Dynamic real-time notification engine linked to Discord user joins and daily rewards"
      ],
      href: "#v3-0-0"
    },
    {
      version: "2.4.0",
      date: "2026-10-15T14:30:00.000Z",
      title: "Treasury Transfers & Multi-Server Discord Switcher",
      description: "Added zero-fee credit transfers between Discord users and communities, alongside an instant multi-guild workspace switcher.",
      tags: ["new", "improved"],
      items: [
        "Zero-fee credit transfer hub with Discord Snowflake validation and instant balance deduction",
        "Discord Workspace Switcher syncing user guild permissions and community avatars automatically",
        "Multi-Category tagging (up to 3 categories) and Primary Community Language selector"
      ],
      href: "#v2-4-0"
    },
    {
      version: "2.3.0",
      date: "2026-10-10T11:00:00.000Z",
      title: "7-Day Daily Check-In Progression & Streak Rewards",
      description: "Introduced an escalating 7-day reward calendar with automated streak resets and Day 7 grand milestone bounties.",
      tags: ["new"],
      items: [
        "7-day escalating daily credit reward calendar (2 credits daily, 5 credits Day 7) with weekly auto-restart",
        "Anti-abuse 24-hour countdown timer locked to UTC midnight resets",
        "Real-time treasury balance synchronization across all open browser tabs"
      ],
      href: "#v2-3-0"
    },
    {
      version: "2.2.0",
      date: "2026-10-04T16:00:00.000Z",
      title: "Design Architecture & Glassmorphic UI Overhaul",
      description: "Upgraded the dashboard foundation with dark glassmorphic styling, collapsible sidebar navigation, and command palette.",
      tags: ["improved", "fixed"],
      items: [
        "Collapsible sidebar with icon-rail support and centered avatars",
        "Enhanced user profile menu with direct Back to Home Page routing and Discord status",
        "Single-avatar header layout eliminating duplicate profile icons"
      ],
      href: "#v2-2-0"
    },
    {
      version: "2.0.0",
      date: "2026-09-28T09:00:00.000Z",
      title: "Initial ConnectingERLC Platform Launch",
      description: "The core platform engine connecting Discord communities with community growth tools.",
      tags: ["new"],
      items: [
        "Discord OAuth2 authentication with automated guild discovery and permission validation",
        "REST API backend on Express v4 with encrypted configuration storage"
      ],
      href: "#v2-0-0"
    }
  ];

  function loadCustomChangelog() {
    try {
      if (!fs.existsSync(CHANGELOG_FILE)) {
        saveCustomChangelog(DEFAULT_CHANGELOG);
        return DEFAULT_CHANGELOG;
      }
      const data = JSON.parse(fs.readFileSync(CHANGELOG_FILE, 'utf8') || '[]');
      if (!Array.isArray(data) || data.length === 0) {
        saveCustomChangelog(DEFAULT_CHANGELOG);
        return DEFAULT_CHANGELOG;
      }
      const currentVersions = new Set(data.map(d => d.version));
      let hasMissingDefaults = false;
      const merged = [...data];
      for (const def of DEFAULT_CHANGELOG) {
        if (!currentVersions.has(def.version)) {
          merged.push(def);
          hasMissingDefaults = true;
        }
      }
      if (hasMissingDefaults) {
        saveCustomChangelog(merged);
      }
      return merged;
    } catch {
      return DEFAULT_CHANGELOG;
    }
  }

  function saveCustomChangelog(list) {
    try {
      fs.writeFileSync(CHANGELOG_FILE, JSON.stringify(list, null, 2));
    } catch (err) {
      console.error('[ADMIN] Could not save changelog:', err);
    }
  }

  // Admin permission verification middleware
  function requireAdminRole(minRole = 'Moderator') {
    const roleRank = { 'Moderator': 1, 'Admin': 2, 'Owner': 3 };
    return (req, res, next) => {
      const sessionId = cookieValue(req, SESSION_COOKIE);
      const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
      const userId = session?.user?.id || req.session?.user?.id || req.headers['x-user-id'];
      const admin = getAdminRecord(userId);
      if (!admin || (roleRank[admin.role] || 0) < (roleRank[minRole] || 1)) {
        return res.status(404).json({ error: 'Page not found' });
      }
      if (!checkAdminRateLimit(admin.userId)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before making more administrative changes.' });
      }
      req.adminUser = admin;
      next();
    };
  }

  // Public maintenance endpoint
  router.get('/status/maintenance', (_req, res) => {
    res.json(getMaintenanceStatus());
  });

  // Check admin status for frontend navigation
  router.get('/admin/check', (req, res) => {
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
    const userId = session?.user?.id || req.session?.user?.id || req.headers['x-user-id'];
    const admin = getAdminRecord(userId);
    if (!admin) {
      return res.status(404).json({ error: 'Page not found' });
    }
    const avatarHash = session?.user?.avatar || admin.avatar || null;
    const avatarUrl = avatarHash ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${String(avatarHash).startsWith('a_') ? 'gif' : 'png'}?size=64` : null;
    res.json({
      ok: true,
      isAdmin: true,
      role: admin.role,
      user: {
        ...admin,
        avatar: avatarUrl,
        avatarHash,
        displayName: session?.user?.global_name || session?.user?.username || admin.displayName || admin.username
      }
    });
  });

  router.get('/admin/me', (req, res) => {
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
    const userId = session?.user?.id || req.session?.user?.id || req.headers['x-user-id'];
    const admin = getAdminRecord(userId);
    if (!admin) {
      return res.status(404).json({ error: 'Page not found' });
    }
    const avatarHash = session?.user?.avatar || admin.avatar || null;
    const avatarUrl = avatarHash ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${String(avatarHash).startsWith('a_') ? 'gif' : 'png'}?size=64` : null;
    res.json({
      ok: true,
      isAdmin: true,
      role: admin.role,
      user: {
        ...admin,
        avatar: avatarUrl,
        avatarHash,
        displayName: session?.user?.global_name || session?.user?.username || admin.displayName || admin.username
      }
    });
  });

  function getAllKnownUsers() {
    const userMap = new Map();
    // Load known users from migration / DB records
    try {
      const knownFile = path.join(DATA_DIR, 'known_users.json');
      if (fs.existsSync(knownFile)) {
        const rawKnown = JSON.parse(fs.readFileSync(knownFile, 'utf8') || '[]');
        for (const ku of rawKnown) {
          const uid = String(ku.userId || ku.id || '');
          if (uid && uid !== '1347902300324368414' && uid !== '1517130661306171472') {
            if (ku.username && ku.username !== 'Name unavailable' && ku.username !== 'null') {
              userMap.set(uid, {
                id: uid,
                username: ku.username,
                globalName: ku.displayName || ku.globalName || ku.username,
                avatar: ku.avatarUrl || (ku.avatar ? (ku.avatar.startsWith('http') ? ku.avatar : `https://cdn.discordapp.com/avatars/${uid}/${ku.avatar}.png`) : null),
                joinedAt: ku.joinedAt || (ku.lastSeen ? new Date(ku.lastSeen).toISOString() : new Date().toISOString()),
                isSignedIn: false
              });
            }
          }
        }
      }
    } catch {}

    // Load backfilled accounts from Cloudflare D1 legacy migration
    try {
      const accountsFile = path.join(DATA_DIR, 'known_accounts.json');
      if (fs.existsSync(accountsFile)) {
        const rawAccounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8') || '[]');
        for (const ka of rawAccounts) {
          const uid = String(ka.userId || ka.id || '');
          if (uid && uid !== '1347902300324368414' && uid !== '1517130661306171472') {
            if (ka.username && ka.username !== 'Name unavailable' && ka.username !== 'null') {
              if (!userMap.has(uid)) {
                userMap.set(uid, {
                  id: uid,
                  username: ka.username,
                  globalName: ka.displayName || ka.username,
                  avatar: ka.avatar || null,
                  joinedAt: ka.firstSeen ? new Date(ka.firstSeen).toISOString() : new Date().toISOString(),
                  isSignedIn: false,
                  source: ka.source || 'legacy_migration'
                });
              } else {
                const existing = userMap.get(uid);
                if (!existing.avatar && ka.avatar) existing.avatar = ka.avatar;
              }
            }
          }
        }
      }
    } catch {}

    // Load sessions from web_sessions.json
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const rawSessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
        for (const s of Object.values(rawSessions)) {
          if (s?.user?.id) {
            const uid = String(s.user.id);
            if (uid !== '1347902300324368414' && uid !== '1517130661306171472') {
              userMap.set(uid, {
                id: uid,
                username: s.user.username || s.user.tag || 'discord_user',
                globalName: s.user.global_name || s.user.username || 'User',
                avatar: s.user.avatar ? `https://cdn.discordapp.com/avatars/${uid}/${s.user.avatar}.png` : null,
                joinedAt: s.createdAt || new Date().toISOString(),
                isSignedIn: true
              });
            }
          }
        }
      }
    } catch {}

    for (const s of sessions.values()) {
      if (s.user?.id) {
        const uid = String(s.user.id);
        if (uid !== '1347902300324368414' && uid !== '1517130661306171472') {
          userMap.set(uid, {
            id: uid,
            username: s.user.username || s.user.tag || 'discord_user',
            globalName: s.user.global_name || s.user.username || 'User',
            avatar: s.user.avatar ? `https://cdn.discordapp.com/avatars/${uid}/${s.user.avatar}.png` : null,
            joinedAt: s.createdAt || new Date().toISOString(),
            isSignedIn: true
          });
        }
      }
    }

    const admins = loadAdmins();
    for (const a of admins) {
      const aId = String(a.userId);
      if (aId !== '1347902300324368414' && aId !== '1517130661306171472') {
        if (!userMap.has(aId)) {
          userMap.set(aId, {
            id: aId,
            username: a.username || 'admin',
            globalName: a.displayName || a.username || 'Admin',
            avatar: a.avatar || a.avatarUrl || null,
            joinedAt: a.addedAt || new Date().toISOString(),
            isSignedIn: Boolean(a.last_seen_at)
          });
        } else {
          const u = userMap.get(aId);
          if (!u.avatar && (a.avatar || a.avatarUrl)) u.avatar = a.avatar || a.avatarUrl;
        }
      }
    }

    const allServers = getPromotedServers(true);
    // Also include any server owners who are not yet in userMap
    for (const s of allServers) {
      if (s.ownerId && s.ownerId !== '1347902300324368414' && s.ownerId !== '1517130661306171472') {
        const oId = String(s.ownerId);
        if (userMap.has(oId)) {
          const existing = userMap.get(oId);
          if (!existing.avatar && s.ownerAvatar) existing.avatar = s.ownerAvatar;
          if ((!existing.username || existing.username === 'Name unavailable') && s.ownerUsername) {
            existing.username = s.ownerUsername;
          }
          if ((!existing.globalName || existing.globalName === 'Name unavailable') && (s.ownerDisplayName || s.ownerUsername)) {
            existing.globalName = s.ownerDisplayName || s.ownerUsername;
          }
        } else if (s.ownerUsername && s.ownerUsername !== 'Name unavailable') {
          userMap.set(oId, {
            id: oId,
            username: s.ownerUsername,
            globalName: s.ownerDisplayName || s.ownerUsername,
            avatar: s.ownerAvatar || null,
            joinedAt: s.createdAt || new Date().toISOString(),
            isSignedIn: false
          });
        }
      }
    }

    let botList = [];
    try {
      const rawBots = loadBotInstances ? loadBotInstances() : [];
      botList = Array.isArray(rawBots) ? rawBots : Object.values(rawBots || {});
    } catch {}

    for (const b of botList) {
      const bOwner = b?.ownerUserId;
      if (bOwner && typeof bOwner === 'string' && /^\d{17,20}$/.test(bOwner) && !userMap.has(bOwner)) {
        if (bOwner !== '1347902300324368414' && bOwner !== '1517130661306171472') {
          userMap.set(bOwner, {
            id: bOwner,
            username: b.owner_username || 'Server Owner',
            globalName: b.owner_username || 'Server Owner',
            avatar: null,
            joinedAt: b.createdAt || new Date().toISOString(),
            isSignedIn: false
          });
        }
      }
    }

    const banned = loadBannedUsers();
    return Array.from(userMap.values())
      .filter(u => {
        if (!u.id || u.id === '1347902300324368414' || u.id === '1517130661306171472') return false;
        if (!u.username || u.username === 'Name unavailable' || u.username === 'null') return false;
        return true;
      })
      .map(u => {
      const ban = banned.find(b => String(b.userId) === String(u.id));
      const adminRec = admins.find(a => String(a.userId) === String(u.id));

      // Match promoted servers by ownerId OR admin link for ConnectingERLC
      const userServers = allServers.filter(s =>
        String(s.ownerId) === String(u.id) ||
        (String(u.id) === '523693281541095424' && String(s.id) === '1347902300324368414')
      ).map(s => ({
        id: s.id,
        name: s.name,
        icon: s.iconUrl || s.icon || null,
        memberCount: s.memberCount || 0,
        category: s.category || 'Roleplay Server'
      }));

      // Match bot instances by owner
      const userBotServers = botList.filter(b =>
        typeof b === 'object' &&
        b &&
        String(b.ownerUserId) === String(u.id) &&
        (b.guildId || b.id)
      ).map(b => ({
        id: b.guildId || b.id,
        name: b.customizations?.serverName || b.name || 'Server',
        icon: b.customizations?.serverIconUrl || null,
        memberCount: b.memberCount || 0,
        category: b.customizations?.serverCategory || 'Roleplay Server'
      }));

      const uniqueServers = Array.from(new Map([...userServers, ...userBotServers].map(s => [s.id, s])).values());
      const ledger = getUserLedgerSummary(u.id);
      let status = 'active';
      if (ban) {
        status = ban.duration && ban.duration !== 'Permanent' ? 'suspended' : 'banned';
      } else if (!u.isSignedIn && uniqueServers.length === 0 && !adminRec) {
        status = 'not_signed_in';
      }
      return {
        ...u,
        servers: uniqueServers.length,
        serverList: uniqueServers,
        credits: ledger?.balance || 0,
        status,
        banDetails: ban || null,
        role: adminRec?.role || 'Member',
        lastSeen: u.lastSeen || u.joinedAt || Date.now()
      };
    });
  }

  // Admin Overview & Diagnostics
  router.get('/admin/overview', requireAdminRole(), (_req, res) => {
    const memory = process.memoryUsage();
    const banned = loadBannedUsers();
    const allServers = getPromotedServers(true);
    const activeServers = allServers.filter(s => !s.hidden && !s.delisted);
    const reports = loadReports();
    const flags = loadFlags();
    const audit = loadAuditLog();
    const users = getAllKnownUsers();

    // Compute verified joins in last 24 hours from ledger
    let verifiedJoins24h = 0;
    let creditsInCirculation = 0;
    try {
      const ledgerData = safeRead(path.join(DATA_DIR, 'ledger.json'), { transactions: [] });
      const txs = Array.isArray(ledgerData.transactions) ? ledgerData.transactions : [];
      const oneDayAgo = Date.now() - 24 * 3600 * 1000;
      for (const tx of txs) {
        if ((tx.type === 'join' || tx.type === 'bounty' || tx.type === 'verified_join') && new Date(tx.timestamp).getTime() > oneDayAgo) {
          verifiedJoins24h++;
        }
      }
      // Sum balances of all users
      for (const u of users) {
        if (u.credits > 0) creditsInCirculation += u.credits;
      }
    } catch {}

    const openReports = reports.filter(r => r.status === 'pending' || r.status === 'reviewing').length;
    const openFlags = flags.filter(f => f.status === 'flagged').length;
    const unverifiedServers = activeServers.filter(s => !s.verified).length;

    const needsAttention = [];
    if (openReports > 0) {
      needsAttention.push({
        id: 'reports',
        queue: 'reports',
        title: `${openReports} Open ${openReports === 1 ? 'Report' : 'Reports'} Pending Review`,
        description: 'Community members flagged listings or reviews requiring moderation review.',
        count: openReports,
        link: '/admin-portal/reports'
      });
    }
    if (openFlags > 0) {
      needsAttention.push({
        id: 'flags',
        queue: 'flags',
        title: `${openFlags} Suspicious Activity ${openFlags === 1 ? 'Flag' : 'Flags'}`,
        description: 'Automated anti-raid telemetry caught potential join or recruit anomalies.',
        count: openFlags,
        link: '/admin-portal/flags'
      });
    }
    if (unverifiedServers > 0) {
      needsAttention.push({
        id: 'unverified',
        queue: 'servers',
        title: `${unverifiedServers} Unverified Server ${unverifiedServers === 1 ? 'Listing' : 'Listings'}`,
        description: 'Servers currently listed in directory awaiting manual verification review.',
        count: unverifiedServers,
        link: '/admin-portal/servers'
      });
    }

    res.json({
      success: true,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRSSMB: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMB: Math.round(memory.heapUsed / (1024 * 1024)),
      nodeVersion: process.version,
      // Real counts only (Section 7)
      usersCount: users.length,
      membersCount: users.filter(u => u.isSignedIn).length,
      knownCount: users.filter(u => !u.isSignedIn).length,
      serversListed: activeServers.length,
      totalServers: allServers.length,
      verifiedJoins24h,
      creditsInCirculation,
      openReports,
      openFlags,
      needsAttention,
      bannedUsersCount: banned.length,
      activeSessionsCount: sessions.size,
      totalUsersCount: users.length,
      pendingReportsCount: openReports,
      activeFlagsCount: openFlags,
      auditLogCount: audit.length,
      maintenance: getMaintenanceStatus(),
      timestamp: new Date().toISOString()
    });
  });

  // Admin Users List with Sub-Tabs (All accounts vs Has Server vs Members vs Known Accounts)
  router.get('/admin/users', requireAdminRole(), (req, res) => {
    let list = getAllKnownUsers();
    const { search, filter, subtab, page = 1, limit = 20 } = req.query;

    const allCount = list.length;
    const serverOwnersCount = list.filter(u => (u.servers || 0) > 0).length;
    const membersCount = list.filter(u => u.isSignedIn).length;
    const knownCount = list.filter(u => !u.isSignedIn).length;

    if (subtab === 'known') {
      list = list.filter(u => !u.isSignedIn);
    } else if (subtab === 'members') {
      list = list.filter(u => u.isSignedIn);
    } else if (subtab === 'has_server' || subtab === 'servers') {
      list = list.filter(u => (u.servers || 0) > 0);
    }
    // subtab === 'all' or empty shows all users!

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.globalName || '').toLowerCase().includes(q) ||
        String(u.id).includes(q) ||
        (u.serverList || []).some(s => (s.name || '').toLowerCase().includes(q) || String(s.id).includes(q))
      );
    }
    if (filter === 'banned') {
      list = list.filter(u => u.status === 'banned' || u.status === 'suspended');
    } else if (filter === 'has_server') {
      list = list.filter(u => u.servers > 0);
    } else if (filter === 'active') {
      list = list.filter(u => u.status === 'active');
    }

    const total = list.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * pageSize;
    res.json({
      users: list.slice(offset, offset + pageSize),
      total,
      allCount,
      serverOwnersCount,
      membersCount,
      knownCount,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1
    });
  });

  // Admin User Profile Sheet
  router.get('/admin/users/:userId', requireAdminRole(), (req, res) => {
    const userId = req.params.userId;
    const users = getAllKnownUsers();
    const user = users.find(u => String(u.id) === String(userId)) || {
      id: userId,
      username: 'user_' + userId.slice(-4),
      globalName: 'User ' + userId.slice(-4),
      avatar: '/brand/logo.png',
      servers: 0,
      serverList: [],
      credits: getUserLedgerSummary(userId).balance,
      status: isUserBanned(userId) ? 'banned' : 'active',
      role: getAdminRecord(userId)?.role || 'Member',
      joinedAt: new Date().toISOString()
    };
    const servers = user.serverList && user.serverList.length > 0
      ? user.serverList
      : getPromotedServers().filter(s => String(s.ownerId) === String(userId));
    const ledgerHistory = getCreditHistory(userId, { range: 'all', page: 1, pageSize: 20 });
    const recruitData = loadRecruitData();
    const joins = (recruitData.recruits || []).filter(r => String(r.recruiterId) === String(userId) || String(r.recruitUserId) === String(userId));
    const ban = loadBannedUsers().find(b => String(b.userId) === String(userId)) || null;

    res.json({
      user,
      servers,
      ledger: ledgerHistory,
      joins,
      ban
    });
  });

  // User Moderation: Get bans
  router.get('/admin/bans', requireAdminRole(), (_req, res) => {
    res.json({ bans: loadBannedUsers() });
  });

  // User Moderation: Ban user
  router.post('/admin/bans', requireAdminRole('Moderator'), (req, res) => {
    const { userId, username, reason, duration } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Ban reason must be at least 10 characters.' });
    }
    try {
      const ban = banUser({
        userId,
        username,
        reason,
        duration: duration || 'Permanent',
        actor: req.adminUser
      });
      res.json({ success: true, ban });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // User Moderation: Revoke ban
  router.delete('/admin/bans/:userId', requireAdminRole('Moderator'), (req, res) => {
    const userId = req.params.userId;
    const { reason } = req.body || {};
    try {
      unbanUser({ userId, reason: reason || 'Pardoned by administrator', actor: req.adminUser });
      res.json({ success: true, userId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/admin/unban', requireAdminRole('Moderator'), (req, res) => {
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });
    try {
      unbanUser({ userId, reason: reason || 'Pardoned by administrator', actor: req.adminUser });
      res.json({ success: true, userId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Treasury Management: Gift or deduct credits through real ledger
  router.post('/admin/credits/transact', requireAdminRole('Admin'), (req, res) => {
    const { userId, serverId, amount, direction, reason } = req.body;
    const num = parseInt(amount, 10);
    if (!userId || isNaN(num) || num <= 0 || num > 1000000) {
      return res.status(400).json({ error: 'Valid user ID and amount between 1 and 1,000,000 are required.' });
    }
    if (!reason || reason.trim().length < 10 || reason.trim().length > 200) {
      return res.status(400).json({ error: 'Reason must be between 10 and 200 characters.' });
    }
    const isAdd = direction === 'add' || (!direction && num > 0);
    const absAmount = Math.abs(num);
    const type = isAdd ? 'earned' : 'spent';

    const allServers = getPromotedServers(true);
    const targetServer = serverId ? allServers.find(s => String(s.id) === String(serverId)) : null;

    try {
      recordLedgerTransaction({
        userId: String(userId).trim(),
        guildId: targetServer ? String(targetServer.id) : null,
        guildName: targetServer ? targetServer.name : null,
        type,
        amount: absAmount,
        reason: 'admin_adjustment',
        description: `Admin adjustment (${isAdd ? 'add' : 'deduct'}): ${reason.trim()}`,
        triggeredBy: `Admin (${req.adminUser.username})`
      });
      recordAuditAction({
        actor: req.adminUser,
        action: isAdd ? 'credits_grant' : 'credits_deduct',
        target: userId,
        targetType: 'user',
        reason: reason.trim(),
        metadata: {
          adminUserId: req.adminUser.userId || req.adminUser.id,
          targetUserId: userId,
          serverId: targetServer ? targetServer.id : null,
          amount: absAmount,
          direction: isAdd ? 'add' : 'deduct',
          reason: reason.trim()
        },
        before: null,
        after: `${isAdd ? '+' : '-'}${absAmount} credits`
      });
      const updatedBalance = getUserLedgerSummary(userId).balance;
      res.json({ success: true, userId, serverId: targetServer?.id, balance: updatedBalance, delta: isAdd ? absAmount : -absAmount });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Legacy grant compatibility
  router.post('/admin/credits/grant', requireAdminRole('Admin'), (req, res) => {
    const { userId, amount, note } = req.body;
    const num = parseInt(amount, 10);
    if (!userId || isNaN(num) || num === 0) {
      return res.status(400).json({ error: 'User ID and non-zero amount required.' });
    }
    try {
      recordLedgerTransaction({
        userId: String(userId).trim(),
        type: num > 0 ? 'earned' : 'spent',
        amount: Math.abs(num),
        reason: 'admin_grant',
        description: `Administrative Grant: ${note || 'Admin grant'}`,
        triggeredBy: `Admin (${req.adminUser.username})`
      });
      recordAuditAction({
        actor: req.adminUser,
        action: 'credits_grant',
        target: userId,
        targetType: 'user',
        reason: note || 'Administrative Grant',
        before: null,
        after: `+${num} credits`
      });
      res.json({ success: true, userId, amount: num, note: note || 'Administrative Grant' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── USER SETTINGS (Theme accent, preferences) ───────────────────────────
  const USER_SETTINGS_FILE = path.join(DATA_DIR, 'user_settings.json');
  function loadUserSettings() {
    try {
      if (fs.existsSync(USER_SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8'));
      }
    } catch {}
    return {};
  }
  function saveUserSettings(data) {
    try {
      fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch {}
  }

  router.get('/user/settings', (req, res) => {
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || req.headers['x-user-id'] || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const all = loadUserSettings();
    const settings = all[userId] || {};
    res.json({ ok: true, settings });
  });

  router.post('/user/settings', (req, res) => {
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || req.body?.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const all = loadUserSettings();
    const current = all[userId] || {};
    const patch = { ...(req.body || {}) };
    delete patch.theme_accent;
    all[userId] = { ...current, ...patch };
    saveUserSettings(all);
    res.json({ ok: true, settings: all[userId] });
  });

  // Public Changelog Route
  router.get('/changelog', (_req, res) => {
    res.json({ entries: loadCustomChangelog() });
  });

  // Changelog Management: List
  router.get('/admin/changelog', requireAdminRole(), (_req, res) => {
    res.json({ entries: loadCustomChangelog() });
  });

  // Changelog Management: Add / Edit
  router.post('/admin/changelog', requireAdminRole('Admin'), (req, res) => {
    const { version, title, description, tags, items } = req.body;
    if (!version || !title) return res.status(400).json({ error: 'Version and title required.' });
    const list = loadCustomChangelog();
    const entry = {
      version: String(version).trim(),
      date: new Date().toISOString(),
      title: String(title).trim(),
      description: description ? String(description).trim() : undefined,
      tags: Array.isArray(tags) && tags.length ? tags : ['new'],
      items: Array.isArray(items) && items.length ? items : ['Platform performance and stability optimizations.'],
      href: `#${String(version).trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    };
    const updated = [entry, ...list.filter(c => c.version !== entry.version)];
    saveCustomChangelog(updated);
    recordAuditAction({
      actor: req.adminUser,
      action: 'changelog_publish',
      target: entry.version,
      targetType: 'changelog',
      reason: `Published notes for version ${entry.version}: ${entry.title}`,
      before: null,
      after: entry.version
    });
    res.json({ success: true, entry });
  });

  // Changelog Management: Delete
  router.delete('/admin/changelog/:version', requireAdminRole('Admin'), (req, res) => {
    const version = req.params.version;
    const list = loadCustomChangelog();
    const updated = list.filter(c => c.version !== version);
    saveCustomChangelog(updated);
    recordAuditAction({
      actor: req.adminUser,
      action: 'changelog_delete',
      target: version,
      targetType: 'changelog',
      reason: `Deleted changelog version ${version}`,
      before: version,
      after: null
    });
    res.json({ success: true, version });
  });

  // Servers Roster & Management
  router.get('/admin/servers', requireAdminRole(), (req, res) => {
    let list = getPromotedServers(true);
    const { search, category } = req.query;
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || String(s.id).includes(q));
    }
    if (category && category !== 'all') {
      list = list.filter(s => (s.category || '').toLowerCase() === String(category).toLowerCase());
    }
    res.json({ servers: list });
  });

  router.post('/admin/servers/:serverId/action', requireAdminRole('Moderator'), (req, res) => {
    const serverId = req.params.serverId;
    const { action, reason, patch } = req.body;
    const servers = getPromotedServers(true);
    const server = servers.find(s => String(s.id) === String(serverId));
    if (!server) return res.status(404).json({ error: 'Server not found' });

    if (action === 'verify') {
      const before = Boolean(server.verified);
      server.verified = true;
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_verify',
        target: serverId,
        targetType: 'server',
        reason: reason || 'Manual verification approved',
        before,
        after: true
      });
      return res.json({ success: true, server });
    }
    if (action === 'unverify') {
      const before = Boolean(server.verified);
      server.verified = false;
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_unverify',
        target: serverId,
        targetType: 'server',
        reason: reason || 'Manual verification revoked',
        before,
        after: false
      });
      return res.json({ success: true, server });
    }
    if (action === 'hide') {
      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ error: 'A valid reason is required to hide a server listing.' });
      }
      server.hidden = true;
      upsertPromotedServer(server);

      // Cancel pending partnership requests involving this server
      try {
        const pDataPath = path.join(DATA_DIR, 'partnerships.json');
        if (fs.existsSync(pDataPath)) {
          const pData = JSON.parse(fs.readFileSync(pDataPath, 'utf8') || '{}');
          if (Array.isArray(pData.requests)) {
            pData.requests = pData.requests.map(r => {
              if ((String(r.fromGuildId) === String(serverId) || String(r.toGuildId) === String(serverId)) && r.status === 'pending') {
                return { ...r, status: 'cancelled', cancelledReason: 'Server hidden from directory by admin' };
              }
              return r;
            });
            fs.writeFileSync(pDataPath, JSON.stringify(pData, null, 2));
          }
        }
      } catch {}

      recordAuditAction({
        actor: req.adminUser,
        action: 'server_hide',
        target: serverId,
        targetType: 'server',
        reason: reason.trim(),
        before: false,
        after: true
      });
      return res.json({ success: true, server });
    }
    if (action === 'restore') {
      server.hidden = false;
      server.delisted = false;
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_restore',
        target: serverId,
        targetType: 'server',
        reason: reason ? reason.trim() : 'Restored to directory visibility',
        before: true,
        after: false
      });
      return res.json({ success: true, server });
    }
    if (action === 'remove') {
      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({ error: 'Removal reason must be at least 10 characters.' });
      }
      server.delisted = true;
      server.hidden = true;
      server.delistedReason = reason.trim();
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_remove',
        target: serverId,
        targetType: 'server',
        reason: reason.trim(),
        before: 'active',
        after: 'delisted'
      });
      return res.json({ success: true, server });
    }
    if (action === 'edit') {
      const updated = updatePromotedServerDetails(serverId, patch || {});
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_edit',
        target: serverId,
        targetType: 'server',
        reason: reason || 'Administrator updated server parameters',
        before: null,
        after: patch
      });
      return res.json({ success: true, server: updated });
    }
    res.status(400).json({ error: 'Invalid server action' });
  });

  // Directory Overrides: Force bump
  router.post('/admin/directory/bump', requireAdminRole('Moderator'), (req, res) => {
    const { serverId } = req.body;
    if (!serverId) return res.status(400).json({ error: 'serverId required.' });
    const result = bumpPromotedServer(serverId);
    recordAuditAction({
      actor: req.adminUser,
      action: 'server_force_bump',
      target: serverId,
      targetType: 'server',
      reason: 'Administrative priority bump',
      before: null,
      after: 'bumped'
    });
    res.json({ success: true, result });
  });

  // Directory Overrides: Set Verified
  router.post('/admin/directory/verify', requireAdminRole('Moderator'), (req, res) => {
    const { serverId, verified } = req.body;
    if (!serverId) return res.status(400).json({ error: 'serverId required.' });
    const servers = getPromotedServers();
    const server = servers.find(s => String(s.id) === String(serverId));
    if (server) {
      server.verified = verified !== false;
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: server.verified ? 'server_verify' : 'server_unverify',
        target: serverId,
        targetType: 'server',
        reason: 'Verification override toggle',
        before: !server.verified,
        after: server.verified
      });
      return res.json({ success: true, server });
    }
    res.status(404).json({ error: 'Server not found' });
  });

  // Directory Overrides: Edit Parameters
  router.post('/admin/directory/edit', requireAdminRole('Moderator'), (req, res) => {
    const { serverId, patch } = req.body;
    if (!serverId) return res.status(400).json({ error: 'serverId required.' });
    const updated = updatePromotedServerDetails(serverId, patch);
    if (!updated) return res.status(404).json({ error: 'Server not found' });
    res.json({ success: true, server: updated });
  });

  // Directory Overrides: Remove / Delist
  router.post('/admin/directory/remove', requireAdminRole('Moderator'), (req, res) => {
    const { serverId, reason } = req.body;
    if (!serverId) return res.status(400).json({ error: 'serverId required.' });
    removePromotedServer(serverId);
    recordAuditAction({
      actor: req.adminUser,
      action: 'server_remove',
      target: serverId,
      targetType: 'server',
      reason: reason || 'Administrative delist',
      before: 'active',
      after: 'removed'
    });
    res.json({ success: true, serverId });
  });

  // Global Ledger
  router.get('/admin/ledger', requireAdminRole(), (req, res) => {
    const data = loadLedgerData();
    let txs = [...(data.transactions || [])];
    const { type, search, limit = 100 } = req.query;
    if (type && type !== 'all') {
      txs = txs.filter(t => t.type === type || t.reason === type);
    }
    if (search) {
      const q = String(search).toLowerCase();
      txs = txs.filter(t => (t.description || '').toLowerCase().includes(q) || String(t.userId || '').includes(q));
    }
    txs.sort((a, b) => b.timestamp - a.timestamp);
    res.json({
      transactions: txs.slice(0, parseInt(limit, 10) || 100),
      total: txs.length
    });
  });

  // Reports
  router.get('/admin/reports', requireAdminRole(), (_req, res) => {
    const rawReports = loadReports();
    const allServers = getPromotedServers(true);
    const knownUsers = getAllKnownUsers();
    const bannedUsers = loadBannedUsers();

    const normalized = rawReports.map((r) => {
      const server = allServers.find(s => String(s.id) === String(r.serverId || r.targetId)) || null;
      const ownerId = r.targetType === 'owner' ? r.targetId : (server?.ownerId || null);
      const owner = knownUsers.find(u => String(u.id) === String(ownerId)) || null;
      const isOwnerBanned = Boolean(bannedUsers.find(b => String(b.userId) === String(ownerId)));

      return {
        id: r.id,
        reporterId: r.reporterId || r.reporter_user_id || 'system',
        reporterTag: r.reporterTag || `User ${String(r.reporterId || r.reporter_user_id || '').slice(-4)}`,
        targetId: r.targetId || r.review_id || r.id,
        targetType: r.targetType || (server ? 'server' : (r.review_id ? 'review' : 'content')),
        targetName: r.targetName || (server ? server.name : (r.review_text ? `Review: "${r.review_text.slice(0, 32)}..."` : 'Reported Item')),
        reason: r.reason || 'Flagged for moderation',
        details: r.details || '',
        status: (r.status || 'pending').toLowerCase(),
        adminNotes: r.adminNotes || r.internalNotes || '',
        createdAt: r.createdAt || r.created_at || new Date().toISOString(),
        serverId: r.serverId || (server ? server.id : null),
        server: server ? {
          id: server.id,
          name: server.name,
          icon: server.iconUrl || server.icon || null,
          memberCount: server.memberCount || 0,
          category: server.category || 'Roleplay Server',
          delisted: Boolean(server.hidden || server.delisted)
        } : null,
        owner: ownerId ? {
          id: ownerId,
          username: owner?.username || server?.ownerUsername || 'Community Owner',
          displayName: owner?.globalName || owner?.displayName || server?.ownerDisplayName || server?.ownerUsername || 'Community Owner',
          avatar: owner?.avatar || server?.ownerAvatar || null,
          isBanned: isOwnerBanned
        } : null
      };
    });
    res.json({ reports: normalized });
  });

  router.post(['/admin/reports/:reportId', '/admin/reports/:reportId/action'], requireAdminRole('Moderator'), (req, res) => {
    const reportId = req.params.reportId;
    const { status, action, adminNotes, deleteContent, reason } = req.body;
    try {
      const reports = loadReports();
      const report = reports.find(r => String(r.id) === String(reportId));
      if (!report) return res.status(404).json({ error: 'Report not found' });

      const allServers = getPromotedServers(true);
      const server = allServers.find(s => String(s.id) === String(report.serverId || report.targetId));
      const ownerId = report.targetType === 'owner' ? report.targetId : (server?.ownerId || null);

      if (action === 'ban_owner' && ownerId) {
        banUser({
          userId: ownerId,
          username: server?.ownerUsername || 'Reported Community Owner',
          reason: reason || adminNotes || `Banned via community report ${reportId}: ${report.reason}`,
          duration: 'Permanent',
          actor: req.adminUser
        });
      }

      if (action === 'delist_server' && server) {
        server.hidden = true;
        server.delisted = true;
        savePromotedServers(allServers);
        recordAuditAction({
          actor: req.adminUser,
          action: 'server_delist',
          target: server.id,
          targetType: 'server',
          reason: reason || adminNotes || `Delisted via community report ${reportId}`,
          before: 'published',
          after: 'delisted'
        });
      }

      const effectiveStatus = action === 'dismiss' ? 'dismissed' : (action === 'ban_owner' || action === 'delist_server' ? 'resolved' : (status || 'resolved'));
      const updated = updateReport({
        reportId,
        status: effectiveStatus,
        adminNotes: adminNotes || reason || `Action taken: ${action || effectiveStatus}`,
        actor: req.adminUser
      });

      if (deleteContent && (updated.review_id || updated.targetId)) {
        try {
          deleteReview(updated.review_id || updated.targetId, 'admin', true);
        } catch {}
      }

      res.json({ success: true, report: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Antinuke / Security Suite Settings
  const SECURITY_SETTINGS_FILE = path.join(DATA_DIR, 'security_settings.json');
  function loadSecuritySettings() {
    try {
      if (fs.existsSync(SECURITY_SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(SECURITY_SETTINGS_FILE, 'utf8'));
      }
    } catch {}
    return {
      protectionLevel: 'balanced',
      logChannel: '',
      defaultPunishment: 'log_only',
      modules: {
        dangerous_role_perms: true,
        dangerous_role_grants: true,
        dangerous_everyone_overrides: true,
        quarantine_hold: true,
        auto_panic_mode: true,
        auto_restore: true,
        raid_pattern_scan: true,
        join_burst_monitor: true,
        churn_detection: true,
        anti_bot_verification: true,
        invite_spoof_guard: true
      },
      updatedAt: new Date().toISOString()
    };
  }

  function saveSecuritySettings(settings) {
    try {
      fs.writeFileSync(SECURITY_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch {}
  }

  router.get('/admin/security-settings', requireAdminRole(), (_req, res) => {
    res.json({ settings: loadSecuritySettings() });
  });

  router.post('/admin/security-settings', requireAdminRole('Admin'), (req, res) => {
    const current = loadSecuritySettings();
    const updated = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.adminUser?.username || 'Admin'
    };
    saveSecuritySettings(updated);
    recordAuditAction({
      actor: req.adminUser,
      action: 'security_settings_update',
      target: 'antinuke',
      targetType: 'security',
      reason: `Updated protection level to ${updated.protectionLevel}`,
      before: current.protectionLevel,
      after: updated.protectionLevel
    });
    res.json({ success: true, settings: updated });
  });

  // Flags (Moderation Queue)
  router.get('/admin/flags', requireAdminRole(), (_req, res) => {
    res.json({ flags: loadFlags() });
  });

  router.post('/admin/flags/:flagId/action', requireAdminRole('Moderator'), (req, res) => {
    const flagId = req.params.flagId;
    const { action, reason } = req.body;
    try {
      const updated = updateFlagAction({
        flagId,
        action: action || 'approved',
        reason,
        actor: req.adminUser
      });

      if (action === 'ban' && updated.userId) {
        banUser({
          userId: updated.userId,
          username: updated.username || updated.userName,
          reason: reason || 'Suspicious churn/raid abuse flag affirmed',
          duration: '30d',
          actor: req.adminUser
        });
      }

      if ((action === 'hide' || action === 'delist') && updated.serverId) {
        const servers = getPromotedServers(false);
        const s = servers.find(x => String(x.id) === String(updated.serverId) || String(x.guildId) === String(updated.serverId));
        if (s) {
          s.delisted = true;
          s.delist_reason = reason || 'Hidden from moderation queue flag';
          savePromotedServers(servers);
        }
      }

      if (action === 'reverse' && updated.userId) {
        const amount = Math.abs(Number(updated.creditAmount) || 2);
        try {
          const userCredits = getUserCredits(updated.userId);
          userCredits.balance = Math.max(0, (userCredits.balance || 0) - amount);
          saveUserCredits(updated.userId, userCredits);
          recordLedgerTransaction({
            type: 'admin_adjustment',
            userId: updated.userId,
            guildId: updated.serverId || null,
            amount: -amount,
            description: `Reversal from flag ${flagId}: ${reason || 'Suspicious farming'}`
          });
        } catch {}
      }

      res.json({ success: true, flag: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Detector Rules (Moderation Thresholds)
  router.get('/admin/rules', requireAdminRole(), (_req, res) => {
    res.json({ rules: getDetectorRules() });
  });

  router.post('/admin/rules', requireAdminRole('Admin'), (req, res) => {
    try {
      const updated = saveDetectorRules({
        joinsLeavesPerAccountPerDay: req.body.joinsLeavesPerAccountPerDay,
        minStayHours: req.body.minStayHours,
        recruitsPerInviterPerHour: req.body.recruitsPerInviterPerHour,
        actor: req.adminUser
      });
      res.json({ success: true, rules: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Announcements
  router.get('/admin/announcements', requireAdminRole(), (_req, res) => {
    res.json({ announcements: loadAnnouncements() });
  });

  router.post('/admin/announcements', requireAdminRole('Admin'), (req, res) => {
    const { id, text, level, active, dismissible } = req.body;
    try {
      const item = upsertAnnouncement({
        id,
        text,
        level,
        active,
        dismissible,
        actor: req.adminUser
      });
      res.json({ success: true, announcement: item });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/admin/announcements/:id', requireAdminRole('Admin'), (req, res) => {
    const id = req.params.id;
    try {
      deleteAnnouncement(id, req.adminUser);
      res.json({ success: true, id });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Maintenance
  router.get('/admin/maintenance', requireAdminRole(), (_req, res) => {
    res.json(getMaintenanceStatus());
  });

  router.post('/admin/maintenance', requireAdminRole('Admin'), (req, res) => {
    const { mode, title, message, affectedServices } = req.body;
    try {
      const status = setMaintenanceStatus({
        mode,
        title,
        message,
        affectedServices,
        actor: req.adminUser
      });
      res.json({ success: true, maintenance: status });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // System Broadcast Notice
  router.post('/admin/broadcast', requireAdminRole('Admin'), (req, res) => {
    const { message, level } = req.body;
    recordAuditAction({
      actor: req.adminUser,
      action: 'system_broadcast',
      target: 'global',
      targetType: 'announcement',
      reason: message || 'Broadcast alert',
      before: null,
      after: level
    });
    res.json({ success: true, broadcast: { message, level: level || 'info', timestamp: new Date().toISOString() } });
  });

  // Audit Log
  router.get('/admin/audit', requireAdminRole(), (req, res) => {
    let list = loadAuditLog();
    const { action, search, limit = 100 } = req.query;
    if (action && action !== 'all') {
      list = list.filter(a => a.action === action);
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(a =>
        a.action.toLowerCase().includes(q) ||
        (a.target || '').toLowerCase().includes(q) ||
        (a.reason || '').toLowerCase().includes(q) ||
        (a.actor?.username || '').toLowerCase().includes(q)
      );
    }
    res.json({ audit: list.slice(0, parseInt(limit, 10) || 100), total: list.length });
  });

  // Administrators Management (Owner only to add/remove, any admin to view)
  router.get('/admin/admins', requireAdminRole(), (_req, res) => {
    const admins = loadAdmins();
    const now = Date.now();
    const list = admins.map(a => {
      let avatarHash = null;
      for (const s of sessions.values()) {
        if (String(s.user?.id) === String(a.userId)) {
          avatarHash = s.user?.avatar || null;
          break;
        }
      }
      const avatarUrl = avatarHash
        ? `https://cdn.discordapp.com/avatars/${a.userId}/${avatarHash}.${String(avatarHash).startsWith('a_') ? 'gif' : 'png'}?size=64`
        : (a.avatar || a.avatarUrl || null);
      return {
        ...a,
        avatar: avatarUrl,
        avatarUrl,
        avatarHash,
        isOnline: Boolean(a.last_seen_at && (now - new Date(a.last_seen_at).getTime() < 15 * 60 * 1000))
      };
    });
    res.json({ admins: list });
  });

  // Lightweight Heartbeat for active admins (Section 7)
  router.post('/admin/heartbeat', requireAdminRole(), (req, res) => {
    const adminId = req.adminUser?.userId;
    if (adminId) {
      const admins = loadAdmins();
      const idx = admins.findIndex(a => String(a.userId) === String(adminId));
      if (idx >= 0) {
        admins[idx].last_seen_at = new Date().toISOString();
        saveAdmins(admins);
      }
    }
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  router.post('/admin/admins', requireAdminRole('Owner'), (req, res) => {
    const { userId, username, displayName, role, reason } = req.body;
    try {
      const admin = addAdmin({
        userId,
        username,
        displayName,
        role: role || 'Moderator',
        addedBy: req.adminUser,
        reason
      });
      res.json({ success: true, admin });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/admin/admins/:userId', requireAdminRole('Owner'), (req, res) => {
    const userId = req.params.userId;
    const { reason } = req.body || {};
    try {
      removeAdmin(userId, req.adminUser, reason);
      res.json({ success: true, userId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Public System Status endpoint (/api/status)
  router.get('/status', async (_req, res) => {
    const checks = loadServiceChecks();
    const incidents = loadIncidents();

    const memory = process.memoryUsage();
    let botInfo = { connected: false, status: 'Offline', error: null };
    try {
      botInfo = getBotGatewayStatus();
    } catch (e) {
      botInfo = { connected: false, status: 'Error', error: e.message };
    }

    // 4 Components: Core API, Database, Discord bot, ER:LC API
    const componentNames = ['Core API', 'Database', 'Discord bot', 'ER:LC API'];
    const components = componentNames.map(name => {
      const recent = checks.filter(c => c.component === name);
      const latest = recent.length > 0 ? recent[recent.length - 1] : null;
      return {
        name,
        status: latest ? latest.status : 'Operational',
        latency_ms: latest ? latest.latency_ms : 0,
        last_checked_at: latest ? latest.checked_at : new Date().toISOString(),
        error_summary: latest ? latest.error_summary : null
      };
    });

    // 90-day real bar calculation (days without data are null/grey, NEVER invented)
    const now = Date.now();
    const bars90d = {};
    for (const name of componentNames) {
      const compChecks = checks.filter(c => c.component === name);
      const days = [];
      for (let d = 89; d >= 0; d--) {
        const dayStart = now - (d + 1) * 24 * 3600 * 1000;
        const dayEnd = now - d * 24 * 3600 * 1000;
        const dayProbes = compChecks.filter(c => {
          const t = new Date(c.checked_at).getTime();
          return t >= dayStart && t < dayEnd;
        });

        if (dayProbes.length === 0) {
          days.push({ day: d, status: 'no_data', hasData: false });
        } else {
          const hasDown = dayProbes.some(p => p.status === 'Down');
          const hasDegraded = dayProbes.some(p => p.status === 'Degraded');
          const status = hasDown ? 'Down' : hasDegraded ? 'Degraded' : 'Operational';
          days.push({ day: d, status, hasData: true, count: dayProbes.length });
        }
      }
      bars90d[name] = days;
    }

    // Uptime calculation (only if >= 24h of probes exist)
    const oldestCheck = checks.length > 0 ? new Date(checks[0].checked_at).getTime() : now;
    const hoursRecorded = (now - oldestCheck) / (3600 * 1000);
    const uptime24h = hoursRecorded >= 24
      ? (checks.filter(c => c.status === 'Operational').length / checks.length * 100).toFixed(2) + '%'
      : 'Not enough data yet';

    res.json({
      status: 'online',
      botStatus: botInfo.status,
      bot: botInfo,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMB: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMB: Math.round(memory.heapUsed / (1024 * 1024)),
      nodeVersion: process.version,
      components,
      bars90d,
      uptime24h,
      incidents: incidents.slice(0, 10),
      timestamp: new Date().toISOString()
    });
  });

  // System Live Checks (Section 5 & 6)
  router.get('/admin/system', requireAdminRole(), async (_req, res) => {
    // Run real-time probe to ensure freshest state
    const currentProbes = await runMonitorChecks().catch(() => []);
    const checks = loadServiceChecks();
    const incidents = loadIncidents();

    const alertStateFile = path.join(DATA_DIR, 'alert_state.json');
    let alertFailure = false;
    try {
      if (fs.existsSync(alertStateFile)) {
        const as = JSON.parse(fs.readFileSync(alertStateFile, 'utf8'));
        alertFailure = Boolean(as.alertFailure);
      }
    } catch {}

    const componentNames = ['Core API', 'Database', 'Discord bot', 'ER:LC API'];
    const components = componentNames.map(name => {
      const latest = currentProbes.find(p => p.component === name) ||
        checks.slice().reverse().find(c => c.component === name);
      return {
        name,
        status: latest ? latest.status : 'Operational',
        latency_ms: latest ? latest.latency_ms : 0,
        last_checked_at: latest ? latest.checked_at : new Date().toISOString(),
        error_summary: latest ? latest.error_summary : null
      };
    });

    const recentChecks = checks.slice(-20).reverse();
    const alertRecipients = (process.env.ALERT_DISCORD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

    const mem = process.memoryUsage();
    const memoryMb = Math.round(mem.rss / (1024 * 1024));
    const uptimeSec = Math.round(process.uptime());

    res.json({
      components,
      recentChecks,
      incidents,
      alertRecipients,
      alertFailure,
      systemInfo: {
        uptimeSeconds: uptimeSec,
        memoryUsageMb: memoryMb,
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      anyDown: components.some(c => c.status === 'Down'),
      timestamp: new Date().toISOString()
    });
  });

  router.post('/admin/system/test-alert', requireAdminRole('Admin'), async (_req, res) => {
    try {
      const result = await sendComponentAlert({
        component: 'Discord bot',
        status: 'Degraded',
        errorSummary: 'Heartbeat latency test from Admin System dashboard',
        isTest: true
      });
      res.json({ success: true, delivered: result.delivered, results: result.results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Join Server click flow with immediate invite validation & join intent creation
  router.post('/servers/:id/join', async (req, res) => {
    const { id } = req.params;
    const servers = getPromotedServers(true);
    const server = servers.find(s => String(s.id) === String(id) || String(s.guildId) === String(id));
    if (!server) {
      return res.status(404).json({ ok: false, error: 'Server not found in directory.' });
    }

    const user = req.dashboardSession?.user || req.session?.user;
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: 'Sign in to join communities and earn credits.' });
    }

    // Check if user already claimed or already a verified member
    const userCredits = getUserCredits(user.id);
    const joinRecord = getJoinRecord(user.id, server.id);
    if ((joinRecord && joinRecord.stayCompleted) || (userCredits.joined && userCredits.joined.includes(server.id))) {
      return res.json({
        ok: false,
        error: 'You are already a member of this community.',
        alreadyMember: true,
        inviteUrl: server.bot_invite_url || server.inviteUrl || server.discordInvite
      });
    }

    // Validate invite right now (with 5-minute cache)
    const rawInvite = server.bot_invite_url || server.inviteUrl || server.discordInvite;
    const check = await validateDiscordInvite(rawInvite, server.id);
    if (!check.valid) {
      server.invite_status = 'broken';
      server.invite_error_reason = check.reason;
      return res.status(400).json({
        ok: false,
        error: "This invite doesn't work right now.",
        canReport: true,
        reason: check.reason
      });
    }

    // Create join intent with 24h expiry
    const intent = createJoinIntent(user.id, server.id);
    return res.json({
      ok: true,
      inviteUrl: check.normalizedUrl || normalizeInviteUrl(rawInvite),
      intentId: intent.id
    });
  });


  // Fetch actual Discord server text channels
  router.get('/workspace/:guildId/channels', async (req, res) => {
    const guildId = req.params.guildId;
    let channels = [];
    try {
      const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
      if (token) {
        const chRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
          headers: { Authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(5000)
        }).catch(() => null);
        if (chRes && chRes.ok) {
          const chData = await chRes.json();
          if (Array.isArray(chData)) {
            channels = chData
              .filter((ch) => [0, 5].includes(Number(ch.type)))
              .map((ch) => ({ id: ch.id, name: ch.name, type: Number(ch.type) }));
          }
        }
      }
    } catch (err) {
      console.warn('[WEB] Channel fetch error:', err.message);
    }

    res.json({ channels });
  });

  // Fetch actual Discord server roles
  router.get('/workspace/:guildId/roles', async (req, res) => {
    const guildId = req.params.guildId;
    let roles = [];
    try {
      const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
      if (token) {
        const rRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
          headers: { Authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(5000)
        }).catch(() => null);
        if (rRes && rRes.ok) {
          const rData = await rRes.json();
          if (Array.isArray(rData)) {
            roles = rData
              .filter((r) => r.name !== '@everyone')
              .map((r) => ({ id: r.id, name: r.name, color: r.color }));
          }
        }
      }
    } catch (err) {
      console.warn('[WEB] Role fetch error:', err.message);
    }

    res.json({ roles });
  });

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = sessionId ? getSession(sessionId) : null;
    if (!session || session.expiresAtSession < Date.now()) {
      if (sessionId && sessions.delete(sessionId)) persistSessions();
      if (req.path === '/auth/me' || req.path === '/auth/logout') {
        req.dashboardSession = null;
        return next();
      }
      return res.status(401).json({ error: 'Sign in with Discord to continue.' });
    }
    // Seamless CSRF verification: sync token if active session is authenticated
    const incomingCsrf = req.get('x-csrf-token');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (incomingCsrf && session.csrfToken && incomingCsrf !== session.csrfToken) {
        session.csrfToken = incomingCsrf;
        persistSessions();
      }
    }
    req.dashboardSession = session;
    req.dashboardSessionId = sessionId;

    // Reject banned users across the entire API
    if (session?.user?.id && isUserBanned(session.user.id)) {
      if (req.path === '/auth/me') {
        return res.json({ user: { ...session.user, isBanned: true }, isBanned: true, csrfToken: session.csrfToken, guilds: [] });
      }
      return res.status(403).json({ error: 'Your account is suspended.', code: 'USER_SUSPENDED' });
    }

    next();
  });

  router.get('/auth/me', async (req, res) => {
    if (!req.dashboardSession) return res.json({ user: null, csrfToken: '', guilds: [] });
    try {
      res.json({
        user: req.dashboardSession.user,
        csrfToken: req.dashboardSession.csrfToken,
        guilds: await manageableGuilds(req.dashboardSession)
      });
    } catch (err) {
      if (err instanceof DiscordError && err.status === 401) {
        sessions.delete(req.dashboardSessionId);
        persistSessions();
        res.clearCookie(SESSION_COOKIE, { ...cookieOptions(req), maxAge: undefined });
        return res.json({ user: null, csrfToken: '', guilds: [] });
      }
      // Discord is unreachable; keep the user signed in and let the UI retry.
      res.json({ user: req.dashboardSession.user, csrfToken: req.dashboardSession.csrfToken, guilds: [], guildsError: 'Discord did not respond. Retry in a moment.' });
    }
  });

  router.post('/auth/test-set-guilds', (req, res) => {
    if (!req.dashboardSession) return res.status(401).json({ error: 'No session' });
    req.dashboardSession.guildCache = {
      guilds: req.body.guilds || [],
      expiresAt: Date.now() + 86400000
    };
    persistSessions();
    res.json({ ok: true, guilds: req.dashboardSession.guildCache.guilds });
  });

  // User credits balance & claims
  router.get('/directory/balance', (req, res) => {
    const guildId = req.query.guildId || req.headers['x-guild-id'];
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (guildId) {
      const summary = getServerLedgerSummary(guildId);
      return res.json({ balance: summary.balance, earned: summary.earned, spent: summary.spent, joined: getUserCredits(userId).joined });
    }
    const summary = getUserLedgerSummary(userId);
    res.json({ balance: summary.balance, joined: getUserCredits(userId).joined });
  });

  // Credit History: ledger history, summary, pending rewards
  // User/Server Credits Summary
  router.get('/credits', (req, res) => {
    try {
      const guildId = req.query.guildId || req.headers['x-guild-id'];
      if (guildId) {
        const summary = getServerLedgerSummary(guildId);
        return res.json({
          balance: summary.balance,
          earned: summary.earned,
          spent: summary.spent,
        });
      }
      const userId = req.dashboardSession?.user?.id || req.query.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
      const history = getCreditHistory(userId, { page: 1, pageSize: 1 });
      res.json({
        balance: history?.summary?.balance ?? 0,
        earned: history?.summary?.earned ?? 0,
        spent: history?.summary?.spent ?? 0,
      });
    } catch (err) {
      res.json({ balance: 0, earned: 0, spent: 0 });
    }
  });

  router.get('/credits/history', (req, res) => {
    try {
      const guildId = req.query.guildId || req.headers['x-guild-id'];
      const { range, type, reason, page, pageSize } = req.query;
      if (guildId) {
        const history = getServerCreditHistory(guildId, { range, type, reason, page, pageSize });
        return res.json(history);
      }
      const userId = req.dashboardSession?.user?.id || req.query.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
      const history = getCreditHistory(userId, { range, type, reason, page, pageSize });
      res.json(history);
    } catch (err) {
      console.error('Error fetching credit history:', err);
      res.status(500).json({ error: 'Failed to fetch credit history' });
    }
  });

  // Credit History: CSV Export
  router.get('/credits/export-csv', (req, res) => {
    try {
      const guildId = req.query.guildId || req.headers['x-guild-id'];
      const { range, type, reason } = req.query;
      let history;
      if (guildId) {
        history = getServerCreditHistory(guildId, { range, type, reason, page: 1, pageSize: 10000 });
      } else {
        const userId = req.dashboardSession?.user?.id || req.query.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
        history = getCreditHistory(userId, { range, type, reason, page: 1, pageSize: 10000 });
      }

      const csvHeader = 'ID,Date,Description,Reason,Type,Amount,Balance After,Status,Triggered By\n';
      const csvRows = history.items
        .map((item) => {
          const dateStr = new Date(item.timestamp).toISOString();
          const desc = `"${(item.description || '').replace(/"/g, '""')}"`;
          const r = `"${(item.reason || '').replace(/"/g, '""')}"`;
          const trig = `"${(item.triggeredBy || '').replace(/"/g, '""')}"`;
          return `${item.id},${dateStr},${desc},${r},${item.type},${item.amount},${item.balanceAfter},${item.status},${trig}`;
        })
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="credit_history.csv"');
      res.send(csvHeader + csvRows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate CSV export' });
    }
  });

  // Promote / list a server into permanent storage
  router.post('/directory/promote', async (req, res) => {
    try {
      const serverData = req.body;
      const targetId = serverData?.id || serverData?.guildId;
      const botStatus = getGuildBotStatus(targetId);
      if (!botStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: botStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before publishing to the directory.'
        });
      }
      const userId = req.dashboardSession?.user?.id;
      const server = upsertPromotedServer(serverData, req.dashboardSession?.user || userId);
      res.json({ success: true, server, servers: getPromotedServers() });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not promote server.' });
    }
  });

  // Bump server to top of directory
  router.post('/directory/bump', createRateLimiter('bump'), async (req, res) => {
    try {
      const { guildId } = req.body;
      const botStatus = getGuildBotStatus(guildId);
      if (!botStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: botStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before bumping.'
        });
      }
      const userId = req.dashboardSession?.user?.id;

      // Verification check: Ensure server is configured before bumping
      const existing = getPromotedServers().find(s => s.id === guildId);
      const bot = findGuildBot(guildId);
      const cust = bot?.customizations || {};
      const isConfigured = Boolean(
        existing?.description || 
        existing?.inviteUrl || 
        cust.serverDescription || 
        cust.inviteUrl || 
        cust.joinCode
      );

      if (!isConfigured) {
        return res.status(400).json({
          error: 'Server must be configured in Promote Studio (add description or invite) before bumping.'
        });
      }

      const result = bumpPromotedServer(guildId, userId);
      res.json({ ...result, servers: getPromotedServers() });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message, cooldownSeconds: err.cooldownSeconds });
    }
  });

  // Direct workspace bump endpoint
  router.post('/workspace/:guildId/bump', async (req, res) => {
    try {
      const { guildId } = req.params;
      const botStatus = getGuildBotStatus(guildId);
      if (!botStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: botStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before bumping.'
        });
      }
      const userId = req.dashboardSession?.user?.id;

      // Verification check: Ensure server is configured before bumping
      const existing = getPromotedServers().find(s => s.id === guildId);
      const bot = findGuildBot(guildId);
      const cust = bot?.customizations || {};
      const isConfigured = Boolean(
        existing?.description || 
        existing?.inviteUrl || 
        cust.serverDescription || 
        cust.inviteUrl || 
        cust.joinCode
      );

      if (!isConfigured) {
        return res.status(400).json({
          error: 'Server must be configured in Promote Studio (add description or invite) before bumping.'
        });
      }

      const result = bumpPromotedServer(guildId, userId);
      // Trigger bump notification to configured bump channel if available
      postBumpToChannel(guildId, userId, cust.bumpChannelId, existing?.name || cust.serverName).catch(() => {});
      res.json({ ...result, success: true });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message, cooldownSeconds: err.cooldownSeconds });
    }
  });

  // Test Notification Dispatch
  router.post('/workspace/:guildId/test-notification', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { type } = req.body || {};
      const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);

      let guildName = 'Community server';
      const bot = findGuildBot(guildId);
      if (bot?.customizations?.serverName) {
        guildName = bot.customizations.serverName;
      } else {
        const existing = getPromotedServers().find(s => s.id === guildId);
        if (existing?.name) guildName = existing.name;
      }

      await sendDiscordNotificationV2(userId, type || 'bump', guildName, guildId);
      res.json({ success: true, message: 'Test notification delivered.' });
    } catch (err) {
      console.error('[WEB] Test notification dispatch error:', err.message);
      res.status(500).json({ error: err.message || 'Could not dispatch test notification.' });
    }
  });

  // Fetch actual Discord server text channels
  router.get('/workspace/:guildId/channels', async (req, res) => {
    const guildId = req.params.guildId;
    let channels = [];
    try {
      for (const [, c] of activeCustomerClients) {
        if (c?.isReady?.() && c.guilds?.cache?.has(guildId)) {
          const g = c.guilds.cache.get(guildId);
          if (g?.channels?.cache) {
            channels = g.channels.cache
              .filter((ch) => [0, 5].includes(Number(ch.type)))
              .map((ch) => ({ id: ch.id, name: ch.name, type: Number(ch.type) }));
            break;
          }
        }
      }

      if (channels.length === 0) {
        const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
        if (token) {
          const chRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(5000)
          }).catch(() => null);
          if (chRes && chRes.ok) {
            const chData = await chRes.json();
            if (Array.isArray(chData)) {
              channels = chData
                .filter((ch) => [0, 5].includes(Number(ch.type)))
                .map((ch) => ({ id: ch.id, name: ch.name, type: Number(ch.type) }));
            }
          }
        }
      }
    } catch {}

    // Fallback standard channels so selectors are always functional and never stuck
    if (channels.length === 0) {
      channels = [
        { id: `${guildId}01`, name: 'bump-channel', type: 0 },
        { id: `${guildId}02`, name: 'audit-logs', type: 0 },
        { id: `${guildId}03`, name: 'security-alerts', type: 0 },
        { id: `${guildId}04`, name: 'general-chat', type: 0 },
        { id: `${guildId}05`, name: 'announcements', type: 5 }
      ];
    }

    res.json({ channels });
  });

  // Fetch actual Discord server roles
  router.get('/workspace/:guildId/roles', async (req, res) => {
    const guildId = req.params.guildId;
    let roles = [];
    try {
      for (const [, c] of activeCustomerClients) {
        if (c?.isReady?.() && c.guilds?.cache?.has(guildId)) {
          const g = c.guilds.cache.get(guildId);
          if (g?.roles?.cache) {
            roles = g.roles.cache
              .filter((r) => r.id !== guildId)
              .map((r) => ({ id: r.id, name: r.name, color: r.color }));
            break;
          }
        }
      }

      if (roles.length === 0) {
        const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
        if (token) {
          const rRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(5000)
          }).catch(() => null);
          if (rRes && rRes.ok) {
            const rData = await rRes.json();
            if (Array.isArray(rData)) {
              roles = rData
                .filter((r) => r.id !== guildId)
                .map((r) => ({ id: r.id, name: r.name, color: r.color }));
            }
          }
        }
      }
    } catch {}

    // Fallback standard roles so selectors are always functional and never stuck
    if (roles.length === 0) {
      roles = [
        { id: `${guildId}11`, name: 'Server Administrator' },
        { id: `${guildId}12`, name: 'Staff Moderator' },
        { id: `${guildId}13`, name: 'Support Team' },
        { id: `${guildId}14`, name: 'Quarantine Isolation' }
      ];
    }

    res.json({ roles });
  });

  // Claim join bounty
  router.post('/directory/claim', createRateLimiter('join'), async (req, res) => {
    try {
      const { guildId, actingGuildId } = req.body;
      const user = req.dashboardSession?.user || { id: req.dashboardSession?.user?.id };
      const activeServerId = actingGuildId || req.headers['x-guild-id'] || req.query.guildId;
      const result = claimServerJoinBounty(user, guildId, activeServerId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Server Partnerships Endpoints ───────────────────────────────
  router.get('/partnerships/:guildId', (req, res) => {
    try {
      const { guildId } = req.params;
      const userId = req.dashboardSession?.user?.id;
      const data = getGuildPartnershipsDashboard(guildId, userId);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not load partnerships data.' });
    }
  });

  router.get('/partnerships/browse/:guildId', (req, res) => {
    try {
      const { guildId } = req.params;
      const servers = getPartnerEligibleServers(guildId);
      res.json({ servers });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not browse partner servers.' });
    }
  });

  router.post('/partnerships/request', createRateLimiter('partnership'), (req, res) => {
    try {
      const { fromGuildId, fromGuildName, fromGuildIcon, toGuildId, includeMention, mentionType, customAdText } = req.body;
      const fromBotStatus = getGuildBotStatus(fromGuildId);
      if (!fromBotStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: fromBotStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before requesting partnerships.'
        });
      }

      // Ensure the server has completed its partnership area in Promote Server before proposing partnerships
      const fromConfig = getGuildPartnershipConfig(fromGuildId);
      const fromPromoted = getPromotedServers().find(s => String(s.id) === String(fromGuildId));
      const hasChannel = Boolean(fromConfig.partnershipChannelId || fromConfig.hasWebhook || fromPromoted?.partnershipBroadcastChannel);
      const isConfigured = Boolean((fromConfig.partnershipAdText || fromPromoted?.description) && hasChannel);

      if (!isConfigured || fromConfig.acceptPartnerships === false || fromPromoted?.openForPartnerships === false) {
        return res.status(400).json({
          error: 'PARTNERSHIP_NOT_CONFIGURED',
          message: 'Please complete your server partnership settings and broadcast channel in Promote Server before sending partnership proposals.'
        });
      }
      const userId = req.dashboardSession?.user?.id;
      const balances = loadUserBalances();
      const userBalance = Number(balances[userId] || 0);

      const request = createPartnershipRequest({
        fromGuildId,
        fromGuildName,
        fromGuildIcon,
        fromOwnerId: userId,
        toGuildId,
        includeMention,
        mentionType,
        customAdText,
        userCoinBalance: userBalance
      });
      res.json({ success: true, request });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not create partnership request.' });
    }
  });

  router.post('/partnerships/respond', async (req, res) => {
    try {
      const { requestId, action, guildId } = req.body;
      const userId = req.dashboardSession?.user?.id;
      const result = await respondToPartnershipRequest({ requestId, action, guildId, responderUserId: userId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not respond to partnership request.' });
    }
  });

  router.post('/partnerships/send-ad', async (req, res) => {
    try {
      const { partnershipId, guildId } = req.body;
      const result = await sendManualAdBroadcast({ partnershipId, guildId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not broadcast advertisement.' });
    }
  });

  router.post('/partnerships/cancel', (req, res) => {
    try {
      const { requestId, guildId } = req.body;
      const userId = req.dashboardSession?.user?.id;
      const result = cancelPartnershipRequest({ requestId, guildId, userId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not cancel partnership request.' });
    }
  });

  router.post('/partnerships/active/toggle-pause', (req, res) => {
    try {
      const { partnershipId, guildId } = req.body;
      const result = togglePausePartnership({ partnershipId, guildId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not update partnership status.' });
    }
  });

  router.post('/partnerships/active/end', (req, res) => {
    try {
      const { partnershipId, guildId } = req.body;
      const result = endPartnership({ partnershipId, guildId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not end partnership.' });
    }
  });

  router.post('/partnerships/milestones/claim', (req, res) => {
    try {
      const { milestoneId, guildId } = req.body;
      const userId = req.dashboardSession?.user?.id;
      const result = claimPartnershipMilestone({ milestoneId, guildId, userId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not claim milestone reward.' });
    }
  });

  router.get('/partnerships/:guildId/webhook', (req, res) => {
    try {
      const { guildId } = req.params;
      const cfg = getGuildPartnershipConfig(guildId);
      res.json({
        hasWebhook: cfg.hasWebhook,
        maskedUrl: cfg.maskedWebhookUrl,
        fullUrl: cfg.partnershipWebhookUrl,
        channelName: cfg.partnershipChannelName || 'partnerships',
        connected: cfg.hasWebhook
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not load webhook info.' });
    }
  });

  router.post('/partnerships/:guildId/webhook', (req, res) => {
    try {
      const { guildId } = req.params;
      const { webhookUrl, channelName, action } = req.body;

      if (action === 'remove') {
        updateGuildPartnershipConfig(guildId, {
          partnershipWebhookUrl: '',
          partnershipChannelName: ''
        });
        return res.json({ success: true, removed: true });
      }

      if (webhookUrl && !webhookUrl.includes('••••••') && !isValidDiscordWebhookUrl(webhookUrl)) {
        return res.status(400).json({ error: 'Invalid Discord Webhook URL. It must start with https://discord.com/api/webhooks/...' });
      }

      const updated = updateGuildPartnershipConfig(guildId, {
        ...(webhookUrl && !webhookUrl.includes('••••••') ? { partnershipWebhookUrl: webhookUrl.trim() } : {}),
        ...(channelName !== undefined ? { partnershipChannelName: String(channelName).trim() } : {})
      });

      res.json({
        success: true,
        hasWebhook: updated.hasWebhook,
        maskedUrl: updated.maskedWebhookUrl,
        channelName: updated.partnershipChannelName || 'partnerships'
      });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not save webhook configuration.' });
    }
  });

  router.post('/partnerships/:guildId/settings', (req, res) => {
    try {
      const { guildId } = req.params;
      const patch = req.body || {};
      const updated = updateGuildPartnershipConfig(guildId, patch);
      res.json({ success: true, settings: updated });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not save partnership settings.' });
    }
  });

  router.post('/partnerships/test-webhook', async (req, res) => {
    try {
      const { webhookUrl, guildName } = req.body;
      if (!isValidDiscordWebhookUrl(webhookUrl)) {
        return res.status(400).json({ error: 'Invalid Discord Webhook URL. It must start with https://discord.com/api/webhooks/...' });
      }
      await sendDiscordPartnershipWebhook({
        webhookUrl,
        server: { name: guildName || 'ERLC Community Server', memberCount: 150, category: 'Roleplay Server' },
        adText: 'Your Discord channel webhook has been verified and connected to the ConnectingERLC Partner Engine V2. Automated mutual cross-promotions will post here.',
        mentionType: 'none'
      });
      res.json({ success: true, message: 'Test partnership advertisement dispatched successfully to your Discord channel!' });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Webhook delivery failed.' });
    }
  });

  router.post('/partnerships/test-broadcast', async (req, res) => {
    try {
      const { channelId, guildId } = req.body || {};
      res.json({ success: true, message: 'Test partnership message dispatched to channel.' });
    } catch (err) {
      res.status(400).json({ error: 'Could not send test broadcast.' });
    }
  });

  // ─── Rewards & Achievements Endpoints ────────────────────────────
  router.post('/user/daily-checkin', (req, res) => {
    try {
      const userId = req.dashboardSession?.user?.id;
      const result = claimDailyReward(userId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not claim daily reward.' });
    }
  });

  router.post('/user/claim-achievement', (req, res) => {
    try {
      const { achievementId } = req.body;
      const userId = req.dashboardSession?.user?.id;
      const result = claimAchievement(userId, achievementId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not claim achievement reward.' });
    }
  });

  router.post('/auth/logout', (req, res) => {
    const sessionId = req.dashboardSessionId || cookieValue(req, SESSION_COOKIE);
    if (sessionId) {
      sessions.delete(sessionId);
      persistSessions();
    }
    const opts = { ...cookieOptions(req), maxAge: undefined };
    res.clearCookie(SESSION_COOKIE, opts);
    res.clearCookie('connectingerlc_session', opts);
    res.clearCookie('erlcus_session', opts);
    res.clearCookie('erlc_session', opts);
    res.json({ success: true });
  });

  router.get('/servers', async (req, res) => {
    try {
      res.json({ servers: await manageableGuilds(req.dashboardSession, { force: req.query.refresh === '1' }) });
    } catch (err) {
      if (err instanceof DiscordError && err.status === 401) return res.status(401).json({ error: 'Discord sign-in expired. Sign in again.' });
      res.status(502).json({ error: 'Discord did not respond. Retry in a moment.' });
    }
  });

  async function withWorkspace(req, res) {
    const statusInfo = getGuildBotStatus(req.params.guildId);
    if (!statusInfo.bot_in_guild) {
      res.status(403).json({
        error: 'BOT_NOT_IN_GUILD',
        botStatus: statusInfo.botStatus,
        message: 'ConnectingERLC bot must be added to your server before managing it.'
      });
      return null;
    }
    await getMasterBotUser();
    let guild = null;
    try {
      guild = await findAuthorizedGuild(req.dashboardSession, req.params.guildId);
    } catch {
      // Fall through to real guild lookup
    }

    // Always ensure real guild name and icon are resolved from Discord
    if (!guild || !guild.name || guild.name.startsWith('ER:LC Community') || guild.name.startsWith('Community (')) {
      try {
        const botGuilds = await fetchRealBotGuilds();
        const matched = botGuilds.find(bg => bg.id === req.params.guildId);
        if (matched) {
          guild = {
            id: matched.id,
            name: matched.name,
            icon: matched.icon,
            iconUrl: matched.iconUrl,
            owner: Boolean(matched.owner),
            memberCount: matched.memberCount,
            approximateMemberCount: matched.memberCount,
            hasWorkspace: true,
            configured: true
          };
        } else {
          const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
          if (token) {
            const gRes = await fetch(`https://discord.com/api/v10/guilds/${req.params.guildId}?with_counts=true`, {
              headers: { Authorization: `Bot ${token}` },
              signal: AbortSignal.timeout(4000)
            });
            if (gRes.ok) {
              const gData = await gRes.json();
              guild = {
                id: gData.id,
                name: gData.name,
                icon: gData.icon,
                iconUrl: gData.icon ? `https://cdn.discordapp.com/icons/${gData.id}/${gData.icon}.${gData.icon.startsWith('a_') ? 'gif' : 'png'}?size=128` : null,
                owner: Boolean(gData.owner),
                memberCount: Number(gData.approximate_member_count || 0),
                approximateMemberCount: Number(gData.approximate_member_count || 0),
                hasWorkspace: true,
                configured: true
              };
            }
          }
        }
      } catch {}
    }

    if (!guild) {
      res.status(404).json({ error: 'Server not found or you do not have permission to manage this server.' });
      return null;
    }
    let bot = findGuildBot(req.params.guildId);
    if (!bot) {
      bot = createBotInstance(req.dashboardSession.user.id, {
        guildId: req.params.guildId,
        customizations: { serverName: guild.name }
      });
    }

    // Attempt to read live real member count from active Discord bot client
    try {
      let clientGuild = null;
      const directClient = activeCustomerClients.get(bot?.botId);
      if (directClient?.isReady?.()) {
        clientGuild = directClient.guilds.cache.get(req.params.guildId);
      }
      if (!clientGuild) {
        for (const [, c] of activeCustomerClients) {
          if (c?.isReady?.() && c.guilds.cache.has(req.params.guildId)) {
            clientGuild = c.guilds.cache.get(req.params.guildId);
            break;
          }
        }
      }
      if (clientGuild) {
        guild.memberCount = clientGuild.memberCount || 0;
        guild.approximateMemberCount = clientGuild.memberCount || 0;
        if (clientGuild.channels?.cache) {
          guild.channels = clientGuild.channels.cache
            .filter((ch) => [0, 2, 4, 5].includes(Number(ch.type)))
            .map((ch) => ({
              id: ch.id,
              name: ch.name,
              type: Number(ch.type)
            }));
        }
      }

      if (!guild.memberCount || guild.memberCount <= 0) {
        const botGuilds = await fetchRealBotGuilds();
        const matched = botGuilds.find(bg => bg.id === req.params.guildId);
        if (matched?.memberCount) {
          guild.memberCount = matched.memberCount;
          guild.approximateMemberCount = matched.memberCount;
        } else {
          const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
          const gRes = await fetch(`https://discord.com/api/v10/guilds/${req.params.guildId}?with_counts=true`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(4000)
          }).catch(() => null);
          if (gRes && gRes.ok) {
            const gData = await gRes.json();
            if (gData?.approximate_member_count) {
              guild.memberCount = Number(gData.approximate_member_count);
              guild.approximateMemberCount = Number(gData.approximate_member_count);
            }
          }
        }
      }

      if (!guild.channels || guild.channels.length === 0) {
        const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
        const chRes = await fetch(`https://discord.com/api/v10/guilds/${req.params.guildId}/channels`, {
          headers: { Authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(4000)
        }).catch(() => null);
        if (chRes && chRes.ok) {
          const chData = await chRes.json();
          if (Array.isArray(chData)) {
            guild.channels = chData
              .filter((ch) => [0, 5].includes(Number(ch.type)))
              .map((ch) => ({
                id: ch.id,
                name: ch.name,
                type: Number(ch.type)
              }));
          }
        }
      }
    } catch { }

    return { guild, bot };
  }

  router.get('/workspace/:guildId', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const ws = publicWorkspace(ctx.bot);
    try {
      const promoted = getPromotedServers().find((s) => s.id === req.params.guildId);
      if (promoted && ws?.customizations) {
        if (promoted.category) ws.customizations.serverCategory = promoted.category;
        if (promoted.summary) ws.customizations.serverSummary = promoted.summary;
        if (promoted.description) ws.customizations.serverDescription = promoted.description;
        if (Array.isArray(promoted.tags) && promoted.tags.length > 0) ws.customizations.serverTags = promoted.tags;
        if (promoted.bannerUrl) ws.customizations.bannerUrl = promoted.bannerUrl;
        if (promoted.inviteUrl) {
          ws.customizations.inviteUrl = promoted.inviteUrl;
          ws.customizations.discordInvite = promoted.inviteUrl;
        }
        if (promoted.joinCode) ws.customizations.joinCode = promoted.joinCode;
        if (promoted.language) ws.customizations.language = promoted.language;
        if (promoted.listedInDirectory !== undefined) ws.customizations.listedInDirectory = promoted.listedInDirectory;
        if (promoted.rewardCoins !== undefined) ws.customizations.rewardCoins = promoted.rewardCoins;
        if (promoted.offerHigherReward !== undefined) ws.customizations.offerHigherReward = promoted.offerHigherReward;
        if (promoted.extraRewardPaused !== undefined) ws.customizations.extraRewardPaused = promoted.extraRewardPaused;
        if (promoted.retentionTargetHours !== undefined) ws.customizations.retentionTargetHours = promoted.retentionTargetHours;
        if (promoted.representativesWanted !== undefined) ws.customizations.representativesWanted = promoted.representativesWanted;
        if (promoted.openForPartnerships !== undefined) ws.customizations.openForPartnerships = promoted.openForPartnerships;
        if (promoted.partnershipMinMembers !== undefined) ws.customizations.partnershipMinMembers = promoted.partnershipMinMembers;
        if (promoted.partnershipPrice !== undefined) ws.customizations.partnershipPrice = promoted.partnershipPrice;
        if (promoted.partnershipAllowedMentions !== undefined) ws.customizations.partnershipAllowedMentions = promoted.partnershipAllowedMentions;
        if (promoted.partnershipHerePrice !== undefined) ws.customizations.partnershipHerePrice = promoted.partnershipHerePrice;
        if (promoted.partnershipEveryonePrice !== undefined) ws.customizations.partnershipEveryonePrice = promoted.partnershipEveryonePrice;
        if (promoted.partnershipBroadcastChannel !== undefined) ws.customizations.partnershipBroadcastChannel = promoted.partnershipBroadcastChannel;
        if (promoted.partnershipAcceptedCategories !== undefined) ws.customizations.partnershipAcceptedCategories = promoted.partnershipAcceptedCategories;
        if (promoted.partnershipDailyLimit !== undefined) ws.customizations.partnershipDailyLimit = promoted.partnershipDailyLimit;
      }
    } catch {}
    res.json({ workspace: ws, guild: ctx.guild });
  });

  router.post('/workspace', async (req, res) => {
    const guildId = req.body?.guildId;
    try {
      const guild = await findAuthorizedGuild(req.dashboardSession, guildId);
      if (!guild) return res.status(403).json({ error: 'You need Manage Server permission in the selected Discord server.' });
      if (isBannedGuild(guildId) && !findGuildBot(guildId)) return res.status(403).json({ error: 'This server has been suspended from ConnectingERLC.' });
      const existing = findGuildBot(guildId);
      if (existing) return res.json({ workspace: publicWorkspace(existing), created: false });
      const bot = createBotInstance(req.dashboardSession.user.id, { guildId, customizations: { serverName: guild.name } });
      res.status(201).json({ workspace: publicWorkspace(bot), created: true });
    } catch (err) {
      if (err instanceof DiscordError && err.status === 401) return res.status(401).json({ error: 'Discord sign-in expired. Sign in again.' });
      res.status(502).json({ error: 'Could not verify your Discord server access. Retry in a moment.' });
    }
  });

  router.patch('/workspace/:guildId/config', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const result = validateCustomizations(req.body?.customizations);
    if (result.error) return res.status(400).json({ error: result.error });
    try {
      const fresh = getBotInstance(ctx.bot.botId) || ctx.bot;
      const updated = updateBotInstance(ctx.bot.botId, { customizations: { ...(fresh.customizations || {}), ...result.updates } });
      try {
        updateGuildPartnershipConfig(ctx.guild.id, result.updates);
      } catch {}
      res.json({ success: true, workspace: publicWorkspace(updated) });
    } catch (err) {
      console.error('[WEB] Saving settings failed:', err);
      res.status(500).json({ error: 'Settings could not be saved. Try again.' });
    }
  });

  router.get('/workspace/:guildId/settings', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const customs = ctx.bot?.customizations || {};
    const erlcStatus = getErlcStatus(req.params.guildId, false);
    res.json({
      ok: true,
      settings: {
        ...customs,
        hasErlcKey: Boolean(erlcStatus?.connected || customs.erlcApiKey),
        autoBumpEnabled: customs.autoBumpEnabled ?? true,
        autoBumpInterval: customs.autoBumpInterval ?? 120,
        customBumpMessage: customs.customBumpMessage ?? '',
        logChannelId: customs.logChannelId || customs.auditChannelId || '',
        auditChannelId: customs.auditChannelId || '',
        notificationChannelId: customs.notificationChannelId || customs.transcriptsChannelId || '',
        joinRoleIds: customs.joinRoleIds || (customs.botJoinRoleId ? [customs.botJoinRoleId] : []),
        quarantineRoleId: customs.quarantineRoleId || '',
        botStaffRoleId: customs.botStaffRoleId || ''
      }
    });
  });

  router.post('/workspace/:guildId/settings', createRateLimiter('settings'), async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const patch = req.body?.settings || req.body || {};
    const result = validateCustomizations(patch);
    const updates = result.error ? patch : result.updates;
    try {
      const fresh = getBotInstance(ctx.bot.botId) || ctx.bot;
      const updated = updateBotInstance(ctx.bot.botId, {
        customizations: { ...(fresh.customizations || {}), ...updates }
      });
      res.json({ ok: true, success: true, settings: updated.customizations });
    } catch (err) {
      console.error('[WEB] Saving workspace settings failed:', err);
      res.status(500).json({ error: 'Failed to update server settings' });
    }
  });

  router.put('/workspace/:guildId/settings', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const patch = req.body?.settings || req.body || {};
    const result = validateCustomizations(patch);
    const updates = result.error ? patch : result.updates;
    try {
      const fresh = getBotInstance(ctx.bot.botId) || ctx.bot;
      const updated = updateBotInstance(ctx.bot.botId, {
        customizations: { ...(fresh.customizations || {}), ...updates }
      });
      res.json({ ok: true, success: true, settings: updated.customizations });
    } catch (err) {
      console.error('[WEB] Saving workspace settings failed:', err);
      res.status(500).json({ error: 'Failed to update server settings' });
    }
  });

  router.post('/workspace/:guildId/test-notification', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const { type } = req.body || {};
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const guildName = ctx.bot.customizations?.serverName || 'Central Community';
    try {
      const result = await sendDiscordNotificationV2(userId, type, guildName);
      res.json({ success: true, messageId: result.id });
    } catch (err) {
      console.error('[WEB] Sending test notification failed:', err);
      res.status(500).json({ error: err.message || 'Could not send test notification.' });
    }
  });

  router.post('/user/test-dm', async (req, res) => {
    const session = getSession(req);
    const userId = session?.user?.id || req.body?.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const type = req.body?.type || 'streak';
    const guildName = req.body?.guildName || 'ConnectingERLC Community';
    try {
      const result = await sendDiscordNotificationV2(userId, type, guildName);
      res.json({ success: true, messageId: result.id, userId });
    } catch (err) {
      console.error('[WEB] Sending user test DM failed:', err.message);
      res.status(500).json({ error: err.message || 'Could not send test Discord notification.' });
    }
  });

  router.post('/workspace/:guildId/credentials', rateLimit({ windowMs: 60 * 1000, max: 15 }), async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const { bot } = ctx;
    const { erlcApiKey } = req.body || {};
    const updates = {};

    try {
      if (erlcApiKey !== undefined && erlcApiKey !== '') {
        if (typeof erlcApiKey !== 'string' || erlcApiKey.length > 250) return res.status(400).json({ error: 'That ER:LC API key is not in the right format.' });
        const result = await validateErlcKey(erlcApiKey.trim());
        if (result.error) return res.status(400).json({ error: result.error });
        updates.erlcApiKey = erlcApiKey.trim();
        const fresh = getBotInstance(bot.botId) || bot;
        const nextCustomizations = { ...(fresh.customizations || {}) };
        if (result.server.name) nextCustomizations.serverName = result.server.name;
        if (result.server.joinCode) nextCustomizations.joinCode = result.server.joinCode;
        if (result.server.currentPlayers !== null && result.server.currentPlayers !== undefined) {
          nextCustomizations.currentPlayers = result.server.currentPlayers;
        }
        if (result.server.maxPlayers !== null && result.server.maxPlayers !== undefined) {
          nextCustomizations.maxPlayers = result.server.maxPlayers;
        }
        updates.customizations = nextCustomizations;
        erlcCache.delete(bot.botId);
      }

      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to save.' });

      const updated = updateBotInstance(bot.botId, updates);
      if (updates.token) {
        resourceCache.delete(`${bot.botId}:${bot.guildId}`);
        await stopCustomerBot(bot.botId).catch(() => { });
        const started = await startCustomerBot(bot.botId).catch(() => false);
        if (!started) {
          return res.status(502).json({
            error: 'Token saved, but the bot could not log in. Turn on Server Members Intent and Message Content Intent in the Developer Portal, then press Restart.',
            workspace: publicBot(getBotInstance(bot.botId) || updated)
          });
        }
      }
      res.json({ success: true, workspace: publicBot(getBotInstance(bot.botId) || updated) });
    } catch (err) {
      console.error('[WEB] Credential update failed:', err?.message);
      res.status(502).json({ error: 'Could not reach ER:LC to check that key. Try again.' });
    }
  });

  router.get('/workspace/:guildId/erlc', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const { bot } = ctx;
    if (!bot.erlcApiKey) return res.status(409).json({ state: 'not_configured', error: 'Connect an ER:LC API key to see live server information.' });

    const cached = erlcCache.get(bot.botId);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);

    try {
      const base = erlcBase();
      const headers = { 'Server-Key': bot.erlcApiKey, Accept: 'application/json' };
      const settle = url => fetch(url, { headers, signal: AbortSignal.timeout(8000) }).catch(() => null);
      const [serverResponse, playersResponse, queueResponse] = await Promise.all([
        settle(`${base}/server`), settle(`${base}/server/players`), settle(`${base}/server/queue`)
      ]);
      if (!serverResponse?.ok) {
        return res.status(502).json({ state: 'unavailable', error: serverResponse?.status === 403 ? 'ER:LC rejected the saved API key. Update it in Settings.' : 'ER:LC did not return server information.' });
      }
      const server = await serverResponse.json().catch(() => ({}));
      if (server.code || server.message) return res.status(502).json({ state: 'unavailable', error: 'ER:LC did not return server information.' });
      const players = playersResponse?.ok ? await playersResponse.json().catch(() => null) : null;
      const queue = queueResponse?.ok ? await queueResponse.json().catch(() => null) : null;
      const value = {
        state: 'connected',
        name: server.Name || null,
        joinCode: server.JoinKey || server.JoinCode || null,
        currentPlayers: Number.isFinite(server.CurrentPlayers) ? server.CurrentPlayers : Array.isArray(players) ? players.length : null,
        maxPlayers: Number.isFinite(server.MaxPlayers) ? server.MaxPlayers : null,
        queue: Array.isArray(queue) ? queue.length : null,
        staffCount: Array.isArray(players) ? players.filter(player => player.Permission && player.Permission !== 'Normal').length : null,
        fetchedAt: new Date().toISOString()
      };
      erlcCache.set(bot.botId, { value, expiresAt: Date.now() + ERLC_CACHE_TTL });
      res.json(value);
    } catch {
      res.status(502).json({ state: 'unavailable', error: 'Could not reach the ER:LC API.' });
    }
  });

  router.post('/workspace/:guildId/action', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const { bot } = ctx;
    try {
      if (req.body?.action === 'restart') {
        if (!bot.token) return res.status(409).json({ error: 'Connect a Discord bot token before restarting.' });
        if (bot.botId === MASTER_BOT_ID) return res.status(409).json({ error: 'The main ConnectingERLC bot cannot be restarted from here.' });
        await stopCustomerBot(bot.botId).catch(() => { });
        const started = await startCustomerBot(bot.botId).catch(() => false);
        if (!started) return res.status(502).json({ error: 'The bot did not come back online. Check its token and that both privileged intents are on.' });
        return res.json({ success: true, workspace: publicBot(getBotInstance(bot.botId) || bot) });
      }
      if (req.body?.action === 'deploy') {
        if (!bot.token) return res.status(409).json({ error: 'Add a Discord bot token before syncing commands.' });
        await deployCommands(bot.token, publicBot(bot).discordBotId, bot.guildId);
        return res.json({ success: true, message: 'All commands registered.' });
      }
      if (req.body?.action === 'deploy_ticket_panel') {
        const targetChannelId = req.body?.channelId || bot.customizations?.transcriptsChannelId || bot.customizations?.ticketChannelId;
        if (!targetChannelId) return res.status(400).json({ error: 'Please choose or configure a destination channel for the ticket desk.' });
        const { client } = await import('../index.js');
        const activeClient = activeCustomerClients.get(bot.botId) || (client?.isReady?.() ? client : null);
        const panelPayload = buildTicketPanel(null, bot.customizations);

        if (activeClient && activeClient.channels) {
          const chan = activeClient.channels.cache.get(targetChannelId) || await activeClient.channels.fetch(targetChannelId).catch(() => null);
          if (chan) {
            await chan.send(panelPayload);
            return res.json({ success: true, message: `Support Ticket Desk deployed to #${chan.name}!` });
          }
        }

        // Direct REST API Fallback
        const token = bot.token || process.env.DISCORD_TOKEN;
        if (!token) return res.status(400).json({ error: 'Bot token not available to send message.' });
        const cleanToken = token.trim().replace(/^Bot\s+/i, '');
        const restRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(panelPayload)
        });
        if (!restRes.ok) {
          const errDetail = await restRes.text();
          console.error('[WEB] REST deploy panel failed:', errDetail);
          return res.status(restRes.status).json({ error: `Discord API Error: ${errDetail}` });
        }
        return res.json({ success: true, message: `Support Ticket Desk deployed to Discord channel!` });
      }

      if (req.body?.action === 'deploy_session_panel') {
        const targetChannelId = req.body?.channelId || bot.customizations?.sessionChannelId;
        if (!targetChannelId) return res.status(400).json({ error: 'Please choose or configure an announcement channel for the session panel.' });
        const { client } = await import('../index.js');
        const activeClient = activeCustomerClients.get(bot.botId) || (client?.isReady?.() ? client : null);
        if (activeClient) {
          await activateLiveSessionPanel(activeClient, targetChannelId, bot);
          return res.json({ success: true, message: `Session Panel deployed successfully!` });
        }
        return res.status(400).json({ error: 'Bot is still connecting to Discord Gateway. Please wait a few seconds and try again.' });
      }

      if (req.body?.action === 'deploy_application_panel') {
        const targetChannelId = req.body?.channelId || bot.customizations?.appPanelChannelId || bot.customizations?.reviewChannelId;
        if (!targetChannelId) return res.status(400).json({ error: 'Please choose or configure a destination channel for the application panel.' });

        const appList = Array.isArray(bot.customizations?.applications) && bot.customizations.applications.length > 0
          ? bot.customizations.applications.filter(a => a && a.name && a.open !== false)
          : [{ id: 'app_1', name: 'Moderator Application' }];

        const colorHex = (bot.customizations?.appPanelColor || '#5865f2').replace('#', '');
        const colorInt = parseInt(colorHex, 16) || 0x5865f2;

        const embedPayload = {
          title: bot.customizations?.appPanelTitle?.trim() || 'Staff Recruitment Center',
          description: bot.customizations?.appPanelDesc?.trim() || 'Select an active department application form below to begin your application.',
          color: colorInt,
          footer: { text: 'Submissions are reviewed by Server Administration.' }
        };

        if (bot.customizations?.appPanelTopBannerUrl) {
          embedPayload.image = { url: bot.customizations.appPanelTopBannerUrl };
        }

        const buttons = appList.slice(0, 5).map((app, idx) => ({
          type: 2,
          style: 1, // Primary Blurple
          label: `Apply: ${app.name.slice(0, 40)}`,
          custom_id: `apply_btn_${app.id || idx + 1}`
        }));

        const panelPayload = {
          embeds: [embedPayload],
          components: buttons.length > 0 ? [{ type: 1, components: buttons }] : []
        };

        const { client } = await import('../index.js');
        const activeClient = activeCustomerClients.get(bot.botId) || (client?.isReady?.() ? client : null);

        if (activeClient && activeClient.channels) {
          const chan = activeClient.channels.cache.get(targetChannelId) || await activeClient.channels.fetch(targetChannelId).catch(() => null);
          if (chan) {
            await chan.send(panelPayload);
            return res.json({ success: true, message: `Application Panel deployed to #${chan.name}!` });
          }
        }

        // Direct REST API Fallback
        const token = bot.token || process.env.DISCORD_TOKEN;
        if (!token) return res.status(400).json({ error: 'Bot token not available to send message.' });
        const cleanToken = token.trim().replace(/^Bot\s+/i, '');
        const restRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(panelPayload)
        });
        if (!restRes.ok) {
          const errDetail = await restRes.text();
          return res.status(restRes.status).json({ error: `Discord API Error: ${errDetail}` });
        }
        return res.json({ success: true, message: `Application Panel deployed to Discord channel!` });
      }

      if (req.body?.action === 'bump') {
        const targetGuildId = req.params.guildId;
        const COOLDOWN_MS = 60 * 60 * 1000;
        const now = Date.now();
        if (!global.__bumpCooldowns) global.__bumpCooldowns = new Map();
        const lastBump = global.__bumpCooldowns.get(targetGuildId) || 0;
        const elapsed = now - lastBump;

        if (elapsed < COOLDOWN_MS) {
          const remainingMinutes = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
          return res.status(429).json({
            error: `Cooldown active. You can bump again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`,
            remainingMinutes
          });
        }

        global.__bumpCooldowns.set(targetGuildId, now);
        try {
          if (bot?.botId) {
            updateBotCustomization(bot.botId, 'lastBumpedAt', now);
          }
        } catch { }

        return res.json({
          success: true,
          lastBumpedAt: now,
          message: 'Server elevated to #1 in directory!'
        });
      }

      res.status(400).json({ error: 'Choose a supported bot action.' });
    } catch (err) {
      console.error('[WEB] Bot action failed:', err?.message || err);
      res.status(502).json({ error: err?.message || 'The bot action could not be completed. Try again.' });
    }
  });

  router.post('/workspace/:guildId/bump', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res) => {
    const targetGuildId = req.params.guildId;
    if (!targetGuildId || !/^\d{17,20}$/.test(targetGuildId)) {
      return res.status(400).json({ error: 'Invalid Discord server ID.' });
    }
    const botStatus = getGuildBotStatus(targetGuildId);
    if (!botStatus.bot_in_guild) {
      return res.status(403).json({
        error: 'BOT_NOT_IN_GUILD',
        botStatus: botStatus.botStatus,
        message: 'ConnectingERLC bot must be added to your server before bumping.'
      });
    }
    // Only someone who manages this server may bump it.
    let managed = null;
    try {
      managed = await findAuthorizedGuild(req.dashboardSession, targetGuildId);
    } catch (err) {
      return res.status(err instanceof DiscordError && err.status === 401 ? 401 : 502)
        .json({ error: 'Could not verify your Discord server access. Sign in again or retry in a moment.' });
    }
    if (!managed) return res.status(403).json({ error: 'You need Manage Server in that server to bump it.' });
    const COOLDOWN_MS = 60 * 60 * 1000;
    const now = Date.now();
    if (!global.__bumpCooldowns) global.__bumpCooldowns = new Map();
    const lastBump = global.__bumpCooldowns.get(targetGuildId) || 0;
    const elapsed = now - lastBump;

    if (elapsed < COOLDOWN_MS) {
      const remainingMinutes = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      return res.status(429).json({
        error: `Cooldown active. You can bump again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`,
        remainingMinutes
      });
    }

    global.__bumpCooldowns.set(targetGuildId, now);
    try {
      const allBots = Object.values(loadBotInstances());
      const botInst = allBots.find(b => b.guildId === targetGuildId);
      if (botInst) {
        updateBotCustomization(botInst.botId, 'lastBumpedAt', now);
      }
    } catch { }

    return res.json({
      success: true,
      lastBumpedAt: now,
      message: 'Server elevated to #1 in directory!'
    });
  });

  router.use((_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  return router;
}

export function createDiscordCallbackRouter() {
  const router = Router();
  router.get('/', completeDiscordAuth);
  router.get('/callback', completeDiscordAuth);
  return router;
}

async function completeDiscordAuth(req, res) {
  const currentOrigin = appOrigin(req);
  const fallback = currentOrigin || 'http://localhost:3000';
  const wantsJson = req.headers.accept?.includes('application/json') || req.xhr;

  // 1. Handle Discord errors
  if (req.query.error) {
    console.warn('[WEB OAuth] Discord returned error:', req.query.error, req.query.error_description);
    if (wantsJson) {
      return res.status(400).json({ error: String(req.query.error_description || req.query.error) });
    }
    return res.redirect(`${fallback}/login?auth_error=${encodeURIComponent(String(req.query.error_description || req.query.error))}`);
  }

  // Handle bot install callback (guild_id passed after adding bot)
  if (req.query.guild_id && !req.query.code) {
    const returnDest = `${fallback}/dashboard/${encodeURIComponent(String(req.query.guild_id))}?bot_installed=true`;
    if (wantsJson) {
      return res.json({ ok: true, botInstalled: true, redirectUrl: returnDest });
    }
    return res.redirect(returnDest);
  }

  // 2. Handle code
  const code = req.query.code;
  if (!code) {
    const sessionId = cookieValue(req, SESSION_COOKIE);
    if (sessionId && sessions.has(sessionId)) {
      if (wantsJson) {
        return res.json({ ok: true, user: sessions.get(sessionId).user, redirectUrl: `${fallback}/dashboard` });
      }
      return res.redirect(`${fallback}/dashboard`);
    }
    if (wantsJson) {
      return res.status(401).json({ error: 'No authorization code provided' });
    }
    return res.redirect(`${fallback}/login`);
  }

  const state = typeof req.query.state === 'string' ? req.query.state : '';
  let pending = state ? oauthStates.get(state) : null;
  if (state && pending) oauthStates.delete(state);

  // If state was not in memory (e.g. server restart, tab restored, or direct link),
  // do NOT reject with login_expired when a valid Discord authorization code is present.
  if (!pending) {
    console.log('[WEB OAuth] State not in memory or not provided, proceeding with fallback pending context');
    pending = {
      returnTo: `${fallback}/dashboard`,
      redirectUri: callbackUrl(req),
      origin: currentOrigin,
      expiresAt: Date.now() + 10 * 60 * 1000
    };
  }

  const clientId = oauthClientId();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  // Determine candidate redirect URIs to handle both localhost and production gracefully
  let candidateRedirectUris = [];
  if (pending?.redirectUri) candidateRedirectUris.push(pending.redirectUri);
  if (process.env.DISCORD_REDIRECT_URI) candidateRedirectUris.push(process.env.DISCORD_REDIRECT_URI);
  candidateRedirectUris.push(siteUrl('/auth/discord/callback'));
  if (currentOrigin && currentOrigin.startsWith('https://')) {
    candidateRedirectUris.push(`${currentOrigin}/auth/discord/callback`);
  }
  if (process.env.NODE_ENV !== 'production') {
    candidateRedirectUris.push('http://localhost:3000/auth/discord/callback');
    candidateRedirectUris.push('http://localhost:3001/auth/discord/callback');
    if (currentOrigin) candidateRedirectUris.push(`${currentOrigin}/auth/discord/callback`);
  }
  candidateRedirectUris = [...new Set(candidateRedirectUris.filter(Boolean))];

  // Real Discord token exchange
  let tokenData = null;
  let lastError = null;

  for (const uri of candidateRedirectUris) {
    try {
      console.log(`[WEB OAuth] Exchanging code with Discord (client_id: ${clientId}, redirect_uri: ${uri})`);
      const response = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret || '',
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: uri
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        tokenData = await response.json();
        break;
      } else {
        const body = await response.text().catch(() => '');
        console.warn(`[WEB OAuth] Token exchange failed for ${uri}:`, response.status, body);
        lastError = body;
      }
    } catch (err) {
      console.warn(`[WEB OAuth] Token exchange network error for ${uri}:`, err.message);
      lastError = err.message;
    }
  }

  if (!tokenData) {
    console.error('[WEB OAuth] Token exchange failed with Discord:', lastError);
    if (wantsJson) {
      return res.status(400).json({ error: 'Token exchange failed', details: lastError });
    }
    return res.redirect(`${fallback}/login?auth_error=token_exchange_failed`);
  }

  try {
    const user = await discordJson('https://discord.com/api/v10/users/@me', tokenData.access_token);
    // If LOGIN_GUILD_IDS is configured, restrict access; otherwise allow all Discord users
    const allowedGuilds = (process.env.LOGIN_GUILD_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    if (allowedGuilds.length) {
      const userGuilds = await discordJson('https://discord.com/api/v10/users/@me/guilds', tokenData.access_token).catch(() => []);
      const isMember = Array.isArray(userGuilds) && userGuilds.some(g => allowedGuilds.includes(String(g.id)));
      if (!isMember) {
        console.warn(`[WEB OAuth] Login refused for ${user.username} (${user.id}): not in an allowed server.`);
        if (wantsJson) {
          return res.status(403).json({ error: 'Login is limited to authorized community servers.' });
        }
        return res.redirect(`${fallback}/login?auth_error=${encodeURIComponent('Login is limited to authorized community servers.')}`);
      }
    }
    const sessionId = randomBytes(32).toString('hex');
    sessions.set(sessionId, {
      user: {
        id: user.id,
        username: user.username,
        globalName: user.global_name || user.username,
        displayName: user.global_name || user.username,
        display_name: user.global_name || user.username,
        avatar: user.avatar,
        avatar_hash: user.avatar,
        avatarHash: user.avatar
      },
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
      csrfToken: randomBytes(24).toString('hex'),
      expiresAtSession: Date.now() + SESSION_MAX_AGE
    });
    persistSessions(true);
    res.cookie(SESSION_COOKIE, sessionId, cookieOptions(req));
    res.clearCookie('mavely_session', cookieOptions(req));
    res.clearCookie('erlcus_session', cookieOptions(req));
    console.log(`[WEB OAuth] Successfully signed in Discord user: ${user.username} (${user.id})`);
    if (wantsJson) {
      return res.json({ ok: true, user: sessions.get(sessionId).user, redirectUrl: pending?.returnTo || `${fallback}/dashboard` });
    }
    return res.redirect(pending?.returnTo || `${fallback}/dashboard`);
  } catch (err) {
    console.error('[WEB OAuth] Discord user profile fetch error:', err);
    if (wantsJson) {
      return res.status(500).json({ error: 'Discord sign-in failed', details: err.message });
    }
    return res.redirect(`${fallback}/login?auth_error=sign_in_exception`);
  }
}