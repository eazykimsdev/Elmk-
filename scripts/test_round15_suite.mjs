import assert from 'assert';
import {
  getReviewEligibility,
  computeAccountAgeDays,
  computeAccountCreatedAt,
  upsertReview,
  deleteReview,
  reportReview,
  checkAndFlagSuspiciousReviews,
  REVIEW_MIN_ACCOUNT_DAYS
} from '../reviewsManager.js';
import { computeBotPermissions, buildBotInviteUrl, analyzeBotPermissions } from '../shared/botPermissions.js';
import { GLOBAL_BOT_COMMANDS, hashCommands } from '../botCommands.js';
import { buildCheckinReminderV2Payload, setReminderPreference, getReminderPreference } from '../checkinReminderManager.js';

console.log('--- Running Autonomous Round 15 Comprehensive Verification Suite ---');

// 1. Bot permissions least privilege tests
console.log('[TEST 1] Verifying Bot Permissions Security Invariants...');
const basicPerms = computeBotPermissions(['basic']);
assert.strictEqual(basicPerms, '19457', 'Basic permissions bitfield should be exactly 19457');
assert.strictEqual(BigInt(basicPerms) & 8n, 0n, 'Basic permissions must NEVER include Administrator');

const recruitPerms = computeBotPermissions(['basic', 'recruiting']);
assert.strictEqual(recruitPerms, '19489', 'Recruiting permissions should add Manage Server (32)');
assert.strictEqual(BigInt(recruitPerms) & 8n, 0n, 'Recruiting must NEVER include Administrator');

const inviteUrl = buildBotInviteUrl({ clientId: '1552165138017165372', guildId: '123456789012345678' });
assert(inviteUrl.includes('permissions=19457'), 'Invite URL must use computed 19457 permissions');
assert(inviteUrl.includes('scope=bot%20applications.commands') || inviteUrl.includes('scope=bot+applications.commands'), 'Invite URL must include applications.commands');

const analysis = analyzeBotPermissions('8');
assert.strictEqual(analysis.hasAdministrator, true, 'analyzeBotPermissions must identify Administrator bit');
const cleanAnalysis = analyzeBotPermissions('19457');
assert.strictEqual(cleanAnalysis.hasAdministrator, false, 'analyzeBotPermissions must identify non-admin bitfield');
assert.strictEqual(cleanAnalysis.isBasicSatisfied, true, 'Basic permissions must be satisfied');
console.log('✓ Bot permissions and least privilege tests passed.');

// 2. Reviews eligibility tests
console.log('[TEST 2] Verifying Reviews Eligibility Engine...');
const unauth = getReviewEligibility(null, '1347902300324368414');
assert.strictEqual(unauth.status, 'not_signed_in', 'Unauthenticated user status must be not_signed_in');

// Calculate snowflakes: 1-day old vs 3-day old
const now = Date.now();
const oneDayAgoMs = now - (1 * 24 * 60 * 60 * 1000);
const threeDaysAgoMs = now - (3 * 24 * 60 * 60 * 1000);
const oneDaySnowflake = String(((BigInt(oneDayAgoMs) - 1420070400000n) << 22n) + 100n);
const threeDaysSnowflake = String(((BigInt(threeDaysAgoMs) - 1420070400000n) << 22n) + 100n);

const youngElig = getReviewEligibility(oneDaySnowflake, '1347902300324368414');
assert.strictEqual(youngElig.status, 'account_too_new', '1-day old account must receive account_too_new');
assert(youngElig.message.includes('at least 2 days old'), 'Message must inform account age requirement');

const matureElig = getReviewEligibility(threeDaysSnowflake, '1347902300324368414');
assert.strictEqual(matureElig.status, 'eligible', '3-day old account without existing review must be eligible');

// Own server check
const ownerElig = getReviewEligibility('1400351264415682621', '1347902300324368414');
assert.strictEqual(ownerElig.status, 'own_server', 'Owner must not be allowed to review own server');
console.log('✓ Reviews eligibility engine tests passed.');

// 3. Review Posting, Verified Join Badge, and Moderation
console.log('[TEST 3] Verifying Review Lifecycle & Verified Join Badging...');
const testUser = {
  id: threeDaysSnowflake,
  username: 'AutomatedTester'
};

