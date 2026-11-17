import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Check, Coins, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

const DURATION_STEPS = [1, 2, 3, 6, 12] as const;

interface PremiumTabProps {
  guild: DiscordGuild | null;
  workspace: WorkspaceBot | null;
  config: WorkspaceCustomizations;
  onNavigateTab: (tab: string) => void;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

export function PremiumTab({ guild, workspace, addToast }: PremiumTabProps) {
  const guildId = guild?.id || workspace?.guildId || '';
  const serverName = guild?.name || 'Community Server';

  const [stepIndex, setStepIndex] = useState<number>(0);
  const selectedMonths = DURATION_STEPS[stepIndex] ?? 1;

  const [pricePerMonth, setPricePerMonth] = useState<number | null>(null);
  const [perks, setPerks] = useState<string[]>([]);
  const [serverBalance, setServerBalance] = useState<number>(0);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);

  const loadPremiumState = useCallback(async () => {
    if (!guildId) return;
    setLoading(true);
    try {
      const [settingsRes, serverRes] = await Promise.all([
        fetch('/api/premium/settings'),
        fetch(`/api/servers/${guildId}/premium`)
      ]);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        const s = sData?.settings || {};
        const rawPrice = s.premium_price_credits;
        if (rawPrice === null || rawPrice === undefined || rawPrice === '' || Number(rawPrice) <= 0) {
          setPricePerMonth(null);
        } else {
          setPricePerMonth(Number(rawPrice));
        }
        if (Array.isArray(s.premium_perks) && s.premium_perks.length > 0) {
          setPerks(s.premium_perks);
        } else {
          setPerks([
            `${s.premium_join_reward_credits || 5} credits paid to members per verified join`,
            'Animated GIF banner uploads on your public server page',
            `Up to ${s.premium_max_advertisers || 5} advertiser seats`,
            `${s.premium_bump_cooldown_minutes || 60}-minute bump cooldown`,
            'Premium badge across directory and public server page'
          ]);
        }
      }

      if (serverRes.ok) {
        const pData = await serverRes.json();
        setServerBalance(Number(pData.creditBalance || 0));
        setIsPremium(Boolean(pData.is_premium));
        setPremiumExpiresAt(pData.premium_expires_at || null);
      }
    } catch (err) {
      console.warn('[PREMIUM] Failed to load premium state:', err);
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    loadPremiumState();
  }, [loadPremiumState]);

  const isPriceSet = pricePerMonth !== null && pricePerMonth > 0;
  const totalPrice = isPriceSet ? pricePerMonth * selectedMonths : null;
  const canAfford = totalPrice !== null && serverBalance >= totalPrice;
  const sliderProgressPct = (stepIndex / (DURATION_STEPS.length - 1)) * 100;

