import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPromotedServers, getJoinRecord } from './directoryManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadReviews() {
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8') || '[]');
    }
  } catch (err) {
    console.warn('[REVIEWS] Failed to read reviews.json:', err.message);
  }
  return [];
}

function saveReviews(reviews) {
  try {
    const tmp = `${REVIEWS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(reviews, null, 2), 'utf8');
    fs.renameSync(tmp, REVIEWS_FILE);
    return true;
  } catch (err) {
    console.error('[REVIEWS] Failed to save reviews.json:', err);
    return false;
  }
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

// Basic profanity check
const BLOCKED_WORDS = ['nigger', 'faggot', 'retard', 'kike', 'chink', 'cp', 'childporn'];
function containsProfanity(text) {
  const lower = (text || '').toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

function sanitizeText(text) {
  return (text || '')
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
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

/**
 * Get reviews for a specific server, with computed rating metrics & pagination
 */
export function getServerReviews(serverId, { page = 1, pageSize = 5, sort = 'newest' } = {}) {
  const sid = String(serverId);
  const bannedIds = getBannedUserIds();
  const allReviews = loadReviews().filter(
    (r) => String(r.server_id) === sid && !r.deleted_at && !bannedIds.has(String(r.user_id))
  );

  // Compute rating metrics
  const total = allReviews.length;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;

  for (const r of allReviews) {
    const star = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5)));
    distribution[star] = (distribution[star] || 0) + 1;
    sum += star;
  }

  const average = total > 0 ? parseFloat((sum / total).toFixed(1)) : 0;

  // Sort descending by created_at or by rating
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
 * Determine eligibility to leave a review for a specific server
 * Server-side unified function used by both API and UI
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

  if (server && server.ownerId && String(server.ownerId) === uid) {
    return {
      status: 'own_server',
      canReview: false,
      message: "You can't review your own server"
    };
  }

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
        created_at: existingReview.created_at,
        updated_at: existingReview.updated_at
      },
      message: 'You have already reviewed this server'
    };
  }

  const joinRecord = getJoinRecord(uid, sid);
  const minStayHours = Number(server?.retentionTargetHours) || 72;
  const minStayText = minStayHours >= 24 ? `${Math.round(minStayHours / 24)} days` : `${minStayHours} hours`;

  if (!joinRecord) {
    return {
      status: 'not_joined',
      canReview: false,
      minimumStay: minStayText,
      minimumStayHours: minStayHours,
      message: `Join this server and stay for ${minStayText} to leave a review`
    };
  }

  const now = Date.now();
  const stayEndsAt = new Date(joinRecord.stayEndsAt || joinRecord.joinedAt || now).getTime();
  if (!joinRecord.stayCompleted && stayEndsAt > now) {
    const msRemaining = stayEndsAt - now;
    const daysRemaining = Math.ceil(msRemaining / (24 * 3600 * 1000));
    const hoursRemaining = Math.ceil(msRemaining / (3600 * 1000));
    const timeText = daysRemaining > 1 ? `${daysRemaining} days` : `${hoursRemaining} hours`;
    return {
      status: 'stay_pending',
      canReview: false,
      stayEndsAt: new Date(stayEndsAt).toISOString(),
      timeRemaining: timeText,
      message: `You can review after your stay ends in ${timeText}`
    };
  }

  return {
    status: 'eligible',
    canReview: true,
    message: 'You are eligible to review this server'
  };
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
  hasVerifiedJoin = false,
}) {
  if (!user || !user.id) {
    throw new Error('You must be signed in to post a review.');
  }

  const sid = String(serverId);
  const uid = String(user.id);

  // Check eligibility if this is not an edit of an existing review
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
  const cleanText = sanitizeText(text);

  if (cleanText.length < 5) {
    throw new Error('Review text must be at least 5 characters long.');
  }

  if (containsProfanity(cleanText)) {
    throw new Error('Review contains inappropriate or disallowed language.');
  }

  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    // Update existing review
    reviews[existingIdx].rating = cleanRating;
    reviews[existingIdx].text = cleanText;
    reviews[existingIdx].updated_at = now;
    reviews[existingIdx].user_name = user.globalName || user.username || user.name;
    reviews[existingIdx].user_avatar = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
      : null;
    reviews[existingIdx].user_avatar_hash = user.avatar || user.avatar_hash || user.avatarHash || null;
    saveReviews(reviews);
    return { review: reviews[existingIdx], updated: true };
  } else {
    // Insert new review
    const newReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      server_id: sid,
      user_id: uid,
      user_name: user.globalName || user.username || user.name || 'Community Member',
      user_avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
        : null,
      user_avatar_hash: user.avatar || user.avatar_hash || user.avatarHash || null,
      rating: cleanRating,
      text: cleanText,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    reviews.unshift(newReview);
    saveReviews(reviews);
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

