import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { invalidateSiteStateCache, isMaintenanceActive } from './siteStateManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = fs.existsSync(path.join(process.cwd(), 'data'))
  ? path.join(process.cwd(), 'data')
  : (fs.existsSync(path.join(__dirname, '..', 'data'))
    ? path.join(__dirname, '..', 'data')
    : path.join(__dirname, 'data'));

const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'admin_audit_log.json');
const BANNED_USERS_FILE = path.join(DATA_DIR, 'banned_users.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const FLAGS_FILE = path.join(DATA_DIR, 'flags.json');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');
const MAINTENANCE_FILE = path.join(DATA_DIR, 'site_state.json');
const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.json');
const RULES_FILE = path.join(DATA_DIR, 'detector_rules.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function safeRead(filePath, fallback) {
  try {
    let content = null;
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf8');
    }
    const fileName = path.basename(filePath);
    const seedPath = path.join(process.cwd(), 'seeds', fileName);

    let parsed = null;
    if (content) {
      try { parsed = JSON.parse(content); } catch {}
    }

    const isEmpty = parsed === null || parsed === undefined ||
      (Array.isArray(parsed) && parsed.length === 0) ||
      (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0);

    if (isEmpty && fs.existsSync(seedPath)) {
      try {
        const seedContent = fs.readFileSync(seedPath, 'utf8');
        const seedParsed = JSON.parse(seedContent);
        if (seedParsed !== null && seedParsed !== undefined) {
          if (Array.isArray(seedParsed) && seedParsed.length > 0) return seedParsed;
          if (typeof seedParsed === 'object' && !Array.isArray(seedParsed) && Object.keys(seedParsed).length > 0) return seedParsed;
          if (parsed === null || parsed === undefined) return seedParsed;
        }
      } catch {}
    }

    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(filePath, data) {
  try {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[ADMIN] Error writing to ${filePath}:`, err);
  }
}

// ── Rate Limiter for Sensitive Actions (30 actions / min per admin) ─────────
const rateLimitMap = new Map();

export function checkAdminRateLimit(adminId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const history = (rateLimitMap.get(adminId) || []).filter(t => now - t < windowMs);
  if (history.length >= 30) {
    return false;
  }
  history.push(now);
  rateLimitMap.set(adminId, history);
  return true;
}

// ── Admins & Permissions ──────────────────────────────────────────────────
export function loadAdmins() {
  const list = safeRead(ADMINS_FILE, []);
  if (list.length === 0) {
    const rawIds = process.env.ADMIN_DISCORD_IDS || '';
    const seedIds = rawIds.split(',').map(s => s.trim()).filter(Boolean);
    const seeded = seedIds.map(id => ({
      userId: id,
      username: 'admin',
      displayName: 'Administrator',
      role: 'Owner',
      addedAt: new Date().toISOString(),
      addedBy: 'System (ADMIN_DISCORD_IDS)'
    }));
    if (seeded.length > 0) {
      safeWrite(ADMINS_FILE, seeded);
    }
    return seeded;
  }
  return list;
}

export function saveAdmins(list) {
  safeWrite(ADMINS_FILE, list);
}

export function getAdminRecord(userId, optionalUsername = null) {
  if (!userId && !optionalUsername) return null;
  const cleanId = userId ? String(userId).trim() : '';
  const cleanUser = optionalUsername ? String(optionalUsername).trim().toLowerCase() : '';
  const admins = loadAdmins();
  const found = admins.find(a => {
    const aId = String(a.userId || a.id || '').trim();
    const aUser = String(a.username || '').trim().toLowerCase();
    return (cleanId && aId === cleanId) ||
           (cleanId && aUser === cleanId.toLowerCase()) ||
           (cleanUser && (aId === cleanUser || aUser === cleanUser));
  });
  if (found) {
    if (/^\d{17,20}$/.test(cleanId) && found.userId !== cleanId) {
      found.userId = cleanId;
      saveAdmins(admins);
    }
    return found;
  }

  // Also check ADMIN_DISCORD_IDS environment variable
  const rawIds = process.env.ADMIN_DISCORD_IDS || '';
  const seedIds = rawIds.split(',').map(s => s.trim()).filter(Boolean);
  if (cleanId && seedIds.includes(cleanId)) {
    const seeded = {
      userId: cleanId,
      username: 'admin',
      displayName: 'Owner',
      role: 'Owner',
      addedAt: new Date().toISOString(),
      addedBy: 'System (ADMIN_DISCORD_IDS)'
    };
    admins.push(seeded);
    saveAdmins(admins);
    return seeded;
  }
  return null;
}

export async function addAdmin({ userId, username, displayName, role = 'Moderator', addedBy, reason }) {
  if (!userId) throw new Error('User ID is required');
  let cleanId = String(userId).replace(/[<@!>]/g, '').trim();

  // If not a snowflake ID, attempt to resolve from known_users or known_accounts
  let resolvedUsername = username || 'discord_user';
  let resolvedDisplayName = displayName || username || 'Admin';
  let resolvedAvatar = null;
  let resolvedAvatarUrl = null;

  if (!/^\d{17,20}$/.test(cleanId)) {
    const searchTarget = cleanId.toLowerCase().replace(/^@/, '');
    const knownUsers = safeRead(path.join(DATA_DIR, 'known_users.json'), []);
    const knownAccounts = safeRead(path.join(DATA_DIR, 'known_accounts.json'), []);
    const sessionsData = safeRead(path.join(DATA_DIR, 'web_sessions.json'), {});
    const sessionUsers = Object.values(sessionsData).map(s => s?.user).filter(Boolean);
    const directoryData = safeRead(path.join(DATA_DIR, 'promoted_servers.json'), { servers: [] });
    const dirServers = Array.isArray(directoryData) ? directoryData : (directoryData.servers || []);

    const matched = knownUsers.find(u =>
      String(u.username || '').toLowerCase() === searchTarget ||
      String(u.displayName || u.globalName || '').toLowerCase() === searchTarget ||
      String(u.id || u.userId || '') === searchTarget
    ) || knownAccounts.find(a =>
      String(a.username || '').toLowerCase() === searchTarget ||
      String(a.displayName || a.globalName || '').toLowerCase() === searchTarget ||
      String(a.id || a.userId || '') === searchTarget
    ) || sessionUsers.find(u =>
      String(u.username || '').toLowerCase() === searchTarget ||
      String(u.global_name || u.globalName || '').toLowerCase() === searchTarget ||
      String(u.id || '') === searchTarget
    ) || dirServers.find(s =>
      String(s.ownerUsername || '').toLowerCase() === searchTarget ||
      String(s.ownerDisplayName || '').toLowerCase() === searchTarget ||
      String(s.ownerId || '') === searchTarget
    );

    if (matched) {
      cleanId = String(matched.id || matched.userId || matched.ownerId);
      resolvedUsername = matched.username || matched.ownerUsername || resolvedUsername;
      resolvedDisplayName = matched.displayName || matched.globalName || matched.global_name || matched.ownerDisplayName || resolvedDisplayName;
      resolvedAvatar = matched.avatar || matched.ownerAvatar || null;
      resolvedAvatarUrl = matched.avatarUrl || null;
    }
  }

  // Fetch real profile from Discord REST API using bot token
  const botToken = (process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (/^\d{17,20}$/.test(cleanId) && botToken) {
    try {
      const res = await fetch(`https://discord.com/api/v10/users/${cleanId}`, {
        headers: { Authorization: `Bot ${botToken.trim()}` },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const dUser = await res.json();
        if (dUser && dUser.username) {
          resolvedUsername = dUser.username;
          resolvedDisplayName = dUser.global_name || dUser.username;
          if (dUser.avatar) {
            const ext = String(dUser.avatar).startsWith('a_') ? 'gif' : 'png';
            resolvedAvatarUrl = `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.${ext}?size=128`;
            resolvedAvatar = dUser.avatar;
          }
        }
      }
    } catch (err) {
      console.warn('[ADMIN] Could not fetch Discord profile for new admin:', err.message);
    }
  }

  const admins = loadAdmins();
  const existing = admins.find(a => String(a.userId) === cleanId);
  if (existing) {
    const beforeRole = existing.role;
    existing.role = role;
    if (resolvedUsername && resolvedUsername !== 'discord_user') existing.username = resolvedUsername;
    if (resolvedDisplayName && resolvedDisplayName !== 'Admin') existing.displayName = resolvedDisplayName;
    if (resolvedAvatarUrl) existing.avatarUrl = resolvedAvatarUrl;
    if (resolvedAvatar) existing.avatar = resolvedAvatar;
    saveAdmins(admins);
    recordAuditAction({
      actor: addedBy,
      action: 'admin_role_update',
      target: cleanId,
      targetType: 'admin',
      reason: reason || 'Admin role promotion/demotion',
      before: beforeRole,
      after: role
    });
    return existing;
  }

  const newAdmin = {
    userId: cleanId,
    username: resolvedUsername,
    displayName: resolvedDisplayName,
    avatar: resolvedAvatarUrl || resolvedAvatar,
    avatarUrl: resolvedAvatarUrl,
    role: role,
    addedAt: new Date().toISOString(),
    addedBy: addedBy?.displayName || addedBy?.username || 'Owner'
  };
  admins.push(newAdmin);
  saveAdmins(admins);
  recordAuditAction({
    actor: addedBy,
    action: 'admin_add',
    target: cleanId,
    targetType: 'admin',
    reason: reason || 'Added to administrator roster',
    before: null,
    after: role
  });
  return newAdmin;
}

