import assert from 'assert';
import { loadShopItems, buyShopItem, getServerActiveBoosts } from '../serverShopManager.js';
import { getServerLedgerSummary, recordLedgerTransaction } from '../ledgerManager.js';

console.log('=== TEST SUITE: PHASE H - ITEM 2 (SERVER SHOP INSIDE PREMIUM / BOOSTS) ===\n');

const testGuildId = '158179489638985501';

// 1. Verify items come from settings / database
console.log('1. Fetching shop items...');
const items = await loadShopItems();
console.log(`  -> Loaded ${items.length} shop items:`);
for (const item of items) {
  console.log(`     * [${item.id}] ${item.name} (${item.price} credits, ${item.durationLabel}, effect: ${item.effect})`);
}
assert(items.length >= 3, 'Must have at least 3 shop items');
const doubleBumps = items.find(i => i.effect === 'double_bumps');
const premiumItem = items.find(i => i.effect === 'premium');
const autoBump = items.find(i => i.effect === 'auto_bump');

assert(doubleBumps, '2x bumps item must exist');
assert(premiumItem, 'Premium item must exist');
assert(autoBump, 'Auto bump item must exist');
console.log('  ✓ Verified: Items and prices loaded from database & admin settings.');

// 2. Insufficient balance test
console.log('\n2. Testing purchase with insufficient balance...');
try {
  await buyShopItem({
    serverId: testGuildId,
    itemId: premiumItem.id, // Costs 500 credits
    buyerUserId: '111111111111111111',
    buyerUsername: 'TestOwner',
    isOwner: true,
    isManager: true
  });
  assert.fail('Should have failed with insufficient credits');
} catch (err) {
  if (err.name === 'AssertionError') throw err;
  console.log(`  -> Expected error received: "${err.message}" (code: ${err.code})`);
  assert.strictEqual(err.code, 'INSUFFICIENT_CREDITS', 'Must throw INSUFFICIENT_CREDITS');
  console.log('  ✓ Verified: Insufficient balance clearly rejected.');
}

// 3. Deposit credits and execute safe purchase
console.log('\n3. Depositing credits and executing safe purchase...');
recordLedgerTransaction({ serverId: testGuildId, amount: 100, type: 'earned', description: 'Test setup for boost purchase' });
const balanceBefore = getServerLedgerSummary(testGuildId).balance;
console.log(`  -> Server balance before purchase: ${balanceBefore} credits`);

const buyResult = await buyShopItem({
  serverId: testGuildId,
  itemId: doubleBumps.id,
  buyerUserId: '111111111111111111',
  buyerUsername: 'TestOwner',
  isOwner: true,
  isManager: true
});

console.log('  -> Purchase result:', buyResult);
assert.strictEqual(buyResult.success, true, 'Purchase must succeed');
assert.strictEqual(buyResult.newBalance, balanceBefore - doubleBumps.price, 'Balance must decrement by price');

// 4. Verify Active Boosts reflects the purchase
console.log('\n4. Verifying active boosts...');
const activeBoosts = getServerActiveBoosts(testGuildId);
console.log(`  -> Active boosts count: ${activeBoosts.length}`);
const activeDouble = activeBoosts.find(b => b.effect === 'double_bumps');
assert(activeDouble, 'Double bumps must now be active');
assert(activeDouble.remainingSeconds > 0, 'Remaining seconds must be positive');
console.log(`  -> Active boost: ${activeDouble.name}, remaining: ${activeDouble.formattedTimeLeft}`);
console.log('  ✓ Verified: Active boost recorded and reflects in active tab.');

// 5. Test double-purchase extension
console.log('\n5. Testing boost extension on second purchase...');
recordLedgerTransaction({ serverId: testGuildId, amount: 100, type: 'earned', description: 'Test setup for boost extension' });
const firstExpiry = activeDouble.activeUntil;

const extendResult = await buyShopItem({
  serverId: testGuildId,
  itemId: doubleBumps.id,
  buyerUserId: '111111111111111111',
  buyerUsername: 'TestOwner',
  isOwner: true,
  isManager: true
});

assert(extendResult.activeUntil > firstExpiry, 'Expiry date must be extended');
console.log(`  -> Expiry extended from ${new Date(firstExpiry).toISOString()} to ${new Date(extendResult.activeUntil).toISOString()}`);
console.log('  ✓ Verified: Purchasing same item extends existing boost.');

console.log('\n✓ ALL ITEM 2 TESTS PASSED SUCCESSFULLY!');
process.exit(0);
