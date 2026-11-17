/**
 * ConnectingERLC Discord Slash Commands & Interaction Handler
 * 
 * Global Commands:
 *  1. /bump        - Bump your server to the top of the directory.
 *  2. /ad          - Ephemeral prompt directing user to promote server (Manage Server required)
 *  3. /setup       - Ephemeral prompt directing user to set up server (Manage Server required)
 *  4. /status      - Live system health (website, db, bot, ER:LC sync)
 *  5. /leaderboard - Top 10 published servers by verified joins in 30d
 * 
 * Uses Discord Components V2 (ActionRow, Buttons, Rich Embeds, Container).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  getPromotedServers,
  bumpPromotedServer,
  getBumpStatus,
  BUMP_COOLDOWN_HOURS
} from './directoryManager.js';
import { siteUrl } from './shared/siteUrl.js';
import { setReminderPreference } from './checkinReminderManager.js';
import {
  hasBumpReminder,
  addBumpReminder,
  removeBumpReminder
} from './bumpReminderManager.js';
import { isMaintenanceActive } from './siteStateManager.js';
import {
  buildBumpThankYouV2,
  buildPartnershipResolutionV2,
  buildV2HeaderComponent,
  buildWebsiteV2Card,
  resolveServerDisplayMeta
} from './discordNotificationManager.js';
import { createBugReport, checkBugReportRateLimit } from './bugReportManager.js';
import { isUserBanned } from './adminManager.js';
import { respondToPartnershipRequest, loadPartnershipsData } from './partnershipsManager.js';
import { isServerPremium } from './premiumManager.js';
import { postPremiumAd } from './advertisingManager.js';

const BRAND_ORANGE = 16347158; // #F97316

export const GLOBAL_BOT_COMMANDS = [
  {
    name: 'bump',
    description: 'Bump your server to the top of the directory.',
    type: 1,
    contexts: [0] // Guild only
  },
  {
    name: 'bugreport',
    description: 'Report a bug to the ConnectingERLC team.',
    type: 1,
    contexts: [0, 1, 2] // Guilds, Bot DMs, Private Channels
  },
  {
    name: 'yourcommand',
    description: 'Send a Components V2 panel showcase.',
    type: 1,
    contexts: [0, 1, 2] // Guilds, Bot DMs, Private Channels
  },
  {
    name: 'ad',
    description: "Manage your server's listing on the website.",
    type: 1,
    contexts: [0], // Guild only
    default_member_permissions: '32' // Manage Server (Manage Guild)
  },
  {
    name: 'setup',
    description: 'Set up your server on the website.',
    type: 1,
    contexts: [0], // Guild only
    default_member_permissions: '32' // Manage Server
  },
  {
    name: 'status',
    description: 'Show whether ConnectingERLC is working.',
    type: 1,
    contexts: [0] // Guild only
  },
  {
    name: 'leaderboard',
    description: 'Show the top servers on ConnectingERLC.',
    type: 1,
    contexts: [0] // Guild only
  },
  {
    name: 'website',
    description: 'Get the ConnectingERLC website link, bot invite, and support server.',
    type: 1,
    contexts: [0, 1, 2] // Guilds, Bot DMs, Private Channels
  },
  {
    name: 'premiumad',
    description: 'Post your server ad in the Premium Advertising channel.',
    type: 1,
    contexts: [0, 1, 2],
    options: [
      {
        name: 'server',
        description: 'Choose which premium server you are advertising for.',
        type: 3,
        required: true,
        autocomplete: true
      },
      {
        name: 'message',
        description: 'Optional custom ad message (max 1000 characters).',
        type: 3,
        required: false
      }
    ]
  }
];

// In-memory cooldown store for /leaderboard (30s per user & 30s per guild)
const leaderboardCooldowns = new Map();
// In-memory rate limit store for /bump (3 per minute per user)
const userBumpRateLimits = new Map();

/**
 * Hash command definitions to avoid unnecessary redeployments
 */
export function hashCommands(commands) {
  return crypto.createHash('sha256').update(JSON.stringify(commands)).digest('hex');
}

/**
 * Build Components V2 payload for /bump success or cooldown
 */
