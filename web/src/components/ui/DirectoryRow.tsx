import React, { useState } from 'react';
import {
  Users,
  Check,
  Clock,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { stripMarkdown } from '@/components/ui/markdown-renderer';
import { cn } from '@/lib/utils';
import type { DirectoryServerData } from './directory-card';

export interface DirectoryRowProps {
  server: DirectoryServerData;
  rank?: number;
  bumpTime?: string;
  rewardCoins?: number;
  isOwnServer?: boolean;
  isJoined?: boolean;
  isVerifying?: boolean;
  onJoin?: (server: DirectoryServerData) => void;
  onClick?: (server: DirectoryServerData) => void;
  className?: string;
}

export function DirectoryRow({
  server,
  rank,
  bumpTime = '2h ago',
  rewardCoins = 2,
  isOwnServer = false,
  isJoined = false,
  isVerifying = false,
  onJoin,
  onClick,
  className,
}: DirectoryRowProps) {
  const [imgError, setImgError] = useState(false);
  const serverName = server?.name || '';
  const category = server?.category || '';
  const memberCount = Number(server?.memberCount || 0);

  // Description truncated to 1 line
  const oneLineDesc = stripMarkdown(server?.summary || server?.description || '');

  // ER:LC telemetry if connected
  const isErlcConnected = Boolean(
    server?.erlc?.connected ||
    (server?.erlc?.currentPlayers !== undefined && server?.erlc?.currentPlayers !== null)
  );
  const currentPlayers = server?.erlc?.currentPlayers ?? 0;
  const maxPlayers = server?.erlc?.maxPlayers ?? 32;
  const isExpired = server?.invite_status === 'expired';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(server)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(server);
        }
      }}
      className={cn(
        'group flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 sm:px-4 min-h-[80px] sm:h-[72px] rounded-xl border border-white/[0.06] bg-[#0E0E11] hover:bg-[#141417] hover:border-white/15 transition-all text-left w-full outline-hidden cursor-pointer gap-3 sm:gap-4 select-none',
        server?.isHighlighted && 'border-[var(--accent)]/60 ring-1 ring-[var(--accent)]/30',
        isExpired && 'opacity-60 grayscale-[0.25]',
        className
      )}
    >
      {/* ── LEFT: Rank, Icon, Name, Category, Badges, ER:LC ── */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {rank !== undefined && (
          <span className="text-xs font-mono font-medium text-zinc-500 w-5 shrink-0 hidden sm:block text-right">
            #{rank}
          </span>
        )}

        {/* Server Icon (44px, radius 10px, 1px border) */}
        <ServerIcon
          guildId={server.id}
          iconHash={server.icon_hash || server.iconHash || server.icon}
          iconUrl={server.iconUrl || server.icon}
          name={serverName}
          size={44}
          className="size-11 rounded-[10px] shrink-0 object-cover"
        />

        {/* Name, Category Pill, Badges */}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-medium text-white truncate max-w-[200px] sm:max-w-[260px] group-hover:text-[var(--brand)] transition-colors">
              {serverName}
            </span>

            {/* Verified badge */}
            {server.verified && (
              <span className="inline-flex items-center text-[var(--accent)] shrink-0" title="Verified server">
                <Check className="size-3.5 stroke-[2.5]" />
              </span>
            )}

            {/* Premium badge */}
            {server.is_premium && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 tracking-wider shrink-0 select-none">
                Premium
              </span>
            )}

            {/* Featured badge */}
            {server.isFeaturedSpot && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] text-zinc-200 border border-white/15 shrink-0 select-none">
                Featured
              </span>
            )}

            {/* Category Pill */}
            {category ? (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 bg-[#141417] text-zinc-300 border-white/10 font-medium shrink-0"
              >
                {category}
              </Badge>
            ) : null}

            {/* ER:LC Status Pill (ONLY if connected) */}
            {isErlcConnected && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[10px] font-medium text-[var(--accent)] shrink-0">
                <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                <span>Live • {currentPlayers}/{maxPlayers}</span>
              </span>
            )}
          </div>

          {/* Description truncated to one line (Desktop only; hidden on mobile) */}
          <p className="hidden lg:block text-xs text-zinc-400 truncate max-w-md xl:max-w-xl font-normal">
            {oneLineDesc}
          </p>
        </div>
      </div>

      {/* ── RIGHT: Members, Bump time, Reward pill, Join Button ── */}
      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t border-white/[0.04] sm:border-0">
        <div className="flex items-center gap-3 text-xs text-zinc-400 shrink-0">
          {/* Member count */}
          {memberCount > 1 ? (
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-zinc-500" />
              <span className="tabular-nums font-medium text-zinc-300">{memberCount.toLocaleString()}</span>
              <span className="text-zinc-500 hidden sm:inline">members</span>
            </span>
          ) : null}

          {/* Bump time */}
          <span className="flex items-center gap-1 text-zinc-500 text-[11px] hidden md:flex">
            <Clock className="size-3 text-zinc-600" />
            <span>{bumpTime}</span>
          </span>

          {/* Reward pill */}
          <span className="px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)] text-xs font-semibold tabular-nums">
            +{server.rewardCoins ?? rewardCoins} credits
          </span>
        </div>

        {/* Primary Join Button (Does not trigger row click) */}
        {isOwnServer ? (
          <Badge
            variant="outline"
            className="text-xs bg-[#141417] text-zinc-400 border-white/10 px-3 py-1.5 rounded-xl shrink-0"
          >
            Your server
          </Badge>
        ) : isExpired ? (
          <Button
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const res = await fetch(`/api/servers/${server.id || (server as any).guildId}/report-expired-invite`, {
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
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold text-xs h-8.5 px-3 rounded-xl shrink-0 cursor-pointer transition-all"
          >
            Invite expired
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onJoin?.(server);
            }}
            className="bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] font-semibold text-xs h-8.5 px-4 rounded-xl shrink-0 cursor-pointer transition-all"
          >
            {isVerifying ? 'Verifying' : isJoined ? 'Joined' : 'Join'}
          </Button>
        )}
      </div>
    </div>
  );
}

