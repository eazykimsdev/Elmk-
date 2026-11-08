import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Handshake,
  Users,
  Send,
  Check,
  X,
  Clock,
  ExternalLink,
  ShieldCheck,
  Settings,
  Search,
  Trophy,
  Award,
  AlertTriangle,
  Pause,
  Play,
  Trash2,
  Lock,
  Unlock,
  Radio,
  Eye,
  EyeOff,
  Coins,
  ChevronRight,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { DirectoryCard } from '@/components/ui/directory-card';
import { openServerProfile } from '@/components/ServerProfileModal';
import { cn } from '@/lib/utils';
import { stripMarkdown } from '@/components/ui/markdown-renderer';
import { TabErrorBoundary } from '@/components/TabErrorBoundary';

interface PartnershipsTabProps {
  currentGuildId: string;
  serverName?: string;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const CATEGORIES = [
  'All',
  'Design server',
  'Roleplay server',
  'Misc',
  'COTS',
  'Departments',
  'Events',
] as const;

interface ActivePartner {
  id: string;
  partnerGuildId: string;
  partnerGuildName: string;
  partnerGuildIcon?: string | null;
  partnerCategory?: string;
  partnerMemberCount?: number;
  partnerBannerUrl?: string;
  partnerInviteUrl?: string;
  status: 'active' | 'paused';
  since: string;
  lastBroadcast?: string;
  totalAdsSent?: number;
}

interface PartnershipRequestItem {
  id: string;
  fromGuildId: string;
  fromGuildName?: string;
  fromGuildIcon?: string | null;
  toGuildId: string;
  toGuildName?: string;
  toGuildIcon?: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: number;
  coinsPaid?: number;
  includeMention?: boolean;
  mentionType?: string;
  adText?: string;
  senderName?: string;
  senderIcon?: string | null;
  senderMemberCount?: number;
  senderCategory?: string;
  targetName?: string;
  targetIcon?: string | null;
  targetMemberCount?: number;
  targetCategory?: string;
  terms?: {
    minMembers: number;
    price: number;
    allowedMentions: string;
  };
}

interface MilestoneItem {
  id: string;
  title: string;
  targetCount: number;
  rewardCredits: number;
  currentProgress: number;
  claimed: boolean;
  onCooldown: boolean;
  cooldownLabel: string;
  canClaim: boolean;
}

interface RealtimeToast {
  id: string;
  serverName: string;
  serverIcon?: string | null;
  termsText: string;
  timer?: any;
  remainingMs: number;
  hovered: boolean;
}

function PartnershipsTabInner({
  currentGuildId,
  serverName = 'Community Server',
  addToast,
  onNavigateTab,
}: PartnershipsTabProps) {
  const [activeTab, setActiveTab] = useState<'browse' | 'active' | 'requests' | 'rewards'>('browse');
  const [requestsSubTab, setRequestsSubTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [loading, setLoading] = useState(false);

  // Core Data States
  const [dashboardData, setDashboardData] = useState<{
    settings: any;
    activePartnerships: ActivePartner[];
    incomingRequests: PartnershipRequestItem[];
    outgoingRequests: PartnershipRequestItem[];
    summary: { activeCount: number; waitingCount: number; broadcastsSent: number };
    milestones: MilestoneItem[];
  } | null>(null);

  const [browseServers, setBrowseServers] = useState<any[]>([]);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Realtime notification toasts state (Section 8.3)
  const [liveToasts, setLiveToasts] = useState<RealtimeToast[]>([]);
  const seenRequestsRef = useRef<Set<string>>(new Set());

  // Webhook Configuration Modal State (Section 8.4)
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<{
    hasWebhook: boolean;
    maskedUrl: string;
    fullUrl: string;
    channelName: string;
    connected: boolean;
  }>({
    hasWebhook: false,
    maskedUrl: '',
    fullUrl: '',
    channelName: 'partnerships',
    connected: false,
  });
  const [showFullWebhookUrl, setShowFullWebhookUrl] = useState(false);
  const [isEditingWebhook, setIsEditingWebhook] = useState(false);
  const [webhookInput, setWebhookInput] = useState('');
  const [webhookChannelInput, setWebhookChannelInput] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Propose Partnership Modal State
  const [proposingServer, setProposingServer] = useState<any | null>(null);
  const [proposingMention, setProposingMention] = useState<'none' | 'here' | 'everyone'>('none');
  const [customAdText, setCustomAdText] = useState('');
  const [sendingProposal, setSendingProposal] = useState(false);

  // End Partnership Confirm Modal State
  const [partnerToEnd, setPartnerToEnd] = useState<ActivePartner | null>(null);
  const [endingPartner, setEndingPartner] = useState(false);

  // Load complete partnership dashboard data
  const loadDashboardData = async () => {
    try {
      const res = await fetch(`/api/partnerships/${currentGuildId}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);

        // Check for new incoming requests for realtime toast (Section 8.3)
        if (Array.isArray(data.incomingRequests)) {
          data.incomingRequests.forEach((req: PartnershipRequestItem) => {
            if (!seenRequestsRef.current.has(req.id)) {
              seenRequestsRef.current.add(req.id);
              // Trigger realtime toast if first time seeing this incoming request
              const sName = req.senderName || req.fromGuildName || 'A community';
              const termsStr = `Minimum ${req.terms?.minMembers || 5} members · Price ${req.terms?.price || 0} cr · @${req.terms?.allowedMentions || 'here'} allowed`;
              triggerRequestToast(req.id, sName, req.senderIcon, termsStr);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[PARTNERSHIPS] Error loading dashboard:', err);
    }
  };

  // Load browse eligible servers
  const loadBrowseServers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/partnerships/browse/${currentGuildId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.servers)) {
          setBrowseServers(data.servers);
        }
      }
    } catch (err) {
      console.warn('[PARTNERSHIPS] Error loading browse servers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load webhook settings
  const loadWebhookInfo = async () => {
    try {
      const res = await fetch(`/api/partnerships/${currentGuildId}/webhook`);
      if (res.ok) {
        const data = await res.json();
        setWebhookInfo(data);
        if (!data.hasWebhook) {
          setIsEditingWebhook(true);
        } else {
          setIsEditingWebhook(false);
          setWebhookInput('');
        }
        setWebhookChannelInput(data.channelName || 'partnerships');
      }
    } catch {}
  };

  useEffect(() => {
    loadDashboardData();
    loadBrowseServers();
    loadWebhookInfo();

    // 30 second polling fallback for realtime requests (Section 8.3)
    const pollInterval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [currentGuildId]);

  // Realtime Toast Management (Section 8.3: max 3 stacked, 8s auto-dismiss, pause on hover)
  const triggerRequestToast = (id: string, sName: string, iconUrl?: string | null, termsText?: string) => {
    setLiveToasts((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      const newToast: RealtimeToast = {
        id,
        serverName: sName,
        serverIcon: iconUrl,
        termsText: termsText || 'Wants to partner with your server',
        remainingMs: 8000,
        hovered: false,
      };
      // Keep max 3 stacked toasts
      const nextList = [...prev.slice(-2), newToast];
      return nextList;
    });
  };

  const removeLiveToast = (id: string) => {
    setLiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Toast countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveToasts((prev) => {
        const updated = prev
          .map((t) => {
            if (t.hovered) return t;
            return { ...t, remainingMs: t.remainingMs - 200 };
          })
          .filter((t) => t.remainingMs > 0);
        return updated;
      });
    }, 200);

    return () => clearInterval(timer);
  }, []);

  // Filtered browse list
  const filteredBrowse = useMemo(() => {
    if (!Array.isArray(browseServers)) return [];
    return browseServers.filter((s) => {
      if (!s) return false;
      const sName = String(s.name || '').toLowerCase();
      const sCat = String(s.category || '').toLowerCase();
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || sName.includes(q) || sCat.includes(q);
      const matchesCat = selectedCategory === 'All' || sCat === selectedCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [browseServers, search, selectedCategory]);

  const paginatedBrowse = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBrowse.slice(start, start + pageSize);
  }, [filteredBrowse, currentPage, pageSize]);

  // Handle Mode Change (Closed, Selective, Open) (Section 8.5)
  const handleSelectMode = async (mode: 'closed' | 'selective' | 'open') => {
    try {
      const res = await fetch(`/api/partnerships/${currentGuildId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnershipMode: mode }),
      });
      if (res.ok) {
        addToast(
          'success',
          'Mode updated',
          mode === 'closed'
            ? 'Partnership requests are now closed.'
            : mode === 'open'
            ? 'Open mode: Eligible incoming requests will be auto-accepted.'
            : 'Selective mode: Incoming requests will be reviewed manually.'
        );
        loadDashboardData();
      }
    } catch {
      addToast('error', 'Error', 'Could not update partnership mode.');
    }
  };

