import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { recordLedgerTransaction } from './ledgerManager.js';
import { getPromotedServers, getUserBalance, setUserBalance } from './directoryManager.js';
import { recordAuditAction } from './adminManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const PROMO_CODES_FILE = path.join(DATA_DIR, 'promo_codes.json');
const PROMO_REDEMPTIONS_FILE = path.join(DATA_DIR, 'promo_redemptions.json');
const PROMO_FAILURES_FILE = path.join(DATA_DIR, 'promo_failures.json');

// TTL for failure rate limiting: 15 minutes
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const recentRequestIds = new Map(); // requestId -> timestamp

export function normalizePromoCode(code) {
  if (!code) return '';
  return String(code)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces/joiners
    .replace(/[—–−]/g, '-') // normalize unicode dashes
    .trim()
    .toUpperCase();
}

function loadPromoFailures() {
  try {
    if (fs.existsSync(PROMO_FAILURES_FILE)) {
      return JSON.parse(fs.readFileSync(PROMO_FAILURES_FILE, 'utf8') || '{}');
    }
  } catch {}
  return {};
}

function savePromoFailures(data) {
  try {
    const tmp = `${PROMO_FAILURES_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, PROMO_FAILURES_FILE);
  } catch (err) {
    console.error('[PROMO FAILURES] Save failed:', err.message);
  }
}

export function checkPromoFailureLock(userId, ip) {
  const now = Date.now();
  const failures = loadPromoFailures();

  if (userId) {
    const rec = failures[`user:${userId}`];
    if (rec && rec.cooldownUntil && now < rec.cooldownUntil) {
      const waitMinutes = Math.max(1, Math.ceil((rec.cooldownUntil - now) / 60000));
      return {
        locked: true,
        remainingMinutes: waitMinutes,
        error: `Redemption failed. Too many failed attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}.`
      };
    }
  }

  if (ip) {
    const rec = failures[`ip:${ip}`];
    if (rec && rec.cooldownUntil && now < rec.cooldownUntil) {
      const waitMinutes = Math.max(1, Math.ceil((rec.cooldownUntil - now) / 60000));
      return {
        locked: true,
        remainingMinutes: waitMinutes,
        error: `Redemption failed. Too many attempts from this connection. Try again in ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}.`
      };
    }
  }

  return { locked: false };
}

export function recordPromoSuccess(userId, ip) {
  const failures = loadPromoFailures();
  let changed = false;
  if (userId && failures[`user:${userId}`]) {
    delete failures[`user:${userId}`];
    changed = true;
  }
  if (changed) {
    savePromoFailures(failures);
  }
}

export function recordPromoFailure(userId, ip, requestId = null) {
  const now = Date.now();
  if (requestId) {
    if (recentRequestIds.has(requestId)) {
      const failures = loadPromoFailures();
      const rec = userId ? failures[`user:${userId}`] : null;
      const count = rec?.count || 0;
      return { attemptsLeft: Math.max(0, 5 - count), duplicate: true };
    }
    recentRequestIds.set(requestId, now);
    if (recentRequestIds.size > 1000) {
      for (const [k, v] of recentRequestIds.entries()) {
        if (now - v > 60000) recentRequestIds.delete(k);
      }
    }
  }

  const failures = loadPromoFailures();
  let userAttemptsLeft = 5;

  if (userId) {
    const key = `user:${userId}`;
    const rec = failures[key] || { count: 0, firstFailureAt: now, cooldownUntil: 0 };
    if (now - rec.firstFailureAt > FIFTEEN_MINUTES_MS) {
      rec.count = 0;
      rec.firstFailureAt = now;
      rec.cooldownUntil = 0;
    }
    rec.count = (rec.count || 0) + 1;
    if (rec.count >= 5) {
      rec.cooldownUntil = now + FIFTEEN_MINUTES_MS;
      userAttemptsLeft = 0;
    } else {
      userAttemptsLeft = 5 - rec.count;
    }
    failures[key] = rec;
  }

  if (ip) {
    const key = `ip:${ip}`;
    const rec = failures[key] || { count: 0, firstFailureAt: now, cooldownUntil: 0 };
    if (now - rec.firstFailureAt > FIFTEEN_MINUTES_MS) {
      rec.count = 0;
      rec.firstFailureAt = now;
      rec.cooldownUntil = 0;
    }
    rec.count = (rec.count || 0) + 1;
    if (rec.count >= 15) {
      rec.cooldownUntil = now + FIFTEEN_MINUTES_MS;
    }
    failures[key] = rec;
  }

  savePromoFailures(failures);
  return { attemptsLeft: userAttemptsLeft, duplicate: false };
}

export function clearPromoLock(userId, actor = null) {
  const failures = loadPromoFailures();
  if (userId && failures[`user:${userId}`]) {
    delete failures[`user:${userId}`];
    savePromoFailures(failures);
    if (actor) {
      recordAuditAction({
        actor,
        action: 'clear_promo_lock',
        target: `user_${userId}`,
        targetType: 'user',
        reason: `Cleared promo rate limit lock for user ${userId}`,
        before: 'Locked',
        after: 'Unlocked'
      });
    }
    return true;
  }
  return false;
}

export function resetAllPromoLimits() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('resetAllPromoLimits cannot be called in production environment');
  }
  savePromoFailures({});
  recentRequestIds.clear();
  return true;
}

function loadPromoCodes() {
  try {
    let list = [];
    if (fs.existsSync(PROMO_CODES_FILE)) {
      list = JSON.parse(fs.readFileSync(PROMO_CODES_FILE, 'utf8') || '[]');
    }
    const isProd = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
    const seedPath = path.join(process.cwd(), 'seeds', 'promo_codes.json');
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

function savePromoCodes(codes) {
  try {
    const tmp = `${PROMO_CODES_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(codes, null, 2), 'utf8');
    fs.renameSync(tmp, PROMO_CODES_FILE);
  } catch (err) {
    console.error('[PROMO CODES] Save failed:', err.message);
  }
}

