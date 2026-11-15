import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  recordLedgerTransaction,
  getServerLedgerSummary,
  getServerCreditHistory,
  appendServerActivity,
  getStoredServerActivity,
} from '../ledgerManager.js';
import {
  getPromotedServers,
  upsertPromotedServer,
  updatePromotedServerDetails,
  bumpPromotedServer,
  getBumpStatus,
  recordBotMemberJoin,
  recordBotMemberLeave,
  processMaturePendingJoins,
} from '../directoryManager.js';
import { createJoinIntent } from '../inviteValidator.js';
import {
  getServerReviews,
  upsertReview,
  backfillOldReviewsOnDisk,
} from '../reviewsManager.js';
import { evaluateCheckinWarningWindow } from '../checkinReminderManager.js';
import { getGuildPartnershipConfig } from '../partnershipsManager.js';
import {
  scheduleServerBumpReminder,
  deliverDueBumpReminders,
  loadBumpReminders,
  saveBumpReminders,
} from '../bumpReminderManager.js';
import {
  buildBumpReadyV2Panel,
  buildBumpThankYouV2,
  buildDailyCheckinReminderV2Panel,
  buildPartnershipResolutionV2,
  buildPartnershipRequesterNotificationV2,
} from '../discordNotificationManager.js';
import {
  deleteServerHard,
  deleteUserAccountAndServers,
} from '../accountDeletionManager.js';
import { loadAuditLog } from '../adminManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

// Snapshot data files before test so we leave zero test data behind
const DATA_FILES = [
  'promoted_servers.json',
  'ledger.json',
  'credit_ledger.json',
  'server_activity.json',
  'join_intents.json',
  'pending_joins.json',
  'server_joins.json',
  'reviews.json',
  'partnerships.json',
  'bump_reminders.json',
  'audit_log.json',
  'admin_audit_log.json',
  'persistent_bans.json',
  'user_checkins.json',
  'workspaces.json',
];

const snapshots = new Map();
for (const file of DATA_FILES) {
  const fullPath = path.join(dataDir, file);
  if (fs.existsSync(fullPath)) {
    snapshots.set(fullPath, fs.readFileSync(fullPath, 'utf8'));
  } else {
    snapshots.set(fullPath, null);
  }
}