export function removeAdmin(userId, actor, reason) {
  if (!userId) throw new Error('User ID is required');
  const admins = loadAdmins();
  const target = admins.find(a => String(a.userId) === String(userId));
  if (!target) throw new Error('Admin not found');
  if (target.role === 'Owner') {
    const ownerCount = admins.filter(a => a.role === 'Owner').length;
    if (ownerCount <= 1) {
      throw new Error('Cannot remove the primary platform Owner');
    }
  }

  const updated = admins.filter(a => String(a.userId) !== String(userId));
  saveAdmins(updated);
  recordAuditAction({
    actor,
    action: 'admin_remove',
    target: userId,
    targetType: 'admin',
    reason: reason || 'Removed from administrator roster',
    before: target.role,
    after: null
  });
  return true;
}

// ── Audit Log ─────────────────────────────────────────────────────────────
export function loadAuditLog() {
  return safeRead(AUDIT_LOG_FILE, []);
}

export function saveAuditLog(list) {
  safeWrite(AUDIT_LOG_FILE, list);
}

export function recordAuditAction({ actor, action, target, targetType, reason, before, after }) {
  const log = loadAuditLog();
  const entry = {
    id: `aud_${Date.now()}_${randomBytes(4).toString('hex')}`,
    actor: {
      id: actor?.userId || actor?.id || 'system',
      username: actor?.username || 'System'
    },
    action,
    target: String(target || 'general'),
    targetType: targetType || 'general',
    reason: reason || 'Administrative action',
    before: before ?? null,
    after: after ?? null,
    timestamp: new Date().toISOString()
  };
  log.unshift(entry);
  saveAuditLog(log.slice(0, 500));
  return entry;
}

