import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { recordAuditAction } from './adminManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SITE_STATE_FILE = path.join(DATA_DIR, 'site_state.json');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');
const DISMISSALS_FILE = path.join(DATA_DIR, 'announcement_dismissals.json');

// In-memory cache for maintenance state
let cachedSiteState = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5000;

export function invalidateSiteStateCache() {
  cachedSiteState = null;
  lastCacheTime = 0;
}

export function sanitizeMarkdown(input) {
  if (!input) return '';
  return String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

export function loadSiteState() {
  // EMERGENCY KILL SWITCH: if MAINTENANCE_FORCE_OFF is true, maintenance is always OFF
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
      updated_at: new Date().toISOString(),
      updated_by: 'MAINTENANCE_FORCE_OFF'
    };
  }

  const now = Date.now();
  if (cachedSiteState && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedSiteState;
  }

  try {
    if (fs.existsSync(SITE_STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SITE_STATE_FILE, 'utf8') || '{}');
      const isMaint = Boolean(data.maintenance_on === true || data.maintenance === true || data.mode === 'maintenance');
      cachedSiteState = {
        maintenance: isMaint,
        maintenance_on: isMaint,
        mode: isMaint ? 'maintenance' : 'operational',
        title: data.title || '',
        message: data.message || '',
        eta: data.eta || null,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
        affectedServices: Array.isArray(data.affectedServices) ? data.affectedServices : [],
        allowedUserIds: Array.isArray(data.allowedUserIds) ? data.allowedUserIds : [],
        updated_at: data.updated_at || data.updatedAt || new Date().toISOString(),
        updated_by: data.updated_by || data.updatedBy || 'System'
      };
      lastCacheTime = now;
      return cachedSiteState;
    }
  } catch {}

  cachedSiteState = {
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
    updated_at: new Date().toISOString(),
    updated_by: 'System'
  };
  lastCacheTime = now;
  return cachedSiteState;
}

