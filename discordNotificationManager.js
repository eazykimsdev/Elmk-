/**
 * Discord Components V2 Notification Manager
 *
 * Strict Components V2 rules:
 * - Flags: 32768 (MessageFlags.IsComponentsV2)
 * - Container (type: 17) with orange accent: 16347158 (#F97316)
 * - Section (type: 9) + Thumbnail (type: 11) when a valid Discord server icon URL exists
 * - TextDisplay (type: 10)
 * - Real Separator (type: 14, divider: true)
 * - ActionRow (type: 1) + Buttons (type: 2, never style 3/green)
 * - ZERO embeds, ZERO markdown dash lines, ZERO emojis, ZERO green
 */

import { siteUrl } from './shared/siteUrl.js';
import { getPromotedServers } from './directoryManager.js';
import { getBotInviteUrl } from './shared/botPermissions.js';

export const BRAND_ORANGE = 16347158; // #F97316

/**
 * Resolve server name, slug, and Discord icon URL from directory if not explicitly passed
 */
export function resolveServerDisplayMeta({ guildId, serverName, serverIconUrl, slug } = {}) {
  let resolvedName = serverName || '';
  let resolvedIcon = serverIconUrl || null;
  let resolvedSlug = slug || guildId || '';

  if (guildId) {
    try {
      const servers = getPromotedServers(true);
      const found = servers.find(
        (s) => String(s.id) === String(guildId) || String(s.guildId) === String(guildId)
      );
      if (found) {
        if (!resolvedName) resolvedName = found.name;
        if (!resolvedSlug) resolvedSlug = found.slug || found.id;
        if (!resolvedIcon) {
          if (found.icon && /^https?:\/\//i.test(found.icon)) {
            resolvedIcon = found.icon;
          } else if (found.iconUrl && /^https?:\/\//i.test(found.iconUrl)) {
            resolvedIcon = found.iconUrl;
          } else if (found.icon_hash || found.iconHash) {
            const hash = found.icon_hash || found.iconHash;
            resolvedIcon = `https://cdn.discordapp.com/icons/${found.id}/${hash}.${String(hash).startsWith('a_') ? 'gif' : 'png'}?size=128`;
          }
        }
      }
    } catch {}
  }

  return {
    name: resolvedName || 'Community Server',
    iconUrl: resolvedIcon && /^https?:\/\//i.test(resolvedIcon) ? resolvedIcon : null,
    slug: resolvedSlug || guildId || ''
  };
}

/**
 * Build a V2 header component: uses Section (type 9) with Thumbnail (type 11)
 * when a real Discord server icon URL is present, or TextDisplay (type 10) otherwise.
 */
export function buildV2HeaderComponent(markdownText, iconUrl = null) {
  if (iconUrl && /^https?:\/\//i.test(iconUrl)) {
    return {
      type: 9, // Section
      components: [
        {
          type: 10, // TextDisplay
          content: markdownText
        }
      ],
      accessory: {
        type: 11, // Thumbnail
        media: {
          url: iconUrl
        }
      }
    };
  }
  return {
    type: 10, // TextDisplay
    content: markdownText
  };
}

/**
 * 1. BUMP READY V2 PANEL
 */
export function buildBumpReadyV2Panel({
  guildId = '',
  serverName = '',
  serverIconUrl = null,
  slug = '',
  mentionText = '',
  allowedMentions = { parse: [] }
} = {}) {
  const meta = resolveServerDisplayMeta({ guildId, serverName, serverIconUrl, slug });
  const serverUrl = siteUrl(meta.slug ? `/s/${meta.slug}` : '/servers');

  const payload = {
    flags: 32768,
    allowed_mentions: allowedMentions,
    components: [
      {
        type: 17, // Container
        accent_color: BRAND_ORANGE,
        components: [
          buildV2HeaderComponent(
            `### Ready to Bump: ${meta.name}\nThe bump cooldown for **${meta.name}** has finished.`,
            meta.iconUrl
          ),
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 10, // TextDisplay
            content: `${mentionText ? `${mentionText}\n` : ''}Run \`/bump\` in your server or open the server page to elevate **${meta.name}** to #1 in the directory.`
          },
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Open server page',
                url: serverUrl
              }
            ]
          }
        ]
      }
    ]
  };

  return payload;
}