const postRes = upsertReview({
  serverId: '1347902300324368414',
  user: testUser,
  rating: 5,
  text: 'Great roleplay server with active police and staff shifts.'
});
assert.strictEqual(postRes.created, true, 'Review should be created');
assert.strictEqual(postRes.review.rating, 5, 'Review rating must match');

// Duplicate check
const dupElig = getReviewEligibility(threeDaysSnowflake, '1347902300324368414');
assert.strictEqual(dupElig.status, 'already_reviewed', 'User cannot post duplicate review');

// Edit review
const editRes = upsertReview({
  serverId: '1347902300324368414',
  user: testUser,
  rating: 4,
  text: 'Updated feedback: patrolling is still good and responsive.'
});
assert.strictEqual(editRes.updated, true, 'Review should update successfully');
assert.strictEqual(editRes.review.rating, 4, 'Rating should be updated to 4');

// Report review
const repRes = reportReview(postRes.review.id, '999999999999999999', 'Spam review');
assert.strictEqual(repRes.success, true, 'Report action must succeed');

// Delete review
const delRes = deleteReview(postRes.review.id, threeDaysSnowflake);
assert.strictEqual(delRes.success, true, 'Author must be able to delete review');
console.log('✓ Review lifecycle and reporting tests passed.');

// 4. Global slash commands validation
console.log('[TEST 4] Verifying Global Slash Commands Definitions...');
assert.strictEqual(GLOBAL_BOT_COMMANDS.length, 5, 'Must have exactly 5 global bot commands');
const cmdNames = GLOBAL_BOT_COMMANDS.map(c => c.name).sort();
assert.deepStrictEqual(cmdNames, ['ad', 'bump', 'leaderboard', 'setup', 'status'], 'Must match 5 required command names');
for (const cmd of GLOBAL_BOT_COMMANDS) {
  assert(cmd.name.length >= 1 && cmd.name.length <= 32, `Command name /${cmd.name} length valid`);
  assert(cmd.description.length >= 1 && cmd.description.length <= 100, `Command description length valid for /${cmd.name}`);
  assert.deepStrictEqual(cmd.contexts, [0], `Command /${cmd.name} must be guild only`);
}
assert.strictEqual(GLOBAL_BOT_COMMANDS.find(c => c.name === 'ad')?.default_member_permissions, '32', '/ad requires Manage Server');
assert.strictEqual(GLOBAL_BOT_COMMANDS.find(c => c.name === 'setup')?.default_member_permissions, '32', '/setup requires Manage Server');
console.log('✓ Global slash command definitions verified.');

// 5. Daily Check-in reminder panel tests
console.log('[TEST 5] Verifying Daily Check-In Reminder Panel...');
const reminderPayload = buildCheckinReminderV2Payload({
  serverId: '1347902300324368414',
  serverName: '@ConnectingERLC',
  userId: '523693281541095424'
});
assert.strictEqual(reminderPayload.content, '', 'Content must be empty without raw user mention');
assert.strictEqual(reminderPayload.embeds[0].title, 'Your daily check-in is ready', 'Heading must match exactly');
assert(reminderPayload.embeds[0].description.includes('@ConnectingERLC'), 'Description must include real server name');
assert(reminderPayload.components[0].components.some(c => c.label === 'Collect credits' && c.style === 5), 'Must have Collect credits link button');
assert(reminderPayload.components[0].components.some(c => c.label === 'Turn off reminders' && c.custom_id.startsWith('checkin_remind_off:')), 'Must have Turn off reminders button');

setReminderPreference({ userId: '523693281541095424', serverId: '1347902300324368414', enabled: true });
const prefActive = getReminderPreference('523693281541095424', '1347902300324368414');
assert.strictEqual(prefActive.enabled, true, 'Reminder preference should save active');

setReminderPreference({ userId: '523693281541095424', serverId: '1347902300324368414', enabled: false });
const prefInactive = getReminderPreference('523693281541095424', '1347902300324368414');
assert.strictEqual(prefInactive.enabled, false, 'Reminder preference should toggle off');
console.log('✓ Daily check-in reminder panel and preference tests passed.');

console.log('--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY ---');
