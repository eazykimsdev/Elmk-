/**
 * ConnectingERLC Discord Slash Commands & Interaction Handler
 * 
 * Registers ONLY 3 global slash commands:
 *  1. /bump  - Elevate server to #1 in directory and feeds
 *  2. /stats - Live telemetry, members, bumps, credits, and rank
 *  3. /info  - ConnectingERLC platform & community overview with action buttons
 * 
 * Uses Discord Components V2 (ActionRow, Buttons, Rich Embed Containers).
 */

import {
  getPromotedServers,
  bumpPromotedServer,
  getBumpStatus,
  BUMP_COOLDOWN_HOURS
} from './directoryManager.js';
import { siteUrl } from './shared/siteUrl.js';

const BRAND_ORANGE = 16347158; // #F97316
const BRAND_LOGO_URL = siteUrl('/brand/logo.png');

export const BOT_COMMANDS = [
  {
    name: 'bump',
    description: 'Bump this server to the top of the ConnectingERLC directory and partner feeds',
    type: 1
  },
  {
    name: 'stats',
    description: 'View live ConnectingERLC stats, rank, bumps, and member metrics for this server',
    type: 1
  },
  {
    name: 'info',
    description: 'Learn about the ConnectingERLC growth platform and this community',
    type: 1
  },
  {
    name: 'status',
    description: 'View live ConnectingERLC system and infrastructure status (Admin)',
    type: 1,
    default_member_permissions: '8' // Administrator only
  }
];

/**
 * Register exactly 3 global commands, automatically deleting any deprecated commands.
 */
export async function registerGlobalCommands(token, applicationId) {
  if (!token || !applicationId) return;
  const cleanToken = token.trim().replace(/^Bot\s+/i, '');
  try {
    console.log(`[DISCORD BOT] Registering 3 global slash commands for application ${applicationId}...`);
    const res = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${cleanToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(BOT_COMMANDS)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[DISCORD BOT] Failed to register slash commands:', err);
      return false;
    }

    const data = await res.json();
    console.log(`[DISCORD BOT] Successfully registered ${data.length} global commands:`, data.map(c => `/${c.name}`).join(', '));
    return true;
  } catch (err) {
    console.error('[DISCORD BOT] Error registering commands:', err.message);
    return false;
  }
}

/**
 * Handle incoming interaction dispatch (INTERACTION_CREATE)
 */
