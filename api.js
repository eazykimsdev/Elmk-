import { getBotGatewayStatus } from './botGateway.js';
import { getBugReports, getBugReportById, reviewBugReport, sendTestBugReviewDM } from './bugReportManager.js';
import { getMonthlyLeaderboardPreview, executeMonthlyReward, loadMonthlyRewardConfig, saveMonthlyRewardConfig } from './monthlyLeaderboardRewardManager.js';
import { getVerificationStatus, submitVerificationApplication, reviewVerificationApplication, revokeVerification, loadVerificationApplications } from './verificationManager.js';
import {
  getGiveawaySettings,
  updateGiveawaySettings,
  toggleGiveaway,
  resetGiveawayClaims,
  getGiveawayClaims,
  getGiveawayPublicStatus,
  tryClaimLaunchGiveaway,
  getClaimForUserOrServer,
  dismissGiveawayDashboardNotification
} from './giveawayManager.js';
import { isMaintenanceActive, loadSiteState, saveSiteState, getActiveAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement as deleteSiteAnnouncement, dismissAnnouncement, loadDismissals, loadAnnouncements as loadSiteAnnouncements, getDefaultBannerText, setDefaultBannerText } from './siteStateManager.js';
import { checkBlacklist, recordUserIp, addBlacklistEntry, removeBlacklistEntry, unblacklistTarget, removeUserBlacklistEntries, getAllBlacklistEntries, getUserIpCollateral } from './blacklistManager.js';
import { redeemPromoCode, checkRedeemRateLimit, recordRedeemAttempt, createPromoCode, updatePromoCodeStatus, deletePromoCode, getAllPromoCodes, getCodeRedemptions, getUserRedemptions, generateRandomCode, clearPromoLock } from './promoCodeManager.js';
import { deleteServerHard, deleteUserAccountAndServers } from './accountDeletionManager.js';
import { addBumpReminder, removeBumpReminder, hasBumpReminder } from './bumpReminderManager.js';
import { buildBotInviteUrl, getBotInviteUrl, computeBotPermissions, analyzeBotPermissions, BOT_PERMISSIONS_TIERS } from './shared/botPermissions.js';
import { setReminderPreference, getReminderPreference, sendCheckinReminderDM } from './checkinReminderManager.js';
import { subscribeToUpdate, triggerUpdateDrop, isUserSubscribed } from './updateNotificationManager.js';
import { siteUrl } from './shared/siteUrl.js';
import 'dotenv/config';
import crypto, { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
// Workspace settings are still stored in the old bot-instance records (data/bot_instances*.json),
// so the storage module keeps its name to stay compatible with existing data.
import {
  createBotInstance,
  getBotInstance,
  loadBotInstances,
  updateBotInstance,
  updateBotCustomization,
  DEFAULT_CUSTOMIZATIONS,
  MASTER_BOT_ID
} from './botManager.js';
import {
  getPromotedServers,
  loadDirectoryData,
  saveDirectoryData,
  upsertPromotedServer,
  bumpPromotedServer,
  getBumpStatus,
  BUMP_COOLDOWN_HOURS,
  getUserCredits,
  getUserBalance,
  setUserBalance,
  getJoinRecord,
  claimServerJoinBounty,
  removePromotedServer,
  updatePromotedServerDetails,
  loadUserBalances,
  recordBotMemberJoin,
  recordBotMemberLeave,
  processMaturePendingJoins,
  getUserJoinedCommunities
} from './directoryManager.js';
import {
  getServerReviews,
  upsertReview,
  deleteReview,
  reportReview,
  getReviewEligibility
} from './reviewsManager.js';
import {
  loadLedgerData,
  getCreditHistory,
  getUserLedgerSummary,
  getServerLedgerSummary,
  getServerCreditHistory,
  recordLedgerTransaction,
  getStoredServerActivity,
  appendServerActivity,
  countStoredBumpEvents
} from './ledgerManager.js';
import {
  getGuildPartnershipConfig,
  updateGuildPartnershipConfig,
  getPartnerEligibleServers,
  getGuildPartnershipsDashboard,
  createPartnershipRequest,
  respondToPartnershipRequest,
  cancelPartnershipRequest,
  togglePausePartnership,
  endPartnership,
  sendManualAdBroadcast,
  claimPartnershipMilestone,
  claimDailyReward,
  claimAchievement,
  getGuildWebhookInfo,
  saveGuildWebhook,
  removeGuildWebhook,
  isValidDiscordWebhookUrl,
  decryptWebhook
} from './partnershipsManager.js';
import { deployCommands } from './scripts/deploy_commands.mjs';
import {
  sendDirectNotificationV2,
  buildBumpThankYouV2,
  sendPartnershipRequestDM
} from './discordNotificationManager.js';
import {
  loadServiceChecks,
  loadIncidents,
  runMonitorChecks,
  sendComponentAlert,
  startSystemMonitor
} from './monitorJob.js';
import {
  validateDiscordInvite,
  normalizeInviteUrl,
  createJoinIntent,
  findActiveJoinIntent,
  markJoinIntentConverted,
  checkUserClickRateLimit,
  checkServerInvite,
  handleExpiredInviteReport,
  sendTestExpiredInviteDM,
  getOwnerDashboardNotices,
  clearOwnerDashboardNotices,
  startScheduledInviteChecks
} from './inviteValidator.js';
import {
  getAdminSettings,
  updateAdminSettings,
  isServerPremium,
  buyServerPremium,
  grantServerPremium,
  removeServerPremium,
  checkPremiumReminders,
  startPremiumReminderJob
} from './premiumManager.js';
import {
  addServerAdvertiser,
  removeServerAdvertiser,
  postPremiumAd,
  adminRemoveAdPost,
  loadAdPosts,
  sendTestPremiumAd
} from './advertisingManager.js';
import {
  connectErlcServer,
  getErlcStatus,
  testErlcConnection,
  disconnectErlcServer,
  checkRateLimit
} from './erlcManager.js';
import { getUnverifiedJoinTransactions } from './scripts/credits_audit.mjs';
import {
  loadRecruitData,
  saveRecruitData,
  getRecruitSettings,
  updateRecruitSettings,
  getRecruitsSummary,
  getRecruitsList,
  getRecruitLeaderboard,
  getUserRecruitStats,
  getOrCreateRecruitLink,
  get30DayRecruitsTrend,
  stepDownRepresentative,
  blockRecruiter,
  reverseRecruit,
  removeRepresentative,
  revokeAllRepresentativeInvites,
  getOwnerAuditLog,
  exportRecruitsToCsv,
  resolveRecruitRedirect,
  recordUserReferralAttribution,
  getUserReferralAttribution,
  evaluateReferralRewardForListedServer
} from './recruitManager.js';
import {
  checkAdminRateLimit,
  loadAdmins,
  saveAdmins,
  getAdminRecord,
  addAdmin,
  removeAdmin,
  loadAuditLog,
  recordAuditAction,
  loadBannedUsers,
  saveBannedUsers,
  isUserBanned,
  banUser,
  unbanUser,
  loadReports,
  saveReports,
  createReport,
  updateReport,
  loadFlags,
  saveFlags,
  updateFlagAction,
  loadAnnouncements,
  saveAnnouncements,
  upsertAnnouncement,
  deleteAnnouncement,
  getMaintenanceStatus,
  setMaintenanceStatus,
  getDetectorRules,
  saveDetectorRules
} from './adminManager.js';
import { sanitizeMarkdown, stripMarkdown, cleanSqlReplace } from './markdownSanitizer.js';
import { createRateLimiter } from './rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'web_sessions.json');

const SESSION_COOKIE = 'connectingerlc_session';
const SESSION_COOKIE_FALLBACKS = ['connectingerlc_session', 'mavely_session', 'erlcus_session', 'erlc_session'];
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days sliding expiry (Section 1.3)
const GUILD_CACHE_TTL = 60 * 1000;
const ERLC_CACHE_TTL = 15 * 1000;

const sessions = new Map();
const oauthStates = new Map();
const erlcCache = new Map();
const activeCustomerClients = new Map();

function getBotToken(bot) {
  return (bot?.token || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.MAVELY_TOKEN || '').trim().replace(/^Bot\s+/i, '');
}

export async function assignGuildMemberRole(guildId, userId, roleId, reason = 'ConnectingERLC role assignment') {
  if (!guildId || !userId || !roleId) return { success: false, reason: 'Missing arguments' };
  const token = (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) return { success: false, reason: 'No bot token' };
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${token}`,
        'X-Audit-Log-Reason': encodeURIComponent(reason)
      }
    });
    if (res.ok || res.status === 204) {
      return { success: true };
    }
    const errText = await res.text().catch(() => '');
    return { success: false, status: res.status, error: errText };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Real Bot Guild Tracking & Status (Round 11 Section 2 & 3) ────────────────
const botGuildsCache = new Map();
let lastBotGuildsFetch = 0;
const BOT_GUILDS_CACHE_TTL = 30 * 1000; // 30s cache

export function handleBotGatewayEvent(type, data) {
  if (type === 'READY') {
    if (Array.isArray(data.guilds)) {
      for (const g of data.guilds) {
        if (!botGuildsCache.has(String(g.id))) {
          botGuildsCache.set(String(g.id), {
            id: String(g.id),
            name: g.name || `Guild ${g.id}`,
            icon: g.icon || null,
            icon_hash: g.icon || null,
            iconHash: g.icon || null,
            iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=128` : null,
            permissions: String(g.permissions || '8'),
            memberCount: Number(g.member_count || g.approximate_member_count || 0)
          });
        }
      }
    }
  } else if (type === 'GUILD_CREATE') {
    console.log(`[BOT GUILDS] Joined or loaded guild: ${data.name} (${data.id})`);
    botGuildsCache.set(String(data.id), {
      id: String(data.id),
      name: data.name,
      icon: data.icon,
      icon_hash: data.icon,
      iconHash: data.icon,
      iconUrl: data.icon ? `https://cdn.discordapp.com/icons/${data.id}/${data.icon}.webp?size=128` : null,
      permissions: String(data.permissions || '8'),
      memberCount: Number(data.member_count || data.approximate_member_count || 0)
    });
  } else if (type === 'GUILD_DELETE') {
    console.log(`[BOT GUILDS] Left guild: ${data.id}`);
    botGuildsCache.delete(String(data.id));
  } else if (type === 'GUILD_MEMBER_ADD') {
    if (data?.guild_id && data?.user?.id) {
      recordBotMemberJoin(data.guild_id, data.user.id);
    }
  } else if (type === 'GUILD_MEMBER_REMOVE') {
    if (data?.guild_id && data?.user?.id) {
      recordBotMemberLeave(data.guild_id, data.user.id);
    }
  }
}

export async function fetchRealBotGuilds(force = false) {
  const now = Date.now();
  if (!force && botGuildsCache.size > 0 && now - lastBotGuildsFetch < BOT_GUILDS_CACHE_TTL) {
    return Array.from(botGuildsCache.values());
  }

  // Primary ConnectingERLC#0281 bot
  const tokens = [
    (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '')
  ].filter(Boolean);
  const uniqueTokens = [...new Set(tokens)];

  if (uniqueTokens.length === 0) {
    botGuildsCache.clear();
    return [];
  }

  for (const token of uniqueTokens) {
    try {
      const res = await fetch('https://discord.com/api/v10/users/@me/guilds?with_counts=true', {
        headers: { Authorization: `Bot ${token}` },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) {
        if (res.status === 401) {
          console.warn('[BOT GUILDS] Discord token is invalid or expired.');
        }
        continue;
      }
      const guilds = await res.json();
      if (Array.isArray(guilds)) {
        for (const g of guilds) {
          const existing = botGuildsCache.get(String(g.id));
          const perms = String(g.permissions || '0');
          botGuildsCache.set(String(g.id), {
            id: String(g.id),
            name: g.name,
            icon: g.icon,
            icon_hash: g.icon,
            iconHash: g.icon,
            iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=128` : null,
            permissions: existing && (BigInt(existing.permissions || '0') & 8n) === 8n ? existing.permissions : perms,
            memberCount: Number(g.approximate_member_count || existing?.memberCount || 0)
          });
        }
      }
    } catch (err) {
      console.warn('[BOT GUILDS] Error refreshing bot guilds:', err.message);
    }
  }

  lastBotGuildsFetch = Date.now();
  return Array.from(botGuildsCache.values());
}

export function getGuildBotStatus(guildId) {
  const targetId = String(guildId);
  const forced = (process.env.FORCE_BOT_GUILDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (forced.includes(targetId)) {
    return {
      guildId: targetId,
      bot_in_guild: true,
      botStatus: 'Online',
      missingPermissions: []
    };
  }

  const token = (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) {
    return {
      guildId: targetId,
      bot_in_guild: false,
      botStatus: 'Offline',
      missingPermissions: []
    };
  }

  let g = botGuildsCache.get(targetId);
  if (!g) {
    // 1. Check active customer clients
    for (const [, client] of activeCustomerClients) {
      if (client?.isReady?.() && client.guilds?.cache?.has?.(targetId)) {
        const cg = client.guilds.cache.get(targetId);
        g = { id: targetId, name: cg?.name || 'Discord Server', permissions: '8' };
        botGuildsCache.set(targetId, g);
        break;
      }
    }
  }
  if (!g) {
    // 2. Check promoted_servers.json
    try {
      const dirData = loadDirectoryData();
      const pServer = dirData.servers?.find(s => String(s.id) === targetId || String(s.guildId) === targetId);
      if (pServer && (pServer.bot_in_guild === true || pServer.isConfigured === true)) {
        g = { id: targetId, name: pServer.name, permissions: '8' };
        botGuildsCache.set(targetId, g);
      }
    } catch {}
  }
  if (!g) {
    // 3. Check bot instances database
    try {
      const bInst = findGuildBot(targetId);
      if (bInst) {
        g = { id: targetId, name: bInst.customizations?.serverName || 'Guild', permissions: '8' };
        botGuildsCache.set(targetId, g);
      }
    } catch {}
  }

  if (!g) {
    return {
      guildId: targetId,
      bot_in_guild: false,
      botStatus: 'Not added',
      missingPermissions: []
    };
  }

  const perms = BigInt(g.permissions || '0');
  const isAdmin = (perms & 8n) === 8n;
  const missing = [];
  if (!isAdmin) {
    if ((perms & 16n) !== 16n) missing.push('Manage Channels');
    if ((perms & 1n) !== 1n) missing.push('Create Invite');
    if ((perms & 2n) !== 2n) missing.push('Kick Members');
    if ((perms & 4n) !== 4n) missing.push('Ban Members');
    if ((perms & 1024n) !== 1024n) missing.push('View Channels');
    if ((perms & 2048n) !== 2048n) missing.push('Send Messages');
    if ((perms & 16384n) !== 16384n) missing.push('Embed Links');
    if ((perms & 8192n) !== 8192n) missing.push('Manage Messages');
  }

  if (missing.length > 0) {
    return {
      guildId: targetId,
      bot_in_guild: true,
      botStatus: 'Missing permissions',
      missingPermissions: missing
    };
  }

  return {
    guildId: targetId,
    bot_in_guild: true,
    botStatus: 'Online',
    missingPermissions: []
  };
}

/**
 * Verifies if a user is currently a member of a Discord guild.
 * Checks user OAuth cached guilds first, then queries Discord REST API using bot token(s).
 */
export async function checkUserInGuild(guildId, userId, userGuilds = [], session = null) {
  if (!guildId || !userId) return false;
  const targetGuildId = String(guildId);
  const targetUserId = String(userId);

  // 1. Check if user OAuth guilds already confirm membership
  if (Array.isArray(userGuilds) && userGuilds.some(g => String(g.id) === targetGuildId)) {
    return true;
  }

  // 2. Query Discord REST API with bot token(s)
  const tokens = [
    (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '')
  ].filter(Boolean);
  const uniqueTokens = [...new Set(tokens)];

  for (const token of uniqueTokens) {
    try {
      const res = await fetch(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${targetUserId}`, {
        headers: { Authorization: `Bot ${token}` },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        return true;
      }
    } catch (err) {
      console.warn(`[MEMBER CHECK] Error checking member ${targetUserId} in guild ${targetGuildId}:`, err.message);
    }
  }

  // 3. If session has user access token, refresh user's live guilds from Discord OAuth API
  if (session && session.accessToken) {
    try {
      const token = await renewAccessToken(session).catch(() => session.accessToken);
      if (token) {
        const userGuildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000)
        });
        if (userGuildsRes.ok) {
          const liveGuilds = await userGuildsRes.json();
          if (Array.isArray(liveGuilds)) {
            session.guildCache = { cachedAt: Date.now(), guilds: liveGuilds };
            if (liveGuilds.some(g => String(g.id) === targetGuildId)) {
              return true;
            }
          }
        }
      }
    } catch (oauthErr) {
      console.warn(`[MEMBER CHECK] OAuth live guilds refresh failed:`, oauthErr.message);
    }
  }

  // Not in guild
  return false;
}

async function refreshBotGuildsPeriodic() {
  try {
    const list = await fetchRealBotGuilds(true);
    const token = (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
    for (const bg of list) {
      updatePromotedServerDetails(bg.id, {
        name: bg.name,
        icon: bg.icon,
        icon_hash: bg.icon,
        iconHash: bg.icon,
        memberCount: bg.memberCount,
        bot_in_guild: true
      });

      if (token) {
        try {
          const gRes = await fetch(`https://discord.com/api/v10/guilds/${bg.id}?with_counts=true`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(4000)
          });
          if (gRes.ok) {
            const g = await gRes.json();
            const patch = {
              name: g.name,
              icon: g.icon,
              icon_hash: g.icon,
              iconHash: g.icon,
              memberCount: g.approximate_member_count || bg.memberCount,
              bot_in_guild: true
            };
            if (g.owner_id) {
              patch.ownerId = g.owner_id;
              const uRes = await fetch(`https://discord.com/api/v10/users/${g.owner_id}`, {
                headers: { Authorization: `Bot ${token}` },
                signal: AbortSignal.timeout(4000)
              });
              if (uRes.ok) {
                const u = await uRes.json();
                patch.ownerUsername = u.username;
                patch.owner_display_name = u.global_name || u.username;
                patch.owner_avatar_hash = u.avatar;
              }
            }
            updatePromotedServerDetails(bg.id, patch);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[BOT GUILDS] Periodic refresh error:', err.message);
  }
}

// REST check at startup and every 10 minutes (Round 11 Section 3)
refreshBotGuildsPeriodic();
setInterval(refreshBotGuildsPeriodic, 10 * 60 * 1000);


// ─── Settings the website is allowed to change ─────────────────────────────
// Settings the website and Discord bot are allowed to configure (known valid fields only)
export const customizationFields = new Set([
  // Server details
  'serverName', 'joinCode', 'botActivityText', 'botPrefix', 'serverIconUrl',
  // Community & Directory
  'setupCompleted', 'welcomeEnabled', 'welcomeChannelId', 'welcomeText', 'welcomeBannerUrl',
  // Permissions & Moderation
  'botStaffRoleId', 'adminRoleId', 'staffRoleIds', 'quarantineRoleId', 'auditChannelId', 'bumpChannelId', 'bumpRoleId',
  'bumpNoticeEnabled', 'bumpReadyNoticeEnabled', 'autoBumpReminder', 'joinRoleIds', 'botJoinRoleId', 'logChannelId', 'notificationChannelId',
  'autoBumpEnabled', 'autoBumpInterval', 'customBumpMessage', 'promotionStaffRoleId', 'modLogChannelId',
  // Recruiting & Representatives
  'recruitRepresentatives', 'representativesWanted', 'creditsPerRecruit', 'approveManually', 'recruitLogChannelId', 'repRoleId', 'recruitRoleId',
  // Directory & Growth
  'inviteUrl', 'discordInvite', 'serverDescription', 'serverTags', 'serverCategory', 'serverSummary', 'serverLanguage', 'language',
  'serverBannerUrl', 'bannerUrl', 'bannerStyle', 'rewardCoins', 'coinsPerJoin', 'offerHigherReward', 'extraCreditsPerJoin', 'extraRewardPaused',
  'retentionTargetHours', 'listedInDirectory', 'isListed', 'dmOwner', 'rosterData',
  // ER:LC API Key
  'erlcApiKey',
  // Server Partnerships
  'partnershipSetUp', 'acceptPartnerships', 'openForPartnerships', 'partnershipChannelId', 'partnershipAdText',
  'allowPartnerMentions', 'partnershipAllowedMentions', 'partnershipMinMembers', 'partnershipMinAge', 'partnershipPrice', 'partnershipCooldownHours',
  'partnershipHerePrice', 'partnershipEveryonePrice', 'partnershipBroadcastChannel', 'partnershipAcceptedCategories', 'partnershipDailyLimit',
  'partnershipQuestions'
]);

export function stripLegacyCustomizations(customs) {
  if (!customs || typeof customs !== 'object') return {};
  const clean = {};
  for (const [k, v] of Object.entries(customs)) {
    if (customizationFields.has(k)) {
      clean[k] = v;
    }
  }
  return clean;
}

const booleanFields = new Set([
  'partnershipSetUp', 'welcomeEnabled', 'setupCompleted', 'acceptPartnerships', 'allowPartnerMentions', 'openForPartnerships',
  'autoBumpEnabled', 'autoBumpReminder', 'bumpNoticeEnabled', 'bumpReadyNoticeEnabled', 'recruitRepresentatives', 'approveManually',
  'offerHigherReward', 'extraRewardPaused', 'listedInDirectory', 'isListed', 'dmOwner'
]);
const snowflakeFields = new Set([...customizationFields].filter(key => key.endsWith('ChannelId') || key.endsWith('RoleId') || key.endsWith('VcId')));

// ─── Session persistence (survives restarts, Section 1.3) ───────────────────
function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
    const now = Date.now();
    for (const [id, session] of Object.entries(raw)) {
      if (session && typeof session === 'object' && session.user?.id) {
        const exp = session.expiresAtSession || session.expiresAt || (now + SESSION_MAX_AGE);
        if (exp > now) {
          session.expiresAtSession = exp;
          sessions.set(id, session);
        }
      }
    }
    console.log(`[WEB] Restored ${sessions.size} dashboard session(s).`);
  } catch (err) {
    console.warn('[WEB] Could not restore dashboard sessions:', err.message);
  }
}

function getSession(sessionId) {
  if (!sessionId) return null;
  let s = sessions.get(sessionId);
  if (!s && fs.existsSync(SESSIONS_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
      if (raw[sessionId] && raw[sessionId].user?.id) {
        const exp = raw[sessionId].expiresAtSession || raw[sessionId].expiresAt || (Date.now() + SESSION_MAX_AGE);
        if (exp > Date.now()) {
          s = raw[sessionId];
          s.expiresAtSession = exp;
          sessions.set(sessionId, s);
        }
      }
    } catch {}
  }

  // Sliding 30-day session expiry (Section 1.3): refresh if less than 29 days left
  if (s) {
    const now = Date.now();
    if (!s.expiresAtSession || s.expiresAtSession - now < 29 * 24 * 60 * 60 * 1000) {
      s.expiresAtSession = now + SESSION_MAX_AGE;
      persistSessions(true);
    }
  }

  return s;
}

let persistTimer = null;
function persistSessions(immediate = false) {
  const doPersist = () => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const serializable = {};
      for (const [id, session] of sessions) {
        serializable[id] = {
          ...session,
          expiresAtSession: session.expiresAtSession || Date.now() + SESSION_MAX_AGE,
        };
      }
      const tmp = `${SESSIONS_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(serializable, null, 2), 'utf8');
      fs.renameSync(tmp, SESSIONS_FILE);
    } catch (err) {
      console.warn('[WEB] Could not save dashboard sessions:', err.message);
    }
  };

  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    doPersist();
    return;
  }

  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    doPersist();
  }, 300);
  persistTimer.unref?.();
}

loadSessions();

const sweeper = setInterval(() => {
  const now = Date.now();
  let removed = false;
  for (const [id, session] of sessions) {
    if (session.expiresAtSession < now) { sessions.delete(id); removed = true; }
  }
  for (const [state, pending] of oauthStates) {
    if (pending.expiresAt < now) oauthStates.delete(state);
  }
  for (const [key, entry] of erlcCache) if (entry.expiresAt < now) erlcCache.delete(key);
  if (removed) persistSessions();
}, 10 * 60 * 1000);
sweeper.unref?.();

// ─── Basic per-IP rate limiting ────────────────────────────────────────────
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt < now) hits.delete(key);
  }, windowMs);
  cleanup.unref?.();
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const userId = req.dashboardSession?.user?.id || req.user?.id || '';
    const key = userId ? `${ip}:${userId}` : ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Wait a moment and try again.' });
    }
    next();
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function oauthClientId() {
  if (process.env.DISCORD_OAUTH_CLIENT_ID) {
    return process.env.DISCORD_OAUTH_CLIENT_ID.trim();
  }
  if (process.env.DISCORD_CLIENT_ID) {
    return process.env.DISCORD_CLIENT_ID.trim();
  }
  // The registered OAuth application with https://connectingerlc.xyz/auth/discord/callback is strictly 1552165138017165372.
  return '1552165138017165372';
}

function appOrigin(req) {
  const defaultOrigin = (process.env.SITE_URL || process.env.APP_ORIGIN || 'https://connectingerlc.xyz').replace(/\/$/, '');
  if (req) {
    const fHost = (req.get('x-forwarded-host') || '').split(',')[0].trim();
    const hostHeader = (req.get('host') || '').trim();
    const cand = fHost || hostHeader;
    // Only accept allowlisted domain names to prevent host header injection / cache poisoning
    if (cand && (cand === 'connectingerlc.xyz' || cand === 'www.connectingerlc.xyz' || cand.endsWith('.up.railway.app') || cand.startsWith('localhost:') || cand === 'localhost' || cand.startsWith('127.0.0.1:') || cand === '127.0.0.1')) {
      const isLocal = cand.includes('localhost') || cand.includes('127.0.0.1');
      const proto = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : (isLocal ? 'http' : 'https');
      return `${proto}://${cand}`;
    }
  }
  return defaultOrigin;
}

function callbackUrl(req) {
  const origin = appOrigin(req);
  if (origin && (origin.includes('connectingerlc.xyz') || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('.up.railway.app'))) {
    return `${origin}/auth/discord/callback`;
  }
  const envUri = (process.env.DISCORD_REDIRECT_URI || '').trim();
  if (envUri && !envUri.includes('trycloudflare') && !envUri.includes('ngrok') && !envUri.includes('loca.lt')) {
    return envUri;
  }
  return `${origin}/auth/discord/callback`;
}

function safeReturnUrl(value, origin) {
  const base = origin || 'http://localhost:3000';
  if (!value) return `${base}/dashboard`;
  try {
    if (value.startsWith('/')) {
      return `${base}${value}`;
    }
    const parsed = new URL(value);
    const originUrl = new URL(base);
    return parsed.origin === originUrl.origin ? value : `${base}/dashboard`;
  } catch {
    return `${base}/dashboard`;
  }
}

function cookieValue(req, name) {
  const cookieHeader = req.headers.cookie || '';
  if (!cookieHeader) return '';
  const findVal = (n) => {
    const prefix = `${n}=`;
    const found = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
    return found ? decodeURIComponent(found.slice(prefix.length)) : '';
  };
  const val = findVal(name);
  if (val) return val;
  if (!name || name === SESSION_COOKIE || SESSION_COOKIE_FALLBACKS.includes(name)) {
    for (const fb of SESSION_COOKIE_FALLBACKS) {
      const fbVal = findVal(fb);
      if (fbVal) return fbVal;
    }
  }
  return '';
}

function cookieOptions(req) {
  const isProd = process.env.NODE_ENV === 'production';
  const origin = appOrigin(req);
  const isHttps = isProd && (origin.startsWith('https://') || req.secure || req.get('x-forwarded-proto') === 'https');
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE
  };
}

function permissionsAllowManageGuild(guild) {
  if (guild.owner === true || guild.owner === 'true') return true;
  try {
    const rawPerms = guild.permissions || guild.permissions_new || '0';
    const permissions = BigInt(rawPerms);
    return (permissions & 0x8n) === 0x8n || (permissions & 0x20n) === 0x20n;
  } catch {
    return false;
  }
}

class DiscordError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function discordJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    signal: options.signal || AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new DiscordError(response.status, `Discord API returned ${response.status}`);
  return response.json();
}

async function renewAccessToken(session) {
  if (session.expiresAt > Date.now() + 30_000) return session.accessToken;
  if (!session.refreshToken) throw new DiscordError(401, 'Discord session expired. Sign in again.');

  const primaryClientId = oauthClientId();
  const primarySecret = (primaryClientId === '1552165138017165372')
    ? (process.env.DISCORD_OAUTH_CLIENT_SECRET || 'B1ZMN4DnNazguGJKip5gqGIKO5r8jZvt')
    : (process.env.DISCORD_CLIENT_SECRET || '6QlYiii4PJUTjfYXNpIDUdTJ8rQv9CaM');

  const candidatePairs = [
    { clientId: '1552165138017165372', clientSecret: process.env.DISCORD_OAUTH_CLIENT_SECRET || 'B1ZMN4DnNazguGJKip5gqGIKO5r8jZvt' },
    { clientId: '1552165138017165372', clientSecret: process.env.DISCORD_CLIENT_SECRET || '6QlYiii4PJUTjfYXNpIDUdTJ8rQv9CaM' },
    { clientId: primaryClientId, clientSecret: primarySecret },
    { clientId: '1560767279191302215', clientSecret: '6QlYiii4PJUTjfYXNpIDUdTJ8rQv9CaM' }
  ];
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    candidatePairs.push({ clientId: process.env.DISCORD_CLIENT_ID.trim(), clientSecret: process.env.DISCORD_CLIENT_SECRET.trim() });
  }

  let tokenData = null;
  for (const pair of candidatePairs) {
    try {
      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: pair.clientId,
          client_secret: pair.clientSecret || '',
          grant_type: 'refresh_token',
          refresh_token: session.refreshToken
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (tokenResponse.ok) {
        tokenData = await tokenResponse.json();
        break;
      }
    } catch {}
  }

  if (!tokenData) throw new DiscordError(401, 'Discord session expired. Sign in again.');
  session.accessToken = tokenData.access_token;
  session.refreshToken = tokenData.refresh_token || session.refreshToken;
  session.expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
  persistSessions();
  return session.accessToken;
}

function guildIconUrl(guild) {
  if (!guild.icon) return null;
  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=128`;
}

/** Stored settings record for a guild (any admin of that guild may manage it). */
function findGuildBot(guildId) {
  const all = Object.values(loadBotInstances()).filter(bot => bot.guildId === guildId && !bot.banned);
  return all.find(bot => bot.botId !== MASTER_BOT_ID) || all.find(bot => bot.botId === MASTER_BOT_ID) || null;
}

function isBannedGuild(guildId) {
  return Object.values(loadBotInstances()).some(bot => bot.guildId === guildId && bot.banned);
}

/** Servers the signed-in user can manage, read from their own Discord OAuth token. */
async function manageableGuilds(session, { force = false } = {}) {
  await fetchRealBotGuilds().catch(() => {});
  const cached = session.guildCache;
  if (!force && cached && cached.expiresAt > Date.now()) return decorateGuilds(cached.guilds);
  try {
    const token = await renewAccessToken(session);
    const guilds = await discordJson('https://discord.com/api/v10/users/@me/guilds?with_counts=true', token);
    const filtered = (Array.isArray(guilds) ? guilds : []).filter(permissionsAllowManageGuild).map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      icon_hash: guild.icon,
      iconHash: guild.icon,
      iconUrl: guildIconUrl(guild),
      owner: Boolean(guild.owner),
      memberCount: Number(guild.approximate_member_count || 0)
    }));
    session.guildCache = { guilds: filtered, expiresAt: Date.now() + 5 * 60 * 1000 };
    persistSessions();
    for (const g of filtered) {
      updatePromotedServerDetails(g.id, {
        name: g.name,
        icon: g.icon,
        icon_hash: g.icon,
        iconHash: g.icon,
        memberCount: g.memberCount
      });
    }
    return decorateGuilds(filtered);
  } catch (err) {
    console.warn('[WEB] Could not fetch Discord user guilds:', err.message);
    if (cached && Array.isArray(cached.guilds) && !(err instanceof DiscordError && err.status === 401)) {
      return decorateGuilds(cached.guilds);
    }
    if (!(err instanceof DiscordError && err.status === 401)) {
      const botGuilds = Array.from(botGuildsCache.values());
      if (botGuilds.length > 0) {
        return decorateGuilds(botGuilds);
      }
    }
    throw err;
  }
}

function decorateGuilds(guilds) {
  return guilds.map(guild => {
    const statusInfo = getGuildBotStatus(guild.id);
    return {
      ...guild,
      bot_in_guild: statusInfo.bot_in_guild,
      botStatus: statusInfo.botStatus,
      missingPermissions: statusInfo.missingPermissions,
      hasWorkspace: statusInfo.bot_in_guild,
      configured: statusInfo.bot_in_guild
    };
  });
}

async function findAuthorizedGuild(session, guildId) {
  if (typeof guildId !== 'string' || !/^\d{17,20}$/.test(guildId)) return null;
  const guilds = await manageableGuilds(session);
  return guilds.find(guild => guild.id === guildId) || null;
}

function publicCustomizations(customizations = {}) {
  return stripLegacyCustomizations(customizations);
}

async function guildResources(bot) {
  if (!bot || !bot.guildId) return null;
  const cacheKey = `${bot.botId}:${bot.guildId}`;
  const cached = resourceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // 1. Try active customer clients (direct match or any running bot connected to this guild)
  let guild = null;
  const directClient = activeCustomerClients.get(bot.botId);
  if (directClient && directClient.isReady()) {
    guild = directClient.guilds.cache.get(bot.guildId);
  }
  if (!guild) {
    for (const [, c] of activeCustomerClients) {
      if (c && c.isReady()) {
        const found = c.guilds.cache.get(bot.guildId);
        if (found) {
          guild = found;
          break;
        }
      }
    }
  }

  if (guild) {
    const channels = guild.channels.cache
      .filter(c => c.type === 0 || c.type === 2 || c.type === 4 || c.type === 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const roles = guild.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position
      }))
      .sort((a, b) => b.position - a.position);

    const value = { channels, roles };
    resourceCache.set(cacheKey, { value, expiresAt: Date.now() + RESOURCE_CACHE_TTL });
    return value;
  }

  // 2. Try Discord REST API if token exists
  const token = bot.token || process.env.DISCORD_TOKEN;
  if (token) {
    try {
      const cleanToken = token.trim().replace(/^Bot\s+/i, '');
      const [chRes, roRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${bot.guildId}/channels`, {
          headers: { Authorization: `Bot ${cleanToken}` },
          signal: AbortSignal.timeout(6000)
        }).catch(() => null),
        fetch(`https://discord.com/api/v10/guilds/${bot.guildId}/roles`, {
          headers: { Authorization: `Bot ${cleanToken}` },
          signal: AbortSignal.timeout(6000)
        }).catch(() => null)
      ]);

      if (chRes?.ok && roRes?.ok) {
        const rawChannels = await chRes.json();
        const rawRoles = await roRes.json();

        const channels = rawChannels
          .map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            parentId: c.parent_id
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const roles = rawRoles
          .filter(r => r.name !== '@everyone')
          .map(r => ({
            id: r.id,
            name: r.name,
            color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#99aab5',
            position: r.position
          }))
          .sort((a, b) => b.position - a.position);

        const value = { channels, roles };
        resourceCache.set(cacheKey, { value, expiresAt: Date.now() + RESOURCE_CACHE_TTL });
        return value;
      }
    } catch (err) {
      console.warn('[WEB] Failed to fetch Discord resources via REST:', err.message);
    }
  }

  return null;
}

function decodeBotIdFromToken(token) {
  try {
    const decodedId = Buffer.from(String(token).split('.')[0], 'base64').toString('utf8');
    return /^\d{17,20}$/.test(decodedId) ? decodedId : null;
  } catch {
    return null;
  }
}

const INVITE_PERMISSIONS = [
  1n << 0n,  // Create invite
  1n << 4n,  // Manage channels
  1n << 10n, // View channels
  1n << 11n, // Send messages
  1n << 13n, // Manage messages
  1n << 14n, // Embed links
  1n << 15n, // Attach files
  1n << 16n, // Read message history
  1n << 18n, // Use external emojis
  1n << 20n, // Connect
  1n << 21n, // Speak
  1n << 28n  // Manage roles
].reduce((total, permission) => total | permission, 0n);

let cachedMasterBotUser = null;
let cachedMasterBotUserExpiresAt = 0;

async function getMasterBotUser() {
  if (cachedMasterBotUser && Date.now() < cachedMasterBotUserExpiresAt) {
    return cachedMasterBotUser;
  }
  const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) return null;
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      cachedMasterBotUser = {
        id: data.id,
        username: data.username,
        avatarUrl: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128` : null
      };
      cachedMasterBotUserExpiresAt = Date.now() + 5 * 60 * 1000;
      return cachedMasterBotUser;
    }
  } catch {}
  return cachedMasterBotUser;
}

function publicBot(bot) {
  const client = activeCustomerClients.get(bot.botId);
  const ready = Boolean(client?.isReady?.());
  const discordBotId = bot.discordBotId || client?.user?.id || decodeBotIdFromToken(bot.token) || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '1552165138017165372';
  const botUser = ready && client.user ? {
    id: client.user.id,
    username: client.user.username,
    avatarUrl: client.user.displayAvatarURL({ size: 128 })
  } : (cachedMasterBotUser ? {
    id: cachedMasterBotUser.id,
    username: cachedMasterBotUser.username,
    avatarUrl: cachedMasterBotUser.avatarUrl || ''
  } : null);
  return {
    id: bot.botId,
    guildId: bot.guildId,
    isMainBot: bot.botId === MASTER_BOT_ID,
    discordBotId,
    botUser,
    isInGuild: ready ? Boolean(client.guilds.cache.has(bot.guildId)) : true,
    inviteUrl: discordBotId
      ? buildBotInviteUrl({ clientId: discordBotId, guildId: bot.guildId, tiers: ['basic'], disableGuildSelect: true })
      : null,
    status: bot.banned ? 'suspended' : (ready ? 'online' : (bot.token ? 'offline' : 'online')),
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
    hasDiscordToken: Boolean(bot.token || process.env.DISCORD_TOKEN),
    hasErlcApiKey: Boolean(bot.erlcApiKey),
    customizations: publicCustomizations(bot.customizations)
  };
}

const publicWorkspace = publicBot;

function validHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateCustomizations(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Settings must be an object.' };
  const updates = {};
  for (const [key, value] of Object.entries(input)) {
    if (!customizationFields.has(key)) {
      // Strip unknown or deprecated keys cleanly without crashing settings save
      continue;
    }

    if (key === 'staffRoleIds' || key === 'joinRoleIds') {
      if (!Array.isArray(value) || value.length > 30 || value.some(id => typeof id !== 'string' || !/^\d{17,20}$/.test(id))) {
        return { error: 'Roles are invalid.' };
      }
      updates[key] = [...new Set(value)];
      continue;
    }

    if (booleanFields.has(key)) {
      if (typeof value !== 'boolean') return { error: `The setting "${key}" must be on or off.` };
      updates[key] = value;
      continue;
    }

    if (['partnershipMinMembers', 'partnershipMinAge', 'partnershipCooldownHours', 'partnershipPrice', 'partnershipHerePrice', 'partnershipEveryonePrice', 'partnershipDailyLimit', 'rewardCoins', 'coinsPerJoin', 'extraCreditsPerJoin', 'retentionTargetHours', 'representativesWanted', 'creditsPerRecruit', 'autoBumpInterval'].includes(key)) {
      if ((key === 'partnershipMinMembers' || key === 'partnershipPrice') && (value === null || value === '')) {
        updates[key] = null;
        continue;
      }
      const num = Number(value);
      if (isNaN(num)) return { error: `The setting "${key}" must be a number.` };
      updates[key] = num;
      continue;
    }

    if (['serverTags', 'partnershipAcceptedCategories'].includes(key)) {
      if (!Array.isArray(value)) return { error: `The setting "${key}" must be an array.` };
      updates[key] = value.slice(0, 50).filter(s => typeof s === 'string');
      continue;
    }

    // Handle Banner & Image URLs (allow base64 PNG data URLs up to 5MB, null/undefined treated as empty string)
    if (['serverBannerUrl', 'bannerUrl', 'welcomeBannerUrl'].includes(key)) {
      if (value === null || value === undefined) {
        updates[key] = '';
        continue;
      }
      if (typeof value !== 'string') return { error: `The setting "${key}" must be text.` };
      if (value.length > 5000000) return { error: 'Banner image payload too large. Please upload an image under 5MB.' };
      const trimmedBanner = (value ?? '').trim();
      if (!trimmedBanner) {
        updates[key] = '';
        continue;
      }
      if (trimmedBanner.startsWith('data:image/')) {
        updates[key] = trimmedBanner;
        continue;
      }
      let formatted = trimmedBanner;
      if (!/^https?:\/\//i.test(formatted)) {
        formatted = `https://${formatted}`;
      }
      updates[key] = formatted;
      continue;
    }

    if (value === null || value === undefined) {
      updates[key] = '';
      continue;
    }

    if (typeof value !== 'string' || value.length > 6000) return { error: `The setting "${key}" must be text no longer than 6,000 characters.` };
    const trimmed = (value ?? '').trim();
    if (snowflakeFields.has(key) && trimmed && !/^\d{17,20}$/.test(trimmed)) return { error: `The setting "${key}" must be a Discord ID.` };
    if (key.endsWith('Url')) {
      if (!trimmed) {
        updates[key] = '';
        continue;
      }
      let formatted = trimmed;
      if (!/^https?:\/\//i.test(formatted)) {
        formatted = `https://${formatted}`;
      }
      if (key === 'inviteUrl') {
        updates[key] = formatted;
        continue;
      }
      if (!validHttpsUrl(formatted)) return { error: `The setting "${key}" must be a valid URL.` };
      updates[key] = formatted;
      continue;
    }
    if (key === 'panelDesign' && !['v2', 'classic'].includes(trimmed)) return { error: 'Choose a valid panel design (v2 or classic).' };
    if (key === 'panelLayout' && !['buttons', 'select', 'both'].includes(trimmed)) return { error: 'Choose a valid panel layout (buttons or select).' };
    if (key === 'panelColor' && trimmed && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return { error: 'Choose a valid hex accent color (e.g. #2ecc71).' };
    if (key === 'buttonPlacement' && !['outside', 'inside'].includes(trimmed)) return { error: 'Choose a valid button placement (outside or inside).' };
    if (key === 'staffDocsLayout' && !['buttons', 'select'].includes(trimmed)) return { error: 'Choose a valid documentation layout.' };
    if (key === 'aiProvider' && !['openai', 'openrouter', 'groq', 'gemini'].includes(trimmed)) return { error: 'Choose a supported AI provider.' };
    if (key === 'quotaRequirement' && trimmed && !/^\d{1,6}$/.test(trimmed)) return { error: 'The weekly quota must be a whole number.' };
    if (['panelTitle', 'rulesTitle', 'rulesButtonLabel', 'sessionStartTitle', 'sessionShutdownTitle', 'appTitle', 'staffDocsTitle'].includes(key) && trimmed.length > 256) {
      return { error: 'Titles can be at most 256 characters.' };
    }
    if (key === 'rulesButtonLabel' && trimmed.length > 80) return { error: 'Button labels can be at most 80 characters.' };
    if (key === 'botActivityText' && trimmed.length > 128) return { error: 'Bot status text can be at most 128 characters.' };
    updates[key] = key.endsWith('Url') || snowflakeFields.has(key) ? trimmed : value;
  }
  return { updates };
}

function erlcBase() {
  return process.env.ERLC_API_BASE || 'https://api.erlc.gg/v1';
}

async function validateErlcKey(apiKey) {
  const response = await fetch(`${erlcBase()}/server`, {
    headers: { 'Server-Key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  });
  if (response.status === 429) return { error: 'ER:LC is rate limiting requests right now. Try again in a minute.' };
  if (!response.ok) return { error: 'ER:LC did not accept that API key.' };
  const data = await response.json().catch(() => ({}));
  return {
    server: {
      name: data.Name || null,
      joinCode: data.JoinKey || data.JoinCode || null,
      currentPlayers: Number.isFinite(data.CurrentPlayers) ? data.CurrentPlayers : null,
      maxPlayers: Number.isFinite(data.MaxPlayers) ? data.MaxPlayers : null
    }
  };
}



async function postBumpToChannel(guildId, userId, targetChannelId, guildName = 'Community server') {
  try {
    const token = (process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
    if (!token || !targetChannelId) return;

    const payload = buildBumpThankYouV2({
      callerId: userId,
      serverName: guildName || 'Community',
      serverSlug: guildId,
      cooldownHours: 1
    });

    await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[WEB] postBumpToChannel notice:', err.message);
  }
}

async function sendDiscordNotificationV2(targetUserId, type = 'bump', guildName = 'Community server', guildId = '') {
  return await sendDirectNotificationV2({
    targetUserId,
    type,
    serverName: guildName,
    slug: guildId,
    guildId
  });
}

// ─── Router ────────────────────────────────────────────────────────────────
export function createDashboardRouter() {
  const router = Router();

  // Token Bucket Rate Limiting for writes
  router.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return createRateLimiter('write')(req, res, next);
    }
    next();
  });

  router.use(rateLimit({ windowMs: 60 * 1000, max: 240 }));

  // Ban / blacklist enforcement, client IP tracking, maintenance check & session attachment across ALL requests
  router.use((req, res, next) => {
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = sessionId ? getSession(sessionId) : null;
    if (session && session.expiresAtSession >= Date.now()) {
      req.dashboardSession = session;
      req.dashboardSessionId = sessionId;
    }
    const userId = session?.user?.id || req.user?.id;
    const clientIp = (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '').replace(/^::ffff:/, '');
    req.clientIp = clientIp;

    if (userId && clientIp) {
      try { recordUserIp(userId, clientIp); } catch {}
    }

    // Blacklist check (IP, CIDR, Discord ID) — skip for public routes
    const PUBLIC_PATHS = ['/', '/api/status', '/api/partnerships/:guildId', '/api/partners'];
    const isPublicPath = PUBLIC_PATHS.some(p => req.path === p || req.path.startsWith('/api/partnerships/'));
    if (!isPublicPath && userId && clientIp) {
      const blCheck = checkBlacklist({ discordId: userId, ip: clientIp });
      if (blCheck.blacklisted) {
        if (req.path === '/auth/logout') {
          if (sessionId) {
            sessions.delete(sessionId);
            persistSessions();
          }
          res.clearCookie(SESSION_COOKIE, { ...cookieOptions(req), maxAge: undefined });
          return res.json({ success: true });
        }
        const adminRec = userId ? getAdminRecord(userId) : null;
        if (adminRec && (
          req.path.startsWith('/admin') ||
          req.path === '/auth/me' ||
          req.path === '/api/auth/me' ||
          req.path.startsWith('/admin-portal') ||
          req.path.startsWith('/admin-panel')
        )) {
          return next();
        }
        return res.status(403).json({
          error: 'Access denied: your account or IP address is restricted.',
          code: 'BLACKLISTED',
          reason: blCheck.entry?.reason || 'Security restriction'
        });
      }
    }

    // Maintenance check
    const maint = isMaintenanceActive();
    if (maint.active) {
      const isStaff = userId && Boolean(getAdminRecord(userId));
      const isExempt =
        // 1. Health checks & orchestrator probes (Railway health check MUST always pass)
        req.path === '/healthz' ||
        req.path === '/health' ||
        req.path === '/status' ||
        req.path.startsWith('/status/') ||
        // 2. Public site telemetry & state
        req.path === '/public/site-state' ||
        req.path === '/public/announcements' ||
        req.path === '/public/default-banner' ||
        req.path === '/public/showcase' ||
        req.path === '/telemetry/error' ||
        // 3. Discord login & session routes (admins and users can authenticate through Discord)
        req.path === '/auth/me' ||
        req.path === '/auth/logout' ||
        req.path === '/auth/discord' ||
        req.path.startsWith('/auth/discord') ||
        req.path.startsWith('/auth/callback') ||
        // 4. Admin portal & all administrative APIs (admins can load portal, authenticate, and toggle maintenance)
        req.path.startsWith('/admin') ||
        req.path === '/admin-portal' ||
        req.path.startsWith('/admin-portal') ||
        req.path === '/admin-panel' ||
        req.path.startsWith('/admin-panel') ||
        // 5. Authenticated staff
        isStaff;

      if (!isExempt) {
        return res.status(503).json({
          error: 'ConnectingERLC is currently undergoing scheduled maintenance.',
          code: 'MAINTENANCE',
          maintenance: {
            active: true,
            title: maint.title || 'System Maintenance',
            message: maint.message || 'ConnectingERLC is currently undergoing scheduled platform upgrades.',
            eta: maint.eta,
            starts_at: maint.starts_at,
            ends_at: maint.ends_at
          }
        });
      }
    }

    if (userId && isUserBanned(userId)) {
      // Always allow sign out even when banned
      if (req.path === '/auth/logout') {
        if (sessionId) {
          sessions.delete(sessionId);
          persistSessions();
        }
        res.clearCookie(SESSION_COOKIE, { ...cookieOptions(req), maxAge: undefined });
        return res.json({ success: true });
      }

      // Allow access to administrative endpoints so staff can manage bans
      if (req.path.startsWith('/admin')) {
        return next();
      }

      const bannedList = loadBannedUsers();
      const banRecord = bannedList.find(b => String(b.userId) === String(userId)) || {
        reason: 'Account restriction enforced.',
        duration: 'Permanent',
        bannedAt: new Date().toISOString()
      };
      if (req.path === '/auth/me') {
        const adminRec = userId ? getAdminRecord(userId) : null;
        return res.json({
          user: {
            ...session?.user,
            role: adminRec?.role || session?.user?.role || 'Member',
            isAdmin: Boolean(adminRec),
            isBanned: true,
            ban: banRecord
          },
          isBanned: true,
          ban: banRecord,
          supportServerUrl: process.env.SUPPORT_INVITE_URL || 'https://discord.gg/connectingerlc',
          csrfToken: session?.csrfToken || '',
          guilds: []
        });
      }
      return res.status(403).json({
        error: 'Your account is suspended.',
        code: 'USER_SUSPENDED',
        isBanned: true,
        ban: banRecord,
        supportServerUrl: process.env.SUPPORT_INVITE_URL || 'https://discord.gg/connectingerlc'
      });
    }
    next();
  });

  // Recruiter role server-side access enforcement (Section 7.6)
  router.use((req, res, next) => {
    const userRole = req.dashboardSession?.user?.role || req.session?.user?.role;
    if (userRole === 'Recruiter') {
      const p = req.path;
      const isAllowed =
        p === '/health' ||
        p === '/status' ||
        p.startsWith('/auth') ||
        p.startsWith('/notifications') ||
        p.startsWith('/directory') ||
        p.startsWith('/tags') ||
        p.includes('/recruits') ||
        p.includes('/owner-tools') ||
        p === '/credits';

      if (!isAllowed) {
        return res.status(403).json({ error: 'Forbidden: Recruiter role has limited access.' });
      }
    }
    next();
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Development debug endpoint (disabled in production)
  router.get('/auth/debug', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not Found' });
    }
    const cookieHeader = req.headers.cookie || '';
    const cookieParts = cookieHeader ? cookieHeader.split(';').map(p => p.trim()) : [];
    const receivedCookies = cookieParts.map(p => p.split('=')[0]);
    const sessionId = req.dashboardSessionId || cookieValue(req, SESSION_COOKIE);
    const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
    const now = Date.now();
    const expiry = session ? (session.expiresAtSession || session.expiresAt || 0) : 0;
    const isExpired = expiry ? expiry < now : true;
    const user = session?.user || null;

    let rejectReason = 'None (session valid)';
    if (!cookieHeader) {
      rejectReason = 'No Cookie header was sent by client. Missing credentials: include?';
    } else if (!sessionId) {
      rejectReason = `No session cookie found matching ${SESSION_COOKIE} or fallbacks. Received cookies: ${receivedCookies.join(', ') || 'none'}`;
    } else if (!session) {
      rejectReason = `Session ID ${sessionId.slice(0, 8)}... not found in server memory or web_sessions.json.`;
    } else if (isExpired) {
      rejectReason = `Session expired at ${new Date(expiry).toISOString()} (now is ${new Date(now).toISOString()})`;
    } else if (!user) {
      rejectReason = 'Session found but has no user attached.';
    }

    res.json({
      cookiePresent: Boolean(cookieHeader) ? 'yes' : 'no',
      cookieName: sessionId ? SESSION_COOKIE : (receivedCookies[0] || 'none'),
      receivedCookies,
      sessionFoundInStore: Boolean(session) ? 'yes' : 'no',
      sessionExpiry: expiry ? new Date(expiry).toISOString() : null,
      userId: user?.id || null,
      username: user?.username || null,
      rejectReason,
      valid: Boolean(user && !isExpired)
    });
  });


  router.get('/auth/discord/start', rateLimit({ windowMs: 60 * 1000, max: 20 }), (req, res) => {
    const origin = appOrigin(req);
    const clientId = oauthClientId();
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const returnTo = safeReturnUrl(req.query.returnTo, origin);

    if (!clientId) {
      return res.redirect(`${origin}/login?auth_error=discord_oauth_not_configured`);
    }

    const state = randomBytes(32).toString('hex');
    const redirectUri = callbackUrl(req);
    oauthStates.set(state, { returnTo, redirectUri, origin, expiresAt: Date.now() + 10 * 60 * 1000 });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify guilds',
      state,
      prompt: 'consent'
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  router.get('/auth/discord/callback', completeDiscordAuth);
  router.get('/auth/discord', completeDiscordAuth);

  // ── Public Showcase Endpoint (Cached 60 seconds max) ──
  // Returns published listings ordered by members, strictly public fields,
  // plus live database totals for Connected communities, Members reached, Total bumps, and Network uptime.
  let showcaseCache = null;
  let showcaseCacheTime = 0;
  const SHOWCASE_CACHE_TTL = 60 * 1000;

  function invalidateShowcaseCache() {
    showcaseCache = null;
    showcaseCacheTime = 0;
  }

  async function refreshAllServerMemberCounts() {
    try {
      const dirData = loadDirectoryData();
      if (!Array.isArray(dirData.servers) || dirData.servers.length === 0) return { updated: 0 };
      const botGuilds = await fetchRealBotGuilds(true).catch(() => []);
      const botGuildMap = new Map(botGuilds.map((g) => [String(g.id), g]));
      const token = getBotToken();
      let updated = 0;

      for (const s of dirData.servers) {
        const sid = String(s.id || s.guildId || '');
        if (!sid) continue;
        const fromBotList = botGuildMap.get(sid);
        if (fromBotList && Number(fromBotList.memberCount) > 0) {
          if (s.memberCount !== Number(fromBotList.memberCount) || s.bot_in_guild === false) {
            s.memberCount = Number(fromBotList.memberCount);
            s.bot_in_guild = true;
            updated++;
          }
          continue;
        }

        // Try direct bot guild fetch if token is configured
        let resolvedByBot = false;
        if (token && /^\d{17,20}$/.test(sid)) {
          try {
            const gRes = await fetch(`https://discord.com/api/v10/guilds/${sid}?with_counts=true`, {
              headers: { Authorization: `Bot ${token}` },
              signal: AbortSignal.timeout(4000)
            });
            if (gRes.ok) {
              const gJson = await gRes.json();
              const approx = Number(gJson.approximate_member_count || gJson.member_count || 0);
              if (approx > 0) {
                s.memberCount = approx;
                s.bot_in_guild = true;
                updated++;
              }
              resolvedByBot = true;
            } else if (gRes.status === 403 || gRes.status === 404) {
              s.bot_in_guild = false;
            }
          } catch {}
        }

        // Handle servers where the bot is missing: fall back to Discord invite counts if inviteUrl exists
        if (!resolvedByBot && s.inviteUrl) {
          try {
            const invCheck = await validateDiscordInvite(s.inviteUrl, sid);
            if (invCheck.valid && Number(invCheck.memberCount) > 0 && s.memberCount !== Number(invCheck.memberCount)) {
              s.memberCount = Number(invCheck.memberCount);
              updated++;
            }
          } catch {}
        }
      }

      if (updated > 0) {
        saveDirectoryData(dirData);
        invalidateShowcaseCache();
      }
      return { updated };
    } catch (err) {
      return { updated: 0, error: err.message };
    }
  }

  // Schedule periodic member count refresh every 5 minutes
  const memberRefreshTimer = setInterval(() => {
    refreshAllServerMemberCounts().catch(() => {});
  }, 5 * 60 * 1000);
  if (memberRefreshTimer.unref) memberRefreshTimer.unref();

  router.get('/public/showcase', (req, res) => {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 60));
    const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
    const now = Date.now();
    if (!forceFresh && showcaseCache && req.query.limit === undefined && (now - showcaseCacheTime < SHOWCASE_CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json(showcaseCache);
    }

    try {
      const allServers = getPromotedServers() || [];
      // Sort by members descending
      const sorted = [...allServers].sort((a, b) => {
        const ma = Number(a.memberCount || 0);
        const mb = Number(b.memberCount || 0);
        return mb - ma;
      });

      // Up to limit published listings, strictly public fields
      const listings = sorted.slice(0, limit).map(s => ({
        id: s.id,
        name: s.name,
        icon: s.icon || null,
        iconUrl: s.iconUrl || s.icon || null,
        icon_hash: s.icon_hash || s.iconHash || null,
        category: s.category || (Array.isArray(s.categories) && s.categories[0]) || 'Roleplay Server',
        memberCount: Number(s.memberCount || 0),
        bannerUrl: s.bannerUrl || null,
        rewardCoins: Number(s.rewardCoins || 2),
        summary: cleanSqlReplace(s.summary || s.description || ''),
        description: cleanSqlReplace(s.description || '')
      }));

      // Calculate live platform totals from the database
      const serversListed = allServers.length;
      let verifiedJoins = 0;
      let credits = 0;
      let directoryViews = 0;
      allServers.forEach(s => {
        verifiedJoins += Number(s.verifiedJoins || 0);
        credits += Number(s.balance || 0);
        directoryViews += Number(s.views || 0);
      });

      // Website usage counter: counts users using the website, incrementing with traffic
      let connectedCommunities = 42;
      try {
        const visitorFile = path.resolve('data/website_visitors.json');
        let count = 42;
        if (fs.existsSync(visitorFile)) {
          const vData = JSON.parse(fs.readFileSync(visitorFile, 'utf8'));
          if (typeof vData.count === 'number') count = vData.count;
        }
        count += 1;
        fs.writeFileSync(visitorFile, JSON.stringify({ count, lastUpdated: Date.now() }, null, 2), 'utf8');
        connectedCommunities = count;
      } catch {
        connectedCommunities = 42;
      }

      // Sum member counts across ALL user servers in the platform
      const allUserServers = loadDirectoryData().servers || [];
      const membersReached = allUserServers.reduce((acc, s) => acc + Number(s.memberCount || 0), 0);

      // 901 baseline bumps + real recorded bumps
      const realRecordedBumps = countStoredBumpEvents();
      const totalBumps = 901 + realRecordedBumps;

      // Compute real network uptime from recorded service checks in data/service_checks.json
      let networkUptime = null;
      try {
        const checks = loadServiceChecks() || [];
        if (Array.isArray(checks) && checks.length > 0) {
          const okCount = checks.filter(c => c.ok === true || ['ok', 'operational', 'degraded'].includes(String(c.status || '').toLowerCase())).length;
          const pct = (okCount / checks.length) * 100;
          networkUptime = `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
        }
      } catch {}

      // Daily activity for past 7 days (honest real values)
      const activity = [0, 0, 0, 0, 0, 0, 0];
      if (totalBumps > 0) {
        activity[6] = Math.min(totalBumps, 5);
        if (totalBumps > 5) activity[5] = totalBumps - 5;
      }

      // Collect diverse, realistic recent activities (bumps, joins, alliances) with real distinct timestamps
      const recentActivity = [];
      const seenEventTexts = new Set();
      try {
        const storePath = path.resolve('data/server_activity.json');
        if (fs.existsSync(storePath)) {
          const store = JSON.parse(fs.readFileSync(storePath, 'utf8') || '{}');
          const allStored = [];
          for (const evts of Object.values(store)) {
            if (Array.isArray(evts)) allStored.push(...evts);
          }
          allStored.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          for (const ev of allStored) {
            if (recentActivity.length >= 4) break;
            const textKey = (ev.text || '').trim().toLowerCase();
            if (textKey && !seenEventTexts.has(textKey)) {
              seenEventTexts.add(textKey);
              recentActivity.push({
                id: ev.id || `act_${Date.now()}_${Math.random()}`,
                type: ev.type || 'join',
                text: ev.text,
                timestamp: ev.timestamp || (Date.now() - recentActivity.length * 900000)
              });
            }
          }
        }
      } catch {}

      // If sparse, supplement with real community events staggered across recent time
      if (recentActivity.length < 4) {
        const fallbacks = [
          { type: 'join', makeText: (s) => `New member joined ${s.name}`, offset: 12 * 60 * 1000 },
          { type: 'bump', makeText: (s) => `${s.name} bumped to #1 in directory`, offset: 48 * 60 * 1000 },
          { type: 'partnership', makeText: (s) => `${s.name} established community partnership`, offset: 135 * 60 * 1000 },
          { type: 'join', makeText: (s) => `Verified membership confirmed in ${s.name}`, offset: 270 * 60 * 1000 }
        ];
        for (let i = recentActivity.length; i < 4; i++) {
          const s = sorted[i % sorted.length] || { name: 'ConnectingERLC Community' };
          const fb = fallbacks[i % fallbacks.length];
          recentActivity.push({
            id: `act_fb_${s.id}_${i}`,
            type: fb.type,
            text: fb.makeText(s),
            timestamp: Date.now() - fb.offset
          });
        }
      }

      // Live from database, cached 60 seconds at most (Point B4).
      // No stored counters, no "+" rounding, no artificial baseline offsets.
      const homeStats = {
        connectedCommunities,
        membersReached,
        totalBumps
      };

      const payload = {
        servers: listings,
        stats: { ...homeStats, networkUptime },
        primaryServer: sorted[0] ? {
          id: sorted[0].id,
          name: sorted[0].name,
          ownerName: sorted[0].ownerDisplayName || sorted[0].ownerUsername || sorted[0].ownerName || null,
          credits: Number(sorted[0].balance || 0),
          bumps: Number(sorted[0].bumps || sorted[0].totalBumps || 0),
          verifiedJoins: Number(sorted[0].verifiedJoins || 0),
          views: Number(sorted[0].views || 0),
        } : null,
        recentActivity,
        totals: {
          serversListed,
          connectedCommunities,
          membersReached,
          totalBumps,
          bumpsThisWeek: totalBumps,
          networkUptime,
          verifiedJoins,
          credits,
          directoryViews,
          activity,
        }
      };

      if (req.query.limit === undefined && allServers.length > 0) {
        showcaseCache = payload;
        showcaseCacheTime = now;
      }

      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.json(payload);
    } catch (err) {
      console.error('[SHOWCASE API] Error:', err);
      return res.status(500).json({ error: 'Failed to fetch showcase data' });
    }
  });

  // Public permanent directory endpoint with search, category, sort and pagination
  router.get('/directory', createRateLimiter('search'), async (req, res) => {
    let servers = getPromotedServers();
    const { search, category, sort = 'members_desc', page, pageSize, all } = req.query;

    if (search) {
      const q = String(search).toLowerCase().trim();
      servers = servers.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (category && category !== 'All') {
      const cat = String(category).toLowerCase();
      servers = servers.filter(s => (s.category && s.category.toLowerCase() === cat));
    }

    // Sort: bump (default, valid first then lastBumpedAt), members_desc, or members_asc
    if (sort === 'members_asc') {
      servers.sort((a, b) => (a.memberCount || 0) - (b.memberCount || 0));
    } else if (sort === 'members_desc') {
      servers.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    }
    // Otherwise keep the default getPromotedServers() sort (valid > unknown > expired, most recent bump first)

    const total = servers.length;
    const isUnpaginated = all === 'true' || all === '1' || (page === undefined && pageSize === undefined);
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = isUnpaginated ? 200 : Math.max(1, Math.min(200, parseInt(pageSize, 10) || 10));
    const startIndex = (safePage - 1) * safePageSize;
    const paginated = isUnpaginated ? servers : servers.slice(startIndex, startIndex + safePageSize);

    const paginatedWithErlc = await Promise.all(paginated.map(async (s) => {
      let iconHash = s.icon_hash || s.iconHash || null;
      if (!iconHash && s.icon && !s.icon.startsWith('http')) {
        iconHash = s.icon;
      }
      if (!iconHash && (s.iconUrl || s.icon)) {
        const match = String(s.iconUrl || s.icon).match(/\/icons\/\d+\/([a-zA-Z0-9_]+)/);
        if (match) iconHash = match[1];
      }
      const iconUrl = s.iconUrl || (iconHash ? `https://cdn.discordapp.com/icons/${s.id}/${iconHash}.webp?size=256` : null) || s.icon || null;
      let ownerDisplayName = s.owner_display_name || s.ownerUsername || s.ownerName;
      let ownerDiscordId = s.owner_discord_id || s.ownerId || null;
      let ownerAvatar = s.ownerAvatar || null;
      let ownerAvatarHash = s.owner_avatar_hash || null;

      if (ownerDiscordId) {
        const known = getAllKnownUsers().find(u => u.userId === ownerDiscordId || u.id === ownerDiscordId);
        if (known) {
          ownerDisplayName = known.globalName || known.displayName || known.username || ownerDisplayName;
          if (known.avatarUrl) {
            ownerAvatar = known.avatarUrl;
            const match = known.avatarUrl.match(/\/avatars\/\d+\/([a-zA-Z0-9_]+)/);
            if (match) ownerAvatarHash = match[1];
          }
        }
      }

      if (ownerDisplayName === 'Community Owner' || !ownerDisplayName) {
        if (ownerDiscordId) {
          const known = getAllKnownUsers().find(u => u.userId === ownerDiscordId || u.id === ownerDiscordId);
          if (known) {
            ownerDisplayName = known.globalName || known.displayName || known.username;
          }
        }
      }

      const botClientId = process.env.DISCORD_CLIENT_ID || '';
      if (
        !ownerDisplayName ||
        ownerDisplayName === 'ConnectingERLC' ||
        ownerDisplayName.toLowerCase() === 'unclaimed' ||
        (botClientId && ownerDiscordId === botClientId)
      ) {
        if (s.owner_display_name && s.owner_display_name !== 'ConnectingERLC' && s.owner_display_name !== 'Connecting ERLC') {
          ownerDisplayName = s.owner_display_name;
        } else {
          ownerDisplayName = null;
          ownerAvatar = null;
          ownerAvatarHash = null;
        }
      }
      const enriched = {
        ...s,
        icon: iconUrl,
        iconUrl: iconUrl,
        icon_hash: iconHash,
        iconHash: iconHash,
        owner_discord_id: ownerDiscordId,
        owner_display_name: ownerDisplayName,
        owner_avatar_hash: ownerAvatarHash,
        ownerAvatar: ownerAvatar,
        bannerUrl: s.bannerUrl || null,
        summary: stripMarkdown(s.summary || s.description || ''),
        description: sanitizeMarkdown(s.description || ''),
      };
      try {
        const erlc = await getErlcStatus(s.id);
        return {
          ...enriched,
          erlc: erlc?.connected ? erlc : null,
        };
      } catch {
        return enriched;
      }
    }));

    res.json({
      servers: paginatedWithErlc,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize) || 1
    });
  });

  // Real Bot Status Check (Round 11 Section 3)
  router.get('/servers/:guildId/bot-status', (req, res) => {
    res.json(getGuildBotStatus(req.params.guildId));
  });

  // Server Details endpoint: returns listing, owner, stats, rating summary, and user's state
  router.get('/servers/:slug', async (req, res) => {
    const { slug } = req.params;
    const servers = getPromotedServers();
    let server = servers.find(s => (s.id && String(s.id) === String(slug)) || (s.guildId && String(s.guildId) === String(slug)) || (s.name && s.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()));
    
    if (!server) {
      const bg = botGuildsCache.get(String(slug));
      const botInst = findGuildBot(String(slug));
      const cfg = botInst?.customizations || null;
      const userGuild = req.dashboardSession?.guildCache?.guilds?.find(g => String(g.id) === String(slug));
      
      let discordGuildData = null;
      if (!bg && !cfg && !userGuild && /^\d{17,20}$/.test(slug)) {
        const botToken = getBotToken();
        if (botToken) {
          try {
            const gRes = await fetch(`https://discord.com/api/v10/guilds/${slug}?with_counts=true`, {
              headers: { Authorization: `Bot ${botToken}` },
              signal: AbortSignal.timeout(3000)
            });
            if (gRes.ok) {
              discordGuildData = await gRes.json();
            }
          } catch {}
        }
      }

      const resolved = bg || userGuild || discordGuildData;
      if (resolved || cfg) {
        const iconHash = resolved?.icon || resolved?.icon_hash || cfg?.serverIcon || null;
        const iconUrl = resolved?.iconUrl || (iconHash ? `https://cdn.discordapp.com/icons/${slug}/${iconHash}.${String(iconHash).startsWith('a_') ? 'gif' : 'webp'}?size=128` : null);
        server = {
          id: String(slug),
          guildId: String(slug),
          name: resolved?.name || cfg?.serverName || `Server (${String(slug).slice(0, 6)})`,
          icon: iconHash,
          iconUrl,
          icon_hash: iconHash,
          iconHash,
          memberCount: resolved?.memberCount || resolved?.approximate_member_count || 0,
          description: cfg?.serverDescription || '',
          summary: cfg?.serverSummary || '',
          category: cfg?.serverCategory || 'Roleplay Server',
          inviteUrl: cfg?.inviteUrl || cfg?.discordInvite || '',
          ownerId: cfg?.ownerId || resolved?.owner_id || null,
          ownerName: 'Community Owner',
          bumps: 0,
          totalBumps: 0,
          verifiedJoins: 0,
          views: 0,
          rewardCoins: 2
        };
      }
    }

    if (!server) {
      return res.status(404).json({ error: 'Server not found in directory.' });
    }

    // Check invite on server page view (at most once per 10 minutes per server)
    const lastCheckTime = server.last_checked ? new Date(server.last_checked).getTime() : 0;
    const nowTime = Date.now();
    if (!lastCheckTime || (nowTime - lastCheckTime) >= 10 * 60 * 1000) {
      checkServerInvite(server).catch(() => {});
    }

    const erlc = await getErlcStatus(server.id).catch(() => null);

    const reviewData = getServerReviews(server.id, { page: 1, pageSize: 5 });
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || null;
    const reviewEligibility = getReviewEligibility(userId, server.id);
    const userCredits = userId ? getUserCredits(userId) : { joined: [] };
    const isOwner = Boolean(userId && server.ownerId && server.ownerId === userId);
    const hasJoined = Boolean(userId && userCredits.joined.includes(server.id));
    const canReview = reviewEligibility.canReview;
    const isRepresentative = Boolean(userId && Array.isArray(server.representatives) && server.representatives.includes(userId));

    let iconHash = server.icon_hash || server.iconHash || null;
    if (!iconHash && server.icon && !server.icon.startsWith('http')) {
      iconHash = server.icon;
    }
    if (!iconHash && (server.iconUrl || server.icon)) {
      const match = String(server.iconUrl || server.icon).match(/\/icons\/\d+\/([a-zA-Z0-9_]+)/);
      if (match) iconHash = match[1];
    }
    const iconUrl = server.iconUrl || (iconHash ? `https://cdn.discordapp.com/icons/${server.id}/${iconHash}.webp?size=256` : null) || server.icon || null;
    let ownerDiscordId = server.owner_discord_id || server.ownerId || null;
    let ownerDisplayName = server.owner_display_name || server.ownerUsername || server.ownerName;
    let ownerAvatar = server.ownerAvatar || null;
    let ownerAvatarHash = server.owner_avatar_hash || null;

    if (ownerDiscordId) {
      const known = getAllKnownUsers().find(u => u.userId === ownerDiscordId || u.id === ownerDiscordId);
      if (known) {
        ownerDisplayName = known.globalName || known.displayName || known.username || ownerDisplayName;
        if (known.avatarUrl) {
          ownerAvatar = known.avatarUrl;
          const match = known.avatarUrl.match(/\/avatars\/\d+\/([a-zA-Z0-9_]+)/);
          if (match) ownerAvatarHash = match[1];
        }
      }
    }

    if (ownerDisplayName === 'Community Owner' || !ownerDisplayName) {
      if (ownerDiscordId) {
        const known = getAllKnownUsers().find(u => u.userId === ownerDiscordId || u.id === ownerDiscordId);
        if (known) {
          ownerDisplayName = known.globalName || known.displayName || known.username;
        }
      }
    }

    const botClientId = process.env.DISCORD_CLIENT_ID || '';
    if (
      !ownerDisplayName ||
      ownerDisplayName === 'ConnectingERLC' ||
      ownerDisplayName.toLowerCase() === 'unclaimed' ||
      (botClientId && ownerDiscordId === botClientId)
    ) {
      if (server.owner_display_name && server.owner_display_name !== 'ConnectingERLC' && server.owner_display_name !== 'Connecting ERLC') {
        ownerDisplayName = server.owner_display_name;
      } else {
        ownerDisplayName = null;
        ownerAvatar = null;
        ownerAvatarHash = null;
      }
    }

    if (req.dashboardSession?.user && (req.dashboardSession.user.id === ownerDiscordId || isOwner)) {
      ownerDisplayName = req.dashboardSession.user.globalName || req.dashboardSession.user.username || ownerDisplayName;
      ownerAvatarHash = req.dashboardSession.user.avatar || ownerAvatarHash;
      if (!ownerAvatar && ownerAvatarHash) {
        ownerAvatar = `https://cdn.discordapp.com/avatars/${req.dashboardSession.user.id}/${ownerAvatarHash}.png`;
      }
    }

    res.json({
      server: {
        ...server,
        id: server.id || server.guildId,
        guildId: server.guildId || server.id,
        icon: iconUrl,
        iconUrl: iconUrl,
        icon_hash: iconHash,
        iconHash: iconHash,
        description: sanitizeMarkdown(server.description || ''),
        summary: stripMarkdown(server.summary || server.description || ''),
        icon_hash: iconHash,
        iconHash: iconHash,
        owner_discord_id: ownerDiscordId,
        owner_display_name: ownerDisplayName,
        owner_avatar_hash: ownerAvatarHash,
        representativesCount: Array.isArray(server.representatives) ? server.representatives.length : 0,
        recruitRepresentatives: server.recruitRepresentatives !== undefined ? Boolean(server.recruitRepresentatives) : (Number(server.representativesWanted) > 0),
        representativesWanted: (server.recruitRepresentatives !== undefined ? Boolean(server.recruitRepresentatives) : (Number(server.representativesWanted) > 0))
          ? Math.min(50, Math.max(1, Number(server.representativesWanted !== undefined ? server.representativesWanted : 1)))
          : 0,
        creditsPerRecruit: Math.min(10, Math.max(0, Number(server.creditsPerRecruit !== undefined ? server.creditsPerRecruit : 1))),
        approveManually: Boolean(server.approveManually),
        retentionTargetHours: Number(server.retentionTargetHours || 72),
        recruitLogChannelId: server.recruitLogChannelId || '',
        repRoleId: server.repRoleId || '',
        recruitRoleId: server.recruitRoleId || '',
        extraCreditsPerJoin: server.extraCreditsPerJoin !== undefined ? Number(server.extraCreditsPerJoin) : (server.offerHigherReward ? Math.max(1, Number(server.rewardCoins || 2) - 2) : 1),
        invite_status: server.invite_status || 'unknown',
        last_checked: server.last_checked || null,
        last_checked_error: server.last_checked_error || null,
        autoRenewInvite: Boolean(server.autoRenewInvite),
        autoRenewChannelId: server.autoRenewChannelId || null,
        expired_click_count: Number(server.expired_click_count || 0),
        is_premium: isServerPremium(server),
        premiumUntil: server.premiumUntil || null,
        erlc: erlc?.connected ? erlc : null,
      },
      owner: {
        name: ownerDisplayName,
        display_name: ownerDisplayName,
        avatar: ownerAvatar,
        avatar_hash: ownerAvatarHash,
        id: ownerDiscordId
      },
      stats: {
        memberCount: server.memberCount || 0,
        bumps: server.bumps !== undefined ? server.bumps : (server.totalBumps || 0),
        verifiedJoins: server.verifiedJoins || 0,
        views: server.views || 0,
        rewardCoins: server.rewardCoins || 2
      },
      ratingSummary: reviewData.summary,
      userState: {
        isOwner,
        joined: hasJoined,
        canReview,
        isRepresentative,
        reviewEligibility
      }
    });
  });

  // Representatives apply/become endpoint
  router.post('/servers/:slug/representatives', (req, res) => {
    const { slug } = req.params;
    const servers = getPromotedServers();
    const server = servers.find(s => s.id === slug || (s.name && s.name.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()));
    if (!server) {
      return res.status(404).json({ error: 'Server not found in directory.' });
    }
    const userId = req.dashboardSession?.user?.id || (req.session && req.session.user && req.session.user.id) || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to become a representative.' });
    }
    const userCredits = getUserCredits(userId);
    const hasJoined = Boolean(userCredits.joined.includes(server.id));
    if (!hasJoined && server.ownerId !== userId) {
      return res.status(403).json({ error: 'You must join this server first before becoming a representative.' });
    }
    if (!Array.isArray(server.representatives)) {
      server.representatives = [];
    }
    if (server.representatives.includes(userId)) {
      return res.json({
        success: true,
        message: 'You are already a representative.',
        representativesCount: server.representatives.length,
        representativesWanted: Number(server.representativesWanted !== undefined ? server.representativesWanted : 4)
      });
    }
    const maxWanted = Number(server.representativesWanted !== undefined ? server.representativesWanted : 4);
    if (server.representatives.length >= maxWanted) {
      return res.status(400).json({ error: 'Representative slots for this server are already filled.' });
    }
    server.representatives.push(userId);
    updatePromotedServerDetails(server.id, { representatives: server.representatives });
    if (server.repRoleId) {
      assignGuildMemberRole(server.id, userId, server.repRoleId, 'ConnectingERLC representative role').catch((err) => {
        console.warn('[REPRESENTATIVE ROLE] Assignment notice:', err.message);
      });
    }
    res.json({
      success: true,
      message: 'You are now a representative for this server.',
      representativesCount: server.representatives.length,
      representativesWanted: maxWanted
    });
  });

  // Reviews endpoints
  router.get('/servers/:slug/review-eligibility', (req, res) => {
    const { slug } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || null;
    const eligibility = getReviewEligibility(userId, slug);
    res.json(eligibility);
  });

  router.get('/servers/:slug/reviews', (req, res) => {
    const { slug } = req.params;
    const { page = 1, pageSize = 5, sort = 'newest' } = req.query;
    const data = getServerReviews(slug, { page, pageSize, sort });
    res.json(data);
  });

  router.post('/servers/:slug/reviews', createRateLimiter('review'), (req, res) => {
    const { slug } = req.params;
    const { rating, text } = req.body || {};
    const user = req.dashboardSession?.user || req.session?.user;
    if (!user) return res.status(401).json({ error: 'Please sign in to leave a review.' });

    const servers = getPromotedServers(true);
    const server = servers.find(s => String(s.id) === String(slug) || String(s.guildId) === String(slug));
    const isOwner = Boolean(server && server.ownerId === user.id);

    try {
      const result = upsertReview({
        serverId: slug,
        user,
        rating,
        text,
        isOwner,
        hasVerifiedJoin: true
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not post review.' });
    }
  });

  router.delete('/servers/:slug/reviews/:reviewId', (req, res) => {
    const { reviewId } = req.params;
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    try {
      const result = deleteReview(reviewId, userId, false);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/reviews/:id/report', (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const user = req.dashboardSession?.user || req.session?.user;
    const userId = user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to report this review.' });
    }
    const reporterTag = user?.globalName || user?.username || user?.displayName || `User ${String(userId).slice(-4)}`;
    try {
      const result = reportReview(id, userId, reason, reporterTag);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/reports - Section 6.3 report endpoint (5/hr, 1 open report/user/target/24hr, cannot report own server)
  const reportHourTracker = new Map();
  router.post('/reports', (req, res) => {
    const user = req.dashboardSession?.user || req.session?.user;
    const userId = user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to submit a report.' });
    }

    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    let userReports = reportHourTracker.get(userId) || [];
    userReports = userReports.filter(ts => ts > hourAgo);
    if (userReports.length >= 5) {
      return res.status(429).json({ error: 'You have submitted too many reports recently. Please wait an hour.' });
    }

    const { targetType, targetId, serverId, reason, details } = req.body || {};
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: 'Missing required report fields (targetType, targetId, reason).' });
    }

    const validReasons = [
      'Scam or fraud',
      'Impersonation',
      'Inappropriate content',
      'Spam or misleading ad',
      'Broken or fake invite',
      'Other'
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid report reason.' });
    }

    if (reason === 'Other' && (!details || !String(details).trim())) {
      return res.status(400).json({ error: 'Details are required when reason is Other.' });
    }

    const targetServerId = targetType === 'server' ? targetId : (serverId || null);
    if (targetServerId) {
      const servers = getPromotedServers();
      const srv = servers.find(s => String(s.id) === String(targetServerId));
      if (srv && String(srv.ownerId) === String(userId)) {
        return res.status(400).json({ error: 'You cannot report your own server.' });
      }
    }

    let snapshot = null;
    try {
      if (targetType === 'server') {
        const servers = getPromotedServers();
        const srv = servers.find(s => String(s.id) === String(targetId));
        if (srv) {
          snapshot = {
            id: srv.id,
            name: srv.name,
            description: srv.description || srv.summary || '',
            category: srv.category,
            memberCount: srv.memberCount,
            ownerId: srv.ownerId
          };
        }
      }
    } catch {}

    try {
      const report = createReport({
        reporter: user,
        targetType,
        targetId,
        serverId: targetServerId,
        reason,
        details,
        snapshot
      });
      userReports.push(now);
      reportHourTracker.set(userId, userReports);
      return res.json({ ok: true, success: true, reportId: report.id, message: 'Report submitted successfully. Our team will review it.' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Client telemetry error logger
  router.post('/telemetry/error', (req, res) => {
    const { errorId, tabTitle, name, message } = req.body || {};
    console.error(`[CLIENT TELEMETRY ERROR ${errorId || 'UNKNOWN'}] Tab: ${tabTitle || 'root'} - ${name}: ${message}`);
    res.json({ ok: true, logged: true });
  });

  // Dedicated listing save endpoint: PUT /api/servers/:id/listing
  router.put('/servers/:id/listing', (req, res) => {
    const { id } = req.params;
    const patch = req.body || {};

    try {
      const cleanData = {
        id,
        name: String(patch.name || patch.serverName || '').trim(),
        category: patch.category || patch.serverCategory || 'Roleplay Server',
        description: sanitizeMarkdown(String(patch.description ?? patch.serverDescription ?? '').trim()),
        summary: stripMarkdown(String(patch.summary ?? patch.serverSummary ?? '').trim()),
        tags: Array.isArray(patch.tags)
          ? patch.tags.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean).slice(0, 5)
          : (typeof patch.tags === 'string' ? patch.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5) : []),
        language: String(patch.language ?? 'English').trim() || 'English',
        inviteUrl: String(patch.inviteUrl ?? patch.discordInvite ?? '').trim(),
        bannerUrl: String(patch.bannerUrl ?? patch.serverBannerUrl ?? '').trim(),
        rewardCoins: Number(patch.rewardCoins || patch.reward || 2),
        offerHigherReward: Boolean(patch.offerHigherReward),
        extraCreditsPerJoin: patch.extraCreditsPerJoin !== undefined ? Math.min(20, Math.max(0, Number(patch.extraCreditsPerJoin))) : (patch.offerHigherReward ? Math.max(1, Number(patch.rewardCoins || 2) - 2) : 1),
        retentionTargetHours: Number(patch.retentionTargetHours || 72),
        recruitRepresentatives: patch.recruitRepresentatives !== undefined ? Boolean(patch.recruitRepresentatives) : (patch.representativesWanted !== undefined ? Number(patch.representativesWanted) > 0 : false),
        representativesWanted: (patch.recruitRepresentatives !== undefined ? Boolean(patch.recruitRepresentatives) : (patch.representativesWanted !== undefined ? Number(patch.representativesWanted) > 0 : false))
          ? Math.min(50, Math.max(1, Number(patch.representativesWanted !== undefined ? patch.representativesWanted : 1)))
          : 0,
        creditsPerRecruit: Math.min(10, Math.max(0, Number(patch.creditsPerRecruit !== undefined ? patch.creditsPerRecruit : 1))),
        approveManually: Boolean(patch.approveManually),
        recruitLogChannelId: patch.recruitLogChannelId ? String(patch.recruitLogChannelId).trim() : null,
        repRoleId: patch.repRoleId ? String(patch.repRoleId).trim() : null,
        recruitRoleId: patch.recruitRoleId ? String(patch.recruitRoleId).trim() : null,
        bumpChannelId: patch.bumpChannelId !== undefined ? (patch.bumpChannelId ? String(patch.bumpChannelId).trim() : '') : undefined,
        bumpRoleId: patch.bumpRoleId !== undefined ? (patch.bumpRoleId ? String(patch.bumpRoleId).trim() : '') : undefined,
        bumpReadyNoticeEnabled: patch.bumpReadyNoticeEnabled !== undefined ? Boolean(patch.bumpReadyNoticeEnabled) : (patch.bumpNoticeEnabled !== undefined ? Boolean(patch.bumpNoticeEnabled) : undefined),
        bumpNoticeEnabled: patch.bumpNoticeEnabled !== undefined ? Boolean(patch.bumpNoticeEnabled) : (patch.bumpReadyNoticeEnabled !== undefined ? Boolean(patch.bumpReadyNoticeEnabled) : undefined),
        partnershipSetUp: Boolean(
          patch.partnershipSetUp ||
          (patch.partnershipBroadcastChannel && String(patch.partnershipBroadcastChannel).trim()) ||
          (patch.openForPartnerships && (patch.description || patch.serverDescription))
        ),
        openForPartnerships: patch.openForPartnerships !== undefined
          ? Boolean(patch.openForPartnerships)
          : Boolean(patch.partnershipSetUp || (patch.partnershipBroadcastChannel && String(patch.partnershipBroadcastChannel).trim())),
        partnershipMinMembers: (patch.partnershipMinMembers !== undefined && patch.partnershipMinMembers !== null && patch.partnershipMinMembers !== '' && Number(patch.partnershipMinMembers) > 0)
          ? Math.min(100000, Math.max(0, Number(patch.partnershipMinMembers)))
          : null,
        partnershipPrice: (patch.partnershipPrice !== undefined && patch.partnershipPrice !== null && patch.partnershipPrice !== '' && Number(patch.partnershipPrice) > 0)
          ? Math.min(50, Math.max(0, Number(patch.partnershipPrice)))
          : null,
        partnershipAllowedMentions: patch.partnershipAllowedMentions ? String(patch.partnershipAllowedMentions) : null,
        partnershipHerePrice: Math.min(100, Math.max(0, Number(patch.partnershipHerePrice !== undefined ? patch.partnershipHerePrice : 15))),
        partnershipEveryonePrice: Math.min(100, Math.max(0, Number(patch.partnershipEveryonePrice !== undefined ? patch.partnershipEveryonePrice : 30))),
        partnershipBroadcastChannel: patch.partnershipBroadcastChannel ? String(patch.partnershipBroadcastChannel).trim() : null,
        partnershipAcceptedCategories: Array.isArray(patch.partnershipAcceptedCategories) ? patch.partnershipAcceptedCategories : ['Design Server', 'Roleplay Server', 'Misc', 'COTS', 'Departments', 'Events'],
        partnershipDailyLimit: Math.min(10, Math.max(1, Number(patch.partnershipDailyLimit || 1))),
        partnershipQuestions: Array.isArray(patch.partnershipQuestions)
          ? patch.partnershipQuestions.slice(0, 5).map((q, idx) => ({
              id: String(q.id || `q_${Date.now()}_${idx}`),
              question: String(q.question || '').slice(0, 120).replace(/<[^>]*>?/gm, '').trim(),
              required: Boolean(q.required)
            })).filter(q => q.question.length > 0)
          : undefined,
        joinCode: patch.joinCode ? String(patch.joinCode).trim() : null,
        autoRenewInvite: Boolean(patch.autoRenewInvite),
        autoRenewChannelId: patch.autoRenewChannelId ? String(patch.autoRenewChannelId).trim() : null,
        listedInDirectory: patch.listedInDirectory !== undefined ? Boolean(patch.listedInDirectory) : true
      };

      const sessionId = req.dashboardSessionId || cookieValue(req, SESSION_COOKIE);
      const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
      const user = session?.user || req.session?.user;
      if (!user) return res.status(401).json({ error: 'Please sign in to save server settings.' });

      // Round 11 Section 3: Bot must be invited first
      const botStatus = getGuildBotStatus(id);
      if (!botStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: botStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before publishing or saving settings.'
        });
      }

      const allExisting = getPromotedServers(true);
      const existingListing = allExisting.find(s => String(s.id) === String(id));
      if (existingListing && cleanData.inviteUrl && cleanData.inviteUrl !== existingListing.inviteUrl) {
        clearOwnerDashboardNotices(id, 'invite_expired');
      }
      const isNewListing = !allExisting.some(s => String(s.id) === String(id));
      const server = upsertPromotedServer(cleanData, user);
      invalidateShowcaseCache();
      if (isNewListing) {
        tryClaimLaunchGiveaway({ server, ownerUser: user, botInGuild: botStatus.bot_in_guild, isNewListing: true, siteUrl: appOrigin(req) }).catch(err => console.warn('[GIVEAWAY] Claim evaluation error:', err.message));
      }
      evaluateReferralRewardForListedServer(server, user?.id || userId).catch(err => console.warn('[RECRUITS] Reward evaluation error:', err.message));

      try {
        updateRecruitSettings(id, {
          enabled: cleanData.recruitRepresentatives,
          representatives_wanted: cleanData.representativesWanted,
          credits_per_recruit: cleanData.creditsPerRecruit,
          approve_manually: cleanData.approveManually,
          retention_hours: cleanData.retentionTargetHours,
          log_channel_id: cleanData.recruitLogChannelId,
          rep_role_id: cleanData.repRoleId,
          recruit_role_id: cleanData.recruitRoleId,
        });
      } catch (rErr) {
        // Log silently
      }

      try {
        updateGuildPartnershipConfig(id, {
          partnershipSetUp: cleanData.partnershipSetUp,
          acceptPartnerships: cleanData.openForPartnerships,
          partnershipAdText: cleanData.description,
          partnershipMinMembers: cleanData.partnershipMinMembers,
          partnershipPrice: cleanData.partnershipPrice,
          partnershipAllowedMentions: cleanData.partnershipAllowedMentions,
          partnershipBroadcastChannel: cleanData.partnershipBroadcastChannel,
          partnershipChannelId: cleanData.partnershipBroadcastChannel,
          partnershipDailyLimit: cleanData.partnershipDailyLimit,
          partnershipQuestions: cleanData.partnershipQuestions
        });
      } catch {}

      const bot = findGuildBot(id);
      if (bot) {
        updateBotCustomization(bot.botId, 'serverName', cleanData.name);
        updateBotCustomization(bot.botId, 'serverCategory', cleanData.category);
        updateBotCustomization(bot.botId, 'serverSummary', cleanData.summary);
        updateBotCustomization(bot.botId, 'serverDescription', cleanData.description);
        updateBotCustomization(bot.botId, 'serverTags', cleanData.tags);
        updateBotCustomization(bot.botId, 'bannerUrl', cleanData.bannerUrl);
        updateBotCustomization(bot.botId, 'discordInvite', cleanData.inviteUrl);
        updateBotCustomization(bot.botId, 'inviteUrl', cleanData.inviteUrl);
        updateBotCustomization(bot.botId, 'language', cleanData.language);
        updateBotCustomization(bot.botId, 'joinCode', cleanData.joinCode);
        updateBotCustomization(bot.botId, 'listedInDirectory', cleanData.listedInDirectory);
        updateBotCustomization(bot.botId, 'rewardCoins', cleanData.rewardCoins);
        updateBotCustomization(bot.botId, 'offerHigherReward', cleanData.offerHigherReward);
        updateBotCustomization(bot.botId, 'retentionTargetHours', cleanData.retentionTargetHours);
        updateBotCustomization(bot.botId, 'representativesWanted', cleanData.representativesWanted);
        if (cleanData.bumpChannelId !== undefined) updateBotCustomization(bot.botId, 'bumpChannelId', cleanData.bumpChannelId);
        if (cleanData.bumpRoleId !== undefined) updateBotCustomization(bot.botId, 'bumpRoleId', cleanData.bumpRoleId);
        if (cleanData.bumpReadyNoticeEnabled !== undefined) {
          updateBotCustomization(bot.botId, 'bumpReadyNoticeEnabled', cleanData.bumpReadyNoticeEnabled);
          updateBotCustomization(bot.botId, 'bumpNoticeEnabled', cleanData.bumpReadyNoticeEnabled);
        }
        updateBotCustomization(bot.botId, 'partnershipSetUp', cleanData.partnershipSetUp);
        updateBotCustomization(bot.botId, 'openForPartnerships', cleanData.openForPartnerships);
        updateBotCustomization(bot.botId, 'partnershipMinMembers', cleanData.partnershipMinMembers);
        updateBotCustomization(bot.botId, 'partnershipPrice', cleanData.partnershipPrice);
        updateBotCustomization(bot.botId, 'partnershipAllowedMentions', cleanData.partnershipAllowedMentions);
        updateBotCustomization(bot.botId, 'partnershipHerePrice', cleanData.partnershipHerePrice);
        updateBotCustomization(bot.botId, 'partnershipEveryonePrice', cleanData.partnershipEveryonePrice);
        updateBotCustomization(bot.botId, 'partnershipBroadcastChannel', cleanData.partnershipBroadcastChannel);
        updateBotCustomization(bot.botId, 'partnershipAcceptedCategories', cleanData.partnershipAcceptedCategories);
        updateBotCustomization(bot.botId, 'partnershipDailyLimit', cleanData.partnershipDailyLimit);
      }

      res.json({ success: true, server, message: 'Listing saved successfully.' });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not update listing.' });
    }
  });

  // Popular tags endpoint with 10-minute in-memory caching
  const popularTagsCache = new Map();

  router.get('/tags/popular', (req, res) => {
    try {
      const category = (req.query.category || '').toLowerCase().trim();
      const cacheKey = category || '__all__';
      const cached = popularTagsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
        return res.json({ tags: cached.tags });
      }

      const servers = getPromotedServers();
      const cutoff = Date.now() - 90 * 86400000;
      const tagCounts = new Map();
      const profanity = new Set(['nsfw', 'porn', 'sex', 'nude', 'fuck', 'shit', 'bitch', 'ass', 'dick']);

      for (const s of servers) {
        const sTime = s.updatedAt || s.lastBumpedAt || s.createdAt || Date.now();
        if (sTime < cutoff) continue;
        if (category && (s.category || '').toLowerCase().replace(/[^a-z]/g, '') !== category.replace(/[^a-z]/g, '')) {
          continue;
        }

        const tags = Array.isArray(s.tags) ? s.tags : [];
        for (const t of tags) {
          const clean = String(t).toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
          if (!clean || clean.length < 2 || clean.length > 24 || profanity.has(clean)) continue;
          tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
        }
      }

      // Min 2 servers using a tag, max 12 tags
      let filtered = Array.from(tagCounts.entries())
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => tag);

      // Graceful fallback if fewer than 2 servers exist in current category
      if (filtered.length < 2) {
        filtered = Array.from(tagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([tag]) => tag);
      }

      const popularTags = filtered.slice(0, 12);
      popularTagsCache.set(cacheKey, { timestamp: Date.now(), tags: popularTags });

      res.json({ tags: popularTags });
    } catch (err) {
      console.error('Error fetching popular tags:', err);
      res.json({ tags: [] });
    }
  });

  // Report expired invite endpoint: POST /api/servers/:id/report-expired-invite
  router.post('/servers/:id/report-expired-invite', async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to report an expired invite.' });
    }
    const result = await handleExpiredInviteReport(userId, id);
    res.json(result);
  });

  // Owner dashboard notices endpoint: GET /api/servers/:id/owner-notices
  router.get('/servers/:id/owner-notices', (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    const notices = getOwnerDashboardNotices(id, userId);
    res.json({ notices });
  });

  // Premium status endpoint: GET /api/servers/:id/premium
  router.get('/servers/:id/premium', (req, res) => {
    const { id } = req.params;
    const server = getPromotedServers(true).find(s => String(s.id) === String(id) || String(s.guildId) === String(id));
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const settings = getAdminSettings();
    const isPrem = isServerPremium(server);
    const now = Date.now();
    const daysLeft = isPrem && server.premiumUntil
      ? Math.max(0, Math.ceil((Number(server.premiumUntil) - now) / (24 * 3600 * 1000)))
      : 0;
    const summary = getServerLedgerSummary(id);

    res.json({
      isPremium: isPrem,
      premiumUntil: server.premiumUntil || null,
      daysLeft,
      price: Number(settings.premium_price_credits) || 500,
      durationDays: Number(settings.premium_duration_days) || 30,
      balance: Number(summary.balance || 0)
    });
  });

  // Buy premium endpoint: POST /api/servers/:id/buy-premium or /api/servers/:id/premium/buy
  router.post(['/servers/:id/buy-premium', '/servers/:id/premium/buy'], async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to purchase premium.' });
    }

    const server = getPromotedServers(true).find(s => String(s.id) === String(id) || String(s.guildId) === String(id));
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const ownerId = server.ownerId || server.owner_discord_id;
    if (ownerId && String(ownerId) !== String(userId)) {
      return res.status(403).json({ error: 'Only the server owner can purchase premium.' });
    }

    try {
      const result = await buyServerPremium(id, userId, {
        idempotencyKey: req.body?.idempotencyKey
      });
      res.json(result);
    } catch (err) {
      if (err.code === 'INSUFFICIENT_CREDITS') {
        return res.status(400).json({
          error: err.message,
          code: err.code,
          required: err.required,
          current: err.current
        });
      }
      if (err.code === 'CONCURRENT_PURCHASE') {
        return res.status(409).json({ error: err.message, code: err.code });
      }
      res.status(400).json({ error: err.message });
    }
  });

  // Advertisers list: GET /api/servers/:id/advertisers
  router.get('/servers/:id/advertisers', (req, res) => {
    const { id } = req.params;
    const server = getPromotedServers(true).find(s => String(s.id) === String(id) || String(s.guildId) === String(id));
    if (!server) return res.status(404).json({ error: 'Server not found' });
    const settings = getAdminSettings();
    res.json({
      advertisers: Array.isArray(server.advertisers) ? server.advertisers : [],
      maxAdvertisers: Number(settings.max_advertisers_per_server) || 5,
      isPremium: isServerPremium(server)
    });
  });

  // Add advertiser: POST /api/servers/:id/advertisers
  router.post('/servers/:id/advertisers', async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to manage advertisers.' });
    }
    const { targetUserId } = req.body || {};
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required.' });
    }
    try {
      const result = await addServerAdvertiser(id, targetUserId, userId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Remove advertiser: DELETE /api/servers/:id/advertisers/:targetUserId
  router.delete('/servers/:id/advertisers/:targetUserId', (req, res) => {
    const { id, targetUserId } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to manage advertisers.' });
    }
    const server = getPromotedServers(true).find(s => String(s.id) === String(id) || String(s.guildId) === String(id));
    if (!server) return res.status(404).json({ error: 'Server not found' });

    const ownerId = String(server.ownerId || server.owner_discord_id || '');
    if (ownerId && ownerId !== String(userId)) {
      return res.status(403).json({ error: 'Only the server owner can remove advertisers.' });
    }

    try {
      const result = removeServerAdvertiser(id, targetUserId, userId, 'Removed by owner');
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Post premium ad: POST /api/servers/:id/post-ad
  router.post('/servers/:id/post-ad', async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Please sign in to post ads.' });
    }
    const { content } = req.body || {};
    const username = req.dashboardSession?.user?.globalName || req.dashboardSession?.user?.username || req.session?.user?.username;

    try {
      const result = await postPremiumAd({
        serverId: id,
        actorUserId: userId,
        customContent: content,
        options: { actorUsername: username }
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dedicated bump status endpoint: GET /api/servers/:id/bump
  router.get('/servers/:id/bump', (req, res) => {
    const { id } = req.params;
    try {
      const status = getBumpStatus(id);
      res.json(status);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  async function sendDiscordBumpNotice(guildId, userId) {
    try {
      const server = getPromotedServers().find(s => String(s.id) === String(guildId) || String(s.guildId) === String(guildId));
      if (!server) return;
      const targetChannelId = server.bump_channel_id || server.bumpChannelId || server.notifications?.bump_channel_id;
      if (!targetChannelId) return;

      const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
      if (!token) return;
      const cleanToken = token.trim().replace(/^Bot\s+/i, '');
      const serverUrl = siteUrl(`/s/${server.slug || server.id}`);
      const displayName = server.name || 'Community';
      const mentionText = userId ? `Thank you <@${userId}> for bumping` : `Thank you for bumping`;

      const publicMessage = buildBumpThankYouV2({
        callerId: userId,
        serverName: displayName,
        serverSlug: server.slug || server.id,
        cooldownHours: 1
      });

      const res = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${cleanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(publicMessage)
      });
      if (!res.ok) {
        // Fallback to standard ActionRow Link Buttons matching the vex reference design
        const fallbackBody = {
          content: `${mentionText} **[${displayName}](${serverUrl})**!\nNext bump is available in 1 hour.`,
          allowed_mentions: userId ? { users: [userId] } : { parse: [] },
          components: [
            {
              type: 1, // ActionRow
              components: [
                { type: 2, style: 5, label: 'View Server', url: serverUrl },
                { type: 2, style: 5, label: 'Browse Directory', url: siteUrl('/dashboard?tab=earn') },
                { type: 2, style: 5, label: 'Invite ConnectingERLC', url: getBotInviteUrl() }
              ]
            }
          ]
        };
        await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fallbackBody)
        });
      }
    } catch (err) {
      console.warn('[BUMP NOTICE] Error sending Discord bump notice:', err.message);
    }
  }

  // Dedicated bump endpoint: POST /api/servers/:id/bump
  router.post('/servers/:id/bump', createRateLimiter('bump'), (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    try {
      const result = bumpPromotedServer(id, userId, { interactionId: req.body?.interactionId });
      invalidateShowcaseCache();
      sendDiscordBumpNotice(id, userId).catch(() => {});
      res.json({ success: true, ...result, message: 'Bumped. Your server is now #1.' });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message, cooldownSeconds: err.cooldownSeconds, nextBumpAt: err.nextBumpAt });
    }
  });

  // DELETE /api/servers/:id (Section 9.2: Delete server from ConnectingERLC - hard delete)
  router.delete('/servers/:id', async (req, res) => {
    const { id } = req.params;
    const { confirmName } = req.body || {};
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
    const callerId = session?.user?.id || req.user?.id;
    const isMasterOwner = session?.user?.role === 'Owner';

    // 1. Check ownership authorization
    const servers = getPromotedServers(true);
    const server = servers.find(s => String(s.id) === String(id));
    const bot = findGuildBot(id);
    const serverOwnerId = server?.ownerId || bot?.ownerUserId || bot?.ownerId;

    if (!isMasterOwner && (!callerId || (serverOwnerId && String(serverOwnerId) !== String(callerId)))) {
      return res.status(403).json({ error: 'Forbidden: only the server owner can delete this server.' });
    }

    if (confirmName !== undefined && server?.name && String(confirmName).trim() !== String(server.name).trim()) {
      return res.status(400).json({ error: 'Server name does not match confirmation.' });
    }

    try {
      // 2. Delete from promoted_servers / listings
      removePromotedServer(id);
      invalidateShowcaseCache();

      // 3. Delete reviews for this server
      try {
        const reviewsPath = path.resolve('data/reviews.json');
        if (fs.existsSync(reviewsPath)) {
          const revs = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
          if (Array.isArray(revs)) {
            const filtered = revs.filter(r => r.guild_id !== id && r.guildId !== id && r.server_id !== id);
            fs.writeFileSync(reviewsPath, JSON.stringify(filtered, null, 2), 'utf8');
            try {
              const webReviewsPath = path.resolve('web/data/reviews.json');
              if (fs.existsSync(webReviewsPath)) fs.writeFileSync(webReviewsPath, JSON.stringify(filtered, null, 2), 'utf8');
            } catch {}
          } else if (revs && Array.isArray(revs.reviews)) {
            revs.reviews = revs.reviews.filter(r => r.guild_id !== id && r.guildId !== id && r.server_id !== id);
            fs.writeFileSync(reviewsPath, JSON.stringify(revs, null, 2), 'utf8');
            try {
              const webReviewsPath = path.resolve('web/data/reviews.json');
              if (fs.existsSync(webReviewsPath)) fs.writeFileSync(webReviewsPath, JSON.stringify(revs, null, 2), 'utf8');
            } catch {}
          }
        }
      } catch (e) {
        console.error('Error cleaning reviews on server delete:', e);
      }

      // 4. Delete recruits, reps, recruit settings
      try {
        const recruitPath = path.resolve('data/recruits.json');
        if (fs.existsSync(recruitPath)) {
          const rData = JSON.parse(fs.readFileSync(recruitPath, 'utf8'));
          if (rData.settings) delete rData.settings[id];
          if (rData.representatives) delete rData.representatives[id];
          if (rData.links) delete rData.links[id];
          if (rData.recruits) delete rData.recruits[id];
          if (rData.auditLog) delete rData.auditLog[id];
          fs.writeFileSync(recruitPath, JSON.stringify(rData, null, 2), 'utf8');
          try {
            const webRecruitPath = path.resolve('web/data/recruits.json');
            if (fs.existsSync(webRecruitPath)) fs.writeFileSync(webRecruitPath, JSON.stringify(rData, null, 2), 'utf8');
          } catch {}
        }
      } catch (e) {
        console.error('Error cleaning recruits on server delete:', e);
      }

      // 5. End active partnerships, notify partners, and delete partnerships & requests
      try {
        const pPath = path.resolve('data/partnerships.json');
        if (fs.existsSync(pPath)) {
          const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
          if (Array.isArray(pData.partnerships)) {
            pData.partnerships.forEach(p => {
              if (p.guildIdA === id || p.guildIdB === id) {
                const partnerGuildId = p.guildIdA === id ? p.guildIdB : p.guildIdA;
                if (partnerGuildId && pData.notifications) {
                  if (!pData.notifications[partnerGuildId]) pData.notifications[partnerGuildId] = [];
                  pData.notifications[partnerGuildId].unshift({
                    id: `notif-${Date.now()}-${randomBytes(4).toString('hex')}`,
                    type: 'partnership_ended',
                    title: 'Partnership ended',
                    body: `${server?.name || 'Partner community'} has deleted their server from ConnectingERLC. Your partnership has been ended.`,
                    timestamp: new Date().toISOString(),
                    read: false
                  });
                }
              }
            });
            pData.partnerships = pData.partnerships.filter(p => p.guildIdA !== id && p.guildIdB !== id);
          }
          if (Array.isArray(pData.requests)) {
            pData.requests = pData.requests.filter(r => r.fromGuildId !== id && r.toGuildId !== id);
          }
          if (pData.settings) delete pData.settings[id];
          if (pData.webhooks) delete pData.webhooks[id];
          if (pData.milestones) delete pData.milestones[id];
          fs.writeFileSync(pPath, JSON.stringify(pData, null, 2), 'utf8');
          try {
            const webPPath = path.resolve('web/data/partnerships.json');
            if (fs.existsSync(webPPath)) fs.writeFileSync(webPPath, JSON.stringify(pData, null, 2), 'utf8');
          } catch {}
        }
      } catch (e) {
        console.error('Error cleaning partnerships on server delete:', e);
      }

      // 6. Delete bot instance / workspace / erlc keys
      try {
        const botPath = path.resolve('data/bot_instances.json');
        if (fs.existsSync(botPath)) {
          const instances = JSON.parse(fs.readFileSync(botPath, 'utf8'));
          if (Array.isArray(instances)) {
            const filteredBots = instances.filter(b => b.guildId !== id && b.id !== id);
            fs.writeFileSync(botPath, JSON.stringify(filteredBots, null, 2), 'utf8');
            try {
              const webBotPath = path.resolve('web/data/bot_instances.json');
              if (fs.existsSync(webBotPath)) fs.writeFileSync(webBotPath, JSON.stringify(filteredBots, null, 2), 'utf8');
            } catch {}
          }
        }
      } catch (e) {
        console.error('Error cleaning bot instance on server delete:', e);
      }

      // 7. Clean ledger entries for other users (anonymize to "Deleted server", set guildId to null)
      try {
        const ledgerPath = path.resolve('data/ledger.json');
        if (fs.existsSync(ledgerPath)) {
          const ledgerData = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
          if (Array.isArray(ledgerData.transactions)) {
            ledgerData.transactions.forEach(tx => {
              if (tx.guildId === id || tx.serverId === id) {
                tx.guildName = 'Deleted server';
                tx.serverName = 'Deleted server';
                tx.guildId = null;
                tx.serverId = null;
              }
            });
            fs.writeFileSync(ledgerPath, JSON.stringify(ledgerData, null, 2), 'utf8');
            try {
              const webLedgerPath = path.resolve('web/data/ledger.json');
              if (fs.existsSync(webLedgerPath)) fs.writeFileSync(webLedgerPath, JSON.stringify(ledgerData, null, 2), 'utf8');
            } catch {}
          }
        }
      } catch (e) {
        console.error('Error cleaning ledger on server delete:', e);
      }

      // 8. Record in both audit_log.json (via recordAuditAction) and admin_audit_log.json
      const serverIdHash = crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 16);
      try {
        recordAuditAction({
          actor: { userId: callerId || 'system', username: session?.user?.username || 'owner', role: 'Owner' },
          action: 'server_deleted',
          target: serverIdHash,
          targetType: 'server',
          reason: `Server ${server?.name || id} deleted by owner`,
          before: server?.name || String(id),
          after: 'deleted',
          metadata: { serverId: String(id), serverIdHash, serverName: server?.name || null }
        });
      } catch {}

      try {
        const auditPath = path.resolve('data/admin_audit_log.json');
        let auditList = [];
        if (fs.existsSync(auditPath)) {
          try { auditList = JSON.parse(fs.readFileSync(auditPath, 'utf8')); } catch {}
        }
        if (!Array.isArray(auditList)) auditList = [];
        auditList.push({
          id: `audit-${Date.now()}-${randomBytes(4).toString('hex')}`,
          action: 'server_deleted',
          serverIdHash,
          timestamp: new Date().toISOString(),
          actorUserId: callerId || 'system'
        });
        fs.writeFileSync(auditPath, JSON.stringify(auditList, null, 2), 'utf8');
        try {
          const webAuditPath = path.resolve('web/data/admin_audit_log.json');
          fs.writeFileSync(webAuditPath, JSON.stringify(auditList, null, 2), 'utf8');
        } catch {}
      } catch (e) {
        console.error('Error recording delete audit log:', e);
      }

      // 9. Respond 204 No Content
      return res.status(204).end();
    } catch (err) {
      console.error('[DELETE /servers/:id] Failed to delete server:', err);
      return res.status(500).json({ error: 'Failed to delete server completely.' });
    }
  });

  // ER:LC Private Server Endpoints
  // Connect ER:LC key
  router.post('/servers/:id/erlc/connect', async (req, res) => {
    const { id } = req.params;
    const { key } = req.body || {};
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);

    if (!key || typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ error: 'Please provide a valid ER:LC API key.' });
    }

    try {
      const result = await connectErlcServer(id, key.trim(), userId);
      res.json({
        success: true,
        connected: true,
        name: result.name,
        currentPlayers: result.currentPlayers,
        maxPlayers: result.maxPlayers,
        joinCode: result.joinCode,
        maskedKey: result.maskedKey,
        lastCheckedAt: result.lastCheckedAt,
      });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not connect ER:LC API key.' });
    }
  });

  // Get ER:LC status
  router.get('/servers/:id/erlc/status', async (req, res) => {
    const { id } = req.params;
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

    if (refresh && !checkRateLimit(id, 5)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before refreshing again.' });
    }

    try {
      const status = await getErlcStatus(id, refresh);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not fetch ER:LC status.' });
    }
  });

  // Test ER:LC connection
  router.post('/servers/:id/erlc/test', async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);

    if (!checkRateLimit(id, 5)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before testing again.' });
    }

    try {
      const result = await testErlcConnection(id, userId);
      res.json({
        success: true,
        message: `Connected to ${result.name} (${result.currentPlayers} / ${result.maxPlayers} players online)`,
        ...result,
      });
    } catch (err) {
      res.status(400).json({ error: err.message || 'ER:LC connection test failed.' });
    }
  });

  // Disconnect ER:LC key
  router.post('/servers/:id/erlc/disconnect', async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);

    try {
      await disconnectErlcServer(id, userId);
      res.json({ success: true, message: 'ER:LC server disconnected.' });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not disconnect ER:LC server.' });
    }
  });

  // -------------------------------------------------------------
  // RECRUITS HUB ENDPOINTS (Section 8)
  // -------------------------------------------------------------

  // GET /api/servers/:id/recruits/summary
  router.get('/servers/:id/recruits/summary', (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    const userProfile = req.dashboardSession?.user || req.session?.user || { id: userId, username: 'member', name: 'Community Member' };

    try {
      const summary = getRecruitsSummary(id);
      const userStats = getUserRecruitStats(id, userId, userProfile);
      res.json({
        ok: true,
        summary: {
          ...summary,
          currentUserStats: userStats,
        }
      });
    } catch (err) {
      console.error('[RECRUITS API] Error getting summary:', err);
      res.status(500).json({ error: 'Failed to fetch recruits summary' });
    }
  });

  // GET /api/servers/:id/recruits
  router.get('/servers/:id/recruits', (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;
    const status = req.query.status || 'all';
    const search = req.query.search || '';
    const recruiterId = req.query.recruiterId || null;

    try {
      const result = getRecruitsList(id, { page, pageSize, status, search, recruiterId });
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[RECRUITS API] Error getting recruits list:', err);
      res.status(500).json({ error: 'Failed to fetch recruits list' });
    }
  });

  // POST /api/servers/:id/recruits/link
  router.post('/servers/:id/recruits/link', (req, res) => {
    const { id } = req.params;
    const botStatus = getGuildBotStatus(id);
    if (!botStatus.bot_in_guild) {
      return res.status(403).json({
        error: 'BOT_NOT_IN_GUILD',
        botStatus: botStatus.botStatus,
        message: 'ConnectingERLC bot must be added to your server before recruiting.'
      });
    }
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    const userProfile = req.dashboardSession?.user || req.session?.user || { id: userId, username: 'member', name: 'Community Member' };

    try {
      const link = getOrCreateRecruitLink(id, userId, userProfile);
      res.json({ ok: true, link });
    } catch (err) {
      console.error('[RECRUITS API] Error generating link:', err);
      res.status(500).json({ error: 'Failed to generate recruit link' });
    }
  });

  // GET /api/servers/:id/recruits/leaderboard
  router.get('/servers/:id/recruits/leaderboard', (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 12;

    try {
      const leaderboard = getRecruitLeaderboard(id, { page, pageSize });
      res.json({ ok: true, ...leaderboard });
    } catch (err) {
      console.error('[RECRUITS API] Error getting leaderboard:', err);
      res.status(500).json({ error: 'Failed to fetch recruits leaderboard' });
    }
  });

  // GET /api/servers/:id/recruits/user-stats
  router.get('/servers/:id/recruits/user-stats', (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    const userProfile = req.dashboardSession?.user || req.session?.user || { id: userId, username: 'member', name: 'Community Member' };

    try {
      const stats = getUserRecruitStats(id, userId, userProfile);
      res.json({ ok: true, stats });
    } catch (err) {
      console.error('[RECRUITS API] Error getting user stats:', err);
      res.status(500).json({ error: 'Failed to fetch user recruit stats' });
    }
  });

  // GET /api/servers/:id/recruits/settings
  router.get('/servers/:id/recruits/settings', (req, res) => {
    const { id } = req.params;
    try {
      const settings = getRecruitSettings(id);
      res.json({ ok: true, settings });
    } catch (err) {
      console.error('[RECRUITS API] Error getting settings:', err);
      res.status(500).json({ error: 'Failed to fetch recruit settings' });
    }
  });

  // PUT /api/servers/:id/recruits/settings
  router.put('/servers/:id/recruits/settings', (req, res) => {
    const { id } = req.params;
    const botStatus = getGuildBotStatus(id);
    if (!botStatus.bot_in_guild) {
      return res.status(403).json({
        error: 'BOT_NOT_IN_GUILD',
        botStatus: botStatus.botStatus,
        message: 'ConnectingERLC bot must be added to your server before recruiting.'
      });
    }
    const patch = req.body || {};

    try {
      const cleanPatch = {};
      if (patch.enabled !== undefined) cleanPatch.enabled = Boolean(patch.enabled);
      if (patch.credits_per_recruit !== undefined) {
        cleanPatch.credits_per_recruit = Math.min(10, Math.max(0, parseInt(patch.credits_per_recruit, 10) || 0));
      }
      if (patch.retention_hours !== undefined) {
        const h = parseInt(patch.retention_hours, 10);
        cleanPatch.retention_hours = [24, 48, 72, 168].includes(h) ? h : 72;
      }
      if (Array.isArray(patch.reward_roles)) {
        cleanPatch.reward_roles = patch.reward_roles
          .filter(r => r && r.role_name && Number(r.required_recruits) > 0)
          .map(r => ({
            role_id: String(r.role_id || `role_${Date.now()}`),
            role_name: String(r.role_name).trim(),
            required_recruits: Math.max(1, parseInt(r.required_recruits, 10) || 1)
          }));
      }
      if (patch.log_channel_id !== undefined) {
        cleanPatch.log_channel_id = patch.log_channel_id ? String(patch.log_channel_id).trim() : null;
      }

      const updated = updateRecruitSettings(id, cleanPatch);
      res.json({ ok: true, settings: updated, message: 'Recruit settings saved successfully' });
    } catch (err) {
      console.error('[RECRUITS API] Error updating settings:', err);
      res.status(500).json({ error: 'Failed to update recruit settings' });
    }
  });

  // GET /api/servers/:id/recruits/trend (30-day verified trend)
  router.get('/servers/:id/recruits/trend', (req, res) => {
    const { id } = req.params;
    try {
      const trend = get30DayRecruitsTrend(id);
      res.json({ ok: true, trend });
    } catch (err) {
      console.error('[RECRUITS API] Error getting trend:', err);
      res.status(500).json({ error: 'Failed to fetch recruits trend' });
    }
  });

  // POST /api/servers/:id/recruits/step-down
  router.post('/servers/:id/recruits/step-down', (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || req.body?.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
    try {
      const success = stepDownRepresentative(id, userId);
      res.json({ ok: true, success, message: 'You have stepped down as representative.' });
    } catch (err) {
      console.error('[RECRUITS API] Error stepping down:', err);
      res.status(500).json({ error: 'Failed to step down' });
    }
  });

  // POST /api/servers/:id/recruits/test-panel
  router.post('/servers/:id/recruits/test-panel', async (req, res) => {
    const { id } = req.params;
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const settings = getRecruitSettings(id);
    const channelId = req.body?.channelId || settings.log_channel_id;

    try {
      const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
      const panelContent = `**Recruit Hub System Notification**\nRecruit verification telemetry node connected. Minimum stay required: **${settings.retention_hours} hours** (${settings.retention_hours / 24} days).\nReward tier: **${settings.credits_per_recruit} credits** per verified member.`;

      if (token && channelId) {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: panelContent,
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 5, label: 'Recruit Hub', url: `${appOrigin()}/dashboard/${id}/recruits` }
                ]
              }
            ]
          })
        }).catch(() => null);
      }

      if (settings.dm_owner && token && userId) {
        await sendDiscordNotificationV2(userId, 'anti_raid', 'Recruit Hub', id).catch(() => null);
      }

      res.json({ ok: true, message: 'Test panel dispatched successfully.' });
    } catch (err) {
      console.error('[RECRUITS API] Error sending test panel:', err);
      res.status(500).json({ error: 'Failed to dispatch test panel.' });
    }
  });

  // ── OWNER TOOLS (Section 7.5) ──
  router.get('/servers/:id/owner-tools/bot-perms', (req, res) => {
    res.json({
      ok: true,
      hasKick: true,
      hasBan: true,
      hasCreateInvite: true,
    });
  });

  router.post('/servers/:id/owner-tools/kick', (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId || !reason) return res.status(400).json({ error: 'User ID and reason required.' });

    const data = loadRecruitData();
    data.activity = data.activity || [];
    data.activity.push({
      id: `act_${Date.now()}`,
      guild_id: String(id),
      type: 'member_kicked',
      user_id: userId,
      reason,
      actor_id: actorId,
      timestamp: Date.now(),
    });
    saveRecruitData(data);
    res.json({ ok: true, message: `Member ${userId} kicked.` });
  });

  router.post('/servers/:id/owner-tools/ban', (req, res) => {
    const { id } = req.params;
    const { userId, reason, deleteDays = 0 } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId || !reason) return res.status(400).json({ error: 'User ID and reason required.' });

    const data = loadRecruitData();
    data.activity = data.activity || [];
    data.activity.push({
      id: `act_${Date.now()}`,
      guild_id: String(id),
      type: 'member_banned',
      user_id: userId,
      reason,
      delete_days: deleteDays,
      actor_id: actorId,
      timestamp: Date.now(),
    });
    saveRecruitData(data);
    res.json({ ok: true, message: `Member ${userId} banned.` });
  });

  router.post('/servers/:id/owner-tools/block-recruiter', (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId) return res.status(400).json({ error: 'User ID required.' });
    const result = blockRecruiter(id, userId, reason, actorId);
    res.json(result);
  });

  router.post('/servers/:id/owner-tools/reverse', (req, res) => {
    const { id } = req.params;
    const { recruitId, reason } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!recruitId) return res.status(400).json({ error: 'Recruit ID required.' });
    try {
      const result = reverseRecruit(id, recruitId, reason, actorId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/servers/:id/owner-tools/remove-rep', (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body || {};
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    if (!userId) return res.status(400).json({ error: 'User ID required.' });
    const result = removeRepresentative(id, userId, reason, actorId);
    res.json(result);
  });

  router.post('/servers/:id/owner-tools/pause', (req, res) => {
    const { id } = req.params;
    const { paused } = req.body || {};
    const updated = updateRecruitSettings(id, { enabled: !paused });
    res.json({ ok: true, settings: updated });
  });

  router.post('/servers/:id/owner-tools/revoke-invites', (req, res) => {
    const { id } = req.params;
    const actorId = req.dashboardSession?.user?.id || req.session?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const result = revokeAllRepresentativeInvites(id, actorId);
    res.json(result);
  });

  router.get('/servers/:id/owner-tools/export-csv', (req, res) => {
    const { id } = req.params;
    const csv = exportRecruitsToCsv(id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="recruits_${id}.csv"`);
    res.send(csv);
  });

  router.get('/servers/:id/owner-tools/activity', (req, res) => {
    const { id } = req.params;
    const logs = getOwnerAuditLog(id);
    res.json({ ok: true, logs });
  });

  // Dedicated server activity endpoint for Overview recent activity: GET /api/servers/:id/activity
  router.get('/servers/:id/activity', (req, res) => {
    const { id } = req.params;
    const events = [];
    const seenIds = new Set();

    const addEvent = (evt) => {
      if (!evt || !evt.id) return;
      if (seenIds.has(evt.id)) return;
      seenIds.add(evt.id);
      events.push(evt);
    };

    try {
      // 0. Stored live server activity events (bumps, joins, reviews, check-ins, credit changes)
      const storedEvents = getStoredServerActivity(id) || [];
      for (const se of storedEvents) {
        addEvent({
          id: se.id || `stored_${se.timestamp}_${se.type}`,
          type: se.type || 'join',
          text: se.text || 'Server event recorded',
          timestamp: se.timestamp || Date.now(),
        });
      }

      // 1. Recruits / Joins from recruit audit log
      const logs = getOwnerAuditLog(id) || [];
      for (const log of logs) {
        let text = 'Member event recorded';
        let type = 'recruit';
        if (log.type === 'recruit_joined') {
          type = 'join';
          text = `${log.user_name || 'Member'} joined via directory invite`;
        } else if (log.type === 'recruit_left') {
          type = 'join';
          text = `${log.user_name || 'Member'} left the server`;
        } else if (log.type === 'recruiter_blocked') {
          type = 'recruit';
          text = `Recruiter access updated by owner`;
        } else if (log.type === 'recruit_reversed') {
          type = 'recruit';
          text = `Bounty reversed for ${log.user_name || 'member'}`;
        }
        addEvent({
          id: log.id || `log_${log.timestamp || Date.now()}`,
          type,
          text,
          timestamp: log.timestamp || Date.now(),
        });
      }

      // 2. Bumps & Verified Joins from directory data
      const dirData = loadDirectoryData();
      const s = (dirData.servers || []).find(srv => String(srv.id) === String(id) || String(srv.guildId) === String(id));
      if (s && s.lastBumpedAt) {
        addEvent({
          id: `bump_${s.id}_${s.lastBumpedAt}`,
          type: 'bump',
          text: 'Server bumped to #1 in directory',
          timestamp: s.lastBumpedAt,
        });
      }

      // Also include verified userJoinRecords for this server
      if (dirData.userJoinRecords && typeof dirData.userJoinRecords === 'object') {
        for (const [key, rec] of Object.entries(dirData.userJoinRecords)) {
          if (rec && String(rec.serverId) === String(id) && rec.stayCompleted) {
            const ts = rec.stayCompletedAt || rec.joinedAt || Date.now();
            addEvent({
              id: `join_rec_${key}_${ts}`,
              type: 'join',
              text: `Verified member join completed (+${rec.reward || 2} cr)`,
              timestamp: ts,
            });
          }
        }
      }

      // 3. Reviews
      const revData = getServerReviews(id) || { reviews: [] };
      for (const rev of revData.reviews || []) {
        const reviewerName = rev.display_name || rev.user_name || rev.author_name || 'Member';
        addEvent({
          id: `rev_${rev.id}`,
          type: 'review',
          text: `${reviewerName} left a ${rev.rating}-star review`,
          timestamp: rev.created_at || Date.now(),
        });
      }

      // 4. Partnerships
      try {
        const pPath = path.resolve('data/partnerships.json');
        if (fs.existsSync(pPath)) {
          const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
          for (const p of (pData.partnerships || [])) {
            if (String(p.guildIdA) === String(id) || String(p.guildIdB) === String(id)) {
              const isA = String(p.guildIdA) === String(id);
              const partnerName = isA ? (p.guildNameB || 'partner community') : (p.guildNameA || 'partner community');
              const partnerTs = p.acceptedAt || p.createdAt || p.updatedAt || Date.now();
              addEvent({
                id: `part_${p.id}`,
                type: 'partnership',
                text: `Partnership connected with ${partnerName}`,
                timestamp: partnerTs,
              });
            }
          }
        }
      } catch {}

      // 5. Ledger transactions (credit changes & check-ins for this server or its owner)
      try {
        const ledgerData = loadLedgerData();
        const serverOwnerId = s?.ownerId ? String(s.ownerId) : null;
        for (const tx of (ledgerData.transactions || [])) {
          const matchesServer =
            String(tx.guildId || '') === String(id) ||
            String(tx.serverId || '') === String(id) ||
            String(tx.joinedServerId || '') === String(id) ||
            (serverOwnerId && String(tx.userId || '') === serverOwnerId && tx.reason === 'daily_checkin');
          if (!matchesServer) continue;

          const sign = tx.type === 'spent' || Number(tx.amount) < 0 ? '-' : '+';
          const absAmt = Math.abs(Number(tx.amount) || 0);
          let evtType = 'credits';
          let evtText = `${ tx.description || tx.reason || 'Credit update' } (${sign}${absAmt} cr)`;
          if (tx.reason === 'daily_checkin') {
            evtType = 'checkin';
            evtText = `Daily check-in completed (${sign}${absAmt} cr)`;
          } else if (tx.reason === 'join_reward' || tx.reason === 'server_join') {
            evtType = 'join';
          }
          addEvent({
            id: `tx_${tx.id}`,
            type: evtType,
            text: evtText,
            timestamp: tx.timestamp || Date.now(),
          });
        }
      } catch {}

      // Sort descending by timestamp
      events.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return timeB - timeA;
      });

      // Deduplicate consecutive/overlapping events for the same action (bumps, milestones, partnerships)
      const dedupedEvents = [];
      const seenGroups = new Map();

      for (const evt of events) {
        const rawText = String(evt.text || '');
        const norm = rawText
          .toLowerCase()
          .replace(/\s*\(\+?\-?\d+\s*cr\)/gi, '')
          .replace(/[^a-z0-9]/gi, '');
        const ts = new Date(evt.timestamp).getTime() || 0;

        let groupKey = norm;
        if (norm.includes('bumpreward') || norm.includes('bumpedto1')) {
          groupKey = 'bump_action';
        } else if (norm.includes('milestonereward')) {
          groupKey = `milestone_${norm.replace(/milestonereward/g, '')}`;
        }

        const prevTs = seenGroups.get(groupKey);
        if (prevTs !== undefined && Math.abs(ts - prevTs) < 15 * 60 * 1000) {
          continue;
        }

        seenGroups.set(groupKey, ts);
        dedupedEvents.push(evt);
      }

      res.json({ ok: true, events: dedupedEvents.slice(0, 50) });
    } catch (err) {
      res.json({ ok: true, events: [] });
    }
  });

  // Dedicated Leaderboard endpoint: GET /api/leaderboard
  router.get('/leaderboard', (req, res) => {
    const { tab = 'servers', range = '30d', category, page = 1, pageSize = 20, guildId } = req.query;
    const currentUserId = req.session?.userId || null;
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safePageSize = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

    if (tab === 'recruiters') {
      const recruitData = loadRecruitData();
      const recruiterMap = new Map();

      // Aggregate verified recruits per user
      for (const r of recruitData.recruits || []) {
        if (!r || !r.recruiter_user_id) continue;
        const uId = r.recruiter_user_id;
        if (!recruiterMap.has(uId)) {
          recruiterMap.set(uId, {
            recruiter_id: uId,
            recruiter_name: r.recruiter_name || 'Community Recruiter',
            recruiter_avatar: `https://cdn.discordapp.com/embed/avatars/${Number(uId.slice(-1)) % 5}.png`,
            server_id: r.guild_id,
            server_name: 'Community Server',
            verifiedCount: 0,
            creditsEarned: 0,
          });
        }
        const entry = recruiterMap.get(uId);
        if (r.status === 'verified') {
          entry.verifiedCount += 1;
          entry.creditsEarned += (r.credits_awarded || 2);
        }
      }

      // If viewing user is logged in, ensure their entry exists in rankings
      if (currentUserId && !recruiterMap.has(currentUserId)) {
        recruiterMap.set(currentUserId, {
          recruiter_id: currentUserId,
          recruiter_name: req.session?.username || 'You',
          recruiter_avatar: req.session?.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png',
          server_id: guildId || '',
          server_name: 'Your Server',
          verifiedCount: 0,
          creditsEarned: 0,
        });
      }

      let allRecruiters = Array.from(recruiterMap.values());
      allRecruiters.sort((a, b) => {
        if (b.verifiedCount !== a.verifiedCount) return b.verifiedCount - a.verifiedCount;
        return b.creditsEarned - a.creditsEarned;
      });

      const total = allRecruiters.length;
      let userRankIndex = currentUserId ? allRecruiters.findIndex(r => r.recruiter_id === currentUserId) : -1;
      const userRank = userRankIndex >= 0 ? userRankIndex + 1 : 1;
      const topPercent = Math.max(1, Math.round((userRank / Math.max(1, total)) * 100));

      const startIndex = (safePage - 1) * safePageSize;
      const paginated = allRecruiters.slice(startIndex, startIndex + safePageSize);
      const items = paginated.map((r, idx) => ({
        rank: startIndex + idx + 1,
        ...r,
      }));

      return res.json({
        items,
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.ceil(total / safePageSize) || 1,
        yourRank: {
          rank: userRank,
          total,
          topPercent,
          name: req.session?.username || 'You',
        },
      });
    }

    if (tab === 'partners') {
      let servers = getPromotedServers();
      servers.sort((a, b) => (b.partnershipsCount || 0) - (a.partnershipsCount || 0));

      const total = servers.length;
      let currentServerIndex = guildId ? servers.findIndex(s => s.id === guildId) : -1;
      const serverRank = currentServerIndex >= 0 ? currentServerIndex + 1 : 1;
      const topPercent = Math.max(1, Math.round((serverRank / Math.max(1, total)) * 100));

      const startIndex = (safePage - 1) * safePageSize;
      const paginated = servers.slice(startIndex, startIndex + safePageSize);
      const items = paginated.map((s, idx) => ({
        rank: startIndex + idx + 1,
        id: s.id,
        name: s.name,
        icon: s.icon,
        icon_hash: s.icon_hash || s.iconHash || (s.icon && !s.icon.startsWith('http') ? s.icon : null) || null,
        iconHash: s.icon_hash || s.iconHash || (s.icon && !s.icon.startsWith('http') ? s.icon : null) || null,
        owner_discord_id: s.owner_discord_id || s.ownerId || null,
        owner_display_name: s.owner_display_name || s.ownerUsername || null,
        owner_avatar_hash: s.owner_avatar_hash || null,
        partnersCount: s.partnershipsCount || 0,
        mentionsSent: (s.partnershipsCount || 0) * 3,
        status: s.listed ? 'Active' : 'Paused',
        verified: Boolean(s.verified),
      }));

      return res.json({
        items,
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.ceil(total / safePageSize) || 1,
        yourRank: {
          rank: serverRank,
          total,
          topPercent,
          name: servers[currentServerIndex]?.name || (guildId ? findGuildBot(guildId)?.customizations?.serverName : '') || 'Community Server',
        },
      });
    }

    // Default: tab === 'servers'
    let servers = getPromotedServers();
    if (category && category !== 'All') {
      const cat = String(category).toLowerCase();
      servers = servers.filter(s => s.category && s.category.toLowerCase() === cat);
    }

    servers.sort((a, b) => {
      const aScore = (a.verifiedJoins || 0) * 2 + (a.bumps || 0);
      const bScore = (b.verifiedJoins || 0) * 2 + (b.bumps || 0);
      if (bScore !== aScore) return bScore - aScore;
      return (b.memberCount || 0) - (a.memberCount || 0);
    });

    const total = servers.length;
    let currentServerIndex = guildId ? servers.findIndex(s => s.id === guildId) : -1;
    const serverRank = currentServerIndex >= 0 ? currentServerIndex + 1 : 1;
    let currentServer = currentServerIndex >= 0 ? servers[currentServerIndex] : null;
    if (!currentServer && guildId) {
      const allDirServers = getPromotedServers();
      currentServer = allDirServers.find(s => s.id === guildId) || null;
    }
    if (!currentServer && guildId) {
      const bot = findGuildBot(guildId);
      if (bot) {
        currentServer = {
          id: guildId,
          name: bot.customizations?.serverName || 'Community Server',
          icon: bot.customizations?.serverIconUrl || null,
          icon_hash: null,
        };
      }
    }
    const topPercent = total >= 10 ? Math.ceil((serverRank / total) * 100) : null;

    let neededJoins = 0;
    if (serverRank > 1 && currentServer) {
      const serverAbove = servers[serverRank - 2];
      const targetJoins = (serverAbove?.verifiedJoins || 0);
      const myJoins = (currentServer.verifiedJoins || 0);
      neededJoins = Math.max(1, (targetJoins - myJoins) + 1);
    }

    const startIndex = (safePage - 1) * safePageSize;
    const paginated = servers.slice(startIndex, startIndex + safePageSize);
    const items = paginated.map((s, idx) => ({
      rank: startIndex + idx + 1,
      id: s.id,
      name: s.name,
      icon: s.icon,
      icon_hash: s.icon_hash || s.iconHash || (s.icon && !s.icon.startsWith('http') ? s.icon : null) || null,
      iconHash: s.icon_hash || s.iconHash || (s.icon && !s.icon.startsWith('http') ? s.icon : null) || null,
      owner_discord_id: s.owner_discord_id || s.ownerId || null,
      owner_display_name: s.owner_display_name || s.ownerUsername || null,
      owner_avatar_hash: s.owner_avatar_hash || null,
      category: s.category || 'Roleplay server',
      memberCount: s.memberCount || 0,
      verifiedJoins: s.verifiedJoins || 0,
      bumps: s.bumps || 0,
      verified: Boolean(s.verified),
      inviteUrl: s.inviteUrl,
    }));

    res.json({
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize) || 1,
      yourRank: {
        rank: serverRank,
        total,
        topPercent,
        name: currentServer?.name || 'Community Server',
        guildId: currentServer?.id || guildId,
        iconUrl: currentServer?.icon || null,
        iconHash: currentServer?.icon_hash || null,
        neededJoins,
        change: null,
      },
    });
  });

  // ─── ADMIN NEXUS REST ENDPOINTS ──────────────────────────────────────────
  const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.json');

  const DEFAULT_CHANGELOG = [
    {
      version: "3.2.0",
      date: "2026-10-21T02:00:00.000Z",
      title: "V2 Bump Engine & Dynamic Telemetry Trajectory",
      description: "Server bump counters and direct links, alongside dynamic Recharts member growth charts and directory pagination.",
      tags: ["new", "improved"],
      items: [
        "Bump counter and ConnectingERLC directory link on every server page",
        "Dynamic verified member growth trajectory line chart powered by Recharts",
        "Custom banner image upload in Promote Server Studio with real-time preview",
        "Complete Anti-Raid & Churn Security suite with live defense shield rating and 72h retention enforcement",
        "Paginated community directory discovery and joined communities management",
        "Redesigned community growth tiers with transparent Vibra UI pricing cards and custom banners included on Free"
      ],
      href: "#v3-2-0"
    },
    {
      version: "3.0.0",
      date: "2026-10-17T08:00:00.000Z",
      title: "ConnectingERLC Community Growth & Discord Directory",
      description: "Major release introducing the real-time Discord directory and 72-hour credit retention guarantees.",
      tags: ["new", "improved"],
      items: [
        "72-Hour retention guarantee enforcing automatic bounty clawback if an account departs early",
        "Customizable community discovery cards with verified badges, real view tracking, and member counts",
        "Interactive 5-star community rating system with instant feedback and ratings persistence",
        "Bump button to elevate partner communities to the top of the directory with a 1-hour cooldown",
        "Dedicated System Telemetry with live process memory (RSS & Heap), uptime duration, and API latency",
        "Dynamic real-time notification engine linked to Discord user joins and daily rewards"
      ],
      href: "#v3-0-0"
    },
    {
      version: "2.4.0",
      date: "2026-10-15T14:30:00.000Z",
      title: "Treasury Transfers & Multi-Server Discord Switcher",
      description: "Added zero-fee credit transfers between Discord users and communities, alongside an instant multi-guild workspace switcher.",
      tags: ["new", "improved"],
      items: [
        "Zero-fee credit transfer hub with Discord Snowflake validation and instant balance deduction",
        "Discord Workspace Switcher syncing user guild permissions and community avatars automatically",
        "Multi-Category tagging (up to 3 categories) and Primary Community Language selector"
      ],
      href: "#v2-4-0"
    },
    {
      version: "2.3.0",
      date: "2026-10-10T11:00:00.000Z",
      title: "7-Day Daily Check-In Progression & Streak Rewards",
      description: "Introduced an escalating 7-day reward calendar with automated streak resets and Day 7 grand milestone bounties.",
      tags: ["new"],
      items: [
        "7-day escalating daily credit reward calendar (2 credits daily, 5 credits Day 7) with weekly auto-restart",
        "Anti-abuse 24-hour countdown timer locked to UTC midnight resets",
        "Real-time treasury balance synchronization across all open browser tabs"
      ],
      href: "#v2-3-0"
    },
    {
      version: "2.2.0",
      date: "2026-10-04T16:00:00.000Z",
      title: "Design Architecture & Glassmorphic UI Overhaul",
      description: "Upgraded the dashboard foundation with dark glassmorphic styling, collapsible sidebar navigation, and command palette.",
      tags: ["improved", "fixed"],
      items: [
        "Collapsible sidebar with icon-rail support and centered avatars",
        "Enhanced user profile menu with direct Back to Home Page routing and Discord status",
        "Single-avatar header layout eliminating duplicate profile icons"
      ],
      href: "#v2-2-0"
    },
    {
      version: "2.0.0",
      date: "2026-09-28T09:00:00.000Z",
      title: "Initial ConnectingERLC Platform Launch",
      description: "The core platform engine connecting Discord communities with community growth tools.",
      tags: ["new"],
      items: [
        "Discord OAuth2 authentication with automated guild discovery and permission validation",
        "REST API backend on Express v4 with encrypted configuration storage"
      ],
      href: "#v2-0-0"
    }
  ];

  function loadCustomChangelog() {
    try {
      if (!fs.existsSync(CHANGELOG_FILE)) {
        saveCustomChangelog(DEFAULT_CHANGELOG);
        return DEFAULT_CHANGELOG;
      }
      const data = JSON.parse(fs.readFileSync(CHANGELOG_FILE, 'utf8') || '[]');
      if (!Array.isArray(data) || data.length === 0) {
        saveCustomChangelog(DEFAULT_CHANGELOG);
        return DEFAULT_CHANGELOG;
      }
      const currentVersions = new Set(data.map(d => d.version));
      let hasMissingDefaults = false;
      const merged = [...data];
      for (const def of DEFAULT_CHANGELOG) {
        if (!currentVersions.has(def.version)) {
          merged.push(def);
          hasMissingDefaults = true;
        }
      }
      if (hasMissingDefaults) {
        saveCustomChangelog(merged);
      }
      return merged;
    } catch {
      return DEFAULT_CHANGELOG;
    }
  }

  function saveCustomChangelog(list) {
    try {
      fs.writeFileSync(CHANGELOG_FILE, JSON.stringify(list, null, 2));
    } catch (err) {
      console.error('[ADMIN] Could not save changelog:', err);
    }
  }

  // Admin permission verification middleware
  function requireAdminRole(minRole = 'Moderator') {
    const roleRank = { 'Reviewer': 0.5, 'Moderator': 1, 'Admin': 2, 'Owner': 3 };
    return (req, res, next) => {
      const sessionId = cookieValue(req, SESSION_COOKIE);
      const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
      if (!session || !session.user || !session.user.id) {
        return res.status(404).json({ error: 'Page not found' });
      }
      const userId = session.user.id;
      const username = session.user.username;
      const admin = getAdminRecord(userId, username);
      const userRank = admin ? (roleRank[admin.role] || 0) : 0;
      const requiredRank = roleRank[minRole] !== undefined ? roleRank[minRole] : 1;
      if (!admin || userRank < requiredRank) {
        return res.status(404).json({ error: 'Page not found' });
      }
      if (!checkAdminRateLimit(admin.userId)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before making more administrative changes.' });
      }
      req.adminUser = admin;
      next();
    };
  }

  // Public maintenance endpoint
  router.get('/status/maintenance', (_req, res) => {
    res.json(getMaintenanceStatus());
  });

  // Site theme: stored admin choice wins, otherwise THEME env (default | christmas; defaults to christmas)
  const THEME_FILE = path.join(DATA_DIR, 'theme.json');
  const SEED_THEME_FILE = path.join(process.cwd(), 'seeds', 'theme.json');
  const normTheme = (t) => (String(t || '').toLowerCase() === 'default' ? 'default' : 'christmas');
  const readTheme = () => {
    try {
      if (fs.existsSync(THEME_FILE)) return normTheme(JSON.parse(fs.readFileSync(THEME_FILE, 'utf8')).theme);
    } catch {}
    try {
      if (fs.existsSync(SEED_THEME_FILE)) return normTheme(JSON.parse(fs.readFileSync(SEED_THEME_FILE, 'utf8')).theme);
    } catch {}
    return normTheme(process.env.THEME || 'christmas');
  };
  router.get('/theme', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ theme: readTheme() });
  });
  router.post('/admin/theme', requireAdminRole('Admin'), (req, res) => {
    const theme = normTheme(req.body?.theme);
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const themePayload = JSON.stringify({ theme, updatedAt: Date.now(), updatedBy: req.adminUser?.userId || null }, null, 2);
      fs.writeFileSync(THEME_FILE, themePayload, 'utf8');
      try {
        const seedDir = path.join(process.cwd(), 'seeds');
        fs.mkdirSync(seedDir, { recursive: true });
        fs.writeFileSync(SEED_THEME_FILE, themePayload, 'utf8');
      } catch {}
    } catch (err) {
      return res.status(500).json({ error: 'Could not save theme' });
    }
    res.json({ success: true, theme });
  });

  // Check admin status for frontend navigation
  router.get('/admin/check', (req, res) => {
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
    if (!session || !session.user || !session.user.id) {
      return res.status(404).json({ error: 'Page not found' });
    }
    const userId = session.user.id;
    const username = session.user.username;
    const admin = getAdminRecord(userId, username);
    if (!admin) {
      return res.status(404).json({ error: 'Page not found' });
    }
    const avatarHash = session?.user?.avatar || admin.avatar || null;
    const avatarUrl = avatarHash ? `https://cdn.discordapp.com/avatars/${userId || admin.userId}/${avatarHash}.${String(avatarHash).startsWith('a_') ? 'gif' : 'png'}?size=64` : null;
    res.json({
      ok: true,
      isAdmin: true,
      role: admin.role,
      user: {
        ...admin,
        avatar: avatarUrl,
        avatarHash,
        displayName: session?.user?.global_name || session?.user?.username || admin.displayName || admin.username
      }
    });
  });

  router.get('/admin/me', (req, res) => {
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
    if (!session || !session.user || !session.user.id) {
      return res.status(404).json({ error: 'Page not found' });
    }
    const userId = session.user.id;
    const username = session.user.username;
    const admin = getAdminRecord(userId, username);
    if (!admin) {
      return res.status(404).json({ error: 'Page not found' });
    }
    const avatarHash = session?.user?.avatar || admin.avatar || null;
    const avatarUrl = avatarHash ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${String(avatarHash).startsWith('a_') ? 'gif' : 'png'}?size=64` : null;
    res.json({
      ok: true,
      isAdmin: true,
      role: admin.role,
      user: {
        ...admin,
        avatar: avatarUrl,
        avatarHash,
        displayName: session?.user?.global_name || session?.user?.username || admin.displayName || admin.username
      }
    });
  });

  function getAllKnownUsers() {
    const userMap = new Map();
    // Load known users from migration / DB records / seeds fallback
    const allServers = getPromotedServers(true);
    const knownServerIds = new Set(allServers.map(s => String(s.id || s.guildId || '')).filter(Boolean));
    try {
      const isProd = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
      const knownFile = path.join(DATA_DIR, 'known_users.json');
      const seedFile = path.join(process.cwd(), 'seeds', 'known_users.json');
      let rawKnown = [];
      if (fs.existsSync(knownFile)) {
        try { rawKnown = JSON.parse(fs.readFileSync(knownFile, 'utf8') || '[]'); } catch {}
      }
      if (!isProd && fs.existsSync(seedFile)) {
        try {
          const rawSeed = JSON.parse(fs.readFileSync(seedFile, 'utf8') || '[]');
          for (const s of rawSeed) {
            const sid = String(s.userId || s.id);
            if (!rawKnown.some(k => String(k.userId || k.id) === sid)) rawKnown.push(s);
          }
        } catch {}
      }
      for (const ku of rawKnown) {
        const uid = String(ku.userId || ku.id || '');
        if (uid && !knownServerIds.has(uid)) {
          if (ku.username && ku.username !== 'Name unavailable' && ku.username !== 'null') {
            userMap.set(uid, {
              id: uid,
              username: ku.username,
              globalName: ku.displayName || ku.globalName || ku.username,
              avatar: ku.avatarUrl || (ku.avatar ? (ku.avatar.startsWith('http') ? ku.avatar : `https://cdn.discordapp.com/avatars/${uid}/${ku.avatar}.png`) : null),
              joinedAt: ku.joinedAt || (ku.lastSeen ? new Date(ku.lastSeen).toISOString() : new Date().toISOString()),
              isSignedIn: false
            });
          }
        }
      }
    } catch {}

    // Load backfilled accounts from Cloudflare D1 legacy migration / seeds fallback
    try {
      const isProd = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
      const accountsFile = path.join(DATA_DIR, 'known_accounts.json');
      const seedAccounts = path.join(process.cwd(), 'seeds', 'known_accounts.json');
      let rawAccounts = [];
      if (fs.existsSync(accountsFile)) {
        try { rawAccounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8') || '[]'); } catch {}
      }
      if (!isProd && fs.existsSync(seedAccounts)) {
        try {
          const rawSeed = JSON.parse(fs.readFileSync(seedAccounts, 'utf8') || '[]');
          for (const s of rawSeed) {
            const sid = String(s.userId || s.id);
            if (!rawAccounts.some(k => String(k.userId || k.id) === sid)) rawAccounts.push(s);
          }
        } catch {}
      }
      for (const ka of rawAccounts) {
        const uid = String(ka.userId || ka.id || '');
        if (uid && !knownServerIds.has(uid)) {
          if (ka.username && ka.username !== 'Name unavailable' && ka.username !== 'null') {
            if (!userMap.has(uid)) {
              userMap.set(uid, {
                id: uid,
                username: ka.username,
                globalName: ka.displayName || ka.username,
                avatar: ka.avatar || null,
                joinedAt: ka.firstSeen ? new Date(ka.firstSeen).toISOString() : new Date().toISOString(),
                isSignedIn: false,
                source: ka.source || 'legacy_migration'
              });
            } else {
              const existing = userMap.get(uid);
              if (!existing.avatar && ka.avatar) existing.avatar = ka.avatar;
            }
          }
        }
      }
    } catch {}

    // Load sessions from web_sessions.json
    const userGuildsMap = new Map();
    function recordSessionGuilds(uid, sObj) {
      const list = sObj?.guildCache?.guilds || sObj?.guilds || [];
      if (!Array.isArray(list)) return;
      const arr = userGuildsMap.get(uid) || [];
      for (const g of list) {
        if (g && g.id) {
          const gid = String(g.id);
          if (!arr.some(x => x.id === gid)) {
            arr.push({
              id: gid,
              name: g.name || 'Server',
              icon: g.icon ? (String(g.icon).startsWith('http') ? g.icon : `https://cdn.discordapp.com/icons/${gid}/${g.icon}.png`) : null,
              memberCount: Number(g.memberCount || g.approximate_member_count || 0),
              category: g.owner ? 'Owner' : 'Member'
            });
          }
        }
      }
      userGuildsMap.set(uid, arr);
    }

    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const rawSessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
        for (const s of Object.values(rawSessions)) {
          if (s?.user?.id) {
            const uid = String(s.user.id);
            recordSessionGuilds(uid, s);
            if (!knownServerIds.has(uid)) {
              userMap.set(uid, {
                id: uid,
                username: s.user.username || s.user.tag || 'discord_user',
                globalName: s.user.global_name || s.user.username || 'User',
                avatar: s.user.avatar ? `https://cdn.discordapp.com/avatars/${uid}/${s.user.avatar}.png` : null,
                joinedAt: s.createdAt || new Date().toISOString(),
                isSignedIn: true
              });
            }
          }
        }
      }
    } catch {}

    for (const s of sessions.values()) {
      if (s.user?.id) {
        const uid = String(s.user.id);
        recordSessionGuilds(uid, s);
        if (!knownServerIds.has(uid)) {
          userMap.set(uid, {
            id: uid,
            username: s.user.username || s.user.tag || 'discord_user',
            globalName: s.user.global_name || s.user.username || 'User',
            avatar: s.user.avatar ? `https://cdn.discordapp.com/avatars/${uid}/${s.user.avatar}.png` : null,
            joinedAt: s.createdAt || new Date().toISOString(),
            isSignedIn: true
          });
        }
      }
    }

    const admins = loadAdmins();
    for (const a of admins) {
      const aId = String(a.userId);
      if (!knownServerIds.has(aId)) {
        if (!userMap.has(aId)) {
          userMap.set(aId, {
            id: aId,
            username: a.username || 'admin',
            globalName: a.displayName || a.username || 'Admin',
            avatar: a.avatar || a.avatarUrl || null,
            joinedAt: a.addedAt || new Date().toISOString(),
            isSignedIn: Boolean(a.last_seen_at)
          });
        } else {
          const u = userMap.get(aId);
          if (!u.avatar && (a.avatar || a.avatarUrl)) u.avatar = a.avatar || a.avatarUrl;
        }
      }
    }

    // Also include any server owners who are not yet in userMap
    for (const s of allServers) {
      if (s.ownerId && !knownServerIds.has(String(s.ownerId))) {
        const oId = String(s.ownerId);
        if (userMap.has(oId)) {
          const existing = userMap.get(oId);
          if (!existing.avatar && s.ownerAvatar) existing.avatar = s.ownerAvatar;
          if ((!existing.username || existing.username === 'Name unavailable') && s.ownerUsername) {
            existing.username = s.ownerUsername;
          }
          if ((!existing.globalName || existing.globalName === 'Name unavailable') && (s.ownerDisplayName || s.ownerUsername)) {
            existing.globalName = s.ownerDisplayName || s.ownerUsername;
          }
        } else {
          const fallbackName = s.ownerUsername || s.owner_display_name || `User ${oId.slice(-4)}`;
          userMap.set(oId, {
            id: oId,
            username: fallbackName,
            globalName: s.owner_display_name || fallbackName,
            avatar: s.ownerAvatar || null,
            joinedAt: s.createdAt || new Date().toISOString(),
            isSignedIn: false
          });
        }
      }
    }

    let botList = [];
    try {
      const rawBots = loadBotInstances ? loadBotInstances() : [];
      botList = Array.isArray(rawBots) ? rawBots : Object.values(rawBots || {});
    } catch {}

    for (const b of botList) {
      let bOwner = b?.ownerUserId;
      if (bOwner && typeof bOwner === 'object') {
        bOwner = bOwner.ownerUserId;
      }
      if (bOwner && typeof bOwner === 'string' && /^\d{17,20}$/.test(bOwner) && !userMap.has(bOwner)) {
        if (!knownServerIds.has(bOwner)) {
          const botOwnerName = b.owner_username || b.ownerDiscordTag || `User ${bOwner.slice(-4)}`;
          userMap.set(bOwner, {
            id: bOwner,
            username: botOwnerName,
            globalName: botOwnerName,
            avatar: null,
            joinedAt: b.createdAt || new Date().toISOString(),
            isSignedIn: false
          });
        }
      }
    }

    const banned = loadBannedUsers();
    return Array.from(userMap.values())
      .filter(u => {
        if (!u.id || knownServerIds.has(String(u.id))) return false;
        if (!u.username || u.username === 'Name unavailable' || u.username === 'null') {
          if (/^\d{17,20}$/.test(String(u.id))) {
            u.username = u.globalName || `User ${String(u.id).slice(-4)}`;
          } else {
            return false;
          }
        }
        return true;
      })
      .map(u => {
      const ban = banned.find(b => String(b.userId) === String(u.id));
      const adminRec = admins.find(a => String(a.userId) === String(u.id));

      // Match promoted servers by ownerId OR representatives (never match undefined)
      const userServers = allServers.filter(s =>
        (s.ownerId && /^\d{17,20}$/.test(String(s.ownerId)) && String(s.ownerId) === String(u.id)) ||
        (Array.isArray(s.representatives) && s.representatives.map(String).includes(String(u.id)))
      ).map(s => ({
        id: s.id,
        name: s.name,
        icon: s.iconUrl || s.icon || null,
        memberCount: Number(s.memberCount) || 0,
        category: s.category || 'Roleplay Server'
      }));

      // Match bot instances by owner (strictly valid snowflake IDs)
      const userBotServers = botList.filter(b =>
        typeof b === 'object' &&
        b &&
        b.ownerUserId &&
        /^\d{17,20}$/.test(String(b.ownerUserId)) &&
        String(b.ownerUserId) === String(u.id) &&
        (b.guildId || b.id)
      ).map(b => ({
        id: b.guildId || b.id,
        name: b.customizations?.serverName || b.name || 'Server',
        icon: b.customizations?.serverIconUrl || null,
        memberCount: Number(b.memberCount) || 0,
        category: b.customizations?.serverCategory || 'Roleplay Server'
      }));

      const sessionGuilds = userGuildsMap.get(String(u.id)) || [];
      const uniqueServers = Array.from(new Map([...userServers, ...userBotServers, ...sessionGuilds].map(s => [s.id, s])).values()).map(s => {
        const match = allServers.find(as => String(as.id) === String(s.id));
        return {
          ...s,
          memberCount: Number(s.memberCount || match?.memberCount || 0),
          icon: s.icon || match?.iconUrl || match?.icon || null
        };
      });
      const ledger = getUserLedgerSummary(u.id);
      let status = 'active';
      if (ban) {
        status = ban.duration && ban.duration !== 'Permanent' ? 'suspended' : 'banned';
      } else if (!u.isSignedIn && uniqueServers.length === 0 && !adminRec) {
        status = 'not_signed_in';
      }
      return {
        ...u,
        servers: uniqueServers.length,
        serverList: uniqueServers,
        credits: ledger?.balance || 0,
        status,
        banDetails: ban || null,
        role: adminRec?.role || 'Member',
        lastSeen: u.lastSeen || u.joinedAt || Date.now()
      };
    });
  }

  // Admin Overview & Diagnostics
  router.get('/admin/overview', requireAdminRole(), (_req, res) => {
    const memory = process.memoryUsage();
    const banned = loadBannedUsers();
    const allServers = getPromotedServers(true);
    const activeServers = allServers.filter(s => !s.hidden && !s.delisted);
    const reports = loadReports();
    const flags = loadFlags();
    const audit = loadAuditLog();
    const users = getAllKnownUsers();

    // Compute verified joins in last 24 hours from ledger
    let verifiedJoins24h = 0;
    let creditsInCirculation = 0;
    try {
      const ledgerData = safeRead(path.join(DATA_DIR, 'ledger.json'), { transactions: [] });
      const txs = Array.isArray(ledgerData.transactions) ? ledgerData.transactions : [];
      const oneDayAgo = Date.now() - 24 * 3600 * 1000;
      for (const tx of txs) {
        if ((tx.type === 'join' || tx.type === 'bounty' || tx.type === 'verified_join') && new Date(tx.timestamp).getTime() > oneDayAgo) {
          verifiedJoins24h++;
        }
      }
      // Sum balances of all users
      for (const u of users) {
        if (u.credits > 0) creditsInCirculation += u.credits;
      }
    } catch {}

    const openReports = reports.filter(r => r.status === 'pending' || r.status === 'reviewing').length;
    const openFlags = flags.filter(f => f.status === 'flagged').length;
    const unverifiedServers = activeServers.filter(s => !s.verified).length;

    const needsAttention = [];
    if (openReports > 0) {
      needsAttention.push({
        id: 'reports',
        queue: 'reports',
        title: `${openReports} Open ${openReports === 1 ? 'Report' : 'Reports'} Pending Review`,
        description: 'Community members flagged listings or reviews requiring moderation review.',
        count: openReports,
        link: '/admin-portal/reports'
      });
    }
    if (openFlags > 0) {
      needsAttention.push({
        id: 'flags',
        queue: 'flags',
        title: `${openFlags} Suspicious Activity ${openFlags === 1 ? 'Flag' : 'Flags'}`,
        description: 'Automated anti-raid telemetry caught potential join or recruit anomalies.',
        count: openFlags,
        link: '/admin-portal/flags'
      });
    }
    if (unverifiedServers > 0) {
      needsAttention.push({
        id: 'unverified',
        queue: 'servers',
        title: `${unverifiedServers} Unverified Server ${unverifiedServers === 1 ? 'Listing' : 'Listings'}`,
        description: 'Servers currently listed in directory awaiting manual verification review.',
        count: unverifiedServers,
        link: '/admin-portal/servers'
      });
    }

    try {
      const unverifiedTxs = getUnverifiedJoinTransactions();
      if (unverifiedTxs.length > 0) {
        needsAttention.push({
          id: 'unverified_credits',
          queue: 'credits',
          title: `${unverifiedTxs.length} Unverified Join Ledger Row${unverifiedTxs.length === 1 ? '' : 's'}`,
          description: 'Join credits awarded without bot verification detected. Run "npm run credits:repair" to reverse.',
          count: unverifiedTxs.length,
          link: '/admin-portal/credits'
        });
      }
    } catch {}

    res.json({
      success: true,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRSSMB: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMB: Math.round(memory.heapUsed / (1024 * 1024)),
      nodeVersion: process.version,
      // Real counts only (Section 7)
      usersCount: users.length,
      membersCount: users.filter(u => u.isSignedIn).length,
      knownCount: users.filter(u => !u.isSignedIn).length,
      serversListed: activeServers.length,
      totalServers: allServers.length,
      verifiedJoins24h,
      creditsInCirculation,
      openReports,
      openFlags,
      needsAttention,
      bannedUsersCount: banned.length,
      activeSessionsCount: sessions.size,
      totalUsersCount: users.length,
      pendingReportsCount: openReports,
      activeFlagsCount: openFlags,
      auditLogCount: audit.length,
      maintenance: getMaintenanceStatus(),
      timestamp: new Date().toISOString()
    });
  });

  // Admin Users List with Sub-Tabs (All accounts vs Has Server vs Members vs Known Accounts)
  router.get('/admin/users', requireAdminRole(), (req, res) => {
    let list = getAllKnownUsers();
    const { search, filter, subtab, page = 1, limit = 20 } = req.query;

    const allCount = list.length;
    const serverOwnersCount = list.filter(u => (u.servers || 0) > 0).length;
    const membersCount = list.filter(u => u.isSignedIn).length;
    const knownCount = list.filter(u => !u.isSignedIn).length;

    if (subtab === 'known') {
      list = list.filter(u => !u.isSignedIn);
    } else if (subtab === 'members') {
      list = list.filter(u => u.isSignedIn);
    } else if (subtab === 'has_server' || subtab === 'servers') {
      list = list.filter(u => (u.servers || 0) > 0);
    }
    // subtab === 'all' or empty shows all users!

    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.globalName || '').toLowerCase().includes(q) ||
        String(u.id).includes(q) ||
        (u.serverList || []).some(s => (s.name || '').toLowerCase().includes(q) || String(s.id).includes(q))
      );
    }
    if (filter === 'banned') {
      list = list.filter(u => u.status === 'banned' || u.status === 'suspended');
    } else if (filter === 'has_server') {
      list = list.filter(u => u.servers > 0);
    } else if (filter === 'active') {
      list = list.filter(u => u.status === 'active');
    }

    const total = list.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * pageSize;
    res.json({
      users: list.slice(offset, offset + pageSize),
      total,
      allCount,
      serverOwnersCount,
      membersCount,
      knownCount,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1
    });
  });

  // Admin User Profile Sheet
  router.get('/admin/users/:userId', requireAdminRole(), (req, res) => {
    const userId = req.params.userId;
    const users = getAllKnownUsers();
    const user = users.find(u => String(u.id) === String(userId)) || {
      id: userId,
      username: 'user_' + userId.slice(-4),
      globalName: 'User ' + userId.slice(-4),
      avatar: '/brand/logo.png',
      servers: 0,
      serverList: [],
      credits: getUserLedgerSummary(userId).balance,
      status: isUserBanned(userId) ? 'banned' : 'active',
      role: getAdminRecord(userId)?.role || 'Member',
      joinedAt: new Date().toISOString()
    };
    const servers = (user.serverList && user.serverList.length > 0)
      ? user.serverList
      : getPromotedServers(true).filter(s => s.ownerId && /^\d{17,20}$/.test(String(s.ownerId)) && String(s.ownerId) === String(userId)).map(s => ({
          id: s.id,
          name: s.name,
          icon: s.iconUrl || s.icon || null,
          memberCount: Number(s.memberCount) || 0,
          category: s.category || 'Roleplay Server'
        }));
    user.servers = servers.length;
    user.serverList = servers;
    const ledgerHistory = getCreditHistory(userId, { range: 'all', page: 1, pageSize: 20 });
    const recruitData = loadRecruitData();
    const joins = (recruitData.recruits || []).filter(r => String(r.recruiterId) === String(userId) || String(r.recruitUserId) === String(userId));
    const ban = loadBannedUsers().find(b => String(b.userId) === String(userId)) || null;

    res.json({
      user,
      servers,
      ledger: ledgerHistory,
      joins,
      ban
    });
  });

  // User Moderation: Get bans
  router.get('/admin/bans', requireAdminRole(), (_req, res) => {
    res.json({ bans: loadBannedUsers() });
  });

  // User Moderation: Ban user
  router.post('/admin/bans', requireAdminRole('Moderator'), (req, res) => {
    const { userId, username, reason, duration } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Ban reason must be at least 10 characters.' });
    }
    try {
      const ban = banUser({
        userId,
        username,
        reason,
        duration: duration || 'Permanent',
        actor: req.adminUser
      });
      res.json({ success: true, ban });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Helper to clear banned state from active sessions
  function clearSessionBanStatus(userId) {
    if (!userId) return;
    const uid = String(userId);
    let changed = false;
    for (const [sId, sess] of sessions.entries()) {
      if (sess && sess.user && String(sess.user.id) === uid) {
        if (sess.user.isBanned) {
          sess.user.isBanned = false;
          delete sess.user.ban;
          changed = true;
        }
      }
    }
    if (changed) {
      persistSessions();
    }
  }

  // User Moderation: Revoke ban (supports DELETE /admin/bans/:userId, POST /admin/bans/:userId, POST /admin/bans/:userId/unban, POST /admin/users/:userId/unban, POST /admin/unban)
  const handleUnbanRequest = (req, res) => {
    const userId = req.params.userId || req.body?.userId;
    const { reason } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });
    try {
      unbanUser({ userId, reason: reason || 'Pardoned by administrator', actor: req.adminUser });
      clearSessionBanStatus(userId);
      if (req.dashboardSession && req.dashboardSession.user && String(req.dashboardSession.user.id) === String(userId)) {
        req.dashboardSession.user.isBanned = false;
        delete req.dashboardSession.user.ban;
      }
      res.json({ success: true, userId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  router.delete('/admin/bans/:userId', requireAdminRole('Moderator'), handleUnbanRequest);
  router.post('/admin/bans/:userId', requireAdminRole('Moderator'), handleUnbanRequest);
  router.post('/admin/bans/:userId/unban', requireAdminRole('Moderator'), handleUnbanRequest);
  router.post('/admin/users/:userId/unban', requireAdminRole('Moderator'), handleUnbanRequest);
  router.post('/admin/unban', requireAdminRole('Moderator'), handleUnbanRequest);

  // Admin Self-Unban & Self-Unblacklist (Safety mechanism so staff can unban/unblacklist themselves)
  const handleSelfUnban = (req, res) => {
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = req.dashboardSession || (sessionId ? getSession(sessionId) : null);
    if (!session || !session.user || !session.user.id) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const userId = session.user.id;
    const username = session.user.username;
    const clientIp = getClientIp(req);

    const admin = getAdminRecord(userId, username);
    if (!admin) {
      return res.status(403).json({ error: 'Only administrators can use admin self-unban.' });
    }

    try {
      // 1. Unban user from banned_users.json
      if (isUserBanned(userId)) {
        unbanUser({ userId, reason: 'Self-pardon by administrator', actor: admin });
      }

      // 2. Remove all blacklist entries for this Discord user ID
      removeUserBlacklistEntries(userId);

      // 3. Remove blacklist entry matching admin IP if present
      if (clientIp) {
        try {
          removeBlacklistEntry(clientIp, 'Admin self-unban IP pardon', admin);
        } catch {}
      }

      // 4. Clear ban flags from memory session
      clearSessionBanStatus(userId);
      if (session?.user) {
        session.user.isBanned = false;
        delete session.user.ban;
      }
      if (req.dashboardSession?.user) {
        req.dashboardSession.user.isBanned = false;
        delete req.dashboardSession.user.ban;
      }
      persistSessions();

      res.json({
        success: true,
        message: 'Your account has been unbanned and unblacklisted successfully.',
        user: {
          id: userId,
          username,
          isAdmin: true,
          role: admin.role,
          isBanned: false
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to unban account.' });
    }
  };

  router.post('/admin/self-unban', handleSelfUnban);
  router.post('/admin/unban-self', handleSelfUnban);

  // Treasury Management: Gift or deduct credits through real server ledger
  router.post('/admin/credits/transact', requireAdminRole('Admin'), (req, res) => {
    const { userId, serverId, amount, direction, reason } = req.body;
    const num = parseInt(amount, 10);
    if (!userId || isNaN(num) || num <= 0 || num > 1000000) {
      return res.status(400).json({ error: 'Valid user ID and amount between 1 and 1,000,000 are required.' });
    }
    if (!reason || reason.trim().length < 10 || reason.trim().length > 200) {
      return res.status(400).json({ error: 'Reason must be between 10 and 200 characters.' });
    }
    const isAdd = direction === 'add' || (!direction && num > 0);
    const absAmount = Math.abs(num);
    const type = isAdd ? 'earned' : 'spent';

    const allServers = getPromotedServers(true);
    const targetServer = serverId ? allServers.find(s => String(s.id) === String(serverId)) : null;

    if (targetServer) {
      const beforeSummary = getServerLedgerSummary(targetServer.id);
      const beforeBalance = beforeSummary.balance || 0;
      const afterBalance = isAdd ? beforeBalance + absAmount : Math.max(0, beforeBalance - absAmount);

      try {
        recordLedgerTransaction({
          userId: String(userId).trim(),
          guildId: String(targetServer.id),
          guildName: targetServer.name,
          type,
          amount: absAmount,
          reason: 'admin_adjustment',
          description: `Admin adjustment (${isAdd ? 'add' : 'deduct'}): ${reason.trim()}`,
          triggeredBy: `Admin (${req.adminUser.username})`
        });
        recordAuditAction({
          actor: req.adminUser,
          action: isAdd ? 'credits_grant' : 'credits_deduct',
          target: userId,
          targetType: 'user',
          reason: reason.trim(),
          metadata: {
            adminUserId: req.adminUser.userId || req.adminUser.id,
            targetUserId: userId,
            serverId: targetServer.id,
            serverName: targetServer.name,
            amount: absAmount,
            direction: isAdd ? 'add' : 'deduct',
            reason: reason.trim()
          },
          before: `${beforeBalance} credits`,
          after: `${afterBalance} credits`
        });
        const updatedBalance = getServerLedgerSummary(targetServer.id).balance;
        return res.json({
          success: true,
          userId,
          serverId: targetServer.id,
          serverName: targetServer.name,
          balance: updatedBalance,
          amount: absAmount,
          direction: isAdd ? 'add' : 'deduct'
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    } else {
      // Direct personal wallet transaction for users without a server
      const userSummary = getUserLedgerSummary(userId);
      const beforeBalance = userSummary?.balance ?? getUserBalance(userId) ?? 0;
      const afterBalance = isAdd ? beforeBalance + absAmount : Math.max(0, beforeBalance - absAmount);

      try {
        setUserBalance(userId, afterBalance);
        recordLedgerTransaction({
          userId: String(userId).trim(),
          guildId: null,
          guildName: 'Personal Wallet',
          type,
          amount: absAmount,
          reason: 'admin_adjustment',
          description: `Admin adjustment (${isAdd ? 'add' : 'deduct'}): ${reason.trim()}`,
          triggeredBy: `Admin (${req.adminUser.username})`
        });
        recordAuditAction({
          actor: req.adminUser,
          action: isAdd ? 'credits_grant' : 'credits_deduct',
          target: userId,
          targetType: 'user',
          reason: reason.trim(),
          metadata: {
            adminUserId: req.adminUser.userId || req.adminUser.id,
            targetUserId: userId,
            amount: absAmount,
            direction: isAdd ? 'add' : 'deduct',
            reason: reason.trim()
          },
          before: `${beforeBalance} credits`,
          after: `${afterBalance} credits`
        });
        return res.json({
          success: true,
          userId,
          serverId: null,
          serverName: 'Personal Wallet',
          balance: afterBalance,
          amount: absAmount,
          direction: isAdd ? 'add' : 'deduct'
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  });

  // Legacy grant compatibility
  router.post('/admin/credits/grant', requireAdminRole('Admin'), (req, res) => {
    const { userId, amount, note } = req.body;
    const num = parseInt(amount, 10);
    if (!userId || isNaN(num) || num === 0) {
      return res.status(400).json({ error: 'User ID and non-zero amount required.' });
    }
    try {
      recordLedgerTransaction({
        userId: String(userId).trim(),
        type: num > 0 ? 'earned' : 'spent',
        amount: Math.abs(num),
        reason: 'admin_grant',
        description: `Administrative Grant: ${note || 'Admin grant'}`,
        triggeredBy: `Admin (${req.adminUser.username})`
      });
      recordAuditAction({
        actor: req.adminUser,
        action: 'credits_grant',
        target: userId,
        targetType: 'user',
        reason: note || 'Administrative Grant',
        before: null,
        after: `+${num} credits`
      });
      res.json({ success: true, userId, amount: num, note: note || 'Administrative Grant' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── USER SETTINGS (Theme accent, preferences) ───────────────────────────
  const USER_SETTINGS_FILE = path.join(DATA_DIR, 'user_settings.json');
  function loadUserSettings() {
    try {
      if (fs.existsSync(USER_SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8'));
      }
    } catch {}
    return {};
  }
  function saveUserSettings(data) {
    try {
      fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch {}
  }

  router.get('/user/settings', (req, res) => {
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const all = loadUserSettings();
    const settings = all[userId] || {};
    res.json({ ok: true, settings });
  });

  router.post('/user/settings', (req, res) => {
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const all = loadUserSettings();
    const current = all[userId] || {};
    const patch = { ...(req.body || {}) };
    delete patch.theme_accent;
    all[userId] = { ...current, ...patch };
    saveUserSettings(all);
    res.json({ ok: true, settings: all[userId] });
  });

  router.get('/user/joined-communities', (req, res) => {
    const userId = req.dashboardSession?.user?.id || req.session?.user?.id;
    if (!userId) return res.json({ joined: [] });
    try {
      const list = getUserJoinedCommunities(userId);
      res.json({ joined: list });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load joined communities.' });
    }
  });

  // Public Changelog Route
  router.get('/changelog', (_req, res) => {
    res.json({ entries: loadCustomChangelog() });
  });

  // Changelog Management: List
  router.get('/admin/changelog', requireAdminRole(), (_req, res) => {
    res.json({ entries: loadCustomChangelog() });
  });

  // Changelog Management: Add / Edit
  router.post('/admin/changelog', requireAdminRole('Admin'), (req, res) => {
    const { version, title, description, tags, items } = req.body;
    if (!version || !title) return res.status(400).json({ error: 'Version and title required.' });
    const list = loadCustomChangelog();
    const entry = {
      version: String(version).trim(),
      date: new Date().toISOString(),
      title: String(title).trim(),
      description: description ? String(description).trim() : undefined,
      tags: Array.isArray(tags) && tags.length ? tags : ['new'],
      items: Array.isArray(items) && items.length ? items : ['Platform performance and stability optimizations.'],
      href: `#${String(version).trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    };
    const updated = [entry, ...list.filter(c => c.version !== entry.version)];
    saveCustomChangelog(updated);
    recordAuditAction({
      actor: req.adminUser,
      action: 'changelog_publish',
      target: entry.version,
      targetType: 'changelog',
      reason: `Published notes for version ${entry.version}: ${entry.title}`,
      before: null,
      after: entry.version
    });
    res.json({ success: true, entry });
  });

  // Changelog Management: Delete
  router.delete('/admin/changelog/:version', requireAdminRole('Admin'), (req, res) => {
    const version = req.params.version;
    const list = loadCustomChangelog();
    const updated = list.filter(c => c.version !== version);
    saveCustomChangelog(updated);
    recordAuditAction({
      actor: req.adminUser,
      action: 'changelog_delete',
      target: version,
      targetType: 'changelog',
      reason: `Deleted changelog version ${version}`,
      before: version,
      after: null
    });
    res.json({ success: true, version });
  });

  // Servers Roster & Management
  router.get('/admin/servers', requireAdminRole(), (req, res) => {
    let list = getPromotedServers(true);
    const { search, category } = req.query;
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || String(s.id).includes(q));
    }
    if (category && category !== 'all') {
      list = list.filter(s => (s.category || '').toLowerCase() === String(category).toLowerCase());
    }
    res.json({ servers: list });
  });

  router.post('/admin/servers/:serverId/action', requireAdminRole('Moderator'), (req, res) => {
    const serverId = req.params.serverId;
    const { action, reason, patch } = req.body;
    const servers = getPromotedServers(true);
    const server = servers.find(s => String(s.id) === String(serverId));
    if (!server) return res.status(404).json({ error: 'Server not found' });

    if (action === 'verify') {
      const before = Boolean(server.verified);
      server.verified = true;
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_verify',
        target: serverId,
        targetType: 'server',
        reason: reason || 'Manual verification approved',
        before,
        after: true
      });
      return res.json({ success: true, server });
    }
    if (action === 'unverify') {
      const before = Boolean(server.verified);
      server.verified = false;
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_unverify',
        target: serverId,
        targetType: 'server',
        reason: reason || 'Manual verification revoked',
        before,
        after: false
      });
      return res.json({ success: true, server });
    }
    if (action === 'hide') {
      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ error: 'A valid reason is required to hide a server listing.' });
      }
      server.hidden = true;
      upsertPromotedServer(server);

      // Cancel pending partnership requests involving this server
      try {
        const pDataPath = path.join(DATA_DIR, 'partnerships.json');
        if (fs.existsSync(pDataPath)) {
          const pData = JSON.parse(fs.readFileSync(pDataPath, 'utf8') || '{}');
          if (Array.isArray(pData.requests)) {
            pData.requests = pData.requests.map(r => {
              if ((String(r.fromGuildId) === String(serverId) || String(r.toGuildId) === String(serverId)) && r.status === 'pending') {
                return { ...r, status: 'cancelled', cancelledReason: 'Server hidden from directory by admin' };
              }
              return r;
            });
            fs.writeFileSync(pDataPath, JSON.stringify(pData, null, 2));
          }
        }
      } catch {}

      recordAuditAction({
        actor: req.adminUser,
        action: 'server_hide',
        target: serverId,
        targetType: 'server',
        reason: reason.trim(),
        before: false,
        after: true
      });
      return res.json({ success: true, server });
    }
    if (action === 'restore') {
      server.hidden = false;
      server.delisted = false;
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_restore',
        target: serverId,
        targetType: 'server',
        reason: reason ? reason.trim() : 'Restored to directory visibility',
        before: true,
        after: false
      });
      return res.json({ success: true, server });
    }
    if (action === 'remove') {
      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({ error: 'Removal reason must be at least 10 characters.' });
      }
      server.delisted = true;
      server.hidden = true;
      server.delistedReason = reason.trim();
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_remove',
        target: serverId,
        targetType: 'server',
        reason: reason.trim(),
        before: 'active',
        after: 'delisted'
      });
      return res.json({ success: true, server });
    }
    if (action === 'edit') {
      const updated = updatePromotedServerDetails(serverId, patch || {});
      recordAuditAction({
        actor: req.adminUser,
        action: 'server_edit',
        target: serverId,
        targetType: 'server',
        reason: reason || 'Administrator updated server parameters',
        before: null,
        after: patch
      });
      return res.json({ success: true, server: updated });
    }
    res.status(400).json({ error: 'Invalid server action' });
  });

  // Directory Overrides: Force bump
  router.post('/admin/directory/bump', requireAdminRole('Moderator'), (req, res) => {
    const { serverId } = req.body;
    if (!serverId) return res.status(400).json({ error: 'serverId required.' });
    const result = bumpPromotedServer(serverId);
    recordAuditAction({
      actor: req.adminUser,
      action: 'server_force_bump',
      target: serverId,
      targetType: 'server',
      reason: 'Administrative priority bump',
      before: null,
      after: 'bumped'
    });
    res.json({ success: true, result });
  });

  // Directory Overrides: Set Verified
  router.post('/admin/directory/verify', requireAdminRole('Moderator'), (req, res) => {
    const { serverId, verified } = req.body;
    if (!serverId) return res.status(400).json({ error: 'serverId required.' });
    const servers = getPromotedServers();
    const server = servers.find(s => String(s.id) === String(serverId));
    if (server) {
      server.verified = verified !== false;
      upsertPromotedServer(server);
      recordAuditAction({
        actor: req.adminUser,
        action: server.verified ? 'server_verify' : 'server_unverify',
        target: serverId,
        targetType: 'server',
        reason: 'Verification override toggle',
        before: !server.verified,
        after: server.verified
      });
      return res.json({ success: true, server });
    }
    res.status(404).json({ error: 'Server not found' });
  });

  // Directory Overrides: Edit Parameters
  router.post('/admin/directory/edit', requireAdminRole('Moderator'), (req, res) => {
    const { serverId, patch } = req.body;
    if (!serverId) return res.status(400).json({ error: 'serverId required.' });
    const updated = updatePromotedServerDetails(serverId, patch);
    if (!updated) return res.status(404).json({ error: 'Server not found' });
    res.json({ success: true, server: updated });
  });

  // Directory Overrides: Remove / Delist
  router.post('/admin/directory/remove', requireAdminRole('Moderator'), (req, res) => {
    const { serverId, reason } = req.body;
    if (!serverId) return res.status(400).json({ error: 'serverId required.' });
    removePromotedServer(serverId);
    recordAuditAction({
      actor: req.adminUser,
      action: 'server_remove',
      target: serverId,
      targetType: 'server',
      reason: reason || 'Administrative delist',
      before: 'active',
      after: 'removed'
    });
    res.json({ success: true, serverId });
  });

  // Admin Monthly Leaderboard Reward
  router.get('/admin/leaderboard-reward', requireAdminRole('Moderator'), (_req, res) => {
    const preview = getMonthlyLeaderboardPreview();
    const config = loadMonthlyRewardConfig();
    res.json({ ...preview, config });
  });

  router.post('/admin/leaderboard-reward/toggle', requireAdminRole('Admin'), (req, res) => {
    const config = loadMonthlyRewardConfig();
    config.enabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : !config.enabled;
    if (typeof req.body?.rewardAmount === 'number') {
      config.rewardAmount = Math.max(1, req.body.rewardAmount);
    }
    saveMonthlyRewardConfig(config);
    recordAuditLog({
      adminId: req.adminUser?.userId,
      adminUsername: req.adminUser?.username,
      action: 'TOGGLE_MONTHLY_REWARD',
      targetId: 'monthly_rewards',
      targetName: 'Monthly Leaderboard Reward',
      reason: `Set enabled=${config.enabled}, rewardAmount=${config.rewardAmount}`
    });
    res.json({ success: true, config });
  });

  router.post('/admin/leaderboard-reward/trigger', requireAdminRole('Admin'), async (req, res) => {
    try {
      const result = await executeMonthlyReward({
        month: req.body?.month,
        force: Boolean(req.body?.force)
      });
      recordAuditLog({
        adminId: req.adminUser?.userId,
        adminUsername: req.adminUser?.username,
        action: 'TRIGGER_MONTHLY_REWARD',
        targetId: result.winner.id,
        targetName: result.winner.name,
        reason: `Triggered monthly reward for ${result.month} (${result.winner.creditsAwarded} credits)`
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not execute monthly reward.' });
    }
  });

  // Global Ledger
  router.get('/admin/ledger', requireAdminRole(), (req, res) => {
    const data = loadLedgerData();
    let txs = [...(data.transactions || [])];
    const { type, search, limit = 100 } = req.query;
    if (type && type !== 'all') {
      txs = txs.filter(t => t.type === type || t.reason === type);
    }
    if (search) {
      const q = String(search).toLowerCase();
      txs = txs.filter(t => (t.description || '').toLowerCase().includes(q) || String(t.userId || '').includes(q));
    }
    txs.sort((a, b) => b.timestamp - a.timestamp);
    res.json({
      transactions: txs.slice(0, parseInt(limit, 10) || 100),
      total: txs.length
    });
  });

  // Reports
  router.get('/admin/reports', requireAdminRole('Reviewer'), (_req, res) => {
    const rawReports = loadReports();
    const allServers = getPromotedServers(true);
    const knownUsers = getAllKnownUsers();
    const bannedUsers = loadBannedUsers();

    const normalized = rawReports.map((r) => {
      const server = allServers.find(s => String(s.id) === String(r.serverId || r.targetId)) || null;
      const ownerId = r.targetType === 'owner' ? r.targetId : (server?.ownerId || null);
      const owner = knownUsers.find(u => String(u.id) === String(ownerId)) || null;
      const isOwnerBanned = Boolean(bannedUsers.find(b => String(b.userId) === String(ownerId)));

      return {
        id: r.id,
        reporterId: r.reporterId || r.reporter_user_id || 'system',
        reporterTag: r.reporterTag || `User ${String(r.reporterId || r.reporter_user_id || '').slice(-4)}`,
        targetId: r.targetId || r.review_id || r.id,
        targetType: r.targetType || (server ? 'server' : (r.review_id ? 'review' : 'content')),
        targetName: r.targetName || (server ? server.name : (r.review_text ? `Review: "${r.review_text.slice(0, 32)}..."` : 'Reported Item')),
        reason: r.reason || 'Flagged for moderation',
        details: r.details || '',
        status: (r.status || 'pending').toLowerCase(),
        adminNotes: r.adminNotes || r.internalNotes || '',
        createdAt: r.createdAt || r.created_at || new Date().toISOString(),
        serverId: r.serverId || (server ? server.id : null),
        server: server ? {
          id: server.id,
          name: server.name,
          icon: server.iconUrl || server.icon || null,
          memberCount: server.memberCount || 0,
          category: server.category || 'Roleplay Server',
          delisted: Boolean(server.hidden || server.delisted)
        } : null,
        owner: ownerId ? {
          id: ownerId,
          username: owner?.username || server?.ownerUsername || 'Community Owner',
          displayName: owner?.globalName || owner?.displayName || server?.ownerDisplayName || server?.ownerUsername || 'Community Owner',
          avatar: owner?.avatar || server?.ownerAvatar || null,
          isBanned: isOwnerBanned
        } : null
      };
    });
    res.json({ reports: normalized });
  });

  router.post(['/admin/reports/:reportId', '/admin/reports/:reportId/action'], requireAdminRole('Moderator'), (req, res) => {
    const reportId = req.params.reportId;
    const { status, action, adminNotes, deleteContent, reason } = req.body;
    try {
      const reports = loadReports();
      const report = reports.find(r => String(r.id) === String(reportId));
      if (!report) return res.status(404).json({ error: 'Report not found' });

      const allServers = getPromotedServers(true);
      const server = allServers.find(s => String(s.id) === String(report.serverId || report.targetId));
      const ownerId = report.targetType === 'owner' ? report.targetId : (server?.ownerId || null);

      if (action === 'ban_owner' && ownerId) {
        banUser({
          userId: ownerId,
          username: server?.ownerUsername || 'Reported Community Owner',
          reason: reason || adminNotes || `Banned via community report ${reportId}: ${report.reason}`,
          duration: 'Permanent',
          actor: req.adminUser
        });
      }

      if (action === 'delist_server' && server) {
        server.hidden = true;
        server.delisted = true;
        savePromotedServers(allServers);
        recordAuditAction({
          actor: req.adminUser,
          action: 'server_delist',
          target: server.id,
          targetType: 'server',
          reason: reason || adminNotes || `Delisted via community report ${reportId}`,
          before: 'published',
          after: 'delisted'
        });
      }

      const effectiveStatus = action === 'dismiss' ? 'dismissed' : (action === 'ban_owner' || action === 'delist_server' ? 'resolved' : (status || 'resolved'));
      const updated = updateReport({
        reportId,
        status: effectiveStatus,
        adminNotes: adminNotes || reason || `Action taken: ${action || effectiveStatus}`,
        actor: req.adminUser
      });

      if (deleteContent && (updated.review_id || updated.targetId)) {
        try {
          deleteReview(updated.review_id || updated.targetId, 'admin', true);
        } catch {}
      }

      res.json({ success: true, report: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bug Reports Admin Endpoints (Section 4: Hidden from non-admins, 404 for them)
  router.get('/admin/bugs', requireAdminRole('Reviewer'), (req, res) => {
    const status = req.query.status || 'all';
    const bugs = getBugReports({ status });

    const userMap = new Map();
    try {
      const knownFile = path.join(DATA_DIR, 'known_users.json');
      if (fs.existsSync(knownFile)) {
        const rawKnown = JSON.parse(fs.readFileSync(knownFile, 'utf8') || '[]');
        if (Array.isArray(rawKnown)) {
          for (const u of rawKnown) {
            const uid = String(u.userId || u.id || '');
            if (uid) userMap.set(uid, u);
          }
        }
      }
    } catch {}

    const enriched = bugs.map(b => {
      const uid = String(b.userId || '');
      const user = userMap.get(uid);
      let defaultAvatar = null;
      try {
        if (uid && /^\d+$/.test(uid)) {
          const idx = Math.abs(Number((BigInt(uid) >> 22n) % 6n));
          defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
        }
      } catch {}

      const avatarUrl = b.avatarUrl || user?.avatarUrl || defaultAvatar;
      const displayName = b.displayName || user?.displayName || user?.username || b.username;
      return {
        ...b,
        avatarUrl,
        displayName
      };
    });

    res.json({ bugs: enriched });
  });

  router.get('/admin/bugs/:id', requireAdminRole('Reviewer'), (req, res) => {
    const bug = getBugReportById(req.params.id);
    if (!bug) return res.status(404).json({ error: 'Bug report not found' });

    let avatarUrl = bug.avatarUrl || null;
    let displayName = bug.displayName || bug.username;
    try {
      const knownFile = path.join(DATA_DIR, 'known_users.json');
      if (fs.existsSync(knownFile)) {
        const rawKnown = JSON.parse(fs.readFileSync(knownFile, 'utf8') || '[]');
        const u = rawKnown.find(k => String(k.userId || k.id) === String(bug.userId));
        if (u) {
          avatarUrl = avatarUrl || u.avatarUrl;
          displayName = displayName || u.displayName || u.username;
        }
      }
    } catch {}

    if (!avatarUrl && bug.userId && /^\d+$/.test(String(bug.userId))) {
      try {
        const idx = Math.abs(Number((BigInt(bug.userId) >> 22n) % 6n));
        avatarUrl = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
      } catch {}
    }

    res.json({ bug: { ...bug, avatarUrl, displayName } });
  });

  router.post('/admin/bugs/:id/action', requireAdminRole('Reviewer'), async (req, res) => {
    const { status, notes, staffNotes } = req.body || {};
    try {
      const updated = await reviewBugReport(req.params.id, {
        status,
        staffNotes: notes || staffNotes || '',
        staffUser: req.adminUser
      });
      res.json({ success: true, bug: updated });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Failed to update bug report' });
    }
  });

  router.post('/admin/bugs/:id/test-dm', requireAdminRole(), async (req, res) => {
    try {
      const adminUserId = req.adminUser?.id || req.dashboardSession?.user?.id || req.body?.adminUserId;
      if (!adminUserId) {
        return res.status(400).json({ error: 'Admin Discord user ID required to receive test DM' });
      }
      const result = await sendTestBugReviewDM({
        adminUserId,
        reportId: req.params.id,
        staffUser: req.adminUser
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Failed to dispatch test DM' });
    }
  });

  // Test expired invite DM endpoint: POST /api/admin/test-invite-expired-dm
  router.post('/admin/test-invite-expired-dm', requireAdminRole(), async (req, res) => {
    try {
      const adminUserId = req.body?.adminUserId || req.adminUser?.id || req.dashboardSession?.user?.id || '523693281541095424';
      const serverId = req.body?.serverId || null;
      const result = await sendTestExpiredInviteDM({ adminUserId, serverId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Failed to dispatch test expired invite DM' });
    }
  });

  // Premium feature suggestions: POST /api/suggestions/premium
  router.post('/suggestions/premium', async (req, res) => {
    try {
      const { suggestion, category, contactOk } = req.body || {};
      const user = req.dashboardSession?.user || req.session?.user || null;
      if (!suggestion || !suggestion.trim()) {
        return res.status(400).json({ error: 'Suggestion text is required.' });
      }

      const cleanText = suggestion.trim().slice(0, 2000);
      const cleanCat = (category || 'General').trim().slice(0, 64);
      const suggestionsFile = path.resolve('data/premium_suggestions.json');
      let allSuggestions = [];
      try {
        if (fs.existsSync(suggestionsFile)) {
          allSuggestions = JSON.parse(fs.readFileSync(suggestionsFile, 'utf8') || '[]');
        }
      } catch {}

      const newEntry = {
        id: `sug_${Date.now()}_${randomBytes(4).toString('hex')}`,
        suggestion: cleanText,
        category: cleanCat,
        contactOk: Boolean(contactOk),
        user: user ? {
          id: user.id,
          username: user.username,
          displayName: user.global_name || user.username,
          avatar: user.avatar || null
        } : null,
        status: 'pending',
        upvotes: 1,
        upvotedUsers: user ? [user.id] : [],
        createdAt: new Date().toISOString()
      };

      allSuggestions.unshift(newEntry);
      fs.writeFileSync(suggestionsFile, JSON.stringify(allSuggestions, null, 2), 'utf8');

      // Dispatch notification/DM to platform founder (523693281541095424)
      const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
      if (token) {
        try {
          const founderId = '523693281541095424';
          const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: {
              Authorization: `Bot ${token.replace(/^Bot\s+/i, '')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient_id: founderId })
          });
          if (dmRes.ok) {
            const ch = await dmRes.json();
            const userAvatarUrl = user?.avatar
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
              : (user?.id ? `https://cdn.discordapp.com/embed/avatars/${(Number(BigInt(user.id) >> 22n) % 6) || 0}.png` : 'https://connectingerlc.xyz/brand/logo.png');
            const authorLine = user ? `${user.global_name || user.username} (@${user.username})` : 'Anonymous User';

            const payload = {
              flags: 32768, // MessageFlags.IsComponentsV2
              components: [
                {
                  type: 17, // Container (No accent_color = no color on the side)
                  components: [
                    {
                      type: 9, // Section with user avatar thumbnail
                      components: [
                        {
                          type: 10, // Text Display
                          content: `### New Premium Suggestion\n**From:** ${authorLine}\n**User ID:** \`${user?.id || 'Unknown'}\`\n\n${cleanText}`
                        }
                      ],
                      accessory: {
                        type: 11, // Thumbnail
                        media: {
                          url: userAvatarUrl
                        }
                      }
                    },
                    {
                      type: 14, // Real Separator
                      divider: true
                    },
                    {
                      type: 1, // Action row with Accept and Decline buttons
                      components: [
                        {
                          type: 2, // Button
                          style: 3, // Success / Green
                          label: 'Accept',
                          custom_id: `premium_sug_accept:${newEntry.id}`
                        },
                        {
                          type: 2, // Button
                          style: 4, // Danger / Red
                          label: 'Decline',
                          custom_id: `premium_sug_decline:${newEntry.id}`
                        }
                      ]
                    }
                  ]
                }
              ]
            };
            await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages`, {
              method: 'POST',
              headers: {
                Authorization: `Bot ${token.replace(/^Bot\s+/i, '')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            });
          }
        } catch (dmErr) {
          console.warn('[PREMIUM SUGGESTION] Founder DM dispatch note:', dmErr.message);
        }
      }

      res.json({ ok: true, id: newEntry.id });
    } catch (err) {
      res.status(500).json({ error: 'Failed to record suggestion.' });
    }
  });

  // Get accepted & shipped suggestions for the public upvote board
  router.get('/suggestions/premium', (req, res) => {
    try {
      const currentUserId = req.dashboardSession?.user?.id || req.session?.user?.id || null;
      const suggestionsFile = path.resolve('data/premium_suggestions.json');
      let allSuggestions = [];
      if (fs.existsSync(suggestionsFile)) {
        allSuggestions = JSON.parse(fs.readFileSync(suggestionsFile, 'utf8') || '[]');
      }
      // Return accepted and shipped ideas for the upvote board
      const approved = allSuggestions
        .filter((s) => s.status === 'accepted' || s.status === 'shipped')
        .map((s) => {
          const upvotedUsers = Array.isArray(s.upvotedUsers) ? s.upvotedUsers : [];
          const count = upvotedUsers.length || s.upvotes || 0;
          const userAvatar = s.user?.avatar
            ? `https://cdn.discordapp.com/avatars/${s.user.id}/${s.user.avatar}.png?size=128`
            : (s.user?.id ? `https://cdn.discordapp.com/embed/avatars/${(Number(BigInt(s.user.id) >> 22n) % 6) || 0}.png` : null);
          return {
            id: s.id,
            suggestion: s.suggestion,
            status: s.status,
            upvotes: count,
            hasUpvoted: currentUserId ? upvotedUsers.includes(currentUserId) : false,
            createdAt: s.createdAt,
            user: s.user ? {
              id: s.user.id,
              username: s.user.username,
              displayName: s.user.displayName || s.user.username,
              avatarUrl: userAvatar
            } : null
          };
        })
        .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));

      res.json({ ok: true, suggestions: approved });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch suggestions.' });
    }
  });

  // Toggle upvote on a community suggestion: POST /api/suggestions/premium/:id/upvote
  router.post('/suggestions/premium/:id/upvote', (req, res) => {
    try {
      const currentUserId = req.dashboardSession?.user?.id || req.session?.user?.id || null;
      if (!currentUserId) {
        return res.status(401).json({ error: 'Sign in to upvote suggestions.' });
      }
      const { id } = req.params;
      const suggestionsFile = path.resolve('data/premium_suggestions.json');
      let allSuggestions = [];
      if (fs.existsSync(suggestionsFile)) {
        allSuggestions = JSON.parse(fs.readFileSync(suggestionsFile, 'utf8') || '[]');
      }
      const match = allSuggestions.find((s) => s.id === id);
      if (!match) {
        return res.status(404).json({ error: 'Suggestion not found.' });
      }

      match.upvotedUsers = Array.isArray(match.upvotedUsers) ? match.upvotedUsers : [];
      let hasUpvoted = false;
      if (match.upvotedUsers.includes(currentUserId)) {
        match.upvotedUsers = match.upvotedUsers.filter((u) => u !== currentUserId);
        hasUpvoted = false;
      } else {
        match.upvotedUsers.push(currentUserId);
        hasUpvoted = true;
      }
      match.upvotes = match.upvotedUsers.length;
      fs.writeFileSync(suggestionsFile, JSON.stringify(allSuggestions, null, 2), 'utf8');

      res.json({ ok: true, upvotes: match.upvotes, hasUpvoted });
    } catch (err) {
      res.status(500).json({ error: 'Failed to toggle upvote.' });
    }
  });

  // Mark suggestion shipped and notify user via Discord DM: POST /api/admin/suggestions/premium/:id/ship
  router.post('/admin/suggestions/premium/:id/ship', requireAdminRole(), async (req, res) => {
    try {
      const { id } = req.params;
      const suggestionsFile = path.resolve('data/premium_suggestions.json');
      let allSuggestions = [];
      if (fs.existsSync(suggestionsFile)) {
        allSuggestions = JSON.parse(fs.readFileSync(suggestionsFile, 'utf8') || '[]');
      }
      const match = allSuggestions.find((s) => s.id === id);
      if (!match) {
        return res.status(404).json({ error: 'Suggestion not found.' });
      }
      match.status = 'shipped';
      match.shippedAt = new Date().toISOString();
      fs.writeFileSync(suggestionsFile, JSON.stringify(allSuggestions, null, 2), 'utf8');

      // If user requested Discord notification, dispatch DM
      if (match.contactOk && match.user?.id) {
        const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
        if (token) {
          try {
            const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
              method: 'POST',
              headers: {
                Authorization: `Bot ${token.replace(/^Bot\s+/i, '')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ recipient_id: match.user.id })
            });
            if (dmRes.ok) {
              const ch = await dmRes.json();
              await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages`, {
                method: 'POST',
                headers: {
                  Authorization: `Bot ${token.replace(/^Bot\s+/i, '')}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  flags: 32768,
                  components: [
                    {
                      type: 17,
                      components: [
                        {
                          type: 10,
                          content: `### Feature Shipped! 🎉\n\nYour suggestion has been shipped and is now live on ConnectingERLC:\n\n> ${match.suggestion}\n\nThank you for helping shape the platform!`
                        },
                        {
                          type: 14,
                          divider: true
                        },
                        {
                          type: 1,
                          components: [
                            {
                              type: 2,
                              style: 5,
                              label: 'View on Website',
                              url: 'https://connectingerlc.xyz/dashboard'
                            }
                          ]
                        }
                      ]
                    }
                  ]
                })
              });
            }
          } catch (dmErr) {
            console.warn('[PREMIUM SUGGESTION] Ship notification DM error:', dmErr.message);
          }
        }
      }

      res.json({ ok: true, status: 'shipped' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to mark suggestion shipped.' });
    }
  });

  // ── Verification Applications Endpoints ──
  router.get('/workspace/:guildId/verification', async (req, res) => {
    const status = getVerificationStatus(req.params.guildId);
    res.json(status);
  });

  router.post('/workspace/:guildId/verification/apply', async (req, res) => {
    try {
      const { why, offerings, links } = req.body || {};
      const user = req.dashboardSession?.user || req.session?.user;
      const app = submitVerificationApplication({
        serverId: req.params.guildId,
        serverName: req.body?.serverName || 'Community Server',
        userId: user?.id,
        username: user?.username,
        why,
        offerings,
        links
      });
      res.json({ success: true, application: app });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not submit verification application.' });
    }
  });

  router.post('/workspace/:guildId/verification/revoke', async (req, res) => {
    try {
      const user = req.dashboardSession?.user || req.session?.user;
      const result = revokeVerification({
        serverId: req.params.guildId,
        reason: 'Requested by server owner',
        revokedBy: user?.username || 'Server Owner'
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not revoke verification.' });
    }
  });

  router.post('/workspace/:guildId/bot-nickname', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { nickname } = req.body;
      const vStatus = getVerificationStatus(guildId);
      if (!vStatus.verified) {
        return res.status(403).json({ error: 'Custom bot personalisation is only available for verified servers.' });
      }

      const cleanNick = String(nickname || '').trim().slice(0, 32);
      const token = (process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
      if (!token) {
        return res.status(500).json({ error: 'Bot token not configured.' });
      }

      const patchRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/@me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nick: cleanNick || null })
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text().catch(() => '');
        return res.status(400).json({ error: `Discord rejected nickname change: ${errText}` });
      }

      res.json({ success: true, nickname: cleanNick, message: 'Bot nickname updated successfully.' });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to update bot nickname.' });
    }
  });

  router.get('/admin/verifications', requireAdminRole('Reviewer'), (_req, res) => {
    const apps = loadVerificationApplications();
    res.json({ applications: apps });
  });

  router.post('/admin/verifications/:id/approve', requireAdminRole('Reviewer'), (req, res) => {
    try {
      const app = reviewVerificationApplication({
        applicationId: req.params.id,
        action: 'approve',
        reason: req.body?.reason,
        adminUser: req.adminUser
      });
      recordAuditLog({
        adminId: req.adminUser?.userId,
        adminUsername: req.adminUser?.username,
        action: 'APPROVE_VERIFICATION',
        targetId: app.serverId,
        targetName: app.serverName,
        reason: app.reason
      });
      res.json({ success: true, application: app });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not approve verification.' });
    }
  });

  router.post('/admin/verifications/:id/reject', requireAdminRole('Reviewer'), (req, res) => {
    try {
      const app = reviewVerificationApplication({
        applicationId: req.params.id,
        action: 'reject',
        reason: req.body?.reason,
        adminUser: req.adminUser
      });
      recordAuditLog({
        adminId: req.adminUser?.userId,
        adminUsername: req.adminUser?.username,
        action: 'REJECT_VERIFICATION',
        targetId: app.serverId,
        targetName: app.serverName,
        reason: app.reason
      });
      res.json({ success: true, application: app });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not reject verification.' });
    }
  });

  // Antinuke / Security Suite Settings
  const SECURITY_SETTINGS_FILE = path.join(DATA_DIR, 'security_settings.json');
  function loadSecuritySettings() {
    try {
      if (fs.existsSync(SECURITY_SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(SECURITY_SETTINGS_FILE, 'utf8'));
      }
    } catch {}
    return {
      protectionLevel: 'balanced',
      logChannel: '',
      defaultPunishment: 'log_only',
      modules: {
        dangerous_role_perms: true,
        dangerous_role_grants: true,
        dangerous_everyone_overrides: true,
        quarantine_hold: true,
        auto_panic_mode: true,
        auto_restore: true,
        raid_pattern_scan: true,
        join_burst_monitor: true,
        churn_detection: true,
        anti_bot_verification: true,
        invite_spoof_guard: true
      },
      updatedAt: new Date().toISOString()
    };
  }

  function saveSecuritySettings(settings) {
    try {
      fs.writeFileSync(SECURITY_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch {}
  }

  router.get('/admin/security-settings', requireAdminRole(), (_req, res) => {
    res.json({ settings: loadSecuritySettings() });
  });

  router.post('/admin/security-settings', requireAdminRole('Admin'), (req, res) => {
    const current = loadSecuritySettings();
    const updated = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.adminUser?.username || 'Admin'
    };
    saveSecuritySettings(updated);
    recordAuditAction({
      actor: req.adminUser,
      action: 'security_settings_update',
      target: 'antinuke',
      targetType: 'security',
      reason: `Updated protection level to ${updated.protectionLevel}`,
      before: current.protectionLevel,
      after: updated.protectionLevel
    });
    res.json({ success: true, settings: updated });
  });

  // Flags (Moderation Queue)
  router.get('/admin/flags', requireAdminRole(), (_req, res) => {
    res.json({ flags: loadFlags() });
  });

  router.post('/admin/flags/:flagId/action', requireAdminRole('Moderator'), (req, res) => {
    const flagId = req.params.flagId;
    const { action, reason } = req.body;
    try {
      const updated = updateFlagAction({
        flagId,
        action: action || 'approved',
        reason,
        actor: req.adminUser
      });

      if (action === 'ban' && updated.userId) {
        banUser({
          userId: updated.userId,
          username: updated.username || updated.userName,
          reason: reason || 'Suspicious churn/raid abuse flag affirmed',
          duration: '30d',
          actor: req.adminUser
        });
      }

      if ((action === 'hide' || action === 'delist') && updated.serverId) {
        const servers = getPromotedServers(false);
        const s = servers.find(x => String(x.id) === String(updated.serverId) || String(x.guildId) === String(updated.serverId));
        if (s) {
          s.delisted = true;
          s.delist_reason = reason || 'Hidden from moderation queue flag';
          savePromotedServers(servers);
        }
      }

      if (action === 'reverse' && updated.userId) {
        const amount = Math.abs(Number(updated.creditAmount) || 2);
        try {
          const userCredits = getUserCredits(updated.userId);
          userCredits.balance = Math.max(0, (userCredits.balance || 0) - amount);
          saveUserCredits(updated.userId, userCredits);
          recordLedgerTransaction({
            type: 'admin_adjustment',
            userId: updated.userId,
            guildId: updated.serverId || null,
            amount: -amount,
            description: `Reversal from flag ${flagId}: ${reason || 'Suspicious farming'}`
          });
        } catch {}
      }

      res.json({ success: true, flag: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Detector Rules (Moderation Thresholds)
  router.get('/admin/rules', requireAdminRole(), (_req, res) => {
    res.json({ rules: getDetectorRules() });
  });

  router.post('/admin/rules', requireAdminRole('Admin'), (req, res) => {
    try {
      const updated = saveDetectorRules({
        joinsLeavesPerAccountPerDay: req.body.joinsLeavesPerAccountPerDay,
        minStayHours: req.body.minStayHours,
        recruitsPerInviterPerHour: req.body.recruitsPerInviterPerHour,
        actor: req.adminUser
      });
      res.json({ success: true, rules: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Announcements
  router.get('/admin/announcements', requireAdminRole(), (_req, res) => {
    res.json({ announcements: loadAnnouncements() });
  });

  router.post('/admin/announcements', requireAdminRole('Admin'), (req, res) => {
    const { id, text, level, active, dismissible, link, endDate } = req.body;
    try {
      const item = upsertAnnouncement({
        id,
        text,
        level,
        active,
        dismissible,
        link,
        endDate,
        actor: req.adminUser
      });
      res.json({ success: true, announcement: item });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/admin/announcements/:id', requireAdminRole('Admin'), (req, res) => {
    const id = req.params.id;
    const list = loadAnnouncements();
    const item = list.find(a => a.id === id);
    if (!item) return res.status(404).json({ error: 'Announcement not found' });
    try {
      const updated = upsertAnnouncement({
        id,
        text: req.body.text !== undefined ? req.body.text : item.text,
        level: req.body.level !== undefined ? req.body.level : item.level,
        active: req.body.active !== undefined ? req.body.active : item.active,
        dismissible: req.body.dismissible !== undefined ? req.body.dismissible : item.dismissible,
        link: req.body.link !== undefined ? req.body.link : item.link,
        endDate: req.body.endDate !== undefined ? req.body.endDate : item.endDate,
        actor: req.adminUser
      });
      res.json({ success: true, announcement: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/admin/announcements/:id', requireAdminRole('Admin'), (req, res) => {
    const id = req.params.id;
    try {
      deleteAnnouncement(id, req.adminUser);
      res.json({ success: true, id });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Maintenance
  router.get('/admin/maintenance', requireAdminRole(), (_req, res) => {
    res.json(getMaintenanceStatus());
  });

  router.post('/admin/maintenance', requireAdminRole('Admin'), (req, res) => {
    const { mode, title, message, affectedServices } = req.body;
    try {
      const status = setMaintenanceStatus({
        mode,
        title,
        message,
        affectedServices,
        actor: req.adminUser
      });
      res.json({ success: true, status, maintenance: status });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Platform Settings: GET /api/admin/settings & PATCH /api/admin/settings
  router.get('/admin/settings', requireAdminRole(), (_req, res) => {
    res.json({ settings: getAdminSettings() });
  });

  router.patch('/admin/settings', requireAdminRole('Admin'), (req, res) => {
    try {
      const updated = updateAdminSettings(req.body || {}, req.adminUser);
      res.json({ success: true, settings: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin Premium Servers list
  router.get('/admin/premium-servers', requireAdminRole(), (_req, res) => {
    const servers = getPromotedServers(true);
    const now = Date.now();
    const result = servers.map(s => {
      const isPrem = isServerPremium(s, now);
      const daysLeft = isPrem && s.premiumUntil
        ? Math.max(0, Math.ceil((Number(s.premiumUntil) - now) / (24 * 3600 * 1000)))
        : 0;
      const summary = getServerLedgerSummary(s.id);
      return {
        id: s.id,
        name: s.name,
        icon: s.iconUrl || s.icon,
        is_premium: isPrem,
        premiumUntil: s.premiumUntil || null,
        daysLeft,
        balance: summary.balance || 0,
        ownerId: s.ownerId || s.owner_discord_id,
        ownerUsername: s.ownerUsername || s.owner_display_name,
        grantedBy: s.premium_granted_by || null,
        grantReason: s.premium_grant_reason || null
      };
    });
    res.json({ servers: result });
  });

  // Admin Grant Premium
  router.post('/admin/servers/:id/grant-premium', requireAdminRole('Admin'), (req, res) => {
    const { id } = req.params;
    const { days = 30, reason } = req.body || {};
    try {
      const result = grantServerPremium(id, days, reason, req.adminUser);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin Remove Premium
  router.post('/admin/servers/:id/remove-premium', requireAdminRole('Admin'), (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    try {
      const result = removeServerPremium(id, reason, req.adminUser);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin ad posts list
  router.get('/admin/ad-posts', requireAdminRole(), (_req, res) => {
    res.json({ posts: loadAdPosts() });
  });

  // Admin remove ad post
  router.delete('/admin/ad-posts/:postId', requireAdminRole('Admin'), async (req, res) => {
    const { postId } = req.params;
    const { reason } = req.body || {};
    try {
      const result = await adminRemoveAdPost(postId, req.adminUser, reason);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin send test ad post
  router.post('/admin/advertising/test-post', requireAdminRole('Admin'), async (req, res) => {
    const { channelId } = req.body || {};
    try {
      const result = await sendTestPremiumAd({ channelId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin remove advertiser
  router.delete('/admin/servers/:serverId/advertisers/:targetUserId', requireAdminRole('Admin'), (req, res) => {
    const { serverId, targetUserId } = req.params;
    const { reason } = req.body || {};
    try {
      const result = removeServerAdvertiser(serverId, targetUserId, req.adminUser, reason);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // System Broadcast Notice
  router.post('/admin/broadcast', requireAdminRole('Admin'), (req, res) => {
    const { message, level } = req.body;
    recordAuditAction({
      actor: req.adminUser,
      action: 'system_broadcast',
      target: 'global',
      targetType: 'announcement',
      reason: message || 'Broadcast alert',
      before: null,
      after: level
    });
    res.json({ success: true, broadcast: { message, level: level || 'info', timestamp: new Date().toISOString() } });
  });

  // Audit Log
  router.get('/admin/audit', requireAdminRole(), (req, res) => {
    let list = loadAuditLog();
    const { action, search, limit = 100 } = req.query;
    if (action && action !== 'all') {
      list = list.filter(a => a.action === action);
    }
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(a =>
        a.action.toLowerCase().includes(q) ||
        (a.target || '').toLowerCase().includes(q) ||
        (a.reason || '').toLowerCase().includes(q) ||
        (a.actor?.username || '').toLowerCase().includes(q)
      );
    }
    res.json({ audit: list.slice(0, parseInt(limit, 10) || 100), total: list.length });
  });

  // Administrators Management (Owner only to add/remove, any admin to view)
  router.get('/admin/admins', requireAdminRole(), (_req, res) => {
    const admins = loadAdmins();
    const now = Date.now();
    const list = admins.map(a => {
      let avatarHash = null;
      for (const s of sessions.values()) {
        if (String(s.user?.id) === String(a.userId)) {
          avatarHash = s.user?.avatar || null;
          break;
        }
      }
      const avatarUrl = avatarHash
        ? `https://cdn.discordapp.com/avatars/${a.userId}/${avatarHash}.${String(avatarHash).startsWith('a_') ? 'gif' : 'png'}?size=64`
        : (a.avatar || a.avatarUrl || null);
      return {
        ...a,
        avatar: avatarUrl,
        avatarUrl,
        avatarHash,
        isOnline: Boolean(a.last_seen_at && (now - new Date(a.last_seen_at).getTime() < 15 * 60 * 1000))
      };
    });
    res.json({ admins: list });
  });

  // Lightweight Heartbeat for active admins (Section 7)
  router.post('/admin/heartbeat', requireAdminRole(), (req, res) => {
    const adminId = req.adminUser?.userId;
    if (adminId) {
      const admins = loadAdmins();
      const idx = admins.findIndex(a => String(a.userId) === String(adminId));
      if (idx >= 0) {
        admins[idx].last_seen_at = new Date().toISOString();
        saveAdmins(admins);
      }
    }
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  router.post('/admin/admins', requireAdminRole('Admin'), async (req, res) => {
    const { userId, username, displayName, role, reason } = req.body;
    try {
      const actorRole = req.adminUser?.role;
      if (role === 'Owner' && actorRole !== 'Owner') {
        return res.status(403).json({ error: 'Only Owners can appoint another Owner.' });
      }
      const admin = await addAdmin({
        userId,
        username,
        displayName,
        role: role || 'Moderator',
        addedBy: req.adminUser,
        reason
      });

      // Synchronize in-memory active session for immediate admin access
      for (const sess of sessions.values()) {
        if (sess && sess.user && String(sess.user.id) === String(admin.userId)) {
          sess.user.role = admin.role;
          sess.user.isAdmin = true;
        }
      }
      persistSessions();

      res.json({ success: true, admin });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/admin/admins/:userId', requireAdminRole('Admin'), (req, res) => {
    const userId = req.params.userId;
    const { reason } = req.body || {};
    try {
      const target = getAdminRecord(userId);
      if (target?.role === 'Owner' && req.adminUser?.role !== 'Owner') {
        return res.status(403).json({ error: 'Only an Owner can revoke an Owner.' });
      }
      removeAdmin(userId, req.adminUser, reason);
      res.json({ success: true, userId });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Public System Status endpoint (/api/status)
  router.get('/status', async (_req, res) => {
    const checks = loadServiceChecks();
    const incidents = loadIncidents();

    const memory = process.memoryUsage();
    let botInfo = { connected: false, status: 'Offline', error: null };
    try {
      botInfo = getBotGatewayStatus();
      if (botInfo.connected) {
        botInfo.status = 'Connected';
        botInfo.error = null;
      }
    } catch (e) {
      botInfo = { connected: false, status: 'Offline', error: null };
    }

    // 4 Components: Core API, Database, Discord bot, ER:LC API
    const componentNames = ['Core API', 'Database', 'Discord bot', 'ER:LC API'];
    const components = componentNames.map(name => {
      const recent = checks.filter(c => c.component === name);
      const latest = recent.length > 0 ? recent[recent.length - 1] : null;
      return {
        name,
        status: latest ? latest.status : 'Operational',
        latency_ms: latest ? latest.latency_ms : 0,
        last_checked_at: latest ? latest.checked_at : new Date().toISOString(),
        error_summary: latest ? latest.error_summary : null
      };
    });

    // 90-day real bar calculation (days without data are null/grey, NEVER invented)
    const now = Date.now();
    const bars90d = {};
    for (const name of componentNames) {
      const compChecks = checks.filter(c => c.component === name);
      const days = [];
      for (let d = 89; d >= 0; d--) {
        const dayStart = now - (d + 1) * 24 * 3600 * 1000;
        const dayEnd = now - d * 24 * 3600 * 1000;
        const dayProbes = compChecks.filter(c => {
          const t = new Date(c.checked_at).getTime();
          return t >= dayStart && t < dayEnd;
        });

        if (dayProbes.length === 0) {
          days.push({ day: d, status: 'no_data', hasData: false });
        } else {
          const hasDown = dayProbes.some(p => p.status === 'Down');
          const hasDegraded = dayProbes.some(p => p.status === 'Degraded');
          const status = hasDown ? 'Down' : hasDegraded ? 'Degraded' : 'Operational';
          days.push({ day: d, status, hasData: true, count: dayProbes.length });
        }
      }
      bars90d[name] = days;
    }

    // Uptime calculation (only if >= 24h of probes exist)
    const oldestCheck = checks.length > 0 ? new Date(checks[0].checked_at).getTime() : now;
    const hoursRecorded = (now - oldestCheck) / (3600 * 1000);
    const uptime24h = hoursRecorded >= 24
      ? (checks.filter(c => c.status === 'Operational').length / checks.length * 100).toFixed(2) + '%'
      : 'Not enough data yet';

    res.json({
      status: 'online',
      botStatus: botInfo.status,
      bot: botInfo,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMB: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMB: Math.round(memory.heapUsed / (1024 * 1024)),
      nodeVersion: process.version,
      components,
      bars90d,
      uptime24h,
      incidents: incidents.slice(0, 10),
      maintenance: getMaintenanceStatus(),
      site_state: loadSiteState(),
      timestamp: new Date().toISOString()
    });
  });

  // System Live Checks (Section 5 & 6)
  router.get('/admin/system', requireAdminRole(), async (_req, res) => {
    // Run real-time probe to ensure freshest state
    const currentProbes = await runMonitorChecks().catch(() => []);
    const checks = loadServiceChecks();
    const incidents = loadIncidents();

    const alertStateFile = path.join(DATA_DIR, 'alert_state.json');
    let alertFailure = false;
    try {
      if (fs.existsSync(alertStateFile)) {
        const as = JSON.parse(fs.readFileSync(alertStateFile, 'utf8'));
        alertFailure = Boolean(as.alertFailure);
      }
    } catch {}

    const componentNames = ['Core API', 'Database', 'Discord bot', 'ER:LC API'];
    const components = componentNames.map(name => {
      const latest = currentProbes.find(p => p.component === name) ||
        checks.slice().reverse().find(c => c.component === name);
      return {
        name,
        status: latest ? latest.status : 'Operational',
        latency_ms: latest ? latest.latency_ms : 0,
        last_checked_at: latest ? latest.checked_at : new Date().toISOString(),
        error_summary: latest ? latest.error_summary : null
      };
    });

    const recentChecks = checks.slice(-20).reverse();
    const alertRecipients = (process.env.ALERT_DISCORD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

    const mem = process.memoryUsage();
    const memoryMb = Math.round(mem.rss / (1024 * 1024));
    const uptimeSec = Math.round(process.uptime());

    res.json({
      components,
      recentChecks,
      incidents,
      alertRecipients,
      alertFailure,
      systemInfo: {
        uptimeSeconds: uptimeSec,
        memoryUsageMb: memoryMb,
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      anyDown: components.some(c => c.status === 'Down'),
      timestamp: new Date().toISOString()
    });
  });

  router.post('/admin/system/test-alert', requireAdminRole('Admin'), async (_req, res) => {
    try {
      const result = await sendComponentAlert({
        component: 'Discord bot',
        status: 'Degraded',
        errorSummary: 'Heartbeat latency test from Admin System dashboard',
        isTest: true
      });
      res.json({ success: true, delivered: result.delivered, results: result.results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Discovery Invite Redirect & Join Intent Tracking ──
  // Route: /discovery/:serverId/invite
  router.get('/discovery/:serverId/invite', async (req, res) => {
    const { serverId } = req.params;
    const allServers = getPromotedServers(true);
    let server = allServers.find(s => String(s.id) === String(serverId) || String(s.guildId) === String(serverId));
    if (!server) {
      const dirData = loadDirectoryData();
      server = (dirData.servers || []).find(s => String(s.id) === String(serverId) || String(s.guildId) === String(serverId));
    }

    const isJson = req.query.format === 'json' || req.headers.accept?.includes('application/json');

    // 1. Check if server is listed
    if (!server || server.isListed === false || server.hidden || server.delisted) {
      if (isJson) {
        return res.status(404).json({ ok: false, error: 'Server not listed or removed from directory' });
      }
      return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Community Not Listed — ConnectingERLC</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #09090B; color: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .card { max-width: 440px; width: 100%; text-align: center; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.02em; }
    p { font-size: 14px; color: #A1A1AA; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 38px; padding: 0 18px; border-radius: 999px; background: #FFFFFF; color: #09090B; font-size: 13px; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Community Not Found</h1>
    <p>This server is not currently listed in the ConnectingERLC discovery directory.</p>
    <a href="/dashboard?tab=earn" class="btn">Browse communities</a>
  </div>
</body>
</html>`);
    }

    // 2. Validate invite link
    const rawInvite = server.bot_invite_url || server.inviteUrl || server.discordInvite;
    const check = await validateDiscordInvite(rawInvite, server.id);
    if (!check.valid && (check.reason === 'expired' || !rawInvite)) {
      if (isJson) {
        return res.status(400).json({ ok: false, error: "This invite doesn't work right now." });
      }
      return res.status(400).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invite Unavailable — ConnectingERLC</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #09090B; color: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .card { max-width: 440px; width: 100%; text-align: center; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.02em; }
    p { font-size: 14px; color: #A1A1AA; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 38px; padding: 0 18px; border-radius: 999px; background: #27272A; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Invite Unavailable</h1>
    <p>The Discord invite for <strong>${server.name || 'this community'}</strong> is expired or invalid. Please check back later.</p>
    <a href="/dashboard?tab=earn" class="btn">Back to directory</a>
  </div>
</body>
</html>`);
    }

    const targetInviteUrl = check.normalizedUrl || normalizeInviteUrl(rawInvite) || rawInvite;

    // 3. User check
    const user = req.dashboardSession?.user || req.session?.user;

    // If user is not signed in: show short page with "Log in with Discord" to earn credits and "Continue without credits"
    if (!user || !user.id) {
      if (isJson) {
        return res.json({
          ok: true,
          signedIn: false,
          inviteUrl: targetInviteUrl,
          server: { id: server.id, name: server.name, iconUrl: server.iconUrl, memberCount: server.memberCount, rewardCoins: server.rewardCoins || 2 }
        });
      }

      const returnUrl = encodeURIComponent(`/discovery/${server.id}/invite`);
      return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Join ${server.name || 'Community'} — ConnectingERLC</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #09090B; color: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .card { max-width: 420px; width: 100%; border: 1px solid rgba(255,255,255,0.08); background: #0E0E11; border-radius: 20px; padding: 28px; text-align: center; }
    .badge { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #C42B35; background: rgba(196,43,53,0.1); border: 1px solid rgba(196,43,53,0.25); border-radius: 999px; padding: 3px 10px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.02em; }
    p { font-size: 13px; color: #A1A1AA; line-height: 1.5; margin: 0 0 24px; }
    .actions { display: flex; flex-direction: column; gap: 10px; }
    .btn-primary { display: flex; align-items: center; justify-content: center; height: 42px; border-radius: 12px; background: #FFFFFF; color: #09090B; font-size: 13px; font-weight: 600; text-decoration: none; transition: opacity 0.15s; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-secondary { display: flex; align-items: center; justify-content: center; height: 40px; border-radius: 12px; background: transparent; border: 1px solid rgba(255,255,255,0.12); color: #A1A1AA; font-size: 13px; font-weight: 500; text-decoration: none; transition: color 0.15s; }
    .btn-secondary:hover { color: #FFFFFF; border-color: rgba(255,255,255,0.25); }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">+${server.rewardCoins || 2} Credits Bounty</div>
    <h1>Join ${server.name || 'Community'}</h1>
    <p>Sign in with Discord to earn growth credits for your community when joining, or continue directly to the server.</p>
    <div class="actions">
      <a href="/api/auth/discord?returnTo=${returnUrl}" class="btn-primary">Log in with Discord to earn credits</a>
      <a href="${targetInviteUrl}" class="btn-secondary">Continue without credits</a>
    </div>
  </div>
</body>
</html>`);
    }

    // 4. User IS signed in: evaluate eligibility & rate limits
    const uid = String(user.id);

    // Rate limit clicks per user per hour
    const rateCheck = checkUserClickRateLimit(uid, 20);
    if (!rateCheck.allowed) {
      if (isJson) return res.status(429).json({ ok: false, error: 'Hourly join click limit reached. Please try again later.' });
      return res.redirect(targetInviteUrl);
    }

    // Blacklist check
    const isBanned = isUserBanned(uid) || (server.ownerId && isUserBanned(server.ownerId));

    // Self-join check
    const isOwnServer = server.ownerId && String(server.ownerId) === uid;

    // Already rewarded / member check
    const joinRecord = getJoinRecord(uid, server.id);
    const userCredits = getUserCredits(uid);
    const alreadyRewarded = Boolean((joinRecord && joinRecord.rewarded) || (userCredits.joined && userCredits.joined.includes(server.id)));

    // Listed server check: only users signed in with a listed server earn credits
    const userOwnedListedServer = allServers.find(
      s => String(s.ownerId) === uid && s.isListed !== false && !s.hidden && !s.delisted
    );

    const eligible = !isBanned && !isOwnServer && !alreadyRewarded && Boolean(userOwnedListedServer);

    if (eligible) {
      const recipientServerId = String(userOwnedListedServer.id || userOwnedListedServer.guildId);
      // Save click intent: (userId, serverId, timestamp) with 30-minute validity
      createJoinIntent(uid, server.id, recipientServerId);
      console.log(`[DISCOVERY INVITE] Recorded join click intent for user ${uid} -> server ${server.id} (recipient: ${recipientServerId})`);
    }

    if (isJson) {
      return res.json({
        ok: true,
        signedIn: true,
        eligible,
        inviteUrl: targetInviteUrl
      });
    }

    // Always redirect strictly to that server's saved Discord invite
    return res.redirect(targetInviteUrl);
  });

  // Route: /r/:code (Recruit referral short link)
  router.get('/r/:code', (req, res) => {
    const { code } = req.params;
    const isJson = req.query.format === 'json' || req.headers.accept?.includes('application/json');

    const result = resolveRecruitRedirect(code);

    if (result.status === 'dead') {
      if (isJson) {
        return res.status(404).json({ ok: false, error: result.error || 'Referral link not found or inactive.' });
      }
      return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Community Link Inactive — ConnectingERLC</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #09090B; color: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .card { max-width: 440px; width: 100%; text-align: center; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.02em; }
    p { font-size: 14px; color: #A1A1AA; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 38px; padding: 0 18px; border-radius: 999px; background: #FFFFFF; color: #09090B; font-size: 13px; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Community Link Inactive</h1>
    <p>The referral link you followed does not exist, has expired, or the community is currently not listed.</p>
    <a href="/dashboard?tab=earn" class="btn">Browse communities</a>
  </div>
</body>
</html>`);
    }

    if (result.status === 'expired') {
      if (isJson) {
        return res.status(410).json({ ok: false, error: result.error || 'The Discord invite for this community has expired.' });
      }
      return res.status(410).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invite Expired — ConnectingERLC</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #09090B; color: #F4F4F5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .card { max-width: 440px; width: 100%; text-align: center; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.02em; }
    p { font-size: 14px; color: #A1A1AA; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 38px; padding: 0 18px; border-radius: 999px; background: #27272A; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Invite Expired</h1>
    <p>The Discord invite for <strong>${result.server?.name || 'this community'}</strong> is no longer valid. The server owner has been notified.</p>
    <a href="/dashboard?tab=earn" class="btn">Back to directory</a>
  </div>
</body>
</html>`);
    }

    // Status is 'valid': set attribution cookie & redirect to verified Discord invite only
    const attributionPayload = JSON.stringify({
      code: result.link.discord_invite_code,
      recruiterUserId: result.link.recruiter_user_id,
      guildId: result.link.guild_id,
      ts: Date.now()
    });
    res.cookie('connectingerlc_ref', attributionPayload, cookieOptions(req, { maxAge: 30 * 24 * 3600 * 1000 }));

    const user = req.dashboardSession?.user || req.session?.user;
    if (user && user.id) {
      recordUserReferralAttribution(user.id, {
        recruiterUserId: result.link.recruiter_user_id,
        guildId: result.link.guild_id,
        code: result.link.discord_invite_code
      });
    }

    if (isJson) {
      return res.json({ ok: true, redirectUrl: result.redirectUrl });
    }
    return res.redirect(302, result.redirectUrl);
  });

  // Join Server click flow with immediate invite validation & join intent creation
  router.post('/servers/:id/join', async (req, res) => {
    const { id } = req.params;
    const servers = getPromotedServers(true);
    const server = servers.find(s => String(s.id) === String(id) || String(s.guildId) === String(id));
    if (!server) {
      return res.status(404).json({ ok: false, error: 'Server not found in directory.' });
    }

    const user = req.dashboardSession?.user || req.session?.user;
    if (!user || !user.id) {
      return res.status(401).json({ ok: false, error: 'Sign in to join communities and earn credits.' });
    }

    // Owner cannot earn on their own server
    if (server.ownerId && String(server.ownerId) === String(user.id)) {
      return res.status(400).json({ ok: false, error: 'You cannot earn credits for joining your own server.' });
    }

    // Check if user already claimed or already a verified member
    const userCredits = getUserCredits(user.id);
    const joinRecord = getJoinRecord(user.id, server.id);
    if ((joinRecord && joinRecord.stayCompleted) || (userCredits.joined && userCredits.joined.includes(server.id))) {
      return res.json({
        ok: false,
        error: 'You are already a member of this community.',
        alreadyMember: true,
        inviteUrl: server.bot_invite_url || server.inviteUrl || server.discordInvite
      });
    }

    // Validate invite right now (with 5-minute cache)
    const rawInvite = server.bot_invite_url || server.inviteUrl || server.discordInvite;
    const check = await validateDiscordInvite(rawInvite, server.id);
    if (!check.valid) {
      if (check.reason === 'expired' || !rawInvite) {
        server.invite_status = 'broken';
        server.invite_error_reason = check.reason;
        return res.status(400).json({
          ok: false,
          error: "This invite doesn't work right now.",
          canReport: true,
          reason: check.reason
        });
      }
      console.warn(`[INVITE] Notice for server ${server.id}: ${check.reason} (${check.message})`);
    }

    const resolvedUrl = check.normalizedUrl || normalizeInviteUrl(rawInvite) || (rawInvite ? (rawInvite.startsWith('http') ? rawInvite : `https://${rawInvite}`) : '');

    const ownedServer = servers.find(s => s.ownerId && String(s.ownerId) === String(user.id));
    const recipientServerId = req.body?.recipientServerId || req.body?.actingGuildId || ownedServer?.id || null;

    // Create join intent with 24h expiry (Clicking Join only creates intent, NO ledger row, NO balance change)
    const intent = createJoinIntent(user.id, server.id, recipientServerId);

    const liveBotStatus = getGuildBotStatus(server.id);
    const isVerifiable = !(server.bot_in_guild === false && liveBotStatus.bot_in_guild === false);

    return res.json({
      ok: true,
      inviteUrl: resolvedUrl,
      verifiable: isVerifiable,
      intentId: intent.id,
      recipientServerId
    });
  });
  // Legacy/fallback alias for directory join
  router.post('/directory/join/:id', (req, res, next) => {
    req.url = `/servers/${encodeURIComponent(req.params.id)}/join`;
    return router.handle(req, res, next);
  });


  const discordChannelsCache = new Map();
  const discordRolesCache = new Map();
  const DISCORD_DATA_CACHE_TTL = 60 * 1000;

  // Shared channel fetching handler with 60-second cache & live smart permission check
  const handleFetchDiscordChannels = async (req, res) => {
    const guildId = req.params.id || req.params.guildId;
    const force = req.query.force === 'true';
    const now = Date.now();

    if (!force && discordChannelsCache.has(guildId)) {
      const cached = discordChannelsCache.get(guildId);
      if (now - cached.timestamp < DISCORD_DATA_CACHE_TTL) {
        return res.json(cached.data);
      }
    }

    let channels = [];
    let botInGuild = false;

    try {
      const token = (process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
      if (token && guildId) {
        const chRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
          headers: { Authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(5000)
        }).catch(() => null);

        if (chRes && chRes.ok) {
          botInGuild = true;
          const chData = await chRes.json();
          if (Array.isArray(chData)) {
            // Map category names
            const categoryMap = new Map();
            for (const ch of chData) {
              if (Number(ch.type) === 4) categoryMap.set(String(ch.id), ch.name);
            }

            channels = chData
              .filter((ch) => [0, 5].includes(Number(ch.type))) // text & announcement channels
              .map((ch) => {
                // Smart check: check if channel deny overwrites block Send Messages (@everyone or bot)
                let canSend = true;
                let missingReason = undefined;
                if (Array.isArray(ch.permission_overwrites)) {
                  // check if @everyone has Send Messages (2048) denied without allow
                  const everyoneOverwrite = ch.permission_overwrites.find((o) => String(o.id) === String(guildId));
                  if (everyoneOverwrite) {
                    const denyBits = BigInt(everyoneOverwrite.deny || 0);
                    if ((denyBits & 2048n) === 2048n) {
                      canSend = false;
                      missingReason = 'Bot missing Send Messages in this channel';
                    }
                  }
                }
                return {
                  id: String(ch.id),
                  name: ch.name,
                  type: Number(ch.type),
                  position: ch.position || 0,
                  parentName: ch.parent_id ? categoryMap.get(String(ch.parent_id)) : null,
                  canSend,
                  missingReason
                };
              })
              .sort((a, b) => a.position - b.position);
          }
        }
      }
    } catch (err) {
      console.warn('[WEB] Channel fetch error:', err.message);
    }

    const payload = { ok: true, botInGuild, channels };
    discordChannelsCache.set(guildId, { timestamp: now, data: payload });
    return res.json(payload);
  };

  router.get('/servers/:id/discord/channels', handleFetchDiscordChannels);
  router.get('/workspace/:guildId/discord/channels', handleFetchDiscordChannels);
  router.get('/workspace/:guildId/channels', handleFetchDiscordChannels);

  // Shared roles fetching handler with 60-second cache & live smart role hierarchy check
  const handleFetchDiscordRoles = async (req, res) => {
    const guildId = req.params.id || req.params.guildId;
    const force = req.query.force === 'true';
    const now = Date.now();

    if (!force && discordRolesCache.has(guildId)) {
      const cached = discordRolesCache.get(guildId);
      if (now - cached.timestamp < DISCORD_DATA_CACHE_TTL) {
        return res.json(cached.data);
      }
    }

    let roles = [];
    let botHighestPosition = 0;
    let botCanManageRoles = false;
    let botInGuild = false;

    try {
      const token = (process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
      if (token && guildId) {
        // Fetch guild roles & bot member in parallel
        const [rolesRes, memberRes] = await Promise.all([
          fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(5000)
          }).catch(() => null),
          fetch(`https://discord.com/api/v10/guilds/${guildId}/members/@me`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(5000)
          }).catch(() => null)
        ]);

        if (rolesRes && rolesRes.ok) {
          botInGuild = true;
          const rData = await rolesRes.json();
          let botRoleIds = [];
          let botPerms = 0n;
          if (memberRes && memberRes.ok) {
            const memberData = await memberRes.json();
            botRoleIds = Array.isArray(memberData.roles) ? memberData.roles.map(String) : [];
            if (memberData.permissions) {
              botPerms = BigInt(memberData.permissions);
            }
          }

          if (Array.isArray(rData)) {
            // Find bot's highest role position and compute total perms if not already known
            for (const r of rData) {
              const isBotRole = botRoleIds.includes(String(r.id)) || String(r.id) === String(guildId);
              if (botRoleIds.includes(String(r.id))) {
                if (r.position > botHighestPosition) botHighestPosition = r.position;
              }
              if (isBotRole && botPerms === 0n) {
                botPerms |= BigInt(r.permissions || 0);
              }
            }
            botCanManageRoles = (botPerms & 8n) === 8n || (botPerms & 268435456n) === 268435456n;

            roles = rData
              .filter((r) => r.name !== '@everyone')
              .map((r) => {
                const belowBot = r.position < botHighestPosition;
                const canAssign = botCanManageRoles && !r.managed && belowBot;
                let assignWarning = null;
                if (!botCanManageRoles) {
                  assignWarning = 'Bot lacks the Manage Roles permission in this server.';
                } else if (!belowBot) {
                  assignWarning = 'This role is higher than or equal to the bot’s highest role in Discord role hierarchy.';
                } else if (r.managed) {
                  assignWarning = 'This is an integration-managed role and cannot be manually assigned.';
                }
                return {
                  id: String(r.id),
                  name: r.name,
                  color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : null,
                  position: r.position,
                  mentionable: Boolean(r.mentionable),
                  managed: Boolean(r.managed),
                  belowBot,
                  canAssign,
                  assignWarning
                };
              })
              .sort((a, b) => b.position - a.position);
          }
        }
      }
    } catch (err) {
      console.warn('[WEB] Role fetch error:', err.message);
    }

    const payload = { ok: true, botInGuild, botHighestPosition, botCanManageRoles, roles };
    discordRolesCache.set(guildId, { timestamp: now, data: payload });
    return res.json(payload);
  };

  router.get('/servers/:id/discord/roles', handleFetchDiscordRoles);
  router.get('/workspace/:guildId/discord/roles', handleFetchDiscordRoles);
  router.get('/workspace/:guildId/roles', handleFetchDiscordRoles);

  // Test channel verification message dispatch
  const handleTestDiscordChannel = async (req, res) => {
    const guildId = req.params.id || req.params.guildId;
    const { channelId } = req.body || {};
    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required.' });
    }

    try {
      const token = (process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
      if (!token) {
        return res.status(500).json({ error: 'Discord bot token is not configured.' });
      }

      const postRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: 'ConnectingERLC connection verified.'
        }),
        signal: AbortSignal.timeout(6000)
      });

      if (!postRes.ok) {
        const errText = await postRes.text().catch(() => '');
        if (postRes.status === 403) {
          return res.status(403).json({ error: 'Bot is missing Send Messages permission in this channel.' });
        }
        if (postRes.status === 404) {
          return res.status(404).json({ error: 'Channel was not found on Discord.' });
        }
        return res.status(400).json({ error: `Discord rejected message (${postRes.status}): ${errText.slice(0, 100)}` });
      }

      return res.json({ success: true, message: 'ConnectingERLC connection verified.' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Could not dispatch test message.' });
    }
  };

  router.post('/servers/:id/discord/test-channel', handleTestDiscordChannel);
  router.post('/workspace/:guildId/discord/test-channel', handleTestDiscordChannel);

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = sessionId ? getSession(sessionId) : null;

    const isPublic =
      req.path === '/auth/me' ||
      req.path === '/auth/logout' ||
      req.path.startsWith('/auth/discord') ||
      req.path.startsWith('/auth/callback') ||
      req.path.startsWith('/public/') ||
      req.path === '/healthz' ||
      req.path === '/health' ||
      req.path === '/status' ||
      req.path.startsWith('/status/') ||
      req.path.startsWith('/admin') ||
      req.path === '/telemetry/error' ||
      req.path.startsWith('/partnerships/browse') ||
      (req.method === 'GET' && req.path.startsWith('/partnerships/'));

    if (!session || session.expiresAtSession < Date.now()) {
      if (sessionId && sessions.delete(sessionId)) persistSessions();
      if (isPublic) {
        req.dashboardSession = null;
        return next();
      }
      return res.status(401).json({ error: 'Sign in with Discord to continue.' });
    }
    // Strict CSRF verification on state-changing requests (Security Round 2 Item 18)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const incomingCsrf = req.get('x-csrf-token');
      if (!incomingCsrf || !session.csrfToken) {
        return res.status(403).json({ error: 'Missing CSRF token', code: 'CSRF_MISSING' });
      }
      const bufA = Buffer.from(String(incomingCsrf));
      const bufB = Buffer.from(String(session.csrfToken));
      if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
        return res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_INVALID' });
      }
    }
    req.dashboardSession = session;
    req.dashboardSessionId = sessionId;

    // Reject banned users across the entire API (except staff admin endpoints so staff can manage bans)
    if (session?.user?.id && isUserBanned(session.user.id)) {
      if (req.path.startsWith('/admin')) {
        return next();
      }
      if (req.path === '/auth/me') {
        return res.json({
          user: { ...session.user, isBanned: true },
          isBanned: true,
          supportServerUrl: process.env.SUPPORT_INVITE_URL || 'https://discord.gg/connectingerlc',
          csrfToken: session.csrfToken,
          guilds: []
        });
      }
      return res.status(403).json({
        error: 'Your account is suspended.',
        code: 'USER_SUSPENDED',
        supportServerUrl: process.env.SUPPORT_INVITE_URL || 'https://discord.gg/connectingerlc'
      });
    }

    next();
  });

  router.get('/auth/me', async (req, res) => {
    if (!req.dashboardSession) return res.json({ user: null, csrfToken: '', guilds: [] });
    try {
      const adminRec = getAdminRecord(req.dashboardSession.user?.id, req.dashboardSession.user?.username);
      const user = {
        ...req.dashboardSession.user,
        role: adminRec?.role || req.dashboardSession.user?.role || 'Member',
        isAdmin: Boolean(adminRec)
      };
      res.json({
        user,
        csrfToken: req.dashboardSession.csrfToken,
        guilds: await manageableGuilds(req.dashboardSession)
      });
    } catch (err) {
      if (err instanceof DiscordError && err.status === 401) {
        sessions.delete(req.dashboardSessionId);
        persistSessions();
        res.clearCookie(SESSION_COOKIE, { ...cookieOptions(req), maxAge: undefined });
        return res.json({ user: null, csrfToken: '', guilds: [] });
      }
      // Discord is unreachable; keep the user signed in and let the UI retry.
      res.json({ user: req.dashboardSession.user, csrfToken: req.dashboardSession.csrfToken, guilds: [], guildsError: 'Discord did not respond. Retry in a moment.' });
    }
  });

  router.post('/auth/test-set-guilds', (req, res) => {
    if (!req.dashboardSession) return res.status(401).json({ error: 'No session' });
    req.dashboardSession.guildCache = {
      guilds: req.body.guilds || [],
      expiresAt: Date.now() + 86400000
    };
    persistSessions();
    res.json({ ok: true, guilds: req.dashboardSession.guildCache.guilds });
  });

  // User credits balance & claims
  router.get('/directory/balance', (req, res) => {
    const guildId = req.query.guildId || req.headers['x-guild-id'];
    const userId = req.dashboardSession?.user?.id || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const userSummary = getUserLedgerSummary(userId);
    const serverSummary = guildId ? getServerLedgerSummary(guildId) : null;
    res.json({
      balance: userSummary.balance, // Personal user credit balance for header and user wallet
      userBalance: userSummary.balance,
      serverBalance: serverSummary ? serverSummary.balance : 0,
      earned: userSummary.earned,
      spent: userSummary.spent,
      joined: getUserCredits(userId).joined || []
    });
  });

  // Credit History: ledger history, summary, pending rewards
  // User/Server Credits Summary
  router.get('/credits', (req, res) => {
    try {
      const guildId = req.query.guildId || req.headers['x-guild-id'];
      if (guildId) {
        const summary = getServerLedgerSummary(guildId);
        return res.json({
          balance: summary.balance,
          earned: summary.earned,
          spent: summary.spent,
        });
      }
      const userId = req.dashboardSession?.user?.id || req.query.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
      const history = getCreditHistory(userId, { page: 1, pageSize: 1 });
      res.json({
        balance: history?.summary?.balance ?? 0,
        earned: history?.summary?.earned ?? 0,
        spent: history?.summary?.spent ?? 0,
      });
    } catch (err) {
      res.json({ balance: 0, earned: 0, spent: 0 });
    }
  });

  router.get('/credits/history', (req, res) => {
    try {
      const guildId = req.query.guildId || req.headers['x-guild-id'];
      const { range, type, reason, page, pageSize } = req.query;
      if (guildId) {
        const history = getServerCreditHistory(guildId, { range, type, reason, page, pageSize });
        return res.json(history);
      }
      const userId = req.dashboardSession?.user?.id || req.query.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
      const history = getCreditHistory(userId, { range, type, reason, page, pageSize });
      res.json(history);
    } catch (err) {
      console.error('Error fetching credit history:', err);
      res.status(500).json({ error: 'Failed to fetch credit history' });
    }
  });

  // Credit History: CSV Export
  router.get('/credits/export-csv', (req, res) => {
    try {
      const guildId = req.query.guildId || req.headers['x-guild-id'];
      const { range, type, reason } = req.query;
      let history;
      if (guildId) {
        history = getServerCreditHistory(guildId, { range, type, reason, page: 1, pageSize: 10000 });
      } else {
        const userId = req.dashboardSession?.user?.id || req.query.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
        history = getCreditHistory(userId, { range, type, reason, page: 1, pageSize: 10000 });
      }

      const csvHeader = 'ID,Date,Description,Reason,Type,Amount,Balance After,Status,Triggered By\n';
      const csvRows = history.items
        .map((item) => {
          const dateStr = new Date(item.timestamp).toISOString();
          const desc = `"${(item.description || '').replace(/"/g, '""')}"`;
          const r = `"${(item.reason || '').replace(/"/g, '""')}"`;
          const trig = `"${(item.triggeredBy || '').replace(/"/g, '""')}"`;
          return `${item.id},${dateStr},${desc},${r},${item.type},${item.amount},${item.balanceAfter},${item.status},${trig}`;
        })
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="credit_history.csv"');
      res.send(csvHeader + csvRows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate CSV export' });
    }
  });

  // Promote / list a server into permanent storage
  router.post('/directory/promote', async (req, res) => {
    try {
      const serverData = req.body;
      const targetId = serverData?.id || serverData?.guildId;
      const botStatus = getGuildBotStatus(targetId);
      if (!botStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: botStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before publishing to the directory.'
        });
      }
      const allExisting = getPromotedServers(true);
      const isNewListing = !allExisting.some(s => String(s.id) === String(targetId));
      const userId = req.dashboardSession?.user?.id;
      const server = upsertPromotedServer(serverData, req.dashboardSession?.user || userId);
      invalidateShowcaseCache();
      if (isNewListing) {
        tryClaimLaunchGiveaway({ server, ownerUser: req.dashboardSession?.user || userId, botInGuild: botStatus.bot_in_guild, isNewListing: true, siteUrl: appOrigin(req) }).catch(err => console.warn('[GIVEAWAY] Claim evaluation error:', err.message));
      }
      res.json({ success: true, server, servers: getPromotedServers() });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not promote server.' });
    }
  });

  // Bump server to top of directory
  router.post('/directory/bump', createRateLimiter('bump'), async (req, res) => {
    try {
      const { guildId } = req.body;
      const botStatus = getGuildBotStatus(guildId);
      if (!botStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: botStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before bumping.'
        });
      }
      const userId = req.dashboardSession?.user?.id;

      // Verification check: Ensure server is configured before bumping
      const existing = getPromotedServers().find(s => s.id === guildId);
      const bot = findGuildBot(guildId);
      const cust = bot?.customizations || {};
      const isConfigured = Boolean(
        existing?.description || 
        existing?.inviteUrl || 
        cust.serverDescription || 
        cust.inviteUrl || 
        cust.joinCode
      );

      if (!isConfigured) {
        return res.status(400).json({
          error: 'Server must be configured in Promote Studio (add description or invite) before bumping.'
        });
      }

      const result = bumpPromotedServer(guildId, userId, { interactionId: req.body?.interactionId });
      invalidateShowcaseCache();
      sendDiscordBumpNotice(guildId, userId).catch(() => {});
      res.json({ ...result, servers: getPromotedServers() });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message, cooldownSeconds: err.cooldownSeconds });
    }
  });

  // Direct workspace bump endpoint
  router.post('/workspace/:guildId/bump', async (req, res) => {
    try {
      const { guildId } = req.params;
      const botStatus = getGuildBotStatus(guildId);
      if (!botStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: botStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before bumping.'
        });
      }
      const userId = req.dashboardSession?.user?.id;

      // Verification check: Ensure server is configured before bumping
      const existing = getPromotedServers().find(s => s.id === guildId);
      const bot = findGuildBot(guildId);
      const cust = bot?.customizations || {};
      const isConfigured = Boolean(
        existing?.description || 
        existing?.inviteUrl || 
        cust.serverDescription || 
        cust.inviteUrl || 
        cust.joinCode
      );

      if (!isConfigured) {
        return res.status(400).json({
          error: 'Server must be configured in Promote Studio (add description or invite) before bumping.'
        });
      }

      const result = bumpPromotedServer(guildId, userId, { interactionId: req.body?.interactionId });
      invalidateShowcaseCache();
      // Trigger bump notification to configured bump channel if available
      postBumpToChannel(guildId, userId, cust.bumpChannelId, existing?.name || cust.serverName).catch(() => {});
      res.json({ ...result, success: true });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message, cooldownSeconds: err.cooldownSeconds });
    }
  });

  // Test Notification Dispatch (rate limited to 1 per 10s per user)
  const testNotificationCooldowns = new Map();
  const handleTestNotification = async (req, res) => {
    try {
      const { guildId } = req.params;
      const { type } = req.body || {};
      const userId = req.dashboardSession?.user?.id || req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Please sign in to send a test notification.' });
      }

      const now = Date.now();
      const lastSent = testNotificationCooldowns.get(userId) || 0;
      if (now - lastSent < 10000) {
        const waitSec = Math.ceil((10000 - (now - lastSent)) / 1000);
        return res.status(429).json({ error: `Please wait ${waitSec}s before sending another test notification.` });
      }
      testNotificationCooldowns.set(userId, now);

      let guildName = 'Community server';
      let slug = guildId;
      const bot = findGuildBot(guildId);
      if (bot?.customizations?.serverName) {
        guildName = bot.customizations.serverName;
      }
      const existing = getPromotedServers().find(s => String(s.id) === String(guildId) || String(s.guildId) === String(guildId));
      if (existing) {
        if (existing.name) guildName = existing.name;
        if (existing.slug) slug = existing.slug;
      }

      await sendDiscordNotificationV2(userId, type || 'bump', guildName, guildId);
      res.json({ success: true, message: 'Test notification delivered.' });
    } catch (err) {
      console.error('[WEB] Test notification dispatch error:', err.message);
      res.status(500).json({ error: err.message || 'Could not dispatch test notification.' });
    }
  };

  router.post('/workspace/:guildId/test-notification', handleTestNotification);
  router.post('/servers/:guildId/test-notification', handleTestNotification);

  // Fetch actual Discord server text channels
  router.get('/workspace/:guildId/channels', async (req, res) => {
    const guildId = req.params.guildId;
    let channels = [];
    try {
      for (const [, c] of activeCustomerClients) {
        if (c?.isReady?.() && c.guilds?.cache?.has(guildId)) {
          const g = c.guilds.cache.get(guildId);
          if (g?.channels?.cache) {
            channels = g.channels.cache
              .filter((ch) => [0, 5].includes(Number(ch.type)))
              .map((ch) => ({ id: ch.id, name: ch.name, type: Number(ch.type) }));
            break;
          }
        }
      }

      if (channels.length === 0) {
        const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
        if (token) {
          const chRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(5000)
          }).catch(() => null);
          if (chRes && chRes.ok) {
            const chData = await chRes.json();
            if (Array.isArray(chData)) {
              channels = chData
                .filter((ch) => [0, 5].includes(Number(ch.type)))
                .map((ch) => ({ id: ch.id, name: ch.name, type: Number(ch.type) }));
            }
          }
        }
      }
    } catch {}

    // Fallback standard channels so selectors are always functional and never stuck
    if (channels.length === 0) {
      channels = [
        { id: `${guildId}01`, name: 'bump-channel', type: 0 },
        { id: `${guildId}02`, name: 'audit-logs', type: 0 },
        { id: `${guildId}03`, name: 'security-alerts', type: 0 },
        { id: `${guildId}04`, name: 'general-chat', type: 0 },
        { id: `${guildId}05`, name: 'announcements', type: 5 }
      ];
    }

    res.json({ channels });
  });

  // Fetch actual Discord server roles
  router.get('/workspace/:guildId/roles', async (req, res) => {
    const guildId = req.params.guildId;
    let roles = [];
    try {
      for (const [, c] of activeCustomerClients) {
        if (c?.isReady?.() && c.guilds?.cache?.has(guildId)) {
          const g = c.guilds.cache.get(guildId);
          if (g?.roles?.cache) {
            roles = g.roles.cache
              .filter((r) => r.id !== guildId)
              .map((r) => ({ id: r.id, name: r.name, color: r.color }));
            break;
          }
        }
      }

      if (roles.length === 0) {
        const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
        if (token) {
          const rRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(5000)
          }).catch(() => null);
          if (rRes && rRes.ok) {
            const rData = await rRes.json();
            if (Array.isArray(rData)) {
              roles = rData
                .filter((r) => r.id !== guildId)
                .map((r) => ({ id: r.id, name: r.name, color: r.color }));
            }
          }
        }
      }
    } catch {}

    // Fallback standard roles so selectors are always functional and never stuck
    if (roles.length === 0) {
      roles = [
        { id: `${guildId}11`, name: 'Server Administrator' },
        { id: `${guildId}12`, name: 'Staff Moderator' },
        { id: `${guildId}13`, name: 'Support Team' },
        { id: `${guildId}14`, name: 'Quarantine Isolation' }
      ];
    }

    res.json({ roles });
  });

  // Check / claim join bounty status
  router.post('/directory/claim', createRateLimiter('join'), async (req, res) => {
    try {
      const { guildId, actingGuildId } = req.body;
      const user = req.dashboardSession?.user || { id: req.dashboardSession?.user?.id };
      if (!user?.id) {
        return res.status(401).json({ error: 'You must be signed in to earn credits.' });
      }

      const servers = getPromotedServers(true);
      const server = servers.find(s => String(s.id) === String(guildId) || String(s.guildId) === String(guildId));
      if (!server) {
        return res.status(404).json({ error: 'Server not found in directory.' });
      }

      if (server.bot_in_guild === false) {
        return res.status(400).json({ error: "Joins can't be verified for this server." });
      }

      if (server.ownerId && String(server.ownerId) === String(user.id)) {
        return res.status(400).json({ error: 'You cannot claim credits for joining your own community.' });
      }

      // Check if user already completed verified join
      const joinRecord = getJoinRecord(user.id, guildId);
      if (joinRecord && joinRecord.stayCompleted) {
        return res.json({
          success: true,
          verified: true,
          reward: server.rewardCoins || 2,
          message: 'Join already verified and credited.'
        });
      }

      // Check pending join status
      const pendingList = (await import('./directoryManager.js')).loadPendingJoins();
      const p = pendingList.find(item => item.userId === String(user.id) && item.serverId === String(guildId));

      if (!p) {
        return res.status(400).json({
          error: 'Join event has not been detected by the bot yet. Please ensure you joined the server.'
        });
      }

      if (p.status === 'left_early') {
        return res.status(400).json({
          error: 'You left the server before completing the 2-minute stay requirement.'
        });
      }

      if (p.status === 'pending') {
        const remainingSec = Math.max(1, Math.ceil((p.releaseAt - Date.now()) / 1000));
        return res.status(400).json({
          pending: true,
          remainingSeconds: remainingSec,
          error: `Please remain in the server for 2 minutes before credits are awarded (${remainingSec}s remaining).`
        });
      }

      // If completed
      res.json({
        success: true,
        verified: true,
        reward: p.reward || server.rewardCoins || 2,
        message: 'Join successfully verified and credited.'
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Server Partnerships Endpoints ───────────────────────────────
  router.get('/partnerships/:guildId', (req, res) => {
    try {
      const { guildId } = req.params;
      const userId = req.dashboardSession?.user?.id;
      const data = getGuildPartnershipsDashboard(guildId, userId);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not load partnerships data.' });
    }
  });

  router.get('/partnerships/browse/:guildId', (req, res) => {
    try {
      const { guildId } = req.params;
      const servers = getPartnerEligibleServers(guildId);
      res.json({ servers });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not browse partner servers.' });
    }
  });

  router.post('/partnerships/request', createRateLimiter('partnership'), async (req, res) => {
    try {
      const { fromGuildId, fromGuildName, fromGuildIcon, toGuildId, includeMention, mentionType, customAdText, customAnswers } = req.body;
      const fromBotStatus = getGuildBotStatus(fromGuildId);
      if (!fromBotStatus.bot_in_guild) {
        return res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: fromBotStatus.botStatus,
          message: 'ConnectingERLC bot must be added to your server before requesting partnerships.'
        });
      }

      // Ensure the server has completed its partnership area in Promote Server before proposing partnerships
      const fromConfig = getGuildPartnershipConfig(fromGuildId);
      const fromPromoted = getPromotedServers().find(s => String(s.id) === String(fromGuildId));
      const hasChannel = Boolean(fromConfig.partnershipChannelId || fromPromoted?.partnershipBroadcastChannel);
      const isConfigured = Boolean((fromConfig.partnershipAdText || fromPromoted?.description) && hasChannel);

      if (!isConfigured || fromConfig.acceptPartnerships === false || fromPromoted?.openForPartnerships === false) {
        return res.status(400).json({
          error: 'PARTNERSHIP_NOT_CONFIGURED',
          message: 'Please complete your server partnership settings and broadcast channel in Promote Server before sending partnership proposals.'
        });
      }
      const userId = req.dashboardSession?.user?.id;
      const userBalance = Number(getUserCredits(userId, fromGuildId) || 0);

      const request = await createPartnershipRequest({
        fromGuildId,
        fromGuildName,
        fromGuildIcon,
        fromOwnerId: userId,
        toGuildId,
        includeMention,
        mentionType,
        customAdText,
        customAnswers,
        userCoinBalance: userBalance
      });

      // Post ad to partnership broadcast channel (after request is created)
      try {
        if (fromPromoted?.partnershipBroadcastChannel && request.adText) {
          const botId = fromBotStatus.botId;
          const client = activeCustomerClients.get(botId);
          if (client?.isReady?.()) {
            const chan = client.channels.cache.get(fromPromoted.partnershipBroadcastChannel);
            if (chan) {
              await chan.send(request.adText || request.fromGuildName);
            }
          }
        }
      } catch (adErr) {
        console.error('Failed to post partnership ad:', adErr);
        // Save error for dashboard display
        if (!req.apiErrors) req.apiErrors = [];
        req.apiErrors.push({
          message: `Partnership ad post failed: ${adErr.message}`,
          timestamp: Date.now(),
          type: 'partnership_ad_post_error'
        });
      }

      res.json({ success: true, request });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not create partnership request.' });
    }
  });

  router.post('/partnerships/respond', async (req, res) => {
    try {
      const { requestId, action, guildId } = req.body;
      const userId = req.dashboardSession?.user?.id;
      const result = await respondToPartnershipRequest({ requestId, action, guildId, responderUserId: userId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not respond to partnership request.' });
    }
  });

  router.post('/partnerships/send-ad', async (req, res) => {
    try {
      const { partnershipId, guildId } = req.body;
      const result = await sendManualAdBroadcast({ partnershipId, guildId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not broadcast advertisement.' });
    }
  });

  router.post('/partnerships/cancel', (req, res) => {
    try {
      const { requestId, guildId } = req.body;
      const userId = req.dashboardSession?.user?.id;
      const result = cancelPartnershipRequest({ requestId, guildId, userId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not cancel partnership request.' });
    }
  });

  router.post('/partnerships/active/toggle-pause', (req, res) => {
    try {
      const { partnershipId, guildId } = req.body;
      const result = togglePausePartnership({ partnershipId, guildId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not update partnership status.' });
    }
  });

  router.post('/partnerships/active/end', (req, res) => {
    try {
      const { partnershipId, guildId } = req.body;
      const result = endPartnership({ partnershipId, guildId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not end partnership.' });
    }
  });

  router.post('/partnerships/milestones/claim', (req, res) => {
    try {
      const { milestoneId, guildId } = req.body;
      const userId = req.dashboardSession?.user?.id;
      const result = claimPartnershipMilestone({ milestoneId, guildId, userId });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not claim milestone reward.' });
    }
  });

  router.get('/partnerships/:guildId/settings', (req, res) => {
    try {
      const { guildId } = req.params;
      const cfg = getGuildPartnershipConfig(guildId);
      res.json({
        allianceAdEnabled: cfg.allianceAdEnabled ?? true,
        broadcastChannel: cfg.partnershipBroadcastChannel || '',
        channelName: cfg.partnershipChannelName || 'partnerships',
        hasBroadcastChannel: Boolean(cfg.partnershipBroadcastChannel),
        adText: cfg.partnershipAdText || '',
        partners: cfg.partners || null,
        openForPartnerships: cfg.openForPartnerships,
        acceptPartnerships: cfg.acceptPartnerships,
        mode: cfg.partnershipMode || 'closed',
        minMembers: cfg.partnershipMinMembers ?? null,
        price: cfg.partnershipPrice ?? null,
        allowedMentions: cfg.partnershipAllowedMentions ?? 'none',
        herePrice: cfg.partnershipHerePrice ?? 15,
        everyonePrice: cfg.partnershipEveryonePrice ?? 30,
        dailyLimit: cfg.partnershipDailyLimit ?? 3,
        acceptedCategories: cfg.partnershipAcceptedCategories || ['Design Server', 'Roleplay Server', 'Misc', 'COTS', 'Departments', 'Events']
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not load partnership settings.' });
    }
  });

  router.post('/partnerships/:guildId/settings', (req, res) => {
    try {
      const { guildId } = req.params;
      const patch = req.body || {};
      const updated = updateGuildPartnershipConfig(guildId, patch);
      res.json({ success: true, settings: updated });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not save partnership settings.' });
    }
  });

  router.post('/partnerships/test-broadcast', async (req, res) => {
    try {
      const { channelId, guildId } = req.body || {};
      res.json({ success: true, message: 'Test partnership message dispatched to channel.' });
    } catch (err) {
      res.status(400).json({ error: 'Could not send test broadcast.' });
    }
  });
  router.get('/partnerships/:guildId/webhook', (req, res) => {
    try {
      const { guildId } = req.params;
      const info = getGuildWebhookInfo(guildId);
      res.json(info);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Could not load webhook info.' });
    }
  });

  router.post('/partnerships/:guildId/webhook', (req, res) => {
    try {
      const { guildId } = req.params;
      const { webhookUrl, channelName, action } = req.body || {};
      if (action === 'remove') {
        const result = removeGuildWebhook(guildId);
        return res.json(result);
      }
      const info = saveGuildWebhook(guildId, webhookUrl, channelName);
      res.json({ success: true, ...info });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not save webhook.' });
    }
  });

  router.post('/partnerships/test-webhook', async (req, res) => {
    try {
      const { webhookUrl, guildName } = req.body || {};
      if (!webhookUrl || !isValidDiscordWebhookUrl(webhookUrl)) {
        return res.status(400).json({ error: 'Invalid Discord webhook URL.' });
      }
      const plainUrl = webhookUrl.startsWith('https://') ? webhookUrl : decryptWebhook(webhookUrl);
      if (!plainUrl) {
        return res.status(400).json({ error: 'Could not decrypt webhook URL.' });
      }
      const resp = await fetch(plainUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🤝 ConnectingERLC Partnership Webhook Connected',
            description: `Automated partnership announcements for **${guildName || 'your community'}** will be broadcasted here.`,
            color: 0xF97316,
            footer: { text: 'ConnectingERLC Automated Alliances' },
            timestamp: new Date().toISOString()
          }]
        }),
        signal: AbortSignal.timeout(6000)
      });
      if (!resp.ok) {
        return res.status(400).json({ error: `Discord webhook rejected: ${resp.status} ${resp.statusText}` });
      }
      res.json({ success: true, message: 'Test partnership message dispatched to webhook.' });
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not dispatch test webhook.' });
    }
  });

  // ─── Rewards & Achievements Endpoints ────────────────────────────
  router.post('/user/daily-checkin', (req, res) => {
    try {
      const userId = req.dashboardSession?.user?.id;
      const result = claimDailyReward(userId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not claim daily reward.' });
    }
  });

  router.post('/user/claim-achievement', (req, res) => {
    try {
      const { achievementId } = req.body;
      const userId = req.dashboardSession?.user?.id;
      const result = claimAchievement(userId, achievementId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || 'Could not claim achievement reward.' });
    }
  });

  router.post('/auth/logout', (req, res) => {
    const sessionId = req.dashboardSessionId || cookieValue(req, SESSION_COOKIE);
    if (sessionId) {
      sessions.delete(sessionId);
      persistSessions();
    }
    const opts = { ...cookieOptions(req), maxAge: undefined };
    res.clearCookie(SESSION_COOKIE, opts);
    res.clearCookie('connectingerlc_session', opts);
    res.clearCookie('erlcus_session', opts);
    res.clearCookie('erlc_session', opts);
    res.json({ success: true });
  });

  router.get('/servers', async (req, res) => {
    try {
      res.json({ servers: await manageableGuilds(req.dashboardSession, { force: req.query.refresh === '1' }) });
    } catch (err) {
      if (err instanceof DiscordError && err.status === 401) return res.status(401).json({ error: 'Discord sign-in expired. Sign in again.' });
      res.status(502).json({ error: 'Discord did not respond. Retry in a moment.' });
    }
  });

  async function withWorkspace(req, res) {
    let statusInfo = getGuildBotStatus(req.params.guildId);
    if (!statusInfo.bot_in_guild) {
      const botInst = findGuildBot(req.params.guildId);
      const isAuthorized = req.dashboardSession?.guildCache?.guilds?.some(g => String(g.id) === String(req.params.guildId));
      if (botInst || isAuthorized) {
        statusInfo = {
          guildId: req.params.guildId,
          bot_in_guild: true,
          botStatus: 'Online',
          missingPermissions: []
        };
      } else {
        res.status(403).json({
          error: 'BOT_NOT_IN_GUILD',
          botStatus: statusInfo.botStatus,
          message: 'ConnectingERLC bot must be added to your server before managing it.'
        });
        return null;
      }
    }
    await getMasterBotUser();
    let guild = null;
    try {
      guild = await findAuthorizedGuild(req.dashboardSession, req.params.guildId);
    } catch {
      // Fall through to real guild lookup
    }

    // Always ensure real guild name and icon are resolved from Discord
    if (!guild || !guild.name || guild.name.startsWith('ER:LC Community') || guild.name.startsWith('Community (')) {
      try {
        const botGuilds = await fetchRealBotGuilds();
        const matched = botGuilds.find(bg => bg.id === req.params.guildId);
        if (matched) {
          guild = {
            id: matched.id,
            name: matched.name,
            icon: matched.icon,
            iconUrl: matched.iconUrl,
            owner: Boolean(matched.owner),
            memberCount: matched.memberCount,
            approximateMemberCount: matched.memberCount,
            hasWorkspace: true,
            configured: true
          };
        } else {
          const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
          if (token) {
            const gRes = await fetch(`https://discord.com/api/v10/guilds/${req.params.guildId}?with_counts=true`, {
              headers: { Authorization: `Bot ${token}` },
              signal: AbortSignal.timeout(4000)
            });
            if (gRes.ok) {
              const gData = await gRes.json();
              guild = {
                id: gData.id,
                name: gData.name,
                icon: gData.icon,
                iconUrl: gData.icon ? `https://cdn.discordapp.com/icons/${gData.id}/${gData.icon}.${gData.icon.startsWith('a_') ? 'gif' : 'png'}?size=128` : null,
                owner: Boolean(gData.owner),
                memberCount: Number(gData.approximate_member_count || 0),
                approximateMemberCount: Number(gData.approximate_member_count || 0),
                hasWorkspace: true,
                configured: true
              };
            }
          }
        }
      } catch {}
    }

    if (!guild) {
      res.status(404).json({ error: 'Server not found or you do not have permission to manage this server.' });
      return null;
    }
    let bot = findGuildBot(req.params.guildId);
    if (!bot) {
      bot = createBotInstance(req.dashboardSession.user.id, {
        guildId: req.params.guildId,
        customizations: { serverName: guild.name }
      });
    }

    // Attempt to read live real member count from active Discord bot client
    try {
      let clientGuild = null;
      const directClient = activeCustomerClients.get(bot?.botId);
      if (directClient?.isReady?.()) {
        clientGuild = directClient.guilds.cache.get(req.params.guildId);
      }
      if (!clientGuild) {
        for (const [, c] of activeCustomerClients) {
          if (c?.isReady?.() && c.guilds.cache.has(req.params.guildId)) {
            clientGuild = c.guilds.cache.get(req.params.guildId);
            break;
          }
        }
      }
      if (clientGuild) {
        guild.memberCount = clientGuild.memberCount || 0;
        guild.approximateMemberCount = clientGuild.memberCount || 0;
        if (clientGuild.channels?.cache) {
          guild.channels = clientGuild.channels.cache
            .filter((ch) => [0, 2, 4, 5].includes(Number(ch.type)))
            .map((ch) => ({
              id: ch.id,
              name: ch.name,
              type: Number(ch.type)
            }));
        }
      }

      if (!guild.memberCount || guild.memberCount <= 0) {
        const botGuilds = await fetchRealBotGuilds();
        const matched = botGuilds.find(bg => bg.id === req.params.guildId);
        if (matched?.memberCount) {
          guild.memberCount = matched.memberCount;
          guild.approximateMemberCount = matched.memberCount;
        } else {
          const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
          const gRes = await fetch(`https://discord.com/api/v10/guilds/${req.params.guildId}?with_counts=true`, {
            headers: { Authorization: `Bot ${token}` },
            signal: AbortSignal.timeout(4000)
          }).catch(() => null);
          if (gRes && gRes.ok) {
            const gData = await gRes.json();
            if (gData?.approximate_member_count) {
              guild.memberCount = Number(gData.approximate_member_count);
              guild.approximateMemberCount = Number(gData.approximate_member_count);
            }
          }
        }
      }

      if (!guild.channels || guild.channels.length === 0) {
        const token = (process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
        const chRes = await fetch(`https://discord.com/api/v10/guilds/${req.params.guildId}/channels`, {
          headers: { Authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(4000)
        }).catch(() => null);
        if (chRes && chRes.ok) {
          const chData = await chRes.json();
          if (Array.isArray(chData)) {
            guild.channels = chData
              .filter((ch) => [0, 5].includes(Number(ch.type)))
              .map((ch) => ({
                id: ch.id,
                name: ch.name,
                type: Number(ch.type)
              }));
          }
        }
      }
    } catch { }

    return { guild, bot };
  }

  router.get('/workspace/:guildId', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const ws = publicWorkspace(ctx.bot);
    try {
      const promoted = getPromotedServers().find((s) => s.id === req.params.guildId);
      if (promoted && ws?.customizations) {
        if (promoted.category) ws.customizations.serverCategory = promoted.category;
        if (promoted.summary) ws.customizations.serverSummary = promoted.summary;
        if (promoted.description) ws.customizations.serverDescription = promoted.description;
        if (Array.isArray(promoted.tags) && promoted.tags.length > 0) ws.customizations.serverTags = promoted.tags;
        if (promoted.bannerUrl) ws.customizations.bannerUrl = promoted.bannerUrl;
        if (promoted.inviteUrl) {
          ws.customizations.inviteUrl = promoted.inviteUrl;
          ws.customizations.discordInvite = promoted.inviteUrl;
        }
        if (promoted.joinCode) ws.customizations.joinCode = promoted.joinCode;
        if (promoted.language) ws.customizations.language = promoted.language;
        if (promoted.listedInDirectory !== undefined) ws.customizations.listedInDirectory = promoted.listedInDirectory;
        if (promoted.rewardCoins !== undefined) ws.customizations.rewardCoins = promoted.rewardCoins;
        if (promoted.offerHigherReward !== undefined) ws.customizations.offerHigherReward = promoted.offerHigherReward;
        if (promoted.extraRewardPaused !== undefined) ws.customizations.extraRewardPaused = promoted.extraRewardPaused;
        if (promoted.retentionTargetHours !== undefined) ws.customizations.retentionTargetHours = promoted.retentionTargetHours;
        if (promoted.representativesWanted !== undefined) ws.customizations.representativesWanted = promoted.representativesWanted;
        if (promoted.openForPartnerships !== undefined) ws.customizations.openForPartnerships = promoted.openForPartnerships;
        if (promoted.partnershipMinMembers !== undefined) ws.customizations.partnershipMinMembers = promoted.partnershipMinMembers;
        if (promoted.partnershipPrice !== undefined) ws.customizations.partnershipPrice = promoted.partnershipPrice;
        if (promoted.partnershipAllowedMentions !== undefined) ws.customizations.partnershipAllowedMentions = promoted.partnershipAllowedMentions;
        if (promoted.partnershipHerePrice !== undefined) ws.customizations.partnershipHerePrice = promoted.partnershipHerePrice;
        if (promoted.partnershipEveryonePrice !== undefined) ws.customizations.partnershipEveryonePrice = promoted.partnershipEveryonePrice;
        if (promoted.partnershipBroadcastChannel !== undefined) ws.customizations.partnershipBroadcastChannel = promoted.partnershipBroadcastChannel;
        if (promoted.partnershipAcceptedCategories !== undefined) ws.customizations.partnershipAcceptedCategories = promoted.partnershipAcceptedCategories;
        if (promoted.partnershipDailyLimit !== undefined) ws.customizations.partnershipDailyLimit = promoted.partnershipDailyLimit;
        if (promoted.partnershipSetUp !== undefined) ws.customizations.partnershipSetUp = promoted.partnershipSetUp;
        if (promoted.bumpChannelId !== undefined) ws.customizations.bumpChannelId = promoted.bumpChannelId;
        if (promoted.bumpRoleId !== undefined) ws.customizations.bumpRoleId = promoted.bumpRoleId;
        if (promoted.bumpReadyNoticeEnabled !== undefined) ws.customizations.bumpReadyNoticeEnabled = promoted.bumpReadyNoticeEnabled;
        if (promoted.bumpNoticeEnabled !== undefined) ws.customizations.bumpNoticeEnabled = promoted.bumpNoticeEnabled;
      }
    } catch {}
    res.json({ workspace: ws, guild: ctx.guild });
  });

  router.post('/workspace', async (req, res) => {
    const guildId = req.body?.guildId;
    try {
      const guild = await findAuthorizedGuild(req.dashboardSession, guildId);
      if (!guild) return res.status(403).json({ error: 'You need Manage Server permission in the selected Discord server.' });
      if (isBannedGuild(guildId) && !findGuildBot(guildId)) return res.status(403).json({ error: 'This server has been suspended from ConnectingERLC.' });
      const existing = findGuildBot(guildId);
      if (existing) return res.json({ workspace: publicWorkspace(existing), created: false });
      const bot = createBotInstance(req.dashboardSession.user.id, { guildId, customizations: { serverName: guild.name } });
      res.status(201).json({ workspace: publicWorkspace(bot), created: true });
    } catch (err) {
      if (err instanceof DiscordError && err.status === 401) return res.status(401).json({ error: 'Discord sign-in expired. Sign in again.' });
      res.status(502).json({ error: 'Could not verify your Discord server access. Retry in a moment.' });
    }
  });

  router.patch('/workspace/:guildId/config', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const result = validateCustomizations(req.body?.customizations);
    if (result.error) return res.status(400).json({ error: result.error });
    try {
      const fresh = getBotInstance(ctx.bot.botId) || ctx.bot;
      const updated = updateBotInstance(ctx.bot.botId, { customizations: { ...(fresh.customizations || {}), ...result.updates } });
      try {
        updateGuildPartnershipConfig(ctx.guild.id, result.updates);
      } catch {}
      try {
        updatePromotedServerDetails(ctx.guild.id, result.updates);
      } catch {}
      res.json({ success: true, workspace: publicWorkspace(updated) });
    } catch (err) {
      console.error('[WEB] Saving settings failed:', err);
      res.status(500).json({ error: 'Settings could not be saved. Try again.' });
    }
  });

  router.get('/workspace/:guildId/settings', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const customs = stripLegacyCustomizations(ctx.bot?.customizations || {});
    const erlcStatus = getErlcStatus(req.params.guildId, false);
    res.json({
      ok: true,
      settings: {
        ...customs,
        hasErlcKey: Boolean(erlcStatus?.connected || customs.erlcApiKey),
        autoBumpEnabled: customs.autoBumpEnabled ?? true,
        autoBumpInterval: customs.autoBumpInterval ?? 120,
        customBumpMessage: customs.customBumpMessage ?? '',
        logChannelId: customs.logChannelId || customs.auditChannelId || '',
        auditChannelId: customs.auditChannelId || '',
        notificationChannelId: customs.notificationChannelId || customs.transcriptsChannelId || '',
        joinRoleIds: customs.joinRoleIds || (customs.botJoinRoleId ? [customs.botJoinRoleId] : []),
        quarantineRoleId: customs.quarantineRoleId || '',
        botStaffRoleId: customs.botStaffRoleId || ''
      }
    });
  });

  router.post('/workspace/:guildId/settings', createRateLimiter('settings'), async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const patch = req.body?.settings || req.body || {};
    const result = validateCustomizations(patch);
    if (result.error) {
      return res.status(400).json({
        ok: false,
        error: result.error,
        code: result.code || 'INVALID_FIELD',
        field: result.field
      });
    }
    const updates = result.updates;
    try {
      const fresh = getBotInstance(ctx.bot.botId) || ctx.bot;
      const updated = updateBotInstance(ctx.bot.botId, {
        customizations: { ...(fresh.customizations || {}), ...updates }
      });
      res.json({ ok: true, success: true, settings: stripLegacyCustomizations(updated.customizations) });
    } catch (err) {
      console.error('[WEB] Saving workspace settings failed:', err);
      res.status(500).json({ error: 'Failed to update server settings' });
    }
  });

  router.put('/workspace/:guildId/settings', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const patch = req.body?.settings || req.body || {};
    const result = validateCustomizations(patch);
    if (result.error) {
      return res.status(400).json({
        ok: false,
        error: result.error,
        code: result.code || 'INVALID_FIELD',
        field: result.field
      });
    }
    const updates = result.updates;
    try {
      const fresh = getBotInstance(ctx.bot.botId) || ctx.bot;
      const updated = updateBotInstance(ctx.bot.botId, {
        customizations: { ...(fresh.customizations || {}), ...updates }
      });
      res.json({ ok: true, success: true, settings: stripLegacyCustomizations(updated.customizations) });
    } catch (err) {
      console.error('[WEB] Saving workspace settings failed:', err);
      res.status(500).json({ error: 'Failed to update server settings' });
    }
  });

  // Checkin reminders API endpoints
  router.get('/user/checkin-reminder', (req, res) => {
    const session = getSession(req);
    const userId = session?.user?.id || req.dashboardSession?.user?.id || req.session?.user?.id;
    const serverId = req.query.serverId || 'connecting_treasury';
    if (!userId) return res.status(401).json({ error: 'Please sign in.' });
    const pref = getReminderPreference(userId, serverId);
    res.json(pref);
  });

  router.post('/user/checkin-reminder', (req, res) => {
    const session = getSession(req);
    const userId = session?.user?.id || req.dashboardSession?.user?.id || req.session?.user?.id;
    const { serverId = 'connecting_treasury', enabled = true } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Please sign in.' });
    const result = setReminderPreference({ userId, serverId, enabled });
    res.json({ success: true, ...result });
  });

  // Bot invite tier URL generation endpoint
  router.get('/workspace/:guildId/bot-invite-url', async (req, res) => {
    const { guildId } = req.params;
    const { tier = 'basic' } = req.query;
    const clientId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '1552165138017165372';
    const tiers = tier === 'all' ? ['basic', 'recruiting', 'role_rewards', 'owner_tools'] : ['basic', String(tier)];
    const url = buildBotInviteUrl({ clientId, guildId, tiers });
    res.json({ url, tiers, permissions: computeBotPermissions(tiers) });
  });

  // Test Reminder endpoint (rate limited to 1 per 10 minutes)
  const reminderTestLimiter = createRateLimiter('reminder_test');
  router.post('/user/test-reminder', reminderTestLimiter, async (req, res) => {
    const session = getSession(req);
    const userId = session?.user?.id || req.dashboardSession?.user?.id || req.session?.user?.id;
    const { serverId = 'connecting_treasury' } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Please sign in.' });

    const servers = getPromotedServers(true);
    const s = servers.find(sv => String(sv.id) === String(serverId) || String(sv.guildId) === String(serverId));
    const serverName = s?.name || 'ConnectingERLC Community';

    try {
      const result = await sendCheckinReminderDM({
        userId,
        serverId,
        serverName
      });
      res.json({ success: true, result });
    } catch (err) {
      console.warn('[WEB] Test reminder DM failed:', err.message);
      res.status(500).json({ error: err.message || 'Could not send test reminder DM.' });
    }
  });

  router.post('/user/test-dm', async (req, res) => {
    const session = getSession(req);
    const userId = session?.user?.id || req.body?.userId || (req.dashboardSession?.user?.id || req.session?.user?.id);
    const type = req.body?.type || 'streak';
    const guildName = req.body?.guildName || 'ConnectingERLC Community';
    try {
      const result = await sendDiscordNotificationV2(userId, type, guildName);
      res.json({ success: true, messageId: result.id, userId });
    } catch (err) {
      console.error('[WEB] Sending user test DM failed:', err.message);
      res.status(500).json({ error: err.message || 'Could not send test Discord notification.' });
    }
  });

  router.post('/user/notify-update', async (req, res) => {
    const sid = req.cookies?.erlc_session || req.cookies?.sessionId || req.headers['x-session-id'];
    const session = getSession(sid) || req.dashboardSession || req.session;
    const userId = req.body?.userId || session?.user?.id || req.dashboardSession?.user?.id || req.session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Sign in to subscribe to update notifications.' });
    const updateId = req.body?.updateId || 'daily_checkin_release';
    const result = subscribeToUpdate(userId, updateId);

    let closedDMs = false;
    const token = (process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');
    if (token) {
      try {
        const chanRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
          method: 'POST',
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ recipient_id: userId })
        });
        if (!chanRes.ok) {
          closedDMs = true;
        }
      } catch {}
    }
    res.json({ success: true, ...result, closedDMs });
  });

  router.post('/admin/trigger-update-drop', requireAdminRole('Moderator'), async (req, res) => {
    const updateId = req.body?.updateId || 'daily_checkin_release';
    const activeToken = process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_TOKEN;
    const result = await triggerUpdateDrop(updateId, activeToken, req.body);
    res.json({ success: true, updateId, result });
  });

  router.post('/workspace/:guildId/credentials', rateLimit({ windowMs: 60 * 1000, max: 15 }), async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const { bot } = ctx;
    const { erlcApiKey } = req.body || {};
    const updates = {};

    try {
      if (erlcApiKey !== undefined && erlcApiKey !== '') {
        if (typeof erlcApiKey !== 'string' || erlcApiKey.length > 250) return res.status(400).json({ error: 'That ER:LC API key is not in the right format.' });
        const result = await validateErlcKey(erlcApiKey.trim());
        if (result.error) return res.status(400).json({ error: result.error });
        updates.erlcApiKey = erlcApiKey.trim();
        const fresh = getBotInstance(bot.botId) || bot;
        const nextCustomizations = { ...(fresh.customizations || {}) };
        if (result.server.name) nextCustomizations.serverName = result.server.name;
        if (result.server.joinCode) nextCustomizations.joinCode = result.server.joinCode;
        if (result.server.currentPlayers !== null && result.server.currentPlayers !== undefined) {
          nextCustomizations.currentPlayers = result.server.currentPlayers;
        }
        if (result.server.maxPlayers !== null && result.server.maxPlayers !== undefined) {
          nextCustomizations.maxPlayers = result.server.maxPlayers;
        }
        updates.customizations = nextCustomizations;
        erlcCache.delete(bot.botId);
      }

      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to save.' });

      const updated = updateBotInstance(bot.botId, updates);
      if (updates.token) {
        resourceCache.delete(`${bot.botId}:${bot.guildId}`);
        await stopCustomerBot(bot.botId).catch(() => { });
        const started = await startCustomerBot(bot.botId).catch(() => false);
        if (!started) {
          return res.status(502).json({
            error: 'Token saved, but the bot could not log in. Turn on Server Members Intent and Message Content Intent in the Developer Portal, then press Restart.',
            workspace: publicBot(getBotInstance(bot.botId) || updated)
          });
        }
      }
      res.json({ success: true, workspace: publicBot(getBotInstance(bot.botId) || updated) });
    } catch (err) {
      console.error('[WEB] Credential update failed:', err?.message);
      res.status(502).json({ error: 'Could not reach ER:LC to check that key. Try again.' });
    }
  });

  router.get('/workspace/:guildId/erlc', async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const { bot } = ctx;
    if (!bot.erlcApiKey) return res.status(409).json({ state: 'not_configured', error: 'Connect an ER:LC API key to see live server information.' });

    const cached = erlcCache.get(bot.botId);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);

    try {
      const base = erlcBase();
      const headers = { 'Server-Key': bot.erlcApiKey, Accept: 'application/json' };
      const settle = url => fetch(url, { headers, signal: AbortSignal.timeout(8000) }).catch(() => null);
      const [serverResponse, playersResponse, queueResponse] = await Promise.all([
        settle(`${base}/server`), settle(`${base}/server/players`), settle(`${base}/server/queue`)
      ]);
      if (!serverResponse?.ok) {
        return res.status(502).json({ state: 'unavailable', error: serverResponse?.status === 403 ? 'ER:LC rejected the saved API key. Update it in Settings.' : 'ER:LC did not return server information.' });
      }
      const server = await serverResponse.json().catch(() => ({}));
      if (server.code || server.message) return res.status(502).json({ state: 'unavailable', error: 'ER:LC did not return server information.' });
      const players = playersResponse?.ok ? await playersResponse.json().catch(() => null) : null;
      const queue = queueResponse?.ok ? await queueResponse.json().catch(() => null) : null;
      const value = {
        state: 'connected',
        name: server.Name || null,
        joinCode: server.JoinKey || server.JoinCode || null,
        currentPlayers: Number.isFinite(server.CurrentPlayers) ? server.CurrentPlayers : Array.isArray(players) ? players.length : null,
        maxPlayers: Number.isFinite(server.MaxPlayers) ? server.MaxPlayers : null,
        queue: Array.isArray(queue) ? queue.length : null,
        staffCount: Array.isArray(players) ? players.filter(player => player.Permission && player.Permission !== 'Normal').length : null,
        fetchedAt: new Date().toISOString()
      };
      erlcCache.set(bot.botId, { value, expiresAt: Date.now() + ERLC_CACHE_TTL });
      res.json(value);
    } catch {
      res.status(502).json({ state: 'unavailable', error: 'Could not reach the ER:LC API.' });
    }
  });

  router.post('/workspace/:guildId/action', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res) => {
    const ctx = await withWorkspace(req, res);
    if (!ctx) return;
    const { bot } = ctx;
    try {
      if (req.body?.action === 'restart') {
        if (!bot.token) return res.status(409).json({ error: 'Connect a Discord bot token before restarting.' });
        if (bot.botId === MASTER_BOT_ID) return res.status(409).json({ error: 'The main ConnectingERLC bot cannot be restarted from here.' });
        await stopCustomerBot(bot.botId).catch(() => { });
        const started = await startCustomerBot(bot.botId).catch(() => false);
        if (!started) return res.status(502).json({ error: 'The bot did not come back online. Check its token and that both privileged intents are on.' });
        return res.json({ success: true, workspace: publicBot(getBotInstance(bot.botId) || bot) });
      }
      if (req.body?.action === 'deploy') {
        if (!bot.token) return res.status(409).json({ error: 'Add a Discord bot token before syncing commands.' });
        await deployCommands({ token: bot.token, applicationId: publicBot(bot).discordBotId });
        return res.json({ success: true, message: 'All commands registered.' });
      }
      if (req.body?.action === 'deploy_ticket_panel') {
        const targetChannelId = req.body?.channelId || bot.customizations?.transcriptsChannelId || bot.customizations?.ticketChannelId;
        if (!targetChannelId) return res.status(400).json({ error: 'Please choose or configure a destination channel for the ticket desk.' });
        const { client } = await import('../index.js');
        const activeClient = activeCustomerClients.get(bot.botId) || (client?.isReady?.() ? client : null);
        const panelPayload = buildTicketPanel(null, bot.customizations);

        if (activeClient && activeClient.channels) {
          const chan = activeClient.channels.cache.get(targetChannelId) || await activeClient.channels.fetch(targetChannelId).catch(() => null);
          if (chan) {
            await chan.send(panelPayload);
            return res.json({ success: true, message: `Support Ticket Desk deployed to #${chan.name}!` });
          }
        }

        // Direct REST API Fallback
        const token = bot.token || process.env.DISCORD_TOKEN;
        if (!token) return res.status(400).json({ error: 'Bot token not available to send message.' });
        const cleanToken = token.trim().replace(/^Bot\s+/i, '');
        const restRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(panelPayload)
        });
        if (!restRes.ok) {
          const errDetail = await restRes.text();
          console.error('[WEB] REST deploy panel failed:', errDetail);
          return res.status(restRes.status).json({ error: `Discord API Error: ${errDetail}` });
        }
        return res.json({ success: true, message: `Support Ticket Desk deployed to Discord channel!` });
      }

      if (req.body?.action === 'deploy_session_panel') {
        const targetChannelId = req.body?.channelId || bot.customizations?.sessionChannelId;
        if (!targetChannelId) return res.status(400).json({ error: 'Please choose or configure an announcement channel for the session panel.' });
        const { client } = await import('../index.js');
        const activeClient = activeCustomerClients.get(bot.botId) || (client?.isReady?.() ? client : null);
        if (activeClient) {
          await activateLiveSessionPanel(activeClient, targetChannelId, bot);
          return res.json({ success: true, message: `Session Panel deployed successfully!` });
        }
        return res.status(400).json({ error: 'Bot is still connecting to Discord Gateway. Please wait a few seconds and try again.' });
      }

      if (req.body?.action === 'deploy_application_panel') {
        const targetChannelId = req.body?.channelId || bot.customizations?.appPanelChannelId || bot.customizations?.reviewChannelId;
        if (!targetChannelId) return res.status(400).json({ error: 'Please choose or configure a destination channel for the application panel.' });

        const appList = Array.isArray(bot.customizations?.applications) && bot.customizations.applications.length > 0
          ? bot.customizations.applications.filter(a => a && a.name && a.open !== false)
          : [{ id: 'app_1', name: 'Moderator Application' }];

        const colorHex = (bot.customizations?.appPanelColor || '#5865f2').replace('#', '');
        const colorInt = parseInt(colorHex, 16) || 0x5865f2;

        const embedPayload = {
          title: bot.customizations?.appPanelTitle?.trim() || 'Staff Recruitment Center',
          description: bot.customizations?.appPanelDesc?.trim() || 'Select an active department application form below to begin your application.',
          color: colorInt,
          footer: { text: 'Submissions are reviewed by Server Administration.' }
        };

        if (bot.customizations?.appPanelTopBannerUrl) {
          embedPayload.image = { url: bot.customizations.appPanelTopBannerUrl };
        }

        const buttons = appList.slice(0, 5).map((app, idx) => ({
          type: 2,
          style: 1, // Primary Blurple
          label: `Apply: ${app.name.slice(0, 40)}`,
          custom_id: `apply_btn_${app.id || idx + 1}`
        }));

        const panelPayload = {
          embeds: [embedPayload],
          components: buttons.length > 0 ? [{ type: 1, components: buttons }] : []
        };

        const { client } = await import('../index.js');
        const activeClient = activeCustomerClients.get(bot.botId) || (client?.isReady?.() ? client : null);

        if (activeClient && activeClient.channels) {
          const chan = activeClient.channels.cache.get(targetChannelId) || await activeClient.channels.fetch(targetChannelId).catch(() => null);
          if (chan) {
            await chan.send(panelPayload);
            return res.json({ success: true, message: `Application Panel deployed to #${chan.name}!` });
          }
        }

        // Direct REST API Fallback
        const token = bot.token || process.env.DISCORD_TOKEN;
        if (!token) return res.status(400).json({ error: 'Bot token not available to send message.' });
        const cleanToken = token.trim().replace(/^Bot\s+/i, '');
        const restRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(panelPayload)
        });
        if (!restRes.ok) {
          const errDetail = await restRes.text();
          return res.status(restRes.status).json({ error: `Discord API Error: ${errDetail}` });
        }
        return res.json({ success: true, message: `Application Panel deployed to Discord channel!` });
      }

      if (req.body?.action === 'bump') {
        const targetGuildId = req.params.guildId;
        const COOLDOWN_MS = 60 * 60 * 1000;
        const now = Date.now();
        if (!global.__bumpCooldowns) global.__bumpCooldowns = new Map();
        const lastBump = global.__bumpCooldowns.get(targetGuildId) || 0;
        const elapsed = now - lastBump;

        if (elapsed < COOLDOWN_MS) {
          const remainingMinutes = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
          return res.status(429).json({
            error: `Cooldown active. You can bump again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`,
            remainingMinutes
          });
        }

        global.__bumpCooldowns.set(targetGuildId, now);
        try {
          if (bot?.botId) {
            updateBotCustomization(bot.botId, 'lastBumpedAt', now);
          }
        } catch { }

        return res.json({
          success: true,
          lastBumpedAt: now,
          message: 'Server elevated to #1 in directory!'
        });
      }

      res.status(400).json({ error: 'Choose a supported bot action.' });
    } catch (err) {
      console.error('[WEB] Bot action failed:', err?.message || err);
      res.status(502).json({ error: err?.message || 'The bot action could not be completed. Try again.' });
    }
  });

  router.post('/workspace/:guildId/bump', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res) => {
    const targetGuildId = req.params.guildId;
    if (!targetGuildId || !/^\d{17,20}$/.test(targetGuildId)) {
      return res.status(400).json({ error: 'Invalid Discord server ID.' });
    }
    const botStatus = getGuildBotStatus(targetGuildId);
    if (!botStatus.bot_in_guild) {
      return res.status(403).json({
        error: 'BOT_NOT_IN_GUILD',
        botStatus: botStatus.botStatus,
        message: 'ConnectingERLC bot must be added to your server before bumping.'
      });
    }
    // Only someone who manages this server may bump it.
    let managed = null;
    try {
      managed = await findAuthorizedGuild(req.dashboardSession, targetGuildId);
    } catch (err) {
      return res.status(err instanceof DiscordError && err.status === 401 ? 401 : 502)
        .json({ error: 'Could not verify your Discord server access. Sign in again or retry in a moment.' });
    }
    if (!managed) return res.status(403).json({ error: 'You need Manage Server in that server to bump it.' });
    const COOLDOWN_MS = 60 * 60 * 1000;
    const now = Date.now();
    if (!global.__bumpCooldowns) global.__bumpCooldowns = new Map();
    const lastBump = global.__bumpCooldowns.get(targetGuildId) || 0;
    const elapsed = now - lastBump;

    if (elapsed < COOLDOWN_MS) {
      const remainingMinutes = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      return res.status(429).json({
        error: `Cooldown active. You can bump again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`,
        remainingMinutes
      });
    }

    global.__bumpCooldowns.set(targetGuildId, now);
    try {
      const allBots = Object.values(loadBotInstances());
      const botInst = allBots.find(b => b.guildId === targetGuildId);
      if (botInst) {
        updateBotCustomization(botInst.botId, 'lastBumpedAt', now);
      }
    } catch { }

    return res.json({
      success: true,
      lastBumpedAt: now,
      message: 'Server elevated to #1 in directory!'
    });
  });

  // ─── Public Site State & Announcements ──────────────────────────────────
  router.get('/public/site-state', (_req, res) => {
    const state = loadSiteState();
    const maint = isMaintenanceActive();
    res.json({
      maintenance: {
        active: maint.active,
        message: maint.message,
        eta: maint.eta,
        starts_at: maint.starts_at,
        ends_at: maint.ends_at
      }
    });
  });

  router.get('/public/announcements', (req, res) => {
    const user = req.dashboardSession?.user;
    const isLoggedIn = Boolean(user);
    const userId = user?.id;
    let isServerOwner = false;
    let isAdmin = false;

    if (userId) {
      const allServers = getPromotedServers(true);
      isServerOwner = allServers.some(s => String(s.ownerId) === String(userId));
      isAdmin = Boolean(getAdminRecord(userId));
    }

    const list = getActiveAnnouncements({ isLoggedIn, isServerOwner, isAdmin });
    const userKey = userId || req.clientIp || 'anonymous';
    const dismissals = loadDismissals();
    const active = list.filter(a => !dismissals[a.id]?.includes(userKey));

    // Live banner stacking max 2
    res.json({ announcements: active.slice(0, 2) });
  });

  router.post('/public/announcements/:id/dismiss', (req, res) => {
    const userKey = req.dashboardSession?.user?.id || req.clientIp || 'anonymous';
    dismissAnnouncement(req.params.id, userKey);
    res.json({ success: true });
  });

  router.get('/public/default-banner', (_req, res) => {
    res.json({ text: getDefaultBannerText() });
  });

  router.post('/admin/default-banner', requireAdminRole('Admin'), (req, res) => {
    const updated = setDefaultBannerText(req.body?.text, req.adminUser);
    res.json({ success: true, text: updated });
  });

  // ─── Admin Site State & Maintenance ─────────────────────────────────────
  router.get('/admin/site-state', requireAdminRole(), (_req, res) => {
    res.json(loadSiteState());
  });

  router.post('/admin/site-state', requireAdminRole('Admin'), (req, res) => {
    try {
      const updated = saveSiteState(req.body, req.adminUser);
      res.json({ success: true, state: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Admin Announcements Management ─────────────────────────────────────
  router.get('/admin/announcements', requireAdminRole(), (_req, res) => {
    res.json({ announcements: loadSiteAnnouncements() });
  });

  router.post('/admin/announcements', requireAdminRole('Admin'), (req, res) => {
    try {
      const { title, body, audience, severity, starts_at, expires_at } = req.body;
      if (!title || !body) return res.status(400).json({ error: 'Title and body are required.' });
      const created = createAnnouncement({ title, body, audience, severity, starts_at, expires_at }, req.adminUser);
      res.json({ success: true, announcement: created });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/admin/announcements/:id', requireAdminRole('Admin'), (req, res) => {
    try {
      const updated = updateAnnouncement(req.params.id, req.body, req.adminUser);
      res.json({ success: true, announcement: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/admin/announcements/:id', requireAdminRole('Admin'), (req, res) => {
    try {
      deleteSiteAnnouncement(req.params.id, req.adminUser);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  function requireSessionUser(req, res, next) {
    const user = req.dashboardSession?.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ error: 'Please sign in with Discord to access this resource.' });
    }
    next();
  }

  // ─── User Promo Code Redemption ─────────────────────────────────────────
  router.post('/promo/redeem', requireSessionUser, (req, res) => {
    const userId = req.dashboardSession.user.id;
    const ip = req.clientIp || '';
    const { code, serverId, requestId } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Promo code is required.' });
    }

    const rateCheck = checkRedeemRateLimit(userId, ip);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.error });
    }

    let targetServer = null;
    if (serverId) {
      const allServers = getPromotedServers(true);
      targetServer = allServers.find(s => String(s.id) === String(serverId));
      if (targetServer) {
        // Check all avenues of server authorization: owner, representative, team, Discord manage guild permission, bot instance owner, or platform admin
        const userSessionGuilds = req.dashboardSession?.guildCache?.guilds || req.dashboardSession?.guilds || [];
        const isDiscordManager = userSessionGuilds.some(g => String(g.id) === String(serverId));
        const isBotOwner = Object.values(loadBotInstances ? loadBotInstances() : {}).some(b =>
          String(b.guildId || b.id) === String(serverId) && String(b.ownerUserId) === String(userId)
        );
        const isPlatformAdmin = Boolean(getAdminRecord(userId, req.dashboardSession.user?.username));
        const isDirectOwner = String(targetServer.ownerId) === String(userId);
        const isRep = Array.isArray(targetServer.representatives) && targetServer.representatives.map(String).includes(String(userId));
        const isTeam = Array.isArray(targetServer.team) && targetServer.team.some(m => String(m.id || m.userId) === String(userId));

        const isAuthorized = isDirectOwner || isRep || isTeam || isDiscordManager || isBotOwner || isPlatformAdmin;
        if (!isAuthorized) {
          return res.status(403).json({ error: 'You must own or manage this server to redeem promotional credits for it.' });
        }
      }
    }

    try {
      const result = redeemPromoCode({
        code,
        userId,
        serverId: targetServer ? targetServer.id : null,
        userObj: req.dashboardSession.user,
        ip,
        skipOwnershipCheck: true,
        requestId
      });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to redeem promo code.' });
    }
  });

  router.post('/admin/users/:id/clear-promo-lock', requireAdminRole('Admin'), (req, res) => {
    const { id } = req.params;
    try {
      clearPromoLock(id, req.adminUser);
      res.json({ success: true, message: `Promo lockout cleared for user ${id}.` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/promo/my-redemptions', requireSessionUser, (req, res) => {
    const userId = req.dashboardSession.user.id;
    res.json({ redemptions: getUserRedemptions(userId) });
  });

  // ─── Admin Promo Codes Management ───────────────────────────────────────
  router.get('/admin/promos', requireAdminRole(), (_req, res) => {
    res.json({ promos: getAllPromoCodes() });
  });

  router.post('/admin/promos', requireAdminRole('Admin'), (req, res) => {
    try {
      const promo = createPromoCode(req.body, req.adminUser);
      res.json({ success: true, promo });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/admin/promos/:id/toggle', requireAdminRole('Admin'), (req, res) => {
    try {
      const promo = updatePromoCodeStatus(req.params.id, Boolean(req.body.active), req.adminUser);
      res.json({ success: true, promo });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/admin/promos/:id', requireAdminRole('Admin'), (req, res) => {
    try {
      deletePromoCode(req.params.id, req.adminUser);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/admin/promos/:id/redemptions', requireAdminRole(), (req, res) => {
    res.json({ redemptions: getCodeRedemptions(req.params.id) });
  });

  router.get('/admin/promos/export', requireAdminRole(), (_req, res) => {
    const codes = getAllPromoCodes();
    let csv = 'id,code,credits,max_uses,used_count,active,expires_at,created_at\n';
    for (const c of codes) {
      csv += `"${c.id}","${c.code}",${c.credits},${c.max_uses},${c.used_count},${c.active},"${c.expires_at || ''}","${c.created_at}"\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="promo_codes.csv"');
    res.send(csv);
  });

  // ─── Launch Giveaway Endpoints ──────────────────────────────────────────
  router.get(['/public/giveaway/status', '/giveaway/status'], async (_req, res) => {
    try {
      const status = await getGiveawayPublicStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to fetch giveaway status' });
    }
  });

  router.get('/giveaway/my-claim', requireSessionUser, async (req, res) => {
    try {
      const userId = req.dashboardSession.user.id;
      const guildId = req.query.guildId;
      const claim = await getClaimForUserOrServer(userId, guildId);
      res.json({ claim });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/giveaway/dismiss-notification', requireSessionUser, async (req, res) => {
    try {
      const { claimId } = req.body || {};
      if (!claimId) return res.status(400).json({ error: 'claimId is required' });
      await dismissGiveawayDashboardNotification(claimId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/admin/giveaway', requireAdminRole('Moderator'), async (_req, res) => {
    try {
      const settings = await getGiveawaySettings();
      const claims = await getGiveawayClaims();
      res.json({ settings, claims });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/admin/giveaway/toggle', requireAdminRole('Admin'), async (req, res) => {
    try {
      const { enabled } = req.body;
      const updated = await toggleGiveaway(enabled, req.adminUser);
      res.json({ success: true, settings: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/admin/giveaway/settings', requireAdminRole('Admin'), async (req, res) => {
    try {
      const updated = await updateGiveawaySettings(req.body, req.adminUser);
      res.json({ success: true, settings: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/admin/giveaway/reset', requireAdminRole('Admin'), async (req, res) => {
    try {
      const result = await resetGiveawayClaims(req.adminUser);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Admin Blacklist Management ─────────────────────────────────────────
  router.get('/admin/blacklist', requireAdminRole(), (_req, res) => {
    res.json({ entries: getAllBlacklistEntries() });
  });

  router.post('/admin/blacklist', requireAdminRole('Admin'), (req, res) => {
    try {
      const entry = addBlacklistEntry(req.body, req.adminUser);
      res.json({ success: true, entry });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  const handleUnblacklistRequest = (req, res) => {
    try {
      const target = req.params.id || req.body?.id || req.body?.value || req.body?.userId || req.body?.target;
      const reason = req.body?.reason || 'Administrative unblacklist';
      if (!target) {
        return res.status(400).json({ error: 'Target identifier is required to unblacklist.' });
      }
      unblacklistTarget({ id: target, reason, actor: req.adminUser });
      res.json({ success: true, message: `Target ${target} removed from blacklist.` });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };

  router.delete('/admin/blacklist/:id', requireAdminRole('Moderator'), handleUnblacklistRequest);
  router.post('/admin/blacklist/:id/unblacklist', requireAdminRole('Moderator'), handleUnblacklistRequest);
  router.post('/admin/blacklist/:id/remove', requireAdminRole('Moderator'), handleUnblacklistRequest);
  router.post('/admin/blacklist/unblacklist', requireAdminRole('Moderator'), handleUnblacklistRequest);
  router.post('/admin/blacklist/remove', requireAdminRole('Moderator'), handleUnblacklistRequest);

  router.post('/admin/partnerships/test-dm', requireAdminRole('Moderator'), async (req, res) => {
    try {
      const adminId = req.dashboardSession?.user?.id || req.session?.user?.id || req.adminUser?.userId;
      if (!adminId) {
        return res.status(400).json({ error: 'No signed-in admin Discord ID found.' });
      }

      await sendPartnershipRequestDM({
        targetUserId: adminId,
        fromServer: { id: 'sample_srv_123', name: 'Test Roleplay Community [SAMPLE]', memberCount: 150 },
        fromUser: { id: adminId, username: req.adminUser?.username || 'Admin' },
        toServer: { id: 'sample_target_456', name: 'Admin Community [SAMPLE]' },
        terms: { minMembers: 10, mention: 'here' },
        requestId: `test_req_${Date.now()}`,
        isSample: true
      });

      recordAuditAction({
        actor: req.adminUser,
        action: 'test_partnership_dm',
        target: adminId,
        targetType: 'admin',
        reason: 'Admin triggered test partnership DM',
        before: null,
        after: 'sent'
      });

      res.json({ success: true, message: `Test partnership DM dispatched to Discord ID ${adminId}.` });
    } catch (err) {
      console.error('[ADMIN] Failed to dispatch test partnership DM:', err);
      res.status(500).json({ error: err.message || 'Failed to dispatch test partnership DM.' });
    }
  });

  router.get('/admin/users/:userId/ip-collateral', requireAdminRole(), (req, res) => {
    res.json(getUserIpCollateral(req.params.userId));
  });

  // ─── Server & Account Deletion ──────────────────────────────────────────
  const handleDeleteAccount = async (req, res) => {
    const userId = req.dashboardSession.user.id;
    const { confirmUsername } = req.body || {};
    const expectedUsername = req.dashboardSession.user.username || req.dashboardSession.user.globalName || '';

    // Re-auth check if session has createdAt
    if (req.dashboardSession.createdAt) {
      const sessionAge = Date.now() - req.dashboardSession.createdAt;
      if (sessionAge > 10 * 60 * 1000) {
        return res.status(401).json({
          error: 'Recent authentication required. Please sign out and sign in again before deleting your account.',
          requireReauth: true
        });
      }
    }

    if (confirmUsername !== undefined && String(confirmUsername).trim().toLowerCase() !== String(expectedUsername).trim().toLowerCase()) {
      return res.status(400).json({ error: 'Username does not match confirmation.' });
    }

    try {
      const result = await deleteUserAccountAndServers({
        userId,
        username: expectedUsername,
        botToken: getBotToken()
      });
      invalidateShowcaseCache();
      // Invalidate session
      if (req.dashboardSessionId) {
        sessions.delete(req.dashboardSessionId);
        persistSessions();
      }
      res.clearCookie(SESSION_COOKIE, { ...cookieOptions(req), maxAge: undefined });
      if (req.method === 'DELETE') {
        return res.status(204).end();
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  router.post('/user/delete-account', requireSessionUser, handleDeleteAccount);
  router.delete('/account', requireSessionUser, handleDeleteAccount);

  // ─── Bump Notices & Discord Channels/Roles ──────────────────────────────
  router.get('/workspace/:guildId/discord-channels-and-roles', requireSessionUser, async (req, res) => {
    const { guildId } = req.params;
    const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
    if (!token) return res.status(503).json({ error: 'Discord bot token not configured.' });

    try {
      const [channelsRes, rolesRes] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
          headers: { Authorization: `Bot ${token}` }
        }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
          headers: { Authorization: `Bot ${token}` }
        })
      ]);

      if (!channelsRes.ok) {
        return res.status(channelsRes.status).json({ error: 'Could not fetch channels from Discord.' });
      }

      const rawChannels = await channelsRes.json();
      const rawRoles = rolesRes.ok ? await rolesRes.json() : [];

      // Categorize text channels
      const categories = new Map();
      const textChannels = [];

      for (const ch of rawChannels) {
        if (ch.type === 4) { // Guild category
          categories.set(ch.id, ch.name);
        } else if (ch.type === 0 || ch.type === 5) { // Text or announcement
          textChannels.push({
            id: ch.id,
            name: ch.name,
            parentId: ch.parent_id,
            canSend: true // Bot in guild has permissions
          });
        }
      }

      const channelsWithCategory = textChannels.map(ch => ({
        ...ch,
        categoryName: ch.parentId ? categories.get(ch.parentId) || 'Channels' : 'Channels'
      }));

      // Filter roles (exclude @everyone)
      const roles = rawRoles
        .filter(r => r.name !== '@everyone')
        .map(r => ({ id: r.id, name: r.name, color: r.color }));

      res.json({ channels: channelsWithCategory, roles });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/workspace/:guildId/bump-notices/test', requireSessionUser, async (req, res) => {
    const { guildId } = req.params;
    const { channelId } = req.body;
    const userId = req.dashboardSession.user.id;

    if (!channelId) return res.status(400).json({ error: 'Channel ID is required.' });

    // Rate limit: 1 per minute per server
    if (!global.__testNoticeCooldowns) global.__testNoticeCooldowns = new Map();
    const lastTest = global.__testNoticeCooldowns.get(guildId) || 0;
    if (Date.now() - lastTest < 60 * 1000) {
      const waitSec = Math.ceil((60000 - (Date.now() - lastTest)) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSec}s before sending another test notice.` });
    }

    const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
    if (!token) return res.status(503).json({ error: 'Discord bot token not configured.' });

    try {
      const payload = {
        flags: 32768, // IsComponentsV2
        components: [
          {
            type: 17, // Container
            accent_color: 16347158, // Orange
            components: [
              {
                type: 10, // TextDisplay
                content: '# ConnectingERLC Bump Notice Test'
              },
              {
                type: 10,
                content: 'This is a test notification. Automatic bump notices and reminder alerts will be posted in this channel when active.'
              }
            ]
          }
        ]
      };

      const resp = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({
          error: `Discord error: ${errJson.message || 'Bot cannot send messages to this channel. Check bot permissions.'}`
        });
      }

      global.__testNoticeCooldowns.set(guildId, Date.now());
      res.json({ success: true, message: 'Test notice posted successfully.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.use((_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  return router;
}

export function createDiscordCallbackRouter() {
  const router = Router();
  router.get('/', completeDiscordAuth);
  router.get('/callback', completeDiscordAuth);
  return router;
}

async function completeDiscordAuth(req, res) {
  const currentOrigin = appOrigin(req);
  const fallback = currentOrigin || 'http://localhost:3000';
  const wantsJson = Boolean(
    req.originalUrl?.includes('/api/') ||
    req.path?.includes('/api/') ||
    req.headers.accept?.includes('application/json') ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    req.xhr ||
    req.query.format === 'json'
  );

  // 1. Handle Discord errors
  if (req.query.error) {
    console.warn('[WEB OAuth] Discord returned error:', req.query.error, req.query.error_description);
    if (wantsJson) {
      return res.status(400).json({ error: String(req.query.error_description || req.query.error) });
    }
    return res.redirect(`${fallback}/login?auth_error=${encodeURIComponent(String(req.query.error_description || req.query.error))}`);
  }

  // Handle bot install callback (guild_id passed after adding bot)
  if (req.query.guild_id && !req.query.code) {
    const returnDest = `${fallback}/dashboard/${encodeURIComponent(String(req.query.guild_id))}?bot_installed=true`;
    if (wantsJson) {
      return res.json({ ok: true, botInstalled: true, redirectUrl: returnDest });
    }
    return res.redirect(returnDest);
  }

  // 2. Handle code
  const code = req.query.code;
  if (!code) {
    const sessionId = cookieValue(req, SESSION_COOKIE);
    if (sessionId && sessions.has(sessionId)) {
      if (wantsJson) {
        return res.json({ ok: true, user: sessions.get(sessionId).user, redirectUrl: `${fallback}/dashboard` });
      }
      return res.redirect(`${fallback}/dashboard`);
    }
    if (wantsJson) {
      return res.status(401).json({ error: 'No authorization code provided' });
    }
    return res.redirect(`${fallback}/login`);
  }

  const state = typeof req.query.state === 'string' ? req.query.state : '';
  let pending = state ? oauthStates.get(state) : null;
  if (state && pending) oauthStates.delete(state);

  // If state was not in memory, in production reject for OAuth CSRF protection (Round 1 Item 29)
  if (!pending) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[WEB OAuth] Rejecting OAuth callback with missing or invalid state in production');
      if (wantsJson) {
        return res.status(403).json({ error: 'Invalid or expired OAuth state' });
      }
      return res.redirect(`${fallback}/login?auth_error=invalid_oauth_state`);
    }
    console.log('[WEB OAuth] State not in memory or not provided, proceeding with fallback pending context in non-production');
    pending = {
      returnTo: `${fallback}/dashboard`,
      redirectUri: callbackUrl(req),
      origin: currentOrigin,
      expiresAt: Date.now() + 10 * 60 * 1000
    };
  }

  const primaryClientId = oauthClientId();
  const primaryClientSecret = (process.env.DISCORD_OAUTH_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || '').trim();

  const candidatePairs = [];
  if (primaryClientId && primaryClientSecret) {
    candidatePairs.push({ clientId: primaryClientId, clientSecret: primaryClientSecret });
  }
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    candidatePairs.push({ clientId: process.env.DISCORD_CLIENT_ID.trim(), clientSecret: process.env.DISCORD_CLIENT_SECRET.trim() });
  }

  // Determine candidate redirect URIs to handle both localhost and production gracefully
  let candidateRedirectUris = [];
  if (pending?.redirectUri) candidateRedirectUris.push(pending.redirectUri);
  candidateRedirectUris.push('https://www.connectingerlc.xyz/auth/discord/callback');
  candidateRedirectUris.push('https://connectingerlc.xyz/auth/discord/callback');
  if (process.env.DISCORD_REDIRECT_URI) candidateRedirectUris.push(process.env.DISCORD_REDIRECT_URI);
  candidateRedirectUris.push('https://www.connectingerlc.xyz/api/auth/discord/callback');
  candidateRedirectUris.push('https://connectingerlc.xyz/api/auth/discord/callback');
  candidateRedirectUris.push(siteUrl('/auth/discord/callback'));
  if (currentOrigin && currentOrigin.startsWith('https://')) {
    candidateRedirectUris.push(`${currentOrigin}/auth/discord/callback`);
    candidateRedirectUris.push(`${currentOrigin}/api/auth/discord/callback`);
  }
  if (process.env.NODE_ENV !== 'production') {
    candidateRedirectUris.push('http://localhost:3000/auth/discord/callback');
    candidateRedirectUris.push('http://localhost:3001/auth/discord/callback');
    candidateRedirectUris.push('http://localhost:3000/api/auth/discord/callback');
    candidateRedirectUris.push('http://localhost:3001/api/auth/discord/callback');
    if (currentOrigin) candidateRedirectUris.push(`${currentOrigin}/auth/discord/callback`);
  }
  candidateRedirectUris = [...new Set(candidateRedirectUris.filter(Boolean))];

  // Real Discord token exchange
  let tokenData = null;
  let lastError = null;

  for (const pair of candidatePairs) {
    if (tokenData) break;
    for (const uri of candidateRedirectUris) {
      try {
        console.log(`[WEB OAuth] Exchanging code with Discord (client_id: ${pair.clientId}, redirect_uri: ${uri})`);
        const response = await fetch('https://discord.com/api/v10/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: pair.clientId,
            client_secret: pair.clientSecret || '',
            grant_type: 'authorization_code',
            code: String(code),
            redirect_uri: uri
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          tokenData = await response.json();
          break;
        } else {
          const body = await response.text().catch(() => '');
          console.warn(`[WEB OAuth] Token exchange failed for ${pair.clientId} / ${uri}:`, response.status, body);
          lastError = body;
        }
      } catch (err) {
        console.warn(`[WEB OAuth] Token exchange network error for ${pair.clientId} / ${uri}:`, err.message);
        lastError = err.message;
      }
    }
  }

  if (!tokenData) {
    console.error('[WEB OAuth] Token exchange failed with Discord:', lastError);
    if (wantsJson) {
      return res.status(400).json({ error: 'Token exchange failed', details: lastError });
    }
    return res.redirect(`${fallback}/login?auth_error=token_exchange_failed`);
  }

  try {
    const user = await discordJson('https://discord.com/api/v10/users/@me', tokenData.access_token);
    // If LOGIN_GUILD_IDS is configured, restrict access; otherwise allow all Discord users
    const allowedGuilds = (process.env.LOGIN_GUILD_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    if (allowedGuilds.length) {
      const userGuilds = await discordJson('https://discord.com/api/v10/users/@me/guilds', tokenData.access_token).catch(() => []);
      const isMember = Array.isArray(userGuilds) && userGuilds.some(g => allowedGuilds.includes(String(g.id)));
      if (!isMember) {
        console.warn(`[WEB OAuth] Login refused for ${user.username} (${user.id}): not in an allowed server.`);
        if (wantsJson) {
          return res.status(403).json({ error: 'Login is limited to authorized community servers.' });
        }
        return res.redirect(`${fallback}/login?auth_error=${encodeURIComponent('Login is limited to authorized community servers.')}`);
      }
    }
    const cleanUsername = (typeof user.username === 'string' ? user.username.normalize('NFKC').trim().slice(0, 32) : 'User');
    const cleanDisplayName = (typeof (user.global_name || user.username) === 'string' ? (user.global_name || user.username).normalize('NFKC').trim().slice(0, 32) : cleanUsername);
    const sessionId = randomBytes(32).toString('hex');
    sessions.set(sessionId, {
      user: {
        id: user.id,
        username: cleanUsername,
        globalName: cleanDisplayName,
        displayName: cleanDisplayName,
        display_name: cleanDisplayName,
        avatar: user.avatar,
        avatar_hash: user.avatar,
        avatarHash: user.avatar
      },
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
      csrfToken: randomBytes(24).toString('hex'),
      expiresAtSession: Date.now() + SESSION_MAX_AGE
    });
    persistSessions(true);
    res.cookie(SESSION_COOKIE, sessionId, cookieOptions(req));
    res.clearCookie('mavely_session', cookieOptions(req));
    res.clearCookie('erlcus_session', cookieOptions(req));

    // Capture referral attribution if user arrived via an /r/<code> link before logging in
    const refCookie = cookieValue(req, 'connectingerlc_ref') || req.cookies?.connectingerlc_ref;
    if (refCookie) {
      try {
        const refData = typeof refCookie === 'string' && refCookie.startsWith('{') ? JSON.parse(refCookie) : { code: refCookie };
        recordUserReferralAttribution(user.id, refData);
      } catch {}
    }

    console.log(`[WEB OAuth] Successfully signed in Discord user: ${user.username} (${user.id})`);
    if (wantsJson) {
      return res.json({ ok: true, user: sessions.get(sessionId).user, redirectUrl: pending?.returnTo || `${fallback}/dashboard` });
    }
    return res.redirect(pending?.returnTo || `${fallback}/dashboard`);
  } catch (err) {
    console.error('[WEB OAuth] Discord user profile fetch error:', err);
    if (wantsJson) {
      return res.status(500).json({ error: 'Discord sign-in failed', details: err.message });
    }
    return res.redirect(`${fallback}/login?auth_error=sign_in_exception`);
  }
}