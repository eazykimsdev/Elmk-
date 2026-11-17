import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDirectoryData, saveDirectoryData } from './directoryManager.js';
import { loadLedgerData, recordLedgerTransaction, getServerLedgerSummary } from './ledgerManager.js';
import { getAdminSettings } from './premiumManager.js';
import { checkBlacklist } from './blacklistManager.js';
import { recordAuditAction, getAdminRecord } from './adminManager.js';
import { sendComponentV2Dm } from './discordNotificationManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns the timestamp of the start of the current UTC week (Monday 00:00:00 UTC)
 */
export function getUtcWeekStart(timestamp = Date.now()) {
  const d = new Date(timestamp);
  const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  // Distance back to Monday
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get weekly allowance, spent, and remaining credits for a Directive Board member
 */
export function getDirectiveBoardAllowance(userId, timestamp = Date.now()) {
  if (!userId) {
    return { weeklyCap: 500, usedThisWeek: 0, remainingThisWeek: 0, weekStartUtc: getUtcWeekStart(timestamp) };
  }
  const uid = String(userId);
  const settings = getAdminSettings();
  const weeklyCap = typeof settings.directive_board_weekly_cap === 'number'
    ? settings.directive_board_weekly_cap
    : 500;

  const weekStart = getUtcWeekStart(timestamp);
  const ledger = loadLedgerData();
  const transactions = ledger.transactions || [];

  // Count credits gifted by this member in the current UTC week
  const usedThisWeek = transactions
    .filter((tx) =>
      tx.reason === 'directive board' &&
      (String(tx.triggeredById) === uid || String(tx.userId) === uid) &&
      Number(tx.timestamp || 0) >= weekStart &&
      tx.type === 'earned'
    )
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const remainingThisWeek = Math.max(0, weeklyCap - usedThisWeek);

  return {
    weeklyCap,
    usedThisWeek,
    remainingThisWeek,
    weekStartUtc: weekStart,
    weekStartIso: new Date(weekStart).toISOString(),
  };
}

/**
 * Gift credits to a server from a Directive Board member
 */
export async function giftDirectiveBoardCredits({
  memberUser,
  serverId,
  amount,
  reason
}) {
  if (!memberUser || !memberUser.id) {
    throw new Error('Member user identity is required.');
  }
  const uid = String(memberUser.id);
  const adminRec = getAdminRecord(uid, memberUser.username);

  // Check role: must be Directive Board, Admin, or Owner
  const allowedRoles = ['Directive Board', 'Admin', 'Owner'];
  if (!adminRec || !allowedRoles.includes(adminRec.role)) {
    const err = new Error('Page not found');
    err.status = 404;
    throw err;
  }

  const sid = String(serverId);
  if (!sid) throw new Error('Target Server ID is required.');

  const numAmount = parseInt(amount, 10);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Gift amount must be a positive integer.');
  }

  const cleanReason = String(reason || '').trim();
  if (!cleanReason || cleanReason.length < 3) {
    throw new Error('A reason of at least 3 characters is required.');
  }

  // 1. Check weekly limit
  const allowance = getDirectiveBoardAllowance(uid);
  if (numAmount > allowance.remainingThisWeek) {
    const err = new Error(`Gift amount (${numAmount} cr) exceeds your remaining weekly limit (${allowance.remainingThisWeek} cr left of ${allowance.weeklyCap} cr).`);
    err.code = 'WEEKLY_LIMIT_EXCEEDED';
    err.remaining = allowance.remainingThisWeek;
    throw err;
  }

  // 2. Check server exists and ownership/management conflict
  const dirData = loadDirectoryData();
  const server = dirData.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) {
    throw new Error('Target server was not found in directory.');
  }

  const isOwner = String(server.ownerId) === uid;
  const isManager = Array.isArray(server.representatives) && server.representatives.some(r => String(r.userId || r) === uid);
  if (isOwner || isManager) {
    const err = new Error('Conflict: You cannot gift credits to a server that you own or manage.');
    err.code = 'CANNOT_GIFT_OWN_SERVER';
    throw err;
  }

  // 3. Check blacklist
  const bl = checkBlacklist(sid);
  if (bl?.blocked || bl?.blacklisted) {
    const err = new Error('Cannot gift credits to a blacklisted community.');
    err.code = 'SERVER_BLACKLISTED';
    throw err;
  }

  // 4. Atomic append-only ledger transaction
  const now = Date.now();
  const idempotencyKey = `directive_board_${uid}_${sid}_${now}`;
  const tx = recordLedgerTransaction({
    guildId: sid,
    serverId: sid,
    userId: uid,
    type: 'earned',
    amount: numAmount,
    reason: 'directive board',
    description: `Directive Board gift (+${numAmount} cr): ${cleanReason}`,
    triggeredBy: `${memberUser.username || 'Board Member'} (Directive Board)`,
    idempotencyKey,
    guildName: server.name || 'Server'
  });

  // Attach triggeredById for weekly limit accounting
  const ledger = loadLedgerData();
  const recorded = ledger.transactions.find(t => t.id === tx.id);
  if (recorded) {
    recorded.triggeredById = uid;
    saveDirectoryData(dirData);
  }

  // Update server balance cache
  const summary = getServerLedgerSummary(sid);
  server.balance = summary.balance;
  server.credits = summary.balance;
  saveDirectoryData(dirData);

  // 5. Audit log
  recordAuditAction({
    action: 'DIRECTIVE_BOARD_GIFT',
    actor: memberUser.username || uid,
    actorRole: adminRec.role,
    target: sid,
    reason: `Gifted ${numAmount} cr: ${cleanReason}`
  });

  // 6. Notify server owner via V2 DM
  if (server.ownerId) {
    const container = {
      type: 17,
      components: [
        {
          type: 10,
          content: `### Directive Board Gift: ${server.name}\nYour community received **+${numAmount} credits** from the Directive Board.\n\n**Reason:** ${cleanReason}\n**New Treasury Balance:** ${server.balance} credits`
        },
        {
          type: 14,
          divider: true,
          spacing: 1
        },
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: 'Open Server Dashboard',
              url: `https://connectingerlc.xyz/dashboard/${server.id}/overview`
            }
          ]
        }
      ]
    };
    sendComponentV2Dm(server.ownerId, container).catch(() => {});
  }

  const updatedAllowance = getDirectiveBoardAllowance(uid);

  return {
    success: true,
    amount: numAmount,
    serverId: sid,
    serverName: server.name,
    newBalance: server.balance,
    remainingWeeklyLimit: updatedAllowance.remainingThisWeek,
    transactionId: tx.id
  };
}