export async function handleInteraction(interaction, token) {
  if (!interaction || interaction.type !== 2) return; // 2 = APPLICATION_COMMAND

  const { id, token: interactionToken, data, guild_id, member, user } = interaction;
  const commandName = data?.name;
  const callerUser = member?.user || user;
  const callerId = callerUser?.id || '';

  console.log(`[DISCORD BOT] Command /${commandName} invoked in guild ${guild_id || 'DM'} by ${callerUser?.username || 'user'}`);

  async function respond(responseBody) {
    try {
      await fetch(`https://discord.com/api/v10/interactions/${id}/${interactionToken}/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(responseBody)
      });
    } catch (err) {
      console.error(`[DISCORD BOT] Error replying to /${commandName}:`, err.message);
    }
  }

  // Guild-only check
  if (!guild_id) {
    return respond({
      type: 4,
      data: {
        content: '⚠️ ConnectingERLC slash commands must be used inside a Discord server.',
        flags: 64 // Ephemeral
      }
    });
  }

  // Find linked server in directory database
  const allServers = getPromotedServers(true);
  const server = allServers.find((s) => String(s.id) === String(guild_id) || String(s.guildId) === String(guild_id));

  // ─── COMMAND 1: /bump ───────────────────────────────────────────────────────
  if (commandName === 'bump') {
    if (!server) {
      return respond({
        type: 4,
        data: {
          content: `This server is not set up on ConnectingERLC yet. Add it at ${siteUrl('/dashboard')} to start bumping.`,
          flags: 64, // Ephemeral
          components: [
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 2, // Button
                  style: 5, // Link
                  label: 'Set Up Server',
                  url: siteUrl(`/dashboard/${guild_id}`)
                }
              ]
            }
          ]
        }
      });
    }

    // Check cooldown
    const bumpStatus = getBumpStatus(guild_id);
    if (!bumpStatus.canBump) {
      const nextTimeSec = Math.floor(Number(bumpStatus.nextBumpAt) / 1000);
      return respond({
        type: 4,
        data: {
          embeds: [
            {
              title: '⏳ Bump Cooldown Active',
              description: `**${server.name}** is currently on cooldown.\nYou can bump again <t:${nextTimeSec}:R> (<t:${nextTimeSec}:t>).`,
              color: 16439062, // Orange/Amber
              fields: [
                {
                  name: 'Current Rank',
                  value: `#${bumpStatus.rank || 1} of ${bumpStatus.totalServers || allServers.length}`,
                  inline: true
                },
                {
                  name: 'Cooldown Period',
                  value: `${BUMP_COOLDOWN_HOURS} Hours`,
                  inline: true
                }
              ],
              footer: {
                text: 'ConnectingERLC • Fast Bumping Engine',
                icon_url: BRAND_LOGO_URL
              }
            }
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: 'View Directory',
                  url: `${BASE_URL}/directory`
                },
                {
                  type: 2,
                  style: 5,
                  label: 'Server Dashboard',
                  url: `${BASE_URL}/dashboard/${guild_id}`
                }
              ]
            }
          ]
        }
      });
    }

    // Execute server-side bump
    try {
      const result = bumpPromotedServer(guild_id, callerId);
      const nextTimestampSec = Math.floor(Number(result.nextBumpAt) / 1000);

      return respond({
        type: 4,
        data: {
          embeds: [
            {
              title: '🚀 Server Bumped Successfully!',
              description: `**${server.name}** has been bumped to **#1** on the ConnectingERLC Directory and partner network feeds!`,
              color: BRAND_ORANGE,
              fields: [
                {
                  name: 'Directory Rank',
                  value: '#1 (Elevated)',
                  inline: true
                },
                {
                  name: 'Total Bumps',
                  value: `${result.server.bumps || 1}`,
                  inline: true
                },
                {
                  name: 'Next Bump Available',
                  value: `<t:${nextTimestampSec}:R>`,
                  inline: true
                }
              ],
              footer: {
                text: 'ConnectingERLC • The growth platform for ER:LC communities',
                icon_url: BRAND_LOGO_URL
              }
            }
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: 'View in Directory',
                  url: `${BASE_URL}/directory`
                },
                {
                  type: 2,
                  style: 5,
                  label: 'Server Dashboard',
                  url: `${BASE_URL}/dashboard/${guild_id}`
                }
              ]
            }
          ]
        }
      });
    } catch (err) {
      return respond({
        type: 4,
        data: {
          content: `Failed to bump server: ${err.message}`,
          flags: 64
        }
      });
    }
  }

  // ─── COMMAND 2: /stats ──────────────────────────────────────────────────────
  if (commandName === 'stats') {
    if (!server) {
      return respond({
        type: 4,
        data: {
          content: `This server is not set up on ConnectingERLC yet. Add it at ${siteUrl('/dashboard')} to track live stats.`,
          flags: 64,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: 'Set Up Server',
                  url: siteUrl(`/dashboard/${guild_id}`)
                }
              ]
            }
          ]
        }
      });
    }

    const sorted = getPromotedServers();
    const rankIndex = sorted.findIndex((s) => String(s.id) === String(guild_id));
    const rank = rankIndex !== -1 ? rankIndex + 1 : 1;
    const members = Number(server.memberCount || 0).toLocaleString();
    const totalBumps = Number(server.bumps || 0);
    const balance = Number(server.balance || 0);

    const iconUrl =
      server.iconUrl ||
      (server.icon ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png` : BRAND_LOGO_URL);

    return respond({
      type: 4,
      data: {
        embeds: [
          {
            title: `${server.name} — Live Stats`,
            description: `Real-time community metrics synchronized with **ConnectingERLC**.`,
            color: BRAND_ORANGE,
            thumbnail: {
              url: iconUrl
            },
            fields: [
              {
                name: 'Total Members',
                value: `${members}`,
                inline: true
              },
              {
                name: 'Total Bumps',
                value: `${totalBumps}`,
                inline: true
              },
              {
                name: 'Credits Balance',
                value: `${balance} cr`,
                inline: true
              },
              {
                name: 'Current Rank',
                value: `#${rank} of ${sorted.length}`,
                inline: true
              }
            ],
            footer: {
              text: 'ConnectingERLC Platform',
              icon_url: BRAND_LOGO_URL
            }
          }
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: 'View Dashboard',
                url: siteUrl(`/dashboard/${guild_id}`)
              },
              {
                type: 2,
                style: 5,
                label: 'Directory Listing',
                url: siteUrl('/directory')
              }
            ]
          }
        ]
      }
    });
  }

  // ─── COMMAND 3: /info ───────────────────────────────────────────────────────
  if (commandName === 'info') {
    const iconUrl =
      server?.iconUrl ||
      (server?.icon ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png` : BRAND_LOGO_URL);

    const serverSlug = server?.slug || guild_id;
    const reviewUrl = siteUrl(`/directory?server=${serverSlug}`);
    const viewUrl = siteUrl(`/s/${serverSlug}`);

    return respond({
      type: 4,
      data: {
        embeds: [
          {
            title: `ConnectingERLC — ${server?.name || 'Community Platform'}`,
            description: 'The growth platform for ER:LC communities. Promote your server, automate cross-community partnerships, recruit active players, and verify membership with live Discord and ER:LC telemetry.',
            color: BRAND_ORANGE,
            thumbnail: {
              url: iconUrl
            },
            footer: {
              text: 'ConnectingERLC • Growing ER:LC Together',
              icon_url: BRAND_LOGO_URL
            }
          }
        ],
        components: [
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 5, // Link style
                label: 'Review Server',
                url: reviewUrl
              },
              {
                type: 2, // Button
                style: 5, // Link style
                label: 'View Server',
                url: viewUrl
              }
            ]
          }
        ]
      }
    });
  }

  // ─── COMMAND 4: /status (Admin-Only) ─────────────────────────────────────────
  if (commandName === 'status') {
    return respond({
      type: 4,
      data: {
        flags: 64, // Ephemeral to admin
        embeds: [
          {
            title: 'ConnectingERLC — Live System Status',
            description: 'Component diagnostics and infrastructure health check.',
            color: BRAND_ORANGE,
            fields: [
              {
                name: 'Core API',
                value: 'Operational',
                inline: true
              },
              {
                name: 'Database',
                value: 'Operational',
                inline: true
              },
              {
                name: 'Discord Bot',
                value: 'Operational',
                inline: true
              },
              {
                name: 'ER:LC API',
                value: 'Operational',
                inline: true
              }
            ],
            footer: {
              text: 'ConnectingERLC Health Monitor',
              icon_url: BRAND_LOGO_URL
            }
          }
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: 'Open System Status',
                url: siteUrl('/status')
              },
              {
                type: 2,
                style: 5,
                label: 'Admin Portal',
                url: siteUrl('/admin-portal')
              }
            ]
          }
        ]
      }
    });
  }
}