export function loadPromoRedemptions() {
  try {
    if (fs.existsSync(PROMO_REDEMPTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(PROMO_REDEMPTIONS_FILE, 'utf8') || '[]');
    }
  } catch {}
  return [];
}

function savePromoRedemptions(redemptions) {
  try {
    const tmp = `${PROMO_REDEMPTIONS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(redemptions, null, 2), 'utf8');
    fs.renameSync(tmp, PROMO_REDEMPTIONS_FILE);
  } catch (err) {
    console.error('[PROMO REDEMPTIONS] Save failed:', err.message);
  }
}

/**
 * Generate 10-char random code avoiding look-alike characters (0, O, 1, I, L)
 */
export function generateRandomCode(length = 10) {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let res = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    res += chars[bytes[i] % chars.length];
  }
  return res;
}

export function checkRedeemRateLimit(userId, ip) {
  const check = checkPromoFailureLock(userId, ip);
  if (check.locked) {
    return { allowed: false, error: check.error };
  }
  return { allowed: true };
}

export function recordRedeemAttempt(userId, ip, success, requestId = null) {
  if (success) {
    recordPromoSuccess(userId, ip);
  } else {
    recordPromoFailure(userId, ip, requestId);
  }
}

/**
 * Admin: List all promo codes
 */
export function getAllPromoCodes() {
  const codes = loadPromoCodes();
  const now = Date.now();

  return codes.map((c) => {
    let status = 'Active';
    if (!c.active) status = 'Disabled';
    else if (c.expires_at && new Date(c.expires_at).getTime() < now) status = 'Expired';
    else if (c.max_uses && c.used_count >= c.max_uses) status = 'Used up';

    return {
      ...c,
      status
    };
  });
}

/**
 * Admin: Create a promo code
 */
export function createPromoCode({
  code,
  credits,
  max_uses,
  per_user_limit = 1,
  expires_at = null,
  note = '',
  actor
}) {
  const cleanCode = (code || generateRandomCode()).trim().toUpperCase();
  if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 32) {
    throw new Error('Code must be between 3 and 32 characters.');
  }

  const creditNum = parseInt(credits, 10);
  if (isNaN(creditNum) || creditNum < 1 || creditNum > 10000) {
    throw new Error('Credits must be between 1 and 10,000.');
  }

  const maxUsesNum = max_uses ? parseInt(max_uses, 10) : null;
  if (maxUsesNum !== null && (isNaN(maxUsesNum) || maxUsesNum < 1 || maxUsesNum > 100000)) {
    throw new Error('Total uses must be between 1 and 100,000 or empty for unlimited.');
  }

  const perUserNum = parseInt(per_user_limit, 10) || 1;
  const codes = loadPromoCodes();

  if (codes.some((c) => c.code.toUpperCase() === cleanCode)) {
    throw new Error('A promo code with this name already exists.');
  }

  const newCode = {
    id: `promo_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    code: cleanCode,
    credits: creditNum,
    max_uses: maxUsesNum,
    used_count: 0,
    per_user_limit: perUserNum,
    expires_at: expires_at ? new Date(expires_at).toISOString() : null,
    active: true,
    note: String(note || '').trim(),
    created_by: actor?.username || 'Admin',
    created_at: new Date().toISOString()
  };

  codes.push(newCode);
  savePromoCodes(codes);

  if (actor) {
    recordAuditAction({
      actor,
      action: 'promo_create',
      target: cleanCode,
      targetType: 'promo_code',
      reason: `Created promo code ${cleanCode} for ${creditNum} credits`,
      before: null,
      after: `${creditNum} credits (${newCode.max_uses || 'unlimited'} uses)`
    });
  }

  return newCode;
}

