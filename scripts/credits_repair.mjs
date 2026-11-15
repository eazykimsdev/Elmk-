import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getUnverifiedJoinTransactions } from './credits_audit.mjs';
import { recordLedgerTransaction } from '../ledgerManager.js';

async function run() {
  console.log('=== ConnectingERLC Credits Repair ===\n');
  const unverified = getUnverifiedJoinTransactions();

  if (unverified.length === 0) {
    console.log('✓ No unverified join transactions found. Database ledger is mathematically verified.');
    return;
  }

  console.log(`Found ${unverified.length} unverified join transaction(s). Generating reversal rows...\n`);

  const reversed = [];

  for (const tx of unverified) {
    try {
      const reversal = recordLedgerTransaction({
        userId: tx.userId,
        type: 'spent',
        amount: tx.amount,
        reason: 'Reversal: join not verified',
        description: `Reversal: join not verified (linked to ${tx.id})`,
        guildId: tx.guildId,
        guildName: tx.guildName,
        triggeredBy: 'ConnectingERLC Credits Repair Engine',
        status: 'posted',
        relatedTxId: tx.id,
        debtFloor: -999999
      });

      reversed.push({
        'Original TX': tx.id,
        'Reversal TX': reversal.id,
        'User ID': tx.userId,
        'Amount Reversed': `-${tx.amount}`,
        'Guild ID': tx.guildId,
        'Reason': 'Reversal: join not verified'
      });
    } catch (err) {
      console.error(`Failed to reverse transaction ${tx.id}:`, err.message);
    }
  }

  console.table(reversed);
  console.log(`\n✓ Successfully created ${reversed.length} linked reversal row(s). Never deleted original data.`);
}

run().catch(err => {
  console.error('Repair execution failed:', err);
  process.exit(1);
});