// ── Banned Users ──────────────────────────────────────────────────────────
export function loadBannedUsers() {
  const raw = safeRead(BANNED_USERS_FILE, []);
  const now = Date.now();
  // Filter expired temporary bans
  const active = raw.filter(ban => {
    if (!ban.expiresAt) return true;
    return new Date(ban.expiresAt).getTime() > now;
  });
  if (active.length !== raw.length) {
    saveBannedUsers(active);
  }
  return active;
}

export function saveBannedUsers(list) {
  safeWrite(BANNED_USERS_FILE, list);
}

export function isUserBanned(userId) {
  if (!userId) return false;
  const list = loadBannedUsers();
  return list.some(b => String(b.userId) === String(userId));
}

export function banUser({ userId, username, reason, duration = 'Permanent', actor }) {
  if (!userId) throw new Error('User ID is required');
  if (!reason || reason.trim().length < 10) {
    throw new Error('Ban reason must be at least 10 characters.');
  }

  let expiresAt = null;
  const now = Date.now();
  if (duration === '1d' || duration === '1 day') {
    expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  } else if (duration === '7d' || duration === '7 days') {
    expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (duration === '30d' || duration === '30 days') {
    expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const list = loadBannedUsers();
  const banRecord = {
    id: `ban_${Date.now()}`,
    userId: String(userId).trim(),
    username: username || 'discord_user',
    reason: reason.trim(),
    duration,
    expiresAt,
    admin: actor?.username || 'Platform Administrator',
    adminId: actor?.userId || actor?.id || 'system',
    bannedAt: new Date().toISOString()
  };

  const updated = [banRecord, ...list.filter(b => String(b.userId) !== String(userId))];
  saveBannedUsers(updated);

  recordAuditAction({
    actor,
    action: 'user_ban',
    target: userId,
    targetType: 'user',
    reason: reason.trim(),
    before: 'active',
    after: `banned (${duration})`
  });

  return banRecord;
}

export function unbanUser({ userId, reason, actor }) {
  if (!userId) throw new Error('User ID is required');
  const uid = String(userId).trim();
  const list = loadBannedUsers();
  const existing = list.find(b => String(b.userId) === uid);
  const updated = list.filter(b => String(b.userId) !== uid);
  saveBannedUsers(updated);

  // Clean from blacklist.json so blacklists do not keep blocking the user
  try {
    const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');
    if (fs.existsSync(BLACKLIST_FILE)) {
      let blk = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8') || '[]');
      const beforeLen = blk.length;
      blk = blk.filter(item => {
        if ((item.type === 'discord_id' || !item.type) && String(item.value || item.userId) === uid) {
          return false;
        }
        return true;
      });
      if (blk.length !== beforeLen) {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blk, null, 2), 'utf8');
      }
    }
  } catch (err) {
    console.warn('[UNBAN] Error cleaning blacklist for unbanned user:', err.message);
  }

  recordAuditAction({
    actor,
    action: 'user_unban',
    target: uid,
    targetType: 'user',
    reason: reason || 'Administrative pardon / restriction lifted',
    before: existing ? `banned (${existing.duration})` : 'banned',
    after: 'active'
  });

  return true;
}