export function saveSiteState(state, actor) {
  try {
    const before = loadSiteState();
    const isMaint = Boolean(
      state.maintenance_on === true || state.maintenance === true || state.mode === 'maintenance'
    );
    const cleanState = {
      maintenance: isMaint,
      maintenance_on: isMaint,
      mode: isMaint ? 'maintenance' : 'operational',
      title: sanitizeMarkdown(state.title || '').trim(),
      message: sanitizeMarkdown(state.message || '').trim(),
      eta: state.eta ? String(state.eta).trim() : null,
      starts_at: state.starts_at ? new Date(state.starts_at).toISOString() : null,
      ends_at: state.ends_at ? new Date(state.ends_at).toISOString() : null,
      affectedServices: Array.isArray(state.affectedServices) ? state.affectedServices : [],
      allowedUserIds: Array.isArray(state.allowedUserIds) ? state.allowedUserIds : [],
      updated_at: new Date().toISOString(),
      updated_by: actor?.username || 'Admin'
    };

    const tmp = `${SITE_STATE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cleanState, null, 2), 'utf8');
    fs.renameSync(tmp, SITE_STATE_FILE);

    cachedSiteState = cleanState;
    lastCacheTime = Date.now();

    if (actor) {
      recordAuditAction({
        actor,
        action: 'site_maintenance_toggle',
        target: 'platform_system',
        targetType: 'system',
        reason: cleanState.message || `Maintenance set to ${cleanState.maintenance_on ? 'ON' : 'OFF'}`,
        before: before.maintenance_on ? 'ON' : 'OFF',
        after: cleanState.maintenance_on ? 'ON' : 'OFF'
      });
    }

    return cleanState;
  } catch (err) {
    console.error('[SITE STATE] Save failed:', err.message);
    throw err;
  }
}

const DEFAULT_BANNER_FALLBACK = 'Found a bug? Report it with /bugreport and earn 50 credits';

export function getDefaultBannerText() {
  try {
    if (fs.existsSync(SITE_STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SITE_STATE_FILE, 'utf8') || '{}');
      if (data.defaultBannerText && typeof data.defaultBannerText === 'string') {
        return data.defaultBannerText.trim();
      }
    }
  } catch {}
  return DEFAULT_BANNER_FALLBACK;
}

export function setDefaultBannerText(text, actor) {
  try {
    let data = {};
    if (fs.existsSync(SITE_STATE_FILE)) {
      data = JSON.parse(fs.readFileSync(SITE_STATE_FILE, 'utf8') || '{}');
    }
    const clean = String(text || '').trim() || DEFAULT_BANNER_FALLBACK;
    const before = data.defaultBannerText || DEFAULT_BANNER_FALLBACK;
    data.defaultBannerText = clean;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SITE_STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
    invalidateSiteStateCache();
    if (actor) {
      recordAuditAction({
        actor,
        action: 'default_banner_update',
        target: 'top_banner',
        targetType: 'system',
        reason: 'Updated default top banner text',
        before,
        after: clean
      });
    }
    return clean;
  } catch (err) {
    console.error('[SITE STATE] setDefaultBannerText failed:', err.message);
    return text || DEFAULT_BANNER_FALLBACK;
  }
}

/**
 * Check if maintenance is currently active.
 *
 * Rules:
 * 1. EMERGENCY KILL SWITCH: if MAINTENANCE_FORCE_OFF is true, returns active: false.
 * 2. SCHEDULED WINDOW: only applies between starts_at and ends_at (both must be set, in UTC).
 *    A null/missing end date means "no scheduled end", NOT "on forever".
 * 3. MANUAL SWITCH: maintenance is ON only when an admin explicitly switched it on.
 */
export function isMaintenanceActive() {
  // 1. Emergency kill switch
  if (process.env.MAINTENANCE_FORCE_OFF === 'true' || process.env.MAINTENANCE_FORCE_OFF === '1') {
    return { active: false, mode: 'operational', forced_off: true };
  }

  const state = loadSiteState();
  const now = Date.now();

  // 2. Scheduled window: BOTH starts_at and ends_at MUST be set and valid UTC timestamps
  if (state.starts_at && state.ends_at) {
    const startTime = new Date(state.starts_at).getTime();
    const endTime = new Date(state.ends_at).getTime();
    if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && endTime > startTime) {
      if (now >= startTime && now <= endTime) {
        return {
          active: true,
          mode: 'maintenance',
          title: state.title || 'Scheduled Maintenance',
          message: state.message || 'ConnectingERLC is currently undergoing scheduled platform upgrades. All services will resume shortly.',
          eta: state.eta || new Date(endTime).toISOString(),
          starts_at: new Date(startTime).toISOString(),
          ends_at: new Date(endTime).toISOString(),
          scheduled: true
        };
      }
    }
  }

  // 3. Manual switch: ON only when an admin explicitly turned it on
  const isManuallyOn = Boolean(
    state.maintenance_on === true || state.maintenance === true || state.mode === 'maintenance'
  );

  if (isManuallyOn) {
    return {
      active: true,
      mode: 'maintenance',
      title: state.title || 'System Maintenance',
      message: state.message || 'ConnectingERLC is currently undergoing scheduled platform upgrades. All services will resume shortly.',
      eta: state.eta || null,
      starts_at: state.starts_at || null,
      ends_at: state.ends_at || null,
      scheduled: false
    };
  }

  return { active: false, mode: 'operational' };
}

// ─── ANNOUNCEMENTS ──────────────────────────────────────────────────────────

export function loadAnnouncements() {
  try {
    if (fs.existsSync(ANNOUNCEMENTS_FILE)) {
      return JSON.parse(fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf8') || '[]');
    }
  } catch {}
  return [];
}

export function saveAnnouncements(announcements) {
  try {
    const tmp = `${ANNOUNCEMENTS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(announcements, null, 2), 'utf8');
    fs.renameSync(tmp, ANNOUNCEMENTS_FILE);
  } catch (err) {
    console.error('[ANNOUNCEMENTS] Save failed:', err.message);
  }
}

export function loadDismissals() {
  try {
    if (fs.existsSync(DISMISSALS_FILE)) {
      return JSON.parse(fs.readFileSync(DISMISSALS_FILE, 'utf8') || '{}');
    }
  } catch {}
  return {};
}

