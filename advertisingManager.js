import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { loadDirectoryData, saveDirectoryData } from './directoryManager.js';
import { getAdminSettings, isServerPremium } from './premiumManager.js';
import { recordAuditAction } from './adminManager.js';
import { extractInviteCode } from './inviteValidator.js';
import { siteUrl } from './shared/siteUrl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const AD_POSTS_FILE = path.join(DATA_DIR, 'premium_ad_posts.json');

function getBotToken() {
  return process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || null;
}

function getBannedUserIds() {
  try {
    const bannedFile = path.join(DATA_DIR, 'banned_users.json');
    if (fs.existsSync(bannedFile)) {
      const data = JSON.parse(fs.readFileSync(bannedFile, 'utf8'));
      if (Array.isArray(data)) {
        return new Set(data.map(u => String(typeof u === 'string' ? u : u.id || u.userId)));
      }
    }
  } catch {}
  return new Set();
}

export function loadAdPosts() {
  try {
    if (fs.existsSync(AD_POSTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(AD_POSTS_FILE, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch {}
  return [];
}

export function saveAdPosts(posts) {
  try {
    const tmp = `${AD_POSTS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(posts, null, 2), 'utf8');
    fs.renameSync(tmp, AD_POSTS_FILE);
    return true;
  } catch {
    return false;
  }
}

export function checkAdvertisingBotPermissions(permissionBitfield) {
  if (permissionBitfield === undefined || permissionBitfield === null) {
    return { ok: true };
  }
  const perms = BigInt(permissionBitfield);
  const SEND_MESSAGES = 0x800n;
  const ADMINISTRATOR = 0x8n;
  const MANAGE_ROLES = 0x10000000n;
  const MENTION_EVERYONE = 0x20000n;

  const hasSend = (perms & SEND_MESSAGES) === SEND_MESSAGES;
  const hasAdmin = (perms & ADMINISTRATOR) === ADMINISTRATOR;
  const hasManageRoles = (perms & MANAGE_ROLES) === MANAGE_ROLES;
  const hasMentionEveryone = (perms & MENTION_EVERYONE) === MENTION_EVERYONE;

  const issues = [];
  if (!hasSend) {
    issues.push('Missing Send Messages permission');
  }
  if (hasAdmin) {
    issues.push('Has dangerous Administrator permission (must be removed for safety)');
  }
  if (hasManageRoles) {
    issues.push('Has dangerous Manage Roles permission (must be removed for safety)');
  }
  if (hasMentionEveryone) {
    issues.push('Has dangerous Mention Everyone permission (must be removed for safety)');
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
      error: `Bot permissions must be adjusted before posting: ${issues.join('; ')}`
    };
  }
  return { ok: true };
}

export function validateAdContent(content, serverInviteUrl, siteDomain = 'connectingerlc.xyz') {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Ad content is empty.' };
  }
  const clean = content.trim();
  if (clean.length > 1000) {
    return { valid: false, error: 'Ad content exceeds maximum length of 1000 characters.' };
  }
  if (/@everyone/i.test(clean) || /@here/i.test(clean)) {
    return { valid: false, error: 'Mentions like @everyone or @here are strictly forbidden.' };
  }

  const urlMatches = clean.match(/https?:\/\/[^\s]+/gi) || [];
  const inviteCode = extractInviteCode(serverInviteUrl);
  for (const url of urlMatches) {
    const isOurSite = url.includes(siteDomain) || url.includes('localhost') || url.includes('connectingerlc');
    const isServerInvite = inviteCode && url.includes(inviteCode);
    if (!isOurSite && !isServerInvite) {
      return {
        valid: false,
        error: `External link "${url}" is not allowed. Only your community invite and ConnectingERLC links are permitted.`
      };
    }
  }

  return { valid: true, content: clean };
}

export function buildPremiumAdPayload(server, content, postedByUsername) {
  const redirectUrl = siteUrl(`/join/${server.id}`);
  return {
    flags: 32768, // MessageFlags.IsComponentsV2
    allowed_mentions: { parse: [] }, // Nothing allowed
    components: [
      {
        type: 17, // Container (No accent_color = no color on the side)
        components: [
          {
            type: 10, // Text display
            content: `### ${server.name}\n\n${content}\n\n*Posted by ${postedByUsername}*`
          },
          {
            type: 14, // Real Separator
            divider: true
          },
          {
            type: 1, // Action row
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Join Server',
                url: redirectUrl
              }
            ]
          }
        ]
      }
    ]
  };
}

