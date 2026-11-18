import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, isPostgresConnected } from './db.js';
import { getPromotedServers, updatePromotedServerDetails } from './directoryManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

const CUSTOM_URLS_FILE = path.join(DATA_DIR, 'custom_urls.json');
const HELD_URLS_FILE = path.join(DATA_DIR, 'held_custom_urls.json');
const BLOCKED_WORDS_FILE = path.join(DATA_DIR, 'blocked_custom_names.json');
const AUDIT_FILE = path.join(DATA_DIR, 'custom_url_audit.json');

const COOLDOWN_DAYS = 30;
const HOLD_DAYS = 30;
const MAX_ATTEMPTS_PER_HOUR = 5;

// In-memory rate limiter: userId -> array of timestamps
const attemptTracker = new Map();

// Default reserved route words
export const RESERVED_WORDS = new Set([
  'admin', 'api', 'servers', 'directory', 'dashboard', 'login', 'settings',
  'earn', 'partnership', 'partnerships', 'r', 'assets', 'join', 'status',
  'docs', 's', 'leaderboard', 'shop', 'privacy', 'terms', 'auth', 'oauth',
  'brand', 'public', 'verify', 'bot', 'healthz', 'admin-portal', 'admin-panel',
  'discovery', 'recruit', 'import', 'banned', 'maintenance', '404', 'help',
  'changelog', 'invite', 'webhooks', 'webhook', 'overview', 'server-page',
  'details', 'rewards', 'joins', 'recruits', 'promote'
]);

// Protected brand words & slurs
const DEFAULT_BLOCKED_WORDS = [
  'discord', 'anthropic', 'connectingerlc', 'mavely', 'erlcus',
  'staff', 'moderator', 'administrator', 'system', 'official', 'support',
  'nigger', 'faggot', 'kike', 'chink', 'retard', 'childporn', 'pedophile', 'hitler', 'nazi'
];

function ensureFilesExist() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CUSTOM_URLS_FILE)) fs.writeFileSync(CUSTOM_URLS_FILE, JSON.stringify({}, null, 2), 'utf8');
  if (!fs.existsSync(HELD_URLS_FILE)) fs.writeFileSync(HELD_URLS_FILE, JSON.stringify([], null, 2), 'utf8');
  if (!fs.existsSync(BLOCKED_WORDS_FILE)) fs.writeFileSync(BLOCKED_WORDS_FILE, JSON.stringify(DEFAULT_BLOCKED_WORDS, null, 2), 'utf8');
  if (!fs.existsSync(AUDIT_FILE)) fs.writeFileSync(AUDIT_FILE, JSON.stringify([], null, 2), 'utf8');
}

ensureFilesExist();

