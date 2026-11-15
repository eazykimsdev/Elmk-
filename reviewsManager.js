import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'node:crypto';
import { getPromotedServers, getJoinRecord } from './directoryManager.js';
import { appendServerActivity } from './ledgerManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const FLAGS_FILE = path.join(DATA_DIR, 'flags.json');

export const REVIEW_MIN_ACCOUNT_DAYS = Number(process.env.REVIEW_MIN_ACCOUNT_DAYS) || 2;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function computeAccountCreatedAt(discordId) {
  try {
    const snowflake = BigInt(discordId);
    const ms = Number((snowflake >> 22n) + 1420070400000n);
    return new Date(ms);
  } catch {
    return new Date(0);
  }
}

export function computeAccountAgeDays(discordId) {
  const created = computeAccountCreatedAt(discordId).getTime();
  const diffMs = Date.now() - created;
  return Math.max(0, diffMs / (24 * 60 * 60 * 1000));
}

export function loadReviewsData() {
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8') || '[]');
    }
  } catch (err) {
    console.warn('[REVIEWS] Failed to read reviews.json:', err.message);
  }
  return [];
}

function loadReviews() {
  return loadReviewsData();
}

export function saveReviewsData(reviews) {
  try {
    const tmp = `${REVIEWS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(reviews, null, 2), 'utf8');
    fs.renameSync(tmp, REVIEWS_FILE);
    return true;
  } catch (err) {
    console.error('[REVIEWS] Failed to save reviews.json:', err.message);
    return false;
  }
}

function saveReviews(reviews) {
  return saveReviewsData(reviews);
}

function loadReports() {
  try {
    if (fs.existsSync(REPORTS_FILE)) {
      return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8') || '[]');
    }
  } catch {
    return [];
  }
  return [];
}

function saveReports(reports) {
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function loadFlags() {
  try {
    if (fs.existsSync(FLAGS_FILE)) {
      return JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf8') || '[]');
    }
  } catch {
    return [];
  }
  return [];
}

function saveFlags(flags) {
  try {
    fs.writeFileSync(FLAGS_FILE, JSON.stringify(flags, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

// Basic profanity check
const BLOCKED_WORDS = ['nigger', 'faggot', 'retard', 'kike', 'chink', 'cp', 'childporn'];
function containsProfanity(text) {
  const lower = (text || '').toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

function sanitizeText(text) {
  return (text || '')
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .slice(0, 300);
}

function getBannedUserIds() {
  try {
    const bannedFile = path.join(DATA_DIR, 'banned_users.json');
    if (fs.existsSync(bannedFile)) {
      const list = JSON.parse(fs.readFileSync(bannedFile, 'utf8'));
      const now = Date.now();
      return new Set(
        list
          .filter(b => !b.expiresAt || new Date(b.expiresAt).getTime() > now)
          .map(b => String(b.userId))
      );
    }
  } catch {}
  return new Set();
}

function buildKnownUserDirectoryMap() {
  const map = new Map();
  try {
    const servers = getPromotedServers(true);
    for (const s of servers) {
      if (s.ownerId) {
        const uid = String(s.ownerId);
        const displayName = s.owner_display_name || s.ownerUsername || s.ownerName || null;
        const avatarHash = s.owner_avatar_hash || null;
        let avatarUrl = s.ownerAvatar && !String(s.ownerAvatar).includes('embed/avatars') ? s.ownerAvatar : null;
        if (!avatarUrl && avatarHash) {
          avatarUrl = `https://cdn.discordapp.com/avatars/${uid}/${avatarHash}.${String(avatarHash).startsWith('a_') ? 'gif' : 'png'}?size=128`;
        }
        if (displayName || avatarUrl || avatarHash) {
          map.set(uid, {
            displayName: displayName || map.get(uid)?.displayName || null,
            avatarHash: avatarHash || map.get(uid)?.avatarHash || null,
            avatarUrl: avatarUrl || map.get(uid)?.avatarUrl || null
          });
        }
      }
    }
  } catch {}

  try {
    const sessionsDir = path.join(DATA_DIR, 'sessions');
    if (fs.existsSync(sessionsDir)) {
      for (const file of fs.readdirSync(sessionsDir)) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'));
          const u = raw?.passport?.user || raw?.user;
          if (u && u.id) {
            const uid = String(u.id);
            const displayName = u.globalName || u.displayName || u.username || null;
            const avatarHash = u.avatar || u.avatar_hash || u.avatarHash || null;
            let avatarUrl = (u.avatarUrl || u.user_avatar || null);
            if (avatarUrl && String(avatarUrl).includes('embed/avatars')) avatarUrl = null;
            if (!avatarUrl && avatarHash && !String(avatarHash).startsWith('http')) {
              avatarUrl = `https://cdn.discordapp.com/avatars/${uid}/${avatarHash}.${String(avatarHash).startsWith('a_') ? 'gif' : 'png'}?size=128`;
            }
            map.set(uid, {
              displayName: displayName || map.get(uid)?.displayName || null,
              avatarHash: avatarHash || map.get(uid)?.avatarHash || null,
              avatarUrl: avatarUrl || map.get(uid)?.avatarUrl || null
            });
          }
        } catch {}
      }
    }
  } catch {}

  return map;
}

