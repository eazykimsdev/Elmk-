import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');
const DIRECTORY_FILE = path.join(DATA_DIR, 'promoted_servers.json');

export function getUnverifiedJoinTransactions() {
  if (!fs.existsSync(LEDGER_FILE)) return [];

  let ledger;
  try {
    ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
  } catch {
    return [];
  }

  const transactions = Array.isArray(ledger?.transactions) ? ledger.transactions : [];

  // Find all reversal transaction IDs
  const reversedTxIds = new Set();
  for (const t of transactions) {
    if (t.relatedTxId) {
      reversedTxIds.add(String(t.relatedTxId));
    }
  }

  // Load verified joins from promoted_servers.json
  let directory = {};
  try {
    if (fs.existsSync(DIRECTORY_FILE)) {
      directory = JSON.parse(fs.readFileSync(DIRECTORY_FILE, 'utf8'));
    }
  } catch {}

  const userJoins = directory.userJoins || {};
  const userJoinRecords = directory.userJoinRecords || {};

  const unverified = [];

  for (const tx of transactions) {
    if (tx.type !== 'earned') continue;
    const reason = (tx.reason || '').toLowerCase();
    const isJoinReason = reason.includes('join') || reason.includes('reward') || reason.includes('bounty');
    if (!isJoinReason) continue;

    // Skip if already reversed
    if (reversedTxIds.has(String(tx.id))) continue;

    const uid = String(tx.userId || '');
    const sid = String(tx.guildId || tx.serverId || '');

    // Check if verified join record exists
    const hasListJoin = Array.isArray(userJoins[uid]) && userJoins[uid].includes(sid);
    const joinRec = userJoinRecords[`${uid}:${sid}`];
    const isVerified = Boolean(joinRec && joinRec.stayCompleted);

    if (!hasListJoin || !isVerified) {
      unverified.push({
        id: tx.id,
        userId: tx.userId,
        amount: tx.amount,
        guildId: sid,
        guildName: tx.guildName || 'Unknown',
        reason: tx.reason,
        timestamp: tx.timestamp ? new Date(tx.timestamp).toISOString() : 'Unknown'
      });
    }
  }

  return unverified;
}

async function run() {
  console.log('=== ConnectingERLC Credits Audit ===\n');
  const unverified = getUnverifiedJoinTransactions();

  if (unverified.length === 0) {
    console.log('✓ Audit clean: Zero unverified join ledger rows found.');
    console.log('Total unverified join transactions: 0\n');
    return;
  }

  console.log(`⚠ Found ${unverified.length} unverified join ledger row(s):\n`);
  console.table(unverified.map(t => ({
    'TX ID': t.id,
    'User ID': t.userId,
    'Credits': t.amount,
    'Server ID': t.guildId,
    'Reason': t.reason,
    'Date': t.timestamp
  })));
  console.log('\nRun "npm run credits:repair" to reverse these transactions with linked reversal rows.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
}

