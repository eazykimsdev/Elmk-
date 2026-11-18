import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingBag,
  Zap,
  Crown,
  Sparkles,
  Clock,
  AlertCircle,
  Check,
  Coins,
  Shield,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

export interface ShopItem {
  id: string;
  name: string;
  effect: 'auto_bump' | 'featured_spot' | 'listing_highlight' | 'extra_advertiser' | string;
  durationMs: number;
  price: number;
  isActive: boolean;
  description: string;
}

export interface ActiveBoost {
  id?: string;
  itemId?: string;
  effect: string;
  name: string;
  activeUntil?: number;
  expiresAt?: number;
  remainingSeconds?: number;
  timeRemainingLabel?: string;
  formattedTimeLeft?: string;
}

interface ShopTabProps {
  currentGuildId: string;
  guild?: DiscordGuild | null;
  workspace?: WorkspaceBot | null;
  config?: WorkspaceCustomizations;
  serverName?: string;
  initialTab?: 'boosts' | 'premium' | 'active';
  onNavigateTab?: (tab: string) => void;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body?: string) => void;
}

const DURATION_STEPS = [
  { months: 1, label: '1 month', savePct: 0 },
  { months: 3, label: '3 months', savePct: 5 },
  { months: 6, label: '6 months', savePct: 10 },
  { months: 12, label: '1 year', savePct: 20 }
];