// ── Reports ───────────────────────────────────────────────────────────────
export function loadReports() {
  return safeRead(REPORTS_FILE, []);
}

export function saveReports(list) {
  safeWrite(REPORTS_FILE, list);
}

export function createReport({ reporter, targetType, targetId, serverId, reason, details, snapshot }) {
  const list = loadReports();
  const reporterId = String(reporter?.id || 'anonymous');
  const targetIdStr = String(targetId);

  // Rate limit: one open report per user per target per 24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const existingOpen = list.find(r =>
    String(r.reporterId) === reporterId &&
    String(r.targetId) === targetIdStr &&
    (r.status === 'Open' || r.status === 'pending') &&
    new Date(r.createdAt || 0).getTime() > oneDayAgo
  );
  if (existingOpen) {
    throw new Error('You already have an open report for this item.');
  }

  const report = {
    id: `rep_${Date.now()}_${randomBytes(4).toString('hex')}`,
    reporterId,
    reporterTag: reporter?.globalName || reporter?.username || `User ${reporterId.slice(-4)}`,
    targetType: targetType || 'server',
    targetId: targetIdStr,
    serverId: serverId ? String(serverId) : null,
    reason: String(reason || 'Other').trim(),
    details: details ? String(details).trim().slice(0, 500) : '',
    snapshot: snapshot || {},
    status: 'Open',
    internalNotes: '',
    assignee: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  list.unshift(report);
  saveReports(list);

  try {
    recordAuditAction({
      actor: reporter,
      action: 'report_created',
      target: targetIdStr,
      targetType: targetType || 'server',
      reason: reason,
      after: report
    });
  } catch {}

  return report;
}

