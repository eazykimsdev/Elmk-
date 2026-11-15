import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createPromoCode,
  redeemPromoCode,
  resetAllPromoLimits,
  checkPromoFailureLock,
  clearPromoLock,
  normalizePromoCode
} from '../promoCodeManager.js';
import { loadDirectoryData, saveDirectoryData } from '../directoryManager.js';

async function run() {
  console.log('--- Testing Promo Codes & Failure Limiter Invariants ---');

  resetAllPromoLimits();

  const testServerId = '888811112222333344';
  const userA = '111122223333444455';
  const userB = '222233334444555566';

  // Seed test server
  const dirData = loadDirectoryData();
  dirData.servers = dirData.servers.filter(s => s.id !== testServerId);
  dirData.servers.push({
    id: testServerId,
    name: 'Promo Test Server',
    ownerId: userA,
    coOwners: [userB]
  });
  saveDirectoryData(dirData);

  // Clean codes
  const testCode = 'TESTPROMO100';
  const promoFile = path.join(process.cwd(), 'data', 'promo_codes.json');
  let codes = [];
  try {
    codes = JSON.parse(fs.readFileSync(promoFile, 'utf8') || '[]');
  } catch {}
  codes = codes.filter(c => c.code !== testCode && c.code !== 'LOWERCASE50');
  fs.writeFileSync(promoFile, JSON.stringify(codes, null, 2), 'utf8');

  // Create valid test code
  createPromoCode({
    code: testCode,
    credits: 100,
    max_uses: 10,
    per_user_limit: 5,
    actor: { username: 'Admin' }
  });

  // Test 1: First valid redeem works
  console.log('Test 1: First valid redemption succeeds...');
  const res1 = redeemPromoCode({
    code: testCode,
    serverId: testServerId,
    userId: userA,
    ip: '127.0.0.1',
    skipOwnershipCheck: true
  });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.credits, 100);
  assert.strictEqual(res1.message, `Redeemed. 100 credits were added to Promo Test Server.`);
  console.log('  ✓ First valid redeem works.');

  // Test 2: Lower case code works and normalizes
  console.log('Test 2: Lower case code works and normalizes...');
  createPromoCode({
    code: 'LOWERCASE50',
    credits: 50,
    max_uses: 10,
    per_user_limit: 5,
    actor: { username: 'Admin' }
  });
  const resLower = redeemPromoCode({
    code: 'lowercase50',
    serverId: testServerId,
    userId: userA,
    ip: '127.0.0.1',
    skipOwnershipCheck: true
  });
  assert.strictEqual(resLower.success, true);
  assert.strictEqual(resLower.credits, 50);
  console.log('  ✓ Lower case code input works perfectly.');

  // Test 3: Repeated request id (idempotency / double-click) counts only once
  console.log('Test 3: Duplicate request ID / double click counts once...');
  const reqId = 'req_test_double_submit_123';
  try {
    redeemPromoCode({
      code: 'NON_EXISTENT_CODE_XYZ',
      serverId: testServerId,
      userId: userA,
      ip: '127.0.0.1',
      requestId: reqId
    });
    assert.fail('Should fail on non-existent code');
  } catch (err) {
    assert.ok(err.message.includes('4 attempts left') || err.message.includes("isn't valid"), err.message);
  }

  // Submit same request id again
  try {
    redeemPromoCode({
      code: 'NON_EXISTENT_CODE_XYZ',
      serverId: testServerId,
      userId: userA,
      ip: '127.0.0.1',
      requestId: reqId
    });
    assert.fail('Should fail on non-existent code');
  } catch (err) {
    // Should still report 4 attempts left because request ID was repeated!
    assert.ok(err.message.includes('4 attempts left'), err.message);
  }
  console.log('  ✓ Double click handled idempotently without burning extra attempts.');

  // Test 4: 4 failures then a success resets the counter
  console.log('Test 4: 4 failures then a success resets failure counter...');
  resetAllPromoLimits();
  for (let i = 1; i <= 4; i++) {
    try {
      redeemPromoCode({
        code: `WRONG_CODE_${i}`,
        serverId: testServerId,
        userId: userA,
        ip: '127.0.0.1'
      });
      assert.fail('Expected failure');
    } catch (err) {
      assert.ok(err.message.includes(`${5 - i} attempt`), err.message);
    }
  }

  // Now redeem valid code: resets counter
  const resetRes = redeemPromoCode({
    code: testCode,
    serverId: testServerId,
    userId: userA,
    ip: '127.0.0.1',
    skipOwnershipCheck: true
  });
  assert.strictEqual(resetRes.success, true);

  // Next failure should have 4 attempts left (not locked!)
  try {
    redeemPromoCode({
      code: 'WRONG_AFTER_RESET',
      serverId: testServerId,
      userId: userA,
      ip: '127.0.0.1'
    });
    assert.fail('Expected failure');
  } catch (err) {
    assert.ok(err.message.includes('4 attempts left'), 'Reset confirmed, 4 attempts left');
  }
  console.log('  ✓ Successful redemption resets user failure counter.');

  // Test 5: 5 failures locks for 15 minutes with exact message
  console.log('Test 5: 5 failures locks account with exact countdown...');
  resetAllPromoLimits();
  for (let i = 1; i <= 4; i++) {
    try {
      redeemPromoCode({ code: `WRONG_${i}`, serverId: testServerId, userId: userA, ip: '127.0.0.1' });
    } catch {}
  }

  // 5th failure
  try {
    redeemPromoCode({ code: 'WRONG_5', serverId: testServerId, userId: userA, ip: '127.0.0.1' });
    assert.fail('Expected lock failure');
  } catch (err) {
    assert.ok(err.message.includes('Too many failed attempts'), err.message);
    assert.ok(err.message.includes('15 minute'), err.message);
  }

  // Subsequent attempt is blocked by checkPromoFailureLock
  const lockCheck = checkPromoFailureLock(userA, '127.0.0.1');
  assert.strictEqual(lockCheck.locked, true);
  assert.ok(lockCheck.remainingMinutes >= 14);
  console.log('  ✓ 5 failures correctly locks account for 15 minutes.');

  // Test 6: Two users do not affect each other
  console.log('Test 6: User A lockout does not affect User B...');
  const resB = redeemPromoCode({
    code: testCode,
    serverId: testServerId,
    userId: userB,
    ip: '10.0.0.2',
    skipOwnershipCheck: true
  });
  assert.strictEqual(resB.success, true, 'User B can redeem while User A is locked');
  console.log('  ✓ User A and User B counters strictly isolated.');

  // Test 7: Admin "Clear promo lock" unlocks user
  console.log('Test 7: Admin "Clear promo lock" unlocks User A...');
  clearPromoLock(userA, { username: 'SuperAdmin' });
  const lockAfterClear = checkPromoFailureLock(userA, '127.0.0.1');
  assert.strictEqual(lockAfterClear.locked, false, 'User A is unlocked after admin action');
  console.log('  ✓ Admin clear promo lock verified.');

  resetAllPromoLimits();
  console.log('✓ All Promo Code tests passed successfully!\n');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

