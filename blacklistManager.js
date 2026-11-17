import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { recordAuditAction } from './adminManager.js';
import { revokeVerification } from './verificationManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');
const USER_IPS_FILE = path.join(DATA_DIR, 'user_ips.json');

// Encryption & HMAC secrets (derived from SESSION_SECRET or fallback)
const SECRET = process.env.SESSION_SECRET || 'connectingerlc_secure_encryption_key_32_bytes_len!';
const ENC_KEY = crypto.createHash('sha256').update(SECRET).digest(); // 32 bytes for AES-256-GCM
const HMAC_KEY = crypto.createHash('sha256').update(SECRET + '_hmac').digest();

function loadBlacklist() {
  try {
    let list = [];
    if (fs.existsSync(BLACKLIST_FILE)) {
      list = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8') || '[]');
    }
    const isProd = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
    const seedPath = path.join(process.cwd(), 'seeds', 'blacklist.json');
    if (!isProd && (!Array.isArray(list) || list.length === 0) && fs.existsSync(seedPath)) {
      try {
        const seedList = JSON.parse(fs.readFileSync(seedPath, 'utf8') || '[]');
        if (Array.isArray(seedList) && seedList.length > 0) {
          list = seedList;
        }
      } catch {}
    }
    return Array.isArray(list) ? list : [];
  } catch {}
  return [];
}

function saveBlacklist(data) {
  try {
    const tmp = `${BLACKLIST_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, BLACKLIST_FILE);
  } catch (err) {
    console.error('[BLACKLIST] Save error:', err.message);
  }
}

function loadUserIps() {
  try {
    if (fs.existsSync(USER_IPS_FILE)) {
      return JSON.parse(fs.readFileSync(USER_IPS_FILE, 'utf8') || '[]');
    }
  } catch {}
  return [];
}

function saveUserIps(data) {
  try {
    const tmp = `${USER_IPS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, USER_IPS_FILE);
  } catch (err) {
    console.error('[USER IPS] Save error:', err.message);
  }
}

