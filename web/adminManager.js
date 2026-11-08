import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const MAINTENANCE_FILE = path.join(DATA_DIR, 'maintenance.json');
const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.json');
const RULES_FILE = path.join(DATA_DIR, 'detector_rules.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function safeRead(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || 'null') ?? fallback;
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

export function getAdminRecord(userId) {
  if (!userId) return null;
  const admins = loadAdmins();
  return admins.find(a => String(a.userId) === String(userId)) || null;
}

export function addAdmin({ userId, username, displayName, role = 'Moderator', addedBy, reason }) {
  if (!userId) throw new Error('User ID is required');
  const admins = loadAdmins();
  const existing = admins.find(a => String(a.userId) === String(userId));
  if (existing) {
    const beforeRole = existing.role;
    existing.role = role;
    if (username) existing.username = username;
    if (displayName) existing.displayName = displayName;
    saveAdmins(admins);
    recordAuditAction({
      actor: addedBy,
      action: 'admin_role_update',
      target: userId,
      targetType: 'admin',
      reason: reason || 'Admin role promotion/demotion',
      before: beforeRole,
      after: role
    });
    return existing;
  }

  const newAdmin = {
    userId: String(userId).trim(),
    username: username || 'discord_user',
    displayName: displayName || username || 'Admin',
    role: role,
    addedAt: new Date().toISOString(),
    addedBy: addedBy?.username || 'Owner'
  };
  admins.push(newAdmin);
  saveAdmins(admins);
  recordAuditAction({
    actor: addedBy,
    action: 'admin_add',
    target: userId,
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
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
  const list = loadBannedUsers();
  const existing = list.find(b => String(b.userId) === String(userId));
  const updated = list.filter(b => String(b.userId) !== String(userId));
  saveBannedUsers(updated);

  recordAuditAction({
    actor,
    action: 'user_unban',
    target: userId,
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
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

export function upsertAnnouncement({ id, text, level = 'info', active = true, dismissible = true, actor }) {
  if (!text || !text.trim()) throw new Error('Announcement text is required');
  const list = loadAnnouncements();
  const annId = id || `ann_${Date.now()}`;
  const existingIdx = list.findIndex(a => a.id === annId);
  const entry = {
    id: annId,
    text: text.trim(),
    level,
    active: Boolean(active),
    dismissible: Boolean(dismissible),
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
  return safeRead(MAINTENANCE_FILE, {
    mode: 'operational',
    title: '',
    message: '',
    affectedServices: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'System'
  });
}

export function setMaintenanceStatus({ mode, title, message, affectedServices = [], actor }) {
  const before = getMaintenanceStatus();
  const record = {
    mode: mode === 'maintenance' ? 'maintenance' : 'operational',
    title: title ? title.trim() : '',
    message: message ? message.trim() : '',
    affectedServices: Array.isArray(affectedServices) ? affectedServices : [],
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.username || 'Admin'
  };
  safeWrite(MAINTENANCE_FILE, record);

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