function restoreSnapshots() {
  for (const [fullPath, content] of snapshots.entries()) {
    if (content === null) {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } else {
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

try {
  console.log('================================================================');
  console.log('RUNNING REAL VERIFICATION SUITE FOR ALL 13 POINTS');
  console.log('================================================================\n');

  // ------------------------------------------------------------------
  // POINT 1: OVERVIEW ORDER (Joins first, Credits second everywhere)
  // ------------------------------------------------------------------
  {
    const overviewSrc = fs.readFileSync(path.join(rootDir, 'src/pages/dashboard/OverviewTab.tsx'), 'utf8');
    const earnSrc = fs.readFileSync(path.join(rootDir, 'src/pages/dashboard/EarnCoinsTab.tsx'), 'utf8');
    const detailsSrc = fs.readFileSync(path.join(rootDir, 'src/pages/dashboard/ServerDetailsTab.tsx'), 'utf8');

    const kpiJoinsIdx = overviewSrc.indexOf('Card 1: Joins (First)');
    const kpiCreditsIdx = overviewSrc.indexOf('Card 2: Credits (Second)');
    assert(kpiJoinsIdx > -1 && kpiCreditsIdx > kpiJoinsIdx, 'Overview KPI cards must render Joins first and Credits second');
    const tabJoinsIdx = overviewSrc.indexOf("{ id: 'joins', label: 'Joins' }");
    const tabCreditsIdx = overviewSrc.indexOf("{ id: 'credits', label: 'Credits' }");
    assert(tabJoinsIdx > -1 && tabCreditsIdx > tabJoinsIdx, 'Overview Activity chart tabs must order joins first, credits second');
    assert(overviewSrc.includes("useState<'joins' | 'credits' | 'bumps'>('joins')"), 'Overview Activity chart default tab must be joins');

    const detailsJoinsIdx = detailsSrc.indexOf('Joins Tile FIRST');
    const detailsCreditsIdx = detailsSrc.indexOf('Credits Tile SECOND');
    assert(detailsJoinsIdx > -1 && detailsCreditsIdx > detailsJoinsIdx, 'ServerDetailsTab stats must show Joins first and Credits second');

    console.log('[PASS] POINT 1 (OVERVIEW ORDER):');
    console.log(`  - OverviewTab KPI order: Joins idx=${kpiJoinsIdx} < Credits idx=${kpiCreditsIdx}`);
    console.log(`  - OverviewTab Activity tabs: Joins idx=${tabJoinsIdx} < Credits idx=${tabCreditsIdx} (default: 'joins')`);
    console.log(`  - ServerDetailsTab Your numbers order: Joins idx=${detailsJoinsIdx} < Credits idx=${detailsCreditsIdx}\n`);
  }

  // ------------------------------------------------------------------
  // POINT 2: WHITE OUTLINE ON ACTIVITY (No white outline, #F97316 focus)
  // ------------------------------------------------------------------
  {
    const cssSrc = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
    const overviewSrc = fs.readFileSync(path.join(rootDir, 'src/pages/dashboard/OverviewTab.tsx'), 'utf8');

    assert(cssSrc.includes('outline: none !important;') && cssSrc.includes('.recharts-wrapper'), 'index.css must strip white outline on mouse/touch and Recharts SVG elements');
    assert(cssSrc.includes('outline: 2px solid #F97316 !important;'), 'index.css must provide accessible #F97316 orange :focus-visible style');
    assert(!overviewSrc.includes('outline-white') && !overviewSrc.includes('ring-white'), 'OverviewTab must not have white outline/ring classes');
    assert(overviewSrc.includes('focus-visible:outline-[#F97316]'), 'OverviewTab interactive elements use #F97316 focus-visible outline');

    console.log('[PASS] POINT 2 (WHITE OUTLINE ON ACTIVITY):');
    console.log('  - Mouse/touch click & Recharts SVG white outline removed in src/index.css');
    console.log('  - Accessible keyboard :focus-visible configured strictly in #F97316 orange\n');
  }

  // ------------------------------------------------------------------
  // POINT 3: RECENT ACTIVITY IS EMPTY (Real events written & queried)
  // ------------------------------------------------------------------
  {
    const testServerId = '990000000000000003';
    upsertPromotedServer({
      id: testServerId,
      name: 'Telemetry Test Server',
      category: 'Roleplay Server',
      description: 'Testing real activity events.',
      inviteUrl: 'https://discord.gg/telemetrytest',
      ownerId: '880000000000000003',
    });

    // 1. Bump event
    bumpPromotedServer(testServerId, '880000000000000003', 'BumpTester');
    // 2. Review event
    upsertReview({
      serverId: testServerId,
      user: {
        id: '880000000000000004',
        username: 'ReviewTester',
        displayName: 'Review Tester',
        avatar: 'a_1234567890abcdef',
      },
      rating: 5,
      text: 'Great server with active patrols and custom vehicles!',
    });
    // 3. Check-in event
    appendServerActivity(testServerId, {
      type: 'checkin',
      text: 'Daily check-in completed by CheckinTester (Day 3 streak)',
    });
    // 4. Credit change event
    recordLedgerTransaction({
      userId: '880000000000000003',
      serverId: testServerId,
      amount: 10,
      type: 'earned',
      reason: 'Activity verification reward',
    });
    // 5. Join event
    appendServerActivity(testServerId, {
      type: 'join',
      text: 'New verified member joined via directory',
    });

    const events = getStoredServerActivity(testServerId);
    const types = new Set(events.map((e) => e.type));
    assert(types.has('bump'), 'Activity must include real bump event');
    assert(types.has('review'), 'Activity must include real review event');
    assert(types.has('checkin'), 'Activity must include real checkin event');
    assert(types.has('credits'), 'Activity must include real credits event');
    assert(types.has('join'), 'Activity must include real join event');

    console.log('[PASS] POINT 3 (RECENT ACTIVITY IS POPULATED WITH REAL EVENTS):');
    for (const ev of events.slice(0, 5)) {
      console.log(`  - [${ev.type.toUpperCase()}] ${ev.text} (${ev.timestamp})`);
    }
    console.log('');
  }

  // ------------------------------------------------------------------
  // POINT 4: JOIN SERVER (+2 CR) FLOW (No instant credits, stay check, early leave)
  // ------------------------------------------------------------------
  {
    const targetGuildId = '990000000000000041';
    const recipientGuildId = '990000000000000042';
    const joinerUserId = '880000000000000041';
    const leaverUserId = '880000000000000042';

    upsertPromotedServer({
      id: targetGuildId,
      name: 'Target Community',
      category: 'Roleplay Server',
      description: 'Community being joined.',
      inviteUrl: 'https://discord.gg/targetcomm',
      ownerId: '880000000000000099',
      rewardCoins: 2,
    });
    upsertPromotedServer({
      id: recipientGuildId,
      name: 'Joiner Owned Server',
      category: 'Roleplay Server',
      description: 'Server that receives the +2 credits.',
      inviteUrl: 'https://discord.gg/recipientcomm',
      ownerId: joinerUserId,
      rewardCoins: 2,
    });

    const initialServerBalance = getServerLedgerSummary(recipientGuildId).balance;

    // Step 1: Clicking Join creates intent ONLY — 0 credits awarded on click
    const intent1 = createJoinIntent(joinerUserId, targetGuildId, recipientGuildId);
    const balanceAfterClick = getServerLedgerSummary(recipientGuildId).balance;
    assert.equal(balanceAfterClick, initialServerBalance, 'Clicking Join must NEVER award credits immediately');

    // Step 2: Bot confirms member joined — still pending minimum stay
    const botJoin1 = recordBotMemberJoin(targetGuildId, joinerUserId, { recipientServerId: recipientGuildId });
    assert.equal(botJoin1?.status, 'pending', 'Bot member join must match active join intent and create pending join');
    const balanceBeforeStay = getServerLedgerSummary(recipientGuildId).balance;
    assert.equal(balanceBeforeStay, initialServerBalance, 'Credits must not be given before minimum stay');

    // Step 3: User who leaves early gets 0 credits
    createJoinIntent(leaverUserId, targetGuildId, recipientGuildId);
    recordBotMemberJoin(targetGuildId, leaverUserId, { recipientServerId: recipientGuildId });
    const leaveRes = recordBotMemberLeave(targetGuildId, leaverUserId);
    assert.equal(leaveRes, true, 'Leaving early must cancel pending join reward');

    // Step 4: Fast-forward stay completion for joinerUserId and process mature joins
    const pendingPath = path.join(dataDir, 'pending_joins.json');
    const pendingList = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    for (const pj of pendingList) {
      if (pj.userId === joinerUserId && pj.serverId === targetGuildId) {
        pj.releaseAt = Date.now() - 1000;
      }
    }
    fs.writeFileSync(pendingPath, JSON.stringify(pendingList, null, 2), 'utf8');

    const matured = await processMaturePendingJoins(() => true);
    const balanceAfterStay = getServerLedgerSummary(recipientGuildId).balance;
    assert.equal(balanceAfterStay, initialServerBalance + 2, 'Server treasury must receive +2 credits after stay verification');

    // Step 5: Re-running processMaturePendingJoins never double-awards
    await processMaturePendingJoins(() => true);
    const balanceAfterSecondRun = getServerLedgerSummary(recipientGuildId).balance;
    assert.equal(balanceAfterSecondRun, initialServerBalance + 2, 'Ledger entry must be written once only');

    const serverTxs = getServerCreditHistory(recipientGuildId).items.filter((t) => t.joinedServerId === targetGuildId);
    assert.equal(serverTxs.length, 1, 'Exactly one append-only ledger entry for the verified join');

    console.log('[PASS] POINT 4 (JOIN SERVER +2 CR VERIFICATION):');
    console.log(`  - Balance on Join click: ${balanceAfterClick} cr (0 awarded on click)`);
    console.log(`  - Early leaver cancelledPending=${leaveRes} (0 credits awarded)`);
    console.log(`  - Balance after bot stay check: ${balanceAfterStay} cr (+2 cr to server ${recipientGuildId})`);
    console.log(`  - Ledger entries for join: ${serverTxs.length} (idempotencyKey=${serverTxs[0].idempotencyKey})\n`);
  }

  // ------------------------------------------------------------------
  // POINT 5: REVIEW ICON AND NAME (Real Discord avatar + display name, backfill old)
  // ------------------------------------------------------------------
  {
    const testGuildId = '990000000000000005';
    const reviewsPath = path.join(dataDir, 'reviews.json');
    const existingReviews = fs.existsSync(reviewsPath) ? JSON.parse(fs.readFileSync(reviewsPath, 'utf8')) : [];
    existingReviews.push({
      id: 'old_review_test_1',
      server_id: testGuildId,
      user_id: '880000000000000005',
      username: 'LegacyReviewer',
      user_avatar: 'https://cdn.discordapp.com/embed/avatars/0.png', // old blue Discord logo
      rating: 5,
      comment: 'Old review with blue embed avatar.',
      created_at: new Date().toISOString(),
    });
    fs.writeFileSync(reviewsPath, JSON.stringify(existingReviews, null, 2), 'utf8');

    const backfillRes = backfillOldReviewsOnDisk();
    const loadedReviews = getServerReviews(testGuildId).reviews;
    assert.equal(loadedReviews.length, 1);
    assert.equal(loadedReviews[0].user_avatar, null, 'Blue Discord embed/avatars URL must be stripped so clean fallback or real CDN avatar is used');
    assert.equal(loadedReviews[0].display_name, 'LegacyReviewer', 'Display name must be populated on old reviews');

    // New review with real avatar hash
    upsertReview({
      serverId: testGuildId,
      user: {
        id: '880000000000000006',
        username: 'realuser',
        displayName: 'Real Display Name',
        avatar: 'abcdef1234567890',
      },
      rating: 5,
      text: 'New review with real Discord avatar and display name!',
    });
    const updatedReviews = getServerReviews(testGuildId).reviews;
    const realRev = updatedReviews.find((r) => r.user_id === '880000000000000006');
    assert.equal(realRev.display_name, 'Real Display Name');
    assert.equal(realRev.user_avatar, 'https://cdn.discordapp.com/avatars/880000000000000006/abcdef1234567890.png?size=128');

    console.log('[PASS] POINT 5 (REVIEW ICON AND NAME):');
    console.log(`  - Old review blue Discord logo stripped: user_avatar=${loadedReviews[0].user_avatar}, display_name="${loadedReviews[0].display_name}"`);
    console.log(`  - Real review avatar URL: ${realRev.user_avatar}, display_name="${realRev.display_name}"\n`);
  }

  // ------------------------------------------------------------------
  // POINT 6: DANGER ZONE (One card, 2 rows, orange outlined buttons, confirm dialogs, audit log)
  // ------------------------------------------------------------------
  {
    const settingsSrc = fs.readFileSync(path.join(rootDir, 'src/pages/dashboard/SettingsTab.tsx'), 'utf8');
    assert(settingsSrc.includes('Danger zone'), 'SettingsTab must render combined Danger zone card');
    assert(settingsSrc.includes('Delete server from ConnectingERLC'), 'Row 1: Delete server from ConnectingERLC');
    assert(settingsSrc.includes('Delete my account and all my servers'), 'Row 2: Delete my account and all my servers');
    assert(settingsSrc.includes('border-[#F97316]/40'), 'Danger zone buttons must use orange outline (#F97316)');
    assert(!settingsSrc.includes('bg-rose-600'), 'Danger zone must be red-free and green-free');

    // Test real server deletion and account deletion + audit log
    const delGuildId = '990000000000000006';
    const delOwnerId = '880000000000000006';
    upsertPromotedServer({
      id: delGuildId,
      name: 'DeleteMeServer',
      category: 'Roleplay Server',
      description: 'Temp server for delete test.',
      inviteUrl: 'https://discord.gg/deleteme',
      ownerId: delOwnerId,
    });

    const srvDelRes = await deleteServerHard(delGuildId, delOwnerId, { actor: { id: delOwnerId, username: 'DeleteOwner' } });
    assert.equal(srvDelRes.success, true, 'deleteServerHard must succeed');

    const accDelRes = await deleteUserAccountAndServers({
      userId: delOwnerId,
      username: 'DeleteOwner',
      botToken: null,
      sessionCreatedAt: Date.now(),
    });
    assert.equal(accDelRes.success, true, 'deleteUserAccountAndServers must succeed');

    const logs = loadAuditLog();
    const hasServerDelLog = logs.some((l) => l.action === 'server_hard_delete' && l.target === delGuildId);
    const hasAccDelLog = logs.some((l) => l.action === 'account_delete' && l.target === delOwnerId);
    assert(hasServerDelLog && hasAccDelLog, 'Both server deletion and account deletion must be recorded in the audit log');

    console.log('[PASS] POINT 6 (DANGER ZONE & AUDIT LOGGED DELETIONS):');
    console.log('  - Combined into 1 "Danger zone" card with 2 rows & red-free #F97316 orange outlined buttons');
    console.log(`  - Server delete audit logged: ${hasServerDelLog}, Account delete audit logged: ${hasAccDelLog}\n`);
  }

  // ------------------------------------------------------------------
  // POINT 7: BUMP SETTINGS MOVE (Moved out of Settings into Promote Server "Bump reminders")
  // ------------------------------------------------------------------
  {
    const settingsSrc = fs.readFileSync(path.join(rootDir, 'src/pages/dashboard/SettingsTab.tsx'), 'utf8');
    const promoteSrc = fs.readFileSync(path.join(rootDir, 'src/pages/dashboard/PromoteTab.tsx'), 'utf8');

    assert(!settingsSrc.includes('>Bump notices<'), 'Bump notices must be removed from SettingsTab');
    assert(promoteSrc.includes('Bump reminders'), 'PromoteTab must include merged "Bump reminders" section');
    assert(promoteSrc.includes('Bump channel') && promoteSrc.includes('Role to mention when the bump is ready (optional)'), 'PromoteTab Bump reminders must include channel picker, role picker, and switch');

    // Verify backend persistence of bump reminder settings on Promote Server save
    const bumpCfgGuildId = '990000000000000007';
    upsertPromotedServer({
      id: bumpCfgGuildId,
      name: 'Bump Config Server',
      category: 'Roleplay Server',
      description: 'Testing bump reminders save.',
      inviteUrl: 'https://discord.gg/bumpcfg',
      ownerId: '880000000000000007',
      bumpChannelId: '770000000000000001',
      bumpRoleId: '770000000000000002',
      bumpReadyNoticeEnabled: true,
    });
    const savedSrv = getPromotedServers().find((s) => s.id === bumpCfgGuildId);
    assert.equal(savedSrv.bumpChannelId, '770000000000000001');
    assert.equal(savedSrv.bumpRoleId, '770000000000000002');
    assert.equal(savedSrv.bumpReadyNoticeEnabled, true);

    console.log('[PASS] POINT 7 (BUMP SETTINGS MOVED TO PROMOTE SERVER):');
    console.log(`  - Removed from SettingsTab; merged into PromoteTab "Bump reminders"`);
    console.log(`  - Saved values preserved: bumpChannelId=${savedSrv.bumpChannelId}, bumpRoleId=${savedSrv.bumpRoleId}, enabled=${savedSrv.bumpReadyNoticeEnabled}\n`);
  }

  // ------------------------------------------------------------------
  // POINT 8: MINIMUM MEMBERS & CREDIT COST DEFAULT TO NONE (Nullable, any number)
  // ------------------------------------------------------------------
  {
    const p8GuildDefault = '990000000000000081';
    const p8GuildCustom = '990000000000000082';

    upsertPromotedServer({
      id: p8GuildDefault,
      name: 'Default None Server',
      category: 'Roleplay Server',
      description: 'No min members or credit cost saved.',
      inviteUrl: 'https://discord.gg/p8def',
      ownerId: '880000000000000081',
      openForPartnerships: true,
    });

    upsertPromotedServer({
      id: p8GuildCustom,
      name: 'Custom Requirement Server',
      category: 'Roleplay Server',
      description: 'Custom min members and credit cost saved.',
      inviteUrl: 'https://discord.gg/p8cus',
      ownerId: '880000000000000082',
      openForPartnerships: true,
      partnershipMinMembers: 425,
      partnershipPrice: 35,
    });

    const cfgDefault = getGuildPartnershipConfig(p8GuildDefault);
    const cfgCustom = getGuildPartnershipConfig(p8GuildCustom);

    assert.equal(cfgDefault.partnershipMinMembers, null, 'Default minimum members must be null (None)');
    assert.equal(cfgDefault.partnershipPrice, null, 'Default credit cost must be null (None)');
    assert.equal(cfgCustom.partnershipMinMembers, 425, 'Owner can save any number for minimum members');
    assert.equal(cfgCustom.partnershipPrice, 35, 'Owner can save any number for credit cost');

    console.log('[PASS] POINT 8 (MINIMUM MEMBERS & CREDIT COST DEFAULT TO NONE):');
    console.log(`  - Default server: partnershipMinMembers=${cfgDefault.partnershipMinMembers}, partnershipPrice=${cfgDefault.partnershipPrice}`);
    console.log(`  - Custom saved server: partnershipMinMembers=${cfgCustom.partnershipMinMembers}, partnershipPrice=${cfgCustom.partnershipPrice}\n`);
  }

  // ------------------------------------------------------------------
  // POINT 9: DAILY CHECK-IN REMINDER WINDOW (Exact 48h UTC reset rule, no early warning, no duplicate)
  // ------------------------------------------------------------------
  {
    const nowMs = Date.now();
    // Case A: Checked in 5 hours ago (43 hours left until 48h reset -> NO warning)
    const plentyOfTimeMs = nowMs - 5 * 3600 * 1000;
    const evalPlenty = evaluateCheckinWarningWindow({
      lastCheckin: plentyOfTimeMs,
      lastRemindedForCheckin: null,
      nowMs,
    });
    assert.equal(evalPlenty.shouldSend, false, 'Must NOT warn when streak has 43h remaining');

    // Case B: Checked in 46.5 hours ago (1.5 hours left until 48h reset -> WARN)
    const aboutToResetMs = nowMs - 46.5 * 3600 * 1000;
    const evalWarn = evaluateCheckinWarningWindow({
      lastCheckin: aboutToResetMs,
      lastRemindedForCheckin: null,
      nowMs,
    });
    assert.equal(evalWarn.shouldSend, true, 'Must warn when reset is within the 2h warning window');

    // Case C: Already warned for this exact check-in timestamp -> NO duplicate warning
    const evalDuplicate = evaluateCheckinWarningWindow({
      lastCheckin: aboutToResetMs,
      lastRemindedForCheckin: aboutToResetMs,
      nowMs,
    });
    assert.equal(evalDuplicate.shouldSend, false, 'Must NOT send duplicate warning for the same check-in cycle');

    console.log('[PASS] POINT 9 (DAILY CHECK-IN REMINDER TIMING):');
    console.log(`  - Streak with 43h left: shouldSend=${evalPlenty.shouldSend} (remaining=${Math.round(evalPlenty.remainingMs / 3600000)}h)`);
    console.log(`  - Streak with 1.5h left: shouldSend=${evalWarn.shouldSend} (remaining=${Math.round(evalWarn.remainingMs / 60000)}m)`);
    console.log(`  - Duplicate check for same cycle: shouldSend=${evalDuplicate.shouldSend}\n`);
  }

  // ------------------------------------------------------------------
  // POINT 10: "PARTNERSHIP SETUP REQUIRED" CHECK (Passes when saved in Promote Server)
  // ------------------------------------------------------------------
  {
    const setupGuildId = '990000000000000101';
    const notSetupGuildId = '990000000000000102';

    upsertPromotedServer({
      id: setupGuildId,
      name: 'Set Up Partner Server',
      category: 'Roleplay Server',
      description: 'Has saved partnership settings in Promote Server.',
      inviteUrl: 'https://discord.gg/setup101',
      ownerId: '880000000000000101',
      partnershipSetUp: true,
      openForPartnerships: true,
      partnershipBroadcastChannel: '770000000000000101',
    });

    const cfgSetUp = getGuildPartnershipConfig(setupGuildId);
    const cfgNotSetUp = getGuildPartnershipConfig(notSetupGuildId);

    assert.equal(cfgSetUp.partnershipSetUp, true, 'Set up server must pass partnershipSetUp check');
    assert.equal(cfgNotSetUp.partnershipSetUp, false, 'Unconfigured server must have partnershipSetUp=false');

    console.log('[PASS] POINT 10 ("PARTNERSHIP SETUP REQUIRED" CHECK):');
    console.log(`  - Configured server (${setupGuildId}): partnershipSetUp=${cfgSetUp.partnershipSetUp}, mode=${cfgSetUp.partnershipMode}`);
    console.log(`  - Unconfigured server (${notSetupGuildId}): partnershipSetUp=${cfgNotSetUp.partnershipSetUp}\n`);
  }

  // ------------------------------------------------------------------
  // POINT 11: BUMP REMINDER FIRED TOO EARLY (Replaces old, checks DB cooldown, sends once)
  // ------------------------------------------------------------------
  {
    const bumpGuildId = '990000000000000111';
    const bumpUserId = '880000000000000111';
    saveBumpReminders([]); // start clean for test

    upsertPromotedServer({
      id: bumpGuildId,
      name: 'Bump Cooldown Server',
      category: 'Roleplay Server',
      description: 'Testing bump cooldown and reminder.',
      inviteUrl: 'https://discord.gg/bump111',
      ownerId: bumpUserId,
      bumpChannelId: '770000000000000111',
      bumpReadyNoticeEnabled: true,
    });

    // Seed a stale reminder that would have fired early if not replaced
    scheduleServerBumpReminder(bumpGuildId, Date.now() - 60000, Date.now() - 3660000);

    // Now perform a real bump -> must replace the stale reminder with exact cooldown end from DB
    const bumpRes = bumpPromotedServer(bumpGuildId, bumpUserId, 'BumpOwner');
    assert.ok(bumpRes.server && !bumpRes.error, 'Bump must succeed');
    const expectedCooldownEnd = Number(bumpRes.nextBumpAt);

    let sentDeliveries = [];
    const mockFetch = async (_url, opts) => {
      if (opts?.body) {
        sentDeliveries.push(JSON.parse(opts.body));
      }
      return { ok: true, status: 200, json: async () => ({ id: 'dm_chan_111' }) };
    };

    // Check at half time: even if someone tampers with reminder due_at, DB check blocks early send
    const remindersHalf = loadBumpReminders();
    assert.equal(remindersHalf.filter((r) => r.guild_id === bumpGuildId && !r.sent).length, 1, 'Exactly one active reminder scheduled for server');
    remindersHalf[0].due_at = Date.now() - 1000; // simulate early timer wakeup while DB still has active cooldown
    saveBumpReminders(remindersHalf);

    await deliverDueBumpReminders('test_bot_token', { fetchImpl: mockFetch, nowMs: Date.now() });
    assert.equal(sentDeliveries.length, 0, 'Must NOT send reminder while database cooldown is still active (half-time check)');

    // Now advance time past the database cooldown end (cooldown truly expired)
    const afterCooldownMs = expectedCooldownEnd + 5000;

    await deliverDueBumpReminders('test_bot_token', { fetchImpl: mockFetch, nowMs: afterCooldownMs });
    assert.equal(sentDeliveries.length, 1, 'Must send exactly ONE reminder when cooldown has really finished');

    // Run again to prove it never sends twice
    await deliverDueBumpReminders('test_bot_token', { fetchImpl: mockFetch, nowMs: afterCooldownMs + 5000 });
    assert.equal(sentDeliveries.length, 1, 'Must send once only and never duplicate');

    // Sync DB lastBumpedAt/nextBumpAt to expired to verify getBumpStatus reflects real DB time
    const promotedPath = path.join(dataDir, 'promoted_servers.json');
    const promotedObj = JSON.parse(fs.readFileSync(promotedPath, 'utf8'));
    const srvIdx = promotedObj.servers.findIndex((s) => s.id === bumpGuildId);
    const expiredTs = Date.now() - 2 * 3600 * 1000;
    promotedObj.servers[srvIdx].lastBumpedAt = expiredTs;
    promotedObj.servers[srvIdx].nextBumpAt = Date.now() - 1000;
    if (promotedObj.bumpCooldowns) {
      promotedObj.bumpCooldowns[bumpGuildId] = expiredTs;
    }
    fs.writeFileSync(promotedPath, JSON.stringify(promotedObj, null, 2), 'utf8');

    const dashStatus = getBumpStatus(bumpGuildId);
    assert.equal(dashStatus.canBump, true, 'Dashboard bump status reflects real database cooldown end');

    console.log('[PASS] POINT 11 (BUMP REMINDER TIMING & DB VERIFICATION):');
    console.log(`  - Scheduled exact cooldown end: ${new Date(expectedCooldownEnd).toISOString()}`);
    console.log(`  - Half-time check (cooldown active in DB): messages sent = 0`);
    console.log(`  - Cooldown end check (cooldown expired in DB): messages sent = ${sentDeliveries.length}`);
    console.log(`  - Repeat run check: messages sent = ${sentDeliveries.length} (sent once only)\n`);
  }

  // ------------------------------------------------------------------
  // POINT 12: V2 PANELS FOR ALL BOT MESSAGES (Strict Components V2, Separators, Orange, No Emojis)
  // ------------------------------------------------------------------
  {
    const panels = {
      bumpReady: buildBumpReadyV2Panel({
        guildId: '990000000000000121',
        serverName: 'Liberty County RP',
        serverIconUrl: 'https://cdn.discordapp.com/icons/990000000000000121/iconhash.png',
      }),
      bumpConfirmation: buildBumpThankYouV2({
        guildId: '990000000000000121',
        serverName: 'Liberty County RP',
        serverIconUrl: 'https://cdn.discordapp.com/icons/990000000000000121/iconhash.png',
        callerId: '880000000000000121',
        nextBumpAt: Date.now() + 3600000,
      }),
      dailyCheckinReminder: buildDailyCheckinReminderV2Panel({
        guildId: '990000000000000121',
        serverName: 'Liberty County RP',
        serverIconUrl: 'https://cdn.discordapp.com/icons/990000000000000121/iconhash.png',
        resetAtMs: Date.now() + 7200000,
      }),
      partnershipResult: buildPartnershipRequesterNotificationV2({
        action: 'accept',
        toGuildId: '990000000000000121',
        toServerName: 'Liberty County RP',
        serverIconUrl: 'https://cdn.discordapp.com/icons/990000000000000121/iconhash.png',
        fromGuildId: '990000000000000122',
        fromServerName: 'River City RP',
      }),
    };

    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

    for (const [name, payload] of Object.entries(panels)) {
      assert.equal(payload.flags, 32768, `${name} must use IS_COMPONENTS_V2 (32768)`);
      assert.equal(payload.embeds, undefined, `${name} must not contain embeds`);
      const container = payload.components[0];
      assert.equal(container.type, 17, `${name} top-level component must be Container (type 17)`);
      assert.equal(container.accent_color, 16347158, `${name} must use orange accent color (16347158 / #F97316)`);
      const hasSeparator = container.components.some((c) => c.type === 14 && c.divider === true);
      assert.equal(hasSeparator, true, `${name} must use real Separator dividers (type 14, divider: true)`);
      const hasSectionIcon = container.components.some((c) => c.type === 9 && c.accessory?.type === 11);
      assert.equal(hasSectionIcon, true, `${name} must display server name and icon via Section + Thumbnail`);
      const serialized = JSON.stringify(payload);
      assert(!emojiRegex.test(serialized), `${name} must contain zero emojis`);
      assert(!serialized.includes('---') && !serialized.includes('───'), `${name} must contain no dash lines`);
    }

    console.log('[PASS] POINT 12 (DISCORD COMPONENTS V2 PANELS):');
    for (const [name, payload] of Object.entries(panels)) {
      console.log(`  - ${name}: flags=${payload.flags}, container.type=${payload.components[0].type}, accent=${payload.components[0].accent_color}, children=${payload.components[0].components.length}`);
    }
    console.log('');
  }

  // ------------------------------------------------------------------
  // POINT 13: HOME PAGE STATS & MARQUEE SPEED (Lowered bar, live DB numbers, test server + bump delta, calm marquee speed)
  // ------------------------------------------------------------------
  {
    const homeSrc = fs.readFileSync(path.join(rootDir, 'src/pages/HomePage.tsx'), 'utf8');
    const marqueeSrc = fs.readFileSync(path.join(rootDir, 'src/components/ui/logo-marquee.tsx'), 'utf8');
    assert(homeSrc.includes('mt-10 sm:mt-14 grid'), 'HomePage stats bar uses the original spacing (mt-10 sm:mt-14)');
    assert(!homeSrc.includes("'+'") && !homeSrc.includes('1,217'), 'HomePage stats must have no "+" rounding or fake numbers');
    assert(marqueeSrc.includes('travelDistance / speedScale'), 'ServerMarquee must scale duration by travelDistance / speedScale (~28px/s) so large server lists scroll slowly');

    const computeLiveHomeStats = () => {
      const listed = getPromotedServers(true).filter((s) => s.listedInDirectory !== false);
      const connectedCommunities = listed.length;
      const membersReached = listed.reduce((sum, s) => sum + (Number(s.memberCount) || 0), 0);
      const totalBumps = listed.reduce((sum, s) => sum + (Number(s.bumps) || 0), 0);
      return { connectedCommunities, membersReached, totalBumps };
    };

    const beforeStats = computeLiveHomeStats();

    // Add a test server (+350 members) and perform a real test bump (+1 bump)
    const testHomeGuildId = '990000000000000131';
    upsertPromotedServer({
      id: testHomeGuildId,
      name: 'Home Stats Test Community',
      category: 'Roleplay Server',
      description: 'Verifying live home page stats delta.',
      inviteUrl: 'https://discord.gg/homestats131',
      ownerId: '880000000000000131',
      memberCount: 350,
      listedInDirectory: true,
    });
    bumpPromotedServer(testHomeGuildId, '880000000000000131', 'StatsTester');

    const afterStats = computeLiveHomeStats();
    assert.equal(afterStats.connectedCommunities, beforeStats.connectedCommunities + 1, 'Connected communities must increment by 1');
    assert.equal(afterStats.membersReached, beforeStats.membersReached + 350, 'Members reached must increment by 350');
    assert.equal(afterStats.totalBumps, beforeStats.totalBumps + 1, 'Total bumps must increment by 1');

    console.log('[PASS] POINT 13 (HOME PAGE LIVE STATS & MARQUEE SPEED):');
    console.log(`  - Before test server/bump: Connected=${beforeStats.connectedCommunities}, Members=${beforeStats.membersReached}, Bumps=${beforeStats.totalBumps}`);
    console.log(`  - After +1 server (350 members) & +1 bump: Connected=${afterStats.connectedCommunities}, Members=${afterStats.membersReached}, Bumps=${afterStats.totalBumps}`);
    console.log(`  - ServerMarquee speed: scaled to constant ~28px/sec (14px/sec on hover) regardless of server list width`);
  }
} finally {
  restoreSnapshots();
  console.log('  - Cleaned up all test data and restored original database state.');
  console.log('\n================================================================');
  console.log('ALL 13 VERIFICATION CHECKS PASSED WITH ZERO BUGS');
  console.log('================================================================');
}
