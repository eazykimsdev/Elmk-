import React from 'react';
import { Users, Coins, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { stripMarkdown } from '@/lib/markdownSanitizer';

export interface DirectoryServerData {
  id?: string;
  guildId?: string;
  name?: string;
  icon?: string | null;
  iconUrl?: string | null;
  icon_hash?: string | null;
  iconHash?: string | null;
  category: string;
  description: string;
  summary?: string;
  tags?: string[];
  bannerUrl?: string | null;
  memberCount?: number;
  verified?: boolean;
  is_premium?: boolean;
  premiumUntil?: number | string | null;
  bot_in_guild?: boolean;
  inviteUrl?: string;
  invite_status?: 'valid' | 'expired' | 'unknown';
  last_checked?: string | null;
  last_checked_error?: string | null;
  expired_click_count?: number;
  rewardCoins?: number;
  owner_discord_id?: string | null;
  owner_display_name?: string | null;
  owner_avatar_hash?: string | null;
  partnershipSetUp?: boolean;
  partnershipMinMembers?: number;
  partnershipPrice?: number;
  partnershipAllowHere?: boolean;
  partnershipAllowedMentions?: string;
  erlc?: {
    connected?: boolean;
    currentPlayers?: number | null;
    maxPlayers?: number | null;
    lastCheckedAt?: string;
  } | null;
}

export interface DirectoryCardProps {
  server: DirectoryServerData;
  variant?: 'directory' | 'partnership';
  partnershipSetUp?: boolean;
  isOwnServer?: boolean;
  isJoined?: boolean;
  isVerifying?: boolean;
  rewardCoins?: number;
  hoursRemaining?: number;
  minMembers?: number | null;
  partnershipPrice?: number | null;
  allowedMentions?: string | null;
  partnershipStatus?: 'active' | 'pending' | 'rejected' | null;
  onJoin?: (server: DirectoryServerData) => void;
  onClick?: (server: DirectoryServerData) => void;
  onRequestPartnership?: (server: DirectoryServerData) => void;
  previewOnly?: boolean;
  className?: string;
  iconSize?: number;
  lineClamp?: 1 | 2;
}

export function DirectoryCard({
  server,
  variant = 'directory',
  partnershipSetUp,
  isOwnServer = false,
  isJoined = false,
  isVerifying = false,
  rewardCoins: propReward,
  minMembers,
  partnershipPrice,
  allowedMentions,
  partnershipStatus,
  onJoin,
  onClick,
  onRequestPartnership,
  previewOnly = false,
  className,
  iconSize = 56,
  lineClamp,
}: DirectoryCardProps) {
  const safeServer = server || ({} as DirectoryServerData);
  const isSetUp = partnershipSetUp !== undefined ? Boolean(partnershipSetUp) : Boolean(safeServer.partnershipSetUp);
  const rawName = safeServer.name?.trim();
  const serverName = rawName || '';
  const rawSummary = stripMarkdown(safeServer.summary?.trim() || safeServer.description?.trim());
  const displaySummary = rawSummary || '';
  const memberCount = safeServer.memberCount || 0;
  const reward = propReward !== undefined ? propReward : (safeServer.rewardCoins || 2);
  const bannerUrl = safeServer.bannerUrl?.trim() || null;
  const isExpired = safeServer.invite_status === 'expired';

  return (
    <div
      role="button"
      tabIndex={previewOnly ? -1 : 0}
      onClick={() => onClick?.(safeServer)}
      onKeyDown={(e) => {
        if (!previewOnly && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.(safeServer);
        }
      }}
      className={cn(
        '@container relative rounded-[16px] border border-[#19191D] bg-[#0E0E11] p-3.5 sm:p-4 overflow-hidden transition-all duration-150 text-left w-full outline-hidden',
        'ring-1 ring-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_0_3px_rgba(255,255,255,0.02)]',
        'hover:border-white/20 hover:ring-white/10',
        !previewOnly && 'cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        isExpired && 'opacity-60 grayscale-[0.25]',
        className
      )}
    >
      {/* ── Background Banner Behind Card with Blur & Dark Gradient Overlay ── */}
      {bannerUrl && (
        <img
          src={bannerUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          style={{
            filter: 'blur(14px) saturate(1.1)',
            transform: 'scale(1.15)',
            opacity: 0.22,
          }}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#0E0E11] via-[#0E0E11]/85 to-[#0E0E11]/60 pointer-events-none select-none"
      />

      <div className="relative z-10 grid grid-cols-[auto_1fr] @[460px]:grid-cols-[auto_1fr_auto] items-start @[460px]:items-center gap-3 sm:gap-3.5">
        {/* Column 1: Server Icon */}
        <div
          className="rounded-full bg-[#18181B] ring-1 ring-white/10 overflow-hidden shrink-0 flex items-center justify-center select-none"
          style={{ width: iconSize, height: iconSize }}
        >
          {safeServer.iconUrl ? (
            <img
              src={safeServer.iconUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-zinc-400 font-semibold text-base sm:text-lg uppercase">
              {serverName ? serverName.charAt(0) : '?'}
            </span>
          )}
        </div>

        {/* Column 2: Server Info */}
        <div className="min-w-0 flex-1 space-y-1">
          {/* Row 1: Title + Verified Badge */}
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className={cn(
                'text-sm font-semibold text-white truncate leading-tight',
                isOwnServer && 'text-[var(--accent)]'
              )}
            >
              {serverName}
            </h3>
            {safeServer.verified && (
              <span
                title="Verified Community"
                className="inline-flex items-center justify-center size-4 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] shrink-0"
              >
                <Check className="size-2.5 stroke-[3]" />
              </span>
            )}
            {safeServer.is_premium && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 tracking-wider shrink-0 select-none">
                PREMIUM
              </span>
            )}
          </div>

          {/* Row 2: Description */}
          {displaySummary ? (
            <p
              className={cn(
                'text-xs text-zinc-400 leading-snug',
                lineClamp === 1 ? 'truncate' : 'line-clamp-2'
              )}
            >
              {displaySummary}
            </p>
          ) : null}

          {/* Row 3: Metadata Badges */}
          {(() => {
            const rawCat = safeServer.category?.trim();
            const categoryLabel = rawCat && rawCat.toLowerCase() !== 'other' ? rawCat : '';
            return (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {categoryLabel ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] font-medium text-zinc-300">
                    {categoryLabel}
                  </span>
                ) : null}

                {/* Member Count */}
                {memberCount > 1 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-sans">
                    <Users className="size-3 text-zinc-400 shrink-0" />
                    <span>{memberCount.toLocaleString()}</span>
                  </span>
                ) : null}

                {/* ER:LC In-Game Indicator */}
                {safeServer.erlc?.connected && typeof safeServer.erlc.currentPlayers === 'number' && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{safeServer.erlc.currentPlayers} in-game</span>
                  </span>
                )}

                {/* Reward pill for directory variant */}
                {variant !== 'partnership' && reward > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[11px] font-medium text-[var(--accent)] font-sans">
                    <Coins className="size-3 shrink-0" />
                    <span>+{reward}</span>
                  </span>
                ) : null}

                {/* Partnership Requirements Badges */}
                {variant === 'partnership' ? (
                  !isSetUp ? null : (
                    <>
                      {minMembers !== undefined && minMembers !== null && minMembers > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] font-medium text-zinc-300 font-sans">
                          <Users className="size-3 text-zinc-400 shrink-0" />
                          <span>{minMembers.toLocaleString()}+</span>
                        </span>
                      ) : null}
                      {partnershipPrice !== undefined && partnershipPrice !== null && partnershipPrice > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[11px] font-medium text-[var(--accent)] font-sans">
                          <Coins className="size-3 shrink-0" />
                          <span>{partnershipPrice} cr</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400 font-sans">
                          Free
                        </span>
                      )}
                      {allowedMentions ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px] font-medium text-zinc-400 font-sans">
                          @{allowedMentions}
                        </span>
                      ) : null}
                    </>
                  )
                ) : null}
              </div>
            );
          })()}
        </div>

        {/* Column 3: Action Buttons (under content on <460px container, inline on >=460px) */}
        <div className="col-span-2 @[460px]:col-span-1 flex items-center justify-end gap-2 shrink-0 pt-2 @[460px]:pt-0 border-t border-white/[0.06] @[460px]:border-t-0">
          <Button
            type="button"
            variant={variant === 'partnership' ? 'ghost' : 'secondary'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(safeServer);
            }}
            disabled={previewOnly}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors',
              variant === 'partnership'
                ? 'bg-transparent hover:bg-white/10 text-zinc-300 border border-white/10'
                : 'bg-[#18181B] hover:bg-[#242429] text-zinc-200 border border-white/10'
            )}
          >
            View
          </Button>

          {variant === 'partnership' ? (
            isOwnServer ? (
              <span className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-[#18181B] border border-white/10 text-xs font-medium text-zinc-400 shrink-0 select-none">
                Your server
              </span>
            ) : partnershipStatus === 'active' ? (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs font-medium text-[var(--accent)] shrink-0 select-none">
                <Check className="size-3.5" />
                <span>Partnered</span>
              </span>
            ) : partnershipStatus === 'pending' ? (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#18181B] border border-white/10 text-xs font-medium text-zinc-300 shrink-0 select-none">
                <span>Requested</span>
              </span>
            ) : !isSetUp ? (
              <Button
                type="button"
                size="sm"
                disabled
                className="h-8 px-3 rounded-lg bg-[#18181B] border border-white/5 text-zinc-500 font-semibold text-xs flex items-center gap-1 cursor-not-allowed opacity-60 shrink-0 select-none"
              >
                <span>Not set up</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestPartnership ? onRequestPartnership(safeServer) : onClick?.(safeServer);
                }}
                disabled={previewOnly}
                className="h-8 px-3 rounded-lg bg-[var(--accent)] hover:brightness-110 text-[var(--accent-foreground)] font-semibold text-xs flex items-center gap-1 cursor-pointer shadow-xs transition-transform active:scale-95 shrink-0"
              >
                <span>Request partnership</span>
              </Button>
            )
          ) : (
            isOwnServer ? (
              <span className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-[#18181B] border border-white/10 text-xs font-medium text-zinc-400 shrink-0 select-none">
                Your server
              </span>
            ) : isJoined ? (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-xs font-medium text-[var(--accent)] shrink-0 select-none">
                <Check className="size-3.5" />
                <span>Joined</span>
              </span>
            ) : isVerifying ? (
              <span className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#18181B] border border-white/10 text-xs font-medium text-zinc-300 shrink-0 select-none">
                <span>Verifying</span>
              </span>
            ) : isExpired ? (
              <Button
                type="button"
                size="sm"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const res = await fetch(`/api/servers/${safeServer.id || safeServer.guildId}/report-expired-invite`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include'
                    });
                    if (res.ok) {
                      const data = await res.json();
                      alert(data.rateLimited ? 'You already reported this invite recently.' : 'Thank you. The community owner has been notified that the invite is expired.');
                    } else {
                      alert('Please sign in to report an expired invite.');
                    }
                  } catch {
                    alert('Unable to report at this moment.');
                  }
                }}
                className="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <span>Invite expired</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin?.(safeServer);
                }}
                disabled={previewOnly}
                className="h-8 px-3 rounded-lg bg-[var(--accent)] hover:brightness-110 text-[var(--accent-foreground)] font-medium text-xs flex items-center gap-1 cursor-pointer shadow-xs transition-transform active:scale-95 shrink-0"
              >
                <Coins className="size-3.5 shrink-0" />
                <span>Join (+{reward})</span>
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default DirectoryCard;
