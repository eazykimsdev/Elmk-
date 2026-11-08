import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordLedgerTransaction } from './ledgerManager.js';
import { getPromotedServers } from './directoryManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECRUITS_FILE = path.join(__dirname, 'data', 'recruits.json');

function ensureRecruitsFile() {
  const dir = path.dirname(RECRUITS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(RECRUITS_FILE)) {
    const initial = {
      links: [],
      recruits: [],
      requests: [],
      activity: [],
      settings: {},
    };
    fs.writeFileSync(RECRUITS_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

export function loadRecruitData() {
  ensureRecruitsFile();
  try {
    const raw = fs.readFileSync(RECRUITS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      links: Array.isArray(parsed?.links) ? parsed.links : [],
      recruits: Array.isArray(parsed?.recruits) ? parsed.recruits : [],
      requests: Array.isArray(parsed?.requests) ? parsed.requests : [],
      activity: Array.isArray(parsed?.activity) ? parsed.activity : [],
      settings: typeof parsed?.settings === 'object' && parsed?.settings !== null ? parsed.settings : {},
    };
  } catch (err) {
    console.error('[RECRUITS] Error loading recruits data:', err);
    return { links: [], recruits: [], requests: [], activity: [], settings: {} };
  }
}

export function saveRecruitData(data) {
  ensureRecruitsFile();
  try {
    fs.writeFileSync(RECRUITS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[RECRUITS] Error saving recruits data:', err);
  }
}

/** Get settings for a guild with defaults */
export function getRecruitSettings(guildId) {
  const data = loadRecruitData();
  const existing = data.settings[String(guildId)];

  return {
    guild_id: String(guildId),
    enabled: existing?.enabled !== undefined ? Boolean(existing.enabled) : true,
    representatives_wanted: Math.min(50, Math.max(0, Number(existing?.representatives_wanted !== undefined ? existing.representatives_wanted : 10))),
    credits_per_recruit: Math.min(10, Math.max(0, Number(existing?.credits_per_recruit !== undefined ? existing.credits_per_recruit : 2))),
    approve_manually: Boolean(existing?.approve_manually),
    retention_hours: [72, 168, 336].includes(Number(existing?.retention_hours))
      ? Number(existing.retention_hours)
      : 72,
    log_channel_id: existing?.log_channel_id || null,
    rep_role_id: existing?.rep_role_id || null,
    recruit_role_id: existing?.recruit_role_id || null,
    dm_owner: existing?.dm_owner !== undefined ? Boolean(existing.dm_owner) : true,
    auto_reward: existing?.auto_reward !== undefined ? Boolean(existing.auto_reward) : true,
    reward_roles: Array.isArray(existing?.reward_roles) ? existing.reward_roles : [],
  };
}

/** Update settings for a guild */
export function updateRecruitSettings(guildId, patch = {}) {
  const data = loadRecruitData();
  const current = getRecruitSettings(guildId);

  const updated = {
    ...current,
    ...patch,
    guild_id: String(guildId),
  };

  if (patch.representatives_wanted !== undefined) {
    updated.representatives_wanted = Math.min(50, Math.max(0, Number(patch.representatives_wanted)));
  }
  if (patch.credits_per_recruit !== undefined) {
    updated.credits_per_recruit = Math.min(10, Math.max(0, Number(patch.credits_per_recruit)));
  }
  if (patch.approve_manually !== undefined) {
    updated.approve_manually = Boolean(patch.approve_manually);
  }
  if (patch.retention_hours !== undefined) {
    const h = Number(patch.retention_hours);
    updated.retention_hours = [72, 168, 336].includes(h) ? h : 72;
  }
  if (patch.dm_owner !== undefined) {
    updated.dm_owner = Boolean(patch.dm_owner);
  }
  if (patch.log_channel_id !== undefined) {
    updated.log_channel_id = patch.log_channel_id ? String(patch.log_channel_id).trim() : null;
  }
  if (patch.rep_role_id !== undefined) {
    updated.rep_role_id = patch.rep_role_id ? String(patch.rep_role_id).trim() : null;
  }
  if (patch.recruit_role_id !== undefined) {
    updated.recruit_role_id = patch.recruit_role_id ? String(patch.recruit_role_id).trim() : null;
  }

  data.settings[String(guildId)] = updated;
  saveRecruitData(data);
  return updated;
}

/** Get or create personal tracked recruit link for a user */
export function getOrCreateRecruitLink(guildId, userId, userProfile = {}) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const uid = String(userId);

  // Check if server has a configured inviteUrl
  let baseInvite = 'https://discord.gg/central';
  try {
    const promoted = getPromotedServers().find((s) => s.id === gid);
    if (promoted?.inviteUrl) {
      baseInvite = promoted.inviteUrl;
    }
  } catch {}

  let link = data.links.find((l) => l.guild_id === gid && l.recruiter_user_id === uid && l.active !== false);

  if (!link) {
    // Generate clean unique invite code
    const randomHex = Math.random().toString(36).substring(2, 8);
    const code = randomHex;
    const cleanUrl = baseInvite.includes('discord.gg/')
      ? `${baseInvite}?rep=${code}`
      : `https://discord.gg/${code}`;

    link = {
      id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      guild_id: gid,
      recruiter_user_id: uid,
      recruiter_name: userProfile.name || userProfile.globalName || userProfile.username || 'Community Member',
      recruiter_avatar: userProfile.avatar || null,
      discord_invite_code: code,
      discord_invite_url: cleanUrl,
      created_at: Date.now(),
      uses: 0,
      active: true,
    };
    data.links.push(link);
    saveRecruitData(data);
  } else if (userProfile.name || userProfile.username) {
    link.recruiter_name = userProfile.name || userProfile.globalName || userProfile.username || link.recruiter_name;
    if (userProfile.avatar) link.recruiter_avatar = userProfile.avatar;
    saveRecruitData(data);
  }

  return link;
}

/** Step down as representative */
export function stepDownRepresentative(guildId, userId) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const uid = String(userId);

  const link = data.links.find((l) => l.guild_id === gid && l.recruiter_user_id === uid && l.active !== false);
  if (link) {
    link.active = false;
    data.activity.push({
      id: `act_${Date.now()}`,
      guild_id: gid,
      type: 'stepped_down',
      user_id: uid,
      user_name: link.recruiter_name,
      timestamp: Date.now(),
    });
    saveRecruitData(data);
    return true;
  }
  return false;
}

/** Summary telemetry for Recruit hub */
export function getRecruitsSummary(guildId) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const guildRecruits = data.recruits.filter((r) => r.guild_id === gid);

  const total = guildRecruits.length;
  const verified = guildRecruits.filter((r) => r.status === 'verified').length;
  const pending = guildRecruits.filter((r) => r.status === 'pending').length;
  const leftEarly = guildRecruits.filter((r) => r.status === 'left_early').length;

  const totalFinished = verified + leftEarly;
  const retentionRate = totalFinished > 0 ? Math.round((verified / totalFinished) * 100) : total > 0 ? 100 : 0;

  const creditsAwarded = guildRecruits
    .filter((r) => r.status === 'verified')
    .reduce((sum, r) => sum + (Number(r.credits_awarded) || 0), 0);

  // Active representative slots
  const activeLinks = data.links.filter((l) => l.guild_id === gid && l.active !== false);
  const settings = getRecruitSettings(gid);

  // Recruits this week
  const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recruitsThisWeek = guildRecruits.filter((r) => r.joined_at >= oneWeekAgo).length;

  let serverOwner = null;
  try {
    const servers = getPromotedServers();
    const srv = servers.find((s) => String(s.id) === gid);
    if (srv && srv.ownerId) {
      serverOwner = {
        userId: String(srv.ownerId),
        userName: srv.owner_display_name || srv.ownerUsername || 'Server Owner',
        avatarHash: srv.owner_avatar_hash || srv.ownerAvatar || null,
        avatarUrl: srv.ownerAvatar || null,
      };
    }
  } catch {}

  return {
    totalRecruits: total,
    verifiedRecruits: verified,
    pendingRecruits: pending,
    leftEarlyRecruits: leftEarly,
    retentionRate,
    creditsAwarded,
    slotsFilled: activeLinks.length,
    slotsWanted: settings.representatives_wanted,
    recruitsThisWeek,
    serverOwner,
    representatives: activeLinks.map((l) => ({
      userId: l.user_id,
      userName: l.user_name || 'Representative',
      avatarHash: l.avatar_hash || null,
      avatarUrl: l.avatar_url || null,
    })),
  };
}

/** 30-day verified recruits telemetry for area chart */
export function get30DayRecruitsTrend(guildId) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const guildRecruits = data.recruits.filter((r) => r.guild_id === gid && r.status === 'verified');

  const now = new Date();
  const days = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 24 * 3600 * 1000;

    const count = guildRecruits.filter((r) => (r.verified_at || r.joined_at) >= dayStart && (r.verified_at || r.joined_at) < dayEnd).length;
    days.push({
      date: dayStr,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      verified: count,
    });
  }

  return days;
}

