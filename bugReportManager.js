/**
 * Bug Report Manager
 * 
 * Handles /bugreport submissions, Postgres & JSON file persistence,
 * rate limiting (3/user/day), blacklist enforcement, admin review actions,
 * idempotent reward crediting (50 credits to reporter's server if listed or pending reward),
 * Discord DM notification in Components V2, and audit logging.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { query, isPostgresConnected } from './db.js';
import { isUserBanned } from './adminManager.js';
import { recordAuditAction } from './adminManager.js';
import { getPromotedServers } from './directoryManager.js';
import { recordLedgerTransaction } from './ledgerManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const BUG_REPORTS_FILE = path.join(DATA_DIR, 'bug_reports.json');
const PENDING_REWARDS_FILE = path.join(DATA_DIR, 'pending_rewards.json');

const BRAND_ORANGE = 16347158; // #F97316
const CHRISTMAS_RED = 12856117; // #C42B35

function getThemeAccentColor() {
  const currentTheme = String(process.env.THEME || '').toLowerCase();
  return currentTheme === 'christmas' ? CHRISTMAS_RED : BRAND_ORANGE;
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BUG_REPORTS_FILE)) {
    fs.writeFileSync(BUG_REPORTS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(PENDING_REWARDS_FILE)) {
    fs.writeFileSync(PENDING_REWARDS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

export function loadBugReports() {
  ensureFile();
  try {
    let list = [];
    if (fs.existsSync(BUG_REPORTS_FILE)) {
      const raw = fs.readFileSync(BUG_REPORTS_FILE, 'utf8');
      list = JSON.parse(raw) || [];
    }
    const isProd = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
    const seedPath = path.join(process.cwd(), 'seeds', 'bug_reports.json');
    if (!isProd && (!Array.isArray(list) || list.length === 0) && fs.existsSync(seedPath)) {
      try {
        const seedRaw = fs.readFileSync(seedPath, 'utf8');
        const seedBugs = JSON.parse(seedRaw) || [];
        if (Array.isArray(seedBugs) && seedBugs.length > 0) {
          list = seedBugs;
        }
      } catch {}
    }
    return list;
  } catch (err) {
    console.error('[BUG REPORTS] Error reading reports file:', err.message);
    return [];
  }
}

export function saveBugReports(reports) {
  ensureFile();
  try {
    const tmp = `${BUG_REPORTS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(reports, null, 2), 'utf8');
    fs.renameSync(tmp, BUG_REPORTS_FILE);
  } catch (err) {
    console.error('[BUG REPORTS] Error saving reports file:', err.message);
  }
}

export function loadPendingRewards() {
  ensureFile();
  try {
    const raw = fs.readFileSync(PENDING_REWARDS_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

export function savePendingRewards(list) {
  ensureFile();
  try {
    const tmp = `${PENDING_REWARDS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmp, PENDING_REWARDS_FILE);
    return true;
  } catch (err) {
    console.error('[PENDING REWARDS] Error saving file:', err.message);
    return false;
  }
}

export function addPendingReward({ userId, amount = 50, reason = 'bug report reward', reportId = null }) {
  const uid = String(userId);
  const all = loadPendingRewards();
  const existing = all.find(r => String(r.userId) === uid && r.reportId === reportId);
  if (existing) return existing;

  const reward = {
    id: `pr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    userId: uid,
    amount: Number(amount) || 50,
    reason: String(reason || 'bug report reward'),
    reportId,
    createdAt: new Date().toISOString()
  };
  all.push(reward);
  savePendingRewards(all);
  console.log(`[PENDING REWARDS] Saved pending ${reward.amount} credits for user ${uid} (reason: ${reward.reason})`);
  return reward;
}

export function claimPendingRewardsForUser(userId, targetGuildId, guildName, guildIconUrl = null) {
  if (!userId || !targetGuildId) return [];
  const uid = String(userId);
  const all = loadPendingRewards();
  const userRewards = all.filter(r => String(r.userId) === uid);
  if (userRewards.length === 0) return [];

  const claimed = [];
  const remaining = all.filter(r => String(r.userId) !== uid);

  for (const r of userRewards) {
    try {
      recordLedgerTransaction({
        userId: uid,
        type: 'earned',
        amount: r.amount,
        reason: 'bug report reward',
        description: `Pending bug report reward credited on server listing: ${guildName || targetGuildId}`,
        guildId: String(targetGuildId),
        guildName: guildName || 'Community Server',
        guildIconUrl: guildIconUrl || null,
        triggeredBy: 'ConnectingERLC Automated Pending Reward Claim',
        status: 'posted',
        idempotencyKey: `pending_claim:${r.id}`
      });
      claimed.push(r);
      console.log(`[PENDING REWARDS] Deposited ${r.amount} pending credits into newly listed server ${targetGuildId} for user ${uid}`);
    } catch (err) {
      console.error(`[PENDING REWARDS] Failed to claim reward ${r.id}:`, err.message);
    }
  }

  savePendingRewards(remaining);
  return claimed;
}

/**
 * Check if user is rate limited (max 3 bug reports in the last 24h)
 */