/**
 * 2. BUMP CONFIRMATION V2 PANEL (Public channel thank-you / confirmation)
 */
export function buildBumpThankYouV2({
  callerId,
  guildId = '',
  serverName = '',
  serverIconUrl = null,
  serverSlug = '',
  nextBumpAt = null,
  cooldownHours = 1
} = {}) {
  const meta = resolveServerDisplayMeta({
    guildId: guildId || serverSlug,
    serverName,
    serverIconUrl,
    slug: serverSlug
  });
  const serverUrl = siteUrl(meta.slug ? `/s/${meta.slug}` : '/servers');
  const nextUnix = nextBumpAt
    ? Math.floor(Number(nextBumpAt) / 1000)
    : Math.floor((Date.now() + cooldownHours * 3600 * 1000) / 1000);

  const actorLine = callerId
    ? `Bumped by <@${callerId}>. **${meta.name}** is now #1 in the directory.`
    : `**${meta.name}** is now #1 in the directory.`;

  return {
    flags: 32768,
    allowed_mentions: callerId ? { users: [callerId], parse: [] } : { parse: [] },
    components: [
      {
        type: 17, // Container
        accent_color: BRAND_ORANGE,
        components: [
          buildV2HeaderComponent(
            `### Bump Confirmed: ${meta.name}\n${actorLine}`,
            meta.iconUrl
          ),
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 10, // TextDisplay
            content: `Next bump available <t:${nextUnix}:R> (<t:${nextUnix}:t>).`
          },
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Open server page',
                url: serverUrl
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * 3. DAILY CHECK-IN REMINDER V2 PANEL
 */
export function buildDailyCheckinReminderV2Panel({
  guildId = '',
  serverName = '',
  serverIconUrl = null,
  resetAtMs = null,
  includeTurnOffButton = false
} = {}) {
  const meta = resolveServerDisplayMeta({ guildId, serverName, serverIconUrl });
  const checkinUrl = siteUrl(guildId ? `/dashboard/${guildId}?tab=checkin` : '/dashboard?tab=checkin');

  const now = Date.now();
  const effectiveResetMs = resetAtMs ? Number(resetAtMs) : now + 2 * 3600 * 1000;
  const remainingMinutes = Math.max(1, Math.round((effectiveResetMs - now) / 60000));
  const timePhrase =
    remainingMinutes >= 60
      ? `${Math.max(1, Math.round(remainingMinutes / 60))} hour${Math.round(remainingMinutes / 60) === 1 ? '' : 's'}`
      : `${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
  const resetUnix = Math.floor(effectiveResetMs / 1000);

  const rowComponents = [
    {
      type: 2, // Button
      style: 5, // Link
      label: 'Daily check-in',
      url: checkinUrl
    }
  ];

  if (includeTurnOffButton && guildId) {
    rowComponents.push({
      type: 2, // Button
      style: 2, // Secondary
      label: 'Turn off reminders',
      custom_id: `checkin_remind_off:${guildId}`
    });
  }

  return {
    flags: 32768,
    components: [
      {
        type: 17, // Container
        accent_color: BRAND_ORANGE,
        components: [
          buildV2HeaderComponent(
            `### Daily Check-In Reminder: ${meta.name}\nYour daily check-in streak on **${meta.name}** will reset in ${timePhrase} (<t:${resetUnix}:R>).`,
            meta.iconUrl
          ),
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 10, // TextDisplay
            content: 'Check in today to maintain your streak and collect your daily credits.'
          },
          {
            type: 1, // ActionRow
            components: rowComponents
          }
        ]
      }
    ]
  };
}

/**
 * 4. PARTNERSHIP PROPOSAL RESULT V2 PANEL
 */