/** Paginated individual recruit records */
export function getRecruitsList(guildId, options = {}) {
  const { page = 1, pageSize = 20, status = 'all', search = '', recruiterId = null } = options;
  const data = loadRecruitData();
  const gid = String(guildId);

  let filtered = data.recruits.filter((r) => r.guild_id === gid);

  if (status && status !== 'all') {
    filtered = filtered.filter((r) => r.status === status);
  }

  if (recruiterId) {
    filtered = filtered.filter((r) => r.recruiter_user_id === String(recruiterId));
  }

  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (r) =>
        r.joined_user_name.toLowerCase().includes(q) ||
        r.recruiter_name.toLowerCase().includes(q) ||
        r.joined_user_id.includes(q)
    );
  }

  filtered.sort((a, b) => b.joined_at - a.joined_at);

  const total = filtered.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, parseInt(pageSize, 10) || 20);
  const startIndex = (pageNum - 1) * size;
  const items = filtered.slice(startIndex, startIndex + size).map((r) => {
    const remainingMs = Math.max(0, (r.retention_deadline || (r.joined_at + 72 * 3600000)) - Date.now());
    const remainingHours = Math.ceil(remainingMs / 3600000);
    return {
      ...r,
      remainingHours,
    };
  });

  return {
    items,
    total,
    page: pageNum,
    pageSize: size,
    totalPages: Math.max(1, Math.ceil(total / size)),
  };
}