  // Handle Send Partnership Proposal (Section 8.1 & 8.2)
  const handleSendProposal = async () => {
    if (!proposingServer) return;
    setSendingProposal(true);
    try {
      const res = await fetch('/api/partnerships/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromGuildId: currentGuildId,
          fromGuildName: serverName,
          toGuildId: proposingServer.id,
          includeMention: proposingMention !== 'none',
          mentionType: proposingMention,
          customAdText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('success', 'Proposal sent', `Partnership proposal dispatched to ${proposingServer.name}.`);
        setProposingServer(null);
        setProposingMention('none');
        setCustomAdText('');
        loadDashboardData();
        loadBrowseServers();
      } else {
        addToast('error', 'Could not send proposal', data.error || 'Server rejected proposal.');
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Failed to send proposal.');
    } finally {
      setSendingProposal(false);
    }
  };

  // Handle Respond Request (Accept / Decline) (Section 8.2)
  const handleRespondRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const res = await fetch('/api/partnerships/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          guildId: currentGuildId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (action === 'accept') {
          addToast('success', 'Partnership established', data.deliveryNotice || 'Partnership established and cross-promotions posted.');
        } else {
          addToast('info', 'Proposal declined', 'Partnership proposal removed and mention fees refunded.');
        }
        loadDashboardData();
      } else {
        addToast('error', 'Error', data.error || 'Could not process response.');
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Network error.');
    }
  };

  // Handle Cancel Outgoing Request (Section 8.2)
  const handleCancelRequest = async (requestId: string) => {
    try {
      const res = await fetch('/api/partnerships/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          guildId: currentGuildId,
        }),
      });
      if (res.ok) {
        addToast('info', 'Proposal cancelled', 'Your partnership proposal was cancelled.');
        loadDashboardData();
      }
    } catch {
      addToast('error', 'Error', 'Could not cancel proposal.');
    }
  };

  // Handle Pause / Resume Active Partner (Section 8)
  const handleTogglePause = async (partnershipId: string) => {
    try {
      const res = await fetch('/api/partnerships/active/toggle-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnershipId, guildId: currentGuildId }),
      });
      if (res.ok) {
        const data = await res.json();
        addToast('info', 'Status updated', `Partnership is now ${data.status}.`);
        loadDashboardData();
      }
    } catch {
      addToast('error', 'Error', 'Could not update partnership status.');
    }
  };

  // Handle End Active Partner (Section 8)
  const handleConfirmEnd = async () => {
    if (!partnerToEnd) return;
    setEndingPartner(true);
    try {
      const res = await fetch('/api/partnerships/active/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnershipId: partnerToEnd.id, guildId: currentGuildId }),
      });
      if (res.ok) {
        addToast('info', 'Partnership ended', `Mutual partnership with ${partnerToEnd.partnerGuildName} has been closed.`);
        setPartnerToEnd(null);
        loadDashboardData();
      }
    } catch {
      addToast('error', 'Error', 'Could not end partnership.');
    } finally {
      setEndingPartner(false);
    }
  };

  // Handle Dispatch Manual Ad Broadcast (Section 8)
  const handleBroadcast = async (partner: ActivePartner) => {
    try {
      const res = await fetch('/api/partnerships/send-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnershipId: partner.id, guildId: currentGuildId }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('success', 'Broadcast dispatched', `Advertisement dispatched to ${partner.partnerGuildName}'s webhook.`);
        loadDashboardData();
      } else {
        addToast('warning', 'Broadcast issue', data.error || 'Failed to dispatch advertisement.');
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Network error.');
    }
  };

  // Handle Claim Milestone Reward (Section 8)
  const handleClaimMilestone = async (milestoneId: string) => {
    try {
      const res = await fetch('/api/partnerships/milestones/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId, guildId: currentGuildId }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('success', 'Reward claimed', `+${data.reward} credits credited to your server treasury!`);
        loadDashboardData();
      } else {
        addToast('warning', 'Cannot claim', data.error || 'Milestone requirements not yet met.');
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Network error.');
    }
  };

  // Handle Save Webhook (Section 8.4)
  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    try {
      const res = await fetch(`/api/partnerships/${currentGuildId}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookInput.trim(),
          channelName: webhookChannelInput.trim() || 'partnerships',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('success', 'Webhook saved', 'Partnership broadcast webhook is connected.');
        await loadWebhookInfo();
        setIsEditingWebhook(false);
        setWebhookInput('');
      } else {
        addToast('error', 'Validation error', data.error || 'Invalid Discord Webhook URL.');
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Could not save webhook.');
    } finally {
      setSavingWebhook(false);
    }
  };

  // Handle Remove Webhook (Section 8.4)
  const handleRemoveWebhook = async () => {
    try {
      const res = await fetch(`/api/partnerships/${currentGuildId}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove' }),
      });
      if (res.ok) {
        addToast('info', 'Webhook removed', 'Partnership broadcast webhook has been disconnected.');
        await loadWebhookInfo();
        setIsEditingWebhook(true);
        setWebhookInput('');
      }
    } catch {
      addToast('error', 'Error', 'Could not remove webhook.');
    }
  };

  // Handle Test Webhook (Section 8.4)
  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      const targetUrl = webhookInfo.fullUrl || webhookInput.trim();
      const res = await fetch('/api/partnerships/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: targetUrl,
          guildName: serverName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('success', 'Test dispatched', 'A test partnership announcement was sent to your Discord channel.');
      } else {
        addToast('error', 'Webhook delivery failed', data.error || 'Check Discord webhook permissions.');
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Delivery failed.');
    } finally {
      setTestingWebhook(false);
    }
  };

  const currentSettings = dashboardData?.settings || {};
  const activePartners = dashboardData?.activePartnerships || [];
  const incomingRequests = dashboardData?.incomingRequests || [];
  const outgoingRequests = dashboardData?.outgoingRequests || [];
  const milestones = dashboardData?.milestones || [];
  const summary = dashboardData?.summary || {
    activeCount: activePartners.length,
    waitingCount: incomingRequests.length,
    broadcastsSent: 0,
  };

  const currentMode: 'closed' | 'selective' | 'open' = currentSettings.partnershipMode || 'selective';

  return (
    <div className="flex flex-col min-h-[calc(100dvh-12rem)] space-y-6 w-full max-w-7xl mx-auto pb-8 font-sans">
      {/* ── HEADER ROW ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold text-[#F4F4F5] tracking-normal font-sans">
            Server partnerships
          </h1>
          <p className="text-[14px] text-[#A1A1AA] font-sans">
            Set up mutual cross-promotion with other Discord servers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              loadWebhookInfo();
              setIsWebhookModalOpen(true);
            }}
            className="text-[#A1A1AA] hover:text-[#F4F4F5] border border-[rgba(255,255,255,0.07)] gap-2"
          >
            <Settings className="size-4" />
            <span>Configure webhook</span>
            {webhookInfo.connected && (
              <span className="size-2 rounded-full bg-[var(--accent)] shrink-0" title="Webhook connected" />
            )}
          </Button>
        </div>
      </div>

      {/* ── PARTNERSHIP SETUP INCOMPLETE BANNER ── */}
      {!(Boolean(webhookInfo?.hasWebhook || currentSettings?.partnershipChannelId || (currentSettings as any)?.partnershipBroadcastChannel) && currentMode !== 'closed') && (
        <div className="rounded-[12px] border border-amber-500/20 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-4 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-white">Partnership setup required</p>
              <p className="text-zinc-400">Complete your partnership settings and broadcast channel in Promote Server before sending or receiving alliance proposals.</p>
            </div>
          </div>
          {onNavigateTab && (
            <Button
              size="sm"
              onClick={() => onNavigateTab('promote')}
              className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 shrink-0 font-medium cursor-pointer"
            >
              Configure in Promote Server
            </Button>
          )}
        </div>
      )}

      {/* ── SECTION 8.5: PARTNERSHIP MODE CARD (Closed, Selective, Open) ── */}
      <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-semibold text-[#F4F4F5] font-sans">Partnership mode</h3>
            <p className="text-[13px] text-[#A1A1AA] font-sans">
              {currentMode === 'closed' && 'Closed: Your server is not accepting any new partnership proposals.'}
              {currentMode === 'selective' && 'Selective: You review each incoming partnership proposal manually.'}
              {currentMode === 'open' && 'Open: Requests that meet your requirements are accepted automatically.'}
            </p>
          </div>

          {/* "What is on" Row of Small Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] px-2.5 py-1 rounded-[6px] bg-[#141417] text-[#A1A1AA] border border-[rgba(255,255,255,0.06)] font-sans">
              Min {currentSettings.partnershipMinMembers || 5} members
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-[6px] bg-[#141417] text-[#A1A1AA] border border-[rgba(255,255,255,0.06)] font-sans">
              Price {currentSettings.partnershipPrice || 0} credits
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-[6px] bg-[#141417] text-[var(--accent)] border border-[rgba(255,255,255,0.06)] font-sans">
              @{currentSettings.partnershipAllowedMentions || 'here'} allowed
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-[6px] bg-[#141417] text-[#A1A1AA] border border-[rgba(255,255,255,0.06)] font-sans">
              {currentSettings.partnershipDailyLimit || 3} broadcasts / day
            </span>
          </div>
        </div>

        {/* 3 Selectable Mode Tiles in a Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tile 1: Closed */}
          <button
            type="button"
            onClick={() => handleSelectMode('closed')}
            className={cn(
              'p-4 rounded-[12px] border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2',
              currentMode === 'closed'
                ? 'bg-[#141417] border-[var(--accent)] shadow-xs'
                : 'bg-[#09090B] border-[rgba(255,255,255,0.07)] hover:border-white/20'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className={cn('size-4', currentMode === 'closed' ? 'text-[var(--accent)]' : 'text-[#71717A]')} />
                <span className="text-[14px] font-semibold text-[#F4F4F5] font-sans">Closed</span>
              </div>
              {currentMode === 'closed' && (
                <Check className="size-4 text-[var(--accent)] stroke-[2.5]" />
              )}
            </div>
            <p className="text-[12px] text-[#71717A] leading-relaxed font-sans">
              No new requests can be submitted by other communities.
            </p>
          </button>

          {/* Tile 2: Selective */}
          <button
            type="button"
            onClick={() => handleSelectMode('selective')}
            className={cn(
              'p-4 rounded-[12px] border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2',
              currentMode === 'selective'
                ? 'bg-[#141417] border-[var(--accent)] shadow-xs'
                : 'bg-[#09090B] border-[rgba(255,255,255,0.07)] hover:border-white/20'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className={cn('size-4', currentMode === 'selective' ? 'text-[var(--accent)]' : 'text-[#71717A]')} />
                <span className="text-[14px] font-semibold text-[#F4F4F5] font-sans">Selective</span>
              </div>
              {currentMode === 'selective' && (
                <Check className="size-4 text-[var(--accent)] stroke-[2.5]" />
              )}
            </div>
            <p className="text-[12px] text-[#71717A] leading-relaxed font-sans">
              You manually review and accept or decline every incoming request.
            </p>
          </button>

          {/* Tile 3: Open */}
          <button
            type="button"
            onClick={() => handleSelectMode('open')}
            className={cn(
              'p-4 rounded-[12px] border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2',
              currentMode === 'open'
                ? 'bg-[#141417] border-[var(--accent)] shadow-xs'
                : 'bg-[#09090B] border-[rgba(255,255,255,0.07)] hover:border-white/20'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Unlock className={cn('size-4', currentMode === 'open' ? 'text-[var(--accent)]' : 'text-[#71717A]')} />
                <span className="text-[14px] font-semibold text-[#F4F4F5] font-sans">Open</span>
              </div>
              {currentMode === 'open' && (
                <Check className="size-4 text-[var(--accent)] stroke-[2.5]" />
              )}
            </div>
            <p className="text-[12px] text-[#71717A] leading-relaxed font-sans">
              Requests meeting your member count and category terms are accepted automatically.
            </p>
          </button>
        </div>
      </div>

      {/* ── SLIM SUMMARY LINE (ONE Source of Truth) ───────────────────── */}
      <div className="py-2.5 px-4 rounded-[12px] bg-[#0E0E11] border border-[rgba(255,255,255,0.07)] text-[13px] text-[#A1A1AA] flex items-center gap-2 flex-wrap font-sans">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className="hover:text-[#F4F4F5] hover:underline cursor-pointer"
        >
          <strong className="text-[#F4F4F5] font-semibold">{summary.activeCount}</strong> active {summary.activeCount === 1 ? 'partnership' : 'partnerships'}
        </button>
        <span className="text-[#71717A]">·</span>
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className="hover:text-[#F4F4F5] hover:underline cursor-pointer"
        >
          <strong className="text-[#F4F4F5] font-semibold">{summary.waitingCount}</strong> {summary.waitingCount === 1 ? 'request' : 'requests'} waiting
        </button>
        <span className="text-[#71717A]">·</span>
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className="hover:text-[#F4F4F5] hover:underline cursor-pointer"
        >
          <strong className="text-[#F4F4F5] font-semibold">{summary.broadcastsSent}</strong> broadcasts sent
        </button>
      </div>

      {/* ── TABS: Browse | Active | Requests | Rewards ───────────────── */}
      <div className="inline-flex items-center rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#141417] p-1">
        {(
          [
            { id: 'browse', label: 'Browse', count: filteredBrowse.length },
            { id: 'active', label: 'Active', count: summary.activeCount },
            { id: 'requests', label: 'Requests', count: summary.waitingCount },
            { id: 'rewards', label: 'Rewards', count: milestones.length },
          ] as const
        ).map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer font-sans',
                isActive
                  ? 'bg-[#0E0E11] text-[#F4F4F5] shadow-xs'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              )}
            >
              <span>{t.label}</span>
              <span
                className={cn(
                  'text-[10px] min-w-[18px] h-[18px] px-1.5 rounded-full inline-flex items-center justify-center leading-none tabular-nums font-sans font-medium',
                  isActive
                    ? 'bg-[#141417] text-[var(--accent)] border border-white/10'
                    : t.id === 'requests' && t.count > 0
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)]'
                    : 'bg-[#0E0E11] text-[#71717A] border border-white/5'
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: BROWSE (COMPACT 2-COLUMN GRID - Section 8.1) ────────── */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Toolbar: Search & Category Chips */}
          <div className="flex flex-col gap-4">
            <div className="relative max-w-md w-full">
              <Search className="size-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search partner communities…"
                className="pl-9 h-10 text-[13px] bg-[#0E0E11] border-[rgba(255,255,255,0.07)] font-sans"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-[8px] text-[13px] font-medium whitespace-nowrap transition-all cursor-pointer font-sans',
                      isSelected
                        ? 'bg-[#141417] text-[#F4F4F5] border border-[rgba(255,255,255,0.14)]'
                        : 'text-[#71717A] hover:text-[#A1A1AA] hover:bg-[#141417]/50'
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compact 2-Column Grid (Section 5) */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-[120px] rounded-[16px] bg-[#0E0E11] border border-[#19191D] animate-pulse" />
              ))}
            </div>
          ) : paginatedBrowse.length === 0 ? (
            <EmptyState
              icon={<Handshake className="size-8 text-[#71717A]" />}
              title="No partner communities found"
              description="Try adjusting your search query or selecting a different category."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedBrowse.map((srv) => {
                const minMem = srv.minMembersRequired || srv.partnershipMinMembers || 5;
                const price = srv.partnershipPrice || 0;
                const allowMention = (srv.allowPartnerMentions && srv.partnershipAllowedMentions && srv.partnershipAllowedMentions !== 'none')
                  ? (srv.partnershipAllowedMentions === 'everyone' ? '@everyone allowed' : '@here allowed')
                  : 'No mentions';
                const isPartnered = srv.partnershipStatus === 'partnered';
                const isPending = srv.partnershipStatus === 'outgoing_pending';

                return (
                  <DirectoryCard
                    key={srv.id}
                    variant="partnership"
                    server={srv}
                    minMembers={minMem}
                    partnershipPrice={price}
                    allowedMentions={allowMention}
                    partnershipStatus={isPartnered ? 'active' : isPending ? 'pending' : null}
                    isOwnServer={String(srv.id) === String(currentGuildId)}
                    onClick={() => openServerProfile(srv.id, srv)}
                    onRequestPartnership={() => {
                      const isComplete = Boolean(webhookInfo?.hasWebhook || currentSettings?.partnershipChannelId || (currentSettings as any)?.partnershipBroadcastChannel) && currentMode !== 'closed';
                      if (!isComplete) {
                        addToast('warning', 'Partnership setup required', 'Please complete your server partnership settings in Promote Server before sending proposals.');
                        if (onNavigateTab) onNavigateTab('promote');
                        return;
                      }
                      setProposingServer(srv);
                      setProposingMention('none');
                      setCustomAdText('');
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {filteredBrowse.length > pageSize && (
            <div className="pt-2 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalCount={filteredBrowse.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ACTIVE (TABLE WITH PAUSE, BROADCAST, END) ───────────── */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activePartners.length === 0 ? (
            <EmptyState
              icon={<Handshake className="size-8 text-[#71717A]" />}
              title="No active partnerships yet"
              description="Browse public servers in the Browse tab to establish mutual cross-promotion alliances."
              action={
                <Button variant="primary" size="sm" onClick={() => setActiveTab('browse')}>
                  Browse partner communities
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {activePartners.map((partner) => (
                <div
                  key={partner.id}
                  className="rounded-[16px] border border-[#19191D] bg-[#0E0E11] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-white/20"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ServerIcon
                      guildId={partner.partnerGuildId}
                      iconUrl={partner.partnerGuildIcon}
                      name={partner.partnerGuildName}
                      size={48}
                      className="size-12 rounded-[12px] object-cover shrink-0"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white truncate text-[15px] font-sans">
                          {partner.partnerGuildName}
                        </span>
                        {partner.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-[6px] border border-[var(--accent-border)] font-sans">
                            <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 bg-[#141417] px-2 py-0.5 rounded-[6px] border border-white/10 font-sans">
                            <Pause className="size-3" />
                            Paused
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap font-sans">
                        <span>{partner.partnerCategory || 'Roleplay Server'}</span>
                        <span>·</span>
                        <span>{(partner.partnerMemberCount || 0).toLocaleString()} members</span>
                        <span>·</span>
                        <span>Since {partner.since}</span>
                        <span>·</span>
                        <span>Last broadcast: {partner.lastBroadcast || 'None yet'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-white/[0.06] w-full sm:w-auto justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTogglePause(partner.id)}
                      className="h-8 px-2.5 text-xs text-zinc-300 hover:text-white"
                      title={partner.status === 'active' ? 'Pause partnership' : 'Resume partnership'}
                    >
                      {partner.status === 'active' ? <Pause className="size-3.5 mr-1" /> : <Play className="size-3.5 mr-1" />}
                      <span>{partner.status === 'active' ? 'Pause' : 'Resume'}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBroadcast(partner)}
                      className="h-8 px-2.5 text-xs text-white border-white/10"
                      title="Send advertisement broadcast now"
                    >
                      <Radio className="size-3.5 mr-1 text-[var(--accent)]" />
                      <span>Broadcast</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPartnerToEnd(partner)}
                      className="h-8 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      title="End partnership agreement"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      <span>End</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: REQUESTS (INCOMING & OUTGOING SUB-TABS - Section 8.2) ── */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Sub-Tabs: Incoming vs Outgoing */}
          <div className="flex items-center gap-2 border-b border-[#19191D] pb-3">
            <button
              type="button"
              onClick={() => setRequestsSubTab('incoming')}
              className={cn(
                'px-4 py-2 rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer font-sans',
                requestsSubTab === 'incoming'
                  ? 'bg-[#141417] text-[#F4F4F5] border border-white/10 shadow-xs'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              )}
            >
              Incoming ({incomingRequests.length})
            </button>
            <button
              type="button"
              onClick={() => setRequestsSubTab('outgoing')}
              className={cn(
                'px-4 py-2 rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer font-sans',
                requestsSubTab === 'outgoing'
                  ? 'bg-[#141417] text-[#F4F4F5] border border-white/10 shadow-xs'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              )}
            >
              Outgoing ({outgoingRequests.length})
            </button>
          </div>

          {/* Sub-Tab 1: Incoming Requests */}
          {requestsSubTab === 'incoming' && (
            incomingRequests.length === 0 ? (
              <EmptyState
                icon={<Handshake className="size-8 text-[#71717A]" />}
                title="No incoming requests waiting"
                description="When another community proposes a partnership with your server, it will show up here."
              />
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-[14px] border border-[#19191D] bg-[#0E0E11] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-white/20"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <ServerIcon
                        guildId={req.fromGuildId}
                        iconUrl={req.senderIcon || req.fromGuildIcon}
                        name={req.senderName || req.fromGuildName || 'Partner Server'}
                        size={44}
                        className="size-11 rounded-[10px] object-cover shrink-0"
                      />

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[14px] font-semibold text-[#F4F4F5] truncate font-sans">
                            {req.senderName || req.fromGuildName || 'Partner Server'}
                          </h4>
                          <span className="text-[11px] text-[#A1A1AA] bg-[#141417] px-2 py-0.5 rounded-[6px] border border-white/[0.06] font-sans">
                            {req.senderCategory || 'Roleplay Server'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[12px] text-[#71717A] font-sans">
                          <span>{(req.senderMemberCount || 0).toLocaleString()} members</span>
                          <span>·</span>
                          <span>{req.terms ? `Min ${req.terms.minMembers} members` : 'Standard terms'}</span>
                          {req.includeMention && (
                            <>
                              <span>·</span>
                              <span className="text-[var(--accent)] font-medium">@{req.mentionType} mention</span>
                            </>
                          )}
                        </div>

                        {req.adText && (
                          <p className="text-[12px] text-[#A1A1AA] line-clamp-1 italic font-sans">
                            &quot;{req.adText}&quot;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Accept / Decline Action Buttons (Section 8.2) */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleRespondRequest(req.id, 'accept')}
                        className="h-8 px-4 text-xs font-semibold gap-1.5"
                      >
                        <Check className="size-3.5" />
                        <span>Accept</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRespondRequest(req.id, 'decline')}
                        className="h-8 px-3 text-xs text-[#A1A1AA] hover:text-red-400 hover:bg-red-500/10 gap-1.5"
                      >
                        <X className="size-3.5" />
                        <span>Decline</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Sub-Tab 2: Outgoing Requests */}
          {requestsSubTab === 'outgoing' && (
            outgoingRequests.length === 0 ? (
              <EmptyState
                icon={<Send className="size-8 text-[#71717A]" />}
                title="No outgoing requests"
                description="Explore the Browse tab to discover communities and submit partnership proposals."
              />
            ) : (
              <div className="space-y-3">
                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-[14px] border border-[#19191D] bg-[#0E0E11] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-white/20"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <ServerIcon
                        guildId={req.toGuildId}
                        iconUrl={req.targetIcon || req.toGuildIcon}
                        name={req.targetName || req.toGuildName || 'Target Server'}
                        size={44}
                        className="size-11 rounded-[10px] object-cover shrink-0"
                      />

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[14px] font-semibold text-[#F4F4F5] truncate font-sans">
                            {req.targetName || req.toGuildName || 'Target Server'}
                          </h4>
                          <span className="text-[11px] text-[#A1A1AA] bg-[#141417] px-2 py-0.5 rounded-[6px] border border-white/[0.06] font-sans">
                            {req.targetCategory || 'Roleplay Server'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[12px] text-[#71717A] font-sans">
                          <span>{(req.targetMemberCount || 0).toLocaleString()} members</span>
                          <span>·</span>
                          <span>Submitted {new Date(req.createdAt).toISOString().split('T')[0]}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      {req.status === 'pending' && (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400 bg-[#141417] px-2.5 py-1 rounded-[6px] border border-white/10 font-sans">
                            <Clock className="size-3" />
                            Awaiting response
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelRequest(req.id)}
                            className="h-8 px-3 text-xs text-[#A1A1AA] hover:text-red-400 hover:bg-red-500/10"
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {req.status === 'accepted' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)] bg-[#141417] px-2.5 py-1 rounded-[6px] border border-white/10 font-sans">
                          <Check className="size-3" />
                          Accepted
                        </span>
                      )}

                      {req.status === 'declined' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 bg-[#141417] px-2.5 py-1 rounded-[6px] border border-white/10 font-sans">
                          <X className="size-3" />
                          Declined
                        </span>
                      )}

                      {req.status === 'cancelled' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 bg-[#141417] px-2.5 py-1 rounded-[6px] border border-white/10 font-sans">
                          Cancelled
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ── TAB 4: REWARDS (MILESTONES WITH PROGRESS BAR & COOLDOWNS) ── */}
      {activeTab === 'rewards' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">Partnership milestones</h3>
            <p className="text-[13px] text-[#A1A1AA] font-sans">
              Expand your alliance network to unlock seasonal credit bounty milestones for your server treasury.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {milestones.map((m) => {
              const progressPct = Math.min(100, Math.round((m.currentProgress / m.targetCount) * 100));

              return (
                <div
                  key={m.id}
                  className="rounded-[14px] border border-[#19191D] bg-[#0E0E11] p-5 space-y-3.5 transition-colors hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Trophy className="size-4 text-[var(--accent)] shrink-0" />
                        <h4 className="text-[15px] font-semibold text-[#F4F4F5] font-sans">{m.title}</h4>
                      </div>
                      <p className="text-[12px] text-[#71717A] font-sans">
                        Target: {m.targetCount} active {m.targetCount === 1 ? 'partner' : 'partners'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[13px] font-semibold text-[var(--accent)] bg-[#141417] px-2.5 py-1 rounded-[8px] border border-white/10 font-sans shrink-0">
                      <Coins className="size-3.5" />
                      +{m.rewardCredits} cr
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-[#A1A1AA] font-sans">
                      <span>Progress</span>
                      <span className="font-semibold text-[#F4F4F5]">{m.currentProgress} / {m.targetCount}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#141417] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Claim Button / Real Cooldown Format (Section 8) */}
                  <div className="pt-1 flex items-center justify-end">
                    {m.claimed ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#71717A] font-medium font-sans">
                        <Check className="size-3.5 text-[var(--accent)]" />
                        Claimed
                      </span>
                    ) : m.onCooldown ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="h-8 px-3 text-xs text-[#71717A] bg-[#141417] border border-white/10 cursor-not-allowed font-sans"
                      >
                        <Clock className="size-3 mr-1.5 text-amber-400" />
                        <span>{m.cooldownLabel || 'Cooldown active'}</span>
                      </Button>
                    ) : m.canClaim ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleClaimMilestone(m.id)}
                        className="h-8 px-4 text-xs font-semibold"
                      >
                        Claim +{m.rewardCredits} credits
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="h-8 px-3 text-xs text-[#71717A] bg-[#141417] border border-white/[0.06] cursor-not-allowed font-sans"
                      >
                        In progress
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 8.3: REALTIME NOTIFICATION TOAST CARDS ───────────── */}
      {liveToasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
          {liveToasts.map((toast) => (
            <div
              key={toast.id}
              onMouseEnter={() => {
                setLiveToasts((prev) =>
                  prev.map((t) => (t.id === toast.id ? { ...t, hovered: true } : t))
                );
              }}
              onMouseLeave={() => {
                setLiveToasts((prev) =>
                  prev.map((t) => (t.id === toast.id ? { ...t, hovered: false } : t))
                );
              }}
              className="pointer-events-auto rounded-[14px] border border-[var(--border-strong)] bg-[#0E0E11] p-3.5 shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150 font-sans"
            >
              <div className="flex items-start gap-3">
                <ServerIcon
                  guildId={toast.id}
                  iconUrl={toast.serverIcon}
                  name={toast.serverName}
                  size={36}
                  className="size-9 rounded-[8px] object-cover shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-semibold text-[#F4F4F5] truncate font-sans">
                    {toast.serverName} wants to partner with you
                  </h4>
                  <p className="text-[11px] text-[#A1A1AA] truncate font-sans">
                    {toast.termsText}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeLiveToast(toast.id)}
                  className="text-[#71717A] hover:text-[#F4F4F5] cursor-pointer p-0.5"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[rgba(255,255,255,0.06)]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLiveToast(toast.id)}
                  className="h-7 px-2.5 text-[11px] text-[#71717A] hover:text-[#F4F4F5]"
                >
                  Dismiss
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    removeLiveToast(toast.id);
                    setActiveTab('requests');
                    setRequestsSubTab('incoming');
                  }}
                  className="h-7 px-3 text-[11px] font-semibold"
                >
                  Review
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SECTION 8.4: CONFIGURE WEBHOOK MODAL (MASKED, SHOW URL, TEST) ─ */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-[16px] border border-[rgba(255,255,255,0.13)] bg-[#0E0E11] p-6 shadow-2xl space-y-5 font-sans">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[18px] font-semibold text-[#F4F4F5] font-sans">
                  Partnership webhook settings
                </h3>
                {webhookInfo.connected && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] bg-[#141417] px-2 py-0.5 rounded-[6px] border border-white/10 font-sans">
                    <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                    Connected
                  </span>
                )}
              </div>

              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setIsWebhookModalOpen(false)}
                className="text-[#71717A] hover:text-[#F4F4F5] cursor-pointer p-1 rounded-md hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Display Saved Masked Webhook (Section 8.4) */}
            {webhookInfo.hasWebhook && !isEditingWebhook ? (
              <div className="space-y-4">
                <div className="p-4 rounded-[12px] bg-[#141417] border border-[rgba(255,255,255,0.07)] space-y-3 font-sans">
                  <div className="flex items-center justify-between text-[12px] text-[#A1A1AA]">
                    <span>Channel: <strong className="text-[#F4F4F5]">#{webhookInfo.channelName}</strong></span>
                    <button
                      type="button"
                      onClick={() => setShowFullWebhookUrl((prev) => !prev)}
                      className="text-[var(--accent)] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {showFullWebhookUrl ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      <span>{showFullWebhookUrl ? 'Hide URL' : 'Show URL'}</span>
                    </button>
                  </div>

                  <div className="p-2.5 rounded-[8px] bg-[#09090B] border border-white/10 font-mono text-[12px] text-[#F4F4F5] truncate select-all">
                    {showFullWebhookUrl ? webhookInfo.fullUrl : webhookInfo.maskedUrl}
                  </div>
                </div>

                {/* Webhook Action Buttons: Send test, Change, Remove (Section 8.4) */}
                <div className="flex items-center justify-between gap-2.5 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveWebhook}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                  >
                    Remove
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestWebhook}
                      disabled={testingWebhook}
                      className="text-xs border-white/10 text-[#F4F4F5]"
                    >
                      {testingWebhook ? 'Sending…' : 'Send test'}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingWebhook(true);
                        setWebhookInput('');
                      }}
                      className="text-xs text-[#A1A1AA] hover:text-[#F4F4F5]"
                    >
                      Change
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Input Form for New / Modified Webhook */
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[#F4F4F5] font-sans">
                    Discord webhook URL
                  </label>
                  <Input
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="h-10 text-[13px] bg-[#141417] border-[rgba(255,255,255,0.07)] font-sans"
                  />
                  <p className="text-[12px] text-[#71717A] font-sans">
                    Create a webhook in your server&apos;s #partnerships channel and paste the URL here.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[#F4F4F5] font-sans">
                    Channel name (optional)
                  </label>
                  <Input
                    value={webhookChannelInput}
                    onChange={(e) => setWebhookChannelInput(e.target.value)}
                    placeholder="partnerships"
                    className="h-10 text-[13px] bg-[#141417] border-[rgba(255,255,255,0.07)] font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  {webhookInfo.hasWebhook && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingWebhook(false)}
                      className="text-xs text-[#A1A1AA]"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveWebhook}
                    disabled={savingWebhook || !webhookInput.trim()}
                    className="text-xs font-semibold"
                  >
                    {savingWebhook ? 'Saving…' : 'Save webhook'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PROPOSE PARTNERSHIP CONFIRM MODAL (Section 8.1) ─────────── */}
      {proposingServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-[16px] border border-[rgba(255,255,255,0.13)] bg-[#0E0E11] p-6 shadow-2xl space-y-4 font-sans">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[18px] font-semibold text-[#F4F4F5] font-sans">
                  Request partnership
                </h3>
                <p className="text-[13px] text-[#A1A1AA] font-sans">
                  Propose cross-promotion with <strong className="text-[#F4F4F5]">{proposingServer.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProposingServer(null)}
                className="text-[#71717A] hover:text-[#F4F4F5] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Terms Summary */}
            <div className="p-3.5 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] space-y-2 text-[12px] font-sans">
              <div className="flex justify-between text-[#A1A1AA]">
                <span>Required community size:</span>
                <span className="text-[#F4F4F5] font-medium">{proposingServer.minMembersRequired || 5} members</span>
              </div>
              <div className="flex justify-between text-[#A1A1AA]">
                <span>Base proposal fee:</span>
                <span className="text-[#F4F4F5] font-medium">{proposingServer.partnershipPrice || 0} credits</span>
              </div>
              <div className="flex justify-between text-[#A1A1AA]">
                <span>Allowed mention tiers:</span>
                <span className="text-[var(--accent)] font-medium">@{proposingServer.partnershipAllowedMentions || 'here'}</span>
              </div>
            </div>

            {/* Mention Tier Selection */}
            {proposingServer.allowPartnerMentions && proposingServer.partnershipAllowedMentions && proposingServer.partnershipAllowedMentions !== 'none' && (
              <div className="space-y-1.5 font-sans">
                <label className="text-[12px] font-medium text-[#F4F4F5]">
                  Select broadcast announcement mention
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProposingMention('none')}
                    className={cn(
                      'p-2 rounded-[8px] text-[12px] font-medium border text-center transition-colors cursor-pointer',
                      proposingMention === 'none'
                        ? 'bg-[#19191D] border-[var(--accent)] text-[#F4F4F5]'
                        : 'bg-[#141417] border-[rgba(255,255,255,0.07)] text-[#71717A]'
                    )}
                  >
                    No mention (+0 cr)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProposingMention('here')}
                    className={cn(
                      'p-2 rounded-[8px] text-[12px] font-medium border text-center transition-colors cursor-pointer',
                      proposingMention === 'here'
                        ? 'bg-[#19191D] border-[var(--accent)] text-[#F4F4F5]'
                        : 'bg-[#141417] border-[rgba(255,255,255,0.07)] text-[#71717A]'
                    )}
                  >
                    @here (+{proposingServer.partnershipHerePrice || 15} cr)
                  </button>
                </div>
              </div>
            )}

            {/* Total Cost Breakdown */}
            {(() => {
              const baseCost = proposingServer.partnershipPrice || 0;
              const mentionCost = proposingMention === 'here'
                ? (proposingServer.partnershipHerePrice || 15)
                : 0;
              const totalCost = baseCost + mentionCost;

              return (
                <div className="p-3.5 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] space-y-1 font-sans">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-[#A1A1AA]">Total cost to propose:</span>
                    <span className="font-semibold text-[var(--accent)]">{totalCost} credits</span>
                  </div>
                  <p className="text-[11px] text-[#71717A] leading-relaxed">
                    Credits are held securely and deducted only if the partnership is accepted.
                  </p>
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setProposingServer(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendProposal}
                disabled={sendingProposal}
                className="font-semibold"
              >
                {sendingProposal ? 'Sending…' : 'Send proposal'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── END PARTNERSHIP CONFIRM MODAL ────────────────────────────── */}
      {partnerToEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-[16px] border border-[rgba(255,255,255,0.13)] bg-[#0E0E11] p-6 shadow-2xl space-y-4 font-sans">
            <h3 className="text-[18px] font-semibold text-[#F4F4F5] font-sans">
              End partnership agreement?
            </h3>
            <p className="text-[13px] text-[#A1A1AA] leading-relaxed font-sans">
              Are you sure you want to end your mutual partnership with <strong className="text-[#F4F4F5]">{partnerToEnd.partnerGuildName}</strong>? Webhook broadcasts and cross-promotions will immediately cease.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setPartnerToEnd(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmEnd}
                disabled={endingPartner}
              >
                {endingPartner ? 'Ending…' : 'End partnership'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PartnershipsTab(props: PartnershipsTabProps) {
  return (
    <TabErrorBoundary tabTitle="Partnerships">
      <PartnershipsTabInner {...props} />
    </TabErrorBoundary>
  );
}