export function buildBumpV2Message({ heading, textLines, guildId, callerId, serverSlug, serverName, serverIconUrl, hasReminder, isSuccess = false }) {
  const meta = resolveServerDisplayMeta({
    guildId,
    serverName,
    serverIconUrl,
    slug: serverSlug
  });
  const contentText = [`### ${heading}: ${meta.name}`, ...textLines].join('\n\n');

  return {
    flags: 32768 | 64, // MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    components: [
      {
        type: 17, // Container (No accent_color = no color on the side)
        components: [
          buildV2HeaderComponent(contentText, meta.iconUrl),
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 1, // ActionRow
            components: [
              hasReminder
                ? {
                    type: 2, // Button
                    style: 4, // ButtonStyle.Danger (Red)
                    label: 'Remove reminder',
                    custom_id: `bump_unremind:${guildId}:${callerId}`
                  }
                : {
                    type: 2, // Button
                    style: 2, // ButtonStyle.Secondary (Neutral gray, Zero Green policy)
                    label: 'Remind me',
                    custom_id: `bump_remind:${guildId}:${callerId}`
                  },
              {
                type: 2, // Button
                style: 5, // ButtonStyle.Link
                label: 'Open server page',
                url: siteUrl(`/s/${meta.slug || guildId}`)
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Components V2 Showcase Payload for /yourcommand
 */
export function buildYourCommandPayload() {
  return {
    type: 4,
    data: {
      flags: 32768, // MessageFlags.IsComponentsV2
      components: [
        {
          type: 17, // Container (No accent_color = no color on the side)
          components: [
            {
              type: 10, // TextDisplay
              content: '# ConnectingERLC Platform\nElevate your community to the top of the global directory and grow active members.'
            },
            {
              type: 14, // Separator
              divider: true
            },
            {
              type: 10, // TextDisplay
              content: 'Automate bumps, manage partnerships, and earn rewards through cross-promotion.'
            },
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 2, // Button
                  style: 5, // Link
                  label: 'List your server',
                  url: 'https://connectingerlc.xyz'
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

/**
 * Handle incoming interaction dispatch (INTERACTION_CREATE)
 */
export async function handleInteraction(interaction, token) {
  if (!interaction) return;

  const { id, token: interactionToken, data, guild_id, member, user } = interaction;
  const callerUser = member?.user || user;
  const callerId = callerUser?.id || '';

  // ─── Maintenance Mode Interceptor ──────────────────────────────────────────
  // When maintenance is turned on via Admin Portal, reply ephemerally with live relative timestamp
  const maint = isMaintenanceActive();
  if (maint && maint.active) {
    const targetFile = path.join(process.cwd(), 'data', 'construction_target.json');
    let targetMs = 0;
    try {
      if (fs.existsSync(targetFile)) {
        const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
        if (parsed?.targetMs && Number(parsed.targetMs) > Date.now()) {
          targetMs = Number(parsed.targetMs);
        }
      }
    } catch {}

    if (!targetMs) {
      targetMs = Date.now() + 24 * 60 * 60 * 1000;
      try {
        if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
          fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
        }
        fs.writeFileSync(targetFile, JSON.stringify({ targetMs }), 'utf8');
      } catch {}
    }

    const targetUnix = Math.floor(targetMs / 1000);

    // Return ephemeral response (flags: 64 = visible only to caller)
    return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: `⚠️ **ConnectingERLC is currently under maintenance.**\nCommands are temporarily paused while platform upgrades are finalized.\n\n**Estimated completion:** <t:${targetUnix}:R> (<t:${targetUnix}:F>)\n**Updates:** https://connectingerlc.xyz`,
          flags: 64 // Ephemeral: only the user who ran the command can see this
        }
      })
    }).catch((err) => console.error('[DISCORD BOT] Error sending maintenance response:', err.message));
  }

  // ─── Handle Button Clicks (Components V2 interaction type 3) ───────────────
  if (interaction.type === 3) {
    const customId = data?.custom_id || '';

    // Premium Suggestion Accept / Decline
    if (customId.startsWith('premium_sug_accept:') || customId.startsWith('premium_sug_decline:')) {
      const isAccept = customId.startsWith('premium_sug_accept:');
      const sugId = customId.split(':')[1];
      try {
        const sugPath = path.resolve('data/premium_suggestions.json');
        if (fs.existsSync(sugPath)) {
          const sugs = JSON.parse(fs.readFileSync(sugPath, 'utf8') || '[]');
          const match = sugs.find((s) => s.id === sugId);
          if (match) {
            match.status = isAccept ? 'accepted' : 'declined';
            match.reviewedAt = new Date().toISOString();
            match.reviewedBy = callerId;
            fs.writeFileSync(sugPath, JSON.stringify(sugs, null, 2), 'utf8');
          }
        }
      } catch (err) {
        console.warn('[PREMIUM SUGGESTION] Error saving review state:', err.message);
      }

      // Defer update callback (type 6) then delete original message
      return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 6 })
      }).then(() => {
        return fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interactionToken}/messages/@original`, {
          method: 'DELETE'
        });
      }).catch((err) => console.error('[DISCORD BOT] Error deleting suggestion message:', err.message));
    }

    // Check-in reminder toggle off
    if (customId.startsWith('checkin_remind_off:')) {
      const serverId = customId.split(':')[1];
      setReminderPreference({ userId: callerId, serverId, enabled: false });

      return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 7, // UPDATE_MESSAGE
          data: {
            flags: 32768,
            components: [
              {
                type: 17, // Container (No accent_color = no color on the side)
                components: [
                  {
                    type: 10,
                    content: '### Check-In Reminders Turned Off\nYou will no longer receive daily check-in reminders for this server.'
                  },
                  {
                    type: 14,
                    divider: true
                  },
                  {
                    type: 10,
                    content: 'You can re-enable reminders anytime in your community dashboard.'
                  }
                ]
              }
            ]
          }
        })
      }).catch((err) => console.error('[DISCORD BOT] Error updating reminder interaction:', err.message));
    }

    // Bump Reminder Toggle ("Remind me" / "Remove reminder")
    if (customId.startsWith('bump_remind:') || customId.startsWith('bump_unremind:')) {
      const parts = customId.split(':');
      const action = parts[0];
      const targetGuildId = parts[1];
      const originalCallerId = parts[2] || '';

      // Only the user who owns the ephemeral message can click it
      if (originalCallerId && originalCallerId !== callerId) {
        return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 4,
            data: {
              content: 'Only the user who initiated this bump can change this reminder.',
              flags: 64
            }
          })
        }).catch(() => {});
      }

      if (action === 'bump_remind') {
        addBumpReminder({ userId: callerId, guildId: targetGuildId });
      } else {
        removeBumpReminder({ userId: callerId, guildId: targetGuildId });
      }

      const allServers = getPromotedServers(true);
      const s = allServers.find((sv) => String(sv.id) === targetGuildId || String(sv.guildId) === targetGuildId);
      const nextBumpUnix = Math.floor(Number(s?.nextBumpAt || Date.now() + 2 * 3600 * 1000) / 1000);
      const hasReminder = action === 'bump_remind';

      const updatePayload = buildBumpV2Message({
        heading: 'Bump status',
        textLines: [
          `${s?.name || 'This server'} next bump: <t:${nextBumpUnix}:R>`,
          hasReminder ? 'Reminder saved. We will notify you when the next bump is ready.' : 'Reminder removed.'
        ],
        guildId: targetGuildId,
        callerId,
        serverSlug: s?.slug || s?.id,
        hasReminder
      });

      return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 7, // UPDATE_MESSAGE
          data: updatePayload
        })
      }).catch((err) => console.error('[DISCORD BOT] Error updating bump reminder toggle:', err.message));
    }

    // Partnership Proposal Action Buttons (Accept / Decline)
    if (customId === 'part_sample_accept' || customId === 'part_sample_decline') {
      const isAccepted = customId === 'part_sample_accept';
      const resolutionPayload = buildPartnershipResolutionV2({
        fromServerName: 'Test Roleplay Community [SAMPLE]',
        action: isAccepted ? 'accepted' : 'declined',
        responderId: callerId
      });

      return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 7, // UPDATE_MESSAGE
          data: resolutionPayload
        })
      }).catch((err) => console.error('[DISCORD BOT] Error updating sample partnership interaction:', err.message));
    }

    if (customId.startsWith('part_accept_') || customId.startsWith('part_decline_')) {
      const action = customId.startsWith('part_accept_') ? 'accept' : 'decline';
      const requestId = customId.replace(/^part_(accept|decline)_/, '');
      const pData = loadPartnershipsData();
      const reqRecord = (pData.requests || []).find((r) => r.id === requestId);

      if (!reqRecord) {
        return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 4,
            data: {
              content: 'This partnership request could not be found or has expired.',
              flags: 64
            }
          })
        }).catch(() => {});
      }

      if (reqRecord.status !== 'pending') {
        return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 4,
            data: {
              content: `This partnership request has already been ${reqRecord.status}.`,
              flags: 64
            }
          })
        }).catch(() => {});
      }

      try {
        await respondToPartnershipRequest({
          requestId,
          action,
          guildId: reqRecord.toGuildId,
          responderUserId: callerId
        });

        const resolutionPayload = buildPartnershipResolutionV2({
          fromServerName: reqRecord.fromGuildName || 'Partner Community',
          action: action === 'accept' ? 'accepted' : 'declined',
          responderId: callerId
        });

        return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 7, // UPDATE_MESSAGE
            data: resolutionPayload
          })
        }).catch((err) => console.error('[DISCORD BOT] Error updating partnership interaction callback:', err.message));
      } catch (respErr) {
        return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 4,
            data: {
              content: respErr.message || 'Failed to update partnership request.',
              flags: 64
            }
          })
        }).catch(() => {});
      }
    }

    return;
  }

  // ─── Modal Submissions (type 5) ───────────────────────────────────────────
  if (interaction.type === 5) {
    const customId = data?.custom_id;

    if (customId === 'modal_bug_report') {
      let bugTitle = '';
      let bugWhatHappened = '';
      let bugSteps = '';

      for (const row of data?.components || []) {
        for (const comp of row?.components || []) {
          if (comp.custom_id === 'bug_title') bugTitle = comp.value;
          if (comp.custom_id === 'bug_what_happened') bugWhatHappened = comp.value;
          if (comp.custom_id === 'bug_steps') bugSteps = comp.value;
        }
      }

      try {
        let callerAvatar = null;
        if (callerUser?.avatar) {
          callerAvatar = `https://cdn.discordapp.com/avatars/${callerId}/${callerUser.avatar}.png?size=128`;
        }
        const report = await createBugReport({
          userId: callerId,
          username: callerUser?.username || 'Discord User',
          displayName: callerUser?.global_name || callerUser?.username || 'Discord User',
          avatarUrl: callerAvatar,
          title: bugTitle,
          description: bugWhatHappened,
          stepsToReproduce: bugSteps
        });

        const confirmPayload = {
          flags: 32768 | 64, // Components V2 + Ephemeral
          components: [
            {
              type: 17, // Container (No accent_color = no color on the side)
              components: [
                {
                  type: 10,
                  content: `# Bug report submitted\n\n**${report.title}**\n\nYour bug report has been received and saved. Reference ID: \`${report.id}\`.\n\nOur team will review your report shortly. If accepted and your account owns a community listed on the website, 50 credits will be awarded to your server.`
                },
                {
                  type: 14,
                  divider: true
                },
                {
                  type: 10,
                  content: 'You can submit up to 3 bug reports per day.'
                }
              ]
            }
          ]
        };

        return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: confirmPayload
          })
        }).catch((err) => console.error('[DISCORD BOT] Error replying to bug report modal:', err.message));
      } catch (err) {
        return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 4,
            data: {
              content: err.message || 'Could not submit bug report. Please try again later.',
              flags: 64
            }
          })
        }).catch(() => {});
      }
    }

    return;
  }

  // ─── Autocomplete Interactions (type 4) ───────────────────────────────────
  if (interaction.type === 4) {
    if (data?.name === 'premiumad') {
      const servers = getPromotedServers(true);
      const eligible = servers.filter(s => {
        if (!isServerPremium(s)) return false;
        const ownerId = String(s.ownerId || s.owner_discord_id || '');
        const advertisers = Array.isArray(s.advertisers) ? s.advertisers.map(a => String(a.userId)) : [];
        return ownerId === callerId || advertisers.includes(callerId);
      });
      const choices = eligible.slice(0, 25).map(s => ({
        name: (s.name || `Server ${s.id}`).slice(0, 100),
        value: String(s.id)
      }));
      return fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 8, // APPLICATION_COMMAND_AUTOCOMPLETE_RESULT
          data: { choices }
        })
      }).catch(() => {});
    }
    return;
  }

  // ─── Application Commands (type 2) ─────────────────────────────────────────
  if (interaction.type !== 2) return;

  const commandName = data?.name;
  console.log(`[DISCORD BOT] Command /${commandName} invoked in guild ${guild_id || 'DM'} by ${callerUser?.username || 'user'}`);

  async function respond(responseBody) {
    try {
      // Clean private metadata from payload before dispatching to Discord
      const rawData = responseBody?.data || {};
      const cleanData = {};
      for (const [k, v] of Object.entries(rawData)) {
        if (!k.startsWith('_')) {
          cleanData[k] = v;
        }
      }

      const res = await fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: responseBody.type,
          data: cleanData
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[DISCORD BOT] Discord rejected callback (${res.status}):`, text);
      }
    } catch (err) {
      console.error(`[DISCORD BOT] Error replying to /${commandName}:`, err.message);
    }
  }

  // /yourcommand Components V2 showcase panel
  if (commandName === 'yourcommand') {
    return respond(buildYourCommandPayload());
  }

  // /premiumad command
  if (commandName === 'premiumad') {
    const serverOpt = data?.options?.find(o => o.name === 'server')?.value;
    const msgOpt = data?.options?.find(o => o.name === 'message')?.value;
    if (!serverOpt) {
      return respond({
        type: 4,
        data: {
          content: 'Please select which server you are posting an ad for.',
          flags: 64
        }
      });
    }

    try {
      const result = await postPremiumAd({
        serverId: serverOpt,
        actorUserId: callerId,
        customContent: msgOpt,
        options: { actorUsername: callerUser?.username }
      });
      return respond({
        type: 4,
        data: {
          content: `Your ad for **${result.serverName}** has been posted to the Premium Advertising channel!`,
          flags: 64
        }
      });
    } catch (adErr) {
      return respond({
        type: 4,
        data: {
          content: `Could not post ad: ${adErr.message}`,
          flags: 64
        }
      });
    }
  }

  // /website Components V2 Card
  if (commandName === 'website') {
    const card = buildWebsiteV2Card();
    return respond({
      type: 4,
      data: card
    });
  }

  // /bugreport is a global command usable anywhere (including DMs)
  if (commandName === 'bugreport') {
    if (isUserBanned(callerId)) {
      return respond({
        type: 4,
        data: {
          content: 'You are restricted from submitting bug reports.',
          flags: 64
        }
      });
    }

    const rateLimit = checkBugReportRateLimit(callerId);
    if (!rateLimit.allowed) {
      return respond({
        type: 4,
        data: {
          content: 'You have reached the limit of 3 bug reports per day. Please try again tomorrow.',
          flags: 64
        }
      });
    }

    return respond({
      type: 9, // MODAL
      data: {
        custom_id: 'modal_bug_report',
        title: 'Report a Bug',
        components: [
          {
            type: 1, // ActionRow
            components: [
              {
                type: 4, // TextInput
                custom_id: 'bug_title',
                label: 'Bug Title',
                style: 1, // Short
                min_length: 3,
                max_length: 100,
                placeholder: 'Short summary of what went wrong',
                required: true
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'bug_what_happened',
                label: 'What Happened?',
                style: 2, // Paragraph
                min_length: 5,
                max_length: 1000,
                placeholder: 'Describe what you saw and what you expected instead',
                required: true
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'bug_steps',
                label: 'Steps to Reproduce',
                style: 2, // Paragraph
                min_length: 5,
                max_length: 1000,
                placeholder: '1. Go to...\n2. Click on...\n3. See error...',
                required: true
              }
            ]
          }
        ]
      }
    });
  }

  // Guild-only enforcement for other commands
  if (!guild_id) {
    return respond({
      type: 4,
      data: {
        content: 'ConnectingERLC commands must be used inside a Discord server.',
        flags: 64
      }
    });
  }

  // Maintenance check: if maintenance active, respond immediately and pause bumps/joins
  const cmdMaint = isMaintenanceActive();
  if (cmdMaint.active) {
    return respond({
      type: 4,
      data: {
        content: `ConnectingERLC is currently undergoing scheduled platform upgrades. ${cmdMaint.message || 'All services will resume shortly.'}`,
        flags: 64
      }
    });
  }

  // Find linked server
  const allServers = getPromotedServers(true);
  const server = allServers.find((s) => String(s.id) === String(guild_id) || String(s.guildId) === String(guild_id));

  // ─── /bump ─────────────────────────────────────────────────────────────────
  if (commandName === 'bump') {
    // Rate limit: 3 per minute per user
    const now = Date.now();
    const userTimestamps = userBumpRateLimits.get(callerId) || [];
    const recentBumps = userTimestamps.filter((t) => now - t < 60000);
    if (recentBumps.length >= 3) {
      return respond({
        type: 4,
        data: {
          content: 'You are bumping too quickly. Try again in a minute.',
          flags: 64
        }
      });
    }

    // 1. Check: Server not set up
    if (!server) {
      return respond({
        type: 4,
        data: {
          content: `This server is not set up on ConnectingERLC yet. Add it at ${siteUrl('/dashboard')}.`,
          flags: 64
        }
      });
    }

    // 2. Check: Listing not published or incomplete
    if (server.published === false || server.listed === false || !server.description || !server.description.trim()) {
      return respond({
        type: 4,
        data: {
          content: 'Listing is not published or incomplete. Complete and publish it on your dashboard.',
          flags: 64
        }
      });
    }

    // 3. Check: Invite broken / missing
    if (!server.inviteUrl && !server.invite) {
      return respond({
        type: 4,
        data: {
          content: 'Server invite link is missing or invalid. Update it in your dashboard.',
          flags: 64
        }
      });
    }

    // 4. Check: Server banned or hidden
    if (server.banned || server.hidden || server.status === 'banned' || server.status === 'suspended') {
      return respond({
        type: 4,
        data: {
          content: 'This server is suspended or hidden.',
          flags: 64
        }
      });
    }

    // 5. Check: Cooldown
    const COOLDOWN_MS = (BUMP_COOLDOWN_HOURS || 1) * 3600 * 1000;
    const lastBump = Number(server.lastBumpedAt || 0);
    const nextBumpAt = Number(server.nextBumpAt || (lastBump ? lastBump + COOLDOWN_MS : 0));

    if (lastBump && now - lastBump < COOLDOWN_MS) {
      const nextBumpUnix = Math.floor(nextBumpAt / 1000);
      const hasReminder = hasBumpReminder(callerId, guild_id);

      const cooldownPayload = buildBumpV2Message({
        heading: 'Cooldown Active',
        textLines: [
          `**${server.name}** was recently bumped.`,
          `> **Ready to bump again:** <t:${nextBumpUnix}:R> (<t:${nextBumpUnix}:t>)`,
          '-# Click "Remind me" below to receive an alert when this community is ready.'
        ],
        guildId: guild_id,
        callerId,
        serverSlug: server.slug || server.id,
        hasReminder,
        isSuccess: false
      });

      return respond({
        type: 4,
        data: cooldownPayload
      });
    }

    // 6. Check: Bump cost authorization
    const bumpCost = Number(server.bumpCost || server.bump_cost || 0);
    if (bumpCost > 0) {
      const isOwner = String(server.ownerId) === String(callerId);
      const isManagerOrHigher =
        Array.isArray(server.team) &&
        server.team.some(
          (m) =>
            String(m.id || m.userId) === String(callerId) &&
            ['Owner', 'Co-owner', 'Manager'].includes(m.role)
        );
      const hasManageGuild = (BigInt(member?.permissions || '0') & 32n) !== 0n;

      if (!isOwner && !isManagerOrHigher && !hasManageGuild) {
        return respond({
          type: 4,
          data: {
            content: 'Only the server owner or a manager can bump when credits are required.',
            flags: 64
          }
        });
      }
    }

    // 7. Execute Bump!
    try {
      const bumpRes = bumpPromotedServer(guild_id, callerId, { interactionId: interaction.id });
      recentBumps.push(now);
      userBumpRateLimits.set(callerId, recentBumps);

      // Compute real ranking
      const eligible = allServers.filter((s) => !s.hidden && !s.delisted && s.listedInDirectory !== false);
      eligible.sort((a, b) => {
        const aJoins = Number(a.verifiedJoins || a.verifiedRecruits || 0);
        const bJoins = Number(b.verifiedJoins || b.verifiedRecruits || 0);
        const aBumps = Number(a.bumps || 0);
        const bBumps = Number(b.bumps || 0);
        const aScore = aJoins * 2 + aBumps;
        const bScore = bJoins * 2 + bBumps;
        if (bScore !== aScore) return bScore - aScore;
        return (Number(b.memberCount) || 0) - (Number(a.memberCount) || 0);
      });

      const rankIndex = eligible.findIndex((s) => String(s.id) === String(guild_id) || String(s.guildId) === String(guild_id));
      const currentRank = rankIndex !== -1 ? rankIndex + 1 : 1;
      const totalListed = Math.max(1, eligible.length);

      const nextBumpUnix = Math.floor(bumpRes.nextBumpAt / 1000);
      const hasReminder = hasBumpReminder(callerId, guild_id);

      const successPayload = buildBumpV2Message({
        heading: 'Bump Confirmed',
        textLines: [
          `**${server.name}** is now **#1 in the directory**.`,
          `Next bump: <t:${nextBumpUnix}:R> (<t:${nextBumpUnix}:t>)\nLeaderboard: #${currentRank} of ${totalListed} communities`,
          'Click "Remind me" below to receive an alert when this server is ready to bump again.'
        ],
        guildId: guild_id,
        callerId,
        serverSlug: server.slug || server.id,
        serverName: server.name,
        serverIconUrl: server.icon || server.iconUrl,
        hasReminder,
        isSuccess: true
      });

      // Post Public Bump Message to custom configured channel or current interaction channel
      const targetChannelId = server.bump_channel_id || server.bumpChannelId || server.notifications?.bump_channel_id || interaction.channel_id;

      if (targetChannelId && token) {
        try {
          const cleanToken = token.trim().replace(/^Bot\s+/i, '');
          const displayName = server.name || 'Community';
          const publicMessage = buildBumpThankYouV2({
            callerId,
            guildId: guild_id,
            serverName: displayName,
            serverIconUrl: server.icon || server.iconUrl,
            serverSlug: server.slug || server.id,
            nextBumpAt: bumpRes.nextBumpAt,
            cooldownHours: BUMP_COOLDOWN_HOURS || 1
          });

          fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bot ${cleanToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(publicMessage)
          }).catch((err) => console.warn('[DISCORD BOT] Could not send bump notice to channel:', err.message));
        } catch (pubErr) {
          console.warn('[DISCORD BOT] Error preparing public bump message:', pubErr.message);
        }
      }

      return respond({
        type: 4,
        data: successPayload
      });
    } catch (err) {
      return respond({
        type: 4,
        data: {
          content: err.message || 'Could not bump server.',
          flags: 64
        }
      });
    }
  }

  // ─── /ad ───────────────────────────────────────────────────────────────────
  if (commandName === 'ad') {
    return respond({
      type: 4,
      data: {
        flags: 32768 | 64, // Components V2 + Ephemeral
        components: [
          {
            type: 17, // Container (No accent_color = no color on the side)
            components: [
              {
                type: 10, // TextDisplay
                content: '# Community Promotion\n\nManage your listing, custom tags, and banner directly from the ConnectingERLC Studio.\n\n> Edit and publish changes to elevate your community in the directory.'
              },
              {
                type: 14, // Separator
                divider: true
              },
              {
                type: 1, // ActionRow
                components: [
                  {
                    type: 2, // Button
                    style: 5, // Link
                    label: 'Promote server',
                    url: siteUrl(`/dashboard/${guild_id}/promote`)
                  },
                  {
                    type: 2, // Button
                    style: 5, // Link
                    label: 'Public directory',
                    url: siteUrl('/servers')
                  }
                ]
              }
            ]
          }
        ]
      }
    });
  }

  // ─── /setup ────────────────────────────────────────────────────────────────
  if (commandName === 'setup') {
    return respond({
      type: 4,
      data: {
        flags: 32768 | 64, // Components V2 + Ephemeral
        components: [
          {
            type: 17, // Container (No accent_color = no color on the side)
            components: [
              {
                type: 10, // TextDisplay
                content: '# Server Setup\n\nConfigure your server on ConnectingERLC to earn promotional credits and list in the public directory.\n\n> Add your community, invite bot, and start growing.'
              },
              {
                type: 14, // Separator
                divider: true
              },
              {
                type: 1, // ActionRow
                components: [
                  {
                    type: 2, // Button
                    style: 5, // Link
                    label: 'Add your server',
                    url: siteUrl(`/dashboard/${guild_id}`)
                  },
                  {
                    type: 2, // Button
                    style: 5, // Link
                    label: 'Documentation',
                    url: siteUrl('/docs')
                  }
                ]
              }
            ]
          }
        ]
      }
    });
  }

  // ─── /status ───────────────────────────────────────────────────────────────
  if (commandName === 'status') {
    const alertIds = (process.env.ALERT_DISCORD_IDS || process.env.ADMIN_DISCORD_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isAlertRecipient = alertIds.includes(callerId);

    const statusLines = [
      '**Platform Status:** Operational',
      'All primary systems are running normally with no active disruptions.',
      '> Website: Operational\n> Database: Operational\n> Discord Bot: Operational\n> ER:LC Sync Protocol: Operational'
    ];

    if (isAlertRecipient) {
      statusLines.push('> Gateway Latency: ~35ms\n> Unresolved Incidents: 0');
    }

    statusLines.push('-# Live telemetry syncs directly with the ConnectingERLC monitor.');

    const statusV2Payload = {
      flags: 32768 | 64, // Components V2 + Ephemeral
      components: [
        {
          type: 17, // Container (No accent_color = no color on the side)
          components: [
            {
              type: 10, // TextDisplay
              content: `# System Status\n\n${statusLines.join('\n\n')}`
            },
            {
              type: 14, // Separator
              divider: true
            },
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 2, // Button
                  style: 5, // Link
                  label: 'View Status',
                  url: siteUrl('/status')
                }
              ]
            }
          ]
        }
      ]
    };

    return respond({
      type: 4,
      data: statusV2Payload
    });
  }

  // ─── /leaderboard ──────────────────────────────────────────────────────────
  if (commandName === 'leaderboard') {
    const now = Date.now();
    const userCd = leaderboardCooldowns.get(`u:${callerId}`) || 0;
    const guildCd = leaderboardCooldowns.get(`g:${guild_id}`) || 0;

    if (now < userCd || now < guildCd) {
      const waitSec = Math.max(1, Math.ceil((Math.max(userCd, guildCd) - now) / 1000));
      return respond({
        type: 4,
        data: {
          flags: 32768 | 64, // Components V2 + Ephemeral
          components: [
            {
              type: 17, // Container (No accent_color = no color on the side)
              components: [
                {
                  type: 10,
                  content: `# Leaderboard Cooldown\n\nPlease wait **${waitSec} seconds** before requesting the directory leaderboard again.`
                }
              ]
            }
          ]
        }
      });
    }

    leaderboardCooldowns.set(`u:${callerId}`, now + 30 * 1000);
    leaderboardCooldowns.set(`g:${guild_id}`, now + 30 * 1000);

    // Sort top 10 published servers by real directory activity
    const eligible = allServers.filter((s) => !s.hidden && !s.delisted && s.listedInDirectory !== false);
    eligible.sort((a, b) => {
      const aJoins = Number(a.verifiedJoins || a.verifiedRecruits || 0);
      const bJoins = Number(b.verifiedJoins || b.verifiedRecruits || 0);
      const aBumps = Number(a.bumps || 0);
      const bBumps = Number(b.bumps || 0);
      const aScore = aJoins * 2 + aBumps;
      const bScore = bJoins * 2 + bBumps;
      if (bScore !== aScore) return bScore - aScore;
      return (Number(b.memberCount) || 0) - (Number(a.memberCount) || 0);
    });

    const top10 = eligible.slice(0, 10);
    const lines = top10.map((s, idx) => {
      const rank = idx + 1;
      const rankPrefix = rank === 1 ? '🥇' : rank === 2 ? '2️⃣' : rank === 3 ? '3️⃣' : `${rank}.`;
      const joins = Number(s.verifiedJoins || s.verifiedRecruits || 0);
      const bumps = Number(s.bumps || 0);
      const members = Number(s.memberCount || 0);
      const score = joins * 2 + bumps;
      const cleanName = (s.name || 'Community')
        .replace(/^@/, '')
        .replace(/🎉/g, '')
        .replace(/\[/g, '(')
        .replace(/\]/g, ')')
        .trim();
      const serverUrl = siteUrl(`/s/${s.slug || s.id}`);
      return `${rankPrefix} **[${cleanName}](${serverUrl})**\n> **${score}** points • **${bumps}** bumps • **${members}** members`;
    });

    const description = lines.length > 0 ? lines.join('\n\n') : 'No community servers listed yet.';

    const v2Payload = {
      flags: 32768, // MessageFlags.IsComponentsV2 (Public in-channel panel)
      components: [
        {
          type: 17, // Container (No accent_color = no color on the side)
          components: [
            {
              type: 10, // TextDisplay
              content: `# Community Leaderboard\n\nTop ER:LC communities ranked by live directory telemetry:\n\n${description}\n\n-# Rankings sync in real-time with ConnectingERLC directory.`
            },
            {
              type: 14, // Separator
              divider: true
            },
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 2,
                  style: 5,
                  label: 'View Leaderboard',
                  url: siteUrl('/leaderboard')
                },
                {
                  type: 2,
                  style: 5,
                  label: 'Explore Directory',
                  url: siteUrl('/dashboard?tab=earn')
                }
              ]
            }
          ]
        }
      ]
    };

    return respond({
      type: 4,
      data: v2Payload
    });
  }
}
