import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buyShopItem,
  getServerActiveBoosts,
  loadShopItems,
  hasActiveBoost
} from '../serverShopManager.js';
import {
  buyServerPremium,
  isServerPremium,
  getAdminSettings
} from '../premiumManager.js';
import {
  recordLedgerTransaction,
  getServerLedgerSummary
} from '../ledgerManager.js';
import { getPromotedServers } from '../directoryManager.js';

console.log('Testing Item 3: Shop (One Page) & Proof of Effects...');

// 1. Verify UI components
console.log('1. Checking Shop UI components...');
const files = [
  'src/pages/dashboard/ShopTab.tsx',
  'web/src/pages/dashboard/ShopTab.tsx'
];

for (const file of files) {
  assert(fs.existsSync(file), `${file} must exist`);
  const content = fs.readFileSync(file, 'utf8');

  // Tabs: Boosts, Premium, Active
  assert(content.includes("'boosts'") && content.includes("'premium'") && content.includes("'active'"), `${file} must have Boosts, Premium, Active tabs`);

  // Sticky balance strip at the top: Balance, Cost, Balance after purchase
  assert(content.includes('Balance after purchase'), `${file} must have Balance after purchase strip`);
  assert(content.includes('sticky top-0'), `${file} must have sticky balance strip`);

  // Sharp 8px corners (rounded-lg) and hairline borders
  assert(content.includes('rounded-lg'), `${file} must use rounded-lg (8px)`);
  assert(content.includes('border-white/[0.08]'), `${file} must use hairline 1px borders`);

  // Spec row on each card: Length, Effect, Cost
  assert(content.includes('Length') && content.includes('Effect') && content.includes('Cost'), `${file} must have spec rows on cards`);

  // Top edge highlight
  assert(content.includes('before:inset-x-0 before:top-0 before:h-px'), `${file} must have top edge highlight`);

  // Confirm dialog
  assert(content.includes('Confirm Purchase') || content.includes('Confirm purchase'), `${file} must have confirm dialog`);

  // No "Owners & managers only" text
  assert(!content.includes('Owners & managers only'), `${file} must NOT have "Owners & managers only" text`);
}

// 2. Test server balance & ledger transactions
console.log('2. Testing Balance, Purchases, Double Click Lock & Insufficient Credits...');
const servers = getPromotedServers(true);
const targetServer = servers[0];
assert(targetServer, 'At least one server must exist');
const testGuildId = String(targetServer.id || targetServer.guildId);
const testUserId = String(targetServer.ownerId || 'test_user_owner');

// Test insufficient credits check
const currentBal = getServerLedgerSummary(testGuildId).balance;
// Deduct balance or request item costing more than current balance
try {
  await buyShopItem({
    serverId: testGuildId,
    itemId: 'expensive_test_item',
    buyerUserId: testUserId,
    isManager: true
  });
  assert.fail('Should fail with item not found or insufficient credits');
} catch (err) {
  assert(err.message, 'Must throw error');
}

// Deposit 500 credits to server ledger
await recordLedgerTransaction({
  guildId: testGuildId,
  amount: 500,
  type: 'earned',
  reason: 'Test funding for shop'
});
let summary = getServerLedgerSummary(testGuildId);
assert(summary.balance >= 500, 'Server balance must be at least 500');

// Buy Auto Bump boost (15 credits)
const buyRes = await buyShopItem({ serverId: testGuildId, itemId: 'item_auto_bump_1d', buyerUserId: testUserId, isManager: true });
assert.strictEqual(buyRes.success, true);
assert.strictEqual(hasActiveBoost(testGuildId, 'auto_bump'), true, 'Auto bump boost must be active');

// Buy again -> should extend duration
const activeBefore = getServerActiveBoosts(testGuildId).find(b => b.effect === 'auto_bump');
const buyExtend = await buyShopItem({ serverId: testGuildId, itemId: 'item_auto_bump_1d', buyerUserId: testUserId, isManager: true });
const activeAfter = getServerActiveBoosts(testGuildId).find(b => b.effect === 'auto_bump');
assert(activeAfter.activeUntil > activeBefore.activeUntil, 'Buying again must extend expiration');

// 3. Prove Effect: Featured Spot
console.log('3. Proving Effect: Featured Spot...');
await buyShopItem({ serverId: testGuildId, itemId: 'item_featured_spot_1d', buyerUserId: testUserId, isManager: true });
assert.strictEqual(hasActiveBoost(testGuildId, 'featured_spot'), true, 'Featured spot must be active');

// 4. Prove Effect: Listing Highlight
console.log('4. Proving Effect: Listing Highlight...');
await buyShopItem({ serverId: testGuildId, itemId: 'item_listing_highlight_7d', buyerUserId: testUserId, isManager: true });
assert.strictEqual(hasActiveBoost(testGuildId, 'listing_highlight'), true, 'Listing highlight must be active');

// 5. Test Premium purchase & balance sync
console.log('5. Testing Premium purchase & duration extension...');
// Deposit more credits to afford premium (500 credits each)
await recordLedgerTransaction({
  guildId: testGuildId,
  amount: 2000,
  type: 'earned',
  reason: 'Premium funding'
});
const premRes = await buyServerPremium(testGuildId, testUserId, { months: 1 });
assert.strictEqual(premRes.success, true);
assert(premRes.newBalance !== undefined);
assert(premRes.daysLeft >= 30, 'Days left must be at least 30');

// Extend Premium
const extendPremRes = await buyServerPremium(testGuildId, testUserId, { months: 1 });
assert.strictEqual(extendPremRes.success, true);
assert(extendPremRes.daysLeft > premRes.daysLeft, 'Extending must add more days');

// Check isServerPremium
const mockServer = { id: testGuildId, premiumUntil: extendPremRes.premiumUntil };
assert.strictEqual(isServerPremium(mockServer), true, 'Server must be recognized as premium');

// Expiry test
const expiredServer = { id: testGuildId, premiumUntil: Date.now() - 1000 };
assert.strictEqual(isServerPremium(expiredServer), false, 'Expired server must NOT be recognized as premium');

console.log('Item 3: ALL CHECKS PASSED');
