import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

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
            !t.guildName?.includes('Southland')
        )
      : [];
    const pending = Array.isArray(parsed?.pending)
      ? parsed.pending.filter(
          (p) =>
            !p.guildName?.includes('Southland') &&
            !p.guildName?.includes('San Andreas State Troopers')
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

const SERVER_ACTIVITY_FILE = path.join(__dirname, 'data', 'server_activity.json');

export function appendServerActivity(serverId, event) {
  if (!serverId) return null;
  const sid = String(serverId);
  try {
    let store = {};
    if (fs.existsSync(SERVER_ACTIVITY_FILE)) {
      store = JSON.parse(fs.readFileSync(SERVER_ACTIVITY_FILE, 'utf8') || '{}');
    }
    if (!Array.isArray(store[sid])) store[sid] = [];
    const rawTs = event.timestamp;
    const parsedTs = typeof rawTs === 'string' ? new Date(rawTs).getTime() : Number(rawTs);
    const entry = {
      id: event.id || `act_${Date.now()}_${randomBytes(4).toString('hex')}`,
      type: event.type || 'credits',
      text: String(event.text || event.message || event.description || 'Activity recorded'),
      timestamp: Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : Date.now(),
    };
    store[sid].unshift(entry);
    store[sid] = store[sid].slice(0, 200);
    fs.writeFileSync(SERVER_ACTIVITY_FILE, JSON.stringify(store, null, 2), 'utf8');
    return entry;
  } catch (err) {
    console.warn('[ACTIVITY] Error appending server activity:', err.message);
    return null;
  }
}

/**
 * Count real recorded bump events across all servers (used as a floor for the public Total Bumps stat).
 */
export function countStoredBumpEvents() {
  try {
    if (!fs.existsSync(SERVER_ACTIVITY_FILE)) return 0;
    const store = JSON.parse(fs.readFileSync(SERVER_ACTIVITY_FILE, 'utf8') || '{}');
    let n = 0;
    for (const list of Object.values(store)) {
      if (Array.isArray(list)) n += list.filter((e) => e && e.type === 'bump').length;
    }
    return n;
  } catch {
    return 0;
  }
}

export function getStoredServerActivity(serverId) {
  if (!serverId) return [];
  const sid = String(serverId);
  try {
    if (fs.existsSync(SERVER_ACTIVITY_FILE)) {
      const store = JSON.parse(fs.readFileSync(SERVER_ACTIVITY_FILE, 'utf8') || '{}');
      return Array.isArray(store[sid]) ? store[sid] : [];
    }
  } catch {}
  return [];
}

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
  serverId = null,
  joinedServerId = null,
  guildName = null,
  guildIconUrl = null,
  triggeredBy = 'You (Discord OAuth)',
  status = 'posted',
  relatedTxId = null,
  idempotencyKey = null,
  debtFloor = 0,
}) {
  const effectiveGuildId = guildId || serverId || null;
  const effectiveUserId = userId || (effectiveGuildId ? `guild_${effectiveGuildId}` : null);
  if (!effectiveUserId) throw new Error('User ID or Server ID is required');
  const numAmount = Math.max(0, parseInt(amount, 10) || 0);
  if (numAmount === 0 && type !== 'bump') throw new Error('Transaction amount must be greater than 0');

  const data = loadLedgerData();

  if (idempotencyKey) {
    const existing = data.transactions.find((tx) => tx.idempotencyKey === idempotencyKey);
    if (existing) {
      const dupErr = new Error('Duplicate ledger transaction blocked by idempotency key.');
      dupErr.code = 'DUPLICATE_LEDGER_ENTRY';
      dupErr.existing = existing;
      throw dupErr;
    }
  }

  const summary = effectiveGuildId && String(effectiveUserId).startsWith('guild_')
    ? getServerLedgerSummary(effectiveGuildId)
    : getUserLedgerSummary(effectiveUserId);

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

  const now = Date.now();
  const txId = `tx_${now}_${randomBytes(4).toString('hex')}`;
  const newTx = {
    id: txId,
    userId: effectiveUserId,
    timestamp: now,
    type,
    amount: numAmount,
    balanceAfter: newBalance,
    reason,
    description: description || `${type === 'earned' ? 'Earned' : 'Spent'} ${numAmount} credits`,
    guildId: effectiveGuildId,
    serverId: effectiveGuildId,
    ...(joinedServerId ? { joinedServerId: String(joinedServerId) } : {}),
    ...(idempotencyKey ? { idempotencyKey: String(idempotencyKey) } : {}),
    guildName,
    guildIconUrl,
    triggeredBy,
    status,
    relatedTxId,
  };

  data.transactions.push(newTx);
  saveLedgerData(data);

  if (effectiveGuildId) {
    const isCheckin = String(reason || '').toLowerCase().includes('checkin') || String(reason || '').toLowerCase().includes('check-in');
    appendServerActivity(effectiveGuildId, {
      id: `act_${txId}`,
      type: isCheckin ? 'checkin' : 'credits',
      text: newTx.description || `${type === 'earned' ? '+' : '-'}${numAmount} credits (${reason || 'ledger'})`,
      timestamp: now,
    });
  }

  return newTx;
}
