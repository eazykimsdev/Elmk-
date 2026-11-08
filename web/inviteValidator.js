import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPromotedServers, saveDirectoryData, loadDirectoryData, recordUserJoin } from './directoryManager.js';

function getBotToken() {
  return process.env.DISCORD_BOT_TOKEN || null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const INTENTS_FILE = path.join(DATA_DIR, 'join_intents.json');

// In-memory 5-minute cache for invite validations
const validationCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function extractInviteCode(input) {
  if (!input) return null;
  const str = String(input).trim();
  // Match discord.gg/code, discord.com/invite/code, or bare code
  const match = str.match(/(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)?([a-zA-Z0-9-]+)/i);
  return match ? match[1] : str;
}

export function normalizeInviteUrl(input) {
  const code = extractInviteCode(input);
  return code ? `https://discord.gg/${code}` : '';
}

/**
 * Validate a Discord invite link through Discord REST API
 * @param {string} inviteInput 
 * @param {string|null} expectedGuildId 
 * @param {boolean} forceFresh 
 */
export async function validateDiscordInvite(inviteInput, expectedGuildId = null, forceFresh = false) {
  const code = extractInviteCode(inviteInput);
  if (!code) {
    return {
      valid: false,
      reason: 'unknown',
      message: 'No invite code provided'
    };
  }

  const cacheKey = `${code}:${expectedGuildId || 'any'}`;
  if (!forceFresh && validationCache.has(cacheKey)) {
    const cached = validationCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.result;
    }
  }

  try {
    const botToken = getBotToken();
    const headers = {};
    if (botToken) {
      headers['Authorization'] = `Bot ${botToken}`;
    }

    const res = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true&with_expiration=true`, {
      headers,
      signal: AbortSignal.timeout(6000)
    });

    if (res.status === 404 || res.status === 400) {
      const result = {
        valid: false,
        reason: 'expired',
        code,
        message: 'Invite link is expired or invalid'
      };
      validationCache.set(cacheKey, { timestamp: Date.now(), result });
      return result;
    }

    if (!res.ok) {
      const result = {
        valid: false,
        reason: 'unknown',
        code,
        message: 'Could not verify invite with Discord'
      };
      return result;
    }

    const data = await res.json();

    // Check guild id matches
    if (expectedGuildId && data.guild && String(data.guild.id) !== String(expectedGuildId)) {
      const result = {
        valid: false,
        reason: 'wrong_server',
        code,
        guildId: data.guild.id,
        guildName: data.guild.name,
        message: 'Invite points to a different Discord server'
      };
      validationCache.set(cacheKey, { timestamp: Date.now(), result });
      return result;
    }

    // Check permanent expiration: expires_at must be null
    if (data.expires_at !== null && data.expires_at !== undefined) {
      const result = {
        valid: false,
        reason: 'temporary',
        code,
        expiresAt: data.expires_at,
        message: 'Invite is temporary and will expire'
      };
      validationCache.set(cacheKey, { timestamp: Date.now(), result });
      return result;
    }

    if (data.max_age && data.max_age > 0) {
      const result = {
        valid: false,
        reason: 'temporary',
        code,
        message: 'Invite is temporary and will expire'
      };
      validationCache.set(cacheKey, { timestamp: Date.now(), result });
      return result;
    }

    const result = {
      valid: true,
      code,
      normalizedUrl: `https://discord.gg/${code}`,
      guildId: data.guild?.id,
      guildName: data.guild?.name,
      memberCount: data.approximate_member_count || 0,
      message: 'Invite works'
    };
    validationCache.set(cacheKey, { timestamp: Date.now(), result });
    return result;
  } catch (err) {
    return {
      valid: false,
      reason: 'unknown',
      code,
      message: err.message || 'Network error verifying invite'
    };
  }
}

/**
 * Manage join intents in persistent storage (data/join_intents.json)
 */
function loadJoinIntents() {
  try {
    if (fs.existsSync(INTENTS_FILE)) {
      return JSON.parse(fs.readFileSync(INTENTS_FILE, 'utf8') || '[]');
    }
  } catch {
    return [];
  }
  return [];
}

function saveJoinIntents(intents) {
  try {
    fs.writeFileSync(INTENTS_FILE, JSON.stringify(intents, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function createJoinIntent(userId, serverId) {
  const uid = String(userId);
  const sid = String(serverId);
  const intents = loadJoinIntents().filter(i => i.expiresAt > Date.now()); // prune expired

  const intent = {
    id: `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: uid,
    serverId: sid,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 3600 * 1000, // 24 hours expiry
    converted: false
  };

  intents.push(intent);
  saveJoinIntents(intents);
  return intent;
}

export function findActiveJoinIntent(userId, serverId) {
  const uid = String(userId);
  const sid = String(serverId);
  const now = Date.now();
  const intents = loadJoinIntents();
  return intents.find(i => i.userId === uid && i.serverId === sid && i.expiresAt > now && !i.converted) || null;
}

export function markJoinIntentConverted(userId, serverId) {
  const uid = String(userId);
  const sid = String(serverId);
  const intents = loadJoinIntents();
  const idx = intents.findIndex(i => i.userId === uid && i.serverId === sid && !i.converted);
  if (idx !== -1) {
    intents[idx].converted = true;
    intents[idx].convertedAt = Date.now();
    saveJoinIntents(intents);
    return intents[idx];
  }
  return null;
}

/**
 * Background re-validation job: runs every 6 hours
 */
export async function revalidateAllInvites() {
  const data = loadDirectoryData();
  const servers = data.servers || [];
  let updatedCount = 0;
  const now = Date.now();

  for (const server of servers) {
    const invite = server.bot_invite_url || server.inviteUrl || server.discordInvite;
    if (!invite) continue;

    const check = await validateDiscordInvite(invite, server.id, true);
    server.last_checked_at = new Date(now).toISOString();

    if (!check.valid) {
      server.invite_status = 'broken';
      server.invite_error_reason = check.reason;
      if (!server.broken_since) {
        server.broken_since = new Date(now).toISOString();
      }

      // Check if broken for more than 3 days (72 hours) -> auto-delist
      const brokenTime = new Date(server.broken_since).getTime();
      if (now - brokenTime > 3 * 24 * 3600 * 1000) {
        server.hidden = true;
        server.is_delisted = true;
        server.delist_reason = 'Broken invite expired after 3 days without fix';
      }
      updatedCount++;
    } else {
      server.invite_status = 'valid';
      server.broken_since = null;
      server.invite_error_reason = null;
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    saveDirectoryData(data);
  }
  return { updatedCount, totalServers: servers.length };
}

let revalidationTimer = null;
export function startInviteRevalidationJob() {
  if (revalidationTimer) return;
  // Run once after 30 seconds startup delay, then every 6 hours
  setTimeout(() => {
    revalidateAllInvites().catch(() => {});
  }, 30000);

  revalidationTimer = setInterval(() => {
    revalidateAllInvites().catch(() => {});
  }, 6 * 3600 * 1000);
}
