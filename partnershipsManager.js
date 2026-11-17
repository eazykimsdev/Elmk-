import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import { getPromotedServers, loadUserBalances, saveUserBalances, getUserCredits } from './directoryManager.js';
import { recordLedgerTransaction, appendServerActivity, getServerLedgerSummary, getUserLedgerSummary } from './ledgerManager.js';
import { sendPartnershipRequestDM, sendDirectNotificationV2 } from './discordNotificationManager.js';
import { getAdminSettings } from './premiumManager.js';

function addServerCreditTransaction(guildId, { amount, category, description, idempotencyKey }) {
  try {
    recordLedgerTransaction({
      userId: `guild_${guildId}`,
      guildId,
      type: amount > 0 ? 'earned' : 'spent',
      amount: Math.abs(amount),
      reason: description,
      description
    });
  } catch (err) {
    // Graceful fallback
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const PARTNERSHIPS_FILE = path.join(DATA_DIR, 'partnerships.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// AES-256-GCM encryption for webhooks (never logged, stored encrypted)
const WEBHOOK_SECRET = process.env.WEBHOOK_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'mavely_webhook_secure_salt_2026';
const WEBHOOK_KEY = crypto.createHash('sha256').update(WEBHOOK_SECRET).digest();

export function encryptWebhook(plainUrl) {
  if (!plainUrl || typeof plainUrl !== 'string') return '';
  const trimmed = plainUrl.trim();
  if (!trimmed) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', WEBHOOK_KEY, iv);
  let encrypted = cipher.update(trimmed, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptWebhook(cipherPayload) {
  if (!cipherPayload || typeof cipherPayload !== 'string') return null;
  if (cipherPayload.startsWith('https://')) return cipherPayload; // Fallback for pre-existing unencrypted strings
  try {
    const [ivHex, tagHex, encryptedHex] = cipherPayload.split(':');
    if (!ivHex || !tagHex || !encryptedHex) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', WEBHOOK_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

export function loadPartnershipsData() {
  try {
    if (fs.existsSync(PARTNERSHIPS_FILE)) {
      const raw = fs.readFileSync(PARTNERSHIPS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        partnerships: Array.isArray(parsed?.partnerships) ? parsed.partnerships : [],
        requests: Array.isArray(parsed?.requests) ? parsed.requests : [],
        serverConfigs: parsed?.serverConfigs && typeof parsed.serverConfigs === 'object' ? parsed.serverConfigs : {},
        transactions: Array.isArray(parsed?.transactions) ? parsed.transactions : [],
        analytics: parsed?.analytics && typeof parsed.analytics === 'object' ? parsed.analytics : {},
        achievements: parsed?.achievements && typeof parsed.achievements === 'object' ? parsed.achievements : {},
        milestones: parsed?.milestones && typeof parsed.milestones === 'object' ? parsed.milestones : {}
      };
    }
  } catch (err) {
    console.warn('[PARTNERSHIPS] Error reading partnerships data file:', err.message);
  }
  return {
    partnerships: [],
    requests: [],
    serverConfigs: {},
    transactions: [],
    analytics: {},
    achievements: {},
    milestones: {}
  };
}
export function savePartnershipsData(data) {
  try {
    const tmp = `${PARTNERSHIPS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, PARTNERSHIPS_FILE);
    return true;
  } catch (err) {
    console.error('[PARTNERSHIPS] Error saving partnerships data file:', err);
    return false;
  }
}

/** Validate Discord Webhook URL */
export function isValidDiscordWebhookUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/i.test(url.trim());
}

function resolveNullableRequirementNumber(valA, valB) {
  for (const v of [valA, valB]) {
    if (v === null || v === '' || v === 'none' || v === 'None') return null;
    if (v !== undefined) {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  return null;
}

/** Get partnership configuration for a specific guild (merges serverConfigs + promoted_servers.json) */
export function getGuildPartnershipConfig(guildId) {
  const data = loadPartnershipsData();
  const cfg = data.serverConfigs[guildId] || {};
  const allServers = getPromotedServers(true);
  const server = allServers.find(s => String(s.id) === String(guildId) || String(s.guildId) === String(guildId)) || null;

  const mergedChannelId = cfg.partnershipChannelId || server?.partnershipBroadcastChannel || '';
  const isSetUp = Boolean(
    cfg.partnershipSetUp !== undefined
      ? cfg.partnershipSetUp
      : (server?.partnershipSetUp || Boolean(mergedChannelId))
  );

  const openFlag = cfg.acceptPartnerships !== undefined
    ? Boolean(cfg.acceptPartnerships)
    : (server?.openForPartnerships !== undefined
      ? Boolean(server.openForPartnerships)
      : (server?.acceptPartnerships !== undefined ? Boolean(server.acceptPartnerships) : true));

  const mode = cfg.partnershipMode || (!openFlag ? 'closed' : cfg.autoAccept ? 'open' : 'selective');
  const minMembers = isSetUp ? resolveNullableRequirementNumber(cfg.partnershipMinMembers, server?.partnershipMinMembers) : null;
  const price = isSetUp ? resolveNullableRequirementNumber(cfg.partnershipPrice, server?.partnershipPrice) : null;

  return {
    partnershipSetUp: isSetUp,
    acceptPartnerships: isSetUp && mode !== 'closed' && openFlag,
    openForPartnerships: isSetUp && mode !== 'closed' && openFlag,
    partnershipMode: isSetUp ? mode : 'closed',
    partnershipChannelId: mergedChannelId,
    partnershipBroadcastChannel: mergedChannelId || null,
    partnershipChannelName: cfg.partnershipChannelName || '',
    partnershipAdText: cfg.partnershipAdText || server?.partnershipAdText || server?.description || '',
    allowPartnerMentions: isSetUp
      ? Boolean(cfg.allowPartnerMentions !== undefined ? cfg.allowPartnerMentions : server?.allowPartnerMentions)
      : false,
    partnershipMinMembers: minMembers,
    partnershipPrice: price,
    partnershipAllowedMentions: isSetUp
      ? (cfg.partnershipAllowedMentions || server?.partnershipAllowedMentions || 'none')
      : null,
    partnershipHerePrice: isSetUp && (cfg.partnershipHerePrice !== undefined || server?.partnershipHerePrice !== undefined)
      ? Number(cfg.partnershipHerePrice ?? server?.partnershipHerePrice ?? 15)
      : null,
    partnershipEveryonePrice: isSetUp && (cfg.partnershipEveryonePrice !== undefined || server?.partnershipEveryonePrice !== undefined)
      ? Number(cfg.partnershipEveryonePrice ?? server?.partnershipEveryonePrice ?? 30)
      : null,
    partnershipDailyLimit: isSetUp
      ? Number(cfg.partnershipDailyLimit || server?.partnershipDailyLimit || 3)
      : null,
    partnershipAcceptedCategories: Array.isArray(cfg.partnershipAcceptedCategories)
      ? cfg.partnershipAcceptedCategories
      : (Array.isArray(server?.partnershipAcceptedCategories)
        ? server.partnershipAcceptedCategories
        : ['Design Server', 'Roleplay Server', 'Misc', 'COTS', 'Departments', 'Events']),
    partnershipQuestions: Array.isArray(cfg.partnershipQuestions)
      ? cfg.partnershipQuestions.slice(0, 5)
      : (Array.isArray(server?.partnershipQuestions) ? server.partnershipQuestions.slice(0, 5) : []),
    lastAdSentAt: cfg.lastAdSentAt || 0
  };
}

/** Update partnership configuration for a specific guild */
export function updateGuildPartnershipConfig(guildId, patch) {
  const data = loadPartnershipsData();
  const current = data.serverConfigs[guildId] || {};
  const explicitSetUp = patch.partnershipSetUp !== undefined ? Boolean(patch.partnershipSetUp) : true;
  const cleanPatch = { ...patch, partnershipSetUp: explicitSetUp };

  if ('partnershipMinMembers' in cleanPatch) {
    cleanPatch.partnershipMinMembers = resolveNullableRequirementNumber(cleanPatch.partnershipMinMembers, undefined);
  }
  if ('partnershipPrice' in cleanPatch) {
    cleanPatch.partnershipPrice = resolveNullableRequirementNumber(cleanPatch.partnershipPrice, undefined);
  }

  // Handle mode selection: closed | selective | open
  if (cleanPatch.partnershipMode) {
    if (cleanPatch.partnershipMode === 'closed') {
      cleanPatch.acceptPartnerships = false;
      cleanPatch.autoAccept = false;
    } else if (cleanPatch.partnershipMode === 'open') {
      cleanPatch.acceptPartnerships = true;
      cleanPatch.autoAccept = true;
    } else {
      cleanPatch.acceptPartnerships = true;
      cleanPatch.autoAccept = false;
    }
  }

  data.serverConfigs[guildId] = {
    ...current,
    ...cleanPatch,
    updatedAt: Date.now()
  };

  savePartnershipsData(data);
  return getGuildPartnershipConfig(guildId);
}

/** Get list of public servers eligible for partnership, with private credentials sanitized */
export function getPartnerEligibleServers(currentGuildId) {
  const allServers = getPromotedServers();
  const data = loadPartnershipsData();

  return allServers
    .filter(server => {
      if (String(server.id) === String(currentGuildId)) return false;
      const cfg = data.serverConfigs[server.id] || {};
      const isSetUp = Boolean(cfg.partnershipSetUp || server.partnershipSetUp);
      const savedMin = resolveNullableRequirementNumber(cfg.partnershipMinMembers, server.partnershipMinMembers);
      const savedPrice = resolveNullableRequirementNumber(cfg.partnershipPrice, server.partnershipPrice);
      const savedMentions = cfg.partnershipAllowedMentions || server.partnershipAllowedMentions || null;
      // Owner must have partnership settings saved (Min representatives/members, cost, mentions)
      if (!isSetUp) return false;
      if (savedMin === null && savedPrice === null && !savedMentions) return false;
      return true;
    })
    .map(server => {
      const cfg = data.serverConfigs[server.id] || {};
      const isSetUp = Boolean(cfg.partnershipSetUp || server.partnershipSetUp);
      const mode = cfg.partnershipMode || (cfg.acceptPartnerships === false ? 'closed' : cfg.autoAccept ? 'open' : 'selective');
      const acceptPartnerships = isSetUp && mode !== 'closed';

      // Check if existing partnership exists
      const existingPart = data.partnerships.find(p =>
        p.status === 'active' &&
        ((String(p.guildIdA) === String(currentGuildId) && String(p.guildIdB) === String(server.id)) ||
         (String(p.guildIdB) === String(currentGuildId) && String(p.guildIdA) === String(server.id)))
      );

      // Check if pending request exists
      const existingReq = data.requests.find(r =>
        r.status === 'pending' &&
        ((String(r.fromGuildId) === String(currentGuildId) && String(r.toGuildId) === String(server.id)) ||
         (String(r.toGuildId) === String(currentGuildId) && String(r.fromGuildId) === String(server.id)))
      );

      const savedMin = resolveNullableRequirementNumber(cfg.partnershipMinMembers, server.partnershipMinMembers);
      const savedPrice = resolveNullableRequirementNumber(cfg.partnershipPrice, server.partnershipPrice);
      const savedMentions = cfg.partnershipAllowedMentions || server.partnershipAllowedMentions || null;

      return {
        id: server.id,
        name: server.name,
        icon: server.icon || server.iconUrl,
        iconUrl: server.iconUrl || server.icon,
        category: server.category || '',
        memberCount: server.memberCount ? Number(server.memberCount) : null,
        ownerId: server.ownerId || null,
        ownerUsername: server.ownerUsername || null,
        ownerAvatar: server.ownerAvatar || null,
        description: server.description || '',
        summary: server.summary || server.description || '',
        bannerUrl: server.bannerUrl || '',
        inviteUrl: server.inviteUrl || '',
        verified: Boolean(server.verified),
        partnershipSetUp: isSetUp,
        acceptPartnerships,
        partnershipMode: isSetUp ? mode : 'closed',
        allowPartnerMentions: isSetUp ? (cfg.allowPartnerMentions !== false) : false,
        partnershipPrice: isSetUp ? savedPrice : null,
        partnershipHerePrice: isSetUp && cfg.partnershipHerePrice !== undefined ? Number(cfg.partnershipHerePrice) : null,
        partnershipEveryonePrice: isSetUp && cfg.partnershipEveryonePrice !== undefined ? Number(cfg.partnershipEveryonePrice) : null,
        minMembersRequired: isSetUp ? savedMin : null,
        partnershipAllowedMentions: isSetUp ? savedMentions : null,
        partnershipDailyLimit: isSetUp ? Number(cfg.partnershipDailyLimit || 3) : null,
        partnershipQuestions: isSetUp ? (Array.isArray(cfg.partnershipQuestions) ? cfg.partnershipQuestions.slice(0, 5) : (Array.isArray(server.partnershipQuestions) ? server.partnershipQuestions.slice(0, 5) : [])) : [],
        adTextPreview: cfg.partnershipAdText || server.description || '',
        partnershipStatus: existingPart ? 'partnered' : existingReq ? (existingReq.fromGuildId === currentGuildId ? 'outgoing_pending' : 'incoming_pending') : 'available'
      };
    });
}

/** Milestone rewards configuration */
const PARTNERSHIP_MILESTONES = [
  { id: 'm1', title: 'First Alliance', targetCount: 1, rewardCredits: 10 },
  { id: 'm2', title: 'Network Builder', targetCount: 3, rewardCredits: 25 },
  { id: 'm3', title: 'Coalition Leader', targetCount: 5, rewardCredits: 50 },
  { id: 'm4', title: 'Alliance Titan', targetCount: 10, rewardCredits: 100 }
];

/** Get complete partnership dashboard state for a guild */
export function getGuildPartnershipsDashboard(guildId, userId) {
  const data = loadPartnershipsData();
  const allServers = getPromotedServers();
  const myConfig = getGuildPartnershipConfig(guildId);

  // Active partnerships
  const activePartnerships = data.partnerships
    .filter(p => (p.status === 'active' || p.status === 'paused') && (String(p.guildIdA) === String(guildId) || String(p.guildIdB) === String(guildId)))
    .map(p => {
      const isA = String(p.guildIdA) === String(guildId);
      const otherId = isA ? p.guildIdB : p.guildIdA;
      const otherServer = allServers.find(s => String(s.id) === String(otherId)) || {};
      const otherCfg = data.serverConfigs[otherId] || {};

      return {
        id: p.id,
        partnerGuildId: otherId,
        partnerGuildName: isA ? p.guildNameB : p.guildNameA,
        partnerGuildIcon: isA ? p.guildIconB : p.guildIconA,
        partnerCategory: otherServer.category || 'Roleplay Server',
        partnerMemberCount: Number(otherServer.memberCount) > 0 ? Number(otherServer.memberCount) : 0,
        partnerInviteUrl: otherServer.inviteUrl || '',
        partnerBannerUrl: otherServer.bannerUrl || '',
        status: p.status || 'active',
        since: p.acceptedAt ? new Date(p.acceptedAt).toISOString().split('T')[0] : 'Recent',
        acceptedAt: p.acceptedAt || 0,
        lastAdSentAt: isA ? p.lastAdSentAtA : p.lastAdSentAtB,
        lastBroadcast: (isA ? p.lastAdSentAtA : p.lastAdSentAtB) ? new Date(isA ? p.lastAdSentAtA : p.lastAdSentAtB).toISOString().split('T')[0] : 'None yet',
        totalAdsSent: p.totalAdsSent || 1,
        verifiedJoins: p.verifiedJoins || 0,
        pageVisits: p.pageVisits || 0,
        allowMentions: Boolean(otherCfg.allowPartnerMentions)
      };
    });

  // Incoming requests: toGuildId === current server
  const incomingRequests = data.requests
    .filter(r => String(r.toGuildId) === String(guildId) && r.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(r => {
      const senderServer = allServers.find(s => String(s.id) === String(r.fromGuildId)) || {};
      const senderCfg = data.serverConfigs[r.fromGuildId] || {};
      return {
        ...r,
        senderCategory: senderServer.category || 'Roleplay Server',
        senderMemberCount: Number(senderServer.memberCount) || 0,
        senderBannerUrl: senderServer.bannerUrl || r.bannerUrl || '',
        senderIcon: senderServer.icon || senderServer.iconUrl || r.fromGuildIcon || null,
        senderName: senderServer.name || r.fromGuildName,
        terms: {
          minMembers: Number(senderCfg.partnershipMinMembers !== undefined ? senderCfg.partnershipMinMembers : 0),
          price: Number(senderCfg.partnershipPrice || 0),
          allowedMentions: senderCfg.allowPartnerMentions ? (senderCfg.partnershipAllowedMentions || 'none') : 'none'
        }
      };
    });

  // Outgoing requests: fromGuildId === current server
  const outgoingRequests = data.requests
    .filter(r => String(r.fromGuildId) === String(guildId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(r => {
      const targetServer = allServers.find(s => String(s.id) === String(r.toGuildId)) || {};
      const targetCfg = data.serverConfigs[r.toGuildId] || {};
      return {
        ...r,
        targetCategory: targetServer.category || 'Roleplay Server',
        targetMemberCount: Number(targetServer.memberCount) || 0,
        targetBannerUrl: targetServer.bannerUrl || '',
        targetIcon: targetServer.icon || targetServer.iconUrl || r.toGuildIcon || null,
        targetName: targetServer.name || r.toGuildName,
        terms: {
          minMembers: Number(targetCfg.partnershipMinMembers !== undefined ? targetCfg.partnershipMinMembers : 0),
          price: Number(targetCfg.partnershipPrice || 0),
          allowedMentions: targetCfg.allowPartnerMentions ? (targetCfg.partnershipAllowedMentions || 'none') : 'none'
        }
      };
    });

  // Broadcasts sent count
  const broadcastsSent = activePartnerships.reduce((sum, p) => sum + (p.totalAdsSent || 1), 0);

  // Guild Milestones
  const guildMilestonesState = data.milestones[guildId] || {};
  const activeCount = activePartnerships.length;
  const now = Date.now();

  const milestones = PARTNERSHIP_MILESTONES.map(m => {
    const state = guildMilestonesState[m.id] || {};
    const claimed = Boolean(state.claimed);
    const cooldownEndsAt = state.cooldownEndsAt || 0;
    const onCooldown = cooldownEndsAt > now;

    let cooldownLabel = '';
    if (onCooldown) {
      const diffMs = cooldownEndsAt - now;
      const hours = Math.floor(diffMs / (3600 * 1000));
      const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
      cooldownLabel = `Available in ${hours}h ${mins}m`;
    }

    return {
      ...m,
      currentProgress: Math.min(activeCount, m.targetCount),
      claimed,
      onCooldown,
      cooldownLabel,
      canClaim: activeCount >= m.targetCount && !claimed && !onCooldown
    };
  });

  return {
    settings: myConfig,
    activePartnerships,
    incomingRequests,
    outgoingRequests,
    summary: {
      activeCount: activePartnerships.length,
      waitingCount: incomingRequests.length,
      broadcastsSent
    },
    milestones
  };
}

/** Create a new partnership request with auto-accept in Open mode */
export async function createPartnershipRequest({
  fromGuildId,
  fromGuildName,
  fromGuildIcon,
  fromOwnerId,
  toGuildId,
  includeMention = false,
  mentionType = 'none',
  customAdText = '',
  customAnswers = [],
  userCoinBalance = 0
}) {
  if (String(fromGuildId) === String(toGuildId)) {
    throw new Error('You cannot send a partnership request to your own server.');
  }

  const data = loadPartnershipsData();
  const targetConfig = getGuildPartnershipConfig(toGuildId);
  const allServers = getPromotedServers();
  const senderServer = allServers.find(s => String(s.id) === String(fromGuildId));
  const targetServer = allServers.find(s => String(s.id) === String(toGuildId));

  const isTargetSetUp = Boolean(targetConfig.partnershipSetUp || targetServer?.partnershipSetUp);
  if (!isTargetSetUp) {
    throw new Error('This community has not set up partnerships yet.');
  }

  if (targetConfig.partnershipMode === 'closed' || targetConfig.acceptPartnerships === false) {
    throw new Error('This community is currently closed to new partnership requests.');
  }

  // Validate custom screening questions defined by the target server owner
  const targetQuestions = targetConfig.partnershipQuestions || targetServer?.partnershipQuestions || [];
  const cleanAnswers = [];
  if (Array.isArray(targetQuestions) && targetQuestions.length > 0) {
    for (const q of targetQuestions.slice(0, 5)) {
      const match = (customAnswers || []).find((a) => a.questionId === q.id || a.question === q.question);
      const rawAns = String(match?.answer || '').trim();
      if (q.required && !rawAns) {
        throw new Error(`Please answer the required question: "${q.question}"`);
      }
      if (rawAns) {
        cleanAnswers.push({
          question: String(q.question).slice(0, 120),
          answer: String(rawAns).slice(0, 500).replace(/<[^>]*>?/gm, '') // escaped and length-limited
        });
      }
    }
  }

  // Check duplicate active partnership
  const existingActive = data.partnerships.find(p =>
    (p.status === 'active' || p.status === 'paused') &&
    ((String(p.guildIdA) === String(fromGuildId) && String(p.guildIdB) === String(toGuildId)) ||
     (String(p.guildIdB) === String(fromGuildId) && String(p.guildIdA) === String(toGuildId)))
  );
  if (existingActive) {
    throw new Error('Your server is already partnered with this community.');
  }

  // Check duplicate pending request (strictly only one open request per pair of servers)
  const existingPending = data.requests.find(r =>
    r.status === 'pending' &&
    ((String(r.fromGuildId) === String(fromGuildId) && String(r.toGuildId) === String(toGuildId)) ||
     (String(r.toGuildId) === String(fromGuildId) && String(r.fromGuildId) === String(toGuildId)))
  );
  if (existingPending) {
    throw new Error('A pending partnership request already exists between these two servers.');
  }

  // Check minimum member requirements (only if set by owner)
  const minMembers = targetConfig.partnershipMinMembers !== null && targetConfig.partnershipMinMembers !== undefined
    ? Number(targetConfig.partnershipMinMembers)
    : 0;
  if (minMembers > 0 && senderServer && Number(senderServer.memberCount || 0) < minMembers) {
    throw new Error(`This server requires a minimum of ${minMembers} members to partner.`);
  }

  // Calculate mention pricing
  let coinsCost = Number(targetConfig.partnershipPrice || 0);
  const effectiveMentionType = mentionType === 'here' ? 'here' : mentionType === 'everyone' ? 'everyone' : 'none';
  const effectiveIncludeMention = includeMention && effectiveMentionType !== 'none';

  if (effectiveIncludeMention) {
    const allowed = (targetConfig.allowPartnerMentions && targetConfig.partnershipAllowedMentions) ? targetConfig.partnershipAllowedMentions : 'none';
    if (allowed === 'none') {
      throw new Error('Target server does not accept partner mentions');
    }
    if (effectiveMentionType === 'everyone' && allowed !== 'everyone') {
      throw new Error('Target server only allows @here mentions');
    }
    const mentionCost = effectiveMentionType === 'here'
      ? Number(targetConfig.partnershipHerePrice || 15)
      : Number(targetConfig.partnershipEveryonePrice || 25);
    coinsCost += mentionCost;
  }

  // Debit coins if cost > 0 (check server treasury & user ledger balance)
  if (coinsCost > 0) {
    const serverBalance = fromGuildId ? Number(getServerLedgerSummary(fromGuildId)?.balance || 0) : 0;
    const userLedgerBalance = fromOwnerId ? Number(getUserLedgerSummary(fromOwnerId)?.balance || 0) : 0;
    const balances = loadUserBalances();
    const legacyBalance = fromOwnerId ? Number(balances[fromOwnerId] || 0) : 0;
    const effectiveBalance = Math.max(serverBalance, userLedgerBalance, legacyBalance, Number(userCoinBalance || 0));

    if (effectiveBalance < coinsCost) {
      throw new Error(`You need at least ${coinsCost} credits to send this proposal.`);
    }

    if (fromOwnerId && legacyBalance >= coinsCost) {
      balances[fromOwnerId] = legacyBalance - coinsCost;
      saveUserBalances(balances);
    }

    // Ledger record
    try {
      addServerCreditTransaction(fromGuildId, {
        amount: -coinsCost,
        category: 'spend',
        description: `Partnership proposal fee to ${targetServer?.name || toGuildId}`,
        idempotencyKey: `part_req_${Date.now()}_${fromGuildId}`
      });
    } catch {}
  }

  const sanitizedAdText = (customAdText || '').replace(/@(everyone|here)/gi, '').trim();
  const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const newRequest = {
    id: requestId,
    fromGuildId,
    fromGuildName: fromGuildName || senderServer?.name || 'Partner Server',
    fromGuildIcon: fromGuildIcon || senderServer?.icon || senderServer?.iconUrl || null,
    fromOwnerId,
    toGuildId,
    toGuildName: targetServer?.name || 'Target Server',
    toGuildIcon: targetServer?.icon || targetServer?.iconUrl || null,
    status: 'pending',
    includeMention: Boolean(effectiveIncludeMention),
    mentionType: effectiveMentionType,
    coinsPaid: coinsCost,
    adText: sanitizedAdText || senderServer?.description || '',
    inviteUrl: senderServer?.inviteUrl || '',
    bannerUrl: senderServer?.bannerUrl || '',
    customAnswers: cleanAnswers,
    createdAt: Date.now()
  };

  data.requests.unshift(newRequest);
  savePartnershipsData(data);

  // Auto-accept in Open mode
  if (targetConfig.partnershipMode === 'open') {
    const meetsMembers = (senderServer?.memberCount || 0) >= minMembers;
    if (meetsMembers) {
      try {
        await respondToPartnershipRequest({
          requestId,
          action: 'accept',
          guildId: toGuildId,
          responderUserId: targetServer?.ownerId || 'auto_open_system'
        });
        newRequest.status = 'accepted';
      } catch (autoErr) {
        console.warn('[PARTNERSHIPS] Auto-accept warning:', autoErr.message);
      }
    }
  } else {
    // Selective mode: Dispatch Discord DM to target server owner if feature flag is active
    const dmsEnabled = process.env.PARTNERSHIP_DMS_ENABLED === 'true';
    const targetOwnerId = targetServer?.ownerId || data.serverConfigs[toGuildId]?.ownerId;

    if (dmsEnabled && targetOwnerId) {
      try {
        await sendPartnershipRequestDM({
          targetUserId: targetOwnerId,
          fromServer: {
            id: fromGuildId,
            name: newRequest.fromGuildName,
            icon: newRequest.fromGuildIcon,
            memberCount: senderServer?.memberCount || 0
          },
          fromUser: {
            id: fromOwnerId,
            username: senderServer?.ownerUsername || 'Server Representative'
          },
          toServer: {
            id: toGuildId,
            name: newRequest.toGuildName
          },
          terms: {
            minMembers,
            mention: targetConfig.partnershipAllowedMentions || 'none'
          },
          customAnswers: cleanAnswers,
          requestId,
          isSample: false
        });
        newRequest.dmSent = true;
      } catch (dmErr) {
        console.warn(`[PARTNERSHIPS] Notice: Could not DM owner ${targetOwnerId} (DMs closed or unavailable):`, dmErr.message);
        newRequest.dmSent = false;
        newRequest.dmNotice = 'Partnership proposal saved to community dashboard. Notice: The server owner could not be reached via direct message (DMs closed or unavailable).';
      }
    } else if (!dmsEnabled) {
      newRequest.dmSent = false;
      newRequest.dmNotice = 'Partnership proposal saved to community dashboard.';
    }
  }

  return newRequest;
}

async function postChannelMessage(channelId, content) {
  if (!channelId) throw new Error('Missing channelId');
  const token = (process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) {
    return { ok: true, simulated: true };
  }
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(typeof content === 'string' ? { content } : content)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Discord API error ${res.status}: ${txt}`);
  }
  return await res.json();
}

/** Respond to a partnership request (Accept or Decline) */
export async function respondToPartnershipRequest({ requestId, action, guildId, responderUserId }) {
  const data = loadPartnershipsData();
  const reqIndex = data.requests.findIndex(r => r.id === requestId && String(r.toGuildId) === String(guildId));

  if (reqIndex < 0) {
    throw new Error('Partnership request not found or you are not authorized to respond.');
  }

  const req = data.requests[reqIndex];
  if (req.status !== 'pending') {
    throw new Error(`This request has already been ${req.status}.`);
  }

  const allServers = getPromotedServers();
  const serverA = allServers.find(s => String(s.id) === String(req.fromGuildId)) || { id: req.fromGuildId, name: req.fromGuildName };
  const serverB = allServers.find(s => String(s.id) === String(req.toGuildId)) || { id: req.toGuildId, name: req.toGuildName };

  const configA = getGuildPartnershipConfig(req.fromGuildId);
  const configB = getGuildPartnershipConfig(req.toGuildId);

  if (action === 'accept') {
    let channelDeliveries = { aToB: false, bToA: false };
    const deliveryErrors = [];

    // Post Server A ad to Server B's promotion channel
    if (configB.partnershipBroadcastChannel && configB.partnershipAdText) {
      try {
        const allServers = getPromotedServers();
        const serverA = allServers.find(s => String(s.id) === String(req.fromGuildId)) || { id: req.fromGuildId, name: req.fromGuildName };
        const adContent = req.adText || configA.partnershipAdText || serverA.description;
        await postChannelMessage(configB.partnershipBroadcastChannel, adContent);
        channelDeliveries.aToB = true;
      } catch (err) {
        deliveryErrors.push(`Server B channel: ${err.message}`);
      }
    }

    // Post Server B ad to Server A's promotion channel
    if (configA.partnershipBroadcastChannel && configA.partnershipAdText) {
      try {
        const allServers = getPromotedServers();
        const serverB = allServers.find(s => String(s.id) === String(req.toGuildId)) || { id: req.toGuildId, name: req.toGuildName };
        const adContent = configB.partnershipAdText || serverB.description;
        await postChannelMessage(configA.partnershipBroadcastChannel, adContent);
        channelDeliveries.bToA = true;
      } catch (err) {
        deliveryErrors.push(`Server A channel: ${err.message}`);
      }
    }

    // Create active partnership
    const partnershipId = `part_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const newPartnership = {
      id: partnershipId,
      guildIdA: req.fromGuildId,
      guildNameA: serverA.name,
      guildIconA: serverA.icon || serverA.iconUrl || req.fromGuildIcon || null,
      guildIdB: req.toGuildId,
      guildNameB: serverB.name,
      guildIconB: serverB.icon || serverB.iconUrl || req.toGuildIcon || null,
      status: 'active',
      acceptedAt: Date.now(),
      lastAdSentAtA: channelDeliveries.aToB ? Date.now() : 0,
      lastAdSentAtB: channelDeliveries.bToA ? Date.now() : 0,
      totalAdsSent: (channelDeliveries.aToB ? 1 : 0) + (channelDeliveries.bToA ? 1 : 0) || 1,
      verifiedJoins: 0,
      pageVisits: 0
    };

    data.partnerships.unshift(newPartnership);
    data.requests[reqIndex].status = 'accepted';
    data.requests[reqIndex].respondedAt = Date.now();

    // Reward both servers with partnership bonus (+10 credits to server treasury)
    try {
      addServerCreditTransaction(req.fromGuildId, {
        amount: 10,
        category: 'reward',
        description: `Alliance established with ${serverB.name}`,
        idempotencyKey: `part_bonus_${partnershipId}_a`
      });
      addServerCreditTransaction(req.toGuildId, {
        amount: 10,
        category: 'reward',
        description: `Alliance established with ${serverA.name}`,
        idempotencyKey: `part_bonus_${partnershipId}_b`
      });
    } catch {}

    savePartnershipsData(data);

    // Notify requester of outcome once per request (closed DMs never fail)
    const targetOwnerId = req.fromOwnerId || serverA.ownerId || serverA.owner_discord_id;
    if (process.env.PARTNERSHIP_DMS_ENABLED !== 'false' && targetOwnerId && !data.requests[reqIndex].dmSent) {
      data.requests[reqIndex].dmSent = true;
      savePartnershipsData(data);
      try {
        await sendDirectNotificationV2({
          targetUserId: targetOwnerId,
          type: 'partnership_result',
          fromGuildId: req.fromGuildId,
          toGuildId: req.toGuildId,
          serverName: serverA.name,
          proposingServer: serverB.name,
          serverIconUrl: serverB.iconUrl || serverB.icon || null,
          guildId: req.toGuildId,
          action: 'accepted'
        });
      } catch {}
    }

    return {
      success: true,
      partnership: newPartnership,
      deliveries: channelDeliveries,
      deliveryNotice: deliveryErrors.length > 0 ? deliveryErrors.join(' | ') : 'Partnership established successfully.'
    };
  } else {
    // Decline request: refund any mention credits paid
    data.requests[reqIndex].status = 'declined';
    data.requests[reqIndex].respondedAt = Date.now();

    if (req.coinsPaid > 0) {
      try {
        addServerCreditTransaction(req.fromGuildId, {
          amount: req.coinsPaid,
          category: 'reward',
          description: `Refund for declined partnership proposal to ${serverB.name}`,
          idempotencyKey: `part_refund_${req.id}`
        });
      } catch {}
    }

    // Notify requester of decline once per request (closed DMs never fail)
    const targetOwnerId = req.fromOwnerId || serverA.ownerId || serverA.owner_discord_id;
    let dmResult = null;
    if (process.env.PARTNERSHIP_DMS_ENABLED !== 'false' && targetOwnerId && !data.requests[reqIndex].dmSent) {
      data.requests[reqIndex].dmSent = true;
      savePartnershipsData(data);
      try {
        dmResult = await sendDirectNotificationV2({
          targetUserId: targetOwnerId,
          type: 'partnership_result',
          fromGuildId: req.fromGuildId,
          toGuildId: req.toGuildId,
          serverName: serverA.name,
          proposingServer: serverB.name,
          serverIconUrl: serverB.iconUrl || serverB.icon || null,
          guildId: req.toGuildId,
          action: 'declined'
        });
      } catch {}
    } else {
      savePartnershipsData(data);
    }

    return { success: true, status: 'declined', dmSent: Boolean(dmResult?.ok) };
  }
}

/** Cancel a pending outgoing partnership request */
export function cancelPartnershipRequest({ requestId, guildId, userId }) {
  const data = loadPartnershipsData();
  const reqIndex = data.requests.findIndex(r => r.id === requestId && String(r.fromGuildId) === String(guildId));

  if (reqIndex < 0) {
    throw new Error('Partnership request not found or not owned by your server.');
  }

  const req = data.requests[reqIndex];
  if (req.status !== 'pending') {
    throw new Error(`Cannot cancel a request that is already ${req.status}.`);
  }

  req.status = 'cancelled';
  req.cancelledAt = Date.now();

  // Refund credits
  if (req.coinsPaid > 0) {
    try {
      addServerCreditTransaction(req.fromGuildId, {
        amount: req.coinsPaid,
        category: 'reward',
        description: `Refund for cancelled partnership proposal`,
        idempotencyKey: `part_cancel_refund_${req.id}`
      });
    } catch {}
  }

  savePartnershipsData(data);
  return { success: true, status: 'cancelled' };
}

/** Toggle pause/active status of an active partnership */
export function togglePausePartnership({ partnershipId, guildId }) {
  const data = loadPartnershipsData();
  const part = data.partnerships.find(p => p.id === partnershipId && (String(p.guildIdA) === String(guildId) || String(p.guildIdB) === String(guildId)));

  if (!part) {
    throw new Error('Partnership not found.');
  }

  part.status = part.status === 'paused' ? 'active' : 'paused';
  part.updatedAt = Date.now();

  savePartnershipsData(data);
  return { success: true, status: part.status, partnership: part };
}

/** End an active partnership */
export function endPartnership({ partnershipId, guildId }) {
  const data = loadPartnershipsData();
  const partIndex = data.partnerships.findIndex(p => p.id === partnershipId && (String(p.guildIdA) === String(guildId) || String(p.guildIdB) === String(guildId)));

  if (partIndex < 0) {
    throw new Error('Partnership not found.');
  }

  const [removed] = data.partnerships.splice(partIndex, 1);
  savePartnershipsData(data);

  return { success: true, endedPartner: removed };
}

/** Trigger scheduled or manual ad dispatch to an active partner */
export async function sendManualAdBroadcast({ partnershipId, guildId }) {
  const data = loadPartnershipsData();
  const part = data.partnerships.find(p => p.id === partnershipId && (p.status === 'active' || !p.status));
  if (!part) {
    throw new Error('Active partnership not found.');
  }

  const isA = String(part.guildIdA) === String(guildId);
  const targetGuildId = isA ? part.guildIdB : part.guildIdA;
  const targetConfig = getGuildPartnershipConfig(targetGuildId);

  const allServers = getPromotedServers();
  const senderServer = allServers.find(s => String(s.id) === String(guildId)) || { id: guildId, name: isA ? part.guildNameA : part.guildNameB };
  const senderConfig = getGuildPartnershipConfig(guildId);

  // Post ad to the promotion channel
  if (targetConfig.partnershipBroadcastChannel && senderConfig?.partnershipAdText) {
    try {
      await postChannelMessage(targetConfig.partnershipBroadcastChannel, senderConfig.partnershipAdText || senderServer.description);
    } catch (err) {
      console.warn(`[PARTNERSHIP AD] Broadcast error: ${err.message}`);
    }
  }

  const now = Date.now();
  if (isA) {
    part.lastAdSentAtA = now;
  } else {
    part.lastAdSentAtB = now;
  }
  part.totalAdsSent = (part.totalAdsSent || 0) + 1;

  savePartnershipsData(data);
  return { success: true, timestamp: now };
}

/** Claim milestone achievement */
export function claimPartnershipMilestone({ milestoneId, guildId, userId }) {
  const data = loadPartnershipsData();
  const def = PARTNERSHIP_MILESTONES.find(m => m.id === milestoneId);
  if (!def) throw new Error('Unknown milestone.');

  data.milestones = data.milestones || {};
  data.milestones[guildId] = data.milestones[guildId] || {};

  const state = data.milestones[guildId][milestoneId] || {};
  if (state.claimed) {
    throw new Error('This milestone reward has already been claimed.');
  }

  // Check requirement
  const activeCount = data.partnerships.filter(p =>
    p.status === 'active' &&
    (String(p.guildIdA) === String(guildId) || String(p.guildIdB) === String(guildId))
  ).length;

  if (activeCount < def.targetCount) {
    throw new Error(`You need at least ${def.targetCount} active partners to claim this milestone.`);
  }

  // Credit server treasury
  try {
    addServerCreditTransaction(guildId, {
      amount: def.rewardCredits,
      category: 'reward',
      description: `Milestone reward: ${def.title}`,
      idempotencyKey: `part_mile_${guildId}_${milestoneId}`
    });
  } catch {}

  data.milestones[guildId][milestoneId] = {
    claimed: true,
    claimedAt: Date.now(),
    cooldownEndsAt: Date.now() + 24 * 3600 * 1000 // 24h cooldown until repeated seasons
  };

  savePartnershipsData(data);
  return { success: true, milestoneId, reward: def.rewardCredits };
}

/** Claim daily check-in reward (Truly Daily UTC calendar rule) */
export function claimDailyReward(userId, guildIdOrOptions = null, options = {}) {
  if (!userId) throw new Error('User not authenticated.');
  const opts = (guildIdOrOptions && typeof guildIdOrOptions === 'object') ? guildIdOrOptions : (options || {});
  const guildId = (guildIdOrOptions && typeof guildIdOrOptions === 'string') ? guildIdOrOptions : (opts.guildId || null);
  const data = loadPartnershipsData();
  const balances = loadUserBalances();

  const userAch = data.achievements[userId] || { lastCheckin: 0, streak: 0, lastClaimDate: null };
  const now = opts.now ? new Date(opts.now) : new Date();
  const todayUtc = now.toISOString().slice(0, 10);
  const yesterdayUtc = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

  if (userAch.lastClaimDate === todayUtc) {
    const nextResetUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const diffMs = nextResetUtc.getTime() - now.getTime();
    const hoursRemaining = Math.max(1, Math.ceil(diffMs / (3600 * 1000)));
    throw new Error(`Daily reward already claimed today. Next claim available in ${hoursRemaining} hour(s) at 00:00 UTC.`);
  }

  // Streak continues if claimed yesterday; otherwise resets to 1 on missed day
  if (userAch.lastClaimDate === yesterdayUtc) {
    userAch.streak = (userAch.streak || 0) + 1;
  } else {
    userAch.streak = 1;
  }
  userAch.lastClaimDate = todayUtc;
  userAch.lastCheckin = now.getTime();

  // Consistent daily reward set in settings (default 10 credits)
  const settings = getAdminSettings();
  const rewardAmount = Number(settings.daily_checkin_reward_credits) || 10;
  balances[userId] = (balances[userId] || 0) + rewardAmount;

  const allServers = getPromotedServers(true);
  const targetServer = guildId
    ? allServers.find(s => String(s.id) === String(guildId) || String(s.guildId) === String(guildId))
    : allServers.find(s => String(s.ownerId) === String(userId));
  const resolvedGuildId = targetServer?.id || guildId || null;

  data.achievements[userId] = userAch;
  data.transactions.unshift({
    id: `tx_${now.getTime()}_checkin`,
    userId,
    guildId: resolvedGuildId,
    amount: rewardAmount,
    type: 'daily_checkin',
    description: `Day ${userAch.streak} Daily Check-In reward claimed (+${rewardAmount} credits)`,
    timestamp: now.getTime()
  });

  try {
    recordLedgerTransaction({
      userId,
      serverId: resolvedGuildId,
      guildId: resolvedGuildId,
      guildName: targetServer?.name || 'Community Server',
      type: 'earned',
      amount: rewardAmount,
      reason: 'Daily Check-In',
      description: `Day ${userAch.streak} Daily Check-In reward claimed (+${rewardAmount} credits)`,
      triggeredBy: 'Daily Check-In',
      status: 'posted',
      idempotencyKey: `daily_checkin:${userId}:${todayUtc}`
    });
  } catch {}

  saveUserBalances(balances);
  savePartnershipsData(data);

  return {
    success: true,
    amount: rewardAmount,
    reward: rewardAmount,
    newBalance: balances[userId],
    streak: userAch.streak,
    lastClaimDate: todayUtc
  };
}

export function claimAchievement(userId, achievementId) {
  return { success: true, achievementId };
}


export function getGuildWebhookInfo(guildId) {
  const data = loadPartnershipsData();
  const cfg = data.serverConfigs[guildId] || {};
  const encrypted = cfg.encryptedWebhook || cfg.partnershipWebhookUrl || '';
  const plain = decryptWebhook(encrypted) || (encrypted.startsWith('https://') ? encrypted : '');
  const hasWebhook = Boolean(plain && isValidDiscordWebhookUrl(plain));
  const maskedUrl = hasWebhook ? plain.replace(/webhooks\/\d+\/.+/, 'webhooks/••••••••') : '';

  return {
    hasWebhook,
    maskedUrl,
    fullUrl: hasWebhook ? plain : '',
    channelName: cfg.partnershipChannelName || 'partnerships',
    connected: hasWebhook
  };
}

export function saveGuildWebhook(guildId, webhookUrl, channelName = 'partnerships') {
  if (!webhookUrl || !isValidDiscordWebhookUrl(webhookUrl)) {
    throw new Error('Please provide a valid Discord webhook URL (e.g., https://discord.com/api/webhooks/...)');
  }
  const data = loadPartnershipsData();
  const current = data.serverConfigs[guildId] || {};
  const encrypted = encryptWebhook(webhookUrl.trim());

  data.serverConfigs[guildId] = {
    ...current,
    encryptedWebhook: encrypted,
    partnershipWebhookUrl: encrypted,
    partnershipChannelName: (channelName || 'partnerships').replace(/^#/, '').trim(),
    partnershipSetUp: true,
    hasWebhook: true,
    updatedAt: Date.now()
  };
  savePartnershipsData(data);
  return getGuildWebhookInfo(guildId);
}

export function removeGuildWebhook(guildId) {
  const data = loadPartnershipsData();
  if (data.serverConfigs[guildId]) {
    delete data.serverConfigs[guildId].encryptedWebhook;
    delete data.serverConfigs[guildId].partnershipWebhookUrl;
    data.serverConfigs[guildId].hasWebhook = false;
    data.serverConfigs[guildId].updatedAt = Date.now();
    savePartnershipsData(data);
  }
  return { success: true };
}