export function saveDismissals(data) {
  try {
    const tmp = `${DISMISSALS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DISMISSALS_FILE);
  } catch (err) {
    console.error('[DISMISSALS] Save failed:', err.message);
  }
}

export function dismissAnnouncement(userId, announcementId) {
  if (!announcementId) return false;
  const dismissals = loadDismissals();
  const key = userId || 'anonymous';
  if (!dismissals[key]) dismissals[key] = [];
  if (!dismissals[key].includes(announcementId)) {
    dismissals[key].push(announcementId);
    saveDismissals(dismissals);
  }
  return true;
}

/**
 * Get active announcements filtered by audience and dismissed list
 */
export function getActiveAnnouncements({ userId, isAdmin, isServerOwner, dismissedIds = [] }) {
  const all = loadAnnouncements();
  const now = Date.now();
  const userDismissed = new Set(dismissedIds);

  if (userId) {
    const dismissals = loadDismissals();
    const stored = dismissals[userId] || [];
    stored.forEach((id) => userDismissed.add(id));
  }

  const live = all.filter((a) => {
    if (a.status === 'ended' || a.active === false) return false;
    if (userDismissed.has(a.id)) return false;

    if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
    if (a.ends_at && new Date(a.ends_at).getTime() < now) return false;
    if (a.endDate && new Date(a.endDate).getTime() < now) return false;

    // Audience filtering: Everyone, Signed-in users, Server owners, Admins
    if (a.audience === 'Signed-in users' && !userId) return false;
    if (a.audience === 'Server owners' && !isServerOwner) return false;
    if (a.audience === 'Admins' && !isAdmin) return false;

    return true;
  });

  // Ordering by severity (Warning > Important > Info) then newest
  const severityRank = { Warning: 3, Important: 2, Info: 1 };
  live.sort((a, b) => {
    const diff = (severityRank[b.severity] || 1) - (severityRank[a.severity] || 1);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Max 5 visible
  return live.slice(0, 5).map(a => ({
    ...a,
    text: a.text || a.message || a.title,
    link: a.link || a.buttonUrl || null,
    endDate: a.endDate || a.ends_at || null
  }));
}

export function createAnnouncement({
  title,
  message,
  severity = 'Info',
  audience = 'Everyone',
  buttonLabel = null,
  buttonUrl = null,
  starts_at = null,
  ends_at = null,
  dismissible = true,
  actor
}) {
  const all = loadAnnouncements();
  const id = `ann_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const cleanSeverity = ['Warning', 'Important', 'Info'].includes(severity) ? severity : 'Info';
  const cleanAudience = ['Everyone', 'Signed-in users', 'Server owners', 'Admins'].includes(audience) ? audience : 'Everyone';

  const newAnn = {
    id,
    title: sanitizeMarkdown(title || '').trim(),
    message: sanitizeMarkdown(message || '').trim(),
    severity: cleanSeverity,
    audience: cleanAudience,
    buttonLabel: buttonLabel ? String(buttonLabel).trim() : null,
    buttonUrl: buttonUrl ? String(buttonUrl).trim() : null,
    starts_at: starts_at ? new Date(starts_at).toISOString() : null,
    ends_at: ends_at ? new Date(ends_at).toISOString() : null,
    dismissible: Boolean(dismissible),
    status: 'live',
    created_at: new Date().toISOString(),
    created_by: actor?.username || 'Admin'
  };

  all.unshift(newAnn);
  saveAnnouncements(all);

  if (actor) {
    recordAuditAction({
      actor,
      action: 'announcement_create',
      target: newAnn.id,
      targetType: 'announcement',
      reason: newAnn.title,
      before: null,
      after: `${newAnn.severity} for ${newAnn.audience}`
    });
  }

  return newAnn;
}

export function updateAnnouncement(id, patch, actor) {
  const all = loadAnnouncements();
  const ann = all.find((a) => a.id === id);
  if (!ann) throw new Error('Announcement not found.');

  if (patch.title !== undefined) ann.title = sanitizeMarkdown(patch.title).trim();
  if (patch.message !== undefined) ann.message = sanitizeMarkdown(patch.message).trim();
  if (patch.severity !== undefined && ['Warning', 'Important', 'Info'].includes(patch.severity)) ann.severity = patch.severity;
  if (patch.audience !== undefined && ['Everyone', 'Signed-in users', 'Server owners', 'Admins'].includes(patch.audience)) ann.audience = patch.audience;
  if (patch.buttonLabel !== undefined) ann.buttonLabel = patch.buttonLabel ? String(patch.buttonLabel).trim() : null;
  if (patch.buttonUrl !== undefined) ann.buttonUrl = patch.buttonUrl ? String(patch.buttonUrl).trim() : null;
  if (patch.starts_at !== undefined) ann.starts_at = patch.starts_at ? new Date(patch.starts_at).toISOString() : null;
  if (patch.ends_at !== undefined) ann.ends_at = patch.ends_at ? new Date(patch.ends_at).toISOString() : null;
  if (patch.dismissible !== undefined) ann.dismissible = Boolean(patch.dismissible);
  if (patch.status !== undefined) ann.status = patch.status;

  saveAnnouncements(all);

  if (actor) {
    recordAuditAction({
      actor,
      action: 'announcement_update',
      target: ann.id,
      targetType: 'announcement',
      reason: ann.title,
      before: 'modified',
      after: ann.status
    });
  }
  return ann;
}

export function deleteAnnouncement(id, actor) {
  let all = loadAnnouncements();
  const ann = all.find((a) => a.id === id);
  if (!ann) throw new Error('Announcement not found.');

  all = all.filter((a) => a.id !== id);
  saveAnnouncements(all);

  if (actor) {
    recordAuditAction({
      actor,
      action: 'announcement_delete',
      target: id,
      targetType: 'announcement',
      reason: ann.title,
      before: ann.title,
      after: null
    });
  }
  return true;
}

