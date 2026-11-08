import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const CONNECTIONS_FILE = path.join(DATA_DIR, 'erlc_connections.json');
const AUDIT_FILE = path.join(DATA_DIR, 'erlc_audit.json');

// 32-byte key derived from environment or secure salt
const ERLC_SECRET = process.env.ERLC_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'mavely_erlc_secure_salt_2026';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ERLC_SECRET).digest();

export const PRC_API_BASE = 'https://api.policeroleplay.community/v1';
const CACHE_TTL_MS = 30 * 1000; // 30 seconds fresh cache
const STALE_TTL_MS = 10 * 60 * 1000; // 10 minutes fallback if offline

// In-memory cache: serverId -> { value, cachedAt, expiresAt }
const memoryCache = new Map();

// Rate limit tracker: serverId -> timestamps array
const rateLimitMap = new Map();

/**
 * Check rate limit (max 5 requests per minute per server)
 */
export function checkRateLimit(serverId, maxPerMin = 5) {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  let timestamps = rateLimitMap.get(serverId) || [];
  timestamps = timestamps.filter(ts => ts > windowStart);
  if (timestamps.length >= maxPerMin) {
    rateLimitMap.set(serverId, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(serverId, timestamps);
  return true;
}

/**
 * AES-256-GCM encryption
 */
export function encryptKey(plainKey) {
  if (!plainKey) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * AES-256-GCM decryption
 */
export function decryptKey(cipherPayload) {
  if (!cipherPayload) return null;
  try {
    const [ivHex, tagHex, encryptedHex] = cipherPayload.split(':');
    if (!ivHex || !tagHex || !encryptedHex) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

/**
 * Mask key to only reveal last 4 characters
 */
export function maskKey(plainKey) {
  if (!plainKey) return '';
  const cleaned = plainKey.trim();
  const last4 = cleaned.slice(-4);
  return '••••••••••••••••' + last4;
}

/**
 * Load connections from file
 */
function loadConnections() {
  try {
    if (!fs.existsSync(CONNECTIONS_FILE)) return {};
    const raw = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save connections to file
 */
function saveConnections(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[ERLC Manager] Error saving connections:', err);
  }
}

/**
 * Append audit log
 */
function logAudit(serverId, userId, action, details = {}) {
  try {
    let logs = [];
    if (fs.existsSync(AUDIT_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
      } catch {}
    }
    logs.push({
      timestamp: new Date().toISOString(),
      serverId,
      userId: userId || 'system',
      action,
      details,
    });
    // Keep last 1,000 entries
    if (logs.length > 1000) logs = logs.slice(-1000);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('[ERLC Manager] Error writing audit log:', err);
  }
}

/**
 * Query Police Roleplay Community API
 */
export async function queryPrcApi(plainKey) {
  if (!plainKey || typeof plainKey !== 'string') {
    throw new Error('Invalid ER:LC API key. Check key and permissions.');
  }
  const trimmedKey = plainKey.trim();
  if (!trimmedKey) {
    throw new Error('Invalid ER:LC API key. Check key and permissions.');
  }

  const url = `${PRC_API_BASE}/server`;
  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'Server-Key': trimmedKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new Error('ER:LC could not be reached. Try again in a minute.');
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid ER:LC API key. Check key and permissions.');
    }
    if (res.status === 429) {
      throw new Error('Rate limited by ER:LC API. Try again in a minute.');
    }
    if (res.status >= 500) {
      throw new Error('ER:LC could not be reached. Try again in a minute.');
    }
    throw new Error('Invalid ER:LC API key. Check key and permissions.');
  }

  const data = await res.json();
  return {
    name: data.Name || 'Private Server',
    currentPlayers: Number.isFinite(data.CurrentPlayers) ? data.CurrentPlayers : 0,
    maxPlayers: Number.isFinite(data.MaxPlayers) ? data.MaxPlayers : 50,
    joinCode: data.JoinKey || data.JoinCode || '',
    accVerified: Boolean(data.AccVerified),
  };
}

/**
 * Connect an ER:LC server key
 */
export async function connectErlcServer(serverId, rawKey, userId) {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    throw new Error('Please enter a valid ER:LC API key.');
  }
  const plainKey = rawKey.trim();

  // Test with PRC API first
  const prcData = await queryPrcApi(plainKey);

  const encryptedKey = encryptKey(plainKey);
  const masked = maskKey(plainKey);
  const now = new Date().toISOString();

  const connections = loadConnections();
  const entry = {
    serverId,
    encryptedKey,
    maskedKey: masked,
    connected: true,
    name: prcData.name,
    currentPlayers: prcData.currentPlayers,
    maxPlayers: prcData.maxPlayers,
    joinCode: prcData.joinCode,
    connectedAt: now,
    connectedBy: userId || 'unknown',
    lastCheckedAt: now,
    status: 'connected',
  };

  connections[serverId] = entry;
  saveConnections(connections);

  // Set fresh cache
  memoryCache.set(serverId, {
    value: {
      connected: true,
      name: prcData.name,
      currentPlayers: prcData.currentPlayers,
      maxPlayers: prcData.maxPlayers,
      joinCode: prcData.joinCode,
      lastCheckedAt: now,
      maskedKey: masked,
      status: 'connected',
    },
    cachedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  logAudit(serverId, userId, 'connect', { name: prcData.name, joinCode: prcData.joinCode });

  return entry;
}

/**
 * Get ER:LC status for a server (with caching & fallback)
 */
export async function getErlcStatus(serverId, forceRefresh = false) {
  const connections = loadConnections();
  const record = connections[serverId];
  if (!record || !record.connected || !record.encryptedKey) {
    return {
      connected: false,
      status: 'not_connected',
      name: null,
      currentPlayers: null,
      maxPlayers: null,
      joinCode: null,
      lastCheckedAt: null,
      maskedKey: null,
    };
  }

  const cached = memoryCache.get(serverId);
  const now = Date.now();

  // Serve fresh cache if valid and not forcing refresh
  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  // Attempt live query using decrypted key
  const plainKey = decryptKey(record.encryptedKey);
  if (!plainKey) {
    return {
      connected: false,
      status: 'key_error',
      error: 'Stored key could not be decrypted.',
    };
  }

  try {
    const prcData = await queryPrcApi(plainKey);
    const checkedIso = new Date().toISOString();

    const value = {
      connected: true,
      status: 'connected',
      name: prcData.name,
      currentPlayers: prcData.currentPlayers,
      maxPlayers: prcData.maxPlayers,
      joinCode: prcData.joinCode || record.joinCode,
      lastCheckedAt: checkedIso,
      maskedKey: record.maskedKey,
    };

    // Update in-memory cache
    memoryCache.set(serverId, {
      value,
      cachedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    });

    // Update persisted record
    record.name = prcData.name;
    record.currentPlayers = prcData.currentPlayers;
    record.maxPlayers = prcData.maxPlayers;
    if (prcData.joinCode) record.joinCode = prcData.joinCode;
    record.lastCheckedAt = checkedIso;
    record.status = 'connected';
    connections[serverId] = record;
    saveConnections(connections);

    return value;
  } catch (err) {
    // Fallback: If cached within last 10 minutes, serve stale data with warning
    if (cached && now - cached.cachedAt < STALE_TTL_MS) {
      return {
        ...cached.value,
        warning: 'Could not reach ER:LC; showing cached status.',
      };
    }

    // Stale or unreachable beyond 10 minutes: mark status
    return {
      connected: true,
      status: 'offline',
      statusText: 'Offline (could not reach ER:LC)',
      name: record.name,
      currentPlayers: null,
      maxPlayers: record.maxPlayers,
      joinCode: record.joinCode,
      lastCheckedAt: record.lastCheckedAt,
      maskedKey: record.maskedKey,
    };
  }
}

/**
 * Test ER:LC connection
 */
export async function testErlcConnection(serverId, userId) {
  const connections = loadConnections();
  const record = connections[serverId];
  if (!record || !record.encryptedKey) {
    throw new Error('No ER:LC key connected for this server.');
  }

  const plainKey = decryptKey(record.encryptedKey);
  if (!plainKey) {
    throw new Error('Key decryption failed.');
  }

  const prcData = await queryPrcApi(plainKey);
  const now = new Date().toISOString();

  record.name = prcData.name;
  record.currentPlayers = prcData.currentPlayers;
  record.maxPlayers = prcData.maxPlayers;
  if (prcData.joinCode) record.joinCode = prcData.joinCode;
  record.lastCheckedAt = now;
  connections[serverId] = record;
  saveConnections(connections);

  memoryCache.set(serverId, {
    value: {
      connected: true,
      status: 'connected',
      name: prcData.name,
      currentPlayers: prcData.currentPlayers,
      maxPlayers: prcData.maxPlayers,
      joinCode: prcData.joinCode || record.joinCode,
      lastCheckedAt: now,
      maskedKey: record.maskedKey,
    },
    cachedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  logAudit(serverId, userId, 'test', { currentPlayers: prcData.currentPlayers });
  return prcData;
}

/**
 * Disconnect ER:LC server
 */
export async function disconnectErlcServer(serverId, userId) {
  const connections = loadConnections();
  if (connections[serverId]) {
    delete connections[serverId];
    saveConnections(connections);
  }
  memoryCache.delete(serverId);
  logAudit(serverId, userId, 'disconnect');
  return { success: true };
}