/**
 * Admin: Update/Toggle/Delete Promo Code
 */
export function updatePromoCodeStatus(codeId, active, actor) {
  const codes = loadPromoCodes();
  const c = codes.find((item) => item.id === codeId || item.code.toUpperCase() === String(codeId).toUpperCase());
  if (!c) throw new Error('Promo code not found.');

  const before = c.active;
  c.active = Boolean(active);
  savePromoCodes(codes);

  if (actor) {
    recordAuditAction({
      actor,
      action: c.active ? 'promo_enable' : 'promo_disable',
      target: c.code,
      targetType: 'promo_code',
      reason: `${c.active ? 'Enabled' : 'Disabled'} promo code ${c.code}`,
      before: before ? 'Active' : 'Disabled',
      after: c.active ? 'Active' : 'Disabled'
    });
  }
  return c;
}

export function deletePromoCode(codeId, actor) {
  let codes = loadPromoCodes();
  const c = codes.find((item) => item.id === codeId || item.code.toUpperCase() === String(codeId).toUpperCase());
  if (!c) throw new Error('Promo code not found.');

  codes = codes.filter((item) => item.id !== c.id);
  savePromoCodes(codes);

  if (actor) {
    recordAuditAction({
      actor,
      action: 'promo_delete',
      target: c.code,
      targetType: 'promo_code',
      reason: `Deleted promo code ${c.code}`,
      before: `${c.credits} credits`,
      after: null
    });
  }
  return true;
}

/**
 * User: Redeem Promo Code
 */