export function checkBugReportRateLimit(userId) {
  const reports = loadBugReports();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const userRecent = reports.filter(
    (r) => String(r.userId) === String(userId) && new Date(r.createdAt).getTime() >= oneDayAgo
  );
  return {
    allowed: userRecent.length < 3,
    count: userRecent.length,
    remaining: Math.max(0, 3 - userRecent.length)
  };
}

/**
 * Create a new bug report
 */
export async function createBugReport({ userId, username, title, description, stepsToReproduce }) {
  if (!userId) throw new Error('User ID is required.');
  if (isUserBanned(userId)) {
    throw new Error('You are restricted from submitting bug reports.');
  }

  const rateLimit = checkBugReportRateLimit(userId);
  if (!rateLimit.allowed) {
    throw new Error('You have reached the limit of 3 bug reports per day. Please try again tomorrow.');
  }

  const cleanTitle = String(title || '').trim().slice(0, 150);
  const cleanDesc = String(description || '').trim().slice(0, 2000);
  const cleanSteps = String(stepsToReproduce || '').trim().slice(0, 2000);

  if (!cleanTitle) throw new Error('Bug report title is required.');
  if (!cleanDesc) throw new Error('What happened description is required.');
  if (!cleanSteps) throw new Error('Steps to reproduce are required.');

  const id = `bug_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const report = {
    id,
    userId: String(userId),
    username: String(username || 'Discord User'),
    title: cleanTitle,
    description: cleanDesc,
    stepsToReproduce: cleanSteps,
    status: 'pending', // 'pending' | 'accepted' | 'rejected' | 'duplicate'
    staffNotes: '',
    reviewedBy: null,
    reviewedAt: null,
    rewardGiven: false,
    rewardGuildId: null,
    dmDelivered: null,
    dmNote: null,
    createdAt: nowIso
  };

  // 1. Save to JSON file
  const all = loadBugReports();
  all.unshift(report);
  saveBugReports(all);

  // 2. Save to Postgres if connected
  if (isPostgresConnected()) {
    try {
      await query(
        `INSERT INTO bug_reports (id, user_id, username, title, description, steps_to_reproduce, status, staff_notes, reward_given, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [report.id, report.userId, report.username, report.title, report.description, report.stepsToReproduce, report.status, report.staffNotes, report.rewardGiven, report.createdAt]
      );
    } catch (err) {
      console.error('[BUG REPORTS] Postgres insert error:', err.message);
    }
  }

  return report;
}

/**
 * Get all bug reports with optional filter
 */
export function getBugReports({ status = 'all' } = {}) {
  const all = loadBugReports();
  if (status && status !== 'all') {
    return all.filter((r) => r.status.toLowerCase() === status.toLowerCase());
  }
  return all;
}

/**
 * Get single bug report by ID
 */
export function getBugReportById(id) {
  const all = loadBugReports();
  return all.find((r) => r.id === id) || null;
}

/**
 * Build Components V2 DM panel payload
 */