export function buildPartnershipResolutionV2({
  guildId = '',
  fromServerName = 'Partner Community',
  toServerName = '',
  serverIconUrl = null,
  slug = '',
  action = 'accepted',
  responderId = null
} = {}) {
  const isAccepted = action === 'accepted' || action === 'accept';
  const targetName = toServerName || fromServerName || 'Partner Community';
  const meta = resolveServerDisplayMeta({
    guildId,
    serverName: targetName,
    serverIconUrl,
    slug
  });
  const serverUrl = siteUrl(meta.slug ? `/s/${meta.slug}` : '/servers');
  const statusHeading = isAccepted
    ? `### Partnership Proposal Accepted: ${fromServerName}`
    : `### Partnership Proposal Declined: ${fromServerName}`;
  const statusText = isAccepted
    ? 'Partnership proposal accepted.'
    : 'Partnership proposal declined.';
  const responderLine = responderId ? `Updated by <@${responderId}>.` : 'Updated via ConnectingERLC.';

  return {
    flags: 32768,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17, // Container
        accent_color: BRAND_ORANGE,
        components: [
          buildV2HeaderComponent(`${statusHeading}\n${statusText}`, meta.iconUrl),
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 10, // TextDisplay
            content: `**Status:** ${statusText}\n${responderLine}`
          },
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Open server page',
                url: serverUrl
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Rebuilt outcome notification sent to the requesting user via DM
 */
export function buildPartnershipRequesterNotificationV2({
  fromGuildId = '',
  toGuildId = '',
  fromServerName = 'Your Server',
  toServerName = 'Partner Server',
  serverIconUrl = null,
  slug = '',
  action = 'accepted'
} = {}) {
  const isAccepted = action === 'accepted' || action === 'accept';
  const meta = resolveServerDisplayMeta({
    guildId: toGuildId || fromGuildId,
    serverName: toServerName,
    serverIconUrl,
    slug
  });
  const serverUrl = siteUrl(meta.slug ? `/s/${meta.slug}` : '/servers');
  const statusTitle = isAccepted
    ? `### Partnership Proposal Accepted: ${meta.name}`
    : `### Partnership Proposal Declined: ${meta.name}`;
  const statusBody = isAccepted
    ? `Your partnership proposal from **${fromServerName}** to **${meta.name}** was accepted. Mutual cross-promotion is now active.`
    : `Your partnership proposal from **${fromServerName}** to **${meta.name}** was declined. Any reserved credits have been returned.`;

  return {
    flags: 32768,
    components: [
      {
        type: 17, // Container
        accent_color: BRAND_ORANGE,
        components: [
          buildV2HeaderComponent(statusTitle, meta.iconUrl),
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 10, // TextDisplay
            content: statusBody
          },
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Open server page',
                url: serverUrl
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Build Components V2 payload for general Discord DM notifications
 * Types: 'bump' | 'bump_confirmation' | 'streak' | 'partnership' | 'partnership_result' | 'review'
 */
export function buildV2NotificationPayload({
  type,
  serverName = 'Community Server',
  serverIconUrl = null,
  proposingServer = 'Partner Server',
  slug = '',
  guildId = '',
  resetAtMs = null,
  nextBumpAt = null,
  action = 'accepted'
} = {}) {
  const meta = resolveServerDisplayMeta({ guildId, serverName, serverIconUrl, slug });
  const canonicalUrl = siteUrl(meta.slug ? `/s/${meta.slug}` : '/servers');

  switch (type) {
    case 'bump':
    case 'bump_reminder':
    case 'bump_ready':
      return buildBumpReadyV2Panel({
        guildId,
        serverName: meta.name,
        serverIconUrl: meta.iconUrl,
        slug: meta.slug
      });

    case 'bump_confirmation':
      return buildBumpThankYouV2({
        guildId,
        serverName: meta.name,
        serverIconUrl: meta.iconUrl,
        serverSlug: meta.slug,
        nextBumpAt
      });

    case 'streak':
    case 'streak_alert':
    case 'checkin_reminder':
      return buildDailyCheckinReminderV2Panel({
        guildId,
        serverName: meta.name,
        serverIconUrl: meta.iconUrl,
        resetAtMs
      });

    case 'partnership_result':
    case 'partnership_resolution':
      return buildPartnershipRequesterNotificationV2({
        toGuildId: guildId,
        fromServerName: meta.name,
        toServerName: proposingServer,
        serverIconUrl: meta.iconUrl,
        slug: meta.slug,
        action
      });

    case 'partnership':
    case 'partnership_proposal':
      return {
        flags: 32768,
        components: [
          {
            type: 17,
            accent_color: BRAND_ORANGE,
            components: [
              buildV2HeaderComponent(
                `### Partnership Proposal: ${proposingServer}\nA partnership proposal from **${proposingServer}** is waiting for your review.`,
                meta.iconUrl
              ),
              {
                type: 14,
                divider: true
              },
              {
                type: 10,
                content: 'Review this partnership request to connect communities and cross-promote.'
              },
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 5,
                    label: 'Open server page',
                    url: canonicalUrl
                  }
                ]
              }
            ]
          }
        ]
      };

    case 'review':
    case 'review_notice':
      return {
        flags: 32768,
        components: [
          {
            type: 17,
            accent_color: BRAND_ORANGE,
            components: [
              buildV2HeaderComponent(
                `### New Review: ${meta.name}\nA member left a review on **${meta.name}**.`,
                meta.iconUrl
              ),
              {
                type: 14,
                divider: true
              },
              {
                type: 10,
                content: 'Open your server page to read the latest community feedback.'
              },
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 5,
                    label: 'Open server page',
                    url: canonicalUrl
                  }
                ]
              }
            ]
          }
        ]
      };

    default:
      return buildBumpReadyV2Panel({
        guildId,
        serverName: meta.name,
        serverIconUrl: meta.iconUrl,
        slug: meta.slug
      });
  }
}

