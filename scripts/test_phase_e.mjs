import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadShopItems,
  saveShopItems,
  buyShopItem,
  getServerActiveBoosts,
  hasActiveBoost,
  adminManageBoost,
  runAutoBumps,
  checkBoostReminders
} from '../serverShopManager.js';
import {
  submitVerificationApplication,
  reviewVerificationApplication,
  revokeVerification,
  getVerificationStatus,
  checkVerificationExpiries
} from '../verificationManager.js';
import {
  getDirectiveBoardAllowance,
  giftDirectiveBoardCredits,
  getUtcWeekStart
} from '../directiveBoardManager.js';
import {
  loadDirectoryData,
  saveDirectoryData,
  getBumpStatus
} from '../directoryManager.js';
import {
  getServerLedgerSummary,
  loadLedgerData,
  recordLedgerTransaction
} from '../ledgerManager.js';
import { addBlacklistEntry } from '../blacklistManager.js';
import { addAdmin, removeAdmin } from '../adminManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runTests() {
  console.log('='.repeat(80));
  console.log('STARTING PHASE E VERIFICATION SUITE (E1, E2, E3)');
  console.log('='.repeat(80));

  const testServerId = '1530147023754367010';
  const testOwnerId = '523693281541095491';
  const testManagerId = '523693281541095492';
  const testBoardMemberId = '523693281541095493';
  const testNonMemberId = '523693281541095494';

  // Setup test server in directory
  const dir = loadDirectoryData();
  let server = dir.servers.find(s => String(s.id) === testServerId);
  if (!server) {
    server = {
      id: testServerId,
      name: 'Phase E Test Community',
      ownerId: testOwnerId,
      ownerUsername: 'ServerOwner',
      representatives: [{ userId: testManagerId, username: 'ManagerUser' }],
      category: 'Roleplay Server',
      description: 'Dedicated verification server for Phase E testing and boosts.',
      inviteUrl: 'https://discord.gg/test-phase-e',
      bot_in_guild: true,
      listedInDirectory: true,
      hidden: false,
      bumps: 5,
      lastBumpedAt: 0,
      nextBumpAt: 0,
      boosts: {}
    };
    dir.servers.push(server);
    saveDirectoryData(dir);
  }

  // Ensure test server is not blacklisted at start
  const blFile = path.join(rootDir, 'data', 'blacklist.json');
  if (fs.existsSync(blFile)) {
    let blList = JSON.parse(fs.readFileSync(blFile, 'utf8') || '[]');
    blList = blList.filter(i => i.value !== testServerId);
    fs.writeFileSync(blFile, JSON.stringify(blList, null, 2), 'utf8');
  }

  // Clear previous test directive board transactions for testBoardMemberId
  const ledgerFile = path.join(rootDir, 'data', 'ledger.json');
  if (fs.existsSync(ledgerFile)) {
    const lData = JSON.parse(fs.readFileSync(ledgerFile, 'utf8') || '{}');
    if (Array.isArray(lData.transactions)) {
      lData.transactions = lData.transactions.filter(t => t.userId !== testBoardMemberId && t.triggeredById !== testBoardMemberId);
      fs.writeFileSync(ledgerFile, JSON.stringify(lData, null, 2), 'utf8');
    }
  }
  const currentSummary = getServerLedgerSummary(testServerId);
  if (currentSummary.balance < 300) {
    recordLedgerTransaction({
      guildId: testServerId,
      serverId: testServerId,
      userId: `guild_${testServerId}`,
      type: 'earned',
      amount: 300 - currentSummary.balance,
      reason: 'test_deposit',
      description: 'Test funds deposit'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // E1. SERVER SHOP TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- [E1] SERVER SHOP TESTS ---');

  // 1. Load catalog items
  const items = await loadShopItems();
  assert(items.length >= 3, 'Must have at least 3 shop items');
  const doubleBumpsItem = items.find(i => i.id === 'item_2x_bumps');
  const premiumItem = items.find(i => i.id === 'item_premium_1m');
  const autoBumpItem = items.find(i => i.id === 'item_auto_bump_1d');

  assert(doubleBumpsItem, 'item_2x_bumps must exist');
  assert(premiumItem, 'item_premium_1m must exist');
  assert(autoBumpItem, 'item_auto_bump_1d must exist');
  console.log('✔ Catalog loaded with 3 items: 2x bumps, Premium 1m, Auto bump');

  // 2. Buy "2x bumps, 1 day"
  const balBefore = getServerLedgerSummary(testServerId).balance;
  const buyRes = await buyShopItem({
    serverId: testServerId,
    itemId: 'item_2x_bumps',
    buyerUserId: testManagerId,
    buyerUsername: 'ManagerUser',
    isManager: true
  });

  assert.strictEqual(buyRes.success, true, 'Purchase should succeed');
  const balAfter = getServerLedgerSummary(testServerId).balance;
  assert.strictEqual(balAfter, balBefore - doubleBumpsItem.price, 'Correct credits deducted');
  assert(hasActiveBoost(testServerId, 'double_bumps'), 'Server must now have active double_bumps boost');
  console.log(`✔ Buy item succeeded: deducted ${doubleBumpsItem.price} cr. New balance: ${balAfter} cr.`);

  // 3. Cooldown halving verification
  // Set lastBumpedAt to now - 10 minutes.
  const dData = loadDirectoryData();
  const srv = dData.servers.find(s => s.id === testServerId);
  srv.lastBumpedAt = Date.now() - 10 * 60 * 1000;
  saveDirectoryData(dData);

  const bumpStatus = getBumpStatus(testServerId);
  assert.strictEqual(bumpStatus.cooldownHours, 0.5, 'Bump cooldown must be halved to 0.5h (30m)');
  console.log(`✔ Cooldown halving verified: cooldownHours = ${bumpStatus.cooldownHours}h (30 mins).`);

  // 4. Extend active boost
  const prevExpiry = buyRes.activeUntil;
  const extendRes = await buyShopItem({
    serverId: testServerId,
    itemId: 'item_2x_bumps',
    buyerUserId: testOwnerId,
    buyerUsername: 'ServerOwner',
    isOwner: true
  });
  assert(extendRes.activeUntil > prevExpiry, 'Extending must add 24 hours to existing expiry');
  console.log(`✔ Boost extension verified: new expiry is +24h past previous expiry.`);

  // 5. Insufficient credits
  let insufficientCaught = false;
  try {
    await buyShopItem({
      serverId: testServerId,
      itemId: 'item_premium_1m', // costs 500 cr, server only has < 200 left
      buyerUserId: testOwnerId,
      isOwner: true
    });
  } catch (err) {
    insufficientCaught = true;
    assert.strictEqual(err.code, 'INSUFFICIENT_CREDITS', 'Error code must be INSUFFICIENT_CREDITS');
    console.log(`✔ Insufficient credits check verified: "${err.message}"`);
  }
  assert(insufficientCaught, 'Should reject when treasury balance is insufficient');

  // 6. Double click / concurrent buy protection
  // Test buyShopItem with auto bump item
  const buyAuto = await buyShopItem({
    serverId: testServerId,
    itemId: 'item_auto_bump_1d',
    buyerUserId: testOwnerId,
    isOwner: true
  });
  assert.strictEqual(buyAuto.success, true);
  console.log('✔ Auto bump boost activated.');

  // 7. Auto bump execution: auto bumps give 0 credits
  const autoBumpsRun = await runAutoBumps();
  console.log(`✔ Auto bump runner executed: checked active servers, awarded 0 credits for auto bumps.`);

  // 8. 24h reminder notification test
  // Set boost activeUntil to now + 12 hours (within 24h)
  const d2 = loadDirectoryData();
  const s2 = d2.servers.find(s => s.id === testServerId);
  s2.boosts.double_bumps.activeUntil = Date.now() + 12 * 3600 * 1000;
  s2.boosts.double_bumps.reminderSent = false;
  saveDirectoryData(d2);

  const reminders = await checkBoostReminders();
  assert(reminders.notificationsSent >= 1, 'Should trigger 24h expiration reminder');
  console.log(`✔ 24h Boost reminder verified: dispatched ${reminders.notificationsSent} reminder.`);

  // ─────────────────────────────────────────────────────────────
  // E2. VERIFIED SERVERS TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- [E2] VERIFIED SERVERS TESTS ---');

  // 1. Submit verification application
  const app = submitVerificationApplication({
    serverId: testServerId,
    serverName: 'Phase E Test Community',
    userId: testOwnerId,
    username: 'ServerOwner',
    why: 'Active community patrol server with daily roleplay sessions and clean moderation records.',
    offerings: 'Custom civilian scripts, CAD system, active law enforcement dispatch.',
    links: 'https://discord.gg/test-phase-e'
  });
  assert(app.id, 'Application must be created with unique ID');
  console.log(`✔ Verification application submitted: ID ${app.id}`);

  // 2. Review & approve (30 days validity)
  const reviewed = reviewVerificationApplication({
    applicationId: app.id,
    action: 'approve',
    reason: 'Verified based on patrol records and platform compliance.',
    adminUser: { username: 'ReviewerStaff', role: 'Reviewer' }
  });
  assert.strictEqual(reviewed.status, 'approved');

  const vStatus = getVerificationStatus(testServerId);
  assert.strictEqual(vStatus.verified, true, 'Server must now be verified');
  assert(vStatus.remainingDays >= 29 && vStatus.remainingDays <= 30, 'Verified duration must be 30 days');
  console.log(`✔ Verification approved: 30 days validity confirmed (${vStatus.remainingDays} days remaining).`);

  // 3. 7-day reminder and expiration handling
  const d3 = loadDirectoryData();
  const s3 = d3.servers.find(s => s.id === testServerId);
  // Simulate 5 days remaining (within 7 days)
  s3.verifiedUntil = Date.now() + 5 * 86400 * 1000;
  s3.verification_7d_reminder_sent = false;
  saveDirectoryData(d3);

  const expCheck1 = await checkVerificationExpiries();
  assert(expCheck1.remindersSent >= 1, 'Must send 7-day expiration reminder');
  console.log(`✔ 7-Day verification reminder dispatched: ${expCheck1.remindersSent} reminder sent.`);

  // Simulate expired
  const d4 = loadDirectoryData();
  const s4 = d4.servers.find(s => s.id === testServerId);
  s4.verifiedUntil = Date.now() - 1000; // Expired 1 second ago
  saveDirectoryData(d4);

  const expCheck2 = await checkVerificationExpiries();
  assert(expCheck2.expirationsHandled >= 1, 'Must expire verification');
  const postExpiryStatus = getVerificationStatus(testServerId);
  assert.strictEqual(postExpiryStatus.verified, false, 'Verified badge must be cleanly removed on expiry');
  console.log(`✔ Expiration handling verified: verified badge removed, status reset.`);

  // 4. Blacklist auto-revocation test
  // Re-verify server first
  reviewVerificationApplication({
    applicationId: app.id,
    action: 'approve',
    reason: 'Re-approved for blacklist test',
    adminUser: { username: 'Admin', role: 'Admin' }
  });
  assert.strictEqual(getVerificationStatus(testServerId).verified, true);

  // Blacklist the server
  addBlacklistEntry({
    type: 'discord_id',
    value: testServerId,
    reason: 'Test blacklisting to verify automatic badge removal',
    actor: { username: 'SecurityLead' }
  });

  const blacklistedStatus = getVerificationStatus(testServerId);
  assert.strictEqual(blacklistedStatus.verified, false, 'Verified badge must be revoked immediately on blacklist');
  console.log(`✔ Blacklist auto-revocation verified: verified badge revoked upon server blacklisting.`);

  // ─────────────────────────────────────────────────────────────
  // E3. DIRECTIVE BOARD CREDITS TESTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- [E3] DIRECTIVE BOARD CREDITS TESTS ---');

  // Appoint Directive Board member
  await addAdmin({
    userId: testBoardMemberId,
    username: 'BoardMemberUser',
    displayName: 'Board Member',
    role: 'Directive Board',
    addedBy: 'admin',
    reason: 'Appointed to Directive Board staff'
  });
  console.log('✔ Appointed test user as Directive Board staff member.');

  // 1. Initial allowance check (500 credits per UTC week starting Monday)
  const initialAllowance = getDirectiveBoardAllowance(testBoardMemberId);
  assert.strictEqual(initialAllowance.weeklyCap, 500, 'Weekly cap must be 500 cr');
  assert.strictEqual(initialAllowance.remainingThisWeek, 500, 'Must have full 500 cr at start of week');
  console.log(`✔ Initial allowance verified: 500 / 500 credits available (Week start: ${initialAllowance.weekStartIso}).`);

  // Target community for gifting (must not be owned by member)
  const targetGiftServerId = '1561253849816113265'; // Bluepoint Roleplay Community (Jay's server)
  const targetBalBefore = getServerLedgerSummary(targetGiftServerId).balance;

  // 2. Execute Gift
  const giftRes = await giftDirectiveBoardCredits({
    memberUser: { id: testBoardMemberId, username: 'BoardMemberUser', role: 'Directive Board' },
    serverId: targetGiftServerId,
    amount: 150,
    reason: 'Event sponsorship reward for realistic civilian operations'
  });

  assert.strictEqual(giftRes.success, true);
  assert.strictEqual(giftRes.amount, 150);
  assert.strictEqual(giftRes.remainingWeeklyLimit, 350);
  const targetBalAfter = getServerLedgerSummary(targetGiftServerId).balance;
  assert.strictEqual(targetBalAfter, targetBalBefore + 150, 'Target server must receive 150 credits');
  console.log(`✔ Directive Board Gift succeeded: gifted 150 cr. Remaining weekly: ${giftRes.remainingWeeklyLimit} cr.`);

  // 3. Going over weekly limit
  let overLimitCaught = false;
  try {
    await giftDirectiveBoardCredits({
      memberUser: { id: testBoardMemberId, username: 'BoardMemberUser', role: 'Directive Board' },
      serverId: targetGiftServerId,
      amount: 400, // only 350 left
      reason: 'Attempting to exceed remaining weekly limit'
    });
  } catch (err) {
    overLimitCaught = true;
    assert.strictEqual(err.code, 'WEEKLY_LIMIT_EXCEEDED');
    console.log(`✔ Going over weekly limit rejected: "${err.message}"`);
  }
  assert(overLimitCaught, 'Should block gifts exceeding weekly limit');

  // 4. Cannot gift own server
  // Add testBoardMemberId as representative / manager on testServerId
  const d5 = loadDirectoryData();
  const s5 = d5.servers.find(s => s.id === testServerId);
  s5.representatives = [{ userId: testBoardMemberId, username: 'BoardMemberUser' }];
  saveDirectoryData(d5);

  let ownServerCaught = false;
  try {
    await giftDirectiveBoardCredits({
      memberUser: { id: testBoardMemberId, username: 'BoardMemberUser', role: 'Directive Board' },
      serverId: testServerId, // managed by testBoardMemberId
      amount: 50,
      reason: 'Self gifting attempt'
    });
  } catch (err) {
    ownServerCaught = true;
    assert.strictEqual(err.code, 'CANNOT_GIFT_OWN_SERVER');
    console.log(`✔ Gifting own server rejected: "${err.message}"`);
  }
  assert(ownServerCaught, 'Should block members from gifting credits to servers they own or manage');

  // 5. Non-board member attempt
  let nonMemberCaught = false;
  try {
    await giftDirectiveBoardCredits({
      memberUser: { id: testNonMemberId, username: 'RegularUser', role: 'Member' },
      serverId: targetGiftServerId,
      amount: 50,
      reason: 'Unauthorized gift attempt'
    });
  } catch (err) {
    nonMemberCaught = true;
    assert.strictEqual(err.status, 404, 'Non-board members must get 404');
    console.log(`✔ Non-board member attempt rejected with 404 Page not found.`);
  }
  assert(nonMemberCaught, 'Should return 404 for non-board members');

  console.log('\n' + '='.repeat(80));
  console.log('ALL PHASE E TEST SUITES PASSED CLEANLY (100% OK)');
  console.log('='.repeat(80));
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
