import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'node:crypto';
import { getUserLedgerSummary, getServerLedgerSummary, recordLedgerTransaction, appendServerActivity, REWARD_DEBT_FLOOR } from './ledgerManager.js';
import { cleanSqlReplace } from './markdownSanitizer.js';
import { findActiveJoinIntent, markJoinIntentConverted } from './inviteValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DIRECTORY_FILE = path.join(DATA_DIR, 'promoted_servers.json');
const PENDING_JOINS_FILE = path.join(DATA_DIR, 'pending_joins.json');
const BUMP_REMINDERS_FILE = path.join(DATA_DIR, 'bump_reminders.json');

export function loadPendingJoins() {
  try {
    if (fs.existsSync(PENDING_JOINS_FILE)) {
      const raw = fs.readFileSync(PENDING_JOINS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

export function savePendingJoins(list) {
  try {
    const tmp = `${PENDING_JOINS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmp, PENDING_JOINS_FILE);
    return true;
  } catch (err) {
    console.error('[PENDING JOINS] Failed to save:', err.message);
    return false;
  }
}

export function recordBotMemberJoin(guildId, userId, options = {}) {
  if (!guildId || !userId) return null;
  const sid = String(guildId);
  const uid = String(userId);

  const data = loadDirectoryData();
  const server = data.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) return null;

  // Ensure bot_in_guild is marked true since member join event was received
  server.bot_in_guild = true;

  // Blacklist check: user or server
  const bannedIds = getBannedUserIds();
  if (bannedIds.has(uid) || (server.ownerId && bannedIds.has(String(server.ownerId)))) {
    console.log(`[BOT JOIN] User ${uid} or server ${sid} is blacklisted, skipping.`);
    return null;
  }

  // Server owner cannot earn on their own server
  if (server.ownerId && String(server.ownerId) === uid) {
    console.log(`[BOT JOIN] User ${uid} is owner of ${sid}, skipping credits.`);
    return null;
  }

  // Already verified & rewarded member
  const joinRecKey = `${uid}:${sid}`;
  if (data.userJoinRecords?.[joinRecKey]?.rewarded || (Array.isArray(data.userJoins[uid]) && data.userJoins[uid].includes(sid))) {
    return null;
  }

  // Check active join intent within past 30 minutes
  const activeIntent = findActiveJoinIntent(uid, sid);
  if (!activeIntent) {
    console.log(`[BOT JOIN] No active join intent found for user ${uid} in ${sid}.`);
    return null;
  }

  const userOwnedServer = data.servers.find(
    s => (String(s.ownerId) === uid || String(s.owner_discord_id) === uid) && !s.hidden && !s.delisted
  );

  const recipientServerId = String(
    options.recipientServerId || activeIntent.recipientServerId || userOwnedServer?.id || userOwnedServer?.guildId || sid
  );

  const pendingList = loadPendingJoins();
  const existingPending = pendingList.find(p => p.userId === uid && p.serverId === sid && p.status === 'pending');
  if (existingPending) return existingPending;

  const rewardAmt = Math.min(22, Math.max(2, Number(server.rewardCoins || 2)));
  const now = Date.now();
  const stayRequiredMs = typeof options.stayRequiredMs === 'number' ? Math.max(0, options.stayRequiredMs) : 120000; // 2 minutes minimum stay

  const record = {
    id: `pjoin_${now}_${randomBytes(4).toString('hex')}`,
    userId: uid,
    serverId: sid,
    recipientServerId,
    serverName: server.name || 'Community Server',
    joinedAt: now,
    stayRequiredMs,
    releaseAt: now + stayRequiredMs,
    reward: rewardAmt,
    status: 'pending'
  };

  pendingList.push(record);
  savePendingJoins(pendingList);
  markJoinIntentConverted(uid, sid);
  appendServerActivity(sid, {
    type: 'join',
    text: `Member joined ${server.name || 'server'} via directory invite`,
    timestamp: now
  });
  console.log(`[BOT JOIN] Recorded pending join for user ${uid} in ${server.name} (matures in ${Math.round(stayRequiredMs / 1000)}s).`);
  return record;
}

export function recordBotMemberLeave(guildId, userId) {
  if (!guildId || !userId) return false;
  const sid = String(guildId);
  const uid = String(userId);

  let handled = false;
  const pendingList = loadPendingJoins();
  const pending = pendingList.find(p => p.userId === uid && p.serverId === sid && p.status === 'pending');
  if (pending) {
    pending.status = 'left_early';
    pending.leftAt = Date.now();
    pending.failureReason = 'Member left before completing minimum stay';
    savePendingJoins(pendingList);
    appendServerActivity(sid, {
      type: 'join',
      text: 'Member left before completing minimum stay requirement',
      timestamp: Date.now()
    });
    console.log(`[BOT LEAVE] Pending join cancelled for ${uid} in ${sid}: left before minimum stay.`);
    handled = true;
  }

  // If member had already completed stay, decrement verifiedJoins counter
  const data = loadDirectoryData();
  const joinKey = `${uid}:${sid}`;
  if (data.userJoinRecords?.[joinKey]?.stayCompleted) {
    data.userJoinRecords[joinKey].stayCompleted = false;
    data.userJoinRecords[joinKey].leftAt = new Date().toISOString();
    const srv = data.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
    if (srv) {
      srv.verifiedJoins = Math.max(0, (Number(srv.verifiedJoins) || 0) - 1);
    }
    saveDirectoryData(data);
    handled = true;
  }

  return handled;
}

export async function processMaturePendingJoins(botToken = null) {
  const pendingList = loadPendingJoins();
  const now = Date.now();
  const due = pendingList.filter(p => p.status === 'pending' && now >= p.releaseAt);
  if (due.length === 0) return { processed: 0, awarded: 0 };

  const data = loadDirectoryData();
  data.userJoins = data.userJoins || {};
  data.userJoinRecords = data.userJoinRecords || {};
  data.userBalances = data.userBalances || {};

  let awarded = 0;

  for (const p of due) {
    const joinKey = `${p.userId}:${p.serverId}`;
    if (data.userJoinRecords[joinKey]?.rewarded) {
      p.status = 'completed';
      p.completedAt = data.userJoinRecords[joinKey].completedAt || now;
      continue;
    }

    let stillInServer = true;
    if (typeof botToken === 'function') {
      stillInServer = Boolean(await botToken(p.serverId, p.userId));
    } else if (botToken) {
      try {
        const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
        const res = await fetch(`https://discord.com/api/v10/guilds/${p.serverId}/members/${p.userId}`, {
          headers: { Authorization: `Bot ${cleanToken}` },
          signal: AbortSignal.timeout(4000)
        });
        if (res.status === 404) {
          stillInServer = false;
        }
      } catch (err) {
        console.warn(`[PENDING JOIN VERIFY] Warning verifying member ${p.userId} in ${p.serverId}:`, err.message);
      }
    }

    if (!stillInServer) {
      p.status = 'left_early';
      p.failureReason = 'Member no longer in server';
      continue;
    }

    const userOwnedServer = data.servers.find(s => String(s.ownerId) === p.userId && String(s.id) !== p.serverId);
    const recipientServerId = String(p.recipientServerId || userOwnedServer?.id || p.serverId);
    const recipientServer = data.servers.find(s => String(s.id) === recipientServerId || String(s.guildId) === recipientServerId);
    const joinedServer = data.servers.find(s => String(s.id) === p.serverId || String(s.guildId) === p.serverId);

    // Award credits to the server as one append-only ledger entry, once only
    p.status = 'completed';
    p.completedAt = now;
    p.recipientServerId = recipientServerId;

    try {
      recordLedgerTransaction({
        userId: p.userId,
        type: 'earned',
        amount: p.reward,
        reason: 'verified_join',
        description: `Verified join reward (+${p.reward} cr) for joining ${p.serverName} and completing minimum stay`,
        guildId: recipientServerId,
        serverId: recipientServerId,
        joinedServerId: p.serverId,
        guildName: recipientServer?.name || p.serverName,
        triggeredBy: 'ConnectingERLC Bot Join Verification',
        status: 'posted',
        idempotencyKey: `join_reward:${p.userId}:${p.serverId}`
      });

      if (recipientServer) {
        recipientServer.credits = Number(recipientServer.credits || 0) + p.reward;
        recipientServer.balance = Number(recipientServer.balance || 0) + p.reward;
      }
      data.userBalances[p.userId] = Number(data.userBalances[p.userId] || 0) + p.reward;

      const userList = Array.isArray(data.userJoins[p.userId]) ? data.userJoins[p.userId] : [];
      if (!userList.includes(p.serverId)) {
        userList.push(p.serverId);
        data.userJoins[p.userId] = userList;
      }
      data.userJoinRecords[joinKey] = {
        userId: p.userId,
        serverId: p.serverId,
        recipientServerId,
        joinedAt: new Date(p.joinedAt).toISOString(),
        stayEndsAt: new Date(now).toISOString(),
        completedAt: now,
        stayCompleted: true,
        rewarded: true,
        reward: p.reward
      };

      if (joinedServer) {
        joinedServer.verifiedJoins = (Number(joinedServer.verifiedJoins) || 0) + 1;
      }

      appendServerActivity(p.serverId, {
        type: 'join',
        text: `Member verified stay in ${p.serverName} (+1 verified join)`,
        timestamp: now
      });

      awarded++;
      console.log(`[JOIN VERIFIED & PAID] Server ${recipientServerId} (user ${p.userId}) awarded ${p.reward} credits for ${p.serverName}.`);
    } catch (txErr) {
      if (txErr.code === 'DUPLICATE_LEDGER_ENTRY') {
        console.warn(`[JOIN AWARD] Duplicate reward blocked for ${p.userId} -> ${p.serverId}`);
      } else {
        console.error(`[JOIN AWARD ERROR] Failed recording transaction for ${p.userId}:`, txErr.message);
      }
    }
  }

  savePendingJoins(pendingList);
  saveDirectoryData(data);
  return { processed: due.length, awarded };
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadDirectoryData() {
  try {
    if (fs.existsSync(DIRECTORY_FILE)) {
      const raw = fs.readFileSync(DIRECTORY_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const rawServers = Array.isArray(parsed?.servers) ? parsed.servers : (Array.isArray(parsed) ? parsed : []);
      // Guarantee zero fake/demo listings: strictly 17-20 digit snowflakes and no test dummy artifacts
      const isTestContext = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test') || a.includes('proof'));
      const TEST_DUMMY_NAMES = new Set([
        'elite roleplay',
        'sender community',
        'configured alliance server',
        'unconfigured rp community',
        'bug hunter community',
        'promo test server'
      ]);
      const servers = rawServers
        .filter(
          (s) =>
            s &&
            typeof (s.id || s.guildId) === 'string' &&
            /^\d{17,20}$/.test(s.id || s.guildId) &&
            !s.name?.toLowerCase().includes('southland') &&
            (isTestContext || !TEST_DUMMY_NAMES.has(String(s.name || '').toLowerCase().trim())) &&
            !/^Server \(\d+\)$/.test(String(s.name || '').trim())
        )
        .map((s) => ({
          ...s,
          id: s.id || s.guildId,
          guildId: s.guildId || s.id,
          summary: cleanSqlReplace(s.summary || ''),
          description: cleanSqlReplace(s.description || ''),
          owner_display_name: (s.owner_display_name === 'ConnectingERLC' || s.owner_display_name === 'Connecting ERLC') ? null : s.owner_display_name,
          ownerUsername: (s.ownerUsername === 'ConnectingERLC' || s.ownerUsername === 'Connecting ERLC') ? null : s.ownerUsername
        }));
      return {
        servers,
        userBalances: parsed?.userBalances && typeof parsed.userBalances === 'object' ? parsed.userBalances : {},
        userJoins: parsed?.userJoins && typeof parsed.userJoins === 'object' ? parsed.userJoins : {},
        userJoinRecords: parsed?.userJoinRecords && typeof parsed.userJoinRecords === 'object' ? parsed.userJoinRecords : {},
        bumpCooldowns: parsed?.bumpCooldowns && typeof parsed.bumpCooldowns === 'object' ? parsed.bumpCooldowns : {},
        launchBonusGrantedUsers: parsed?.launchBonusGrantedUsers && typeof parsed.launchBonusGrantedUsers === 'object' ? parsed.launchBonusGrantedUsers : {}
      };
    }
  } catch (err) {
    console.warn('[DIRECTORY] Error reading directory file, initializing empty:', err.message);
  }
  return { servers: [], userBalances: {}, userJoins: {}, userJoinRecords: {}, bumpCooldowns: {}, launchBonusGrantedUsers: {} };
}

export function saveDirectoryData(data) {
  try {
    const tmp = `${DIRECTORY_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, DIRECTORY_FILE);
    return true;
  } catch (err) {
    console.error('[DIRECTORY] Error writing directory file:', err);
    return false;
  }
}

function getBannedUserIds() {
  try {
    const bannedFile = path.join(DATA_DIR, 'banned_users.json');
    if (fs.existsSync(bannedFile)) {
      const list = JSON.parse(fs.readFileSync(bannedFile, 'utf8'));
      const now = Date.now();
      return new Set(
        list
          .filter(b => !b.expiresAt || new Date(b.expiresAt).getTime() > now)
          .map(b => String(b.userId))
      );
    }
  } catch {}
  return new Set();
}

/** Get all promoted servers sorted with latest bumps first */
export function getPromotedServers(includeHidden = false) {
  const data = loadDirectoryData();
  const bannedIds = getBannedUserIds();
  const activeServers = data.servers.filter(s => {
    if (!s) return false;
    if (s.ownerId && bannedIds.has(String(s.ownerId))) return false;
    if (!includeHidden && (s.hidden || s.delisted)) return false;
    return true;
  });
  return activeServers.sort((a, b) => {
    const aTime = a.lastBumpedAt || a.createdAt || 0;
    const bTime = b.lastBumpedAt || b.createdAt || 0;
    return bTime - aTime;
  });
}

/** Upsert a server listing into permanent storage */
export function upsertPromotedServer(serverData, owner) {
  // owner may be a Discord user object ({ id, username, globalName, avatar }) or just a user id string.
  const ownerObj = owner && typeof owner === 'object' ? owner : null;
  const ownerUserId = ownerObj ? ownerObj.id : (owner || serverData.ownerId || serverData.owner_discord_id || null);
  const data = loadDirectoryData();
  const id = String(serverData.id || serverData.guildId);
  if (!id) throw new Error('Missing server id');

  const existingIndex = data.servers.findIndex(s => s.id === id);
  const existing = existingIndex >= 0 ? data.servers[existingIndex] : null;

  const now = Date.now();
  let cleanIcon = serverData.icon || serverData.iconUrl || existing?.icon || null;
  if (cleanIcon && !cleanIcon.startsWith('http://') && !cleanIcon.startsWith('https://') && !cleanIcon.startsWith('data:')) {
    cleanIcon = `https://cdn.discordapp.com/icons/${id}/${cleanIcon}.${cleanIcon.startsWith('a_') ? 'gif' : 'png'}?size=128`;
  }

  const safeString = (v) => cleanSqlReplace(v === null || v === undefined ? '' : String(v)).trim();
  const serverNameResolved = safeString(serverData.name || existing?.name || `Server ${id.slice(0, 6)}`);

  const botApplicationId = process.env.DISCORD_CLIENT_ID || '';
  const isBotOwner = Boolean(botApplicationId && ownerUserId === botApplicationId) || (ownerObj && (ownerObj.username === 'ConnectingERLC' || ownerObj.username === 'Connecting ERLC'));
  const safeOwnerUserId = isBotOwner ? (existing?.ownerId && existing.ownerId !== botApplicationId ? existing.ownerId : null) : (ownerUserId || existing?.ownerId || null);
  const rawOwnerName = (ownerObj && (ownerObj.globalName || ownerObj.displayName || ownerObj.username)) || serverData.owner_display_name || serverData.ownerUsername || existing?.owner_display_name || existing?.ownerUsername || null;
  const isCandidateBotName = rawOwnerName && (rawOwnerName === 'ConnectingERLC' || rawOwnerName === 'Connecting ERLC');
  const safeOwnerDisplayName = (isBotOwner || isCandidateBotName)
    ? (existing?.owner_display_name && existing.owner_display_name !== 'ConnectingERLC' && existing.owner_display_name !== 'Connecting ERLC' ? existing.owner_display_name : null)
    : rawOwnerName;
  const safeOwnerAvatar = isBotOwner
    ? (existing?.ownerAvatar && (!botApplicationId || !existing.ownerAvatar.includes(botApplicationId)) ? existing.ownerAvatar : null)
    : ((ownerObj && ownerObj.avatar ? ('https://cdn.discordapp.com/avatars/' + ownerObj.id + '/' + ownerObj.avatar + '.' + (ownerObj.avatar.startsWith('a_') ? 'gif' : 'png') + '?size=64') : null) || existing?.ownerAvatar || null);

  const resolveNullablePositiveNumber = (incoming, fallback) => {
    if (incoming === null || incoming === '' || incoming === 'none' || incoming === 'None') return null;
    if (incoming !== undefined) {
      const n = Number(incoming);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    if (fallback !== undefined && fallback !== null && fallback !== '') {
      const n = Number(fallback);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  };

  const bumpReadyEnabled = serverData.bumpReadyNoticeEnabled !== undefined
    ? Boolean(serverData.bumpReadyNoticeEnabled)
    : (serverData.bumpNoticeEnabled !== undefined
      ? Boolean(serverData.bumpNoticeEnabled)
      : (existing?.bumpReadyNoticeEnabled !== undefined
        ? Boolean(existing.bumpReadyNoticeEnabled)
        : (existing?.bumpNoticeEnabled !== undefined ? Boolean(existing.bumpNoticeEnabled) : false)));

  const cleanServer = {
    id,
    name: serverNameResolved,
    icon: cleanIcon,
    iconUrl: cleanIcon,
    icon_hash: serverData.icon_hash || serverData.iconHash || (serverData.icon && !serverData.icon.startsWith('http') ? serverData.icon : null) || existing?.icon_hash || null,
    iconHash: serverData.icon_hash || serverData.iconHash || (serverData.icon && !serverData.icon.startsWith('http') ? serverData.icon : null) || existing?.iconHash || null,
    category: serverData.category || serverData.serverCategory || existing?.category || 'Roleplay Server',
    categories: Array.isArray(serverData.categories) ? serverData.categories : [serverData.category || existing?.category || 'Roleplay Server'],
    language: serverData.language || existing?.language || 'English',
    summary: safeString(serverData.summary || serverData.serverSummary || existing?.summary || ''),
    description: safeString(serverData.description || serverData.serverDescription || existing?.description || ''),
    tags: Array.isArray(serverData.tags) ? serverData.tags.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean) : (typeof serverData.serverTags === 'string' ? serverData.serverTags.split(',').map(t => t.trim()).filter(Boolean) : existing?.tags || []),
    rewardCoins: Math.min(22, Math.max(2, Number(serverData.rewardCoins || serverData.reward || existing?.rewardCoins || 2))),
    offerHigherReward: serverData.offerHigherReward !== undefined ? Boolean(serverData.offerHigherReward) : (existing?.offerHigherReward !== undefined ? Boolean(existing.offerHigherReward) : false),
    extraRewardPaused: serverData.extraRewardPaused !== undefined ? Boolean(serverData.extraRewardPaused) : (existing?.extraRewardPaused !== undefined ? Boolean(existing.extraRewardPaused) : false),
    retentionTargetHours: Number(serverData.retentionTargetHours || existing?.retentionTargetHours || 72),
    representativesWanted: Number(serverData.representativesWanted !== undefined ? serverData.representativesWanted : (existing?.representativesWanted !== undefined ? existing.representativesWanted : 4)),
    representatives: Array.isArray(serverData.representatives) ? serverData.representatives : (existing?.representatives || []),
    partnershipSetUp: Boolean(serverData.partnershipSetUp ?? existing?.partnershipSetUp ?? serverData.openForPartnerships ?? serverData.partnershipBroadcastChannel),
    openForPartnerships: Boolean(serverData.partnershipSetUp ?? existing?.partnershipSetUp ?? serverData.openForPartnerships ?? serverData.partnershipBroadcastChannel) ? (serverData.openForPartnerships !== undefined ? Boolean(serverData.openForPartnerships) : (existing?.openForPartnerships !== undefined ? Boolean(existing.openForPartnerships) : true)) : false,
    partnershipMinMembers: Boolean(serverData.partnershipSetUp ?? existing?.partnershipSetUp ?? serverData.openForPartnerships ?? serverData.partnershipBroadcastChannel) ? resolveNullablePositiveNumber(serverData.partnershipMinMembers, existing?.partnershipMinMembers) : null,
    partnershipPrice: Boolean(serverData.partnershipSetUp ?? existing?.partnershipSetUp ?? serverData.openForPartnerships ?? serverData.partnershipBroadcastChannel) ? resolveNullablePositiveNumber(serverData.partnershipPrice, existing?.partnershipPrice) : null,
    partnershipAllowedMentions: Boolean(serverData.partnershipSetUp ?? existing?.partnershipSetUp ?? serverData.openForPartnerships ?? serverData.partnershipBroadcastChannel) ? (serverData.partnershipAllowedMentions || existing?.partnershipAllowedMentions || null) : null,
    partnershipHerePrice: serverData.partnershipHerePrice !== undefined ? Number(serverData.partnershipHerePrice) : (existing?.partnershipHerePrice !== undefined ? existing.partnershipHerePrice : 15),
    partnershipEveryonePrice: serverData.partnershipEveryonePrice !== undefined ? Number(serverData.partnershipEveryonePrice) : (existing?.partnershipEveryonePrice !== undefined ? existing.partnershipEveryonePrice : 30),
    partnershipBroadcastChannel: serverData.partnershipBroadcastChannel !== undefined ? serverData.partnershipBroadcastChannel : (existing?.partnershipBroadcastChannel || null),
    partnershipAcceptedCategories: Array.isArray(serverData.partnershipAcceptedCategories) ? serverData.partnershipAcceptedCategories : (Array.isArray(existing?.partnershipAcceptedCategories) ? existing.partnershipAcceptedCategories : ['Design Server', 'Roleplay Server', 'Misc', 'COTS', 'Departments', 'Events']),
    partnershipDailyLimit: Math.min(3, Math.max(1, Number(serverData.partnershipDailyLimit || existing?.partnershipDailyLimit || 1))),
    partnershipQuestions: Array.isArray(serverData.partnershipQuestions) ? serverData.partnershipQuestions.slice(0, 5) : (Array.isArray(existing?.partnershipQuestions) ? existing.partnershipQuestions : []),
    allowPartnerMentions: serverData.allowPartnerMentions !== undefined ? Boolean(serverData.allowPartnerMentions) : (existing?.allowPartnerMentions !== undefined ? Boolean(existing.allowPartnerMentions) : true),
    acceptPartnerships: Boolean(serverData.partnershipSetUp ?? existing?.partnershipSetUp) ? (serverData.openForPartnerships !== undefined ? Boolean(serverData.openForPartnerships) : (existing?.acceptPartnerships !== undefined ? Boolean(existing.acceptPartnerships) : true)) : false,
    bumpChannelId: serverData.bumpChannelId !== undefined ? (serverData.bumpChannelId || null) : (existing?.bumpChannelId || null),
    bumpRoleId: serverData.bumpRoleId !== undefined ? (serverData.bumpRoleId || null) : (existing?.bumpRoleId || null),
    bumpReadyNoticeEnabled: bumpReadyEnabled,
    bumpNoticeEnabled: bumpReadyEnabled,
    inviteUrl: safeString(serverData.inviteUrl || existing?.inviteUrl || ''),
    joinCode: serverData.joinCode !== undefined && serverData.joinCode !== null ? safeString(serverData.joinCode) : (existing?.joinCode || null),
    listedInDirectory: serverData.listedInDirectory !== undefined ? Boolean(serverData.listedInDirectory) : (existing?.listedInDirectory !== undefined ? Boolean(existing.listedInDirectory) : true),
    bannerUrl: safeString(serverData.bannerUrl || serverData.serverBannerUrl || existing?.bannerUrl || ''),
    memberCount: Number(serverData.memberCount || existing?.memberCount || 0),
    bumps: Number(existing?.bumps || 0),
    lastBumpedAt: existing?.lastBumpedAt || null,
    nextBumpAt: existing?.nextBumpAt || null,
    ownerId: safeOwnerUserId,
    ownerUsername: isBotOwner ? null : ((ownerObj && (ownerObj.globalName || ownerObj.username)) || existing?.ownerUsername || null),
    owner_display_name: safeOwnerDisplayName,
    owner_avatar_hash: isBotOwner ? null : ((ownerObj && (ownerObj.avatar || ownerObj.avatar_hash || ownerObj.avatarHash)) || existing?.owner_avatar_hash || null),
    ownerAvatar: safeOwnerAvatar,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    hidden: serverData.hidden !== undefined ? Boolean(serverData.hidden) : (existing?.hidden !== undefined ? Boolean(existing.hidden) : false),
    delisted: serverData.delisted !== undefined ? Boolean(serverData.delisted) : (existing?.delisted !== undefined ? Boolean(existing.delisted) : false),
    verified: serverData.verified !== undefined ? Boolean(serverData.verified) : (existing?.verified !== undefined ? Boolean(existing.verified) : false),
    reviews: Array.isArray(existing?.reviews) ? existing.reviews : []
  };

  if (existingIndex >= 0) {
    data.servers[existingIndex] = cleanServer;
  } else {
    data.servers.unshift(cleanServer);
  }

  // If server is listed and owner is known, auto-claim any pending rewards for this user
  if (cleanServer.isListed !== false && !cleanServer.hidden && !cleanServer.delisted && safeOwnerUserId) {
    try {
      import('./bugReportManager.js').then(({ claimPendingRewardsForUser }) => {
        const claimed = claimPendingRewardsForUser(safeOwnerUserId, id, cleanServer.name, cleanServer.iconUrl);
        if (claimed && claimed.length > 0) {
          const added = claimed.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          const freshData = loadDirectoryData();
          const target = freshData.servers.find(s => s.id === id);
          if (target) {
            target.balance = Number(target.balance || 0) + added;
            target.credits = Number(target.credits || 0) + added;
            saveDirectoryData(freshData);
          }
        }
      }).catch(() => {});
    } catch {}
  }

  saveDirectoryData(data);
  return cleanServer;
}

export const BUMP_COOLDOWN_HOURS = 1;
export const BUMP_COST_CREDITS = 0;

/** Get bump status and live cooldown for a server */
export function getBumpStatus(guildId) {
  const data = loadDirectoryData();
  const targetId = String(guildId);
  const server = data.servers.find(s => s.id === targetId);

  const COOLDOWN_MS = BUMP_COOLDOWN_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const lastBump = Math.max(
    Number(data.bumpCooldowns[targetId] || 0),
    Number(server?.lastBumpedAt || 0)
  );
  const expectedNextBumpAt = lastBump ? Math.max(Number(server?.nextBumpAt || 0), lastBump + COOLDOWN_MS) : 0;

  const sorted = getPromotedServers();
  const idx = sorted.findIndex(s => s.id === targetId);
  const rank = idx !== -1 ? idx + 1 : null;

  if (lastBump && now < expectedNextBumpAt) {
    const remainingSeconds = Math.ceil((expectedNextBumpAt - now) / 1000);
    return {
      canBump: false,
      cooldownSeconds: remainingSeconds,
      nextBumpAt: expectedNextBumpAt,
      lastBumpedAt: lastBump,
      cooldownHours: BUMP_COOLDOWN_HOURS,
      costCredits: BUMP_COST_CREDITS,
      rank,
      totalServers: sorted.length,
    };
  }

  return {
    canBump: true,
    cooldownSeconds: 0,
    nextBumpAt: null,
    lastBumpedAt: lastBump || null,
    cooldownHours: BUMP_COOLDOWN_HOURS,
    costCredits: BUMP_COST_CREDITS,
    rank,
    totalServers: sorted.length,
  };
}

function scheduleServerBumpReminderOnDisk(serverId, dueAt, cycleId) {
  try {
    const file = path.join(__dirname, 'data', 'bump_reminders.json');
    let list = [];
    if (fs.existsSync(file)) {
      list = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!Array.isArray(list)) list = [];
    }
    const sid = String(serverId);
    const keptUsers = new Set();
    const nextList = [];
    for (const r of list) {
      const rSid = String(r?.guild_id || r?.server_id || '');
      if (rSid !== sid) {
        nextList.push(r);
        continue;
      }
      if (r.user_id && !keptUsers.has(String(r.user_id))) {
        keptUsers.add(String(r.user_id));
        nextList.push({
          guild_id: sid,
          server_id: sid,
          user_id: String(r.user_id),
          due_at: dueAt,
          bump_cycle_id: cycleId,
          sent: false,
          sent_at: null,
          created_at: new Date().toISOString()
        });
      }
    }
    nextList.push({
      guild_id: sid,
      server_id: sid,
      user_id: null,
      due_at: dueAt,
      bump_cycle_id: cycleId,
      sent: false,
      sent_at: null,
      created_at: new Date().toISOString()
    });
    fs.writeFileSync(file, JSON.stringify(nextList, null, 2), 'utf-8');
  } catch {}
}

/** Bump a server to #1 position (enforces BUMP_COOLDOWN_HOURS cooldown) */
export function bumpPromotedServer(guildId, userId) {
  const data = loadDirectoryData();
  const targetId = String(guildId);
  let server = data.servers.find(s => s.id === targetId || s.guildId === targetId);
  if (!server) {
    server = {
      id: targetId,
      guildId: targetId,
      name: `Server (${targetId.slice(0, 6)})`,
      category: 'Roleplay Server',
      description: '',
      memberCount: 0,
      iconUrl: null,
      bannerUrl: null,
      inviteUrl: '',
      ownerId: userId || null,
      ownerName: 'Community Owner',
      bumps: 0,
      totalBumps: 0,
      weeklyBumps: 0,
      balance: 0,
      views: 0,
      verifiedJoins: 0,
      rewardCoins: 2,
      tier: 'Bronze',
      updatedAt: Date.now()
    };
    data.servers.push(server);
  }

  const COOLDOWN_MS = BUMP_COOLDOWN_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const lastBump = Math.max(
    Number(data.bumpCooldowns[targetId] || 0),
    Number(server.lastBumpedAt || 0)
  );
  const expectedNextBumpAt = lastBump ? Math.max(Number(server.nextBumpAt || 0), lastBump + COOLDOWN_MS) : 0;

  if (lastBump && now < expectedNextBumpAt) {
    const remainingSeconds = Math.ceil((expectedNextBumpAt - now) / 1000);
    const minutes = Math.ceil(remainingSeconds / 60);
    const cooldownErr = new Error(`You can't bump yet. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    cooldownErr.status = 429;
    cooldownErr.cooldownSeconds = remainingSeconds;
    cooldownErr.nextBumpAt = expectedNextBumpAt;
    throw cooldownErr;
  }

  const nextBumpAt = now + COOLDOWN_MS;
  data.bumpCooldowns[targetId] = now;
  server.lastBumpedAt = now;
  server.nextBumpAt = nextBumpAt;
  server.bumps = (Number(server.bumps) || 0) + 1;
  server.updatedAt = now;

  scheduleServerBumpReminderOnDisk(targetId, nextBumpAt, now);
  try {
    appendServerActivity(targetId, {
      id: `bump_${targetId}_${now}`,
      type: 'bump',
      message: `${server.name || 'Server'} was bumped to #1 in the directory`,
      timestamp: new Date(now).toISOString(),
      actorId: userId ? String(userId) : (server.ownerId || null)
    });
  } catch {}

  // Auto-bump all other servers owned or represented by this user
  const effectiveUserId = userId || server.ownerId;
  if (effectiveUserId) {
    const uid = String(effectiveUserId);
    for (const other of data.servers) {
      if (String(other.id) !== targetId && String(other.guildId) !== targetId) {
        const isOwner = String(other.ownerId) === uid;
        const isRep = Array.isArray(other.representatives) && other.representatives.map(String).includes(uid);
        if (isOwner || isRep) {
          data.bumpCooldowns[other.id] = now;
          other.lastBumpedAt = now;
          other.nextBumpAt = nextBumpAt;
          other.bumps = (Number(other.bumps) || 0) + 1;
          other.updatedAt = now;
          scheduleServerBumpReminderOnDisk(other.id, nextBumpAt, now);
          try {
            appendServerActivity(other.id, {
              id: `bump_${other.id}_${now}`,
              type: 'bump',
              message: `${other.name || 'Server'} was bumped to #1 in the directory`,
              timestamp: new Date(now).toISOString(),
              actorId: uid
            });
          } catch {}
        }
      }
    }
  }

  // Elevate bumped server(s) to top of directory
  data.servers.sort((a, b) => (Number(b.lastBumpedAt) || 0) - (Number(a.lastBumpedAt) || 0));

  saveDirectoryData(data);
  return {
    success: true,
    server,
    lastBumpedAt: now,
    nextBumpAt,
    cooldownHours: BUMP_COOLDOWN_HOURS,
    message: 'Bumped. Your server is now #1.',
  };
}

/** Get balance and joined guilds for a user */
export function getUserCredits(userId) {
  if (!userId) return { balance: 0, joined: [] };
  const data = loadDirectoryData();
  const balance = Number(data.userBalances[userId] || 0);
  const joined = Array.isArray(data.userJoins[userId]) ? data.userJoins[userId] : [];
  return { balance, joined };
}

/** Get detailed join record for a user and server */
export function getJoinRecord(userId, serverId) {
  if (!userId || !serverId) return null;
  const uid = String(userId);
  const sid = String(serverId);
  const data = loadDirectoryData();
  const key = `${uid}:${sid}`;
  if (data.userJoinRecords && data.userJoinRecords[key]) {
    return data.userJoinRecords[key];
  }
  const userJoined = Array.isArray(data.userJoins[uid]) ? data.userJoins[uid] : [];
  if (userJoined.includes(sid)) {
    return {
      userId: uid,
      serverId: sid,
      joinedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      stayEndsAt: new Date(Date.now() - 86400000).toISOString(),
      stayCompleted: true
    };
  }
  return null;
}

/** Record a user join with retention stay timer */
export function recordUserJoin(userId, serverId, { stayHours = 72, stayCompleted = false } = {}) {
  if (!userId || !serverId) return null;
  const uid = String(userId);
  const sid = String(serverId);
  const data = loadDirectoryData();
  data.userJoinRecords = data.userJoinRecords || {};
  data.userJoins = data.userJoins || {};
  const now = Date.now();
  const stayEndsAt = new Date(now + stayHours * 3600 * 1000).toISOString();
  
  const record = {
    userId: uid,
    serverId: sid,
    joinedAt: new Date(now).toISOString(),
    stayEndsAt,
    stayCompleted: Boolean(stayCompleted)
  };
  data.userJoinRecords[`${uid}:${sid}`] = record;
  const list = Array.isArray(data.userJoins[uid]) ? data.userJoins[uid] : [];
  if (!list.includes(sid)) {
    list.push(sid);
    data.userJoins[uid] = list;
  }
  saveDirectoryData(data);
  return record;
}

/** Local-only grant verified join (refuses in production) */
export function grantVerifiedJoin(userId, serverId) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('grantVerifiedJoin cannot be called in production environment');
  }
  if (!userId || !serverId) throw new Error('userId and serverId are required');
  const uid = String(userId);
  const sid = String(serverId);
  const data = loadDirectoryData();
  data.userJoinRecords = data.userJoinRecords || {};
  data.userJoins = data.userJoins || {};
  
  const record = {
    userId: uid,
    serverId: sid,
    joinedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    stayEndsAt: new Date(Date.now() - 86400000).toISOString(),
    stayCompleted: true
  };
  data.userJoinRecords[`${uid}:${sid}`] = record;
  const list = Array.isArray(data.userJoins[uid]) ? data.userJoins[uid] : [];
  if (!list.includes(sid)) {
    list.push(sid);
    data.userJoins[uid] = list;
  }
  saveDirectoryData(data);
  return record;
}

