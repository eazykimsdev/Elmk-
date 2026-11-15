import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { formatLastBump } from '@/lib/format';
import { BUMP_COOLDOWN_HOURS, BUMP_COST_CREDITS, formatBumpCooldown } from '@/lib/bump-config';

export interface BumpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guildId: string;
  serverName: string;
  iconUrl?: string | null;
  iconHash?: string | null;
  onSuccess?: () => void;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export function BumpDialog({
  open,
  onOpenChange,
  guildId,
  serverName,
  iconUrl,
  iconHash,
  onSuccess,
  addToast,
  onNavigateTab,
}: BumpDialogProps) {
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [lastBumpedAt, setLastBumpedAt] = useState<string | number | null>(null);
  const [currentRank, setCurrentRank] = useState<number | null>(null);
  const [isBumping, setIsBumping] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const [userBalance, setUserBalance] = useState<number>(() => {
    try {
      const b = localStorage.getItem('erlcus_credits_balance');
      return b ? parseInt(b, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Track double-click debounce
  const lastClickRef = useRef<number>(0);

  // Fetch live bump telemetry and directory status when opened
  useEffect(() => {
    if (!open || !guildId) return;

    let isMounted = true;
    async function fetchStatus() {
      try {
        const [bumpRes, balRes] = await Promise.all([
          fetch(`/api/servers/${guildId}/bump`),
          fetch(`/api/directory/balance?guildId=${guildId}`, { credentials: 'include' })
        ]);

        if (bumpRes.ok) {
          const data = await bumpRes.json();
          if (isMounted) {
            setCooldownSeconds(data.cooldownSeconds || 0);
            if (data.lastBumpedAt) {
              setLastBumpedAt(data.lastBumpedAt);
            }
            if (typeof data.rank === 'number') {
              setCurrentRank(data.rank);
            }
          }
        }

        if (balRes.ok) {
          const balData = await balRes.json();
          if (isMounted && typeof balData.balance === 'number') {
            setUserBalance(balData.balance);
          }
        }
      } catch {
        // Fallback to local storage trackers
        try {
          const next = localStorage.getItem(`server_next_bump_${guildId}`);
          if (next) {
            const rem = Math.max(0, Math.ceil((new Date(next).getTime() - Date.now()) / 1000));
            if (isMounted) setCooldownSeconds(rem);
          }
          const last = localStorage.getItem(`server_last_bump_${guildId}`);
          if (last && isMounted) setLastBumpedAt(last);
        } catch {}
      }
    }

    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, [open, guildId]);

  // Live ticking countdown for bump cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Live ticking countdown for 429 rate limit
  useEffect(() => {
    if (rateLimitCooldown <= 0) return;
    const interval = setInterval(() => {
      setRateLimitCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitCooldown]);

  // Format live countdown text (e.g. "58 minutes" or "1 hour 12 minutes")
  const formattedCountdown = useMemo(() => {
    if (cooldownSeconds <= 0) return 'now';
    const hours = Math.floor(cooldownSeconds / 3600);
    const minutes = Math.ceil((cooldownSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return `${Math.max(1, minutes)} minute${minutes > 1 ? 's' : ''}`;
  }, [cooldownSeconds]);

  const cost = BUMP_COST_CREDITS;
  const isShortCredits = cost > 0 && userBalance < cost;
  const canSubmit = cooldownSeconds === 0 && !isShortCredits && !isBumping && rateLimitCooldown === 0;

  // Last bump formatted with safe parser and exact UTC tooltip
  const lastBumpInfo = useMemo(() => {
    return formatLastBump(lastBumpedAt);
  }, [lastBumpedAt]);

  // Handle actual bump execution with double-click debounce
  const handleBumpNow = async () => {
    const now = Date.now();
    if (now - lastClickRef.current < 500) {
      return; // Ignore rapid repeat clicks within 500ms
    }
    lastClickRef.current = now;

    if (!canSubmit) return;
    setIsBumping(true);

    try {
      const res = await fetch(`/api/servers/${guildId}/bump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Bump succeeded
        const nextTime = data.nextBumpAt || (Date.now() + BUMP_COOLDOWN_HOURS * 3600000);
        const nowIso = new Date().toISOString();
        localStorage.setItem(`server_next_bump_${guildId}`, String(nextTime));
        localStorage.setItem(`server_last_bump_${guildId}`, nowIso);

        // Increment bumps count
        const currentBumps = parseInt(localStorage.getItem(`server_bumps_count_${guildId}`) || '0', 10);
        localStorage.setItem(`server_bumps_count_${guildId}`, String(currentBumps + 1));

        window.dispatchEvent(new Event('server_bumped'));
        window.dispatchEvent(new Event('erlcus_bump_updated'));

        addToast?.('success', 'Bumped', 'Bumped. Your server is now #1.');
        onSuccess?.();
        onOpenChange(false);
      } else if (res.status === 429) {
        // Token bucket rate limit triggered
        const retrySec = Number(data.retryAfterSeconds) || 12;
        setRateLimitCooldown(retrySec);
        addToast?.('warning', 'Going too fast', `You're going too fast. Try again in ${retrySec} seconds.`);
        if (data.cooldownSeconds) {
          setCooldownSeconds(data.cooldownSeconds);
        }
      } else {
        // Server rejected with regular cooldown or error
        if (data.cooldownSeconds) {
          setCooldownSeconds(data.cooldownSeconds);
        }
        addToast?.('error', 'Bump failed', data.error || 'Could not bump your server.');
      }
    } catch {
      // Local fallback
      const nowIso = new Date().toISOString();
      localStorage.setItem(`server_next_bump_${guildId}`, String(Date.now() + BUMP_COOLDOWN_HOURS * 3600000));
      localStorage.setItem(`server_last_bump_${guildId}`, nowIso);

      window.dispatchEvent(new Event('server_bumped'));
      window.dispatchEvent(new Event('erlcus_bump_updated'));

      addToast?.('success', 'Bumped', 'Bumped. Your server is now #1.');
      onSuccess?.();
      onOpenChange(false);
    } finally {
      setIsBumping(false);
    }
  };

  // Keyboard accessibility: Enter to submit, Escape handled by Dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      handleBumpNow();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={handleKeyDown}
        className="w-full max-w-[460px] rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#0E0E11] p-6 shadow-2xl font-sans space-y-5"
      >
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="text-[18px] font-semibold text-[#F4F4F5] tracking-normal font-sans">
            Bump your server
          </DialogTitle>

          {/* Compact chip with ServerIcon and server name */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.06)]">
            <ServerIcon
              guildId={guildId}
              iconHash={iconHash}
              iconUrl={iconUrl}
              name={serverName}
              size={28}
              className="size-7 rounded-[7px] shrink-0"
            />
            <span className="text-[14px] font-medium text-[#F4F4F5] truncate font-sans">
              {serverName}
            </span>
          </div>
        </DialogHeader>

        {/* Position Row: Now #X -> arrow -> After #1 */}
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.06)] text-[13px]">
          <span className="text-[#A1A1AA]">Position</span>
          <div className="flex items-center gap-2 font-medium">
            <span className="text-[#A1A1AA]">
              {currentRank ? `Now #${currentRank}` : 'Now Unlisted'}
            </span>
            <ArrowRight className="size-3.5 text-[#71717A]" />
            <span className="text-[var(--accent)] font-semibold">After #1</span>
          </div>
        </div>

        {/* Cooldown Active Notice (Neutral amber panel, clock icon, NO emoji) */}
        {cooldownSeconds > 0 && (
          <div className="rounded-[12px] bg-[#FBBF24]/10 border border-[#FBBF24]/20 p-3.5 flex items-start gap-3 text-[#FBBF24]">
            <Clock className="size-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-[#F4F4F5]">You can't bump yet</div>
              <p className="text-[#A1A1AA] leading-relaxed">
                You can bump again in <strong className="text-[#FBBF24] font-medium">{formattedCountdown}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Short Balance Warning */}
        {isShortCredits && (
          <div className="rounded-[12px] bg-[#F87171]/10 border border-[#F87171]/20 p-3.5 flex items-start justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-[#F4F4F5]">Insufficient credits</div>
              <p className="text-[#A1A1AA]">
                You need {cost - userBalance} more credits to bump.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onNavigateTab?.('earn');
              }}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline cursor-pointer"
            >
              <span>Earn credits</span>
            </button>
          </div>
        )}

        {/* Summary list with dividers (label left, value right) */}
        <div className="divide-y divide-[rgba(255,255,255,0.06)] border-y border-[rgba(255,255,255,0.06)] text-[13px] py-1">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#A1A1AA]">Moves to</span>
            <span className="font-medium text-[#F4F4F5]">#1 in the directory</span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#A1A1AA]">Cooldown after bumping</span>
            <span className="font-medium text-[#F4F4F5]">{formatBumpCooldown(BUMP_COOLDOWN_HOURS)}</span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#A1A1AA]">Cost</span>
            <span className="font-medium text-[#F4F4F5]">
              {cost === 0 ? 'Free' : `${cost} credits`}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#A1A1AA]">Last bump</span>
            <span
              className="font-medium text-[#F4F4F5] cursor-help"
              title={lastBumpInfo.exact}
            >
              {lastBumpInfo.relative}
            </span>
          </div>

          {cost > 0 && (
            <>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[#A1A1AA]">Balance now</span>
                <span className="font-medium text-[#F4F4F5]">{userBalance} credits</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[#A1A1AA]">Balance after</span>
                <span className="font-medium text-[#F4F4F5]">{Math.max(0, userBalance - cost)} credits</span>
              </div>
            </>
          )}
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isBumping}
            className="px-3.5 py-1.5 rounded-[8px] text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-white/[0.04] transition-colors cursor-pointer outline-none focus:outline-none"
          >
            Cancel
          </button>

          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={handleBumpNow}
            disabled={!canSubmit}
            className="h-8 px-4 text-xs font-medium bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] gap-1.5"
          >
            {isBumping ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Bumping…</span>
              </>
            ) : rateLimitCooldown > 0 ? (
              <span>Wait {rateLimitCooldown}s</span>
            ) : (
              <span>Bump now</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