function loadCustomUrls() {
  try {
    return JSON.parse(fs.readFileSync(CUSTOM_URLS_FILE, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function saveCustomUrls(data) {
  try {
    fs.writeFileSync(CUSTOM_URLS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[CUSTOM URL] Failed to save custom_urls.json:', err.message);
  }
}

function loadHeldUrls() {
  try {
    return JSON.parse(fs.readFileSync(HELD_URLS_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function saveHeldUrls(data) {
  try {
    fs.writeFileSync(HELD_URLS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[CUSTOM URL] Failed to save held_custom_urls.json:', err.message);
  }
}

export function loadBlockedWords() {
  try {
    const list = JSON.parse(fs.readFileSync(BLOCKED_WORDS_FILE, 'utf8') || '[]');
    return Array.isArray(list) ? list : DEFAULT_BLOCKED_WORDS;
  } catch {
    return DEFAULT_BLOCKED_WORDS;
  }
}

export function saveBlockedWords(list) {
  try {
    fs.writeFileSync(BLOCKED_WORDS_FILE, JSON.stringify(list, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function logAudit(action, actorId, details = {}) {
  try {
    const logs = fs.existsSync(AUDIT_FILE) ? JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8') || '[]') : [];
    logs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      actorId: String(actorId || 'system'),
      details
    });
    if (logs.length > 2000) logs.splice(0, logs.length - 2000);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.warn('[CUSTOM URL] Could not write audit log:', err.message);
  }
}

export function getAuditLogs() {
  try {
    return fs.existsSync(AUDIT_FILE) ? JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8') || '[]') : [];
  } catch {
    return [];
  }
}

/**
 * Leet and Unicode normalizer
 */
export function normalizeLeet(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFKD') // decompose unicode diacritics
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/\|/g, 'l')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/@/g, 'a')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/9/g, 'g')
    .replace(/[^a-z0-9]/g, '');
}

export function getLeetVariants(str) {
  const primary = normalizeLeet(str);
  // Also generate variant where 1 / i could be l
  const variantL = primary.replace(/i/g, 'l');
  return [primary, variantL];
}

/**
 * Validate proposed custom name
 */
export function validateCustomUrlName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return { valid: false, error: 'Custom URL must be provided.' };
  }

  const name = rawName.trim().toLowerCase();

  // Length 3 to 32 chars
  if (name.length < 3 || name.length > 32) {
    return { valid: false, error: 'Custom URL must be between 3 and 32 characters long.' };
  }

  // Lowercase letters, numbers, and hyphens only
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(name)) {
    return { valid: false, error: 'Custom URL must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen).' };
  }

  // Reserved site routes
  if (RESERVED_WORDS.has(name)) {
    return { valid: false, error: 'This name is reserved. Contact staff.' };
  }

  // Check blocked words and leet/unicode normalizations
  const variants = getLeetVariants(name);
  const blockedList = loadBlockedWords();

  for (const blocked of blockedList) {
    const blockedVariants = getLeetVariants(blocked);
    for (const bVar of blockedVariants) {
      if (!bVar) continue;
      for (const nVar of variants) {
        if (nVar.includes(bVar) || name.includes(blocked.toLowerCase())) {
          return { valid: false, error: 'This name is reserved. Contact staff.' };
        }
      }
    }
  }

  return { valid: true, cleanName: name };
}

/**
 * Check rate limit for claiming attempts
 */
export function checkClaimRateLimit(userId) {
  const uid = String(userId);
  const now = Date.now();
  const windowStart = now - 3600 * 1000;

  let timestamps = attemptTracker.get(uid) || [];
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= MAX_ATTEMPTS_PER_HOUR) {
    attemptTracker.set(uid, timestamps);
    return false;
  }

  timestamps.push(now);
  attemptTracker.set(uid, timestamps);
  return true;
}

/**
 * Claim custom URL for a server
 */
export async function claimCustomUrl(serverId, proposedName, userId) {
  const sid = String(serverId);
  const uid = String(userId);

  if (!checkClaimRateLimit(uid)) {
    throw new Error('Too many claim attempts. Please wait an hour before trying again.');
  }

  const val = validateCustomUrlName(proposedName);
  if (!val.valid) {
    throw new Error(val.error);
  }
  const cleanName = val.cleanName;

  const servers = getPromotedServers(true);
  const server = servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) {
    throw new Error('Server not found.');
  }

  // 30-day change cooldown
  if (server.customUrlChangedAt) {
    const lastChange = new Date(server.customUrlChangedAt).getTime();
    const cooldownMs = COOLDOWN_DAYS * 86400 * 1000;
    if (Date.now() - lastChange < cooldownMs) {
      const daysLeft = Math.ceil((cooldownMs - (Date.now() - lastChange)) / (86400 * 1000));
      throw new Error(`You can change your custom URL once every 30 days. You have ${daysLeft} day(s) remaining on cooldown.`);
    }
  }

  const customUrls = loadCustomUrls();
  const now = Date.now();

  // Check if name is currently taken by another server
  const existingOwner = customUrls[cleanName];
  if (existingOwner && String(existingOwner.serverId) !== sid) {
    throw new Error(`The custom URL "${cleanName}" is already taken by another community.`);
  }

  // Check held names (held for 30 days after release)
  const heldUrls = loadHeldUrls();
  const heldEntry = heldUrls.find(h => h.slug === cleanName && h.heldUntil > now);
  if (heldEntry && String(heldEntry.serverId) !== sid) {
    const daysLeft = Math.ceil((heldEntry.heldUntil - now) / (86400 * 1000));
    throw new Error(`The custom URL "${cleanName}" was recently released and is held on cooldown for ${daysLeft} more day(s).`);
  }

  // If this server already had a custom URL and is changing it, hold the old one for 30 days
  const oldUrl = server.customUrl;
  if (oldUrl && oldUrl !== cleanName) {
    delete customUrls[oldUrl];
    heldUrls.push({
      slug: oldUrl,
      serverId: sid,
      releasedAt: now,
      heldUntil: now + HOLD_DAYS * 86400 * 1000
    });
    saveHeldUrls(heldUrls);
  }

  // Register new custom URL
  const record = {
    slug: cleanName,
    serverId: sid,
    serverName: server.name || 'Community Server',
    claimedBy: uid,
    claimedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  };

  customUrls[cleanName] = record;
  saveCustomUrls(customUrls);

  // Update server object in directory
  server.customUrl = cleanName;
  server.customUrlChangedAt = new Date(now).toISOString();
  await updatePromotedServerDetails(sid, {
    customUrl: cleanName,
    customUrlChangedAt: server.customUrlChangedAt
  });

  logAudit('claim_custom_url', uid, {
    serverId: sid,
    oldUrl,
    newUrl: cleanName
  });

  return record;
}

/**
 * Resolve custom URL to server ID
 */
export function resolveCustomUrl(slug) {
  if (!slug || typeof slug !== 'string') return null;
  const clean = slug.trim().toLowerCase();
  const customUrls = loadCustomUrls();
  return customUrls[clean] || null;
}

/**
 * Get custom URL info for a server
 */
export function getServerCustomUrl(serverId) {
  const sid = String(serverId);
  const customUrls = loadCustomUrls();
  for (const [slug, data] of Object.entries(customUrls)) {
    if (String(data.serverId) === sid) {
      return data.slug || slug;
    }
  }
  return null;
}

export function getServerCustomUrlRecord(serverId) {
  const sid = String(serverId);
  const customUrls = loadCustomUrls();
  for (const [slug, data] of Object.entries(customUrls)) {
    if (String(data.serverId) === sid) {
      return data;
    }
  }
  return null;
}

/**
 * Admin: List all custom URLs
 */
export function listAllCustomUrls() {
  const customUrls = loadCustomUrls();
  const heldUrls = loadHeldUrls();
  const now = Date.now();

  const active = Object.values(customUrls);
  const held = heldUrls.filter(h => h.heldUntil > now);

  return { active, held };
}

/**
 * Admin: Remove a custom URL
 */
export async function adminRemoveCustomUrl(slug, adminUserId, reason = 'Administrative removal') {
  const clean = String(slug || '').trim().toLowerCase();
  const customUrls = loadCustomUrls();
  const existing = customUrls[clean];
  if (!existing) {
    throw new Error('Custom URL not found.');
  }

  delete customUrls[clean];
  saveCustomUrls(customUrls);

  // Clear from server
  await updatePromotedServerDetails(existing.serverId, { customUrl: null });

  logAudit('admin_remove_custom_url', adminUserId, {
    slug: clean,
    serverId: existing.serverId,
    reason
  });

  return { success: true, ok: true };
}

/**
 * Admin: Reassign custom URL to another server
 */
export async function adminReassignCustomUrl(slug, targetServerId, adminUserId, reason = 'Administrative reassignment') {
  const clean = String(slug || '').trim().toLowerCase();
  const customUrls = loadCustomUrls();
  const sid = String(targetServerId);

  const servers = getPromotedServers(true);
  const targetServer = servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!targetServer) {
    throw new Error('Target server not found.');
  }

  const existing = customUrls[clean];
  const oldServerId = existing?.serverId || null;

  if (oldServerId && oldServerId !== sid) {
    await updatePromotedServerDetails(oldServerId, { customUrl: null });
  }

  const record = {
    slug: clean,
    serverId: sid,
    serverName: targetServer.name || 'Community Server',
    claimedBy: adminUserId,
    claimedAt: existing?.claimedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  customUrls[clean] = record;
  saveCustomUrls(customUrls);

  targetServer.customUrl = clean;
  await updatePromotedServerDetails(sid, { customUrl: clean });

  logAudit('admin_reassign_custom_url', adminUserId, {
    slug: clean,
    oldServerId,
    newServerId: sid,
    reason
  });

  return record;
}

/**
 * Admin: Assign a reserved or brand name to a server with reason and audit log
 */
export async function adminAssignReservedCustomUrl(slug, targetServerId, adminUserId, reason = 'Administrative reserved assignment') {
  const clean = String(slug || '').trim().toLowerCase();
  const sid = String(targetServerId);

  if (!clean || !sid) {
    throw new Error('Slug and target server ID are required.');
  }

  const servers = getPromotedServers(true);
  const targetServer = servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!targetServer) {
    throw new Error('Target server not found.');
  }

  const customUrls = loadCustomUrls();
  const existing = customUrls[clean];
  const oldServerId = existing?.serverId || null;

  if (oldServerId && oldServerId !== sid) {
    await updatePromotedServerDetails(oldServerId, { customUrl: null });
  }

  const record = {
    slug: clean,
    serverId: sid,
    serverName: targetServer.name || 'Community Server',
    claimedBy: adminUserId,
    isReservedAssignment: true,
    claimedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  customUrls[clean] = record;
  saveCustomUrls(customUrls);

  targetServer.customUrl = clean;
  await updatePromotedServerDetails(sid, { customUrl: clean });

  logAudit('admin_assign_reserved_custom_url', adminUserId, {
    slug: clean,
    serverId: sid,
    reason: reason || 'Reserved name assigned by administrator'
  });

  return record;
}