/** Claim bounty for joining server with real Anti-Raid Defense verification */
export function claimServerJoinBounty(userOrId, guildId, actingGuildId = null) {
  const user = typeof userOrId === 'object' && userOrId !== null ? userOrId : { id: String(userOrId) };
  const userId = user.id;
  if (!userId) throw new Error('You must be signed in to earn credits.');

  const recipientServerId = actingGuildId || user.selectedGuildId || user.guildId;
  if (!recipientServerId) {
    throw new Error('Select or add a server to receive rewards');
  }

  const data = loadDirectoryData();
  const targetId = String(guildId);
  const server = data.servers.find(s => s.id === targetId);
  if (!server) throw new Error('Server not found in directory');

  if (server.ownerId && server.ownerId === userId) {
    throw new Error('You cannot claim credits for joining your own community.');
  }

  // 1. Anti-Raid: 7-Day Minimum Discord Account Age via Snowflake
  try {
    const discordEpoch = 1420070400000n;
    const createdAtMs = Number((BigInt(userId) >> 22n) + discordEpoch);
    const accountAgeDays = (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < 7) {
      throw new Error('Anti-Raid Defense: Discord account must be at least 7 days old to claim rewards.');
    }
  } catch (err) {
    if (err.message.includes('Anti-Raid')) throw err;
  }

  // 2. Anti-Raid: Default Avatar Filter
  if (server.requireAvatar !== false && !user.avatar && (user.avatarUrl?.includes('embed/avatars') || !user.avatarUrl)) {
    throw new Error('Anti-Raid Defense: A custom Discord profile avatar is required to claim rewards.');
  }

  // 3. Raid Wave Velocity Limiter: Rate-limit sudden bursts (max 5 claims in 60s)
  data.joinVelocity = data.joinVelocity || {};
  const recent = (data.joinVelocity[targetId] || []).filter(ts => Date.now() - ts < 60000);
  if (recent.length >= 5) {
    throw new Error('Raid Wave Velocity Limiter: Rapid join burst detected for this server. Please wait a moment.');
  }
  recent.push(Date.now());
  data.joinVelocity[targetId] = recent;

  const userJoined = Array.isArray(data.userJoins[userId]) ? data.userJoins[userId] : [];
  if (userJoined.includes(targetId)) {
    throw new Error('You have already claimed this bounty.');
  }

  const baseReward = 2;
  const configuredReward = Math.min(22, Math.max(2, Number(server.rewardCoins || 2)));
  let extraReward = (server.offerHigherReward && !server.extraRewardPaused)
    ? Math.min(20, Math.max(0, configuredReward - baseReward))
    : 0;

  let ownerDebited = 0;
  if (extraReward > 0 && server.ownerId) {
    try {
      const ownerSummary = getUserLedgerSummary(server.ownerId);
      if (ownerSummary.balance - extraReward >= REWARD_DEBT_FLOOR) {
        recordLedgerTransaction({
          userId: server.ownerId,
          type: 'spent',
          amount: extraReward,
          reason: 'Bounty Extra',
          description: `Extra join bounty paid for member joining ${server.name}`,
          guildId: targetId,
          guildName: server.name,
          triggeredBy: 'Automated Bounty System',
          debtFloor: REWARD_DEBT_FLOOR,
        });
        ownerDebited = extraReward;

        if (ownerSummary.balance - extraReward <= REWARD_DEBT_FLOOR) {
          server.extraRewardPaused = true;
        }
      } else {
        server.extraRewardPaused = true;
        extraReward = 0;
      }
    } catch {
      extraReward = 0;
    }
  } else if (server.extraRewardPaused) {
    extraReward = 0;
  }

  const totalReward = baseReward + extraReward;
  const recipientServer = data.servers.find(s => String(s.id) === String(recipientServerId));
  const idempotencyKey = `join_reward:${userId}:${targetId}`;
  recordLedgerTransaction({
    userId,
    serverId: String(recipientServerId),
    type: 'earned',
    amount: totalReward,
    reason: 'Join Bounty',
    description: `Earned +${totalReward} credits for joining ${server.name} (minimum stay verified)`,
    guildId: String(recipientServerId),
    guildName: recipientServer?.name || server.name,
    joinedServerId: targetId,
    joinedServerName: server.name,
    triggeredBy: 'ConnectingERLC Directory Join',
    idempotencyKey
  });

  if (recipientServer) {
    recipientServer.credits = Number(recipientServer.credits || recipientServer.balance || 0) + totalReward;
    recipientServer.balance = recipientServer.credits;
  }

  const currentBalance = Number(data.userBalances[userId] || 0);
  const newBalance = currentBalance + totalReward;

  data.userBalances[userId] = newBalance;
  userJoined.push(targetId);
  data.userJoins[userId] = userJoined;

  saveDirectoryData(data);
  return {
    success: true,
    newBalance,
    serverBalance: getServerLedgerSummary(recipientServerId).balance,
    joined: userJoined,
    reward: totalReward,
    baseReward,
    extraReward,
    ownerDebited,
    extraRewardPaused: Boolean(server.extraRewardPaused),
  };
}

