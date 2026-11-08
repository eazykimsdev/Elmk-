import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEDGER_FILE = path.join(__dirname, 'data', 'ledger.json');

// Ensure directory exists
function ensureLedgerFile() {
  const dir = path.dirname(LEDGER_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(LEDGER_FILE)) {
    const now = Date.now();
    const defaultUser = '523693281541095424';

    // Initialize empty ledger with zero fake/demo transactions
    const initialData = {
      transactions: [],
      pending: [],
    };

    fs.writeFileSync(LEDGER_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

/** Load all ledger data */
export function loadLedgerData() {
  ensureLedgerFile();
  try {
    const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const transactions = Array.isArray(parsed?.transactions)
      ? parsed.transactions.filter(
          (t) =>
            !t.description?.includes('Southland') &&
            !t.guildName?.includes('Southland') &&
            t.guildId !== '112233445566778899'
        )
      : [];
    const pending = Array.isArray(parsed?.pending)
      ? parsed.pending.filter(
          (p) =>
            !p.guildName?.includes('Southland') &&
            !p.guildName?.includes('San Andreas State Troopers') &&
            p.guildId !== '112233445566778899'
        )
      : [];
    return { transactions, pending };
  } catch (err) {
    console.error('Error reading ledger data:', err);
    return { transactions: [], pending: [] };
  }
}

/** Save ledger data */
export function saveLedgerData(data) {
  ensureLedgerFile();
  try {
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving ledger data:', err);
  }
}

/**
 * Get current balance and summary totals for a user
 */
export function getUserLedgerSummary(userId) {
  const data = loadLedgerData();
  const txs = data.transactions
    .filter((tx) => tx.userId === userId && tx.status === 'posted')
    .sort((a, b) => a.timestamp - b.timestamp);

  let earned = 0;
  let spent = 0;

  for (const tx of txs) {
    if (tx.type === 'earned') earned += Number(tx.amount || 0);
    else if (tx.type === 'spent') spent += Number(tx.amount || 0);
  }

  const balance = Math.max(0, earned - spent);
  return { balance, earned, spent };
}

/**
 * Get current balance and summary totals for a server treasury
 */
export function getServerLedgerSummary(serverId) {
  if (!serverId) return { balance: 0, earned: 0, spent: 0 };
  const sid = String(serverId);
  const data = loadLedgerData();
  const txs = data.transactions
    .filter((tx) => (String(tx.guildId) === sid || String(tx.serverId) === sid) && tx.status === 'posted')
    .sort((a, b) => a.timestamp - b.timestamp);

  let earned = 0;
  let spent = 0;

  for (const tx of txs) {
    if (tx.type === 'earned') earned += Number(tx.amount || 0);
    else if (tx.type === 'spent') spent += Number(tx.amount || 0);
  }

  const balance = Math.max(0, earned - spent);
  return { balance, earned, spent };
}

/**
 * Query filtered and paginated credit history for a server
 */
export function getServerCreditHistory(serverId, options = {}) {
  const {
    range = 'all',
    type = 'all',
    reason = 'all',
    page = 1,
    pageSize = 20,
  } = options;

  if (!serverId) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      summary: { balance: 0, earned: 0, spent: 0 },
      pending: [],
    };
  }

  const sid = String(serverId);
  const data = loadLedgerData();
  const summary = getServerLedgerSummary(sid);

  let serverTxs = data.transactions.filter(
    (tx) => String(tx.guildId) === sid || String(tx.serverId) === sid
  );

  const now = Date.now();
  if (range === '7d') {
    const cutoff = now - 7 * 86400000;
    serverTxs = serverTxs.filter((tx) => tx.timestamp >= cutoff);
  } else if (range === '30d') {
    const cutoff = now - 30 * 86400000;
    serverTxs = serverTxs.filter((tx) => tx.timestamp >= cutoff);
  } else if (range === '90d') {
    const cutoff = now - 90 * 86400000;
    serverTxs = serverTxs.filter((tx) => tx.timestamp >= cutoff);
  }

  if (type === 'earned') {
    serverTxs = serverTxs.filter((tx) => tx.type === 'earned');
  } else if (type === 'spent') {
    serverTxs = serverTxs.filter((tx) => tx.type === 'spent');
  }

  if (reason && reason !== 'all') {
    const rNorm = reason.toLowerCase().replace(/[^a-z0-9]/g, '');
    serverTxs = serverTxs.filter((tx) => {
      const txR = (tx.reason || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return txR.includes(rNorm) || rNorm.includes(txR);
    });
  }

  serverTxs.sort((a, b) => b.timestamp - a.timestamp);

  const total = serverTxs.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, parseInt(pageSize, 10) || 20);
  const totalPages = Math.ceil(total / size) || 1;

  const offset = (pageNum - 1) * size;
  const items = serverTxs.slice(offset, offset + size);

  const pending = (data.pending || [])
    .filter((p) => (String(p.guildId) === sid || String(p.serverId) === sid) && p.status === 'pending_retention')
    .map((p) => ({
      ...p,
      remainingSeconds: Math.max(0, Math.floor((p.releaseAt - now) / 1000)),
    }));

  return {
    items,
    total,
    page: pageNum,
    pageSize: size,
    totalPages,
    summary,
    pending,
  };
}

/**
 * Query filtered and paginated credit history
 */
export function getCreditHistory(userId, options = {}) {
  const {
    range = 'all',
    type = 'all',
    reason = 'all',
    page = 1,
    pageSize = 20,
  } = options;

  const data = loadLedgerData();
  const summary = getUserLedgerSummary(userId);

  // Filter user transactions
  let userTxs = data.transactions.filter((tx) => tx.userId === userId);

  // Range filter
  const now = Date.now();
  if (range === '7d') {
    const cutoff = now - 7 * 86400000;
    userTxs = userTxs.filter((tx) => tx.timestamp >= cutoff);
  } else if (range === '30d') {
    const cutoff = now - 30 * 86400000;
    userTxs = userTxs.filter((tx) => tx.timestamp >= cutoff);
  } else if (range === '90d') {
    const cutoff = now - 90 * 86400000;
    userTxs = userTxs.filter((tx) => tx.timestamp >= cutoff);
  }

  // Type filter
  if (type === 'earned') {
    userTxs = userTxs.filter((tx) => tx.type === 'earned');
  } else if (type === 'spent') {
    userTxs = userTxs.filter((tx) => tx.type === 'spent');
  }

  // Reason filter
  if (reason && reason !== 'all') {
    const rNorm = reason.toLowerCase().replace(/[^a-z0-9]/g, '');
    userTxs = userTxs.filter((tx) => {
      const txR = (tx.reason || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return txR.includes(rNorm) || rNorm.includes(txR);
    });
  }

  // Sort descending by timestamp for UI display
  userTxs.sort((a, b) => b.timestamp - a.timestamp);

  const total = userTxs.length;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, parseInt(pageSize, 10) || 20);
  const totalPages = Math.ceil(total / size) || 1;

  const offset = (pageNum - 1) * size;
  const items = userTxs.slice(offset, offset + size);

  // Pending rewards for retention (within 72h)
  const pending = (data.pending || [])
    .filter((p) => p.userId === userId && p.status === 'pending_retention')
    .map((p) => {
      const remainingSeconds = Math.max(0, Math.floor((p.releaseAt - now) / 1000));
      return {
        ...p,
        remainingSeconds,
      };
    });

  return {
    items,
    total,
    page: pageNum,
    pageSize: size,
    totalPages,
    summary,
    pending,
  };
}

export const REWARD_DEBT_FLOOR = -20;

/**
 * Record a new credit transaction ensuring mathematical integrity
 */
export function recordLedgerTransaction({
  userId,
  type,
  amount,
  reason,
  description,
  guildId = null,
  guildName = null,
  guildIconUrl = null,
  triggeredBy = 'You (Discord OAuth)',
  status = 'posted',
  relatedTxId = null,
  debtFloor = 0,
}) {
  if (!userId) throw new Error('User ID is required');
  const numAmount = Math.max(0, parseInt(amount, 10) || 0);
  if (numAmount === 0 && type !== 'bump') throw new Error('Transaction amount must be greater than 0');

  const data = loadLedgerData();
  const summary = getUserLedgerSummary(userId);

  let newBalance = summary.balance;
  if (status === 'posted') {
    if (type === 'earned') newBalance += numAmount;
    else if (type === 'spent') {
      const allowedFloor = typeof debtFloor === 'number' ? debtFloor : 0;
      if (newBalance - numAmount < allowedFloor) {
        throw new Error(`Insufficient balance: cannot fall below debt floor of ${allowedFloor} credits.`);
      }
      newBalance -= numAmount;
    }
  }

  const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newTx = {
    id: txId,
    userId,
    timestamp: Date.now(),
    type,
    amount: numAmount,
    balanceAfter: newBalance,
    reason,
    description: description || `${type === 'earned' ? 'Earned' : 'Spent'} ${numAmount} credits`,
    guildId,
    guildName,
    guildIconUrl,
    triggeredBy,
    status,
    relatedTxId,
  };

  data.transactions.push(newTx);
  saveLedgerData(data);
  return newTx;
}