/** Recruiters Leaderboard */
export function getRecruitLeaderboard(guildId, options = {}) {
  const { page = 1, pageSize = 12 } = options;
  const data = loadRecruitData();
  const gid = String(guildId);

  const recruiterMap = new Map();

  for (const r of data.recruits.filter((r) => r.guild_id === gid)) {
    const uid = r.recruiter_user_id;
    if (!recruiterMap.has(uid)) {
      recruiterMap.set(uid, {
        recruiter_id: uid,
        recruiter_name: r.recruiter_name || 'Community Member',
        recruiter_avatar: null,
        totalJoined: 0,
        verifiedCount: 0,
        pendingCount: 0,
        leftEarlyCount: 0,
        creditsEarned: 0,
      });
    }

    const item = recruiterMap.get(uid);
    item.totalJoined += 1;
    if (r.status === 'verified') {
      item.verifiedCount += 1;
      item.creditsEarned += Number(r.credits_awarded || 0);
    } else if (r.status === 'pending') {
      item.pendingCount += 1;
    } else if (r.status === 'left_early') {
      item.leftEarlyCount += 1;
    }
  }

  for (const l of data.links.filter((l) => l.guild_id === gid && l.active !== false)) {
    if (!recruiterMap.has(l.recruiter_user_id)) {
      recruiterMap.set(l.recruiter_user_id, {
        recruiter_id: l.recruiter_user_id,
        recruiter_name: l.recruiter_name || 'Community Member',
        recruiter_avatar: l.recruiter_avatar || null,
        totalJoined: 0,
        verifiedCount: 0,
        pendingCount: 0,
        leftEarlyCount: 0,
        creditsEarned: 0,
      });
    } else if (l.recruiter_avatar) {
      recruiterMap.get(l.recruiter_user_id).recruiter_avatar = l.recruiter_avatar;
    }
  }

  const allRecruiters = Array.from(recruiterMap.values());

  for (const rec of allRecruiters) {
    const finished = rec.verifiedCount + rec.leftEarlyCount;
    rec.retentionRate = finished > 0 ? Math.round((rec.verifiedCount / finished) * 100) : rec.totalJoined > 0 ? 100 : 0;
  }

  allRecruiters.sort((a, b) => {
    if (b.verifiedCount !== a.verifiedCount) return b.verifiedCount - a.verifiedCount;
    return b.totalJoined - a.totalJoined;
  });

  allRecruiters.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  const total = allRecruiters.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, parseInt(pageSize, 10) || 12);
  const startIndex = (pageNum - 1) * size;
  const items = allRecruiters.slice(startIndex, startIndex + size);

  return {
    items,
    total,
    page: pageNum,
    pageSize: size,
    totalPages: Math.max(1, Math.ceil(total / size)),
  };
}