export function updateReport({ reportId, status, adminNotes, actor }) {
  const list = loadReports();
  const report = list.find(r => String(r.id) === String(reportId));
  if (!report) throw new Error('Report not found');
  const beforeStatus = report.status;
  report.status = status;
  if (adminNotes !== undefined) report.adminNotes = adminNotes;
  report.updatedAt = new Date().toISOString();
  report.updatedBy = actor?.username || 'Admin';
  saveReports(list);

  recordAuditAction({
    actor,
    action: 'report_update',
    target: reportId,
    targetType: 'report',
    reason: adminNotes || `Report marked as ${status}`,
    before: beforeStatus,
    after: status
  });
  return report;
}

// ── Flags (Suspicious Joins) ──────────────────────────────────────────────
export function loadFlags() {
  return safeRead(FLAGS_FILE, []);
}

export function saveFlags(list) {
  safeWrite(FLAGS_FILE, list);
}

export function updateFlagAction({ flagId, action, reason, actor }) {
  const list = loadFlags();
  const flag = list.find(f => String(f.id) === String(flagId));
  if (!flag) throw new Error('Flag not found');
  const beforeStatus = flag.status;

  let newStatus = 'Resolved';
  if (action === 'dismiss' || action === 'dismissed') newStatus = 'Dismissed';
  else if (action === 'review' || action === 'reviewing') newStatus = 'Reviewing';
  else if (action === 'open') newStatus = 'Open';
  else newStatus = 'Resolved';

  flag.status = newStatus;
  flag.lastAction = action;
  flag.resolvedAt = new Date().toISOString();
  flag.resolvedBy = actor?.username || 'Admin';
  flag.actionReason = reason || '';
  if (!flag.timeline) flag.timeline = [];
  flag.timeline.push({
    timestamp: new Date().toISOString(),
    action,
    actor: actor?.username || 'Admin',
    note: reason || ''
  });
  saveFlags(list);

  recordAuditAction({
    actor,
    action: `flag_${action}`,
    target: flag.userId || flag.serverId || flag.id,
    targetType: 'flag',
    reason: reason || `Flag ${flagId} action: ${action}`,
    before: beforeStatus,
    after: newStatus
  });
  return flag;
}

// ── Detector Rules (Moderation Queue Thresholds) ───────────────────────────
export function getDetectorRules() {
  return safeRead(RULES_FILE, {
    joinsLeavesPerAccountPerDay: 5,
    minStayHours: 24,
    recruitsPerInviterPerHour: 10,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  });
}

export function saveDetectorRules({ joinsLeavesPerAccountPerDay, minStayHours, recruitsPerInviterPerHour, actor }) {
  const before = getDetectorRules();
  const rules = {
    joinsLeavesPerAccountPerDay: Math.max(1, Number(joinsLeavesPerAccountPerDay) || 5),
    minStayHours: Math.max(1, Number(minStayHours) || 24),
    recruitsPerInviterPerHour: Math.max(1, Number(recruitsPerInviterPerHour) || 10),
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.username || 'Admin'
  };
  safeWrite(RULES_FILE, rules);

  recordAuditAction({
    actor,
    action: 'detector_rules_update',
    target: 'rules',
    targetType: 'system',
    reason: `Updated moderation rules: joins/leaves=${rules.joinsLeavesPerAccountPerDay}/day, minStay=${rules.minStayHours}h, recruits=${rules.recruitsPerInviterPerHour}/h`,
    before,
    after: rules
  });
  return rules;
}

// ── Announcements ─────────────────────────────────────────────────────────
export function loadAnnouncements() {
  return safeRead(ANNOUNCEMENTS_FILE, []);
}

export function saveAnnouncements(list) {
  safeWrite(ANNOUNCEMENTS_FILE, list);
}

