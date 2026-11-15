import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createJoinIntent,
  findActiveJoinIntent
} from '../inviteValidator.js';
import {
  loadDirectoryData,
  saveDirectoryData,
  recordBotMemberJoin,
  recordBotMemberLeave,
  processMaturePendingJoins,
  loadPendingJoins,
  savePendingJoins,
  getUserCredits
} from '../directoryManager.js';
import { getUserLedgerSummary } from '../ledgerManager.js';

async function run() {
  console.log('--- Testing Join Credits Verification & Invariants ---');

  // Setup mock server in directory
  const testServerId = '999900001111222233';
  const testOwnerId = '888800001111222233';
  const testUserId = '777700001111222233';
  const testUserId2 = '666600001111222233';

  const dirData = loadDirectoryData();
  // Clean up any test records
  dirData.servers = dirData.servers.filter(s => s.id !== testServerId);
  delete dirData.userJoins[testUserId];
  delete dirData.userJoins[testUserId2];
  delete dirData.userJoinRecords[`${testUserId}:${testServerId}`];
  delete dirData.userJoinRecords[`${testUserId2}:${testServerId}`];

  dirData.servers.push({
    id: testServerId,
    name: 'Unit Test Community',
    ownerId: testOwnerId,
    bot_in_guild: true,
    rewardCoins: 5,
    inviteUrl: 'https://discord.gg/testserver'
  });
  saveDirectoryData(dirData);

  // Clear pending joins
  savePendingJoins([]);

  // Test 1: Click Join without joining (balance unchanged)
  console.log('Test 1: Click Join creates join_intent without balance change...');
  const initialBalance = getUserLedgerSummary(testUserId).balance;
  const intent1 = createJoinIntent(testUserId, testServerId);
  assert.ok(intent1.id, 'Intent created');
  assert.strictEqual(getUserLedgerSummary(testUserId).balance, initialBalance, 'Balance remains unchanged after click Join');
  console.log('  ✓ Balance unchanged on join intent creation.');

  // Test 2: Double click produces valid active intent without balance change
  console.log('Test 2: Double click handles idempotently...');
  const intent2 = createJoinIntent(testUserId, testServerId);
  assert.ok(intent2.id, 'Second intent created');
  assert.strictEqual(getUserLedgerSummary(testUserId).balance, initialBalance, 'Balance still unchanged on second click');
  console.log('  ✓ Double click safe, zero wrongful credits.');

  // Test 3: Join then leave before minimum stay (left_early, 0 credits)
  console.log('Test 3: Member joins but leaves before 2 minutes (no credits)...');
  const pending1 = recordBotMemberJoin(testServerId, testUserId);
  assert.ok(pending1, 'Pending join recorded by bot');
  assert.strictEqual(pending1.status, 'pending', 'Status is pending');

  // User leaves early
  const left = recordBotMemberLeave(testServerId, testUserId);
  assert.strictEqual(left, true, 'Leave recorded');
  const pList = loadPendingJoins();
  const leftP = pList.find(p => p.id === pending1.id);
  assert.strictEqual(leftP.status, 'left_early', 'Status transitioned to left_early');

  // Advance time and process
  leftP.releaseAt = Date.now() - 1000;
  savePendingJoins(pList);
  await processMaturePendingJoins(null);

  assert.strictEqual(getUserLedgerSummary(testUserId).balance, initialBalance, 'Balance remains 0 after leaving early');
  console.log('  ✓ Left early before stay: no credits awarded.');

  // Test 4: Join and stay (credits paid once)
  console.log('Test 4: Member joins and stays minimum duration (paid once)...');
  // Re-create intent for fresh join
  createJoinIntent(testUserId, testServerId);
  const pending2 = recordBotMemberJoin(testServerId, testUserId);
  assert.ok(pending2, 'New pending join created');

  // Fast forward releaseAt past 2 minutes
  const pList2 = loadPendingJoins();
  const matureP = pList2.find(p => p.id === pending2.id);
  matureP.releaseAt = Date.now() - 1000;
  savePendingJoins(pList2);

  // Process mature join
  const result = await processMaturePendingJoins(null);
  assert.strictEqual(result.awarded, 1, 'One join awarded');
  assert.strictEqual(getUserLedgerSummary(testUserId).balance, initialBalance + 5, 'User credited +5 credits after verified stay');

  // Re-process: must not award twice
  const result2 = await processMaturePendingJoins(null);
  assert.strictEqual(result2.awarded, 0, 'Does not re-award');
  assert.strictEqual(getUserLedgerSummary(testUserId).balance, initialBalance + 5, 'Balance strictly unchanged on subsequent cycles');
  console.log('  ✓ Verified stay credited exactly once.');

  // Test 5: Bot absent (bot_in_guild: false) -> no credits
  console.log('Test 5: Bot absent from server -> no credits recorded...');
  const absentServerId = '999900001111222244';
  const dirData2 = loadDirectoryData();
  dirData2.servers.push({
    id: absentServerId,
    name: 'Absent Bot Server',
    ownerId: testOwnerId,
    bot_in_guild: false,
    rewardCoins: 5
  });
  saveDirectoryData(dirData2);

  createJoinIntent(testUserId2, absentServerId);
  const absentJoin = recordBotMemberJoin(absentServerId, testUserId2);
  assert.strictEqual(absentJoin, null, 'Cannot record bot join when bot_in_guild is false');
  console.log('  ✓ Bot absent: join tracking refused.');

  // Test 6: Server owner cannot earn on their own server
  console.log('Test 6: Server owner cannot earn on their own server...');
  createJoinIntent(testOwnerId, testServerId);
  const ownerJoin = recordBotMemberJoin(testServerId, testOwnerId);
  assert.strictEqual(ownerJoin, null, 'Server owner cannot earn credits for own server');
  console.log('  ✓ Server owner blocked from earning credits.');

  // Cleanup test servers
  const cleanDir = loadDirectoryData();
  cleanDir.servers = cleanDir.servers.filter(s => s.id !== testServerId && s.id !== absentServerId);
  saveDirectoryData(cleanDir);

  console.log('✓ All 6 Join Credits tests passed successfully!\n');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