export function normalizeAndBackfillReview(r, knownUsers = null) {
  if (!r || typeof r !== 'object') return r;
  const uid = String(r.user_id || r.author_id || '');
  const lookup = knownUsers ? knownUsers.get(uid) : null;

  const rawName =
    r.display_name ||
    r.user_name ||
    r.author_name ||
    r.username ||
    lookup?.displayName ||
    'Community Member';
  const cleanName =
    rawName === 'Community Member' && lookup?.displayName ? lookup.displayName : rawName;

  let avatarHash = r.user_avatar_hash || r.avatar_hash || lookup?.avatarHash || null;
  if (avatarHash && String(avatarHash).includes('embed/avatars')) {
    avatarHash = null;
  }

  let avatarUrl = r.user_avatar || r.avatar_url || lookup?.avatarUrl || null;
  if (avatarUrl && String(avatarUrl).includes('embed/avatars')) {
    avatarUrl = null;
  }
  if (!avatarUrl && uid && avatarHash && !String(avatarHash).startsWith('http')) {
    const ext = String(avatarHash).startsWith('a_') ? 'gif' : 'png';
    avatarUrl = `https://cdn.discordapp.com/avatars/${uid}/${avatarHash}.${ext}?size=128`;
  }

  return {
    ...r,
    user_id: uid,
    user_name: cleanName,
    author_name: cleanName,
    display_name: cleanName,
    user_avatar: avatarUrl,
    avatar_url: avatarUrl,
    user_avatar_hash: avatarHash,
    avatar_hash: avatarHash
  };
}

export function backfillOldReviewsOnDisk() {
  try {
    const reviews = loadReviews();
    if (!Array.isArray(reviews) || reviews.length === 0) return [];
    const knownUsers = buildKnownUserDirectoryMap();
    let changed = false;
    const updated = reviews.map((r) => {
      const norm = normalizeAndBackfillReview(r, knownUsers);
      if (
        norm.author_name !== r.author_name ||
        norm.user_name !== r.user_name ||
        norm.avatar_url !== r.avatar_url ||
        norm.user_avatar !== r.user_avatar ||
        norm.avatar_hash !== r.avatar_hash ||
        norm.user_avatar_hash !== r.user_avatar_hash
      ) {
        changed = true;
      }
      return norm;
    });
    if (changed) {
      saveReviews(updated);
    }
    return updated;
  } catch {
    return loadReviews();
  }
}

/**
 * Get reviews for a specific server, with computed rating metrics & pagination
 */
