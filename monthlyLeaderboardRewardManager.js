import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPromotedServers, loadDirectoryData, saveDirectoryData } from './directoryManager.js';
import { recordLedgerTransaction } from './ledgerManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const REWARDS_FILE = path.join(DATA_DIR, 'monthly_leaderboard_rewards.json');
const BANS_FILE = path.join(DATA_DIR, 'banned_users.json');

function getBannedIds() {
  try {
    if (fs.existsSync(BANS_FILE)) {
      const data = JSON.parse(fs.readFileSync(BANS_FILE, 'utf8') || '{}');
      return new Set(Array.isArray(data.bannedUsers) ? data.bannedUsers.map(String) : []);
    }
  } catch {}
  return new Set();
}

export function loadMonthlyRewardConfig() {
  try {
    if (fs.existsSync(REWARDS_FILE)) {
      return JSON.parse(fs.readFileSync(REWARDS_FILE, 'utf8') || '{}');
    }
  } catch {}
  return {
    enabled: true,
    rewardAmount: 500,
    awardedMonths: {}
  };
}

export function saveMonthlyRewardConfig(config) {
  try {
    const tmp = `${REWARDS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tmp, REWARDS_FILE);
    return true;
  } catch {
    return false;
  }
}

export function getRankedEligibleServers() {
  const allServers = getPromotedServers(true);
  const banned = getBannedIds();

  // Filter out blacklisted servers and blacklisted owners
  const eligible = allServers.filter(s => {
    if (!s || s.hidden || s.delisted) return false;
    const sId = String(s.id || s.guildId || '');
    const oId = String(s.ownerId || s.owner_discord_id || '');
    if (banned.has(sId) || (oId && banned.has(oId))) return false;
    return true;
  });

  // Sort by existing leaderboard ranking: (verifiedJoins * 2 + bumps), with tie breaker going to earliest reached
  eligible.sort((a, b) => {
    const aScore = (Number(a.verifiedJoins) || 0) * 2 + (Number(a.bumps) || 0);
    const bScore = (Number(b.verifiedJoins) || 0) * 2 + (Number(b.bumps) || 0);
    if (bScore !== aScore) return bScore - aScore;

    // Tie-breaker: whoever reached score earliest
    const aTime = a.lastScoreReachedAt || a.updatedAt || a.createdAt || 0;
    const bTime = b.lastScoreReachedAt || b.updatedAt || b.createdAt || 0;
    if (aTime !== bTime) return aTime - bTime;

    return (Number(b.memberCount) || 0) - (Number(a.memberCount) || 0);
  });

  return eligible;
}

export function getMonthlyLeaderboardPreview() {
  const config = loadMonthlyRewardConfig();
  const ranked = getRankedEligibleServers();
  const winner = ranked[0] || null;
  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const alreadyAwarded = Boolean(config.awardedMonths?.[currentMonth]);

  return {
    enabled: config.enabled !== false,
    rewardAmount: Number(config.rewardAmount || 500),
    currentMonth,
    alreadyAwarded,
    winner: winner ? {
      id: winner.id,
      name: winner.name,
      ownerId: winner.ownerId || winner.owner_discord_id || null,
      score: (Number(winner.verifiedJoins) || 0) * 2 + (Number(winner.bumps) || 0),
      memberCount: Number(winner.memberCount || 0)
    } : null
  };
}

/**
 * Builds Components V2 Direct Message payload
 * No embeds, no emojis, no dash lines, no green. Real Separators and Action Row.
 */
export function buildMonthlyWinnerV2DMPanel({ serverName, rewardAmount = 500 }) {
  return {
    flags: 8192, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // V2 Container
        components: [
          {
            type: 9, // Section
            components: [
              {
                type: 10, // Text display
                content: `**Monthly Leaderboard Winner**\nCongratulations! ${serverName} finished #1 on the ConnectingERLC monthly leaderboard. ${rewardAmount} credits have been deposited into your server treasury, and your community has unlocked the exclusive Top Server badge.`
              }
            ]
          },
          {
            type: 14 // Separator
          },
          {
            type: 1, // Action Row
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'View leaderboard',
                url: 'https://connectingerlc.xyz/dashboard?tab=leaderboard'
              },
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Website',
                url: 'https://connectingerlc.xyz'
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Executes the monthly leaderboard reward.
 * Enforces once-per-month unique constraint, awards credits, sets Top server badge, and sends DM.
 */