export function buildBugReviewV2Payload({ report, status, staffNotes, rewardGuildName, isPending = false, isTest = false }) {
  const isChristmas = String(process.env.THEME || '').toLowerCase() === 'christmas';
  const accentColor = isChristmas ? CHRISTMAS_RED : BRAND_ORANGE;
  const dashboardUrl = (process.env.APP_URL ? `${process.env.APP_URL}/dashboard` : 'https://connectingerlc.xyz/dashboard').replace(/\/+$/, '');

  let statusTitle = isTest ? '[TEST] Report Accepted' : 'Report Accepted';
  let rewardLine = '';

  if (status === 'accepted') {
    if (isPending) {
      rewardLine = '50 credits are waiting for you. List your server on the website and they are added to its wallet.';
    } else {
      const serverDisplay = rewardGuildName || 'your server';
      rewardLine = `50 credits were added to ${serverDisplay}'s wallet.`;
    }
  } else if (status === 'rejected') {
    statusTitle = isTest ? '[TEST] Report Closed' : 'Report Closed';
    rewardLine = 'Staff reviewed your report and marked it as closed or not reproducible.';
  } else if (status === 'duplicate') {
    statusTitle = isTest ? '[TEST] Duplicate Report' : 'Duplicate Report';
    rewardLine = 'Staff reviewed your report. This issue has already been reported previously.';
  }

  const containerComponents = [
    {
      type: 10, // TextDisplay
      content: `# ${statusTitle}`
    },
    {
      type: 14, // Separator
      divider: true
    },
    {
      type: 10, // TextDisplay
      content: `Thank you for helping improve ConnectingERLC.\n\n**${report.title}**\n\n${rewardLine}`
    }
  ];

  if (staffNotes && staffNotes.trim()) {
    containerComponents.push({
      type: 14, // Separator
      divider: true
    });
    containerComponents.push({
      type: 10,
      content: `Staff note:\n${staffNotes.trim()}`
    });
  }

  containerComponents.push({
    type: 14, // Separator
    divider: true
  });

  containerComponents.push({
    type: 1, // ActionRow
    components: [
      {
        type: 2, // Button
        style: 5, // Link
        label: 'Open dashboard',
        url: dashboardUrl
      }
    ]
  });

  return {
    flags: 32768, // MessageFlags.IsComponentsV2
    components: [
      {
        type: 17, // Container
        accent_color: accentColor,
        components: containerComponents
      }
    ]
  };
}

/**
 * Send Components V2 DM to recipient with review outcome
 */
export async function sendBugReviewDM({ userId, report, status, staffNotes, rewardGuildName, isPending = false, isTest = false }) {
  const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  if (!token) {
    console.warn('[BUG REPORTS] Cannot send DM: DISCORD_TOKEN is missing.');
    return { success: false, delivered: false, note: 'Bot token missing' };
  }

  try {
    const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: String(userId) })
    });

    if (!dmRes.ok) {
      const errText = await dmRes.text();
      console.warn(`[BUG REPORTS] Failed to open DM with ${userId}: ${errText}`);
      return { success: true, delivered: false, note: 'User Discord DMs are closed or private' };
    }

    const dmChannel = await dmRes.json();
    const channelId = dmChannel.id;
    const payload = buildBugReviewV2Payload({
      report,
      status,
      staffNotes,
      rewardGuildName,
      isPending,
      isTest
    });

    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text();
      console.warn(`[BUG REPORTS] Failed to dispatch DM to ${userId}: ${errText}`);
      const isClosed = errText.includes('50007') || msgRes.status === 403;
      return {
        success: true,
        delivered: false,
        note: isClosed ? 'User Discord DMs are closed or private' : `Discord API delivery notice: ${errText.slice(0, 100)}`
      };
    }

    const sentData = await msgRes.json();
    console.log(`[BUG REPORTS] Sent Components V2 DM to ${userId} (message id: ${sentData.id})`);
    return { success: true, delivered: true, messageId: sentData.id, note: 'Delivered successfully' };
  } catch (err) {
    console.error(`[BUG REPORTS] Error in sendBugReviewDM for ${userId}:`, err.message);
    return { success: true, delivered: false, note: `Delivery notice: ${err.message}` };
  }
}

/**
 * Send a marked [TEST] panel to the signed-in admin before DMing reporter
 */
export async function sendTestBugReviewDM({ adminUserId, reportId, staffUser }) {
  const report = getBugReportById(reportId);
  if (!report) throw new Error('Bug report not found.');
  if (!adminUserId) throw new Error('Admin Discord user ID required to receive test DM.');

  const allServers = getPromotedServers(true);
  const userServer = allServers.find(
    (s) => String(s.ownerId) === String(report.userId) && s.isListed !== false && !s.hidden && !s.delisted
  );
  const isPending = !userServer;
  const rewardGuildName = userServer?.name || null;

  const dmResult = await sendBugReviewDM({
    userId: adminUserId,
    report,
    status: 'accepted',
    staffNotes: report.staffNotes || '',
    rewardGuildName,
    isPending,
    isTest: true
  });

  recordAuditAction({
    actor: staffUser || { username: 'Admin', id: adminUserId },
    action: 'bug_report_test_dm',
    target: report.id,
    targetType: 'bug_report',
    reason: `Sent [TEST] DM panel to admin ${adminUserId}. Result: ${dmResult.note || 'Delivered'}`
  });

  return dmResult;
}