export function ShopTab({
  currentGuildId,
  guild,
  workspace,
  config: _config,
  serverName: propServerName,
  initialTab = 'boosts',
  onNavigateTab,
  addToast
}: ShopTabProps) {
  const serverName = guild?.name || propServerName || 'Community Server';

  const [activeTab, setActiveTab] = useState<'boosts' | 'premium' | 'active'>(
    initialTab === 'premium' ? 'premium' : initialTab === 'active' ? 'active' : 'boosts'
  );

  // Shop state
  const [items, setItems] = useState<ShopItem[]>([]);
  const [activeBoosts, setActiveBoosts] = useState<ActiveBoost[]>([]);
  const [serverBalance, setServerBalance] = useState<number>(0);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Premium state
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [premiumExpiresAt, setPremiumExpiresAt] = useState<string | null>(null);
  const [premiumDaysLeft, setPremiumDaysLeft] = useState<number>(0);
  const [premiumPricePerMonth, setPremiumPricePerMonth] = useState<number>(50); // Default to 50 cr/mo
  const [selectedMonthsIndex, setSelectedMonthsIndex] = useState<number>(0);

  // Purchase state
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [selectedPurchaseType, setSelectedPurchaseType] = useState<'boost' | 'premium'>('boost');
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);

  const selectedMonths = DURATION_STEPS[selectedMonthsIndex].months;
  const premiumBasePrice = premiumPricePerMonth * selectedMonths;
  const premiumDiscount = Math.round(premiumBasePrice * (DURATION_STEPS[selectedMonthsIndex].savePct / 100));
  const finalPremiumPrice = Math.max(0, premiumBasePrice - premiumDiscount);

  // Load all shop and premium telemetry
  const loadData = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      setLoading(true);
      const [shopRes, premRes] = await Promise.all([
        apiFetch(`/workspace/${currentGuildId}/shop`),
        apiFetch(`/api/servers/${currentGuildId}/premium`).catch(() => null)
      ]);

      let bal = 0;

      if (shopRes.ok) {
        const sData = await shopRes.json();
        setItems(Array.isArray(sData.items) ? sData.items : []);
        setActiveBoosts(Array.isArray(sData.activeBoosts) ? sData.activeBoosts : []);
        bal = Number(sData.serverBalance || 0);
        setIsOwner(Boolean(sData.isOwner));
        setIsManager(Boolean(sData.isManager));
      }

      if (premRes && premRes.ok) {
        const pData = await premRes.json();
        setIsPremium(Boolean(pData.isPremium));
        setPremiumExpiresAt(pData.premiumUntil || null);
        setPremiumDaysLeft(Number(pData.daysLeft || 0));
        if (pData.price && Number(pData.price) > 0) {
          setPremiumPricePerMonth(Number(pData.price));
        }
        // Fix for bug where Premium previously showed 0 balance
        const premBal = Number(pData.balance !== undefined ? pData.balance : pData.creditBalance);
        if (!bal && Number.isFinite(premBal) && premBal > 0) {
          bal = premBal;
        }
      }

      setServerBalance(bal);
    } catch (err) {
      console.warn('[SHOP] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentGuildId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canManage = isOwner || isManager;
  const disabledReason = !canManage
    ? 'Only server owners or managers can make purchases.'
    : undefined;

  // Selected item price calculation
  const targetPrice = useMemo(() => {
    if (activeTab === 'premium') return finalPremiumPrice;
    if (selectedItem) return selectedItem.price;
    return null;
  }, [activeTab, finalPremiumPrice, selectedItem]);

  const balanceAfter = targetPrice !== null ? serverBalance - targetPrice : null;

  // Open confirm purchase dialog for boost
  const handleOpenBuyBoost = (item: ShopItem) => {
    if (!canManage) return;
    setSelectedItem(item);
    setSelectedPurchaseType('boost');
    setConfirmOpen(true);
  };

  // Open confirm purchase dialog for premium
  const handleOpenBuyPremium = () => {
    if (!canManage) return;
    setSelectedPurchaseType('premium');
    setConfirmOpen(true);
  };

  // Perform purchase with double-click locking
  const handleConfirmPurchase = async () => {
    if (purchasing || !canManage || !currentGuildId) return;
    setPurchasing(true);

    try {
      if (selectedPurchaseType === 'boost' && selectedItem) {
        const res = await apiFetch(`/api/workspace/${currentGuildId}/shop/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: selectedItem.id })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Boost purchase failed.');
        }

        setConfirmOpen(false);
        setSelectedItem(null);
        if (data.newBalance !== undefined) setServerBalance(Number(data.newBalance));
        await loadData();

        addToast?.(
          'success',
          'Boost Activated',
          `Successfully purchased ${selectedItem.name}!`
        );
      } else if (selectedPurchaseType === 'premium') {
        const res = await apiFetch(`/api/servers/${currentGuildId}/premium/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ months: selectedMonths })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Premium purchase failed.');
        }

        setConfirmOpen(false);
        if (data.newBalance !== undefined) setServerBalance(Number(data.newBalance));
        await loadData();

        addToast?.(
          'success',
          'Premium Active',
          `Successfully upgraded ${serverName} to Premium for ${selectedMonths} month(s)!`
        );
      }
    } catch (err: any) {
      addToast?.('error', 'Purchase Failed', err.message || 'Could not complete purchase.');
    } finally {
      setPurchasing(false);
    }
  };

  const getItemDurationLabel = (item: ShopItem) => {
    const hours = Math.round(item.durationMs / (3600 * 1000));
    if (hours < 48) return `${hours} hours`;
    const days = Math.round(hours / 24);
    return `${days} days`;
  };

  const getItemEffectSummary = (effect: string) => {
    switch (effect) {
      case 'auto_bump':
        return 'Automated Bump';
      case 'featured_spot':
        return 'Top of Directory';
      case 'listing_highlight':
        return 'Accent Outline';
      case 'extra_advertiser':
        return '+1 Advertiser Slot';
      default:
        return 'Community Boost';
    }
  };

  const getItemIcon = (effect: string) => {
    switch (effect) {
      case 'auto_bump':
        return <Zap className="size-4 text-emerald-400" />;
      case 'featured_spot':
        return <Sparkles className="size-4 text-amber-400" />;
      case 'listing_highlight':
        return <Award className="size-4 text-sky-400" />;
      case 'extra_advertiser':
        return <Layers className="size-4 text-purple-400" />;
      default:
        return <ShoppingBag className="size-4 text-zinc-300" />;
    }
  };

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 pb-28 font-sans text-zinc-200">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="text-xs text-zinc-500 mb-1">Server / Shop</div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            Shop
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Power up {serverName} with boosts, elevated visibility, and premium perks using your server treasury.
          </p>
        </div>

        {onNavigateTab && (
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('earn')}
              className="h-9 px-4 rounded-lg text-xs border-white/[0.1] bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center gap-1.5"
            >
              <span>Earn credits</span>
              <Coins className="size-3.5 text-amber-400" />
            </Button>
          </div>
        )}
      </div>

      {/* Sticky Balance Strip at the Top: "Balance", Price, and "Balance after purchase" */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3.5 bg-[#09090B]/95 backdrop-blur border-b border-white/[0.08] mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 sm:gap-8">
            {/* Current Balance */}
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Balance
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Coins className="size-4 text-amber-400 shrink-0" />
                <span className="tabular-nums font-mono text-xl sm:text-2xl font-bold text-zinc-100">
                  {serverBalance.toLocaleString()}
                </span>
                <span className="text-xs text-zinc-500 font-sans">credits</span>
              </div>
            </div>

            {/* Price (if item or premium selected) */}
            {targetPrice !== null && (
              <>
                <div className="h-8 w-px bg-white/[0.08] hidden sm:block" />
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Cost
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="tabular-nums font-mono text-xl sm:text-2xl font-semibold text-zinc-200">
                      {targetPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500 font-sans">cr</span>
                  </div>
                </div>

                <div className="h-8 w-px bg-white/[0.08] hidden sm:block" />
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Balance after purchase
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`tabular-nums font-mono text-xl sm:text-2xl font-semibold ${
                        balanceAfter !== null && balanceAfter >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {balanceAfter !== null ? balanceAfter.toLocaleString() : '—'}
                    </span>
                    <span className="text-xs text-zinc-500 font-sans">cr</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tab Selector: Boosts, Premium, Active */}
          <div className="flex items-center p-1 rounded-lg bg-zinc-900 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('boosts');
                setSelectedItem(null);
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'boosts'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Boosts
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('premium');
                setSelectedItem(null);
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'premium'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Premium
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('active');
                setSelectedItem(null);
              }}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Active</span>
              {(activeBoosts.length > 0 || isPremium) && (
                <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: BOOSTS */}
      {activeTab === 'boosts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              <div className="col-span-full py-16 text-center text-xs text-zinc-500">
                Loading shop catalog…
              </div>
            ) : items.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-zinc-500">
                No boosts are currently available in the catalog.
              </div>
            ) : (
              items.map((item) => {
                const activeBoost = activeBoosts.find(b => b.effect === item.effect || b.itemId === item.id);
                const canAfford = serverBalance >= item.price;
                const isSelected = selectedItem?.id === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`rounded-lg p-5 bg-[#0E0E11] border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
                        : 'border-white/[0.08] hover:border-white/20'
                    } before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--accent)]/40 before:to-transparent`}
                  >
                    <div className="space-y-4">
                      {/* Top Row: Icon + Price */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="p-2.5 rounded-lg bg-zinc-900 border border-white/[0.08] shrink-0">
                          {getItemIcon(item.effect)}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1 font-mono tabular-nums text-lg font-bold text-zinc-100">
                            <span>{item.price}</span>
                            <span className="text-xs text-zinc-500 font-sans font-normal">cr</span>
                          </div>
                          {activeBoost && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
                          {item.name}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed line-clamp-3">
                          {item.description}
                        </p>
                      </div>

                      {/* Spec Row: Length | Effect | Cost */}
                      <div className="pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div className="p-1.5 rounded bg-zinc-900/60 border border-white/[0.04]">
                          <div className="text-zinc-500 text-[10px] uppercase">Length</div>
                          <div className="font-medium text-zinc-200 mt-0.5 truncate">{getItemDurationLabel(item)}</div>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-900/60 border border-white/[0.04]">
                          <div className="text-zinc-500 text-[10px] uppercase">Effect</div>
                          <div className="font-medium text-zinc-200 mt-0.5 truncate">{getItemEffectSummary(item.effect)}</div>
                        </div>
                        <div className="p-1.5 rounded bg-zinc-900/60 border border-white/[0.04]">
                          <div className="text-zinc-500 text-[10px] uppercase">Cost</div>
                          <div className="font-mono tabular-nums font-medium text-zinc-200 mt-0.5">{item.price} cr</div>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-4 mt-4 border-t border-white/[0.06]">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canManage || !canAfford}
                        title={disabledReason || (!canAfford ? 'Insufficient server credits' : undefined)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBuyBoost(item);
                        }}
                        className={`w-full h-9 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 ${
                          activeBoost
                            ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                            : 'bg-zinc-100 text-zinc-900 hover:bg-white'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {activeBoost ? (
                          <>
                            <Clock className="size-3.5" />
                            <span>Extend boost</span>
                          </>
                        ) : (
                          <>
                            <Zap className="size-3.5" />
                            <span>Activate boost</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: PREMIUM (Rebuilt pricing-slider-loops layout idea) */}
      {activeTab === 'premium' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Card: Duration Picker Slider */}
          <div className="lg:col-span-7 rounded-lg p-6 bg-[#0E0E11] border border-white/[0.08] relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--accent)]/40 before:to-transparent space-y-6">
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
                  Duration Picker
                </span>
                {DURATION_STEPS[selectedMonthsIndex].savePct > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Save {DURATION_STEPS[selectedMonthsIndex].savePct}%
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                Choose duration for {serverName}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Monthly rate starts at {premiumPricePerMonth} credits per 30-day period. Multi-month plans receive instant credit discounts.
              </p>
            </div>

            {/* Slider Controls */}
            <div className="space-y-3 pt-2">
              <input
                type="range"
                min="0"
                max={DURATION_STEPS.length - 1}
                step="1"
                value={selectedMonthsIndex}
                onChange={(e) => setSelectedMonthsIndex(Number(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
              />

              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                {DURATION_STEPS.map((step, idx) => (
                  <button
                    key={step.months}
                    type="button"
                    onClick={() => setSelectedMonthsIndex(idx)}
                    className={`p-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      selectedMonthsIndex === idx
                        ? 'bg-zinc-800 border-white/20 text-white font-medium'
                        : 'bg-zinc-900/50 border-white/[0.04] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div>{step.label}</div>
                    {step.savePct > 0 && (
                      <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                        -{step.savePct}%
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Spec Row: Length | Effect | Cost */}
            <div className="pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.05]">
                <div className="text-zinc-500 text-[10px] uppercase">Length</div>
                <div className="font-semibold text-zinc-100 mt-0.5">
                  {selectedMonths * 30} days
                </div>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.05]">
                <div className="text-zinc-500 text-[10px] uppercase">Effect</div>
                <div className="font-semibold text-zinc-100 mt-0.5">
                  Premium Tier
                </div>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/[0.05]">
                <div className="text-zinc-500 text-[10px] uppercase">Total Cost</div>
                <div className="font-mono tabular-nums font-semibold text-zinc-100 mt-0.5">
                  {finalPremiumPrice} cr
                </div>
              </div>
            </div>

            {/* Existing Premium Status Info if Active */}
            {isPremium && (
              <div className="p-3.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>
                    Premium is active ({premiumDaysLeft} day{premiumDaysLeft === 1 ? '' : 's'} remaining)
                  </span>
                </div>
                <span className="text-zinc-400 text-[11px]">
                  Purchasing extends existing duration
                </span>
              </div>
            )}
          </div>

          {/* Right Card: Plan Summary & Perks */}
          <div className="lg:col-span-5 rounded-lg p-6 bg-[#0E0E11] border border-white/[0.08] relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--accent)]/40 before:to-transparent space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Crown className="size-5 text-[var(--accent)]" />
                <h3 className="text-lg font-bold text-white">ConnectingERLC Premium</h3>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Included perks for your roleplay community:
              </p>
            </div>

            {/* Real Perks Only: GIF banner, advertisers & premium advertising posts, higher join credits, premium badge */}
            <ul className="space-y-3 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Animated GIF banner:</strong> Upload animated GIF banners to your public server page and directory listing.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Advertisers & Premium Posts:</strong> Add up to 5 advertiser seats to broadcast announcements to the Premium Ads Discord channel every 6 hours.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Higher join credits:</strong> Members earn 5 credits per verified join instead of standard 2 credits, accelerating growth.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Premium Badge:</strong> Sleek theme-accented badge displayed across directory cards and the server page.
                </span>
              </li>
            </ul>

            {/* Pricing Summary */}
            <div className="pt-4 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Duration</span>
                <span className="font-medium text-zinc-200">{selectedMonths} month(s)</span>
              </div>
              {premiumDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono tabular-nums">-{premiumDiscount} cr</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                <span className="text-sm font-semibold text-zinc-100">Total Price</span>
                <div className="flex items-center gap-1.5 font-mono tabular-nums text-2xl font-bold text-white">
                  <span>{finalPremiumPrice}</span>
                  <span className="text-xs font-sans text-zinc-500 font-normal">cr</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Button
              type="button"
              disabled={!canManage || serverBalance < finalPremiumPrice}
              title={disabledReason || (serverBalance < finalPremiumPrice ? 'Insufficient server credits' : undefined)}
              onClick={handleOpenBuyPremium}
              className="w-full h-10 rounded-lg text-xs font-medium bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Crown className="size-4" />
              <span>{isPremium ? 'Extend Premium' : 'Upgrade to Premium'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: ACTIVE */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-3">
            Active Enhancements on {serverName}
          </div>

          {activeBoosts.length === 0 && !isPremium ? (
            <div className="p-12 rounded-lg border border-white/[0.08] bg-[#0E0E11] text-center space-y-3">
              <ShoppingBag className="size-8 text-zinc-600 mx-auto" />
              <div className="text-sm font-medium text-zinc-300">No active boosts or subscriptions</div>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Your server currently has no active power-ups. Explore available boosts or upgrade to Premium to boost your discovery.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActiveTab('boosts')}
                className="h-8 px-4 rounded-lg text-xs border-white/[0.1] bg-zinc-900 text-zinc-200 mt-2"
              >
                Browse catalog
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Premium Card if active */}
              {isPremium && (
                <div className="rounded-lg p-5 bg-[#0E0E11] border border-[var(--accent)]/40 relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--accent)] flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
                        <Crown className="size-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-white">ConnectingERLC Premium</h4>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        GIF banner, 5 advertisers, 5 join credits, and premium badge across the platform.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.05] text-xs flex items-center justify-between">
                      <span className="text-zinc-400">Remaining</span>
                      <span className="font-medium text-zinc-200 flex items-center gap-1.5">
                        <Clock className="size-3.5 text-emerald-400" />
                        <span>{premiumDaysLeft} day(s)</span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/[0.06]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('premium')}
                      className="w-full h-8 rounded-lg text-xs border-white/[0.08] bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    >
                      Extend duration
                    </Button>
                  </div>
                </div>
              )}

              {/* Active Boost Cards */}
              {activeBoosts.map((boost) => (
                <div
                  key={boost.id || boost.effect}
                  className="rounded-lg p-5 bg-[#0E0E11] border border-white/[0.08] relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--accent)]/40 before:to-transparent flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-zinc-900 border border-white/[0.08]">
                        {getItemIcon(boost.effect)}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-white">{boost.name}</h4>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {getItemEffectSummary(boost.effect)}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.05] text-xs flex items-center justify-between">
                      <span className="text-zinc-400">Time left</span>
                      <span className="font-medium text-zinc-200 flex items-center gap-1.5">
                        <Clock className="size-3.5 text-emerald-400" />
                        <span>{boost.formattedTimeLeft || boost.timeRemainingLabel || 'Active'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/[0.06]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const target = items.find(i => i.effect === boost.effect || i.id === boost.itemId);
                        if (target) {
                          setSelectedItem(target);
                          setActiveTab('boosts');
                        }
                      }}
                      className="w-full h-8 rounded-lg text-xs border-white/[0.08] bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                    >
                      Extend boost
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog Before Spending Credits */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-[#0E0E11] border-white/[0.08] text-zinc-200 rounded-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
              <ShoppingBag className="size-4 text-[var(--accent)]" />
              <span>Confirm Purchase</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 mt-1">
              Review details before deducting credits from {serverName}'s treasury.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-white/[0.06] space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Item</span>
                <span className="font-semibold text-zinc-100">
                  {selectedPurchaseType === 'boost' ? selectedItem?.name : `Premium (${selectedMonths} months)`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Length</span>
                <span className="font-medium text-zinc-200">
                  {selectedPurchaseType === 'boost'
                    ? (selectedItem ? getItemDurationLabel(selectedItem) : '—')
                    : `${selectedMonths * 30} days`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Cost</span>
                <span className="font-mono font-semibold text-amber-400">
                  {targetPrice} cr
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/40 border border-white/[0.04] space-y-1.5 text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>Current Balance</span>
                <span className="font-mono tabular-nums">{serverBalance.toLocaleString()} cr</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Deduction</span>
                <span className="font-mono tabular-nums text-red-400">-{targetPrice} cr</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-white/[0.06] font-medium text-zinc-200">
                <span>New Balance</span>
                <span className="font-mono tabular-nums text-emerald-400">
                  {balanceAfter !== null ? balanceAfter.toLocaleString() : '—'} cr
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={purchasing}
              onClick={() => setConfirmOpen(false)}
              className="h-9 px-4 rounded-lg text-xs border-white/[0.08] bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={purchasing || (balanceAfter !== null && balanceAfter < 0)}
              onClick={handleConfirmPurchase}
              className="h-9 px-5 rounded-lg text-xs bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 font-medium cursor-pointer"
            >
              {purchasing ? 'Processing…' : 'Confirm purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ShopTab;
