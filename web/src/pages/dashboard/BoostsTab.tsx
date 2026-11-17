import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Coins,
  Check,
  ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { PremiumTab } from './PremiumTab';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

export const BOOSTS_CATEGORY_TITLE = 'Shop';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number | null;
  durationMs: number;
  durationLabel: string;
  effect: 'auto_bump' | 'featured_spot' | 'listing_highlight' | 'extra_advertiser' | string;
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
  const [activeSubTab, setActiveSubTab] = useState<'shop' | 'active'>(
    initialSubTab === 'active' ? 'active' : 'shop'
  );
  const serverName = guild?.name || propServerName || 'Community Server';

  const [items, setItems] = useState<ShopItem[]>([]);
  const [activeBoosts, setActiveBoosts] = useState<ActiveBoost[]>([]);
  const [serverBalance, setServerBalance] = useState<number>(0);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [loadingShop, setLoadingShop] = useState<boolean>(true);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);

  const fetchShopData = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      setLoadingShop(true);
      const res = await apiFetch(`/workspace/${currentGuildId}/shop`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        setActiveBoosts(Array.isArray(data.activeBoosts) ? data.activeBoosts : []);
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

  useEffect(() => {
    fetchShopData();
  }, [fetchShopData]);

  if (initialSubTab === 'premium') {
    return (
      <PremiumTab
        guild={guild || null}
        workspace={workspace || null}
        config={(config || {}) as WorkspaceCustomizations}
        onNavigateTab={onNavigateTab || (() => {})}
        addToast={(v, t, b) => addToast?.(v, t, b || '')}
      />
    );
  }

  const handleOpenBuy = (item: ShopItem) => {
    const price = item.price !== null && item.price !== undefined ? Number(item.price) : null;
    if (price === null || price <= 0) {
      addToast?.('warning', 'Price not set', 'This item does not have a price configured yet.');
      return;
    }
    if (serverBalance < price) {
      addToast?.('error', 'Insufficient Balance', `Server balance is ${serverBalance} credits. This boost costs ${price} credits.`);
      return;
    }
    setSelectedItem(item);
    setConfirmModalOpen(true);
  };

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

      addToast?.('success', 'Boost Activated', `Activated ${selectedItem.name}. Balance: ${data.newBalance} credits.`);
      setActiveSubTab('active');
    } catch (err: any) {
      addToast?.('error', 'Purchase Failed', err.message || 'Could not complete purchase.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6 pb-12 font-sans text-zinc-200">
      {/* Breadcrumb & Plain Header */}
      <div className="space-y-1 pb-5 border-b border-white/[0.08]">
        <div className="text-xs text-zinc-500">Shop / Boosts</div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Boosts
        </h1>
        <p className="text-sm text-zinc-400">
          Spend {serverName}'s server credits on automated bumps, featured directory placement, listing highlights, and extra advertiser seats.
        </p>
      </div>

      {/* Navigation: Pill Tabs + Server Balance */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-[#18181B] border border-white/[0.08] rounded-full">
          <button
            type="button"
            onClick={() => setActiveSubTab('shop')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              activeSubTab === 'shop'
                ? 'bg-white text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Shop
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('active')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'active'
                ? 'bg-white text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Active</span>
            {activeBoosts.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeSubTab === 'active' ? 'bg-zinc-900 text-white' : 'bg-white/10 text-zinc-300'
                }`}
              >
                {activeBoosts.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-300 bg-[#18181B] border border-white/[0.08] px-3.5 py-1.5 rounded-full">
          <Coins className="size-3.5 text-[var(--accent)]" />
          <span>Server balance:</span>
          <span className="font-semibold text-zinc-100 tabular-nums">{serverBalance} credits</span>
        </div>
      </div>

      {/* TAB 1: SHOP */}
      {activeSubTab === 'shop' && (
        <div className="space-y-6 pt-1">
          {loadingShop ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              Loading boost items…
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 border border-white/10 rounded-2xl bg-[#121215]">
              <ShoppingBag className="size-6 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-200">No boost items available</h3>
              <p className="text-xs text-zinc-500 max-w-sm">Items and prices are configured in the admin settings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => {
                const hasPrice = item.price !== null && item.price !== undefined && Number(item.price) > 0;
                const priceNum = hasPrice ? Number(item.price) : 0;
                const canAfford = hasPrice && serverBalance >= priceNum;
                const canManage = isOwner || isManager;
                const disabled = !hasPrice || !canAfford || !canManage;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between p-5 bg-[#121215] border border-white/[0.08] rounded-2xl hover:border-white/[0.15] transition-colors space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100">{item.name}</h3>
                          <span className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Clock className="size-3" />
                            <span>{item.durationLabel}</span>
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          {hasPrice ? (
                            <>
                              <span className="text-base font-semibold text-zinc-100 tabular-nums">{priceNum}</span>
                              <span className="text-xs text-zinc-400 ml-1">credits</span>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-amber-400">Price not set</span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
                      <div className="text-xs">
                        {!hasPrice ? (
                          <span className="text-amber-400">Price not set</span>
                        ) : !canManage ? (
                          <span className="text-zinc-500">Owners & managers only</span>
                        ) : !canAfford ? (
                          <span className="text-amber-400">
                            Need {priceNum - serverBalance} more credits (Balance: {serverBalance})
                          </span>
                        ) : (
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Check className="size-3.5 text-[var(--accent)]" />
                            <span>Balance: {serverBalance} credits</span>
                          </span>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={disabled}
                        onClick={() => handleOpenBuy(item)}
                        className="h-8 px-4 rounded-full text-xs font-semibold bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-40 cursor-pointer"
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
        <div className="space-y-6 pt-1">
          {activeBoosts.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-2 border border-white/[0.08] rounded-2xl bg-[#121215]">
              <Clock className="size-6 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-200">No active boosts</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Purchase a boost in the Shop tab to activate auto-bump, featured placement, listing highlight, or extra advertiser seats.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActiveSubTab('shop')}
                className="mt-2 h-8 px-4 text-xs rounded-full border-white/10 text-zinc-200 hover:bg-white/[0.05]"
              >
                Browse Boosts
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeBoosts.map((boost) => (
                <div
                  key={boost.id}
                  className="p-5 bg-[#121215] border border-white/[0.08] rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">{boost.name}</h3>
                      <span className="text-xs text-[var(--accent)] font-medium">
                        Active
                      </span>
                    </div>
                    <span className="text-xs font-medium text-zinc-200 tabular-nums">
                      {boost.timeRemainingLabel} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmModalOpen && selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm bg-[#121215] border border-white/[0.12] rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-100">Confirm Boost Purchase</h3>
              <p className="text-xs text-zinc-400">
                Activate {selectedItem.name} for {serverName}.
              </p>
            </div>

            <div className="p-4 bg-zinc-900/80 border border-white/[0.06] rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Boost</span>
                <span className="font-medium text-zinc-200">{selectedItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Length</span>
                <span className="font-medium text-zinc-200">{selectedItem.durationLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Price</span>
                <span className="font-semibold text-zinc-100 tabular-nums">{selectedItem.price} credits</span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex justify-between">
                <span className="text-zinc-400">Balance after</span>
                <span className="font-semibold text-zinc-100 tabular-nums">
                  {serverBalance - Number(selectedItem.price || 0)} credits
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmModalOpen(false)}
                disabled={purchasing}
                className="text-xs text-zinc-400 hover:text-zinc-200 rounded-full h-9 px-3.5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={purchasing}
                onClick={handleConfirmPurchase}
                className="text-xs bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold rounded-full px-4 h-9 hover:opacity-90"
              >
                {purchasing ? 'Activating…' : 'Confirm & Buy'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BoostsTab;
