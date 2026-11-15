import { PermissionFlagsBits } from 'discord-api-types/v10';

/**
 * Basic tier (the default invite):
 * View Channels, Send Messages, Embed Links, Create Instant Invite.
 * Enough for slash commands, partnership posts, and bump messages.
 * NEVER includes Administrator.
 */
export const BOT_PERMISSIONS_TIERS = {
  basic: {
    name: 'Basic',
    description: 'Default tier for slash commands, partnership broadcasts, and bump messages.',
    flags: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.CreateInstantInvite
    ]
  },
  recruiting: {
    name: 'Recruiting',
    description: 'Needed to read invite use counts for tracked invites and representative attribution.',
    flags: [
      PermissionFlagsBits.ManageGuild
    ]
  },
  role_rewards: {
    name: 'Role rewards',
    description: 'Needed to grant roles when users reach stay retention or claim verification bounties.',
    flags: [
      PermissionFlagsBits.ManageRoles
    ]
  },
  owner_tools: {
    name: 'Owner tools',
    description: 'Optional tools for anti-raid defense and moderation.',
    flags: [
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers
    ]
  }
};

/**
 * Compute numeric permission bitfield for given tiers
 */
export function computeBotPermissions(tiers = ['basic']) {
  let bitfield = 0n;
  for (const tierKey of tiers) {
    const tier = BOT_PERMISSIONS_TIERS[tierKey];
    if (tier) {
      for (const flag of tier.flags) {
        bitfield |= flag;
      }
    }
  }

  // Safety invariant: NEVER include Administrator (8n)
  if ((bitfield & PermissionFlagsBits.Administrator) !== 0n) {
    throw new Error('[SECURITY FATAL] Computed bot permissions must NEVER contain Administrator.');
  }

  return bitfield.toString();
}

/**
 * Build authorized Discord bot invite link
 */
export function buildBotInviteUrl({
  clientId = process.env.DISCORD_CLIENT_ID || '1552165138017165372',
  guildId,
  tiers = ['basic'],
  disableGuildSelect = true
} = {}) {
  const permissions = '2147485696';
  const params = new URLSearchParams({
    client_id: String(clientId || process.env.DISCORD_CLIENT_ID || '1552165138017165372'),
    permissions: String(permissions),
    scope: 'bot applications.commands'
  });
  if (guildId) {
    params.set('guild_id', String(guildId));
  }
  if (disableGuildSelect && guildId) {
    params.set('disable_guild_select', 'true');
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Convenience helper for general bot invite URLs (no pre-selected guild required)
 */
export function getBotInviteUrl(options = {}) {
  return buildBotInviteUrl({ disableGuildSelect: false, ...options });
}

/**
 * Breakdown of a guild's actual bot permissions
 */
export function analyzeBotPermissions(permissionsNumberOrString) {
  const bits = BigInt(permissionsNumberOrString || 0);
  const hasAdmin = (bits & PermissionFlagsBits.Administrator) !== 0n;

  const basicBits = BOT_PERMISSIONS_TIERS.basic.flags.reduce((acc, f) => acc | f, 0n);
  const missingBasic = BOT_PERMISSIONS_TIERS.basic.flags.filter(f => (bits & f) === 0n);

  const optionalStatus = {
    recruiting: (bits & PermissionFlagsBits.ManageGuild) !== 0n,
    role_rewards: (bits & PermissionFlagsBits.ManageRoles) !== 0n,
    owner_tools: ((bits & PermissionFlagsBits.KickMembers) !== 0n) && ((bits & PermissionFlagsBits.BanMembers) !== 0n)
  };

  return {
    hasAdministrator: hasAdmin,
    isBasicSatisfied: missingBasic.length === 0 || hasAdmin,
    missingBasicFlags: missingBasic.map(String),
    optionalStatus
  };
}