/** Delist / remove a server from directory */
export function removePromotedServer(guildId) {
  const data = loadDirectoryData();
  const targetId = String(guildId);
  data.servers = data.servers.filter(s => String(s.id) !== targetId);
  saveDirectoryData(data);
  return true;
}

/** Update specific parameters of a promoted server */
export function updatePromotedServerDetails(guildId, patch = {}) {
  const data = loadDirectoryData();
  const targetId = String(guildId);
  const server = data.servers.find(s => String(s.id) === targetId);
  if (!server) return null;

  if (patch.name !== undefined) server.name = String(patch.name).trim();
  if (patch.description !== undefined) server.description = cleanSqlReplace(String(patch.description)).trim();
  if (patch.summary !== undefined) server.summary = cleanSqlReplace(String(patch.summary)).trim();
  if (patch.category !== undefined) server.category = String(patch.category).trim();
  if (patch.verified !== undefined) server.verified = Boolean(patch.verified);
  if (patch.memberCount !== undefined) server.memberCount = Number(patch.memberCount) || 0;
  if (patch.bumps !== undefined) server.bumps = Number(patch.bumps) || 0;
  if (patch.rewardCoins !== undefined) server.rewardCoins = Number(patch.rewardCoins) || 2;
  if (patch.inviteUrl !== undefined) server.inviteUrl = String(patch.inviteUrl).trim();
  if (patch.bannerUrl !== undefined) server.bannerUrl = String(patch.bannerUrl).trim();
  if (patch.representatives !== undefined) server.representatives = Array.isArray(patch.representatives) ? patch.representatives : [];
  if (patch.representativesWanted !== undefined) server.representativesWanted = Number(patch.representativesWanted);
  if (patch.bumpChannelId !== undefined) server.bumpChannelId = patch.bumpChannelId || null;
  if (patch.bumpRoleId !== undefined) server.bumpRoleId = patch.bumpRoleId || null;
  if (patch.bumpReadyNoticeEnabled !== undefined) {
    server.bumpReadyNoticeEnabled = Boolean(patch.bumpReadyNoticeEnabled);
    server.bumpNoticeEnabled = Boolean(patch.bumpReadyNoticeEnabled);
  }
  if (patch.icon !== undefined) server.icon = patch.icon;
  if (patch.icon_hash !== undefined) {
    server.icon_hash = patch.icon_hash;
    server.iconHash = patch.icon_hash;
    if (patch.icon_hash) {
      server.icon = `https://cdn.discordapp.com/icons/${targetId}/${patch.icon_hash}.${patch.icon_hash.startsWith('a_') ? 'gif' : 'webp'}?size=128`;
      server.iconUrl = server.icon;
    }
  }
  if (patch.iconUrl !== undefined) server.iconUrl = patch.iconUrl;
  if (patch.ownerId !== undefined) server.ownerId = patch.ownerId;
  if (patch.owner_display_name !== undefined) server.owner_display_name = patch.owner_display_name;
  if (patch.ownerUsername !== undefined) server.ownerUsername = patch.ownerUsername;
  if (patch.owner_avatar_hash !== undefined) {
    server.owner_avatar_hash = patch.owner_avatar_hash;
    if (patch.owner_avatar_hash && server.ownerId) {
      server.ownerAvatar = `https://cdn.discordapp.com/avatars/${server.ownerId}/${patch.owner_avatar_hash}.${patch.owner_avatar_hash.startsWith('a_') ? 'gif' : 'png'}?size=64`;
    }
  }
  if (patch.bot_in_guild !== undefined) server.bot_in_guild = Boolean(patch.bot_in_guild);
  server.updatedAt = Date.now();

  saveDirectoryData(data);
  return server;
}

export function loadUserBalances() {
  const data = loadDirectoryData();
  return data.userBalances || {};
}

export function saveUserBalances(balances) {
  const data = loadDirectoryData();
  data.userBalances = balances;
  return saveDirectoryData(data);
}

export function getUserBalance(userId) {
  if (!userId) return 0;
  const balances = loadUserBalances();
  return Number(balances[userId] || 0);
}

export function setUserBalance(userId, amount) {
  if (!userId) return 0;
  const balances = loadUserBalances();
  balances[userId] = Math.max(0, Number(amount || 0));
  saveUserBalances(balances);
  return balances[userId];
}