export function redeemPromoCode({ code, serverId, userId, userObj, ip, skipOwnershipCheck = false, requestId = null }) {
  // Check lockout first
  const lock = checkPromoFailureLock(userId, ip);
  if (lock.locked) {
    throw new Error(lock.error);
  }

  // Pure validation errors do NOT count toward failure lock
  if (!code || !String(code).trim()) {
    throw new Error('Code is required.');
  }

  if (!userId) {
    throw new Error('Sign in to redeem promo codes.');
  }

  const cleanCode = normalizePromoCode(code);
  const sid = serverId ? String(serverId).trim() : null;
  const uid = String(userId).trim();

  // If serverId is provided, resolve target server if possible
  let targetServer = null;
  if (sid) {
    const allServers = getPromotedServers(true);
    targetServer = allServers.find((s) => String(s.id) === sid || String(s.guildId) === sid);
    if (targetServer && !skipOwnershipCheck) {
      const isOwner = String(targetServer.ownerId) === uid;
      const isCoOwner = Array.isArray(targetServer.coOwners) && targetServer.coOwners.map(String).includes(uid);
      const isTeamManager = Array.isArray(targetServer.team) && targetServer.team.some((m) => String(m.id || m.userId) === uid && (m.role === 'Owner' || m.role === 'Co-owner' || m.role === 'Manager' || m.role === 'Admin'));
      const isRep = Array.isArray(targetServer.representatives) && targetServer.representatives.map(String).includes(uid);

      if (!isOwner && !isCoOwner && !isTeamManager && !isRep) {
        throw new Error('You must own or manage this server to redeem promotional credits for it.');
      }
    }
  }

  // Load codes & redemptions
  const codes = loadPromoCodes();
  const promo = codes.find((c) => normalizePromoCode(c.code) === cleanCode);

  const now = Date.now();
  if (!promo || !promo.active || (promo.expires_at && new Date(promo.expires_at).getTime() < now)) {
    const { attemptsLeft } = recordPromoFailure(userId, ip, requestId);
    if (attemptsLeft === 0) {
      throw new Error('Redemption failed. Too many failed attempts. Try again in 15 minute(s).');
    }
    throw new Error(`That code isn't valid. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`);
  }

  // Max uses check
  if (promo.max_uses && promo.used_count >= promo.max_uses) {
    const { attemptsLeft } = recordPromoFailure(userId, ip, requestId);
    if (attemptsLeft === 0) {
      throw new Error('Redemption failed. Too many failed attempts. Try again in 15 minute(s).');
    }
    throw new Error(`This code has reached its limit. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`);
  }

  // User redemption limit check
  const redemptions = loadPromoRedemptions();
  const userUses = redemptions.filter((r) => r.code_id === promo.id && r.user_id === uid).length;
  if (userUses >= (promo.per_user_limit || 1)) {
    const { attemptsLeft } = recordPromoFailure(userId, ip, requestId);
    if (attemptsLeft === 0) {
      throw new Error('Redemption failed. Too many failed attempts. Try again in 15 minute(s).');
    }
    throw new Error(`You already used this code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`);
  }

  // Redeem in one transaction
  promo.used_count = (promo.used_count || 0) + 1;
  savePromoCodes(codes);

  const idempotencyKey = `promo_${promo.id}_${uid}_${Date.now()}`;
  let ledgerTx;

  if (targetServer) {
    // Add ledger transaction for server
    ledgerTx = recordLedgerTransaction({
      userId: uid,
      guildId: targetServer.id,
      guildName: targetServer.name,
      type: 'earned',
      amount: promo.credits,
      reason: 'promo_code',
      description: `Redeemed promo code ${promo.code} (+${promo.credits} cr)`,
      triggeredBy: userObj?.username ? `${userObj.username} (Promo Code)` : 'User (Promo Code)',
      status: 'posted'
    });
  } else {
    // Direct personal wallet deposit
    const curBal = getUserBalance(uid);
    setUserBalance(uid, curBal + promo.credits);
    ledgerTx = recordLedgerTransaction({
      userId: uid,
      guildId: null,
      guildName: 'Personal Wallet',
      type: 'earned',
      amount: promo.credits,
      reason: 'promo_code',
      description: `Redeemed promo code ${promo.code} (+${promo.credits} cr)`,
      triggeredBy: userObj?.username ? `${userObj.username} (Promo Code)` : 'User (Promo Code)',
      status: 'posted'
    });
  }

  const redemptionRecord = {
    id: `redemption_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    code_id: promo.id,
    code: promo.code,
    credits: promo.credits,
    user_id: uid,
    username: userObj?.username || 'Unknown',
    avatar: userObj?.avatar || null,
    server_id: targetServer?.id || null,
    server_name: targetServer?.name || 'Personal Wallet',
    server_icon: targetServer?.iconUrl || targetServer?.icon || null,
    ledger_id: ledgerTx?.id || idempotencyKey,
    created_at: new Date().toISOString()
  };

  redemptions.push(redemptionRecord);
  savePromoRedemptions(redemptions);

  // Reset failures upon successful redemption
  recordPromoSuccess(userId, ip);

  const targetName = targetServer?.name || 'your personal wallet';
  return {
    success: true,
    code: promo.code,
    credits: promo.credits,
    serverName: targetName,
    message: `Redeemed. ${promo.credits} credits were added to ${targetName}.`
  };
}

/**
 * User: Get redeemed codes for user
 */
export function getUserRedemptions(userId) {
  if (!userId) return [];
  const uid = String(userId).trim();
  const redemptions = loadPromoRedemptions();
  return redemptions
    .filter((r) => r.user_id === uid)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Admin: Get redemptions for a specific code
 */
export function getCodeRedemptions(codeId) {
  const redemptions = loadPromoRedemptions();
  return redemptions
    .filter((r) => r.code_id === codeId || r.code.toUpperCase() === String(codeId).toUpperCase())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

