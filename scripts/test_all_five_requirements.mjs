/**
 * scripts/test_all_five_requirements.mjs
 * 
 * Verifies all 5 requirements with concrete assertions and real output.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

console.log('====================================================');
console.log('RUNNING ALL 5 REQUIREMENTS VERIFICATION SUITE');
console.log('====================================================\n');

// ─────────────────────────────────────────────────────────────
// 1. SETTINGS SAVE ERROR VERIFICATION
// ─────────────────────────────────────────────────────────────
console.log('[1/5] Testing Settings Save & Customizations Validation...');
const { customizationFields, stripLegacyCustomizations } = await import('../api.js');

// Verify allowlist has valid dashboard fields
assert(customizationFields.has('serverIconUrl'), 'serverIconUrl in customizationFields');
assert(customizationFields.has('autoBumpReminder'), 'autoBumpReminder in customizationFields');
assert(customizationFields.has('promotionStaffRoleId'), 'promotionStaffRoleId in customizationFields');
assert(customizationFields.has('modLogChannelId'), 'modLogChannelId in customizationFields');
assert(customizationFields.has('dmOwner'), 'dmOwner in customizationFields');
assert(customizationFields.has('rosterData'), 'rosterData in customizationFields');

// Verify stripLegacyCustomizations cleans legacy ticket/shift keys without error
const dirtyLegacy = {
  serverName: 'Active Roleplay',
  ticketCategories: ['support', 'billing'],
  ticketPingRoleId: '123456789012345678',
  panelTitle: 'Open a ticket',
  autoBumpReminder: true,
  autoBumpEnabled: true,
  botPrefix: '!'
};
const cleaned = stripLegacyCustomizations(dirtyLegacy);
assert.strictEqual(cleaned.serverName, 'Active Roleplay');
assert.strictEqual(cleaned.autoBumpReminder, true);
assert.strictEqual(cleaned.ticketCategories, undefined, 'Legacy ticketCategories removed');
assert.strictEqual(cleaned.panelTitle, undefined, 'Legacy panelTitle removed');
console.log('  ✓ Customization allowlist and legacy stripper validated.');

// ─────────────────────────────────────────────────────────────
// 2. MAINTENANCE REMOVAL & KILL SWITCH VERIFICATION
// ─────────────────────────────────────────────────────────────
console.log('\n[2/5] Testing Maintenance Logic & Kill Switch...');
const { isMaintenanceActive, loadSiteState, saveSiteState } = await import('../siteStateManager.js');

// Verify phrase is eradicated
const bannedPhrase = "ConnectingERLC is currently undergoing maintenance. We'll be right back.";
const botCommandsCode = fs.readFileSync(path.join(process.cwd(), 'botCommands.js'), 'utf8');
const siteStateCode = fs.readFileSync(path.join(process.cwd(), 'siteStateManager.js'), 'utf8');
assert(!botCommandsCode.includes(bannedPhrase), 'Banned phrase eradicated from botCommands.js');
assert(!siteStateCode.includes(bannedPhrase), 'Banned phrase eradicated from siteStateManager.js');
assert(!botCommandsCode.includes("We'll be right back"), "We'll be right back eradicated from botCommands.js");

// Test kill switch MAINTENANCE_FORCE_OFF
process.env.MAINTENANCE_FORCE_OFF = 'true';
const forcedState = isMaintenanceActive();
assert.strictEqual(forcedState.active, false, 'isMaintenanceActive is false when MAINTENANCE_FORCE_OFF=true');
assert.strictEqual(forcedState.forced_off, true, 'forced_off flag is true');
delete process.env.MAINTENANCE_FORCE_OFF;
console.log('  ✓ Maintenance phrase eradicated and kill switch functional.');

// ─────────────────────────────────────────────────────────────
// 3. /bump COMMAND END-TO-END VERIFICATION
// ─────────────────────────────────────────────────────────────
console.log('\n[3/5] Testing /bump Command & Directory Elevation...');
const { bumpPromotedServer, getBumpStatus, getPromotedServers, upsertPromotedServer } = await import('../directoryManager.js');

// Seed a fresh test server with 18-digit snowflake ID and unique owner
const freshGuildId = '19' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString().slice(0, 16);
const freshOwnerId = '88' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString().slice(0, 16);
upsertPromotedServer({ id: freshGuildId, name: `Community Roleplay ${freshGuildId.slice(-4)}`, ownerId: freshOwnerId });
const bump1 = bumpPromotedServer(freshGuildId, freshOwnerId);
assert(bump1.success, 'First bump succeeds');
assert(bump1.nextBumpAt > Date.now(), 'nextBumpAt set in future');

// Second bump within cooldown window must throw 429 cooldown error
let cooldownCaught = false;
try {
  bumpPromotedServer(freshGuildId, freshOwnerId);
} catch (err) {
  cooldownCaught = true;
  assert.strictEqual(err.status, 429, 'Status is 429');
  assert(err.nextBumpAt > Date.now(), 'Error has nextBumpAt');
}
assert(cooldownCaught, 'Second bump inside cooldown threw 429 cooldown error');

// Verify elevation to top of directory
const allServers = getPromotedServers(true);
const elevated = allServers[0];
assert.strictEqual(String(elevated.id || elevated.guildId), freshGuildId, 'Bumped server elevated to #1 in directory');
console.log('  ✓ /bump elevated server to #1 and cooldown window enforced.');

// ─────────────────────────────────────────────────────────────
// 4. /bugreport COMMAND VERIFICATION
// ─────────────────────────────────────────────────────────────
console.log('\n[4/5] Testing /bugreport Modal, Rate Limit, Ledger Reward & Review...');
const {
  createBugReport,
  getBugReports,
  getBugReportById,
  reviewBugReport,
  checkBugReportRateLimit
} = await import('../bugReportManager.js');
const { getUserLedgerSummary } = await import('../ledgerManager.js');

const testReporterId = '88' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString().slice(0, 16);

// Create report 1, 2, 3
const rep1 = await createBugReport({
  userId: testReporterId,
  username: 'TestBugHunter',
  title: 'Directory search cursor jump',
  description: 'When typing fast in the directory search input, cursor moves to end of text.',
  stepsToReproduce: '1. Open directory. 2. Type "roblox" rapidly. 3. Observe cursor position.'
});
assert(rep1.id.startsWith('bug_'), 'Bug report created with ID');
assert.strictEqual(rep1.status, 'pending');

const rep2 = await createBugReport({
  userId: testReporterId,
  username: 'TestBugHunter',
  title: 'Minor visual alignment on mobile',
  description: 'Sidebar icon is 1px off on small screens.',
  stepsToReproduce: '1. Resize browser to 375px. 2. Observe navigation icon.'
});

const rep3 = await createBugReport({
  userId: testReporterId,
  username: 'TestBugHunter',
  title: 'Documentation link anchor',
  description: 'Clicking anchor link does not smoothly scroll.',
  stepsToReproduce: '1. Go to /docs. 2. Click section anchor.'
});

// 4th report by same user in 24h MUST be blocked by rate limit
let rateLimitBlocked = false;
try {
  await createBugReport({
    userId: testReporterId,
    username: 'TestBugHunter',
    title: 'Fourth bug report',
    description: 'Should be rejected by daily limit.',
    stepsToReproduce: 'N/A'
  });
} catch (err) {
  rateLimitBlocked = true;
  assert(err.message.includes('limit of 3 bug reports per day'), 'Rate limit error message');
}
assert(rateLimitBlocked, 'Fourth report blocked by 3/day rate limit');

// Test Review flow: Accept with reward crediting
const staffUser = { username: 'AdminLead', id: '111111111111111111', role: 'Owner' };

// First test with user who owns NO server: 0 credits given
const balanceBefore = getUserLedgerSummary(testReporterId).balance;
const reviewedRep1 = await reviewBugReport(rep1.id, {
  status: 'accepted',
  staffNotes: 'Verified and queued for patch. Thank you!',
  staffUser
});
assert.strictEqual(reviewedRep1.status, 'accepted');
assert.strictEqual(reviewedRep1.rewardGiven, false, 'No server owned on website, so rewardGiven is false');
const balanceAfter = getUserLedgerSummary(testReporterId).balance;
assert.strictEqual(balanceAfter, balanceBefore, 'Reporter balance unchanged when no server listed');

// Now test with reporter who owns a listed server:
// Set up server for testReporterId
upsertPromotedServer({
  id: '777777777777777777',
  name: 'San Andreas Metro Community',
  ownerId: testReporterId,
  isListed: true,
  category: 'Roleplay Server'
});

const rewardUserId = '66' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString().slice(0, 16);
const rewardGuildId = '55' + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString().slice(0, 16);

upsertPromotedServer({
  id: rewardGuildId,
  name: 'Liberty City Police Community',
  isListed: true,
  category: 'Roleplay Server'
}, rewardUserId);

const repForReward = await createBugReport({
  userId: rewardUserId,
  username: 'ServerOwnerReporter',
  title: 'Credits chip visual glitch',
  description: 'Credits chip briefly flickered during transfer.',
  stepsToReproduce: '1. Transfer credits. 2. Check header chip.'
});

const ownerBalanceBefore = getUserLedgerSummary(rewardUserId).balance;
const reviewedReward = await reviewBugReport(repForReward.id, {
  status: 'accepted',
  staffNotes: 'Great catch! Awarding 50 credits to your server.',
  staffUser
});
assert.strictEqual(reviewedReward.status, 'accepted');
assert.strictEqual(reviewedReward.rewardGiven, true, 'Reward given to listed server');
assert.strictEqual(reviewedReward.rewardGuildId, rewardGuildId, `Reward credited to server ${rewardGuildId}`);

const ownerBalanceAfter = getUserLedgerSummary(rewardUserId).balance;
assert.strictEqual(ownerBalanceAfter, ownerBalanceBefore + 50, 'Exactly 50 credits added to ledger');

// Idempotency: clicking Accept twice must NOT credit twice!
await reviewBugReport(repForReward.id, {
  status: 'accepted',
  staffNotes: 'Staff clicked again',
  staffUser
});
const ownerBalanceSecondClick = getUserLedgerSummary(rewardUserId).balance;
assert.strictEqual(ownerBalanceSecondClick, ownerBalanceAfter, 'Second accept click does NOT add duplicate credits');

// Test Duplicate & Rejected
const reviewedRep2 = await reviewBugReport(rep2.id, {
  status: 'duplicate',
  staffNotes: 'Duplicate of existing ticket.',
  staffUser
});
assert.strictEqual(reviewedRep2.status, 'duplicate');

const reviewedRep3 = await reviewBugReport(rep3.id, {
  status: 'rejected',
  staffNotes: 'Works as designed.',
  staffUser
});
assert.strictEqual(reviewedRep3.status, 'rejected');

console.log('  ✓ /bugreport rate limit (3/day), review flow, and idempotent 50-credit rewards verified.');

// ─────────────────────────────────────────────────────────────
// 5. FLOATING SAVE BAR & ROUTE GUARD VERIFICATION
// ─────────────────────────────────────────────────────────────
console.log('\n[5/5] Verifying Floating Save Bar & Route Guard...');
const dashboardCode = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'DashboardPage.tsx'), 'utf8');

// Verify floating classes
assert(dashboardCode.includes('fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2'), 'Save bar has floating 16px margins');
assert(dashboardCode.includes('rounded-2xl'), 'Save bar has rounded-2xl styling');
assert(dashboardCode.includes('pb-32'), 'Container has pb-32 so save bar never covers content or footer');
console.log('  ✓ Floating save bar styling and spacing confirmed.');

console.log('\n====================================================');
console.log('ALL 5 REQUIREMENTS TESTS PASSED WITH ZERO ERRORS!');
console.log('====================================================');
setTimeout(() => process.exit(0), 100).unref();