// AES-256-GCM Encryption
export function encryptIp(ip) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  let enc = cipher.update(ip, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${enc}`;
}

export function decryptIp(encryptedStr) {
  try {
    const [ivHex, tagHex, dataHex] = encryptedStr.split(':');
    if (!ivHex || !tagHex || !dataHex) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(dataHex, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return null;
  }
}

export function hmacIp(ip) {
  return crypto.createHmac('sha256', HMAC_KEY).update(ip.trim().toLowerCase()).digest('hex');
}

export function maskIp(ip) {
  if (!ip) return '***';
  if (ip.includes(':')) {
    // IPv6: show first two segments e.g. 2001:db8::
    const parts = ip.split(':');
    return `${parts.slice(0, 2).join(':')}::x`;
  }
  // IPv4: 203.0.113.x
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  }
  return '***';
}

/**
 * Record user client IP (auto pruned after 90 days)
 */
export function recordUserIp(userId, ip, action = 'login') {
  if (!userId || !ip) return;
  const cleanIp = ip.trim();
  const now = Date.now();
  const NINETY_DAYS_MS = 90 * 86400 * 1000;

  let allIps = loadUserIps();
  // Clean records older than 90 days
  allIps = allIps.filter((r) => now - new Date(r.timestamp).getTime() < NINETY_DAYS_MS);

  const hash = hmacIp(cleanIp);
  const uid = String(userId);

  // Avoid recording identical (user, hash) within 10 minutes
  const recent = allIps.find((r) => r.user_id === uid && r.ip_hash === hash && now - new Date(r.timestamp).getTime() < 10 * 60 * 1000);
  if (!recent) {
    allIps.push({
      id: `uip_${now}_${crypto.randomBytes(3).toString('hex')}`,
      user_id: uid,
      ip_encrypted: encryptIp(cleanIp),
      ip_hash: hash,
      ip_masked: maskIp(cleanIp),
      action,
      timestamp: new Date().toISOString()
    });
    saveUserIps(allIps);
  }
}

/**
 * Get distinct IPs used by a user in the last 30 days, along with accounts sharing those IPs
 */
export function getUserIpCollateral(userId, days = 30) {
  const uid = String(userId);
  const allIps = loadUserIps();
  const cutoff = Date.now() - days * 86400 * 1000;

  // Find all IP hashes for this user in the window
  const userRecords = allIps.filter((r) => r.user_id === uid && new Date(r.timestamp).getTime() >= cutoff);
  const uniqueHashes = Array.from(new Set(userRecords.map((r) => r.ip_hash)));

  const results = [];
  for (const hash of uniqueHashes) {
    const matching = allIps.filter((r) => r.ip_hash === hash && new Date(r.timestamp).getTime() >= cutoff);
    const sampleRecord = matching.find((r) => r.user_id === uid) || matching[0];
    const fullIp = decryptIp(sampleRecord.ip_encrypted);
    const masked = sampleRecord.ip_masked || maskIp(fullIp);
    const otherAccounts = Array.from(new Set(matching.map((r) => r.user_id).filter((id) => id !== uid)));

    results.push({
      ip_hash: hash,
      ip_masked: masked,
      ip_full: fullIp,
      other_account_count: otherAccounts.length,
      other_accounts: otherAccounts,
      collateral_warning: otherAccounts.length >= 2 // 3 or more total accounts sharing
    });
  }
  return results;
}

// ─── IP / CIDR Matching Helpers ─────────────────────────────────────────────

function ipv4ToInt(ip) {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function isIpInCidr(ip, cidr) {
  if (!ip || !cidr) return false;
  if (!cidr.includes('/')) {
    return ip.trim().toLowerCase() === cidr.trim().toLowerCase();
  }

  // IPv4 CIDR matching
  if (!cidr.includes(':') && !ip.includes(':')) {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    if (isNaN(bits) || bits < 0 || bits > 32) return false;
    const ipInt = ipv4ToInt(ip);
    const rangeInt = ipv4ToInt(range);
    if (ipInt === null || rangeInt === null) return false;
    if (bits === 0) return true;
    const mask = (~0 << (32 - bits)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
  }

  // IPv6 prefix matching (e.g. 2001:db8::/64)
  if (cidr.includes(':') && ip.includes(':')) {
    const [prefix, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10) || 64;
    // Basic prefix compare
    const normIp = ip.toLowerCase();
    const normPrefix = prefix.toLowerCase();
    if (bits <= 64) {
      const pSegments = normPrefix.split(':').filter(Boolean);
      const ipSegments = normIp.split(':').filter(Boolean);
      return pSegments.slice(0, 4).join(':') === ipSegments.slice(0, 4).join(':');
    }
  }
  return false;
}

// Protected IP ranges that can NEVER be blocked
const PROTECTED_CIDRS = [
  '127.0.0.0/8',
  '::1/128',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  // Cloudflare IP ranges
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22'
];

export function isProtectedIp(ip) {
  if (!ip) return true;
  for (const cidr of PROTECTED_CIDRS) {
    if (isIpInCidr(ip, cidr)) return true;
  }
  return false;
}

/**
 * Check if an IP, Discord ID, or session user is currently blocked
 */
export function checkBlacklist({ userId, discordId, ip }) {
  const all = loadBlacklist();
  const now = Date.now();
  const targetUid = String(discordId || userId || '');

  const active = all.filter((item) => {
    if (item.expires_at && new Date(item.expires_at).getTime() < now) return false;
    return true;
  });

  // Check Discord user ID
  if (targetUid) {
    const userMatch = active.find((item) => (item.type === 'discord_id' || !item.type) && String(item.value || item.userId) === targetUid);
    if (userMatch) {
      return {
        blocked: true,
        blacklisted: true,
        type: 'discord_id',
        reason: userMatch.reason,
        ref: userMatch.id,
        entry: userMatch,
        expires_at: userMatch.expires_at
      };
    }
  }

  // Check IP or range
  if (ip && !isProtectedIp(ip)) {
    const cleanIp = ip.trim();
    const ipMatch = active.find((item) => {
      if (item.type === 'ip' && (item.value === cleanIp || item.ip === cleanIp)) return true;
      if ((item.type === 'ip_range' || item.type === 'cidr') && isIpInCidr(cleanIp, item.value)) return true;
      return false;
    });

    if (ipMatch) {
      return {
        blocked: true,
        blacklisted: true,
        type: ipMatch.type,
        reason: ipMatch.reason,
        ref: ipMatch.id,
        entry: ipMatch,
        expires_at: ipMatch.expires_at
      };
    }
  }

  return { blocked: false, blacklisted: false };
}

/**
 * Add an entry to the blacklist
 */
export function addBlacklistEntry({ type, value, reason, expiryDays = 30, actor, notes, reqIp = null }) {
  const normType = type === 'cidr' ? 'cidr' : type;
  if (!['discord_id', 'ip', 'ip_range', 'cidr'].includes(normType)) {
    throw new Error('Type must be discord_id, ip, ip_range, or cidr.');
  }

  const cleanVal = String(value || '').trim();
  if (!cleanVal) throw new Error('Value is required.');

  const cleanReason = String(reason || '').trim();
  if (!cleanReason || cleanReason.length < 5) {
    throw new Error('A reason of at least 5 characters is required.');
  }

  // IP safety checks
  if (type === 'ip' || type === 'ip_range') {
    if (isProtectedIp(cleanVal)) {
      throw new Error('Cannot block private, loopback, or platform infrastructure IP addresses.');
    }
    if (reqIp && (cleanVal === reqIp || isIpInCidr(reqIp, cleanVal))) {
      throw new Error("You cannot block your own current admin IP address.");
    }
  }

  const now = Date.now();
  let expires_at = null;
  if (expiryDays !== 'permanent' && expiryDays !== 0) {
    const days = parseInt(expiryDays, 10) || 30;
    expires_at = new Date(now + days * 86400 * 1000).toISOString();
  }

  const all = loadBlacklist();
  // Check if duplicate active
  const existing = all.find((item) => item.type === type && item.value === cleanVal);
  if (existing) {
    existing.reason = cleanReason;
    existing.expires_at = expires_at;
    existing.updated_at = new Date().toISOString();
    existing.added_by = actor?.username || 'Admin';
    saveBlacklist(all);
    if (type === 'discord_id') {
      try {
        revokeVerification({
          serverId: cleanVal,
          reason: `Server was blacklisted: ${cleanReason}`,
          revokedBy: actor?.username || 'Admin'
        });
      } catch {}
    }
    return existing;
  }

  const newEntry = {
    id: `blk_${now}_${crypto.randomBytes(3).toString('hex')}`,
    type,
    value: cleanVal,
    masked_value: type === 'ip' ? maskIp(cleanVal) : cleanVal,
    reason: cleanReason,
    expires_at,
    created_at: new Date().toISOString(),
    added_by: actor?.username || 'Admin'
  };

  all.unshift(newEntry);
  saveBlacklist(all);

  // Auto-revoke verified badge if blacklisted entity is a server
  if (type === 'discord_id') {
    try {
      revokeVerification({
        serverId: cleanVal,
        reason: `Server was blacklisted: ${cleanReason}`,
        revokedBy: actor?.username || 'Admin'
      });
    } catch {}
  }

  if (type === 'discord_id') {
    try {
      import('./verificationManager.js').then((vm) => {
        vm.revokeVerification({ serverId: cleanVal, reason: `Auto-revoked due to blacklist: ${cleanReason}`, revokedBy: 'System (Blacklist)' });
      }).catch(() => {});
    } catch {}
  }

  if (actor) {
    recordAuditAction({
      actor,
      action: 'blacklist_add',
      target: newEntry.masked_value,
      targetType: type,
      reason: cleanReason,
      before: null,
      after: expires_at ? `Expires ${expires_at.slice(0, 10)}` : 'Permanent'
    });
  }

  return newEntry;
}

export function removeBlacklistEntry(id, reason, actor) {
  if (!id) throw new Error('Blacklist identifier is required.');
  const cleanId = String(id).trim();
  let all = loadBlacklist();
  const entry = all.find((item) =>
    item.id === cleanId ||
    item.value === cleanId ||
    String(item.userId || '') === cleanId ||
    item.masked_value === cleanId
  );

  if (entry) {
    all = all.filter((item) => item.id !== entry.id);
    saveBlacklist(all);

    if (actor) {
      recordAuditAction({
        actor,
        action: 'blacklist_remove',
        target: entry.masked_value || entry.value,
        targetType: entry.type || 'entry',
        reason: reason || 'Administrative unblacklist',
        before: entry.value,
        after: null
      });
    }
    return true;
  }

  // Fallback: check if cleanId matches any Discord user ID across entries
  const removedUserCount = removeUserBlacklistEntries(cleanId);
  if (removedUserCount > 0) {
    if (actor) {
      recordAuditAction({
        actor,
        action: 'blacklist_remove',
        target: cleanId,
        targetType: 'discord_id',
        reason: reason || 'Administrative unblacklist by user ID',
        before: cleanId,
        after: null
      });
    }
    return true;
  }

  throw new Error(`Blacklist entry "${cleanId}" not found.`);
}

/**
 * Remove an entry or user from blacklist by any identifier (id, value, userId, ip)
 */
export function unblacklistTarget({ id, value, userId, ip, reason, actor }) {
  const target = id || value || userId || ip;
  if (!target) throw new Error('Target identifier is required to unblacklist.');
  return removeBlacklistEntry(target, reason, actor);
}

/**
 * Remove all blacklist entries associated with a Discord user ID
 */
export function removeUserBlacklistEntries(userId) {
  if (!userId) return 0;
  const uid = String(userId).trim();
  let all = loadBlacklist();
  const before = all.length;
  all = all.filter((item) => {
    if ((item.type === 'discord_id' || !item.type) && String(item.value || item.userId) === uid) {
      return false;
    }
    return true;
  });

  if (all.length !== before) {
    saveBlacklist(all);
  }
  return before - all.length;
}

export function getAllBlacklistEntries() {
  const all = loadBlacklist();
  const now = Date.now();

  return all.map((item) => ({
    ...item,
    is_expired: item.expires_at ? new Date(item.expires_at).getTime() < now : false
  }));
}

