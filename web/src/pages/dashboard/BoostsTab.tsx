import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Zap,
  Crown,
  Bot,
  Clock,
  Coins,
  Check,
  AlertCircle,
  HelpCircle,
  Shield,
  ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch, api } from '@/lib/api';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

export const BOOSTS_CATEGORY_TITLE = 'Boosts';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMs: number;
  durationLabel: string;
  effect: 'double_bumps' | 'premium' | 'auto_bump' | string;
  enabled: boolean;
}

interface ActiveBoost {
  id: string;
  itemId: string;
  name: string;
  effect: string;
  activatedAt: number;
  expiresAt: number;
  timeRemainingMs: number;
  timeRemainingLabel: string;
}

interface CommunityIdea {
  id: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string | null;
  authorDiscordId: string;
  suggestionText: string;
  upvotes: number;
  hasUpvoted: boolean;
  createdAt: string;
}

interface BoostsTabProps {
  currentGuildId: string;
  guild?: DiscordGuild | null;
  workspace?: WorkspaceBot | null;
  config?: WorkspaceCustomizations;
  serverName?: string;
  initialSubTab?: 'shop' | 'active' | 'premium';
  onNavigateTab?: (tab: string) => void;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body?: string) => void;
}

export function BoostsTab({
  currentGuildId,
  guild,
  workspace,
  config,
  serverName: propServerName,
  initialSubTab = 'shop',
  onNavigateTab,
  addToast
}: BoostsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'shop' | 'active' | 'premium'>(initialSubTab);
  const serverName = guild?.name || propServerName || 'Community Server';

  // Shop state
  const [items, setItems] = useState<ShopItem[]>([]);
  const [activeBoosts, setActiveBoosts] = useState<ActiveBoost[]>([]);
  const [serverBalance, setServerBalance] = useState<number>(0);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [loadingShop, setLoadingShop] = useState<boolean>(true);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);

  // Premium Ideas state
  const [communityIdeas, setCommunityIdeas] = useState<CommunityIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState<boolean>(false);
  const [upvotingIds, setUpvotingIds] = useState<Record<string, boolean>>({});
  const [suggestionText, setSuggestionText] = useState<string>('');
  const [contactOk, setContactOk] = useState<boolean>(true);
  const [submittingIdea, setSubmittingIdea] = useState<boolean>(false);
  const [ideaSubmitted, setIdeaSubmitted] = useState<boolean>(false);

  // Load Shop & Boosts data
  const fetchShopData = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      setLoadingShop(true);
      const res = await apiFetch(`/workspace/${currentGuildId}/shop`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setActiveBoosts(data.activeBoosts || []);
        setServerBalance(Number(data.serverBalance || 0));
        setIsOwner(Boolean(data.isOwner));
        setIsManager(Boolean(data.isManager));
      }
    } catch (err) {
      console.warn('[BOOSTS] Failed to load shop data:', err);
    } finally {
      setLoadingShop(false);
    }
  }, [currentGuildId]);

  // Load Premium Community Ideas
  const loadCommunityIdeas = useCallback(async () => {
    setLoadingIdeas(true);
    try {
      const data = await api<{ ok: boolean; suggestions: CommunityIdea[] }>('/suggestions/premium');
      if (Array.isArray(data?.suggestions)) {
        setCommunityIdeas(data.suggestions);
      }
    } catch {
      // Clean fallback
    } finally {
      setLoadingIdeas(false);
    }
  }, []);

  useEffect(() => {
    fetchShopData();
  }, [fetchShopData]);

  useEffect(() => {
    if (activeSubTab === 'premium') {
      loadCommunityIdeas();
    }
  }, [activeSubTab, loadCommunityIdeas]);

  // Handle Buy Click
  const handleOpenBuy = (item: ShopItem) => {
    if (serverBalance < item.price) {
      addToast?.('error', 'Insufficient Balance', `Server balance is ${serverBalance} credits. This boost costs ${item.price} credits.`);
      return;
    }
    setSelectedItem(item);
    setConfirmModalOpen(true);
  };

  // Safe Purchase Execution with Double-click Lock
  const handleConfirmPurchase = async () => {
    if (!selectedItem || !currentGuildId || purchasing) return;
    setPurchasing(true);
    try {
      const res = await apiFetch(`/workspace/${currentGuildId}/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: selectedItem.id })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Purchase failed.');
      }

      setConfirmModalOpen(false);
      setSelectedItem(null);
      setServerBalance(Number(data.newBalance || 0));
      await fetchShopData();

      addToast?.('success', 'Boost Activated', `Successfully activated ${selectedItem.name}! Balance: ${data.newBalance} credits.`);
      setActiveSubTab('active');
    } catch (err: any) {
      addToast?.('error', 'Purchase Failed', err.message || 'Could not complete purchase.');
    } finally {
      setPurchasing(false);
    }
  };

  // Handle Idea Submission
  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim() || submittingIdea) return;
    setSubmittingIdea(true);
    try {
      await api<any>('/suggestions/premium', {
        method: 'POST',
        body: JSON.stringify({
          suggestion: suggestionText.trim(),
          contactOk,
          guildId: currentGuildId,
          guildName: serverName,
        }),
      });
      setIdeaSubmitted(true);
      setSuggestionText('');
      addToast?.('success', 'Idea Submitted', 'Your suggestion has been delivered to the team. Thank you!');
      loadCommunityIdeas();
    } catch (err: any) {
      addToast?.('error', 'Submission Failed', err.message || 'Could not submit suggestion.');
    } finally {
      setSubmittingIdea(false);
    }
  };

  // Handle Idea Upvote
  const handleToggleUpvote = async (ideaId: string) => {
    if (upvotingIds[ideaId]) return;
    setUpvotingIds(prev => ({ ...prev, [ideaId]: true }));
    setCommunityIdeas(prev =>
      prev.map(item => {
        if (item.id === ideaId) {
          const nextHasUpvoted = !item.hasUpvoted;
          const nextCount = nextHasUpvoted ? item.upvotes + 1 : Math.max(0, item.upvotes - 1);
          return { ...item, hasUpvoted: nextHasUpvoted, upvotes: nextCount };
        }
        return item;
      })
    );

    try {
      await api<any>(`/suggestions/premium/${ideaId}/upvote`, { method: 'POST' });
    } catch {
      loadCommunityIdeas();
    } finally {
      setUpvotingIds(prev => ({ ...prev, [ideaId]: false }));
    }
  };

  const getItemIcon = (effect: string) => {
    switch (effect) {
      case 'double_bumps':
        return <Zap className="size-4 text-amber-400" />;
      case 'premium':
        return <Crown className="size-4 text-purple-400" />;
      case 'auto_bump':
        return <Bot className="size-4 text-emerald-400" />;
      default:
        return <Sparkles className="size-4 text-blue-400" />;
    }
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6 pb-12 font-sans">
      {/* Header following Greed inspiration: big plain page title + one muted line */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Boosts
        </h1>
        <p className="text-sm text-zinc-400">
          Power-up {serverName} with bump multipliers, automation, and premium perks using your server treasury.
        </p>
      </div>

      {/* Thin divider */}
      <div className="border-b border-white/[0.08]" />

      {/* Navigation: Tabs in one rounded pill group */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-[#18181B] border border-white/[0.08] rounded-full">
          <button
            type="button"
            onClick={() => setActiveSubTab('shop')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeSubTab === 'shop'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Shop
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('active')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'active'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Active</span>
            {activeBoosts.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeSubTab === 'active' ? 'bg-zinc-900 text-white' : 'bg-white/10 text-zinc-300'
              }`}>
                {activeBoosts.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('premium')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeSubTab === 'premium'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Premium
          </button>
        </div>

        {/* Server Balance Indicator */}
        <div className="flex items-center gap-2 text-xs text-zinc-300 bg-[#18181B] border border-white/[0.08] px-3.5 py-1.5 rounded-full">
          <Coins className="size-3.5 text-amber-400" />
          <span>Server Balance:</span>
          <span className="font-semibold text-zinc-100">{serverBalance} credits</span>
        </div>
      </div>

      {/* TAB 1: SHOP */}
      {activeSubTab === 'shop' && (
        <div className="space-y-6 pt-2">
          {loadingShop ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-zinc-400">
              <div className="size-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <span>Loading shop items...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-white/10 rounded-2xl">
              <ShoppingBag className="size-8 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-200">No shop items available</h3>
              <p className="text-xs text-zinc-500 max-w-sm">Items and prices are configured in the admin portal.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const canAfford = serverBalance >= item.price;
                const canManage = isOwner || isManager;
                const disabled = !canAfford || !canManage;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between p-5 bg-[#121214] border border-white/[0.08] rounded-2xl hover:border-white/[0.16] transition-all space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                            {getItemIcon(item.effect)}
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-100">{item.name}</h3>
                            <span className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                              <Clock className="size-3" />
                              {item.durationLabel}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold text-zinc-100">{item.price}</span>
                          <span className="text-[11px] text-zinc-400 ml-1">cr</span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px]">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-3">
                      <div className="text-[11px]">
                        {!canManage ? (
                          <span className="text-zinc-500">Owners & managers only</span>
                        ) : !canAfford ? (
                          <span className="text-amber-400/90">Need {item.price - serverBalance} more cr</span>
                        ) : (
                          <span className="text-emerald-400/90 flex items-center gap-1">
                            <Check className="size-3" /> Ready to buy
                          </span>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={disabled}
                        onClick={() => handleOpenBuy(item)}
                        className={`text-xs px-4 py-1.5 h-8 rounded-full font-medium transition-all ${
                          disabled
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border-transparent'
                            : 'bg-white hover:bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                        }`}
                      >
                        Buy
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE BOOSTS */}
      {activeSubTab === 'active' && (
        <div className="space-y-6 pt-2">
          {activeBoosts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-white/10 rounded-2xl">
              <Sparkles className="size-8 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-200">No active boosts</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Purchase boosts in the shop to accelerate your community growth and halve cooldowns.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActiveSubTab('shop')}
                className="mt-3 text-xs rounded-full border-white/10 hover:border-white/20 text-zinc-300"
              >
                Go to Shop
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeBoosts.map((boost) => (
                <div
                  key={boost.id}
                  className="p-5 bg-[#121214] border border-white/[0.08] rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                        {getItemIcon(boost.effect)}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">{boost.name}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">
                          Active Now
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-zinc-400" />
                      Time left:
                    </span>
                    <span className="font-semibold text-zinc-200">
                      {boost.timeRemainingLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PREMIUM PERKS & COMMUNITY IDEAS */}
      {activeSubTab === 'premium' && (
        <div className="space-y-8 pt-2">
          {/* Overview Perks */}
          <div className="p-6 bg-[#121214] border border-white/[0.08] rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Crown className="size-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">ConnectingERLC Premium</h3>
                <p className="text-xs text-zinc-400">
                  Priority directory placement, elevated advertising channels, animated banners, and creator tools.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-white/[0.06]">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-400" /> Priority Discovery
                </span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Featured placement in public directory searches and partner rotations.
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-400" /> Animated Banners
                </span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Upload GIF banners directly to your server profile for eye-catching promotion.
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-400" /> Broadcast Channels
                </span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Send high-visibility server partnership and recruitment broadcasts.
                </p>
              </div>
            </div>
          </div>

          {/* Suggest a feature / Idea Box */}
          <div className="p-6 bg-[#121214] border border-white/[0.08] rounded-2xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Suggest a Premium Feature</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Have an idea for a perk or tool that would help your community? Tell us directly.
              </p>
            </div>

            <form onSubmit={handleSubmitIdea} className="space-y-3">
              <textarea
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                placeholder="What feature would make your server thrive? (e.g. custom vanity invites, staff shifts, webhook sync)"
                rows={3}
                className="w-full text-xs p-3 rounded-xl bg-black/40 border border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white/20"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactOk}
                    onChange={(e) => setContactOk(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-[var(--accent)]"
                  />
                  <span>Notify me on Discord when this feature ships</span>
                </label>

                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingIdea || !suggestionText.trim()}
                  className="text-xs rounded-full px-4 h-8 bg-white hover:bg-zinc-100 text-zinc-950 font-semibold"
                >
                  {submittingIdea ? 'Submitting...' : 'Send Suggestion'}
                </Button>
              </div>
            </form>
          </div>

          {/* Community Ideas Board */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">Community Ideas & Upvotes</h3>
            {loadingIdeas ? (
              <div className="py-6 text-center text-xs text-zinc-500">Loading community ideas...</div>
            ) : communityIdeas.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-white/10 rounded-xl">
                No suggestions posted yet. Be the first to submit an idea above!
              </div>
            ) : (
              <div className="space-y-2">
                {communityIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className="p-4 bg-[#121214] border border-white/[0.06] rounded-xl flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-zinc-200 font-medium">{idea.suggestionText}</p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                        <span>@{idea.authorUsername}</span>
                        <span>•</span>
                        <span>{new Date(idea.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleUpvote(idea.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        idea.hasUpvoted
                          ? 'bg-white text-zinc-950 border-white'
                          : 'bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:border-white/20'
                      }`}
                    >
                      <Sparkles className="size-3" />
                      <span>{idea.upvotes}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#121214] border border-white/[0.12] rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-100">Confirm Boost Purchase</h3>
              <p className="text-xs text-zinc-400">
                You are about to activate a boost for {serverName}.
              </p>
            </div>

            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Item:</span>
                <span className="font-medium text-zinc-200">{selectedItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Duration:</span>
                <span className="font-medium text-zinc-200">{selectedItem.durationLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Cost:</span>
                <span className="font-semibold text-amber-400">{selectedItem.price} credits</span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex justify-between">
                <span className="text-zinc-400">Balance after:</span>
                <span className="font-semibold text-zinc-100">{serverBalance - selectedItem.price} credits</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmModalOpen(false)}
                disabled={purchasing}
                className="text-xs text-zinc-400 hover:text-zinc-200 rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={purchasing}
                onClick={handleConfirmPurchase}
                className="text-xs bg-white hover:bg-zinc-100 text-zinc-950 font-semibold rounded-full px-4 h-8"
              >
                {purchasing ? 'Activating...' : 'Confirm & Activate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
