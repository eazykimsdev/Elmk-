import React, { useState, useEffect } from 'react';
import { ShoppingBag, Zap, Crown, Bot, Sparkles, Clock, AlertCircle, CheckCircle2, ChevronRight, Coins } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';

interface ShopItem {
  id: string;
  name: string;
  effect: string;
  durationMs: number;
  price: number;
  isActive: boolean;
  description: string;
}

interface ActiveBoost {
  effect: string;
  name: string;
  activeUntil: number;
  remainingSeconds: number;
  formattedTimeLeft: string;
}

interface ShopTabProps {
  currentGuildId: string;
  serverName?: string;
  onNavigateTab?: (tab: string) => void;
  addToast?: (toast: any) => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({
  currentGuildId,
  serverName = 'Community Server',
  onNavigateTab,
  addToast
}) => {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [activeBoosts, setActiveBoosts] = useState<ActiveBoost[]>([]);
  const [serverBalance, setServerBalance] = useState<number>(0);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isManager, setIsManager] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [successData, setSuccessData] = useState<any>(null);

  const fetchShopData = async () => {
    if (!currentGuildId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/workspace/${currentGuildId}/shop`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setActiveBoosts(data.activeBoosts || []);
        setServerBalance(Number(data.serverBalance || 0));
        setIsOwner(Boolean(data.isOwner));
        setIsManager(Boolean(data.isManager));
      }
    } catch (err) {
      console.warn('Failed to load shop:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData();
  }, [currentGuildId]);

  const handleOpenBuy = (item: ShopItem) => {
    setSelectedItem(item);
    setConfirmModalOpen(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedItem || !currentGuildId) return;
    setPurchasing(true);
    try {
      const res = await fetch(`/api/workspace/${currentGuildId}/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: selectedItem.id })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Purchase failed.');
      }

      setConfirmModalOpen(false);
      setSuccessData(data);
      setServerBalance(data.newBalance);
      fetchShopData();

      if (addToast) {
        addToast({
          title: 'Boost Activated',
          description: `Successfully activated ${selectedItem.name}!`,
          type: 'success'
        });
      }
    } catch (err: any) {
      if (addToast) {
        addToast({
          title: 'Purchase Failed',
          description: err.message || 'Could not complete purchase.',
          type: 'error'
        });
      } else {
        alert(err.message || 'Purchase failed.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const getItemIcon = (effect: string) => {
    switch (effect) {
      case 'double_bumps':
        return <Zap className="size-5 text-amber-400" />;
      case 'premium':
        return <Crown className="size-5 text-purple-400" />;
      case 'auto_bump':
        return <Bot className="size-5 text-emerald-400" />;
      default:
        return <Sparkles className="size-5 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header with Treasury balance */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <ShoppingBag className="size-5 text-zinc-400" />
            Server Shop
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Enhance {serverName} with power-up boosts and elevated visibility using your server treasury balance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center gap-2">
            <Coins className="size-4 text-amber-400" />
            <div className="text-right">
              <div className="text-xs font-semibold text-zinc-200">
                {serverBalance.toLocaleString()} <span className="text-[10px] text-zinc-400 font-normal">credits</span>
              </div>
            </div>
          </div>
          {onNavigateTab && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('earn')}
              className="text-xs border-white/[0.08] hover:bg-white/[0.04]"
            >
              Earn credits
            </Button>
          )}
        </div>
      </div>

      {/* Active Boosts Section */}
      {activeBoosts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Active Boosts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeBoosts.map((boost) => (
              <div
                key={boost.effect}
                className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/[0.08] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/[0.04]">
                    {getItemIcon(boost.effect)}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-zinc-200">{boost.name}</div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Clock className="size-3 text-emerald-400" />
                      {boost.formattedTimeLeft}
                    </div>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Available Boosts</h2>
        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500">Loading shop items...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">No shop items are currently available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {items.map((item) => {
              const activeBoost = activeBoosts.find((b) => b.effect === item.effect);
              const canAfford = serverBalance >= item.price;

              return (
                <div
                  key={item.id}
                  className="rounded-xl p-5 bg-zinc-900/40 border border-white/[0.08] flex flex-col justify-between hover:border-white/[0.14] transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        {getItemIcon(item.effect)}
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08]">
                        <Coins className="size-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-zinc-200">{item.price}</span>
                        <span className="text-[10px] text-zinc-400">cr</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-zinc-200">{item.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{item.description}</p>
                    </div>

                    {activeBoost && (
                      <div className="p-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center justify-between">
                        <span>Currently active</span>
                        <span className="font-medium">{activeBoost.formattedTimeLeft}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-5 mt-4 border-t border-white/[0.06]">
                    <Button
                      onClick={() => handleOpenBuy(item)}
                      disabled={!isManager && !isOwner}
                      className="w-full text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 cursor-pointer disabled:opacity-50"
                    >
                      {activeBoost ? 'Extend Boost' : 'Purchase Boost'}
                    </Button>
                    {!isManager && !isOwner && (
                      <p className="text-[10px] text-zinc-500 text-center mt-1.5">
                        Only owners and managers can buy boosts.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/[0.1]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-100">
              Confirm Purchase
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Review your boost order details before confirming.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 py-2">
              <div className="p-3.5 rounded-lg bg-zinc-900 border border-white/[0.08] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Boost Item:</span>
                  <span className="font-medium text-zinc-200">{selectedItem.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Cost:</span>
                  <span className="font-semibold text-amber-400">{selectedItem.price} credits</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Current Treasury:</span>
                  <span className="text-zinc-300">{serverBalance} credits</span>
                </div>
                <div className="pt-2 border-t border-white/[0.06] flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Balance After:</span>
                  <span className={serverBalance >= selectedItem.price ? 'text-zinc-200 font-medium' : 'text-red-400 font-medium'}>
                    {serverBalance - selectedItem.price} credits
                  </span>
                </div>
              </div>

              {serverBalance < selectedItem.price && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>
                    Your server treasury does not have enough credits. Earn or top up credits before activating this boost.
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmModalOpen(false)}
              className="text-xs border-white/[0.08]"
              disabled={purchasing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPurchase}
              disabled={purchasing || (selectedItem ? serverBalance < selectedItem.price : false)}
              className="text-xs bg-zinc-100 hover:bg-white text-zinc-950 font-medium"
            >
              {purchasing ? 'Processing...' : 'Confirm & Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={Boolean(successData)} onOpenChange={() => setSuccessData(null)}>
        <DialogContent className="max-w-sm bg-zinc-950 border-white/[0.1] text-center">
          <div className="mx-auto p-3 rounded-full bg-emerald-500/10 text-emerald-400 w-fit mb-2">
            <CheckCircle2 className="size-6" />
          </div>
          <DialogTitle className="text-base font-semibold text-zinc-100">
            Boost Activated!
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 mt-1">
            {successData?.item?.name} has been activated for {serverName}.
          </DialogDescription>

          <div className="p-3 my-3 rounded-lg bg-zinc-900 border border-white/[0.08] text-xs space-y-1.5 text-left">
            <div className="flex justify-between">
              <span className="text-zinc-400">Duration:</span>
              <span className="text-zinc-200 font-medium">{successData?.formattedTimeLeft}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">New Treasury Balance:</span>
              <span className="text-zinc-200 font-medium">{successData?.newBalance} credits</span>
            </div>
          </div>

          <Button
            onClick={() => setSuccessData(null)}
            className="w-full text-xs bg-zinc-100 hover:bg-white text-zinc-950 font-medium mt-2"
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default ShopTab;