/**
 * Review a bug report (Staff only)
 */
export async function reviewBugReport(id, { status, staffNotes = '', staffUser }) {
  const validStatuses = ['accepted', 'rejected', 'duplicate'];
  const cleanStatus = String(status || '').toLowerCase();
  if (!validStatuses.includes(cleanStatus)) {
    throw new Error('Invalid status. Allowed: accepted, rejected, duplicate.');
  }

  const all = loadBugReports();
  const reportIndex = all.findIndex((r) => r.id === id);
  if (reportIndex === -1) {
    throw new Error('Bug report not found.');
  }

  const report = all[reportIndex];
  const beforeStatus = report.status;
  const nowIso = new Date().toISOString();
  const actorName = staffUser?.username || 'Staff';

  report.status = cleanStatus;
  report.staffNotes = String(staffNotes || '').trim();
  report.reviewedBy = actorName;
  report.reviewedAt = nowIso;

  let rewardServerName = null;
  let isPending = false;

  // Idempotent reward crediting
  if (cleanStatus === 'accepted' && !report.rewardGiven && !report.pendingReward) {
    // Check if reporter has a server listed on ConnectingERLC
    const allServers = getPromotedServers(true);
    const userServer = allServers.find(
      (s) => String(s.ownerId) === String(report.userId) && s.isListed !== false && !s.hidden && !s.delisted
    );

    if (userServer) {
      const targetGuildId = String(userServer.id || userServer.guildId);
      rewardServerName = userServer.name || 'Community Server';

      try {
        recordLedgerTransaction({
          userId: report.userId,
          type: 'earned',
          amount: 50,
          reason: 'bug report reward',
          description: `Bug report accepted: ${report.title}`,
          guildId: targetGuildId,
          guildName: rewardServerName,
          guildIconUrl: userServer.iconUrl || null,
          triggeredBy: actorName,
          status: 'posted',
          idempotencyKey: `bug_reward:${report.id}`
        });

        report.rewardGiven = true;
        report.rewardGuildId = targetGuildId;
        console.log(`[BUG REPORTS] Awarded 50 credits to guild ${targetGuildId} for bug report ${id}`);
      } catch (err) {
        console.error(`[BUG REPORTS] Failed to record ledger transaction for ${id}:`, err.message);
      }
    } else {
      // Save pending 50 credit reward for his Discord ID
      addPendingReward({
        userId: report.userId,
        amount: 50,
        reason: 'bug report reward',
        reportId: report.id
      });
      report.rewardGiven = false;
      report.pendingReward = true;
      report.rewardGuildId = 'pending';
      isPending = true;
      console.log(`[BUG REPORTS] Reporter ${report.userId} has no listed server. Saved pending 50 credit reward.`);
    }
  }

  // Record audit log
  recordAuditAction({
    actor: staffUser || { username: actorName },
    action: `bug_report_${cleanStatus}`,
    target: report.id,
    targetType: 'bug_report',
    reason: report.staffNotes || `Marked ${cleanStatus}`,
    before: beforeStatus,
    after: cleanStatus
  });

  // Bot DMs reporter only
  const dmResult = await sendBugReviewDM({
    userId: report.userId,
    report,
    status: cleanStatus,
    staffNotes: report.staffNotes,
    rewardGuildName: rewardServerName,
    isPending,
    isTest: false
  });

  report.dmDelivered = dmResult.delivered;
  report.dmNote = dmResult.note;

  // Update in array and save
  all[reportIndex] = report;
  saveBugReports(all);

  // Sync with Postgres
  if (isPostgresConnected()) {
    try {
      await query(
        `UPDATE bug_reports
         SET status = $1, staff_notes = $2, reviewed_by = $3, reviewed_at = $4, reward_given = $5, reward_guild_id = $6
         WHERE id = $7`,
        [report.status, report.staffNotes, report.reviewedBy, report.reviewedAt, report.rewardGiven, report.rewardGuildId, report.id]
      );
    } catch (err) {
      console.error('[BUG REPORTS] Postgres update error:', err.message);
    }
  }

  return report;
}
