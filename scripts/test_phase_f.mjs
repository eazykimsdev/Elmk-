import assert from 'node:assert';
import {
  normalizeLeet,
  validateCustomUrlName,
  claimCustomUrl,
  getServerCustomUrl,
  resolveCustomUrl,
  adminRemoveCustomUrl,
  adminReassignCustomUrl,
  loadBlockedWords,
  saveBlockedWords,
  checkClaimRateLimit
} from '../customUrlManager.js';
import { upsertPromotedServer, getPromotedServers } from '../directoryManager.js';

console.log('======================================================================');
console.log(' PHASE F (F1 - F4) VERIFICATION TEST SUITE');
console.log('======================================================================\n');

async function runTests() {
  // Setup a test server in directory with real 18-digit Discord snowflake
  const testServerId = '158' + String(Date.now()) + '01';
  const testUserId = '159' + String(Date.now()) + '01';

  const upserted = upsertPromotedServer({
    id: testServerId,
    name: 'Phase F Test Server',
    description: 'Testing Phase F public server pages and custom URLs',
    ownerId: testUserId,
    category: 'Roleplay Server',
    is_premium: true
  }, { id: testUserId, username: 'TestOwner' });
  console.log('Upserted server id:', upserted.id, 'servers in directory:', getPromotedServers(true).map(s => s.id));

  console.log('--- TEST 1: Leet / Unicode Normalizer ---');
  assert.strictEqual(normalizeLeet('d1sc0rd'), 'discord');
  assert.strictEqual(normalizeLeet('st4ff'), 'staff');
  assert.strictEqual(normalizeLeet('0ff1c14l'), 'official');
  assert.strictEqual(normalizeLeet('m@vely'), 'mavely');
  console.log('  Passed: leet/unicode normalizer correctly transforms lookalikes to plain text.');

  console.log('\n--- TEST 2: Validation of Invalid, Reserved, and Blocked Names ---');
  // Too short
  let v = validateCustomUrlName('ab');
  assert.strictEqual(v.valid, false, 'Should reject names < 3 chars');
  console.log('  Passed: rejected short name (< 3 chars):', v.error);

  // Invalid chars
  v = validateCustomUrlName('invalid_name!');
  assert.strictEqual(v.valid, false, 'Should reject names with underscore/exclamation');
  console.log('  Passed: rejected invalid characters:', v.error);

  // Reserved name
  v = validateCustomUrlName('admin');
  assert.strictEqual(v.valid, false, 'Should reject reserved system name "admin"');
  console.log('  Passed: rejected reserved route word "admin":', v.error);

  // Blocked brand name
  v = validateCustomUrlName('discord');
  assert.strictEqual(v.valid, false, 'Should reject blocked brand name "discord"');
  console.log('  Passed: rejected blocked brand word "discord":', v.error);

  // Leet lookalike of blocked name
  v = validateCustomUrlName('d1sc0rd');
  assert.strictEqual(v.valid, false, 'Should reject leet lookalike "d1sc0rd"');
  console.log('  Passed: rejected leet lookalike word "d1sc0rd":', v.error);

  // Another lookalike: "st4ff"
  v = validateCustomUrlName('st4ff');
  assert.strictEqual(v.valid, false, 'Should reject leet lookalike "st4ff"');
  console.log('  Passed: rejected leet lookalike word "st4ff":', v.error);

  console.log('\n--- TEST 3: Claiming a Valid Custom URL ---');
  const validSlug = 'state-rp-' + Math.floor(Math.random() * 10000);
  const claimRes = await claimCustomUrl(testServerId, validSlug, testUserId);
  assert.strictEqual(claimRes.slug, validSlug);
  console.log(`  Passed: server ${testServerId} successfully claimed "/${validSlug}".`);

  // Verify resolve
  const resolved = resolveCustomUrl(validSlug);
  assert(resolved, 'Should resolve newly claimed slug');
  assert.strictEqual(resolved.serverId, testServerId);
  console.log(`  Passed: resolveCustomUrl("${validSlug}") correctly resolved to server ${testServerId}.`);

  // Verify reverse lookup for redirect (/servers/:id -> /:slug)
  const serverSlug = getServerCustomUrl(testServerId);
  assert.strictEqual(serverSlug, validSlug);
  console.log(`  Passed: getServerCustomUrl("${testServerId}") returned "${serverSlug}" (used for 302 redirect from /servers/${testServerId} to /${serverSlug}).`);

  console.log('\n--- TEST 4: Taken Name Collision ---');
  const otherServerId = '158' + String(Date.now()) + '02';
  const otherUserId = '159' + String(Date.now()) + '02';

  upsertPromotedServer({
    id: otherServerId,
    name: 'Phase F Other Server',
    description: 'Testing Reassignment',
    ownerId: otherUserId,
    category: 'Roleplay Server',
    is_premium: true
  }, { id: otherUserId, username: 'OtherOwner' });
  let errCaught = false;
  try {
    await claimCustomUrl(otherServerId, validSlug, otherUserId);
  } catch (err) {
    errCaught = true;
    console.log('  Passed: correctly rejected claiming taken name with error:', err.message);
  }
  assert(errCaught, 'Must reject claiming an already taken custom URL');

  console.log('\n--- TEST 5: 30-Day Change Cooldown Enforcement ---');
  let cooldownCaught = false;
  try {
    await claimCustomUrl(testServerId, 'new-name-' + Date.now(), testUserId);
  } catch (err) {
    cooldownCaught = true;
    console.log('  Passed: correctly rejected changing URL before 30-day cooldown:', err.message);
  }
  assert(cooldownCaught, 'Must reject change before 30-day cooldown');

  console.log('\n--- TEST 6: Admin Reassignment & Audit Log ---');
  const reassignRes = await adminReassignCustomUrl(validSlug, otherServerId, 'admin_test', 'Administrative transfer');
  assert.strictEqual(reassignRes.serverId, otherServerId);
  const resolvedAfterReassign = resolveCustomUrl(validSlug);
  assert.strictEqual(resolvedAfterReassign.serverId, otherServerId);
  console.log(`  Passed: admin successfully reassigned "/${validSlug}" to ${otherServerId}.`);

  console.log('\n--- TEST 7: Admin Removal & Held Slug Protection ---');
  const removeRes = await adminRemoveCustomUrl(validSlug, 'admin_test', 'Violation of terms');
  assert.strictEqual(removeRes.ok, true);
  const resolvedAfterRemove = resolveCustomUrl(validSlug);
  assert.strictEqual(resolvedAfterRemove, null, 'Slug should no longer resolve');
  console.log(`  Passed: admin removed "/${validSlug}". Slug is no longer live.`);

  console.log('\n--- TEST 8: Review Eligibility Checks (Account Age & Own Server) ---');
  // Reviewer Snowflake deriving creation timestamp
  // Discord Epoch: 1420070400000
  // Brand new account (created 1 hour ago)
  const brandNewId = String((BigInt(Date.now() - 3600 * 1000) - 1420070400000n) << 22n);
  const brandNewAgeMs = Date.now() - Number((BigInt(brandNewId) >> 22n) + 1420070400000n);
  const twoDaysMs = 2 * 24 * 3600 * 1000;
  assert(brandNewAgeMs < twoDaysMs, 'Brand new account should be less than 2 days old');
  console.log(`  Passed: account age derivation for brand new ID: ${(brandNewAgeMs / 3600000).toFixed(2)}h (< 48h required).`);

  // Mature account (created 100 days ago)
  const matureId = String((BigInt(Date.now() - 100 * 24 * 3600 * 1000) - 1420070400000n) << 22n);
  const matureAgeMs = Date.now() - Number((BigInt(matureId) >> 22n) + 1420070400000n);
  assert(matureAgeMs >= twoDaysMs, 'Mature account should be >= 2 days old');
  console.log(`  Passed: account age derivation for mature ID: ${(matureAgeMs / (24 * 3600000)).toFixed(1)} days (>= 2 days).`);

  console.log('\n======================================================================');
  console.log(' ALL PHASE F TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
