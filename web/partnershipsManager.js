import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';
import { getPromotedServers, loadUserBalances, saveUserBalances } from './directoryManager.js';
import { recordLedgerTransaction } from './ledgerManager.js';

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

/** Masks webhook URL to: https://discord.com/api/webhooks/1234.../•••••• */
export function maskWebhookUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const match = url.match(/^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([\w-]+)$/i);
  if (match) {
    const id = match[1];
    const prefix = id.slice(0, 4);
    return `https://discord.com/api/webhooks/${prefix}.../••••••`;
  }
  return url.replace(/(\/webhooks\/\d{4})\d+\/[^/]+$/, '$1.../••••••');
}

function loadPartnershipsData() {
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

function savePartnershipsData(data) {
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

/** Get partnership configuration for a specific guild */
export function getGuildPartnershipConfig(guildId) {
  const data = loadPartnershipsData();
  const cfg = data.serverConfigs[guildId] || {};

  let plainWebhook = '';
  if (cfg.encryptedWebhookUrl) {
    plainWebhook = decryptWebhook(cfg.encryptedWebhookUrl) || '';
  } else if (cfg.partnershipWebhookUrl) {
    plainWebhook = decryptWebhook(cfg.partnershipWebhookUrl) || cfg.partnershipWebhookUrl || '';
  }

  const mode = cfg.partnershipMode || (cfg.acceptPartnerships === false ? 'closed' : cfg.autoAccept ? 'open' : 'selective');

  return {
    acceptPartnerships: mode !== 'closed',
    partnershipMode: mode,
    partnershipWebhookUrl: plainWebhook,
    maskedWebhookUrl: plainWebhook ? maskWebhookUrl(plainWebhook) : '',
    hasWebhook: Boolean(plainWebhook && isValidDiscordWebhookUrl(plainWebhook)),
    partnershipChannelId: cfg.partnershipChannelId || '',
    partnershipChannelName: cfg.partnershipChannelName || '',
    partnershipAdText: cfg.partnershipAdText || '',
    allowPartnerMentions: Boolean(cfg.allowPartnerMentions),
    partnershipMinMembers: Number(cfg.partnershipMinMembers !== undefined ? cfg.partnershipMinMembers : 0),
    partnershipPrice: Number(cfg.partnershipPrice !== undefined ? cfg.partnershipPrice : 0),
    partnershipAllowedMentions: cfg.partnershipAllowedMentions || 'none',
    partnershipHerePrice: Number(cfg.partnershipHerePrice !== undefined ? cfg.partnershipHerePrice : 15),
    partnershipEveryonePrice: Number(cfg.partnershipEveryonePrice !== undefined ? cfg.partnershipEveryonePrice : 25),
    partnershipDailyLimit: Number(cfg.partnershipDailyLimit || 3),
    partnershipAcceptedCategories: Array.isArray(cfg.partnershipAcceptedCategories)
      ? cfg.partnershipAcceptedCategories
      : ['Design Server', 'Roleplay Server', 'Misc', 'COTS', 'Departments', 'Events'],
    lastAdSentAt: cfg.lastAdSentAt || 0
  };
}

/** Update partnership configuration for a specific guild */
export function updateGuildPartnershipConfig(guildId, patch) {
  const data = loadPartnershipsData();
  const current = data.serverConfigs[guildId] || {};
  const cleanPatch = { ...patch };

  // Encrypt webhook if provided
  if ('partnershipWebhookUrl' in cleanPatch) {
    const raw = cleanPatch.partnershipWebhookUrl;
    if (raw && typeof raw === 'string' && raw.trim() && !raw.includes('••••••')) {
      if (isValidDiscordWebhookUrl(raw.trim())) {
        cleanPatch.encryptedWebhookUrl = encryptWebhook(raw.trim());
      }
    } else if (raw === '' || raw === null) {
      cleanPatch.encryptedWebhookUrl = '';
    }
    // Never store unencrypted field in database
    delete cleanPatch.partnershipWebhookUrl;
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
    .filter(s => String(s.id) !== String(currentGuildId))
    .map(server => {
      const cfg = data.serverConfigs[server.id] || {};
      const mode = cfg.partnershipMode || (cfg.acceptPartnerships === false ? 'closed' : cfg.autoAccept ? 'open' : 'selective');
      const acceptPartnerships = mode !== 'closed';

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

      return {
        id: server.id,
        name: server.name,
        icon: server.icon || server.iconUrl,
        iconUrl: server.iconUrl || server.icon,
        category: server.category || 'Roleplay Server',
        memberCount: Number(server.memberCount) > 0 ? Number(server.memberCount) : 0,
        ownerId: server.ownerId || null,
        ownerUsername: server.ownerUsername || null,
        ownerAvatar: server.ownerAvatar || null,
        description: server.description || '',
        summary: server.summary || server.description || '',
        bannerUrl: server.bannerUrl || '',
        inviteUrl: server.inviteUrl || '',
        verified: Boolean(server.verified),
        acceptPartnerships,
        partnershipMode: mode,
        allowPartnerMentions: cfg.allowPartnerMentions !== false,
        partnershipPrice: Number(cfg.partnershipPrice || 0),
        partnershipHerePrice: Number(cfg.partnershipHerePrice !== undefined ? cfg.partnershipHerePrice : 15),
        partnershipEveryonePrice: Number(cfg.partnershipEveryonePrice !== undefined ? cfg.partnershipEveryonePrice : 25),
        minMembersRequired: Number(cfg.partnershipMinMembers !== undefined ? cfg.partnershipMinMembers : 5),
        partnershipDailyLimit: Number(cfg.partnershipDailyLimit || 3),
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

/** Dispatch a Discord Webhook advertisement */
export async function sendDiscordPartnershipWebhook({ webhookUrl, server, adText, mentionType, embed = true }) {
  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    throw new Error('Invalid Discord Webhook URL provided.');
  }

  const contentMention = mentionType === 'here' ? '@here' : mentionType === 'everyone' ? '@everyone' : undefined;
  const rawDescription = (adText || server.description || `Verified community presence on the ConnectingERLC platform.`)
    .replace(/@(everyone|here)/gi, '')
    .trim();

  if (embed) {
    const embedObj = {
      title: `🤝 ${server.name}`,
      description: rawDescription,
      color: 0x141417,
      fields: [
        { name: 'Category', value: server.category || 'Roleplay Server', inline: true },
        { name: 'Community Size', value: `${server.memberCount || 0} Members`, inline: true },
        { name: 'Community Link', value: server.inviteUrl ? `[Join Discord Server](${server.inviteUrl})` : '[Explore on ConnectingERLC](https://erlc.us)', inline: true }
      ],
      footer: {
        text: 'Verified Server Partnership · ConnectingERLC',
        icon_url: 'https://erlc.us/erlcus-mark.png'
      },
      timestamp: new Date().toISOString()
    };

    if (server.icon || server.iconUrl) {
      embedObj.thumbnail = { url: server.icon || server.iconUrl };
    }
    if (server.bannerUrl && /^https?:\/\//i.test(server.bannerUrl)) {
      embedObj.image = { url: server.bannerUrl };
    }

    const payload = {
      username: 'ConnectingERLC Partnerships',
      avatar_url: 'https://erlc.us/erlcus_logo.png',
      content: contentMention,
      embeds: [embedObj]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok && response.status !== 204) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Discord Webhook delivery failed (${response.status}): ${errorText || 'Check channel permissions'}`);
    }

    return true;
  }

  const payload = {
    username: 'ConnectingERLC Partnerships',
    avatar_url: 'https://erlc.us/erlcus_logo.png',
    content: contentMention ? `${contentMention}\n\n${server.name} — ${server.inviteUrl || 'https://erlc.us'}` : `${server.name} — ${server.inviteUrl || 'https://erlc.us'}`
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Discord Webhook delivery failed (${response.status}): ${errorText || 'Check channel permissions'}`);
  }

  return true;
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
  userCoinBalance = 0
}) {
  if (String(fromGuildId) === String(toGuildId)) {
    throw new Error('You cannot send a partnership request to your own server.');
  }

  const data = loadPartnershipsData();
  const targetConfig = getGuildPartnershipConfig(toGuildId);

  if (targetConfig.partnershipMode === 'closed' || targetConfig.acceptPartnerships === false) {
    throw new Error('This community is currently closed to new partnership requests.');
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

  // Check duplicate pending request
  const existingPending = data.requests.find(r =>
    r.status === 'pending' &&
    ((String(r.fromGuildId) === String(fromGuildId) && String(r.toGuildId) === String(toGuildId)) ||
     (String(r.toGuildId) === String(fromGuildId) && String(r.fromGuildId) === String(toGuildId)))
  );
  if (existingPending) {
    throw new Error('A pending partnership request already exists between these two servers.');
  }

  // Get server details
  const allServers = getPromotedServers();
  const senderServer = allServers.find(s => String(s.id) === String(fromGuildId));
  const targetServer = allServers.find(s => String(s.id) === String(toGuildId));

  // Check minimum member requirements
  const minMembers = Number(targetConfig.partnershipMinMembers || 5);
  if (senderServer && senderServer.memberCount && senderServer.memberCount < minMembers) {
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

  // Debit coins if cost > 0
  if (coinsCost > 0 && fromOwnerId) {
    const balances = loadUserBalances();
    const curBalance = Number(balances[fromOwnerId] || 0);
    if (curBalance < coinsCost) {
      throw new Error(`You need at least ${coinsCost} credits to send this proposal.`);
    }
    balances[fromOwnerId] = curBalance - coinsCost;
    saveUserBalances(balances);

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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

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
  }

  return newRequest;
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
    let webhookDeliveries = { aToB: false, bToA: false };
    const deliveryErrors = [];

    // Deliver Server A ad into Server B webhook
    if (configB.partnershipWebhookUrl && isValidDiscordWebhookUrl(configB.partnershipWebhookUrl)) {
      try {
        await sendDiscordPartnershipWebhook({
          webhookUrl: configB.partnershipWebhookUrl,
          server: serverA,
          adText: req.adText || configA.partnershipAdText || serverA.description,
          mentionType: req.includeMention ? req.mentionType : 'none',
          embed: true
        });
        webhookDeliveries.aToB = true;
      } catch (err) {
        deliveryErrors.push(`Server B channel: ${err.message}`);
      }
    }

    // Deliver Server B ad into Server A webhook
    if (configA.partnershipWebhookUrl && isValidDiscordWebhookUrl(configA.partnershipWebhookUrl)) {
      try {
        await sendDiscordPartnershipWebhook({
          webhookUrl: configA.partnershipWebhookUrl,
          server: serverB,
          adText: configB.partnershipAdText || serverB.description,
          mentionType: 'none',
          embed: true
        });
        webhookDeliveries.bToA = true;
      } catch (err) {
        deliveryErrors.push(`Server A channel: ${err.message}`);
      }
    }

    // Create active partnership
    const partnershipId = `part_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
      lastAdSentAtA: webhookDeliveries.aToB ? Date.now() : 0,
      lastAdSentAtB: webhookDeliveries.bToA ? Date.now() : 0,
      totalAdsSent: (webhookDeliveries.aToB ? 1 : 0) + (webhookDeliveries.bToA ? 1 : 0) || 1,
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

    return {
      success: true,
      partnership: newPartnership,
      deliveries: webhookDeliveries,
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

    savePartnershipsData(data);
    return { success: true, status: 'declined' };
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

  if (!targetConfig.partnershipWebhookUrl || !isValidDiscordWebhookUrl(targetConfig.partnershipWebhookUrl)) {
    throw new Error('Partner community does not have an active Discord webhook configured.');
  }

  const allServers = getPromotedServers();
  const senderServer = allServers.find(s => String(s.id) === String(guildId)) || { id: guildId, name: isA ? part.guildNameA : part.guildNameB };
  const senderConfig = getGuildPartnershipConfig(guildId);

  await sendDiscordPartnershipWebhook({
    webhookUrl: targetConfig.partnershipWebhookUrl,
    server: senderServer,
    adText: senderConfig.partnershipAdText || senderServer.description,
    mentionType: 'none',
    embed: true
  });

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

/** Claim daily check-in reward */
export function claimDailyReward(userId) {
  if (!userId) throw new Error('User not authenticated.');
  const data = loadPartnershipsData();
  const balances = loadUserBalances();

  const userAch = data.achievements[userId] || { lastCheckin: 0, streak: 0 };
  const now = Date.now();
  const oneDayMs = 24 * 3600 * 1000;

  if (now - userAch.lastCheckin < oneDayMs) {
    const hoursRemaining = Math.ceil((oneDayMs - (now - userAch.lastCheckin)) / (3600 * 1000));
    throw new Error(`Daily reward already claimed today. Next claim available in ${hoursRemaining} hour(s).`);
  }

  if (now - userAch.lastCheckin < 2 * oneDayMs) {
    userAch.streak = (userAch.streak || 0) + 1;
  } else {
    userAch.streak = 1;
  }
  userAch.lastCheckin = now;

  const rewardAmount = 5 + Math.min(userAch.streak, 5);
  balances[userId] = (balances[userId] || 0) + rewardAmount;

  data.achievements[userId] = userAch;
  data.transactions.unshift({
    id: `tx_${now}_checkin`,
    userId,
    amount: rewardAmount,
    type: 'daily_checkin',
    description: `Day ${userAch.streak} Daily Check-In reward claimed`,
    timestamp: now
  });

  saveUserBalances(balances);
  savePartnershipsData(data);

  return {
    success: true,
    amount: rewardAmount,
    newBalance: balances[userId],
    streak: userAch.streak
  };
}

export function claimAchievement(userId, achievementId) {
  return { success: true, achievementId };
}