export async function executeMonthlyReward({
  month = null,
  force = false,
  botToken = null,
  fetchImpl = globalThis.fetch
} = {}) {
  const config = loadMonthlyRewardConfig();
  if (!config.enabled && !force) {
    throw new Error('Monthly leaderboard rewards are currently disabled by admin.');
  }

  const currentMonth = month || new Date().toISOString().slice(0, 7);
  config.awardedMonths = config.awardedMonths || {};

  if (config.awardedMonths[currentMonth] && !force) {
    throw new Error(`Monthly reward has already been awarded for month ${currentMonth}.`);
  }

  const ranked = getRankedEligibleServers();
  const winner = ranked[0];
  if (!winner) {
    throw new Error('No eligible communities found for leaderboard reward.');
  }

  const rewardAmt = Number(config.rewardAmount || 500);
  const now = new Date();

  // End of next month timestamp for "Top server" badge duration
  const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59));
  const topServerUntilMs = nextMonthDate.getTime();

  // 1. Award credits via append-only ledger transaction with unique idempotency key
  recordLedgerTransaction({
    userId: winner.ownerId || winner.owner_discord_id || null,
    guildId: winner.id,
    serverId: winner.id,
    type: 'earned',
    amount: rewardAmt,
    reason: 'Monthly Leaderboard Winner',
    description: `#1 Leaderboard Champion reward for ${currentMonth} (+${rewardAmt} credits)`,
    status: 'posted',
    idempotencyKey: `monthly_reward:${currentMonth}:${winner.id}`
  });

  // 2. Set Top Server badge on directory server
  const dirData = loadDirectoryData();
  const targetServer = dirData.servers.find(s => String(s.id) === String(winner.id));
  if (targetServer) {
    targetServer.isTopServer = true;
    targetServer.topServerUntil = topServerUntilMs;
    targetServer.credits = (Number(targetServer.credits) || 0) + rewardAmt;
    targetServer.balance = (Number(targetServer.balance) || 0) + rewardAmt;
    saveDirectoryData(dirData);
  }

  // 3. Components V2 DM to server owner
  const dmPayload = buildMonthlyWinnerV2DMPanel({
    serverName: winner.name,
    rewardAmount: rewardAmt
  });

  let dmDelivered = false;
  const ownerId = winner.ownerId || winner.owner_discord_id;
  const cleanToken = (botToken || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');

  if (ownerId && cleanToken) {
    try {
      const dmChannelRes = await fetchImpl('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          Authorization: `Bot ${cleanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipient_id: String(ownerId) })
      });
      if (dmChannelRes.ok) {
        const dmChannel = await dmChannelRes.json();
        const msgRes = await fetchImpl(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dmPayload)
        });
        dmDelivered = msgRes.ok;
      }
    } catch (dmErr) {
      console.warn('[MONTHLY REWARD] DM delivery error:', dmErr.message);
    }
  }

  const record = {
    month: currentMonth,
    winnerServerId: winner.id,
    winnerServerName: winner.name,
    ownerId,
    rewardAmount: rewardAmt,
    awardedAt: now.toISOString(),
    topServerUntil: new Date(topServerUntilMs).toISOString(),
    dmDelivered
  };

  config.awardedMonths[currentMonth] = record;
  saveMonthlyRewardConfig(config);

  return {
    success: true,
    month: currentMonth,
    winner: {
      id: winner.id,
      name: winner.name,
      ownerId,
      creditsAwarded: rewardAmt,
      isTopServer: true,
      topServerUntil: new Date(topServerUntilMs).toISOString()
    },
    dmPayload,
    dmDelivered
  };
}
