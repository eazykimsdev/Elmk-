import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServerLedgerSummary, loadLedgerData, saveLedgerData } from '../ledgerManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export async function executeCreditReset() {
  console.log('='.repeat(80));
  console.log('EXECUTING BALANCE RESET (ONE-TIME ADJUSTMENT)');
  console.log('='.repeat(80));

  // 1. Copy ledger table first (backup)
  const ledgerFile = path.join(rootDir, 'data', 'ledger.json');
  const backupFile = path.join(rootDir, 'data', `ledger_backup_before_reset_${Date.now()}.json`);
  fs.copyFileSync(ledgerFile, backupFile);
  console.log(`[BACKUP] Saved backup copy of ledger to: ${backupFile}`);

  // 2. Load directory & seeds
  const dirFile = path.join(rootDir, 'data', 'promoted_servers.json');
  const dirData = JSON.parse(fs.readFileSync(dirFile, 'utf8') || '{}');
  const servers = dirData.servers || [];

  const seedFile = path.join(rootDir, 'seeds', 'promoted_servers.json');
  let seedIds = new Set();
  if (fs.existsSync(seedFile)) {
    try {
      const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf8') || '{}');
      (seedData.servers || []).forEach((s) => seedIds.add(String(s.id)));
    } catch {}
  }

  const ledger = loadLedgerData();
  const transactions = ledger.transactions || [];

  const testUserIds = new Set([
    '777700001111222233',
    '991122334455667790',
    '992772662166254259',
    '992744059029174187',
    '155999999999999004',
    '1535998488456859678',
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
    '1530147023754367001',
    '1530147023754367002',
    '1530147023754367099',
  ]);

  const realServers = servers.filter((s) => !testGuildIds.has(String(s.id)) && !s.id.startsWith('test_') && !s.id.startsWith('guild_claim_'));

  let totalBefore = 0;
  let totalAfter = 0;
  const now = Date.now();
  let adjustmentsCount = 0;

  for (const server of realServers) {
    const sid = String(server.id);
    const summary = getServerLedgerSummary(sid);
    const currentBalance = summary.balance;
    totalBefore += currentBalance;

    const baseCredits = 30;
    const bumpCount = Number(server.bumps || 0);
    const bumpCredits = bumpCount * 2;

    const joinCredits = transactions
      .filter((tx) => (String(tx.guildId) === sid || String(tx.serverId) === sid) && (tx.reason === 'verified_join' || tx.reason === 'join') && !testUserIds.has(String(tx.userId)) && tx.type === 'earned')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const bugCredits = transactions
      .filter((tx) => (String(tx.guildId) === sid || String(tx.serverId) === sid) && String(tx.reason || '').toLowerCase().includes('bug report') && !testUserIds.has(String(tx.userId)) && tx.type === 'earned')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const giveawayCredits = transactions
      .filter((tx) => (String(tx.guildId) === sid || String(tx.serverId) === sid) && tx.reason === 'giveaway code' && tx.type === 'earned')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const spentCredits = transactions
      .filter((tx) => (String(tx.guildId) === sid || String(tx.serverId) === sid) && (tx.type === 'spent' || tx.type === 'deducted') && !testUserIds.has(String(tx.userId)))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const fairBalance = baseCredits + bumpCredits + joinCredits + bugCredits + giveawayCredits - spentCredits;
    const diff = fairBalance - currentBalance;

    if (diff !== 0) {
      const isDeduction = diff < 0;
      const amount = Math.abs(diff);
      const adjTx = {
        id: `tx_${now}_reset_${sid}`,
        userId: `guild_${sid}`,
        timestamp: now,
        type: isDeduction ? 'spent' : 'earned',
        amount: amount,
        balanceAfter: fairBalance,
        reason: 'balance reset',
        description: `Balance reset adjustment: ${diff > 0 ? '+' : '-'}${amount} cr (Fair balance: ${fairBalance} cr)`,
        guildId: sid,
        serverId: sid,
        guildName: server.name,
        guildIconUrl: server.icon || server.iconUrl || null,
        triggeredBy: 'System Balance Reset',
        status: 'posted',
        relatedTxId: null,
      };
      ledger.transactions.push(adjTx);
      adjustmentsCount++;
    }

    server.balance = fairBalance;
    server.credits = fairBalance;
    totalAfter += fairBalance;
  }

  saveLedgerData(ledger);
  fs.writeFileSync(dirFile, JSON.stringify(dirData, null, 2), 'utf8');

  console.log(`[DONE] Added ${adjustmentsCount} append-only "balance reset" adjustments.`);
  console.log(`[TOTALS] Total Before: ${totalBefore} cr | Total After: ${totalAfter} cr (Net: ${totalAfter - totalBefore} cr)`);
  console.log('='.repeat(80));
}

// Only run if executed directly with CLI flag --execute
if (process.argv.includes('--execute')) {
  executeCreditReset();
}