export async function addServerAdvertiser(serverId, targetUserId, ownerUserId, options = {}) {
  const sid = String(serverId);
  const targetId = String(targetUserId).trim();
  const ownerId = String(ownerUserId).trim();
  const fetchFn = options.fetchFn || fetch;

  const data = loadDirectoryData();
  const server = data.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) throw new Error('Server not found in directory');

  // Must be premium
  if (!isServerPremium(server)) {
    throw new Error('Only Premium servers can add advertisers.');
  }

  // Caller must be server owner
  const realOwnerId = String(server.ownerId || server.owner_discord_id || '');
  if (realOwnerId && realOwnerId !== ownerId) {
    throw new Error('Only the server owner can manage advertisers.');
  }

  // Blacklist check
  const banned = getBannedUserIds();
  if (banned.has(targetId) || banned.has(ownerId)) {
    throw new Error('User is blacklisted.');
  }

  // Limit check
  const settings = getAdminSettings();
  const maxAdvertisers = Number(settings.max_advertisers_per_server) || 5;
  server.advertisers = Array.isArray(server.advertisers) ? server.advertisers : [];

  if (server.advertisers.length >= maxAdvertisers) {
    throw new Error(`Maximum advertiser limit of ${maxAdvertisers} reached for this server.`);
  }

  if (server.advertisers.some(a => String(a.userId) === targetId)) {
    throw new Error('This user is already an advertiser for this server.');
  }

  // Verify real Discord user
  const botToken = getBotToken();
  let discordUser = null;
  if (options.mockUser) {
    discordUser = options.mockUser;
  } else if (botToken || options.fetchFn) {
    const cleanToken = (botToken || 'TEST_TOKEN').trim().replace(/^Bot\s+/i, '');
    try {
      const uRes = await fetchFn(`https://discord.com/api/v10/users/${targetId}`, {
        headers: { Authorization: `Bot ${cleanToken}` },
        signal: AbortSignal.timeout(5000)
      });
      if (uRes.ok) {
        discordUser = await uRes.json();
      }
    } catch {}
  }

  if (!discordUser && !options.skipDiscordLookup) {
    throw new Error('Discord user ID does not exist or could not be found.');
  }

  const advertiserEntry = {
    userId: targetId,
    username: discordUser?.username || `User (${targetId.slice(0, 6)})`,
    globalName: discordUser?.global_name || discordUser?.username || null,
    addedAt: Date.now()
  };

  server.advertisers.push(advertiserEntry);
  saveDirectoryData(data);
  return { ok: true, serverId: sid, advertiser: advertiserEntry };
}

export function removeServerAdvertiser(serverId, targetUserId, actor, reason = 'Removed by owner') {
  const sid = String(serverId);
  const targetId = String(targetUserId).trim();

  const data = loadDirectoryData();
  const server = data.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) throw new Error('Server not found');

  server.advertisers = Array.isArray(server.advertisers) ? server.advertisers : [];
  const idx = server.advertisers.findIndex(a => String(a.userId) === targetId);
  if (idx === -1) {
    throw new Error('Advertiser not found on this server.');
  }

  const removed = server.advertisers.splice(idx, 1)[0];
  saveDirectoryData(data);

  const actorStr = typeof actor === 'string' ? actor : (actor?.username || actor?.id || 'Owner');
  const isAdmin = typeof actor === 'object' && (actor?.role === 'Admin' || actor?.role === 'SuperAdmin');
  if (isAdmin) {
    recordAuditAction({
      actor: actorStr,
      action: 'remove_advertiser',
      target: targetId,
      targetType: 'user',
      reason: reason || 'Admin removed advertiser from server',
      before: { serverId: sid, advertiser: removed },
      after: { serverId: sid, advertiser: null }
    });
  }

  return { ok: true, serverId: sid, removedAdvertiser: removed };
}