/** User personal recruit stats */
export function getUserRecruitStats(guildId, userId, userProfile = {}) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const uid = String(userId);
  const link = getOrCreateRecruitLink(gid, uid, userProfile);

  const userRecruits = data.recruits.filter((r) => r.guild_id === gid && r.recruiter_user_id === uid);
  const total = userRecruits.length;
  const verified = userRecruits.filter((r) => r.status === 'verified').length;
  const pending = userRecruits.filter((r) => r.status === 'pending').length;
  const leftEarly = userRecruits.filter((r) => r.status === 'left_early').length;
  const creditsEarned = userRecruits
    .filter((r) => r.status === 'verified')
    .reduce((sum, r) => sum + (Number(r.credits_awarded) || 0), 0);

  const finished = verified + leftEarly;
  const retentionRate = finished > 0 ? Math.round((verified / finished) * 100) : total > 0 ? 100 : 0;

  return {
    inviteCode: link.discord_invite_code,
    inviteUrl: link.discord_invite_url,
    totalJoined: total,
    verifiedCount: verified,
    pendingCount: pending,
    leftEarlyCount: leftEarly,
    retentionRate,
    creditsEarned,
  };
}

/** Check retention background worker (runs periodically) */
export function checkRecruitRetention() {
  const data = loadRecruitData();
  const now = Date.now();
  let modified = false;

  for (const recruit of data.recruits) {
    if (recruit.status === 'pending' && recruit.retention_deadline <= now) {
      recruit.status = 'verified';
      recruit.verified_at = now;
      modified = true;

      const settings = getRecruitSettings(recruit.guild_id);
      const credits = settings.credits_per_recruit || 2;
      recruit.credits_awarded = credits;

      try {
        recordLedgerTransaction({
          userId: recruit.recruiter_user_id,
          type: 'earned',
          amount: credits,
          reason: 'recruit_reward',
          description: `Recruit verified: ${recruit.joined_user_name}`,
          guildId: recruit.guild_id,
          triggeredBy: 'Recruit Hub',
        });
      } catch (err) {
        console.error('[RECRUITS] Failed to record ledger for verified recruit:', err);
      }
    }
  }

  if (modified) {
    saveRecruitData(data);
  }
}

/** Record new joined member via invite code */
export function recordInviteJoin(guildId, member, inviteCode) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const link = data.links.find((l) => l.guild_id === gid && l.discord_invite_code.toLowerCase() === String(inviteCode).toLowerCase());

  if (!link || link.active === false) return null;

  const settings = getRecruitSettings(gid);
  if (!settings.enabled) return null;

  const joinedUserId = String(member.id || member.userId);
  const existing = data.recruits.find((r) => r.guild_id === gid && r.joined_user_id === joinedUserId);
  if (existing) return existing;

  const now = Date.now();
  const retentionHours = settings.retention_hours || 72;
  const deadline = now + retentionHours * 3600000;

  const newRecruit = {
    id: `rec_${now}_${Math.random().toString(36).substring(2, 6)}`,
    guild_id: gid,
    recruiter_user_id: link.recruiter_user_id,
    recruiter_name: link.recruiter_name,
    joined_user_id: joinedUserId,
    joined_user_name: member.displayName || member.username || member.name || 'Member',
    joined_user_avatar: member.avatar || null,
    joined_at: now,
    retention_target_hours: retentionHours,
    retention_deadline: deadline,
    status: 'pending',
    verified_at: null,
    credits_awarded: 0,
  };

  link.uses = (link.uses || 0) + 1;
  data.recruits.push(newRecruit);

  data.activity.push({
    id: `act_${now}`,
    guild_id: gid,
    type: 'recruit_joined',
    user_name: newRecruit.joined_user_name,
    recruiter_name: link.recruiter_name,
    timestamp: now,
  });

  saveRecruitData(data);
  return newRecruit;
}

/** Record member leaving early */
export function recordMemberLeft(guildId, userId) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const uid = String(userId);

  const pending = data.recruits.find((r) => r.guild_id === gid && r.joined_user_id === uid && r.status === 'pending');
  if (pending) {
    pending.status = 'left_early';
    data.activity.push({
      id: `act_${Date.now()}`,
      guild_id: gid,
      type: 'recruit_left',
      user_name: pending.joined_user_name,
      recruiter_name: pending.recruiter_name,
      timestamp: Date.now(),
    });
    saveRecruitData(data);
    return pending;
  }
  return null;
}

// ── OWNER TOOLS (Section 7.5) ────────────────────────────────────────────────

export function blockRecruiter(guildId, userId, reason, actorId) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const uid = String(userId);

  // Protect owner from being blocked
  try {
    const servers = getPromotedServers();
    const server = servers.find((s) => String(s.id) === gid);
    if (server && (String(server.ownerId) === uid || String(server.owner_discord_id) === uid)) {
      return { ok: false, error: 'The server owner cannot be blocked.' };
    }
  } catch {}

  data.blocked_recruiters = data.blocked_recruiters || [];
  if (!data.blocked_recruiters.includes(uid)) {
    data.blocked_recruiters.push(uid);
  }

  // Deactivate any links
  const links = data.links.filter((l) => l.guild_id === gid && l.recruiter_user_id === uid);
  links.forEach((l) => { l.active = false; });

  data.activity = data.activity || [];
  data.activity.push({
    id: `act_${Date.now()}`,
    guild_id: gid,
    type: 'recruiter_blocked',
    user_id: uid,
    reason: reason || 'Blocked from recruiting by owner',
    actor_id: actorId,
    timestamp: Date.now(),
  });

  saveRecruitData(data);
  return { ok: true };
}

