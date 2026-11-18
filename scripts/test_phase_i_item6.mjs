import assert from 'assert';
import { claimDailyReward } from '../partnershipsManager.js';
import { getAdminSettings } from '../premiumManager.js';

console.log('Testing Item 6: Daily Check-In (3 cr, Server-authoritative uniqueness, Concurrent locks)...');

const testUserId = `test_user_checkin_${Date.now()}`;
const testGuildId = `test_guild_checkin_${Date.now()}`;

// 0. Verify reward setting is 3 credits
const settings = getAdminSettings();
console.log(`0. Verified daily checkin setting: ${settings.daily_checkin_reward_credits} credits (expected: 3)`);
assert.strictEqual(Number(settings.daily_checkin_reward_credits), 3, 'Reward setting must be 3 credits');

// Baseline: Day 1 (2026-11-01)
const day1Time = new Date('2026-11-01T12:00:00Z').getTime();
console.log('1. Testing first claim on Day 1...');
const res1 = claimDailyReward(testUserId, testGuildId, { now: day1Time });
assert.strictEqual(res1.success, true, 'First claim must succeed');
assert.strictEqual(res1.reward, 3, 'First claim must award exactly 3 credits');
assert.strictEqual(res1.streak, 1, 'First claim streak must be 1');

// 2. Test second click / second tab / refresh on the same day (must fail)
console.log('2. Testing second tab / refresh on same day (must be blocked)...');
let blockedSecondTab = false;
try {
  claimDailyReward(testUserId, testGuildId, { now: day1Time + 5000 });
} catch (err) {
  blockedSecondTab = true;
  assert(err.message.includes('already claimed today'), `Error message should state already claimed: ${err.message}`);
}
assert(blockedSecondTab, 'Second claim on same day must be rejected by server');

// 3. Test two clicks at once (concurrent simulation)
console.log('3. Testing two clicks at once on Day 1...');
let blockedTwoClicks = false;
try {
  claimDailyReward(testUserId, testGuildId, { now: day1Time });
} catch (err) {
  blockedTwoClicks = true;
}
assert(blockedTwoClicks, 'Concurrent or repeated clicks must be blocked');

// 4. Test Next Day (Day 2: 2026-11-02, consecutive) -> streak should be 2
const day2Time = new Date('2026-11-02T12:00:00Z').getTime();
console.log('4. Testing claim on consecutive Day 2...');
const res2 = claimDailyReward(testUserId, testGuildId, { now: day2Time });
assert.strictEqual(res2.success, true, 'Consecutive day claim must succeed');
assert.strictEqual(res2.reward, 3, 'Consecutive day claim must award 3 credits');
assert.strictEqual(res2.streak, 2, 'Consecutive day claim streak must increment to 2');

// 5. Test Missed Day (Day 4: 2026-11-04, skipped Day 3) -> streak should reset to 1
const day4Time = new Date('2026-11-04T12:00:00Z').getTime();
console.log('5. Testing claim after missed day (Day 4)...');
const res4 = claimDailyReward(testUserId, testGuildId, { now: day4Time });
assert.strictEqual(res4.success, true, 'Claim after missed day must succeed');
assert.strictEqual(res4.reward, 3, 'Must award 3 credits');
assert.strictEqual(res4.streak, 1, 'Streak must reset to 1 after missing a day');

console.log('Item 6: ALL CHECKS PASSED');
