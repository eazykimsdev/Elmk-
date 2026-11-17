import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServerLedgerSummary, loadLedgerData } from '../ledgerManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Load directory servers
const dirFile = path.join(rootDir, 'data', 'promoted_servers.json');
const dirData = JSON.parse(fs.readFileSync(dirFile, 'utf8') || '{}');
const servers = dirData.servers || [];

// 2. Load seed servers to identify migrated servers from old site
const seedFile = path.join(rootDir, 'seeds', 'promoted_servers.json');
let seedIds = new Set();
if (fs.existsSync(seedFile)) {
  try {
    const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf8') || '{}');
    (seedData.servers || []).forEach((s) => seedIds.add(String(s.id)));
  } catch (err) {
    console.error('Error reading seeds:', err);
  }
}

// 3. Load ledger data
const ledger = loadLedgerData();
const transactions = ledger.transactions || [];

// Identify test / fake IDs to ignore
const testUserIds = new Set([
  '777700001111222233',
  '991122334455667790',
  '992772662166254259',
  '992744059029174187',
  '155999999999999004',
  '1535998488456859678', // Personal wallet admin adjustment tests
]);

const testGuildIds = new Set([
  '999900001111222233',
  '888811112222333344',
  '1999888777666555443',
  '1999888777666555442',
  '1999111222333444555',
  '1999222333444555666',
  '155999999999999002',
  '155999999999999010',
  '155999999999999020',
  '1530147023754367001', // Synthetic test guild created in unit test
  '1530147023754367002', // Synthetic test guild created in unit test
  '1530147023754367099', // Synthetic test guild created in unit test
]);

// Filter legitimate directory servers (excluding synthetic test-only guilds)
const realServers = servers.filter((s) => !testGuildIds.has(String(s.id)) && !s.id.startsWith('test_') && !s.id.startsWith('guild_claim_'));

// 4. Compute fair balance for each server
const results = realServers.map((server) => {
  const sid = String(server.id);
  const isMigrated = seedIds.has(sid);

  // Current balance from ledger summary
  const summary = getServerLedgerSummary(sid);
  const currentBalance = summary.balance;

  // Formula:
  // 30 base credits
  const baseCredits = 30;

  // Plus 2 credits for every real bump
  const bumpCount = Number(server.bumps || 0);
  const bumpCredits = bumpCount * 2;

  // Plus confirmed join rewards (earned by or credited to this server, excluding test accounts)
  const joinTxs = transactions.filter((tx) => {
    const isThisServer = (String(tx.guildId) === sid || String(tx.serverId) === sid);
    const isJoinReason = tx.reason === 'verified_join' || tx.reason === 'join';
    const isRealUser = !testUserIds.has(String(tx.userId));
    return isThisServer && isJoinReason && isRealUser && tx.type === 'earned';
  });
  const joinCredits = joinTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  // Plus accepted bug report rewards
  const bugTxs = transactions.filter((tx) => {
    const isThisServer = (String(tx.guildId) === sid || String(tx.serverId) === sid);
    const isBugReason = String(tx.reason || '').toLowerCase().includes('bug report');
    const isRealUser = !testUserIds.has(String(tx.userId));
    return isThisServer && isBugReason && isRealUser && tx.type === 'earned';
  });
  const bugCredits = bugTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  // Plus giveaway code credits
  const giveawayTxs = transactions.filter((tx) => {
    const isThisServer = (String(tx.guildId) === sid || String(tx.serverId) === sid);
    const isGiveaway = tx.reason === 'giveaway code';
    return isThisServer && isGiveaway && tx.type === 'earned';
  });
  const giveawayCredits = giveawayTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  // Minus what the server really spent (partnerships, ads, etc.)
  const spentTxs = transactions.filter((tx) => {
    const isThisServer = (String(tx.guildId) === sid || String(tx.serverId) === sid);
    const isRealUser = !testUserIds.has(String(tx.userId));
    return isThisServer && (tx.type === 'spent' || tx.type === 'deducted') && isRealUser;
  });
  const spentCredits = spentTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  // Compute fair balance
  const fairBalance = baseCredits + bumpCredits + joinCredits + bugCredits + giveawayCredits - spentCredits;
  const difference = fairBalance - currentBalance;

  const breakdown = `30 base + ${bumpCredits} bumps (${bumpCount}x2) + ${joinCredits} joins + ${bugCredits} bugs + ${giveawayCredits} codes - ${spentCredits} spent`;

  return {
    id: sid,
    name: server.name,
    currentBalance,
    fairBalance,
    difference,
    breakdown,
    isMigrated,
    bumpCount,
    bumpCredits,
    joinCredits,
    bugCredits,
    giveawayCredits,
    spentCredits,
  };
});

// Sort by absolute difference descending
results.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

console.log('='.repeat(100));
console.log('PREVIEW CREDIT RESET (READ-ONLY - NO CHANGES MADE)');
console.log('='.repeat(100));
console.log(`Total real servers evaluated: ${results.length}`);
console.log(`Migrated servers from old site: ${results.filter((r) => r.isMigrated).length}`);
console.log('');
console.log('TOP 20 BIGGEST DISCREPANCIES / CHANGES:');
console.log('-'.repeat(100));
console.log(
  'Server Name'.padEnd(34) +
  'ID'.padEnd(20) +
  'Current'.padStart(8) +
  'Fair'.padStart(8) +
  'Diff'.padStart(8) +
  '  Migrated?  ' +
  'Breakdown'
);
console.log('-'.repeat(100));

const top20 = results.slice(0, 20);
for (const r of top20) {
  const nameTrunc = r.name.length > 32 ? r.name.slice(0, 31) + '…' : r.name;
  const diffStr = (r.difference > 0 ? `+${r.difference}` : `${r.difference}`);
  console.log(
    nameTrunc.padEnd(34) +
    r.id.padEnd(20) +
    String(r.currentBalance).padStart(8) +
    String(r.fairBalance).padStart(8) +
    diffStr.padStart(8) +
    (r.isMigrated ? '  [OLD SITE] ' : '  [NEW]      ') +
    r.breakdown
  );
}
console.log('-'.repeat(100));

const totalCurrent = results.reduce((acc, r) => acc + r.currentBalance, 0);
const totalFair = results.reduce((acc, r) => acc + r.fairBalance, 0);
const netDifference = totalFair - totalCurrent;

console.log('');
console.log(`TOTAL CURRENT BALANCE ACROSS ALL SERVERS: ${totalCurrent} credits`);
console.log(`TOTAL FAIR BALANCE ACROSS ALL SERVERS:    ${totalFair} credits`);
console.log(`NET TOTAL ADJUSTMENT REQUIRED:            ${netDifference > 0 ? `+${netDifference}` : netDifference} credits`);
console.log('');
console.log('CONFIRMATION SAFETY NOTICE:');
console.log('Zero modifications were made to data/ledger.json or PostgreSQL.');
console.log('To perform the atomic balance reset transaction, await user "OK".');
console.log('='.repeat(100));