export function getServerReviews(serverId, { page = 1, pageSize = 5, sort = 'newest' } = {}) {
  const sid = String(serverId);
  const bannedIds = getBannedUserIds();
  const knownUsers = buildKnownUserDirectoryMap();
  const allReviews = backfillOldReviewsOnDisk()
    .filter((r) => String(r.server_id) === sid && !r.deleted_at && !bannedIds.has(String(r.user_id)))
    .map((r) => normalizeAndBackfillReview(r, knownUsers));

  const total = allReviews.length;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;

  for (const r of allReviews) {
    const star = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5)));
    distribution[star] = (distribution[star] || 0) + 1;
    sum += star;
  }

  const average = total > 0 ? parseFloat((sum / total).toFixed(1)) : 0;

  const sorted = [...allReviews].sort((a, b) => {
    if (sort === 'highest') {
      const diff = (Number(b.rating) || 5) - (Number(a.rating) || 5);
      if (diff !== 0) return diff;
    } else if (sort === 'lowest') {
      const diff = (Number(a.rating) || 5) - (Number(b.rating) || 5);
      if (diff !== 0) return diff;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePageSize = Math.max(1, Math.min(50, parseInt(pageSize, 10) || 5));
  const startIndex = (safePage - 1) * safePageSize;
  const paginated = sorted.slice(startIndex, startIndex + safePageSize);

  return {
    reviews: paginated,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize) || 1,
    summary: {
      average,
      total,
      distribution,
    },
  };
}

/**
 * Single server-side eligibility decision function used by the API and UI.
 * Rules:
 *  1. Must be signed in.
 *  2. Cannot review own server (or team member of server).
 *  3. Account must be at least REVIEW_MIN_ACCOUNT_DAYS old.
 *  4. Single review per user per server.
 */
export function getReviewEligibility(userId, serverId) {
  if (!userId) {
    return {
      status: 'not_signed_in',
      canReview: false,
      message: 'Sign in to leave a review'
    };
  }

  const sid = String(serverId);
  const uid = String(userId);
  const servers = getPromotedServers(true);
  const server = servers.find(s => String(s.id) === sid || String(s.guildId) === sid);

  // Check if owner or team member
  const isOwner = Boolean(server && server.ownerId && String(server.ownerId) === uid);
  const isTeamMember = Boolean(
    server &&
    Array.isArray(server.teamMembers) &&
    server.teamMembers.some((tm) => String(tm.id || tm) === uid)
  );

  if (isOwner || isTeamMember) {
    return {
      status: 'own_server',
      canReview: false,
      message: "You can't review your own server"
    };
  }

  // Check account age in days from Discord snowflake
  const ageDays = computeAccountAgeDays(uid);
  if (ageDays < REVIEW_MIN_ACCOUNT_DAYS) {
    const daysRemaining = Math.max(1, Math.ceil(REVIEW_MIN_ACCOUNT_DAYS - ageDays));
    return {
      status: 'account_too_new',
      canReview: false,
      minDays: REVIEW_MIN_ACCOUNT_DAYS,
      daysRemaining,
      message: `Your Discord account must be at least ${REVIEW_MIN_ACCOUNT_DAYS} days old to leave reviews. You can review in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`
    };
  }

  // Check if already reviewed
  const reviews = loadReviews();
  const existingReview = reviews.find(
    r => String(r.server_id) === sid && String(r.user_id) === uid && !r.deleted_at
  );
  if (existingReview) {
    return {
      status: 'already_reviewed',
      canReview: false,
      review: {
        id: existingReview.id,
        rating: existingReview.rating,
        text: existingReview.text,
        has_verified_join: Boolean(existingReview.has_verified_join),
        created_at: existingReview.created_at,
        updated_at: existingReview.updated_at
      },
      message: 'You have already reviewed this server'
    };
  }

  return {
    status: 'eligible',
    canReview: true,
    message: 'You are eligible to review this server'
  };
}

/**
 * Check and flag suspicious review patterns
 */
export function checkAndFlagSuspiciousReviews({ serverId, userId, rating, text }) {
  try {
    const flags = loadFlags();
    const reviews = loadReviews();
    const now = Date.now();
    const sid = String(serverId);
    const uid = String(userId);
    const servers = getPromotedServers(true);
    const currentServer = servers.find(s => String(s.id) === sid || String(s.guildId) === sid);

    // 1. Many 5 star reviews from accounts under 7 days old on one server
    const serverFiveStarsYoung = reviews.filter((r) => {
      if (String(r.server_id) !== sid || r.deleted_at || Number(r.rating) !== 5) return false;
      const age = computeAccountAgeDays(r.user_id);
      return age < 7;
    });
    if (serverFiveStarsYoung.length >= 3) {
      flags.push({
        id: `flag_rev_young_${Date.now()}`,
        type: 'SUSPICIOUS_REVIEWS_YOUNG_ACCOUNTS',
        serverId: sid,
        serverName: currentServer?.name || sid,
        reason: `${serverFiveStarsYoung.length} five-star reviews detected from accounts under 7 days old.`,
        status: 'Open',
        createdAt: new Date().toISOString()
      });
    }

    // 2. The same user reviewing many servers with identical text
    if (text && text.trim().length >= 10) {
      const trimmedText = text.trim();
      const identicalReviews = reviews.filter(
        (r) => String(r.user_id) === uid && !r.deleted_at && r.text && r.text.trim() === trimmedText
      );
      if (identicalReviews.length >= 3) {
        flags.push({
          id: `flag_rev_copy_${Date.now()}`,
          type: 'IDENTICAL_REVIEW_SPAM',
          userId: uid,
          reason: `User posted identical review text across ${identicalReviews.length} different servers.`,
          status: 'Open',
          createdAt: new Date().toISOString()
        });
      }
    }

    // 3. Reviews between owners of two servers that review each other (mutual review collusion)
    if (currentServer?.ownerId) {
      const ownerOfCurrent = String(currentServer.ownerId);
      // Check if the current reviewer owns another server
      const reviewerOwnedServers = servers.filter(s => String(s.ownerId) === uid);
      for (const revServer of reviewerOwnedServers) {
        // Has the owner of the current server reviewed the reviewer's server?
        const mutualReview = reviews.find(
          r => String(r.server_id) === String(revServer.id) && String(r.user_id) === ownerOfCurrent && !r.deleted_at
        );
        if (mutualReview) {
          flags.push({
            id: `flag_rev_mutual_${Date.now()}`,
            type: 'MUTUAL_OWNER_REVIEW_COLLUSION',
            serverId: sid,
            targetServerId: String(revServer.id),
            userId: uid,
            reason: `Mutual owner reviews detected between server ${sid} and ${revServer.id}.`,
            status: 'Open',
            createdAt: new Date().toISOString()
          });
          break;
        }
      }
    }

    saveFlags(flags);
  } catch (err) {
    console.warn('[REVIEWS] Suspicious pattern detection notice:', err.message);
  }
}

/**
 * Add or update a review
 */
export function upsertReview({
  serverId,
  user,
  rating,
  text,
  isOwner = false,
  isTeamMember = false,
}) {
  if (!user || !user.id) {
    throw new Error('You must be signed in to post a review.');
  }

  const sid = String(serverId);
  const uid = String(user.id);

  const reviews = loadReviews();
  const existingIdx = reviews.findIndex(
    (r) => String(r.server_id) === sid && String(r.user_id) === uid && !r.deleted_at
  );

  if (existingIdx === -1) {
    const eligibility = getReviewEligibility(uid, sid);
    if (!eligibility.canReview) {
      throw new Error(eligibility.message);
    }
  }

  const cleanRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
  const rawText = (text || '').trim();

  // Safeguard: text is optional, but if provided must be 10 to 300 characters
  let cleanText = '';
  if (rawText.length > 0) {
    if (rawText.length < 10) {
      throw new Error('Review text must be at least 10 characters long if provided.');
    }
    if (rawText.length > 300) {
      throw new Error('Review text cannot exceed 300 characters.');
    }
    cleanText = sanitizeText(rawText);
    if (containsProfanity(cleanText)) {
      throw new Error('Review contains inappropriate or disallowed language.');
    }
  }

  // Verified join badge determination: check if user joined through platform & completed stay
  const joinRecord = getJoinRecord(uid, sid);
  const hasVerifiedJoin = Boolean(joinRecord && (joinRecord.stayCompleted || (joinRecord.stayEndsAt && new Date(joinRecord.stayEndsAt).getTime() <= Date.now())));

  const now = new Date().toISOString();
  const resolvedDisplayName =
    user.globalName ||
    user.global_name ||
    user.displayName ||
    user.display_name ||
    user.username ||
    user.name ||
    'Community Member';

  const rawHash = user.avatar || user.avatar_hash || user.avatarHash || null;
  const cleanHash = rawHash && !String(rawHash).includes('embed/avatars') ? String(rawHash) : null;

  let resolvedAvatarUrl = null;
  if (cleanHash && /^https?:\/\//i.test(cleanHash)) {
    resolvedAvatarUrl = cleanHash;
  } else if (cleanHash) {
    const ext = cleanHash.startsWith('a_') ? 'gif' : 'png';
    resolvedAvatarUrl = `https://cdn.discordapp.com/avatars/${uid}/${cleanHash}.${ext}?size=128`;
  } else if (user.avatarUrl && !String(user.avatarUrl).includes('embed/avatars')) {
    resolvedAvatarUrl = String(user.avatarUrl);
  } else if (user.user_avatar && !String(user.user_avatar).includes('embed/avatars')) {
    resolvedAvatarUrl = String(user.user_avatar);
  }

  if (existingIdx >= 0) {
    reviews[existingIdx].rating = cleanRating;
    reviews[existingIdx].text = cleanText;
    reviews[existingIdx].updated_at = now;
    reviews[existingIdx].user_name = resolvedDisplayName;
    reviews[existingIdx].author_name = resolvedDisplayName;
    reviews[existingIdx].display_name = resolvedDisplayName;
    reviews[existingIdx].user_avatar = resolvedAvatarUrl;
    reviews[existingIdx].avatar_url = resolvedAvatarUrl;
    reviews[existingIdx].user_avatar_hash = cleanHash;
    reviews[existingIdx].avatar_hash = cleanHash;
    saveReviews(reviews);
    try {
      appendServerActivity(sid, {
        id: `review_${reviews[existingIdx].id}_${Date.now()}`,
        type: 'review',
        message: `${resolvedDisplayName} updated their ${cleanRating}-star review`,
        timestamp: now,
        actorId: uid
      });
    } catch {}
    checkAndFlagSuspiciousReviews({ serverId: sid, userId: uid, rating: cleanRating, text: cleanText });
    return { review: reviews[existingIdx], updated: true };
  } else {
    const newReview = {
      id: `rev_${Date.now()}_${randomBytes(4).toString('hex')}`,
      server_id: sid,
      user_id: uid,
      user_name: resolvedDisplayName,
      author_name: resolvedDisplayName,
      display_name: resolvedDisplayName,
      user_avatar: resolvedAvatarUrl,
      avatar_url: resolvedAvatarUrl,
      user_avatar_hash: cleanHash,
      avatar_hash: cleanHash,
      rating: cleanRating,
      text: cleanText,
      has_verified_join: hasVerifiedJoin,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    reviews.unshift(newReview);
    saveReviews(reviews);
    try {
      appendServerActivity(sid, {
        id: `review_${newReview.id}`,
        type: 'review',
        message: `${resolvedDisplayName} left a ${cleanRating}-star review`,
        timestamp: now,
        actorId: uid
      });
    } catch {}
    checkAndFlagSuspiciousReviews({ serverId: sid, userId: uid, rating: cleanRating, text: cleanText });
    return { review: newReview, created: true };
  }
}

/**
 * Delete a review (by author or admin)
 */
export function deleteReview(reviewId, userId, isAdmin = false) {
  const reviews = loadReviews();
  const idx = reviews.findIndex((r) => r.id === reviewId && !r.deleted_at);
  if (idx === -1) {
    throw new Error('Review not found.');
  }

  if (!isAdmin && String(reviews[idx].user_id) !== String(userId)) {
    throw new Error('You do not have permission to delete this review.');
  }

  reviews[idx].deleted_at = new Date().toISOString();
  saveReviews(reviews);
  return { success: true };
}

/**
 * Report a review to the admin moderation queue
 */
export function reportReview(reviewId, reporterUserId, reason = 'Inappropriate content') {
  const reviews = loadReviews();
  const rev = reviews.find((r) => r.id === reviewId && !r.deleted_at);
  if (!rev) {
    throw new Error('Review not found.');
  }

  const reports = loadReports();
  const alreadyReported = reports.some(
    (rep) => rep.review_id === reviewId && rep.reporter_user_id === reporterUserId
  );

  if (alreadyReported) {
    return { success: true, message: 'You have already reported this review.' };
  }

  reports.unshift({
    id: `rep_${Date.now()}`,
    review_id: reviewId,
    server_id: rev.server_id,
    author_id: rev.user_id,
    review_text: rev.text,
    reporter_user_id: reporterUserId,
    reason: String(reason).slice(0, 200),
    created_at: new Date().toISOString(),
    status: 'pending',
  });

  saveReports(reports);
  return { success: true, message: 'Review reported to moderators for inspection.' };
}