/**
 * Dispatch a DM notification to a Discord user ID
 */
export async function sendDirectNotificationV2({
  targetUserId,
  type,
  serverName,
  serverIconUrl,
  proposingServer,
  slug,
  guildId,
  resetAtMs,
  nextBumpAt,
  action
}) {
  const token = (process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) throw new Error('DISCORD_TOKEN is not configured.');
  if (!targetUserId) throw new Error('Target Discord user ID is required.');

  const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ recipient_id: targetUserId })
  });

  if (!dmRes.ok) {
    const errText = await dmRes.text();
    throw new Error(`Failed to create DM channel: ${errText}`);
  }

  const dmChannel = await dmRes.json();
  const channelId = dmChannel.id;

  const payload = buildV2NotificationPayload({
    type,
    serverName,
    serverIconUrl,
    proposingServer,
    slug,
    guildId,
    resetAtMs,
    nextBumpAt,
    action
  });

  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!msgRes.ok) {
    const errText = await msgRes.text();
    throw new Error(`Failed to deliver DM message: ${errText}`);
  }

  return await msgRes.json();
}

/**
 * Build Components V2 panel for incoming partnership proposal DMs
 * No embeds, no markdown dash lines, no emojis, real Separators (type: 14)
 */
export function buildPartnershipRequestV2({
  requestId,
  fromServer = {},
  fromUser = {},
  toServer = {},
  terms = {},
  isSample = false
}) {
  const serverName = fromServer.name || 'Partner Community';
  const meta = resolveServerDisplayMeta({
    guildId: fromServer.id,
    serverName,
    serverIconUrl: fromServer.icon || fromServer.iconUrl
  });
  const memberCount = Number(fromServer.memberCount) || 0;
  const requesterMention = fromUser.id ? `<@${fromUser.id}>` : (fromUser.username || 'Community Representative');
  const requesterTag = fromUser.username ? ` (${fromUser.username})` : '';

  const minMemMet = terms.minMembers ? `Min ${terms.minMembers} members met` : 'Member requirements met';
  const mentionTerm = terms.mention && terms.mention !== 'none' ? `@${terms.mention} mentions accepted` : 'No mentions';
  const requirementsMet = `${minMemMet}, ${mentionTerm}`;

  const headerTitle = isSample
    ? '### Partnership Proposal [SAMPLE]'
    : `### Partnership Proposal: ${meta.name}`;

  const bodyContent = isSample
    ? `This is a test notification for platform administrators. No real partnership was requested.\n\n**Requesting community:** ${meta.name}\n**Requested by:** ${requesterMention}${requesterTag}\n**Member count:** ${memberCount} members\n**Requirements met:** ${requirementsMet}`
    : `**Requesting community:** ${meta.name}\n**Requested by:** ${requesterMention}${requesterTag}\n**Member count:** ${memberCount} members\n**Requirements met:** ${requirementsMet}`;

  const serverPageUrl = siteUrl(toServer.id ? `/dashboard/${toServer.id}/partnerships` : '/servers');

  const acceptCustomId = isSample ? 'part_sample_accept' : `part_accept_${requestId}`;
  const declineCustomId = isSample ? 'part_sample_decline' : `part_decline_${requestId}`;

  return {
    flags: 32768,
    components: [
      {
        type: 17, // Container
        accent_color: BRAND_ORANGE,
        components: [
          buildV2HeaderComponent(headerTitle, meta.iconUrl),
          {
            type: 14, // Separator
            divider: true
          },
          {
            type: 10, // TextDisplay
            content: bodyContent
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
                style: 1, // Primary (neutral, no green)
                label: isSample ? 'Accept [TEST]' : 'Accept',
                custom_id: acceptCustomId
              },
              {
                type: 2, // Button
                style: 4, // Danger
                label: isSample ? 'Decline [TEST]' : 'Decline',
                custom_id: declineCustomId
              },
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Open server page',
                url: serverPageUrl
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Send a partnership proposal DM using Components V2
 */
export async function sendPartnershipRequestDM({
  targetUserId,
  fromServer,
  fromUser,
  toServer,
  terms,
  requestId,
  isSample = false
}) {
  const token = (process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
  if (!token) throw new Error('DISCORD_TOKEN is not configured.');
  if (!targetUserId) throw new Error('Target Discord user ID is required.');

  const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ recipient_id: targetUserId })
  });

  if (!dmRes.ok) {
    const errText = await dmRes.text();
    throw new Error(`Failed to create DM channel: ${errText}`);
  }

  const dmChannel = await dmRes.json();
  const channelId = dmChannel.id;

  const payload = buildPartnershipRequestV2({
    requestId,
    fromServer,
    fromUser,
    toServer,
    terms,
    isSample
  });

  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!msgRes.ok) {
    const errText = await msgRes.text();
    throw new Error(`Failed to deliver DM message: ${errText}`);
  }

  return await msgRes.json();
}

/**
 * 9. CONNECTINGERLC WEBSITE V2 CARD (Components V2 panel matching Vex reference)
 * - Container (type: 17) with no color stripe, no green
 * - Section (type: 9) with TextDisplay (type: 10) on left: Title "ConnectingERLC" & Description
 * - Accessory: Thumbnail (type: 11) with logo on right
 * - Real Separator (type: 14, divider: true) under the text
 * - Action Row (type: 1) with 3 link buttons (type: 2, style: 5):
 *   1. "Website" -> siteUrl
 *   2. "Add the bot" -> inviteUrl
 *   3. "Join our server" -> supportUrl
 * - Links loaded dynamically from env/settings
 * - IS_COMPONENTS_V2 flag (32768)
 * - No embeds, no content, no emojis, no dash lines
 */
export function buildWebsiteV2Card({
  siteUrl: customSiteUrl,
  inviteUrl: customInviteUrl,
  supportUrl: customSupportUrl,
  logoUrl: customLogoUrl
} = {}) {
  const baseOrigin = process.env.APP_ORIGIN || process.env.SITE_URL || 'https://connectingerlc.xyz';
  const resolvedSite = customSiteUrl || baseOrigin;
  const resolvedInvite = customInviteUrl || getBotInviteUrl();
  const resolvedSupport = customSupportUrl || process.env.SUPPORT_INVITE_URL || 'https://discord.gg/connectingerlc';
  const resolvedLogo = customLogoUrl || `${baseOrigin}/brand/logo.png`;

  return {
    flags: 32768, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // Container
        components: [
          {
            type: 9, // Section
            components: [
              {
                type: 10, // TextDisplay
                content: '**ConnectingERLC**\nThe leading growth platform for Emergency Response: Liberty County. Promote your server, partner with other servers, recruit active players and track your invites. Completely free.'
              }
            ],
            accessory: {
              type: 11, // Thumbnail
              media: {
                url: resolvedLogo
              }
            }
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
                label: 'Website',
                url: resolvedSite
              },
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Add the bot',
                url: resolvedInvite
              },
              {
                type: 2, // Button
                style: 5, // Link
                label: 'Join our server',
                url: resolvedSupport
              }
            ]
          }
        ]
      }
    ]
  };
}

export const buildWebsiteLinkV2Card = buildWebsiteV2Card;
export const buildWebsiteLinkCard = buildWebsiteV2Card;
