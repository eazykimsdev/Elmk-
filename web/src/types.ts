export interface DiscordUser {
  id: string;
  username: string;
  name?: string;
  globalName?: string;
  global_name?: string;
  avatar: string | null;
  role?: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  icon_hash?: string | null;
  iconHash?: string | null;
  owner: boolean;
  ownerId?: string;
  hasWorkspace?: boolean;
  configured?: boolean;
  approximateMemberCount?: number;
  memberCount?: number;
  botStatus?: string;
  bot_in_guild?: boolean;
  channels?: any[];
  missingPermissions?: any;
}

export interface WorkspaceCustomizations {
  serverName?: string;
  serverCategory?: string;
  serverSummary?: string;
  serverDescription?: string;
  serverTags?: string[] | string;
  bannerUrl?: string;
  discordInvite?: string;
  inviteUrl?: string;
  language?: string;
  listedInDirectory?: boolean;
  rewardCoins?: number;
  offerHigherReward?: boolean;
  extraRewardPaused?: boolean;
  retentionTargetHours?: number;
  partnershipSetUp?: boolean;
  openForPartnerships?: boolean;
  partnershipMinMembers?: number;
  partnershipPrice?: number;
  partnershipAllowedMentions?: string;
  partnershipHerePrice?: number;
  partnershipEveryonePrice?: number;
  partnershipBroadcastChannel?: string | null;
  partnershipAcceptedCategories?: string[];
  partnershipDailyLimit?: number;
  joinCode?: string;
  botActivityText?: string;
  botPrefix?: string;

  // Community & Directory
  setupCompleted?: boolean;
  welcomeEnabled?: boolean;
  welcomeChannelId?: string;
  welcomeText?: string;
  welcomeBannerUrl?: string;

  // Permissions & Moderation
  botStaffRoleId?: string;
  adminRoleId?: string;
  staffRoleIds?: string[];
  quarantineRoleId?: string;
  auditChannelId?: string;
  bumpChannelId?: string;
  bumpRoleId?: string;
  bumpNoticeEnabled?: boolean;
  bumpReadyNoticeEnabled?: boolean;
  joinRoleIds?: string[];
  botJoinRoleId?: string;
  logChannelId?: string;
  notificationChannelId?: string;
  autoBumpEnabled?: boolean;
  autoBumpInterval?: number;
  customBumpMessage?: string;

  // Recruiting & Representatives
  recruitRepresentatives?: boolean;
  representativesWanted?: number;
  creditsPerRecruit?: number;
  approveManually?: boolean;
  recruitLogChannelId?: string;
  repRoleId?: string;
  recruitRoleId?: string;

  // Directory & Growth
  serverLanguage?: string;
  serverBannerUrl?: string;
  bannerStyle?: string;
  coinsPerJoin?: number;
  extraCreditsPerJoin?: number;
  isListed?: boolean;

  // ER:LC API Key
  erlcApiKey?: string;

  [key: string]: any;
}

/** Stored dashboard settings for one Discord server. */
export interface WorkspaceBot {
  id: string;
  guildId: string;
  createdAt: string;
  updatedAt: string;
  hasErlcApiKey: boolean;
  hasErlcKey?: boolean;
  ownerUserId?: string;
  active?: boolean;
  isInGuild?: boolean;
  hasWorkspace?: boolean;
  botTokenConfigured?: boolean;
  isMainBot?: boolean;
  discordBotId?: string;
  botUser?: any;
  inviteUrl?: string;
  status?: string;
  customizations: WorkspaceCustomizations;
}

export interface LiveErlcServer {
  state: 'connected' | 'not_configured' | 'unavailable';
  name?: string | null;
  joinCode?: string | null;
  currentPlayers?: number | null;
  maxPlayers?: number | null;
  queue?: number | null;
  staffCount?: number | null;
  error?: string;
  fetchedAt?: string;
}