export function reverseRecruit(guildId, recruitId, reason, actorId) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const r = data.recruits.find((x) => x.id === recruitId && x.guild_id === gid);
  if (!r) throw new Error('Recruit record not found');

  const prevStatus = r.status;
  r.status = 'left_early'; // reverse
  r.reversed_at = Date.now();
  r.reversed_by = actorId;
  r.reverse_reason = reason;

  // Deduct credits via ledger if previously verified
  if (prevStatus === 'verified' && r.credits_awarded > 0) {
    try {
      recordLedgerTransaction({
        userId: r.recruiter_user_id,
        serverId: gid,
        amount: r.credits_awarded,
        type: 'spent',
        reason: 'Recruit reversed by server owner',
        description: `Recruit reversal for user ${r.joined_user_name || r.joined_user_id}`,
        status: 'posted',
      });
    } catch (err) {
      console.warn('[REVERSE RECRUIT] Ledger error:', err);
    }
  }

  data.activity = data.activity || [];
  data.activity.push({
    id: `act_${Date.now()}`,
    guild_id: gid,
    type: 'recruit_reversed',
    recruit_id: recruitId,
    user_name: r.joined_user_name,
    recruiter_name: r.recruiter_name,
    reason: reason || 'Recruit reversed by owner',
    actor_id: actorId,
    timestamp: Date.now(),
  });

  saveRecruitData(data);
  return { ok: true };
}

export function removeRepresentative(guildId, userId, reason, actorId) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const uid = String(userId);

  // Protect owner from being removed
  try {
    const servers = getPromotedServers();
    const server = servers.find((s) => String(s.id) === gid);
    if (server && (String(server.ownerId) === uid || String(server.owner_discord_id) === uid)) {
      return { ok: false, error: 'The server owner cannot be removed as a representative.' };
    }
  } catch {}

  const links = data.links.filter((l) => l.guild_id === gid && l.recruiter_user_id === uid);
  links.forEach((l) => { l.active = false; });

  data.activity = data.activity || [];
  data.activity.push({
    id: `act_${Date.now()}`,
    guild_id: gid,
    type: 'representative_removed',
    user_id: uid,
    reason: reason || 'Representative removed by owner',
    actor_id: actorId,
    timestamp: Date.now(),
  });

  saveRecruitData(data);
  return { ok: true };
}

export function revokeAllRepresentativeInvites(guildId, actorId) {
  const data = loadRecruitData();
  const gid = String(guildId);

  const links = data.links.filter((l) => l.guild_id === gid);
  links.forEach((l) => { l.active = false; });

  data.activity = data.activity || [];
  data.activity.push({
    id: `act_${Date.now()}`,
    guild_id: gid,
    type: 'all_invites_revoked',
    count: links.length,
    actor_id: actorId,
    timestamp: Date.now(),
  });

  saveRecruitData(data);
  return { ok: true, revokedCount: links.length };
}

export function getOwnerAuditLog(guildId) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const logs = (data.activity || [])
    .filter((a) => a.guild_id === gid)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return logs;
}

export function exportRecruitsToCsv(guildId) {
  const data = loadRecruitData();
  const gid = String(guildId);
  const recruits = (data.recruits || []).filter((r) => r.guild_id === gid);

  const rows = [
    ['Recruit ID', 'Joined User', 'Discord ID', 'Recruiter', 'Joined At', 'Status', 'Credits Awarded'].join(','),
  ];

  for (const r of recruits) {
    const joinedAt = r.joined_at ? new Date(r.joined_at).toISOString() : 'N/A';
    rows.push([
      `"${r.id}"`,
      `"${(r.joined_user_name || '').replace(/"/g, '""')}"`,
      `"${r.joined_user_id || ''}"`,
      `"${(r.recruiter_name || '').replace(/"/g, '""')}"`,
      `"${joinedAt}"`,
      `"${r.status || 'pending'}"`,
      `"${r.credits_awarded || 0}"`,
    ].join(','));
  }

  return rows.join('\n');
}

// Background check every hour
setInterval(() => {
  try {
    checkRecruitRetention();
  } catch {}
}, 60 * 60 * 1000);
