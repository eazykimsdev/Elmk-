import React from 'react';
import { Users, Check, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { stripMarkdown } from '@/components/ui/markdown-renderer';
import { cn } from '@/lib/utils';

export interface DirectoryServerData {
  id: string;
  name: string;
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
  isFeaturedSpot?: boolean;
  isHighlighted?: boolean;
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
        safeServer.isHighlighted && 'border-[var(--accent)]/60 ring-[var(--accent)]/30',
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
            opacity: 0.35,
          }}
        />
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, rgba(9,9,11,0.88) 0%, rgba(9,9,11,0.62) 100%)',
        }}
      />

      {/* ── Grid Layout: [icon: 48px/56px] [content: 1fr] [actions: auto] with container wrap ── */}
      <div className={cn(
        "relative z-10 grid items-center gap-3.5 w-full",
        iconSize === 48
          ? "grid-cols-[48px_minmax(0,1fr)] @[460px]:grid-cols-[48px_minmax(0,1fr)_auto]"
          : "grid-cols-[56px_minmax(0,1fr)] @[460px]:grid-cols-[56px_minmax(0,1fr)_auto]"
      )}>
        {/* Column 1: ServerIcon 48px or 56px */}
        <div className="shrink-0 self-start @[460px]:self-center">
          <ServerIcon
            guildId={safeServer.id}
            iconHash={safeServer.icon_hash || safeServer.iconHash || safeServer.icon}
            iconUrl={safeServer.iconUrl || safeServer.icon}
            name={serverName || 'Server'}
            size={iconSize}
            className={cn(
              "rounded-[14px] shrink-0 object-cover shadow-md border border-white/10",
              iconSize === 48 ? "size-12" : "size-[56px]"
            )}
          />
        </div>

        {/* Column 2: Name, Category + Members, 1-line Summary */}
        <div className="flex flex-col justify-center gap-1 min-w-0 overflow-hidden">
          {/* Row 1: Server name (16px/600, ellipsis) or skeleton line */}
          <div className="flex items-center gap-1.5 min-w-0">
            {serverName ? (
              <h4 className="text-[16px] font-semibold text-white truncate tracking-tight font-sans min-w-0">
                {serverName}
              </h4>
            ) : (
              <div className="h-4 bg-white/10 rounded-[4px] w-28 animate-pulse" />
            )}
            {safeServer.verified && (
              <Check className="size-3.5 text-[var(--accent)] stroke-[2.5] shrink-0" />
            )}
            {safeServer.is_premium && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 tracking-wider shrink-0 select-none">
                Premium
              </span>
            )}
            {safeServer.isFeaturedSpot && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] text-zinc-200 border border-white/15 shrink-0 select-none">
                Featured
              </span>
            )}
            {safeServer.bot_in_guild === false && (
              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#141417] border border-white/10 text-zinc-400 text-[10px] font-medium shrink-0">
                Joins can't be verified
              </span>
            )}
          </div>

          {/* Row 2: Category badge and member count */}
          {(safeServer.category || (memberCount && memberCount > 1)) && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 min-w-0 flex-wrap">
              {safeServer.category && (
                <span className="px-2 py-0.5 rounded-[6px] bg-[#141417]/90 border border-white/[0.08] text-zinc-300 font-medium text-[11px] leading-none shrink-0">
                  {safeServer.category}
                </span>
              )}
              {memberCount && memberCount > 1 ? (
                <span className="flex items-center gap-1 tabular-nums text-zinc-400 text-xs shrink-0">
                  <Users className="size-3.5 text-zinc-500 shrink-0" />
                  <span>{Number(memberCount).toLocaleString()} members</span>
                </span>
              ) : null}
            </div>
          )}

          {/* Row 3: Summary or skeleton line */}
          <div className={cn(
            'text-[13px] text-zinc-400 font-sans min-w-0 leading-normal',
            (lineClamp === 2 || variant === 'partnership') ? 'line-clamp-2 leading-snug' : 'truncate'
          )}>
            {displaySummary ? (
              <span className={(lineClamp === 2 || variant === 'partnership') ? undefined : 'truncate block'}>{displaySummary}</span>
            ) : (
              <div className="h-3 bg-white/10 rounded-[4px] w-44 animate-pulse mt-1" />
            )}
          </div>

          {/* Row 4: Terms row of small badges (for partnership variant) */}
          {variant === 'partnership' && (() => {
            if (!isSetUp) {
              return (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[11px] text-zinc-400">
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#141417]/90 border border-white/[0.08] text-zinc-500 font-medium shrink-0">
                    Not set up
                  </span>
                </div>
              );
            }

            const min = minMembers !== undefined ? minMembers : (safeServer.partnershipMinMembers ?? null);
            const price = partnershipPrice !== undefined ? partnershipPrice : (safeServer.partnershipPrice ?? null);
            const rawMentions = allowedMentions !== undefined
              ? allowedMentions
              : (safeServer.partnershipAllowedMentions || (safeServer.partnershipAllowHere ? 'here' : null));
            const isEveryone = rawMentions === 'everyone' || rawMentions === '@everyone allowed';
            const isHere = rawMentions === 'here' || rawMentions === '@here allowed';

            return (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[11px] text-zinc-400">
                {min !== null && min > 0 && (
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#141417]/90 border border-white/[0.08] text-zinc-300 font-medium shrink-0">
                    Min {min} members
                  </span>
                )}
                {price !== null && price > 0 && (
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#141417]/90 border border-white/[0.08] text-zinc-300 font-medium shrink-0">
                    Price {price} credits
                  </span>
                )}
                {rawMentions ? (
                  isEveryone ? (
                    <span className="px-2 py-0.5 rounded-[6px] bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent)] font-medium shrink-0">
                      @everyone allowed
                    </span>
                  ) : isHere ? (
                    <span className="px-2 py-0.5 rounded-[6px] bg-[#141417]/90 border border-white/[0.08] text-zinc-300 font-medium shrink-0">
                      @here allowed
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-[6px] bg-[#141417]/90 border border-white/[0.08] text-zinc-500 font-medium shrink-0">
                      No mentions
                    </span>
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
                    const res = await fetch(`/api/servers/${safeServer.id || (safeServer as any).guildId}/report-expired-invite`, {
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
                <span>Join (+{reward} credits)</span>
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default DirectoryCard;