export async function postPremiumAd({ serverId, actorUserId, customContent, options = {} }) {
  const sid = String(serverId);
  const uid = String(actorUserId).trim();
  const now = options.now || Date.now();
  const fetchFn = options.fetchFn || fetch;

  const data = loadDirectoryData();
  const server = data.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (!server) throw new Error('Server not found in directory');

  // 1. Server must be premium
  if (!isServerPremium(server, now)) {
    throw new Error('This server is not a Premium server.');
  }

  // 2. Caller must be owner or advertiser
  const ownerId = String(server.ownerId || server.owner_discord_id || '');
  const advertisers = Array.isArray(server.advertisers) ? server.advertisers.map(a => String(a.userId)) : [];
  const isOwner = ownerId && ownerId === uid;
  const isAdvertiser = advertisers.includes(uid);

  if (!isOwner && !isAdvertiser) {
    throw new Error('You are not authorized to post ads for this server (must be owner or an approved advertiser).');
  }

  // 3. Blacklist check
  const banned = getBannedUserIds();
  if (banned.has(uid) || (ownerId && banned.has(ownerId)) || banned.has(sid)) {
    throw new Error('User or community is blacklisted from posting ads.');
  }

  // 4. Cooldown check
  const settings = getAdminSettings();
  const cooldownHours = Number(settings.premium_ad_cooldown_hours) || 6;
  const cooldownMs = cooldownHours * 3600 * 1000;
  const lastPosted = server.last_ad_posted_at ? Number(server.last_ad_posted_at) : 0;

  if (lastPosted && (now - lastPosted) < cooldownMs) {
    const remainingMs = cooldownMs - (now - lastPosted);
    const hoursLeft = Math.floor(remainingMs / (3600 * 1000));
    const minsLeft = Math.ceil((remainingMs % (3600 * 1000)) / (60 * 1000));
    throw new Error(`Cooldown active: you can post again in ${hoursLeft}h ${minsLeft}m.`);
  }

  // 5. Channel & Guild settings
  const targetChannelId = settings.premium_ad_channel_id;
  if (!targetChannelId && !options.mockPost) {
    throw new Error('Premium Advertising channel ID is not configured in Admin Settings.');
  }

  // 6. Content validation
  const adText = customContent || server.ad_text || server.description || '';
  const validation = validateAdContent(adText, server.inviteUrl);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 7. Check bot permissions
  if (options.botPermissions !== undefined) {
    const permCheck = checkAdvertisingBotPermissions(options.botPermissions);
    if (!permCheck.ok) {
      throw new Error(permCheck.error);
    }
  }

  // 8. Build Components V2 Payload
  const botToken = getBotToken();
  const cleanToken = (botToken || 'TEST_TOKEN').trim().replace(/^Bot\s+/i, '');
  const username = options.actorUsername || (isOwner ? (server.ownerUsername || 'Owner') : `Advertiser (${uid.slice(0, 6)})`);
  const payload = buildPremiumAdPayload(server, validation.content, username);

  let messageId = `msg_${now}_${randomBytes(4).toString('hex')}`;
  if (!options.mockPost && botToken) {
    const msgRes = await fetchFn(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${cleanToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    if (!msgRes.ok) {
      const errBody = await msgRes.json().catch(() => ({}));
      throw new Error(errBody.message || `Failed to post ad to Discord channel: ${msgRes.status}`);
    }
    const msgData = await msgRes.json();
    messageId = msgData.id;
  }

  // 9. Update last_ad_posted_at & record ad post
  server.last_ad_posted_at = now;
  saveDirectoryData(data);

  const posts = loadAdPosts();
  const postRecord = {
    id: `ad_${now}_${randomBytes(4).toString('hex')}`,
    messageId,
    channelId: targetChannelId || 'test_channel',
    serverId: sid,
    serverName: server.name,
    postedByUserId: uid,
    postedByUsername: username,
    content: validation.content,
    createdAt: now,
    removed: false
  };
  posts.unshift(postRecord);
  saveAdPosts(posts);

  return {
    ok: true,
    postId: postRecord.id,
    messageId,
    serverName: server.name,
    postedAt: now,
    cooldownHours
  };
}

export async function adminRemoveAdPost(postId, adminUser, reason, options = {}) {
  const posts = loadAdPosts();
  const post = posts.find(p => p.id === postId || p.messageId === postId);
  if (!post) throw new Error('Ad post not found');

  post.removed = true;
  post.removedBy = typeof adminUser === 'string' ? adminUser : (adminUser?.username || adminUser?.id || 'Admin');
  post.removalReason = reason || 'Removed by admin';
  post.removedAt = Date.now();
  saveAdPosts(posts);

  // Attempt Discord message deletion
  const fetchFn = options.fetchFn || fetch;
  const botToken = getBotToken();
  if (botToken && post.channelId && post.messageId && !options.skipDiscord) {
    const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
    try {
      await fetchFn(`https://discord.com/api/v10/channels/${post.channelId}/messages/${post.messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bot ${cleanToken}` },
        signal: AbortSignal.timeout(5000)
      });
    } catch {}
  }

  recordAuditAction({
    actor: typeof adminUser === 'string' ? adminUser : (adminUser?.username || adminUser?.id || 'Admin'),
    action: 'remove_ad_post',
    target: post.serverName || post.serverId,
    targetType: 'ad_post',
    reason: reason || 'Admin removed premium advertising post',
    before: { postId: post.id, serverId: post.serverId },
    after: { removed: true, removedAt: post.removedAt }
  });

  return { ok: true, postId: post.id };
}

export async function sendTestPremiumAd(options = {}) {
  const settings = getAdminSettings();
  const channelId = options.channelId || settings.premium_ad_channel_id;
  if (!channelId) {
    throw new Error('No target channel configured. Set premium_ad_channel_id in admin settings or provide channelId.');
  }

  const botToken = getBotToken();
  if (!botToken && !options.mockFetch) {
    throw new Error('Bot token is not configured in environment variables.');
  }

  const payload = {
    flags: 32768, // Components V2
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17, // Container (No accent_color = no color on the side)
        components: [
          {
            type: 10, // Text display
            content: `### [TEST] Premium Advertising Verification\n\nThis is a verification ad panel dispatched by ConnectingERLC to test bot permissions and Components V2 layout.\n\n*Required Permissions: Send Messages only (No Administrator, No Manage Roles)*`
          },
          {
            type: 14, // Real Separator
            divider: true
          },
          {
            type: 1, // Action row
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Test Link (ConnectingERLC)',
                url: siteUrl('/')
              }
            ]
          }
        ]
      }
    ]
  };

  const fetchFn = options.fetchFn || fetch;
  if (options.mockFetch) {
    return { ok: true, test: true, messageId: 'test_msg_mock', channelId, payload };
  }

  const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
  const res = await fetchFn(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${cleanToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(6000)
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Discord API returned ${res.status}`);
  }

  const data = await res.json();
  return { ok: true, test: true, messageId: data.id, channelId };
}