export function upsertAnnouncement({ id, text, level = 'info', active = true, dismissible = true, link = null, endDate = null, actor }) {
  if (!text || !text.trim()) throw new Error('Announcement text is required');
  const list = loadAnnouncements();
  const annId = id || `ann_${Date.now()}`;
  const existingIdx = list.findIndex(a => a.id === annId);
  const entry = {
    id: annId,
    text: text.trim(),
    level,
    active: active !== undefined ? Boolean(active) : true,
    dismissible: Boolean(dismissible),
    link: link ? String(link).trim() : null,
    endDate: endDate ? new Date(endDate).toISOString() : null,
    updatedAt: new Date().toISOString(),
    createdBy: actor?.username || 'Admin'
  };

  if (existingIdx >= 0) {
    list[existingIdx] = entry;
  } else {
    entry.createdAt = new Date().toISOString();
    list.unshift(entry);
  }
  saveAnnouncements(list);

  recordAuditAction({
    actor,
    action: existingIdx >= 0 ? 'announcement_update' : 'announcement_create',
    target: annId,
    targetType: 'announcement',
    reason: `Announcement: "${text.substring(0, 40)}..."`,
    before: null,
    after: level
  });
  return entry;
}

export function deleteAnnouncement(id, actor) {
  const list = loadAnnouncements();
  const updated = list.filter(a => a.id !== id);
  saveAnnouncements(updated);
  recordAuditAction({
    actor,
    action: 'announcement_delete',
    target: id,
    targetType: 'announcement',
    reason: 'Announcement removed from circulation',
    before: 'active',
    after: null
  });
  return true;
}

// ── Maintenance ───────────────────────────────────────────────────────────
export function getMaintenanceStatus() {
  if (process.env.MAINTENANCE_FORCE_OFF === 'true' || process.env.MAINTENANCE_FORCE_OFF === '1') {
    return {
      maintenance: false,
      maintenance_on: false,
      mode: 'operational',
      title: '',
      message: '',
      eta: null,
      starts_at: null,
      ends_at: null,
      affectedServices: [],
      allowedUserIds: [],
      forced_off: true,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updatedBy: 'MAINTENANCE_FORCE_OFF',
      updated_by: 'MAINTENANCE_FORCE_OFF'
    };
  }

  const active = isMaintenanceActive();
  const data = safeRead(MAINTENANCE_FILE, {});
  const isMaint = Boolean(active.active);

  return {
    maintenance: isMaint,
    maintenance_on: isMaint,
    mode: isMaint ? 'maintenance' : 'operational',
    title: active.title || data.title || '',
    message: active.message || data.message || '',
    eta: active.eta || data.eta || null,
    starts_at: active.starts_at || data.starts_at || null,
    ends_at: active.ends_at || data.ends_at || null,
    affectedServices: Array.isArray(data.affectedServices) ? data.affectedServices : [],
    allowedUserIds: Array.isArray(data.allowedUserIds) ? data.allowedUserIds : [],
    updatedAt: data.updatedAt || data.updated_at || new Date().toISOString(),
    updated_at: data.updated_at || data.updatedAt || new Date().toISOString(),
    updatedBy: data.updatedBy || data.updated_by || 'System',
    updated_by: data.updated_by || data.updatedBy || 'System'
  };
}

export function setMaintenanceStatus({ mode, title, message, eta, starts_at, ends_at, affectedServices = [], allowedUserIds = [], actor }) {
  const before = getMaintenanceStatus();
  const isMaint = mode === 'maintenance' || mode === true;
  const nowIso = new Date().toISOString();
  const actorName = actor?.username || 'Admin';

  const record = {
    maintenance: isMaint,
    maintenance_on: isMaint,
    mode: isMaint ? 'maintenance' : 'operational',
    title: title ? String(title).trim() : '',
    message: message ? String(message).trim() : '',
    eta: eta ? String(eta).trim() : null,
    starts_at: starts_at ? new Date(starts_at).toISOString() : null,
    ends_at: ends_at ? new Date(ends_at).toISOString() : null,
    affectedServices: Array.isArray(affectedServices) ? affectedServices : [],
    allowedUserIds: Array.isArray(allowedUserIds) ? allowedUserIds : [],
    updatedAt: nowIso,
    updated_at: nowIso,
    updatedBy: actorName,
    updated_by: actorName
  };
  safeWrite(MAINTENANCE_FILE, record);
  invalidateSiteStateCache();

  recordAuditAction({
    actor,
    action: 'maintenance_toggle',
    target: 'platform_system',
    targetType: 'system',
    reason: record.title || `Maintenance mode set to ${record.mode}`,
    before: before.mode,
    after: record.mode
  });
  return record;
}