  const handleConfirmPurchase = async () => {
    if (!guildId || !isPriceSet || totalPrice === null || purchasing) return;
    setPurchasing(true);
    try {
      const res = await apiFetch(`/api/servers/${guildId}/premium/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months: selectedMonths })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not complete Premium purchase.');
      }
      setConfirmOpen(false);
      await loadPremiumState();
      addToast(
        'success',
        'Premium Activated',
        `Activated ${selectedMonths} ${selectedMonths === 1 ? 'month' : 'months'} of Premium for ${serverName}.`
      );
    } catch (err: any) {
      addToast('error', 'Purchase Failed', err.message || 'Could not complete Premium purchase.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6 pb-16 font-sans text-zinc-200">
      {/* Breadcrumb & Plain Header */}
      <div className="space-y-1 pb-5 border-b border-white/[0.08]">
        <div className="text-xs text-zinc-500">Shop / Premium</div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Premium
        </h1>
        <p className="text-sm text-zinc-400">
          Upgrade {serverName} using your server credit balance.
        </p>
      </div>

      {/* Active Status Bar if Premium */}
      {isPremium && premiumExpiresAt && (
        <div className="px-4 py-3 rounded-2xl border border-white/[0.08] bg-[var(--bg-elevated,#121215)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-200 font-medium">
            <Check className="size-4 text-[var(--accent)]" />
            <span>Premium is active for {serverName}</span>
          </div>
          <div className="text-zinc-400 flex items-center gap-1.5">
            <Clock className="size-3.5" />
            <span>
              Expires {new Date(premiumExpiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-xs text-zinc-500">
          Loading Premium plan…
        </div>
      ) : (
        /* Two-card pricing slider layout rebuilt with theme variables */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Left Card: Duration Slider */}
          <div className="rounded-2xl border border-white/[0.08] bg-[var(--bg-elevated,#121215)] p-6 sm:p-8 flex flex-col justify-between space-y-8">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-zinc-100">
                Choose duration
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Slide to select how many months of Premium to add to {serverName}. Purchasing while active extends your current expiry date.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-semibold text-zinc-100 tabular-nums">
                  {selectedMonths} {selectedMonths === 1 ? 'month' : 'months'}
                </span>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {selectedMonths * 30} days total
                </span>
              </div>

              <div className="space-y-3">
                <input
                  type="range"
                  min={0}
                  max={DURATION_STEPS.length - 1}
                  step={1}
                  value={stepIndex}
                  onChange={(e) => setStepIndex(Number(e.target.value))}
                  aria-label="Premium duration in months"
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-zinc-800 accent-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{
                    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${sliderProgressPct}%, rgba(255,255,255,0.1) ${sliderProgressPct}%, rgba(255,255,255,0.1) 100%)`
                  }}
                />

                <div className="flex items-center justify-between text-xs text-zinc-500 px-0.5">
                  {DURATION_STEPS.map((m, idx) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setStepIndex(idx)}
                      className={`px-2 py-1 rounded-full transition-colors cursor-pointer ${
                        idx === stepIndex
                          ? 'text-zinc-100 font-semibold bg-white/[0.06]'
                          : 'hover:text-zinc-300'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
              <span>Monthly rate</span>
              <span className="text-zinc-200 font-medium tabular-nums">
                {isPriceSet ? `${pricePerMonth} credits / month` : 'Price not set'}
              </span>
            </div>
          </div>

          {/* Right Card: Plan Summary, Total, Balance, Perks & Buy Button */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0E0E11] p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/[0.06]">
                <div>
                  <div className="text-xs text-zinc-400">Selected plan</div>
                  <div className="text-lg font-semibold text-zinc-100 mt-0.5">
                    Server Premium ({selectedMonths} {selectedMonths === 1 ? 'month' : 'months'})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-400">Total</div>
                  {isPriceSet && totalPrice !== null ? (
                    <div className="text-2xl font-semibold text-zinc-100 tabular-nums mt-0.5">
                      {totalPrice.toLocaleString()} <span className="text-xs font-normal text-zinc-400">credits</span>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-amber-400 mt-1">
                      Price not set
                    </div>
                  )}
                </div>
              </div>

              {/* Server Balance Row */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-900/70 border border-white/[0.06] text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Coins className="size-3.5 text-[var(--accent)]" />
                  <span>Server balance</span>
                </span>
                <span className="font-semibold text-zinc-100 tabular-nums">
                  {serverBalance.toLocaleString()} credits
                </span>
              </div>

              {/* Perks from Settings */}
              <div className="space-y-2.5">
                <div className="text-xs font-medium text-zinc-300">Included perks</div>
                <ul className="space-y-2">
                  {perks.map((perk, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                      <Check className="size-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
              {!isPriceSet ? (
                <div className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>Price not set in admin settings.</span>
                </div>
              ) : !canAfford && totalPrice !== null ? (
                <div className="text-xs text-amber-400">
                  Need {(totalPrice - serverBalance).toLocaleString()} more credits in your server balance.
                </div>
              ) : null}

              <Button
                type="button"
                disabled={!isPriceSet || !canAfford || purchasing}
                onClick={() => setConfirmOpen(true)}
                className="w-full h-10 rounded-full text-xs font-semibold bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                {!isPriceSet
                  ? 'Price not set'
                  : isPremium
                  ? `Extend Premium (${selectedMonths} ${selectedMonths === 1 ? 'month' : 'months'})`
                  : `Buy Premium (${selectedMonths} ${selectedMonths === 1 ? 'month' : 'months'})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmOpen && isPriceSet && totalPrice !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.12] bg-[#121215] p-6 space-y-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-100">Confirm Premium Purchase</h3>
              <p className="text-xs text-zinc-400">
                Deduct credits from {serverName}'s server balance to activate Premium.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/[0.06] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Duration</span>
                <span className="text-zinc-100 font-medium">
                  {selectedMonths} {selectedMonths === 1 ? 'month' : 'months'} ({selectedMonths * 30} days)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total cost</span>
                <span className="text-zinc-100 font-semibold tabular-nums">{totalPrice} credits</span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex justify-between">
                <span className="text-zinc-400">Balance after</span>
                <span className="text-zinc-100 font-semibold tabular-nums">
                  {Math.max(0, serverBalance - totalPrice)} credits
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={purchasing}
                onClick={() => setConfirmOpen(false)}
                className="h-9 px-3.5 rounded-full text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={purchasing}
                onClick={handleConfirmPurchase}
                className="h-9 px-4 rounded-full text-xs font-semibold bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90"
              >
                {purchasing ? 'Processing…' : 'Confirm purchase'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PremiumTab;
