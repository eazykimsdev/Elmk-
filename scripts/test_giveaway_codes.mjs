/**
 * Verification Script for D5: Giveaway Codes
 * 
 * Tests:
 * 1. Valid code redemption
 * 2. Wrong code rejection
 * 3. Expired code rejection
 * 4. Used twice by same server rejection
 * 5. Last spot redemption and subsequent exhaustion
 * 6. Two at once concurrency test (two servers race for the last 1 spot)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGiveawayCode,
  redeemGiveawayCode,
  getGiveawayCodes,
  getGiveawayRedemptions
} from '../giveawayCodeManager.js';
import { loadDirectoryData, saveDirectoryData } from '../directoryManager.js';

console.log('=== Running D5 Giveaway Codes Verification Suite ===\n');

// Set up mock directory servers for testing with valid 18-digit Discord snowflakes
const dir = loadDirectoryData();
const testServer1 = {
  id: '1530147023754367001',
  guildId: '1530147023754367001',
  name: 'Alpha State Roleplay',
  ownerId: '523693281541095401',
  category: 'Roleplay Server',
  description: 'A great roleplay community with custom cars and events.',
  inviteUrl: 'https://discord.gg/alpha-rp',
  isListed: true,
  credits: 50,
  balance: 50
};

const testServer2 = {
  id: '1530147023754367002',
  guildId: '1530147023754367002',
  name: 'Bravo Police Dept',
  ownerId: '523693281541095402',
  category: 'Departments',
  description: 'Active police department division with weekly patrol shifts.',
  inviteUrl: 'https://discord.gg/bravo-dept',
  isListed: true,
  credits: 30,
  balance: 30
};

const testServer3 = {
  id: '1530147023754367003',
  guildId: '1530147023754367003',
  name: 'Charlie Events Community',
  ownerId: '523693281541095403',
  category: 'Events',
  description: 'Regular community meetups, shows, and organized roleplay events.',
  inviteUrl: 'https://discord.gg/charlie-events',
  isListed: true,
  credits: 40,
  balance: 40
};

// Add test servers if not present
const existingIds = new Set(dir.servers.map(s => String(s.id || s.guildId)));
if (!existingIds.has(testServer1.id)) dir.servers.push(testServer1);
if (!existingIds.has(testServer2.id)) dir.servers.push(testServer2);
if (!existingIds.has(testServer3.id)) dir.servers.push(testServer3);
saveDirectoryData(dir);

async function runTests() {
  // Test 1: Valid Code
  console.log('[Test 1] Valid Giveaway Code:');
  const code1 = await createGiveawayCode({
    code: `VALID_${Date.now()}`,
    amount: 100,
    maxUses: 10
  });
  console.log(`  Created code: ${code1.code} (${code1.amount} cr, max ${code1.maxUses} uses)`);

  const res1 = await redeemGiveawayCode({
    code: code1.code,
    serverId: testServer1.id,
    userId: testServer1.ownerId,
    username: 'TestOwner1'
  });
  console.log('  Redeem result:', res1);
  assert.strictEqual(res1.success, true, 'Valid code must redeem successfully');
  assert.strictEqual(res1.amount, 100, 'Amount must match code amount');
  console.log('  ✓ Valid code redeemed successfully.\n');

  // Test 2: Wrong Code
  console.log('[Test 2] Wrong Giveaway Code:');
  const res2 = await redeemGiveawayCode({
    code: 'DEFINITELY_WRONG_CODE_999',
    serverId: testServer1.id,
    userId: testServer1.ownerId,
    username: 'TestOwner1'
  });
  console.log('  Redeem result:', res2);
  assert.strictEqual(res2.success, false, 'Wrong code must fail');
  assert.match(res2.error, /invalid/i, 'Error message must specify code is invalid');
  console.log('  ✓ Wrong code rejected cleanly.\n');

  // Test 3: Expired Code
  console.log('[Test 3] Expired Giveaway Code:');
  const code3 = await createGiveawayCode({
    code: `EXPIRED_${Date.now()}`,
    amount: 150,
    maxUses: 10,
    expiresAt: new Date(Date.now() - 3600000).toISOString() // 1 hour in the past
  });
  const res3 = await redeemGiveawayCode({
    code: code3.code,
    serverId: testServer2.id,
    userId: testServer2.ownerId,
    username: 'TestOwner2'
  });
  console.log('  Redeem result:', res3);
  assert.strictEqual(res3.success, false, 'Expired code must fail');
  assert.match(res3.error, /expired/i, 'Error message must specify code is expired');
  console.log('  ✓ Expired code rejected cleanly.\n');

  // Test 4: Used Twice by Same Server
  console.log('[Test 4] Used Twice by Same Server:');
  const res4 = await redeemGiveawayCode({
    code: code1.code,
    serverId: testServer1.id,
    userId: testServer1.ownerId,
    username: 'TestOwner1'
  });
  console.log('  Redeem result:', res4);
  assert.strictEqual(res4.success, false, 'Second redemption by same server must fail');
  assert.match(res4.error, /already redeemed/i, 'Error must state server already redeemed');
  console.log('  ✓ Double redemption prevented.\n');

  // Test 5: Last Spot Redemption & Subsequent Exhaustion
  console.log('[Test 5] Last Spot & Code Exhaustion:');
  const code5 = await createGiveawayCode({
    code: `SPOT_${Date.now()}`,
    amount: 75,
    maxUses: 1 // Only 1 spot!
  });
  const res5a = await redeemGiveawayCode({
    code: code5.code,
    serverId: testServer2.id,
    userId: testServer2.ownerId,
    username: 'TestOwner2'
  });
  console.log('  First claim (last spot):', res5a);
  assert.strictEqual(res5a.success, true, 'First claim must claim the 1 available spot');

  const res5b = await redeemGiveawayCode({
    code: code5.code,
    serverId: testServer3.id,
    userId: testServer3.ownerId,
    username: 'TestOwner3'
  });
  console.log('  Second claim (exhausted):', res5b);
  assert.strictEqual(res5b.success, false, 'Second claim must fail after 1/1 claimed');
  assert.match(res5b.error, /maximum uses/i, 'Error must state maximum uses reached');
  console.log('  ✓ Last spot claimed and exhaustion enforced.\n');

  // Test 6: Two At Once (Concurrency Test)
  console.log('[Test 6] Two At Once (Concurrent Race for 1 Spot):');
  const code6 = await createGiveawayCode({
    code: `RACE_${Date.now()}`,
    amount: 200,
    maxUses: 1 // Only 1 spot total
  });

  const [raceRes1, raceRes2] = await Promise.all([
    redeemGiveawayCode({
      code: code6.code,
      serverId: testServer2.id,
      userId: testServer2.ownerId,
      username: 'TestOwner2'
    }),
    redeemGiveawayCode({
      code: code6.code,
      serverId: testServer3.id,
      userId: testServer3.ownerId,
      username: 'TestOwner3'
    })
  ]);

  console.log('  Competitor 1 result:', raceRes1);
  console.log('  Competitor 2 result:', raceRes2);

  const successes = [raceRes1, raceRes2].filter(r => r.success);
  const failures = [raceRes1, raceRes2].filter(r => !r.success);

  assert.strictEqual(successes.length, 1, 'Exactly one concurrent request must succeed');
  assert.strictEqual(failures.length, 1, 'Exactly one concurrent request must fail');
  console.log('  ✓ Concurrency test passed: Exactly one server secured the last spot!\n');

  console.log('=== All 6 Giveaway Code Test Scenarios Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
