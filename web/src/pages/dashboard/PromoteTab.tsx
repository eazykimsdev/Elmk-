import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Cropper from 'react-easy-crop';
import {
  Radio,
  Palette,
  Shield,
  Building2,
  Calendar,
  Layers,
  Check,
  Upload,
  X,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Link as LinkIcon,
  Globe,
  Sliders,
  Image as ImageIcon,
  Handshake,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Quote,
  List,
  Gamepad2,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  Copy,
  Send,
} from 'lucide-react';
import { MarkdownRenderer, stripMarkdown } from '@/components/ui/markdown-renderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberField } from '@/components/ui/number-field';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DirectoryCard, type DirectoryServerData } from '@/components/ui/directory-card';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { TabErrorBoundary } from '@/components/TabErrorBoundary';
import { useRegisterDirtyForm } from '@/lib/dirty-form-store';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { DiscordGuild, WorkspaceCustomizations } from '@/types';

interface PromoteTabProps {
  guild?: DiscordGuild | null;
  config?: WorkspaceCustomizations | null;
  onChangeConfig: (updates: Partial<WorkspaceCustomizations>) => void;
  onSaveConfig: () => Promise<void>;
  onNavigateTab?: (tab: string) => void;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
  initialSubTab?: string;
}

interface CategoryOption {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  hintField?: string;
}

export const safeStr = (v: any) => (v === null || v === undefined ? '' : String(v)).trim();

export function normalizePromoteValues(data: any) {
  const normStr = (v: any) => (v === null || v === undefined ? '' : String(v).trim().replace(/\r\n/g, '\n'));
  const normNum = (v: any, fallback = 0) => {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  };
  const normTags = (v: any): string[] => {
    if (Array.isArray(v)) {
      return [...new Set(v.filter((t) => t !== null && t !== undefined).map((t) => normStr(t).toLowerCase()).filter(Boolean))].sort();
    }
    if (typeof v === 'string') {
      return [...new Set(v.split(',').map((t) => normStr(t).toLowerCase()).filter(Boolean))].sort();
    }
    return [];
  };
  const normCategories = (v: any): string[] => {
    if (Array.isArray(v)) {
      return [...new Set(v.filter((c) => c !== null && c !== undefined).map(normStr).filter(Boolean))].sort();
    }
    return ['COTS', 'Departments', 'Design Server', 'Events', 'Misc', 'Roleplay Server'];
  };

  const hasRecruitingConfigured = data?.recruitRepresentatives !== undefined
    ? Boolean(data.recruitRepresentatives)
    : (data?.representativesWanted !== undefined && Number(data.representativesWanted) > 0);

  const offerHigherReward = Boolean(data?.offerHigherReward);
  const extraCredits = Math.min(20, Math.max(0, normNum(
    data?.extraCreditsPerJoin !== undefined
      ? data.extraCreditsPerJoin
      : (offerHigherReward ? Math.max(1, normNum(data?.bountyCoins ?? data?.rewardCoins, 2) - 2) : 1),
    1
  )));

  const representativesWanted = hasRecruitingConfigured
    ? Math.min(50, Math.max(1, normNum(data?.representativesWanted, 1)))
    : 0;

  return {
    isListed: Boolean(data?.isListed ?? data?.listedInDirectory ?? true),
    category: normStr(data?.category ?? data?.serverCategory ?? 'Roleplay Server'),
    summary: normStr(data?.summary ?? data?.serverSummary ?? ''),
    description: normStr(data?.description ?? data?.serverDescription ?? ''),
    tags: normTags(data?.tags ?? data?.serverTags ?? ['roleplay']),
    language: normStr(data?.language ?? 'English') || 'English',
    bannerUrl: normStr(data?.bannerUrl ?? data?.serverBannerUrl ?? ''),
    inviteUrl: normStr(data?.inviteUrl ?? data?.discordInvite ?? ''),
    joinCode: normStr(data?.joinCode ?? ''),
    offerHigherReward,
    extraCreditsPerJoin: extraCredits,
    bountyCoins: offerHigherReward ? 2 + extraCredits : 2,
    recruitRepresentatives: hasRecruitingConfigured,
    representativesWanted,
    creditsPerRecruit: Math.min(10, Math.max(0, normNum(data?.creditsPerRecruit, 1))),
    approveManually: Boolean(data?.approveManually),
    retentionTargetHours: [72, 168, 336].includes(Number(data?.retentionTargetHours)) ? Number(data?.retentionTargetHours) : 72,
    recruitLogChannelId: normStr(data?.recruitLogChannelId || ''),
    repRoleId: normStr(data?.repRoleId || ''),
    recruitRoleId: normStr(data?.recruitRoleId || ''),
    openForPartnerships: Boolean(data?.openForPartnerships ?? true),
    partnershipMinMembers: Math.min(100000, Math.max(0, normNum(data?.partnershipMinMembers, 5))),
    partnershipPrice: Math.min(50, Math.max(0, normNum(data?.partnershipPrice, 0))),
    partnershipAllowedMentions: (normStr(data?.partnershipAllowedMentions) || 'here') as 'none' | 'here' | 'everyone',
    partnershipHerePrice: Math.min(100, Math.max(0, normNum(data?.partnershipHerePrice, 15))),
    partnershipEveryonePrice: Math.min(100, Math.max(0, normNum(data?.partnershipEveryonePrice, 30))),
    partnershipBroadcastChannel: normStr(data?.partnershipBroadcastChannel || ''),
    partnershipAcceptedCategories: normCategories(data?.partnershipAcceptedCategories),
    partnershipDailyLimit: Math.min(10, Math.max(1, normNum(data?.partnershipDailyLimit, 1))),
  };
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'Design Server',
    name: 'Design Server',
    description: 'Liveries, graphics and assets',
    icon: Palette,
  },
  {
    id: 'Roleplay Server',
    name: 'Roleplay Server',
    description: 'Sessions, jobs and civilian life',
    icon: Radio,
  },
  {
    id: 'Misc',
    name: 'Misc',
    description: 'Anything else',
    icon: Layers,
  },
  {
    id: 'COTS',
    name: 'COTS',
    description: 'Community-run operations',
    icon: Shield,
    hint: 'Highlight your operation schedule and specializations.',
  },
  {
    id: 'Departments',
    name: 'Departments',
    description: 'Police, fire, EMS and more',
    icon: Building2,
    hint: 'List open department divisions and active shifts.',
  },
  {
    id: 'Events',
    name: 'Events',
    description: 'Meetups and sessions',
    icon: Calendar,
    hint: 'Keep your event calendar updated in server announcements.',
  },
];

function PromoteTabInner({
  guild,
  config,
  onChangeConfig,
  onSaveConfig,
  addToast,
}: PromoteTabProps) {
  const guildId = guild?.id || '1530147023754367006';
  const serverName = guild?.name || config?.serverName || 'Server';

  // Sub-tabs: Listing | Appearance | Invite and rewards | Partnerships
  const [activeTab, setActiveTab] = useState<'listing' | 'appearance' | 'rewards' | 'partnerships'>('listing');

  // Initial cached listing fallback
  const cachedListing = useMemo(() => {
    try {
      const saved = localStorage.getItem(`server_promoted_listing_${guildId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [guildId]);

  // Listed toggle switch in header
  const [isListed, setIsListed] = useState<boolean>(() => {
    if (cachedListing && cachedListing.listedInDirectory !== undefined) {
      return Boolean(cachedListing.listedInDirectory);
    }
    return config?.listedInDirectory ?? true;
  });

  // Listing state
  const [category, setCategory] = useState<string>(() => {
    return cachedListing?.category || config?.serverCategory || 'Roleplay server';
  });
  const [summary, setSummary] = useState<string>(() => {
    return cachedListing?.summary || config?.serverSummary || '';
  });
  const [description, setDescription] = useState<string>(() => {
    return cachedListing?.description || config?.serverDescription || '';
  });
  const [tags, setTags] = useState<string[]>(() => {
    if (Array.isArray(cachedListing?.tags)) return cachedListing.tags.slice(0, 5);
    if (Array.isArray(config?.serverTags)) return config.serverTags.slice(0, 5);
    if (typeof config?.serverTags === 'string') {
      return config.serverTags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5);
    }
    return ['roleplay'];
  });
  const [tagInput, setTagInput] = useState('');
  const [language, setLanguage] = useState<string>(() => {
    return cachedListing?.language || (config as any)?.language || 'English';
  });

  // Appearance state
  const [bannerUrl, setBannerUrl] = useState<string>(() => {
    return cachedListing?.bannerUrl || config?.bannerUrl || '';
  });
  const [isCropping, setIsCropping] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Invite and rewards state (Phase D)
  const [inviteUrl, setInviteUrl] = useState<string>(() => {
    return cachedListing?.inviteUrl || config?.inviteUrl || config?.discordInvite || '';
  });
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [joinCode, setJoinCode] = useState<string>(() => {
    return cachedListing?.joinCode || config?.joinCode || '';
  });
  const [offerHigherReward, setOfferHigherReward] = useState<boolean>(() => {
    return cachedListing?.offerHigherReward ?? (config as any)?.offerHigherReward ?? false;
  });
  const [extraCreditsPerJoin, setExtraCreditsPerJoin] = useState<number>(() => {
    if (cachedListing?.extraCreditsPerJoin !== undefined) return Number(cachedListing.extraCreditsPerJoin);
    const coins = cachedListing?.bountyCoins ?? (config as any)?.rewardCoins ?? 2;
    return Math.max(1, coins - 2);
  });
  const [bountyCoins, setBountyCoins] = useState<number>(() => {
    const isHigher = cachedListing?.offerHigherReward ?? (config as any)?.offerHigherReward ?? false;
    if (!isHigher) return 2;
    const extra = cachedListing?.extraCreditsPerJoin ?? Math.max(1, ((config as any)?.rewardCoins ?? 2) - 2);
    return 2 + extra;
  });
  const [recruitRepresentatives, setRecruitRepresentatives] = useState<boolean>(() => {
    if (cachedListing?.recruitRepresentatives !== undefined) return Boolean(cachedListing.recruitRepresentatives);
    if ((config as any)?.recruitRepresentatives !== undefined) return Boolean((config as any).recruitRepresentatives);
    return Number(cachedListing?.representativesWanted ?? (config as any)?.representativesWanted ?? 0) > 0;
  });
  const [representativesWanted, setRepresentativesWanted] = useState<number>(() => {
    const recOn = cachedListing?.recruitRepresentatives ?? (config as any)?.recruitRepresentatives ?? (Number(cachedListing?.representativesWanted ?? (config as any)?.representativesWanted ?? 0) > 0);
    if (!recOn) return 0;
    return cachedListing?.representativesWanted ?? (config as any)?.representativesWanted ?? 1;
  });
  const [retentionTargetHours, setRetentionTargetHours] = useState<number>(() => {
    return cachedListing?.retentionTargetHours ?? (config as any)?.retentionTargetHours ?? 72;
  });

  // Markdown editor state (Section 3)
  const [descTab, setDescTab] = useState<'write' | 'preview'>('write');
  const [showHelpPopover, setShowHelpPopover] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // ER:LC connection state (Section 4)
  const [erlcData, setErlcData] = useState<{
    connected: boolean;
    name?: string;
    currentPlayers?: number;
    maxPlayers?: number;
    joinCode?: string;
    maskedKey?: string;
    lastCheckedAt?: string;
    status?: string;
  }>({ connected: false });
  const [erlcKeyInput, setErlcKeyInput] = useState('');
  const [showKeyPassword, setShowKeyPassword] = useState(false);
  const [isConnectingErlc, setIsConnectingErlc] = useState(false);
  const [isTestingErlc, setIsTestingErlc] = useState(false);
  const [isRefreshingErlc, setIsRefreshingErlc] = useState(false);
  const [showManualJoinCode, setShowManualJoinCode] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [copiedErlcCode, setCopiedErlcCode] = useState(false);

  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'recently';
    const sec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
    if (sec < 10) return 'just now';
    if (sec < 60) return `${sec} seconds ago`;
    const min = Math.floor(sec / 60);
    if (min === 1) return '1 minute ago';
    if (min < 60) return `${min} minutes ago`;
    const hours = Math.floor(min / 60);
    return `${hours} hours ago`;
  };

  const applyMarkdown = (prefix: string, suffix: string = prefix, placeholder: string = 'text') => {
    const el = descriptionRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = description;
    const selected = text.substring(start, end);

    let replacement = '';
    let newCursorPos = start;

    if (selected.length > 0) {
      replacement = `${prefix}${selected}${suffix}`;
      newCursorPos = start + replacement.length;
    } else {
      replacement = `${prefix}${placeholder}${suffix}`;
      newCursorPos = start + prefix.length;
    }

    const updated = text.substring(0, start) + replacement + text.substring(end);
    if (updated.length <= 1000) {
      setDescription(updated);
      syncUpdates({ serverDescription: updated });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(
          selected.length > 0 ? newCursorPos : start + prefix.length,
          selected.length > 0 ? newCursorPos : start + prefix.length + placeholder.length
        );
      }, 0);
    }
  };

  // Partnerships tab state (Phase D)
  const [openForPartnerships, setOpenForPartnerships] = useState<boolean>(() => {
    return cachedListing?.openForPartnerships ?? (config as any)?.openForPartnerships ?? true;
  });
  const [partnershipMinMembers, setPartnershipMinMembers] = useState<number>(() => {
    return cachedListing?.partnershipMinMembers ?? (config as any)?.partnershipMinMembers ?? 5;
  });
  const [partnershipPrice, setPartnershipPrice] = useState<number>(() => {
    return cachedListing?.partnershipPrice ?? (config as any)?.partnershipPrice ?? 0;
  });
  const [partnershipAllowedMentions, setPartnershipAllowedMentions] = useState<'none' | 'here' | 'everyone'>(() => {
    return cachedListing?.partnershipAllowedMentions ?? (config as any)?.partnershipAllowedMentions ?? 'here';
  });
  const [partnershipHerePrice, setPartnershipHerePrice] = useState<number>(() => {
    return cachedListing?.partnershipHerePrice ?? (config as any)?.partnershipHerePrice ?? 15;
  });
  const [partnershipEveryonePrice, setPartnershipEveryonePrice] = useState<number>(() => {
    return cachedListing?.partnershipEveryonePrice ?? (config as any)?.partnershipEveryonePrice ?? 30;
  });
  const [partnershipBroadcastChannel, setPartnershipBroadcastChannel] = useState<string>(() => {
    return cachedListing?.partnershipBroadcastChannel ?? (config as any)?.partnershipBroadcastChannel ?? '';
  });
  const [partnershipAcceptedCategories, setPartnershipAcceptedCategories] = useState<string[]>(() => {
    if (Array.isArray(cachedListing?.partnershipAcceptedCategories)) return cachedListing.partnershipAcceptedCategories;
    if (Array.isArray((config as any)?.partnershipAcceptedCategories)) return (config as any).partnershipAcceptedCategories;
    return ['Design Server', 'Roleplay Server', 'Misc', 'COTS', 'Departments', 'Events'];
  });
  const [partnershipDailyLimit, setPartnershipDailyLimit] = useState<number>(() => {
    return cachedListing?.partnershipDailyLimit ?? (config as any)?.partnershipDailyLimit ?? 1;
  });

  // Dialog & Discord Channels state
  const [gateDialogOpen, setGateDialogOpen] = useState(false);
  const [higherRewardDialogOpen, setHigherRewardDialogOpen] = useState(false);
  const [userBalance, setUserBalance] = useState<number>(() => {
    try {
      const cached = localStorage.getItem('erlcus_credits_balance');
      if (cached !== null) return parseInt(cached, 10) || 0;
    } catch {}
    return 0;
  });
  const [discordChannels, setDiscordChannels] = useState<{ id: string; name: string }[]>(() => {
    try {
      const stored = localStorage.getItem(`erlcus_channels_${guildId}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [discordRoles, setDiscordRoles] = useState<{ id: string; name: string; color?: number }[]>([]);

  // Recruiting state (Section 6)
  const [creditsPerRecruit, setCreditsPerRecruit] = useState<number>(() => {
    return cachedListing?.creditsPerRecruit ?? (config as any)?.creditsPerRecruit ?? 1;
  });
  const [approveManually, setApproveManually] = useState<boolean>(() => {
    return cachedListing?.approveManually ?? Boolean((config as any)?.approveManually);
  });
  const [recruitLogChannelId, setRecruitLogChannelId] = useState<string>(() => {
    return cachedListing?.recruitLogChannelId || (config as any)?.recruitLogChannelId || '';
  });
  const [repRoleId, setRepRoleId] = useState<string>(() => {
    return cachedListing?.repRoleId || (config as any)?.repRoleId || '';
  });
  const [recruitRoleId, setRecruitRoleId] = useState<string>(() => {
    return cachedListing?.recruitRoleId || (config as any)?.recruitRoleId || '';
  });
  const [dmOwner, setDmOwner] = useState<boolean>(() => {
    return cachedListing?.dmOwner ?? (config as any)?.dmOwner ?? true;
  });
  const [activeRepsCount, setActiveRepsCount] = useState<number>(0);
  const [confirmTurnOffRecruitingOpen, setConfirmTurnOffRecruitingOpen] = useState(false);
  const [isSendingTestPanel, setIsSendingTestPanel] = useState(false);

  // Fetch discord channels and user balance
  useEffect(() => {
    let mounted = true;
    async function loadExtraData() {
      try {
        const [chRes, balRes, rRes] = await Promise.all([
          fetch(`/api/workspace/${guildId}/channels`),
          fetch('/api/credits'),
          fetch(`/api/workspace/${guildId}/roles`).catch(() => null)
        ]);
        if (chRes.ok) {
          const chData = await chRes.json();
          if (mounted && Array.isArray(chData.channels) && chData.channels.length > 0) {
            setDiscordChannels(chData.channels);
          }
        }
        if (balRes.ok) {
          const balData = await balRes.json();
          if (mounted && typeof balData.balance === 'number') {
            setUserBalance(balData.balance);
          }
        }
        if (rRes && rRes.ok) {
          const rData = await rRes.json();
          if (mounted && Array.isArray(rData.roles) && rData.roles.length > 0) {
            setDiscordRoles(rData.roles);
          }
        }
      } catch {}
    }
    loadExtraData();
    return () => { mounted = false; };
  }, [guildId]);

  // Preview mode switch
  const [previewMode, setPreviewMode] = useState<'card' | 'page'>('card');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch popular tags dynamically from backend based on category (7.4)
  const [popularTags, setPopularTags] = useState<string[]>([]);
  useEffect(() => {
    let mounted = true;
    async function loadPopular() {
      try {
        const res = await fetch(`/api/tags/popular?category=${encodeURIComponent(category)}`);
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data.tags)) {
            setPopularTags(data.tags);
          }
        }
      } catch {}
    }
    loadPopular();
    return () => {
      mounted = false;
    };
  }, [category]);

  // Baseline tracker for unsaved changes bar (stores normalized object)
  const baseline = useRef<any>(null);

  // Synchronized current form snapshot
  const currentSnapshot = useMemo(() => {
    return normalizePromoteValues({
      isListed,
      category,
      summary,
      description,
      tags,
      language,
      bannerUrl,
      inviteUrl,
      joinCode,
      offerHigherReward,
      extraCreditsPerJoin,
      bountyCoins,
      recruitRepresentatives,
      representativesWanted,
      creditsPerRecruit,
      approveManually,
      retentionTargetHours,
      recruitLogChannelId,
      repRoleId,
      recruitRoleId,
      openForPartnerships,
      partnershipMinMembers,
      partnershipPrice,
      partnershipAllowedMentions,
      partnershipHerePrice,
      partnershipEveryonePrice,
      partnershipBroadcastChannel,
      partnershipAcceptedCategories,
      partnershipDailyLimit,
    });
  }, [
    isListed,
    category,
    summary,
    description,
    tags,
    language,
    bannerUrl,
    inviteUrl,
    joinCode,
    offerHigherReward,
    extraCreditsPerJoin,
    bountyCoins,
    recruitRepresentatives,
    representativesWanted,
    creditsPerRecruit,
    approveManually,
    retentionTargetHours,
    recruitLogChannelId,
    repRoleId,
    recruitRoleId,
    openForPartnerships,
    partnershipMinMembers,
    partnershipPrice,
    partnershipAllowedMentions,
    partnershipHerePrice,
    partnershipEveryonePrice,
    partnershipBroadcastChannel,
    partnershipAcceptedCategories,
    partnershipDailyLimit,
  ]);

  if (!baseline.current) {
    baseline.current = currentSnapshot;
  }

  // Track initial sync from server config if it arrives asynchronously after mount
  const isInitialized = useRef(false);
  useEffect(() => {
    if (!config || isInitialized.current) return;
    isInitialized.current = true;
    const initialNorm = normalizePromoteValues(config);
    setIsListed(initialNorm.isListed);
    setCategory(initialNorm.category);
    setSummary(initialNorm.summary);
    setDescription(initialNorm.description);
    setTags(initialNorm.tags);
    setLanguage(initialNorm.language);
    setBannerUrl(initialNorm.bannerUrl);
    setInviteUrl(initialNorm.inviteUrl);
    setJoinCode(initialNorm.joinCode);
    setOfferHigherReward(initialNorm.offerHigherReward);
    setExtraCreditsPerJoin(initialNorm.extraCreditsPerJoin);
    setBountyCoins(initialNorm.bountyCoins);
    setRecruitRepresentatives(initialNorm.recruitRepresentatives);
    setRepresentativesWanted(initialNorm.representativesWanted);
    setCreditsPerRecruit(initialNorm.creditsPerRecruit);
    setApproveManually(initialNorm.approveManually);
    setRetentionTargetHours(initialNorm.retentionTargetHours);
    setRecruitLogChannelId(initialNorm.recruitLogChannelId);
    setRepRoleId(initialNorm.repRoleId);
    setRecruitRoleId(initialNorm.recruitRoleId);
    setOpenForPartnerships(initialNorm.openForPartnerships);
    setPartnershipMinMembers(initialNorm.partnershipMinMembers);
    setPartnershipPrice(initialNorm.partnershipPrice);
    setPartnershipAllowedMentions(initialNorm.partnershipAllowedMentions);
    setPartnershipHerePrice(initialNorm.partnershipHerePrice);
    setPartnershipEveryonePrice(initialNorm.partnershipEveryonePrice);
    setPartnershipBroadcastChannel(initialNorm.partnershipBroadcastChannel);
    setPartnershipAcceptedCategories(initialNorm.partnershipAcceptedCategories);
    setPartnershipDailyLimit(initialNorm.partnershipDailyLimit);
    baseline.current = initialNorm;
  }, [config]);

  // Fetch real listing data from backend /api/servers/:guildId on mount so user's existing info is displayed
  useEffect(() => {
    let active = true;
    async function fetchServerListing() {
      try {
        const res = await fetch(`/api/servers/${guildId}`);
        if (!res.ok) return;
        const data = await res.json();
        const s = data.server;
        if (!s || !active) return;

        const initialNorm = normalizePromoteValues(s);
        setIsListed(initialNorm.isListed);
        setCategory(initialNorm.category);
        setSummary(initialNorm.summary);
        setDescription(initialNorm.description);
        setTags(initialNorm.tags);
        setLanguage(initialNorm.language);
        setBannerUrl(initialNorm.bannerUrl);
        setInviteUrl(initialNorm.inviteUrl);
        setJoinCode(initialNorm.joinCode);
        setOfferHigherReward(initialNorm.offerHigherReward);
        setExtraCreditsPerJoin(initialNorm.extraCreditsPerJoin);
        setBountyCoins(initialNorm.bountyCoins);
        setRecruitRepresentatives(initialNorm.recruitRepresentatives);
        setRepresentativesWanted(initialNorm.representativesWanted);
        setCreditsPerRecruit(initialNorm.creditsPerRecruit);
        setApproveManually(initialNorm.approveManually);
        setRetentionTargetHours(initialNorm.retentionTargetHours);
        setRecruitLogChannelId(initialNorm.recruitLogChannelId);
        setRepRoleId(initialNorm.repRoleId);
        setRecruitRoleId(initialNorm.recruitRoleId);
        setOpenForPartnerships(initialNorm.openForPartnerships);
        setPartnershipMinMembers(initialNorm.partnershipMinMembers);
        setPartnershipPrice(initialNorm.partnershipPrice);
        setPartnershipAllowedMentions(initialNorm.partnershipAllowedMentions);
        setPartnershipHerePrice(initialNorm.partnershipHerePrice);
        setPartnershipEveryonePrice(initialNorm.partnershipEveryonePrice);
        setPartnershipBroadcastChannel(initialNorm.partnershipBroadcastChannel);
        setPartnershipAcceptedCategories(initialNorm.partnershipAcceptedCategories);
        setPartnershipDailyLimit(initialNorm.partnershipDailyLimit);
        baseline.current = initialNorm;

        // Fetch active reps count for turn-off confirmation
        try {
          const recRes = await fetch(`/api/servers/${guildId}/recruits/summary`);
          if (recRes.ok) {
            const recData = await recRes.json();
            if (active && recData?.summary?.representatives) {
              setActiveRepsCount(recData.summary.representatives.length);
            }
          }
        } catch {}
      } catch (err) {
        console.warn('[PromoteTab] Could not fetch server listing data:', err);
      }
    }
    fetchServerListing();
    return () => { active = false; };
  }, [guildId]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(currentSnapshot) !== JSON.stringify(baseline.current);
  }, [currentSnapshot]);

  const FIELD_DEFINITIONS: Record<string, { label: string; section: string }> = {
    isListed: { label: 'Directory listing status', section: 'Listing' },
    category: { label: 'Category', section: 'Listing' },
    summary: { label: 'Short summary', section: 'Listing' },
    description: { label: 'Full description', section: 'Listing' },
    tags: { label: 'Tags', section: 'Listing' },
    language: { label: 'Language', section: 'Listing' },
    bannerUrl: { label: 'Banner URL', section: 'Appearance' },
    inviteUrl: { label: 'Invite link', section: 'Invite and rewards' },
    joinCode: { label: 'ER:LC join code', section: 'Invite and rewards' },
    offerHigherReward: { label: 'Offer higher reward', section: 'Invite and rewards' },
    extraCreditsPerJoin: { label: 'Extra credits per join', section: 'Invite and rewards' },
    bountyCoins: { label: 'Credits per verified join', section: 'Invite and rewards' },
    recruitRepresentatives: { label: 'Recruit representatives', section: 'Invite and rewards' },
    representativesWanted: { label: 'Representatives wanted', section: 'Invite and rewards' },
    creditsPerRecruit: { label: 'Credits per recruit', section: 'Invite and rewards' },
    approveManually: { label: 'Approve manually', section: 'Invite and rewards' },
    retentionTargetHours: { label: 'Minimum stay', section: 'Invite and rewards' },
    recruitLogChannelId: { label: 'Log channel', section: 'Invite and rewards' },
    repRoleId: { label: 'Representative role', section: 'Invite and rewards' },
    recruitRoleId: { label: 'Recruit role', section: 'Invite and rewards' },
    openForPartnerships: { label: 'Partnership status', section: 'Partnerships' },
    partnershipMinMembers: { label: 'Minimum members', section: 'Partnerships' },
    partnershipPrice: { label: 'Partnership price', section: 'Partnerships' },
    partnershipAllowedMentions: { label: 'Allowed mentions', section: 'Partnerships' },
    partnershipHerePrice: { label: '@here fee', section: 'Partnerships' },
    partnershipEveryonePrice: { label: '@everyone fee', section: 'Partnerships' },
    partnershipBroadcastChannel: { label: 'Broadcast channel', section: 'Partnerships' },
    partnershipAcceptedCategories: { label: 'Accepted categories', section: 'Partnerships' },
    partnershipDailyLimit: { label: 'Daily broadcast limit', section: 'Partnerships' },
  };

  const { dirtySections, changedFields } = useMemo(() => {
    const cur = currentSnapshot;
    const base = baseline.current;
    if (!base) return { dirtySections: [], changedFields: [] };
    const sSet = new Set<string>();
    const fList: string[] = [];

    for (const [key, meta] of Object.entries(FIELD_DEFINITIONS)) {
      const cVal = JSON.stringify((cur as any)[key]);
      const bVal = JSON.stringify((base as any)[key]);
      if (cVal !== bVal) {
        sSet.add(meta.section);
        fList.push(meta.label);
      }
    }
    return {
      dirtySections: Array.from(sSet),
      changedFields: fList,
    };
  }, [currentSnapshot]);

  // Fetch ER:LC status on mount / guild change
  useEffect(() => {
    let isMounted = true;
    async function fetchErlc() {
      try {
        const res = await fetch(`/api/servers/${guildId}/erlc/status`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.connected) {
            setErlcData(data);
            if (data.joinCode && !joinCode) {
              setJoinCode(data.joinCode);
            }
          }
        }
      } catch {}
    }
    fetchErlc();
    return () => { isMounted = false; };
  }, [guildId]);

  const handleConnectErlc = async () => {
    if (!erlcKeyInput.trim()) return;
    setIsConnectingErlc(true);
    try {
      const res = await fetch(`/api/servers/${guildId}/erlc/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: erlcKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not connect ER:LC server.');
      setErlcData(data);
      if (data.joinCode) {
        setJoinCode(data.joinCode);
        syncUpdates({ joinCode: data.joinCode });
      }
      setErlcKeyInput('');
      addToast('success', 'ER:LC connected', `Connected to ${data.name || 'private server'}.`);
    } catch (err: any) {
      addToast('error', 'Connection failed', err.message || 'Check your ER:LC key and try again.');
    } finally {
      setIsConnectingErlc(false);
    }
  };

  const handleTestErlc = async () => {
    setIsTestingErlc(true);
    try {
      const res = await fetch(`/api/servers/${guildId}/erlc/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed.');
      setErlcData((prev) => ({
        ...prev,
        currentPlayers: data.currentPlayers,
        maxPlayers: data.maxPlayers,
        lastCheckedAt: new Date().toISOString(),
      }));
      addToast('success', 'ER:LC online', data.message || `Connected to ${data.name} (${data.currentPlayers} / ${data.maxPlayers} players online)`);
    } catch (err: any) {
      addToast('error', 'Test error', err.message || 'Could not reach ER:LC API.');
    } finally {
      setIsTestingErlc(false);
    }
  };

  const handleRefreshErlc = async () => {
    setIsRefreshingErlc(true);
    try {
      const res = await fetch(`/api/servers/${guildId}/erlc/status?refresh=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refresh failed.');
      setErlcData(data);
      addToast('info', 'Status refreshed', 'ER:LC server status updated.');
    } catch (err: any) {
      addToast('error', 'Refresh error', err.message || 'Could not refresh status.');
    } finally {
      setIsRefreshingErlc(false);
    }
  };

  const handleDisconnectErlc = async () => {
    try {
      const res = await fetch(`/api/servers/${guildId}/erlc/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Could not disconnect.');
      }
      setErlcData({ connected: false });
      setShowDisconnectDialog(false);
      addToast('info', 'ER:LC disconnected', 'Live player count removed from listing.');
    } catch (err: any) {
      addToast('error', 'Disconnect error', err.message || 'Failed to disconnect.');
    }
  };

  // Completion gate computation (Phase D)
  const step1Done = Boolean(category && safeStr(summary).length >= 10 && safeStr(description).length >= 20);
  const step1Partial = !step1Done && Boolean(category || safeStr(summary).length > 0 || safeStr(description).length > 0);

  const step2Done = Boolean(safeStr(bannerUrl).length > 0);
  const step2Partial = false;

  const step3Done = Boolean(safeStr(inviteUrl).length > 0);
  const step3Partial = false;

  const completedSteps = (step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step3Done ? 1 : 0);
  const canBeListed = completedSteps === 3;

  // Sync state to parent config onChange
  const syncUpdates = useCallback(
    (patch: any) => {
      onChangeConfig(patch);
    },
    [onChangeConfig]
  );

  const validateTag = (tag: string): string | null => {
    const clean = tag.trim().toLowerCase().replace(/^#/, '');
    if (!/^[a-z0-9-]{2,20}$/.test(clean)) return null;
    return clean;
  };

  // Handle Tag Input
  const handleAddTag = (val: string) => {
    const clean = validateTag(val);
    if (!clean || tags.includes(clean) || tags.length >= 5) return;
    const updated = [...tags, clean];
    setTags(updated);
    setTagInput('');
    syncUpdates({ serverTags: updated });
  };

  const handlePasteTags = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text');
    const parts = paste.split(/[\s,]+/);
    let nextTags = [...tags];
    for (const part of parts) {
      const clean = validateTag(part);
      if (clean && !nextTags.includes(clean) && nextTags.length < 5) {
        nextTags.push(clean);
      }
    }
    setTags(nextTags);
    setTagInput('');
    syncUpdates({ serverTags: nextTags });
  };

  const handleRemoveTag = (t: string) => {
    const updated = tags.filter((item) => item !== t);
    setTags(updated);
    syncUpdates({ serverTags: updated });
  };

  // Banner file selection and crop
  const handleBannerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast('error', 'File too large', 'Banner image must be under 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setIsCropping(true);
      setZoom(1);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const createCroppedImage = useCallback(async () => {
    if (!cropImage || !croppedAreaPixels) return;

    try {
      const img = new Image();
      img.src = cropImage;
      await new Promise((res) => {
        img.onload = res;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1500;
      canvas.height = 500;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        1500,
        500
      );

      const base64 = canvas.toDataURL('image/webp', 0.9);
      setBannerUrl(base64);
      syncUpdates({ bannerUrl: base64 });
      setIsCropping(false);
      setCropImage(null);
      addToast('success', 'Banner updated', 'Your 3:1 banner has been applied.');
    } catch {
      addToast('error', 'Crop failed', 'Could not process cropped banner.');
    }
  }, [cropImage, croppedAreaPixels, syncUpdates, addToast]);

  // Invite URL check
  const handleCheckInvite = async () => {
    if (!safeStr(inviteUrl)) return;
    setInviteStatus('checking');

    // Auto-prepend https:// if missing
    let clean = safeStr(inviteUrl);
    if (clean.startsWith('discord.gg/')) {
      clean = `https://${clean}`;
      setInviteUrl(clean);
    }

    try {
      // Direct validation
      if (clean.includes('discord.gg/') || clean.includes('discord.com/invite/')) {
        setInviteStatus('valid');
        addToast('success', 'Invite works', 'Permanent Discord invite is valid.');
      } else {
        setInviteStatus('invalid');
        addToast('warning', 'Invalid invite', 'Invite should be a discord.gg link.');
      }
    } catch {
      setInviteStatus('invalid');
    }
  };

  // Save changes handler (Calls PUT /api/servers/:id/listing and onSaveConfig)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Auto-format invite if needed
      let cleanInvite = safeStr(inviteUrl);
      if (cleanInvite && !cleanInvite.startsWith('http://') && !cleanInvite.startsWith('https://')) {
        cleanInvite = `https://${cleanInvite}`;
        setInviteUrl(cleanInvite);
      }

      const payload = {
        name: serverName,
        category,
        summary: safeStr(summary),
        description: safeStr(description),
        tags,
        language,
        bannerUrl: safeStr(bannerUrl),
        inviteUrl: cleanInvite,
        joinCode: safeStr(joinCode) || null,
        rewardCoins: bountyCoins,
        listedInDirectory: isListed,
        offerHigherReward,
        extraCreditsPerJoin,
        retentionTargetHours,
        recruitRepresentatives,
        representativesWanted,
        creditsPerRecruit,
        approveManually,
        recruitLogChannelId: safeStr(recruitLogChannelId) || null,
        repRoleId: safeStr(repRoleId) || null,
        recruitRoleId: safeStr(recruitRoleId) || null,
        openForPartnerships,
        partnershipMinMembers,
        partnershipPrice,
        partnershipAllowedMentions,
        partnershipHerePrice,
        partnershipEveryonePrice,
        partnershipBroadcastChannel: safeStr(partnershipBroadcastChannel) || null,
        partnershipAcceptedCategories,
        partnershipDailyLimit,
      };

      const resData = await api<any>(`/servers/${guildId}/listing`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const savedServer = resData.server || {};

      const savedNorm = normalizePromoteValues({
        ...payload,
        ...savedServer,
      });

      // Keep local state firmly synced with normalized saved data
      setIsListed(savedNorm.isListed);
      setCategory(savedNorm.category);
      setSummary(savedNorm.summary);
      setDescription(savedNorm.description);
      setTags(savedNorm.tags);
      setLanguage(savedNorm.language);
      setBannerUrl(savedNorm.bannerUrl);
      setInviteUrl(savedNorm.inviteUrl);
      setJoinCode(savedNorm.joinCode);
      setBountyCoins(savedNorm.bountyCoins);
      setOfferHigherReward(savedNorm.offerHigherReward);
      setExtraCreditsPerJoin(savedNorm.extraCreditsPerJoin);
      setRetentionTargetHours(savedNorm.retentionTargetHours);
      setRecruitRepresentatives(savedNorm.recruitRepresentatives);
      setRepresentativesWanted(savedNorm.representativesWanted);
      setCreditsPerRecruit(savedNorm.creditsPerRecruit);
      setApproveManually(savedNorm.approveManually);
      setRecruitLogChannelId(savedNorm.recruitLogChannelId);
      setRepRoleId(savedNorm.repRoleId);
      setRecruitRoleId(savedNorm.recruitRoleId);
      setOpenForPartnerships(savedNorm.openForPartnerships);
      setPartnershipMinMembers(savedNorm.partnershipMinMembers);
      setPartnershipPrice(savedNorm.partnershipPrice);
      setPartnershipAllowedMentions(savedNorm.partnershipAllowedMentions);
      setPartnershipHerePrice(savedNorm.partnershipHerePrice);
      setPartnershipEveryonePrice(savedNorm.partnershipEveryonePrice);
      setPartnershipBroadcastChannel(savedNorm.partnershipBroadcastChannel);
      setPartnershipAcceptedCategories(savedNorm.partnershipAcceptedCategories);
      setPartnershipDailyLimit(savedNorm.partnershipDailyLimit);

      // Baseline updated to exact same normalized object
      baseline.current = savedNorm;

      // Keep parent config in sync
      onChangeConfig({
        serverCategory: savedNorm.category,
        serverSummary: savedNorm.summary,
        serverDescription: savedNorm.description,
        serverTags: savedNorm.tags,
        bannerUrl: savedNorm.bannerUrl,
        discordInvite: savedNorm.inviteUrl,
        inviteUrl: savedNorm.inviteUrl,
        joinCode: savedNorm.joinCode,
        listedInDirectory: savedNorm.isListed,
      });

      try {
        localStorage.setItem(`server_promoted_listing_${guildId}`, JSON.stringify(savedNorm));
      } catch {}

      addToast('success', 'Listing saved', 'Your community directory profile has been updated.');
    } catch (err: any) {
      addToast('error', 'Save error', err.message || 'Could not save listing.');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && !isSaving) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hasUnsavedChanges, isSaving]);

  // Reset unsaved changes
  const handleReset = () => {
    try {
      const b = baseline.current;
      setIsListed(b.isListed);
      setCategory(b.category);
      setSummary(b.summary);
      setDescription(b.description);
      setTags(b.tags);
      setLanguage(b.language);
      setBannerUrl(b.bannerUrl);
      setInviteUrl(b.inviteUrl);
      setJoinCode(b.joinCode);
      setBountyCoins(b.bountyCoins);
      setOfferHigherReward(b.offerHigherReward ?? false);
      setRetentionTargetHours(b.retentionTargetHours ?? 72);
      setRepresentativesWanted(b.representativesWanted ?? 4);
      setOpenForPartnerships(b.openForPartnerships ?? true);
      setPartnershipMinMembers(b.partnershipMinMembers ?? 5);
      setPartnershipPrice(b.partnershipPrice ?? 0);
      setPartnershipAllowedMentions(b.partnershipAllowedMentions ?? 'here');
      setPartnershipHerePrice(b.partnershipHerePrice ?? 15);
      setPartnershipEveryonePrice(b.partnershipEveryonePrice ?? 30);
      setPartnershipBroadcastChannel(b.partnershipBroadcastChannel ?? '');
      setPartnershipAcceptedCategories(b.partnershipAcceptedCategories ?? ['Design Server', 'Roleplay Server', 'Misc', 'COTS', 'Departments', 'Events']);
      setPartnershipDailyLimit(b.partnershipDailyLimit ?? 1);
      addToast('info', 'Changes discarded', 'Reverted to last saved listing.');
    } catch {}
  };

  // Register with single global dirty form store
  useRegisterDirtyForm({
    id: `promote-${guildId}`,
    isDirty: hasUnsavedChanges,
    onSave: handleSave,
    onReset: handleReset,
    isSaving,
    sections: dirtySections,
    changedFields,
  });

  // Resolve current preview card data
  const serverIconUrl = guild?.iconUrl || (guild?.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null);
  const currentPreviewData: DirectoryServerData = useMemo(() => {
    return {
      id: guildId,
      name: serverName,
      icon: serverIconUrl,
      iconHash: guild?.icon,
      category,
      summary: stripMarkdown(safeStr(summary)),
      description: safeStr(description),
      tags,
      bannerUrl: safeStr(bannerUrl),
      memberCount: guild?.memberCount || 0,
      verified: true,
      inviteUrl: safeStr(inviteUrl),
      erlc: erlcData.connected ? erlcData : null,
    };
  }, [guildId, serverName, serverIconUrl, guild?.icon, category, summary, description, tags, bannerUrl, guild?.memberCount, inviteUrl, erlcData]);

  const activeCategoryObj = CATEGORY_OPTIONS.find((c) => c.id === category) || CATEGORY_OPTIONS[0];

  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto pb-24 font-sans">
      {/* ── HEADER ROW: Title + Subtitle + Listed/Unlisted Switch ───── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold text-[#F4F4F5] tracking-normal font-sans">
            Promote server
          </h1>
          <p className="text-[14px] text-[#A1A1AA] font-sans">
            Choose how your server appears in the directory.
          </p>
        </div>

        {/* Listed / Unlisted Switch with Completion Gate */}
        <div className="flex items-center gap-3 p-2 rounded-[12px] bg-[#0E0E11] border border-[rgba(255,255,255,0.07)] self-start sm:self-auto">
          <span className="text-[13px] font-medium text-[#A1A1AA] font-sans">
            {isListed ? 'Listed' : 'Unlisted'}
          </span>
          <Switch
            checked={isListed}
            onCheckedChange={(checked) => {
              if (checked && !canBeListed) {
                setGateDialogOpen(true);
                return;
              }
              setIsListed(checked);
              syncUpdates({ listedInDirectory: checked });
            }}
          />
        </div>
      </div>

      {/* ── SEGMENTED TABS: Listing | Appearance | Invite and rewards | Partnerships ── */}
      <div className="space-y-3">
        <div className="inline-flex items-center rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#141417] p-1 flex-wrap gap-1">
          {[
            { id: 'listing' as const, label: 'Listing', icon: Globe, status: step1Done ? 'done' : step1Partial ? 'partial' : 'empty' },
            { id: 'appearance' as const, label: 'Appearance', icon: ImageIcon, status: step2Done ? 'done' : 'empty' },
            { id: 'rewards' as const, label: 'Invite and rewards', icon: LinkIcon, status: step3Done ? 'done' : 'empty' },
            { id: 'partnerships' as const, label: 'Partnerships', icon: Handshake, optional: true },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer font-sans',
                  isActive
                    ? 'bg-[#0E0E11] text-[#F4F4F5] shadow-xs'
                    : 'text-[#71717A] hover:text-[#A1A1AA]'
                )}
              >
                <Icon className={cn('size-4', isActive ? 'text-[var(--accent)]' : 'text-[#71717A]')} />
                <span>{t.label}</span>
                {t.optional ? (
                  <span className="text-[11px] text-[#71717A] font-normal">(optional)</span>
                ) : (
                  t.status !== 'done' && (
                    <span className="size-1.5 rounded-full bg-[#FBBF24] ml-0.5 shrink-0" />
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT GRID: 880px Form Column + 280px Sticky Preview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-8 items-start">
        {/* Left Form Column (max-w-[880px]) */}
        <div className="space-y-6 min-w-0 max-w-[880px]">
          {/* ── TAB 1: LISTING ────────────────────────────────────────── */}
          {activeTab === 'listing' && (
            <div className="space-y-6">
              {/* Category card (clean 3-col grid of 6 cards) */}
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                    Category
                  </h2>
                  <p className="text-[13px] text-[#A1A1AA] font-sans">
                    Choose the primary community category for your server.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const isSelected = category === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setCategory(opt.id);
                          syncUpdates({ serverCategory: opt.id });
                        }}
                        className={cn(
                          'flex items-start gap-3 p-3.5 rounded-[12px] text-left transition-all cursor-pointer border select-none',
                          isSelected
                            ? 'border-[rgba(255,255,255,0.35)] bg-[#19191D]'
                            : 'border-[rgba(255,255,255,0.07)] bg-[#141417] hover:bg-[#19191D]'
                        )}
                      >
                        <div
                          className={cn(
                            'p-2 rounded-[8px] shrink-0',
                            isSelected ? 'bg-[#21232B] text-white' : 'bg-[#0E0E11] text-[#A1A1AA]'
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[14px] font-medium text-[#F4F4F5] truncate font-sans">
                              {opt.name}
                            </span>
                            {isSelected && <Check className="size-3.5 text-white shrink-0 ml-1" />}
                          </div>
                          <p className="text-[12px] text-[#A1A1AA] line-clamp-1 font-sans">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Optional smart hint for category */}
                {activeCategoryObj.hint && (
                  <div className="p-3.5 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] text-[13px] text-[#A1A1AA] flex items-center gap-2 font-sans">
                    <Sparkles className="size-4 text-[var(--accent)] shrink-0" />
                    <span>{activeCategoryObj.hint}</span>
                  </div>
                )}
              </div>

              {/* Summary & Description */}
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                    Description & Summary
                  </h2>
                  <p className="text-[13px] text-[#A1A1AA] font-sans">
                    Introduce your community to prospective members.
                  </p>
                </div>

                {/* Short summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <label className="font-medium text-[#F4F4F5] font-sans">
                      Short summary
                    </label>
                    <span className="text-[12px] text-[#71717A] tabular-nums font-sans">
                      {summary.length} / 120
                    </span>
                  </div>
                  <Input
                    value={summary}
                    maxLength={120}
                    onChange={(e) => {
                      setSummary(e.target.value);
                      syncUpdates({ serverSummary: e.target.value });
                    }}
                    placeholder="One clear sentence highlighting what makes your server unique…"
                    className="h-10 text-[13px] bg-[#141417] border-[rgba(255,255,255,0.07)] font-sans"
                  />
                </div>

                {/* Full description with Markdown Editor Toolbar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2">
                      <label className="font-medium text-[#F4F4F5] font-sans">
                        Full description
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowHelpPopover(!showHelpPopover)}
                        className="text-[12px] text-[#71717A] hover:text-[#A1A1AA] underline underline-offset-2 transition-colors cursor-pointer"
                      >
                        Formatting help
                      </button>
                    </div>
                    <span className="text-[12px] text-[#71717A] tabular-nums font-sans">
                      {description.length} / 1000
                    </span>
                  </div>

                  {/* Formatting Help Popover */}
                  {showHelpPopover && (
                    <div className="p-3.5 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.08)] text-[12px] space-y-2 text-[#D4D4D8] font-sans">
                      <div className="flex items-center justify-between font-semibold text-[#F4F4F5]">
                        <span>Discord markdown reference</span>
                        <button
                          type="button"
                          onClick={() => setShowHelpPopover(false)}
                          className="text-[#71717A] hover:text-[#F4F4F5] p-0.5 cursor-pointer"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
                        <div><code className="text-[var(--accent)]">**bold**</code> &rarr; <strong>bold</strong></div>
                        <div><code className="text-[var(--accent)]">*italic*</code> &rarr; <em>italic</em></div>
                        <div><code className="text-[var(--accent)]">__underline__</code> &rarr; <u>underline</u></div>
                        <div><code className="text-[var(--accent)]">~~strike~~</code> &rarr; <del>strike</del></div>
                        <div><code className="text-[var(--accent)]">`code`</code> &rarr; inline code</div>
                        <div><code className="text-[var(--accent)]">&gt; quote</code> &rarr; quote</div>
                        <div><code className="text-[var(--accent)]">- item</code> &rarr; bullet list</div>
                        <div><code className="text-[var(--accent)]">||spoiler||</code> &rarr; spoiler</div>
                        <div className="col-span-2"><code className="text-[var(--accent)]">[link](https://...)</code> &rarr; hyperlink</div>
                      </div>
                    </div>
                  )}

                  {/* Toolbar & Switch Header */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-t-[10px] bg-[#141417] border border-b-0 border-[rgba(255,255,255,0.07)]">
                    {/* Left: Quick Actions Toolbar */}
                    <div className="flex items-center gap-0.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => applyMarkdown('**', '**', 'bold text')}
                        title="Bold (Ctrl+B)"
                        className="size-7 rounded-[6px] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1F1F24] transition-colors cursor-pointer"
                      >
                        <Bold className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdown('*', '*', 'italic text')}
                        title="Italic (Ctrl+I)"
                        className="size-7 rounded-[6px] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1F1F24] transition-colors cursor-pointer"
                      >
                        <Italic className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdown('~~', '~~', 'strikethrough text')}
                        title="Strikethrough"
                        className="size-7 rounded-[6px] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1F1F24] transition-colors cursor-pointer"
                      >
                        <Strikethrough className="size-3.5" />
                      </button>
                      <div className="w-[1px] h-4 bg-[rgba(255,255,255,0.08)] mx-1" />
                      <button
                        type="button"
                        onClick={() => applyMarkdown('`', '`', 'code')}
                        title="Inline code"
                        className="size-7 rounded-[6px] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1F1F24] transition-colors cursor-pointer"
                      >
                        <Code className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdown('> ', '', 'quoted message')}
                        title="Quote"
                        className="size-7 rounded-[6px] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1F1F24] transition-colors cursor-pointer"
                      >
                        <Quote className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdown('- ', '', 'list item')}
                        title="Bullet list"
                        className="size-7 rounded-[6px] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1F1F24] transition-colors cursor-pointer"
                      >
                        <List className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarkdown('[', '](https://example.com)', 'link text')}
                        title="Hyperlink"
                        className="size-7 rounded-[6px] flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1F1F24] transition-colors cursor-pointer"
                      >
                        <LinkIcon className="size-3.5" />
                      </button>
                    </div>

                    {/* Right: Segmented Switch Write | Preview */}
                    <div className="flex items-center rounded-[8px] bg-[#0E0E11] p-0.5 border border-[rgba(255,255,255,0.06)] text-[12px]">
                      <button
                        type="button"
                        onClick={() => setDescTab('write')}
                        className={cn(
                          'px-2.5 py-1 rounded-[6px] font-medium transition-colors cursor-pointer',
                          descTab === 'write' ? 'bg-[#19191D] text-[#F4F4F5] shadow-sm' : 'text-[#71717A] hover:text-[#A1A1AA]'
                        )}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescTab('preview')}
                        className={cn(
                          'px-2.5 py-1 rounded-[6px] font-medium transition-colors cursor-pointer',
                          descTab === 'preview' ? 'bg-[#19191D] text-[#F4F4F5] shadow-sm' : 'text-[#71717A] hover:text-[#A1A1AA]'
                        )}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  {descTab === 'write' ? (
                    <textarea
                      ref={descriptionRef}
                      value={description}
                      maxLength={1000}
                      rows={6}
                      onKeyDown={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          if (e.key.toLowerCase() === 'b') {
                            e.preventDefault();
                            applyMarkdown('**', '**', 'bold text');
                          } else if (e.key.toLowerCase() === 'i') {
                            e.preventDefault();
                            applyMarkdown('*', '*', 'italic text');
                          }
                        }
                      }}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        syncUpdates({ serverDescription: e.target.value });
                      }}
                      placeholder="Provide detailed info about your patrols, custom vehicles, rules, department openings, and shift schedules…"
                      className="w-full min-h-[160px] rounded-b-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] p-3 text-[13px] text-[#F4F4F5] placeholder-[#71717A] focus:outline-hidden focus:border-[var(--accent)] resize-y font-sans"
                    />
                  ) : (
                    <div className="w-full min-h-[160px] rounded-b-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] p-4">
                      {description.trim() ? (
                        <MarkdownRenderer content={description} />
                      ) : (
                        <p className="text-[13px] text-[#71717A] italic font-sans">
                          No description entered yet. Switch back to Write to add one.
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-[12px] text-[#71717A] font-sans">
                    Supports Discord-style markdown.
                  </p>
                  {description.length > 0 && description.length < 40 && (
                    <p className="text-[12px] text-[#FBBF24] font-sans">
                      Tip: Descriptions with 40+ characters receive significantly higher conversion.
                    </p>
                  )}
                </div>
              </div>

              {/* Tags & Language */}
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                    Tags & Language
                  </h2>
                  <p className="text-[13px] text-[#A1A1AA] font-sans">
                    Help users find your server through search and category tags.
                  </p>
                </div>

                {/* Tags input: Single field container with chips inside */}
                <div className="space-y-2.5">
                  <label className="text-[13px] font-medium text-[#F4F4F5] font-sans block">
                    Tags
                  </label>

                  <div className="min-h-11 rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[#141417] p-2 flex items-center flex-wrap gap-1.5 focus-within:border-[var(--accent)] transition-colors">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#19191D] border border-[rgba(255,255,255,0.1)] text-[13px] text-[#F4F4F5] font-sans"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="text-[#71717A] hover:text-[#F87171] cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}

                    {tags.length < 5 && (
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
                            e.preventDefault();
                            handleAddTag(tagInput);
                          } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                            handleRemoveTag(tags[tags.length - 1]);
                          }
                        }}
                        onPaste={handlePasteTags}
                        placeholder={tags.length === 0 ? 'Type tag and press Enter...' : 'Add tag...'}
                        className="bg-transparent text-[13px] text-[#F4F4F5] placeholder:text-[#71717A] outline-none border-none flex-1 min-w-[120px] px-1 py-0.5 font-sans"
                      />
                    )}

                    <span className="text-[12px] text-[#71717A] ml-auto shrink-0 pr-1 tabular-nums font-sans select-none">
                      {tags.length} / 5
                    </span>
                  </div>

                  {/* Popular tags row below from GET /api/tags/popular */}
                  {popularTags.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1.5 pt-1">
                      <span className="text-[12px] text-[#71717A] mr-1 font-sans">Popular:</span>
                      {popularTags.map((pt) => {
                        const isAdded = tags.includes(pt.toLowerCase());
                        return (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => handleAddTag(pt)}
                            disabled={isAdded || tags.length >= 5}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#141417] hover:bg-[#19191D] border border-[rgba(255,255,255,0.07)] text-[11px] text-[#A1A1AA] hover:text-white disabled:opacity-40 cursor-pointer font-sans transition-colors"
                          >
                            <span>+{pt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Language Select */}
                <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.07)]">
                  <label className="text-[13px] font-medium text-[#F4F4F5] font-sans">
                    Language
                  </label>
                  <Select value={language} onValueChange={(v) => {
                    setLanguage(v);
                    syncUpdates({ language: v } as any);
                  }}>
                    <SelectTrigger className="h-10 bg-[#141417] border-[rgba(255,255,255,0.07)] text-[13px] font-sans">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Spanish">Spanish</SelectItem>
                      <SelectItem value="French">French</SelectItem>
                      <SelectItem value="German">German</SelectItem>
                      <SelectItem value="Portuguese">Portuguese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: APPEARANCE ─────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Server Icon Card */}
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                    Server icon
                  </h2>
                  <p className="text-[13px] text-[#A1A1AA] font-sans">
                    Read directly from your Discord server configuration.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {serverIconUrl ? (
                    <img
                      src={serverIconUrl}
                      alt={serverName}
                      className="size-16 rounded-[12px] object-cover bg-[#141417] border border-[rgba(255,255,255,0.07)]"
                    />
                  ) : (
                    <div className="size-16 rounded-[12px] bg-[#141417] border border-[rgba(255,255,255,0.07)] flex items-center justify-center font-semibold text-lg text-[#F4F4F5] font-sans">
                      {serverName.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => addToast('info', 'Icon synced', 'Checked latest icon from Discord API.')}
                    >
                      <RefreshCw className="size-3.5 mr-1.5" />
                      Refresh from Discord
                    </Button>
                    <p className="text-[12px] text-[#71717A] font-sans">
                      To change your icon, update it in your Discord Server Settings.
                    </p>
                  </div>
                </div>
              </div>

              {/* Banner Upload & Cropper Card */}
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                    Server banner
                  </h2>
                  <p className="text-[13px] text-[#A1A1AA] font-sans">
                    Aspect ratio 3:1 (1500 x 500 px). PNG, JPG or WebP up to 2 MB.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleBannerFileSelect}
                />

                {bannerUrl ? (
                  <div className="space-y-3">
                    <div className="relative aspect-[3/1] w-full rounded-[12px] overflow-hidden border border-[rgba(255,255,255,0.07)] bg-[#141417]">
                      <img
                        src={bannerUrl}
                        alt="Banner"
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-3.5 mr-1.5" />
                        Replace banner
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setBannerUrl('');
                          syncUpdates({ bannerUrl: '' });
                          addToast('info', 'Banner removed', 'Default gradient will be used.');
                        }}
                      >
                        Remove banner
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[3/1] w-full rounded-[12px] border-2 border-dashed border-[rgba(255,255,255,0.07)] hover:border-[var(--accent)]/50 bg-[#141417]/50 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors"
                  >
                    <Upload className="size-6 text-[#71717A] mb-2" />
                    <span className="text-[13px] font-medium text-[#F4F4F5] font-sans">
                      Click to upload banner image
                    </span>
                    <span className="text-[12px] text-[#71717A] mt-1 font-sans">
                      Locked to 3:1 ratio (1500 × 500 px)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: INVITE AND REWARDS ─────────────────────────────── */}
          {activeTab === 'rewards' && (
            <div className="space-y-6">
              {/* Permanent Invite Card */}
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                    Discord invite URL
                  </h2>
                  <p className="text-[13px] text-[#A1A1AA] font-sans">
                    A permanent, non-expiring invite link used by directory visitors.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={inviteUrl}
                      onChange={(e) => {
                        setInviteUrl(e.target.value);
                        setInviteStatus('idle');
                        syncUpdates({ inviteUrl: e.target.value });
                      }}
                      placeholder="https://discord.gg/yourcode"
                      className="h-10 text-[13px] bg-[#141417] border-[rgba(255,255,255,0.07)] font-sans"
                    />
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={handleCheckInvite}
                      disabled={inviteStatus === 'checking'}
                    >
                      {inviteStatus === 'checking' ? 'Testing…' : 'Test invite'}
                    </Button>
                  </div>

                  {inviteStatus === 'valid' && (
                    <p className="text-[12px] text-[var(--accent)] flex items-center gap-1 font-sans">
                      <Check className="size-3.5" /> Invite works correctly.
                    </p>
                  )}
                  {inviteStatus === 'invalid' && (
                    <p className="text-[12px] text-[#F87171] flex items-center gap-1 font-sans">
                      <AlertTriangle className="size-3.5" /> Invalid Discord invite link.
                    </p>
                  )}
                </div>
              </div>

              {/* ER:LC Connection Card (Section 4) */}
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="size-5 text-[var(--accent)]" />
                      <h2 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                        ER:LC connection
                      </h2>
                    </div>
                    <p className="text-[13px] text-[#A1A1AA] font-sans leading-relaxed">
                      Connect your Emergency Response: Liberty County private server to automatically show live player count and your join code on your listing.
                    </p>
                  </div>
                </div>

                {erlcData.connected ? (
                  /* State 2: Connected */
                  <div className="space-y-4 pt-1">
                    <div className="p-4 rounded-[12px] bg-[#141417] border border-[rgba(255,255,255,0.07)] flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <span className="size-2 rounded-full bg-[var(--accent)] animate-pulse" />
                          <span className="text-[14px] font-semibold text-[#F4F4F5] font-sans">
                            Connected
                          </span>
                          <span className="text-[#71717A] text-[13px]">•</span>
                          <span className="text-[13px] text-[#D4D4D8] font-sans font-medium">
                            {erlcData.name || 'Private Server'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Live chip: 12 / 50 players */}
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[12px] font-medium text-[var(--accent)]">
                            <Radio className="size-3" />
                            {erlcData.currentPlayers ?? 0} / {erlcData.maxPlayers ?? 50} players
                          </span>

                          {/* Join code in keycap with copy button */}
                          <div className="flex items-center gap-1.5 font-sans">
                            <span className="text-xs text-[#71717A]">Join code:</span>
                            <kbd className="px-2 py-0.5 rounded-[6px] font-mono text-[12px] bg-[#0E0E11] text-[#F4F4F5] border border-[rgba(255,255,255,0.08)]">
                              {erlcData.joinCode || joinCode || 'N/A'}
                            </kbd>
                            <button
                              type="button"
                              onClick={() => {
                                const code = erlcData.joinCode || joinCode;
                                if (code) {
                                  navigator.clipboard?.writeText(code);
                                  setCopiedErlcCode(true);
                                  setTimeout(() => setCopiedErlcCode(false), 2000);
                                  addToast('success', 'Code copied', `Join code ${code} copied.`);
                                }
                              }}
                              className="p-1 text-[#71717A] hover:text-[#F4F4F5] transition-colors cursor-pointer"
                              title="Copy join code"
                            >
                              {copiedErlcCode ? <Check className="size-3.5 text-[var(--accent)]" /> : <Copy className="size-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Last checked + Refresh button */}
                        <div className="flex items-center gap-2 text-[12px] text-[#71717A] pt-1">
                          <span>
                            Last checked {getRelativeTime(erlcData.lastCheckedAt)}
                          </span>
                          <button
                            type="button"
                            onClick={handleRefreshErlc}
                            disabled={isRefreshingErlc}
                            className="inline-flex items-center gap-1 text-[#A1A1AA] hover:text-[#F4F4F5] cursor-pointer transition-colors"
                          >
                            <RefreshCw className={cn('size-3', isRefreshingErlc && 'animate-spin')} />
                            <span>{isRefreshingErlc ? 'Refreshing...' : 'Refresh'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Right action buttons: Test connection & Disconnect */}
                      <div className="flex items-center gap-2.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleTestErlc}
                          disabled={isTestingErlc}
                          className="h-9 text-[13px]"
                        >
                          {isTestingErlc ? 'Testing...' : 'Test connection'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDisconnectDialog(true)}
                          className="h-9 text-[13px] text-[#F87171] hover:text-[#ef4444] hover:bg-[#F87171]/10"
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>

                    {/* Masked Key Display */}
                    <div className="text-[12px] text-[#71717A] flex items-center gap-1.5 px-1">
                      <Lock className="size-3 text-[#52525B]" />
                      <span>Saved key:</span>
                      <code className="font-mono text-[#A1A1AA]">{erlcData.maskedKey || '••••••••••••••••'}</code>
                    </div>
                  </div>
                ) : (
                  /* State 1: Not connected */
                  <div className="space-y-4 pt-1">
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium text-[#F4F4F5] font-sans">
                        ER:LC API key
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showKeyPassword ? 'text' : 'password'}
                            value={erlcKeyInput}
                            onChange={(e) => setErlcKeyInput(e.target.value)}
                            placeholder="erlc-api-key-..."
                            className="h-10 pr-10 text-[13px] font-mono bg-[#141417] border-[rgba(255,255,255,0.07)]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeyPassword(!showKeyPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#F4F4F5] cursor-pointer"
                            title={showKeyPassword ? 'Hide key' : 'Show key'}
                          >
                            {showKeyPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                        <Button
                          variant="primary"
                          size="md"
                          onClick={handleConnectErlc}
                          disabled={isConnectingErlc || !erlcKeyInput.trim()}
                          className="h-10 px-5 text-[13px]"
                        >
                          {isConnectingErlc ? 'Connecting...' : 'Connect'}
                        </Button>
                      </div>
                      <p className="text-[12px] text-[#71717A] font-sans">
                        Find it in your ER:LC private server settings. ConnectingERLC only reads server info.
                      </p>
                    </div>

                    {/* Subtle expandable line: manual join code fallback */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowManualJoinCode(!showManualJoinCode)}
                        className="text-[12px] text-[#71717A] hover:text-[#A1A1AA] cursor-pointer transition-colors flex items-center gap-1 font-sans"
                      >
                        <ChevronDown className={cn('size-3.5 transition-transform', showManualJoinCode && 'rotate-180')} />
                        <span>Don't want to share a key? Enter your join code instead</span>
                      </button>

                      {showManualJoinCode && (
                        <div className="mt-3 p-4 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] space-y-2">
                          <label className="text-[12px] font-medium text-[#D4D4D8] font-sans">
                            ER:LC join code
                          </label>
                          <Input
                            value={joinCode}
                            maxLength={20}
                            onChange={(e) => {
                              setJoinCode(e.target.value);
                              syncUpdates({ joinCode: e.target.value });
                            }}
                            placeholder="e.g. PRLC-102"
                            className="h-9 max-w-xs text-[13px] font-mono bg-[#0E0E11] border-[rgba(255,255,255,0.07)]"
                          />
                          <p className="text-[11px] text-[#71717A] font-sans">
                            Displayed on your public community listing so players can join directly.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Credits per verified join & Reward Model */}
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 flex flex-col">
                {/* 1. Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                    Credits per verified join
                  </h2>
                  <div className="text-[13px] font-medium text-[var(--accent)] font-sans bg-[var(--accent-soft)] border border-[var(--accent-border)] px-3 py-1.5 rounded-[8px] self-start sm:self-center">
                    {bountyCoins} credits / join
                  </div>
                </div>

                {/* 2. Base reward text */}
                <p className="text-[13px] text-[#A1A1AA] font-sans mt-1">
                  2 credits, paid by ConnectingERLC
                </p>

                {/* 3. Divider */}
                <div className="h-px w-full bg-[rgba(255,255,255,0.05)] my-4" />

                {/* 4. Switch row with 16px padding */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-[14px] font-medium text-[#F4F4F5] font-sans">
                        Offer a higher reward
                      </div>
                      <div className="text-[12px] text-[#A1A1AA] font-sans">
                        {offerHigherReward
                          ? `Cover +${extraCreditsPerJoin} extra credits per join from this server's credits.`
                          : "Cover extra credits beyond the base 2 from this server's credits."}
                      </div>
                    </div>
                    <Switch
                      checked={offerHigherReward}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setOfferHigherReward(true);
                          setHigherRewardDialogOpen(true);
                          const extra = extraCreditsPerJoin >= 1 ? extraCreditsPerJoin : 1;
                          setExtraCreditsPerJoin(extra);
                          setBountyCoins(2 + extra);
                          syncUpdates({ offerHigherReward: true, extraCreditsPerJoin: extra, rewardCoins: 2 + extra });
                        } else {
                          setOfferHigherReward(false);
                          setBountyCoins(2);
                          syncUpdates({ offerHigherReward: false, rewardCoins: 2 });
                        }
                      }}
                    />
                  </div>

                  {/* 5. Smooth height transition (CSS grid rows 0fr to 1fr) for Extra credits field */}
                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                      offerHigherReward ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="grid grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center pt-4 mt-3 border-t border-[rgba(255,255,255,0.05)]">
                        <div className="space-y-0.5">
                          <label className="text-[13px] font-medium text-[#F4F4F5] font-sans block">
                            Extra credits per join
                          </label>
                          <p className="text-[12px] text-[#71717A] font-sans">
                            Comes out of this server's credits.
                          </p>
                        </div>
                        <div className="w-[140px] flex-shrink-0">
                          <NumberField
                            min={0}
                            max={20}
                            value={extraCreditsPerJoin}
                            onChange={(val) => {
                              setExtraCreditsPerJoin(val);
                              setBountyCoins(2 + val);
                              syncUpdates({ extraCreditsPerJoin: val, rewardCoins: 2 + val });
                            }}
                            suffix="credits"
                            className="w-[140px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recruiting and representatives Card */}
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <h3 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                      Recruit representatives
                    </h3>
                    <p className="text-[13px] text-[#A1A1AA] font-sans">
                      Let trusted server representatives invite members, track retention, and earn credits.
                    </p>
                  </div>
                  <Switch
                    checked={recruitRepresentatives}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setRecruitRepresentatives(true);
                        const newWanted = representativesWanted > 0 ? representativesWanted : 1;
                        setRepresentativesWanted(newWanted);
                        syncUpdates({ recruitRepresentatives: true, representativesWanted: newWanted });
                      } else {
                        if (activeRepsCount > 0) {
                          setConfirmTurnOffRecruitingOpen(true);
                        } else {
                          setRecruitRepresentatives(false);
                          setRepresentativesWanted(0);
                          syncUpdates({ recruitRepresentatives: false, representativesWanted: 0 });
                        }
                      }
                    }}
                  />
                </div>

                {/* Collapsed when OFF, expanded when ON */}
                {recruitRepresentatives && (
                  <div className="pt-2 border-t border-[rgba(255,255,255,0.05)] space-y-1">
                    {/* Representatives wanted */}
                    <div className="grid grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center py-3.5 border-b border-[rgba(255,255,255,0.05)]">
                      <div className="space-y-0.5">
                        <label className="text-[13px] font-medium text-[#F4F4F5] font-sans block">
                          Representatives wanted
                        </label>
                        <p className="text-[12px] text-[#71717A] font-sans">
                          Slots for members who invite friends to your community (1 to 50).
                        </p>
                      </div>
                      <div className="w-[140px] flex-shrink-0">
                        <NumberField
                          min={1}
                          max={50}
                          value={representativesWanted}
                          onChange={(val) => {
                            setRepresentativesWanted(val);
                            syncUpdates({ representativesWanted: val });
                          }}
                          suffix="reps"
                          className="w-[140px]"
                        />
                      </div>
                    </div>

                    {/* Minimum stay */}
                    <div className="grid grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center py-3.5 border-b border-[rgba(255,255,255,0.05)]">
                      <div className="space-y-0.5">
                        <label className="text-[13px] font-medium text-[#F4F4F5] font-sans block">
                          Minimum stay
                        </label>
                        <p className="text-[12px] text-[#71717A] font-sans">
                          How long a new member must stay in your server for the join to count.
                        </p>
                      </div>
                      <div className="w-[220px] flex-shrink-0">
                        <Select
                          value={String(retentionTargetHours)}
                          onValueChange={(val) => {
                            const num = Number(val);
                            setRetentionTargetHours(num);
                            syncUpdates({ retentionTargetHours: num });
                          }}
                        >
                          <SelectTrigger className="w-[220px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="72">
                              3 days (recommended)
                            </SelectItem>
                            <SelectItem value="168">
                              7 days
                            </SelectItem>
                            <SelectItem value="336">
                              14 days
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Credits per recruit */}
                    <div className="grid grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center py-3.5 border-b border-[rgba(255,255,255,0.05)]">
                      <div className="space-y-0.5">
                        <label className="text-[13px] font-medium text-[#F4F4F5] font-sans block">
                          Credits per recruit
                        </label>
                        <p className="text-[12px] text-[#71717A] font-sans">
                          Reward paid to representative upon verified member stay (0 to 10).
                        </p>
                      </div>
                      <div className="w-[140px] flex-shrink-0">
                        <NumberField
                          min={0}
                          max={10}
                          value={creditsPerRecruit}
                          onChange={(val) => {
                            setCreditsPerRecruit(val);
                            syncUpdates({ creditsPerRecruit: val });
                          }}
                          suffix="credits"
                          className="w-[140px]"
                        />
                      </div>
                    </div>

                    {/* Approve manually */}
                    <div className="grid grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center py-3.5 border-b border-[rgba(255,255,255,0.05)]">
                      <div className="space-y-0.5">
                        <label className="text-[13px] font-medium text-[#F4F4F5] font-sans block">
                          Approve manually
                        </label>
                        <p className="text-[12px] text-[#71717A] font-sans">
                          Review each representative application before granting links.
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <Switch
                          checked={approveManually}
                          onCheckedChange={(val) => {
                            setApproveManually(val);
                            syncUpdates({ approveManually: val });
                          }}
                        />
                      </div>
                    </div>

                    {/* Log channel, Representative role, Recruit role pickers in full-width 3-column row */}
                    <div className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                        {/* Log Channel Picker */}
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-medium text-[#F4F4F5] font-sans block">
                            Log channel
                          </label>
                          <Select
                            value={recruitLogChannelId || 'none'}
                            onValueChange={(val) => {
                              const v = val === 'none' ? '' : val;
                              setRecruitLogChannelId(v);
                              syncUpdates({ recruitLogChannelId: v });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select channel..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {discordChannels.map((ch) => (
                                <SelectItem key={ch.id} value={ch.id}>
                                  <span className="text-zinc-500 font-mono mr-1">#</span>
                                  <span>{ch.name}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-[#71717A] font-sans">
                            ConnectingERLC posts recruit updates here.
                          </p>
                        </div>

                        {/* Representative Role */}
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-medium text-[#F4F4F5] font-sans block">
                            Representative role
                          </label>
                          <Select
                            value={repRoleId || 'none'}
                            onValueChange={(val) => {
                              const v = val === 'none' ? '' : val;
                              setRepRoleId(v);
                              syncUpdates({ repRoleId: v });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select role..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {discordRoles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  <span className="size-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#71717A' }} />
                                  <span>{r.name}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-[#71717A] font-sans">
                            Given to approved representatives.
                          </p>
                        </div>

                        {/* Recruit Role */}
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-medium text-[#F4F4F5] font-sans block">
                            Recruit role
                          </label>
                          <Select
                            value={recruitRoleId || 'none'}
                            onValueChange={(val) => {
                              const v = val === 'none' ? '' : val;
                              setRecruitRoleId(v);
                              syncUpdates({ recruitRoleId: v });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select role..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {discordRoles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  <span className="size-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#71717A' }} />
                                  <span>{r.name}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-[#71717A] font-sans">
                            Role given after staying minimum time.
                          </p>
                        </div>
                      </div>
                    </div>

                  {/* Messages: V2 Panels and DM Switch */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[12px] bg-[#141417] border border-[rgba(255,255,255,0.07)]">
                    <div className="space-y-0.5">
                      <div className="text-[13px] font-medium text-[#F4F4F5] font-sans">
                        Send me a DM
                      </div>
                      <div className="text-[11px] text-[#A1A1AA] font-sans">
                        Receive Discord Components V2 panels in your DM when recruits join or verify.
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isSendingTestPanel}
                        onClick={async () => {
                          setIsSendingTestPanel(true);
                          try {
                            const res = await fetch(`/api/servers/${guildId}/recruits/test-panel`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ channelId: recruitLogChannelId }),
                            });
                            if (res.ok) {
                              addToast('success', 'Test panel sent', 'Discord Components V2 panel sent.');
                            } else {
                              throw new Error();
                            }
                          } catch {
                            addToast('error', 'Notice', 'Could not send test panel. Check bot permissions.');
                          } finally {
                            setIsSendingTestPanel(false);
                          }
                        }}
                        className="h-8.5 text-xs px-3"
                      >
                        <Send className="size-3 mr-1.5" />
                        <span>{isSendingTestPanel ? 'Sending...' : 'Send a test panel'}</span>
                      </Button>
                      <Switch
                        checked={dmOwner}
                        onCheckedChange={(val) => {
                          setDmOwner(val);
                          syncUpdates({ dmOwner: val } as any);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

          {/* ── TAB 4: PARTNERSHIPS ───────────────────────────────────── */}
          {activeTab === 'partnerships' && (
            <div className="space-y-6">
              <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.07)]">
                  <div className="space-y-1">
                    <h2 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                      Open for partnerships
                    </h2>
                    <p className="text-[13px] text-[#A1A1AA] font-sans">
                      Allow other communities on ConnectingERLC to send partnership cross-promotion requests.
                    </p>
                  </div>
                  <Switch
                    checked={openForPartnerships}
                    onCheckedChange={(checked) => {
                      setOpenForPartnerships(checked);
                      syncUpdates({ openForPartnerships: checked });
                    }}
                  />
                </div>

                {/* Settings Rows */}
                <div className="space-y-5">
                  {/* Min Members */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-[14px] font-medium text-[#F4F4F5] font-sans">
                        Minimum members to request
                      </div>
                      <div className="text-[12px] text-[#A1A1AA] font-sans">
                        Communities below this member count cannot submit partnership requests.
                      </div>
                    </div>
                    <NumberField
                      min={0}
                      max={100000}
                      value={partnershipMinMembers}
                      onChange={(val) => {
                        setPartnershipMinMembers(val);
                        syncUpdates({ partnershipMinMembers: val });
                      }}
                      suffix="members"
                    />
                  </div>

                  {/* Credits I receive per partnership */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-[14px] font-medium text-[#F4F4F5] font-sans">
                        Credits I receive per partnership
                      </div>
                      <div className="text-[12px] text-[#A1A1AA] font-sans">
                        Fee debited from requester upon your acceptance (0 = free cross-promotion).
                      </div>
                    </div>
                    <NumberField
                      min={0}
                      max={50}
                      value={partnershipPrice}
                      onChange={(val) => {
                        setPartnershipPrice(val);
                        syncUpdates({ partnershipPrice: val });
                      }}
                      suffix="cr"
                    />
                  </div>

                  {/* Allowed Mentions & Prices */}
                  <div className="space-y-3 pt-2">
                    <div className="space-y-0.5">
                      <div className="text-[14px] font-medium text-[#F4F4F5] font-sans">
                        Allowed mentions for broadcasts
                      </div>
                      <div className="text-[12px] text-[#A1A1AA] font-sans">
                        Select which mention tiers partners may purchase in their broadcast announcement.
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['none', 'here', 'everyone'] as const).map((m) => {
                        const isSel = partnershipAllowedMentions === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setPartnershipAllowedMentions(m);
                              syncUpdates({ partnershipAllowedMentions: m });
                            }}
                            className={cn(
                              'py-2 px-3 rounded-[8px] text-[13px] font-medium border text-center transition-colors cursor-pointer font-sans',
                              isSel
                                ? 'bg-[#19191D] border-[rgba(255,255,255,0.35)] text-[#F4F4F5]'
                                : 'bg-[#141417] border-[rgba(255,255,255,0.07)] text-[#71717A] hover:text-[#A1A1AA]'
                            )}
                          >
                            {m === 'none' ? 'None' : `@${m}`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Price inputs for mentions */}
                    {partnershipAllowedMentions !== 'none' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {partnershipAllowedMentions === 'here' || partnershipAllowedMentions === 'everyone' ? (
                          <div className="p-3 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] flex items-center justify-between gap-2">
                            <span className="text-[13px] text-[#A1A1AA] font-sans">@here fee</span>
                            <NumberField
                              min={0}
                              max={100}
                              value={partnershipHerePrice}
                              onChange={(val) => {
                                setPartnershipHerePrice(val);
                                syncUpdates({ partnershipHerePrice: val });
                              }}
                              suffix="cr"
                              className="w-[100px] h-8"
                            />
                          </div>
                        ) : null}

                        {partnershipAllowedMentions === 'everyone' ? (
                          <div className="p-3 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] flex items-center justify-between gap-2">
                            <span className="text-[13px] text-[#A1A1AA] font-sans">@everyone fee</span>
                            <NumberField
                              min={0}
                              max={100}
                              value={partnershipEveryonePrice}
                              onChange={(val) => {
                                setPartnershipEveryonePrice(val);
                                syncUpdates({ partnershipEveryonePrice: val });
                              }}
                              suffix="cr"
                              className="w-[100px] h-8"
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Broadcast Channel */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[14px] font-medium text-[#F4F4F5] font-sans">
                        Broadcast channel
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (!partnershipBroadcastChannel) {
                            addToast('warning', 'No channel selected', 'Select or enter a channel ID first.');
                            return;
                          }
                          try {
                            const res = await fetch('/api/partnerships/test-broadcast', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                guildId,
                                channelId: partnershipBroadcastChannel,
                              }),
                            });
                            if (res.ok) {
                              addToast('success', 'Test message sent', 'Check your Discord channel.');
                            } else {
                              const data = await res.json().catch(() => ({}));
                              addToast('error', 'Test failed', data.error || 'Could not post to channel.');
                            }
                          } catch {
                            addToast('error', 'Test failed', 'Network error sending test message.');
                          }
                        }}
                      >
                        Send a test message
                      </Button>
                    </div>

                    {discordChannels.length > 0 ? (
                      <Select
                        value={partnershipBroadcastChannel}
                        onValueChange={(val) => {
                          setPartnershipBroadcastChannel(val);
                          syncUpdates({ partnershipBroadcastChannel: val });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a channel…" />
                        </SelectTrigger>
                        <SelectContent>
                          {discordChannels.map((ch) => (
                            <SelectItem key={ch.id} value={ch.id}>
                              #{ch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={partnershipBroadcastChannel}
                        onChange={(e) => {
                          setPartnershipBroadcastChannel(e.target.value);
                          syncUpdates({ partnershipBroadcastChannel: e.target.value });
                        }}
                        placeholder="Discord channel ID or #partnerships"
                        className="h-10 text-[13px] bg-[#141417] border-[rgba(255,255,255,0.07)] font-sans"
                      />
                    )}
                    <p className="text-[12px] text-[#71717A] font-sans">
                      Where approved partner advertisements will be posted automatically.
                    </p>
                  </div>

                  {/* Partner Categories I Accept */}
                  <div className="space-y-2 pt-2">
                    <label className="text-[14px] font-medium text-[#F4F4F5] font-sans">
                      Partner categories I accept
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_OPTIONS.map((c) => {
                        const isChecked = partnershipAcceptedCategories.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              const updated = isChecked
                                ? partnershipAcceptedCategories.filter((x) => x !== c.id)
                                : [...partnershipAcceptedCategories, c.id];
                              setPartnershipAcceptedCategories(updated);
                              syncUpdates({ partnershipAcceptedCategories: updated });
                            }}
                            className={cn(
                              'px-3 py-1.5 rounded-[8px] text-[12px] font-medium border transition-colors cursor-pointer font-sans',
                              isChecked
                                ? 'bg-[#19191D] border-[var(--accent)]/40 text-[#F4F4F5]'
                                : 'bg-[#141417] border-[rgba(255,255,255,0.07)] text-[#71717A] hover:text-[#A1A1AA]'
                            )}
                          >
                            {isChecked ? '✓ ' : ''}{c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Daily Broadcast Limit */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="space-y-0.5">
                      <div className="text-[14px] font-medium text-[#F4F4F5] font-sans">
                        Daily broadcast limit
                      </div>
                      <div className="text-[12px] text-[#A1A1AA] font-sans">
                        Maximum partner broadcasts allowed per day to avoid channel spam (1 to 10).
                      </div>
                    </div>
                    <NumberField
                      min={1}
                      max={10}
                      value={partnershipDailyLimit}
                      onChange={(val) => {
                        setPartnershipDailyLimit(val);
                        syncUpdates({ partnershipDailyLimit: val });
                      }}
                      suffix="per day"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Directory Card Preview (380px fixed width) */}
        <aside className="space-y-4 lg:sticky lg:top-8 w-full lg:w-[380px] lg:shrink-0">
          <div className="rounded-[16px] border border-[rgba(255,255,255,0.07)] bg-[#0E0E11] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-[14px] font-semibold text-[#F4F4F5] font-sans">
                  Directory preview
                </h3>
                <p className="text-[12px] text-[#A1A1AA] font-sans">
                  How your server looks in the directory.
                </p>
              </div>

              {/* Card | Page Switch */}
              <div className="flex items-center rounded-[8px] border border-[rgba(255,255,255,0.07)] bg-[#141417] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewMode('card')}
                  className={cn(
                    'px-2 py-0.5 rounded-[6px] font-medium transition-colors cursor-pointer font-sans',
                    previewMode === 'card' ? 'bg-[#0E0E11] text-[#F4F4F5]' : 'text-[#71717A]'
                  )}
                >
                  Card
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('page')}
                  className={cn(
                    'px-2 py-0.5 rounded-[6px] font-medium transition-colors cursor-pointer font-sans',
                    previewMode === 'page' ? 'bg-[#0E0E11] text-[#F4F4F5]' : 'text-[#71717A]'
                  )}
                >
                  Page
                </button>
              </div>
            </div>

            {previewMode === 'card' ? (
              <DirectoryCard
                server={currentPreviewData}
                previewOnly
              />
            ) : (
              <div className="rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[#141417] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <ServerIcon
                    guildId={guildId}
                    iconUrl={serverIconUrl}
                    name={serverName}
                    size={40}
                    className="size-10 rounded-[10px] object-cover"
                  />
                  <div>
                    <div className="text-[14px] font-semibold text-[#F4F4F5] font-sans">{serverName}</div>
                    <div className="text-[12px] text-[#A1A1AA] font-sans">{category}</div>
                  </div>
                </div>
                <p className="text-[12px] text-[#A1A1AA] line-clamp-3 font-sans">
                  {safeStr(description) || 'No description provided.'}
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── COMPLETION GATE DIALOG ────────────────────────────────────── */}
      <Dialog open={gateDialogOpen} onOpenChange={setGateDialogOpen}>
        <DialogContent className="max-w-md bg-[#0E0E11] border-[rgba(255,255,255,0.13)] text-[#F4F4F5]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-[#F4F4F5] font-sans">
              Finish setting up first
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#A1A1AA] font-sans pt-1">
              Complete the required steps before listing your server in the public directory:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {!step1Done && (
              <div className="p-3.5 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-[13px] font-medium text-[#F4F4F5] font-sans">Listing details</div>
                  <div className="text-[12px] text-[#71717A] font-sans">Set category, summary, and description.</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveTab('listing');
                    setGateDialogOpen(false);
                  }}
                >
                  Edit
                </Button>
              </div>
            )}

            {!step2Done && (
              <div className="p-3.5 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-[13px] font-medium text-[#F4F4F5] font-sans">Appearance</div>
                  <div className="text-[12px] text-[#71717A] font-sans">Upload a 3:1 banner image.</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveTab('appearance');
                    setGateDialogOpen(false);
                  }}
                >
                  Upload
                </Button>
              </div>
            )}

            {!step3Done && (
              <div className="p-3.5 rounded-[10px] bg-[#141417] border border-[rgba(255,255,255,0.07)] flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-[13px] font-medium text-[#F4F4F5] font-sans">Invite and rewards</div>
                  <div className="text-[12px] text-[#71717A] font-sans">Provide a permanent Discord invite URL.</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveTab('rewards');
                    setGateDialogOpen(false);
                  }}
                >
                  Set invite
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setGateDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── HIGHER REWARD DIALOG ──────────────────────────────────────── */}
      {(() => {
        const extraCostPerJoin = Math.max(1, extraCreditsPerJoin);
        const totalCostFor10 = extraCostPerJoin * 10;
        const balanceAfter10 = userBalance - totalCostFor10;
        const formatCredits = (n: number) => `${n} ${Math.abs(n) === 1 ? 'credit' : 'credits'}`;

        return (
          <Dialog open={higherRewardDialogOpen} onOpenChange={setHigherRewardDialogOpen}>
            <DialogContent
              showCloseButton={false}
              className="w-full max-w-[480px] sm:max-w-[480px] bg-[#0E0E11] border border-[var(--border,#27272A)] rounded-[16px] p-6 shadow-none overflow-hidden relative text-[#F4F4F5]"
            >
              {/* Close button: top right, 28px square, 16px inset */}
              <button
                type="button"
                onClick={() => {
                  setHigherRewardDialogOpen(false);
                  setOfferHigherReward(false);
                  setBountyCoins(2);
                  syncUpdates({ offerHigherReward: false, rewardCoins: 2 });
                }}
                className="absolute top-4 right-4 size-7 rounded-[8px] flex items-center justify-center text-[#71717A] hover:text-[#F4F4F5] hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>

              <div className="space-y-2 pr-6">
                <DialogTitle className="text-[20px] font-medium text-[#F4F4F5] font-sans leading-[28px]">
                  This reward comes out of this server's credits
                </DialogTitle>
                <DialogDescription className="text-[14px] text-[#A1A1AA] font-sans leading-[20px]">
                  ConnectingERLC pays the base 2 credits. Any extra reward is debited directly from this server's credits upon verified joins.
                </DialogDescription>
              </div>

              <div className="space-y-3 py-2 text-[13px] font-sans">
                <div className="p-3.5 rounded-[10px] bg-[#141417] border border-[var(--border,#27272A)] space-y-2">
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Extra cost per join:</span>
                    <span className="font-medium text-[var(--accent)]">+{formatCredits(extraCostPerJoin)}</span>
                  </div>
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Server credit balance:</span>
                    <span className="font-medium text-[#F4F4F5]">{formatCredits(userBalance)}</span>
                  </div>
                  <div className="flex justify-between text-[#A1A1AA] border-t border-[var(--border,#27272A)] pt-2">
                    <span>At 10 joins you'd spend:</span>
                    <span className="font-medium text-[#F4F4F5]">{formatCredits(totalCostFor10)}</span>
                  </div>
                  <div className="flex justify-between text-[#A1A1AA]">
                    <span>Balance after 10 joins:</span>
                    <span className={cn("font-medium", balanceAfter10 < 0 ? "text-[#F87171]" : "text-[#F4F4F5]")}>
                      {formatCredits(balanceAfter10)}
                    </span>
                  </div>
                </div>

                {balanceAfter10 < 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-[8px] bg-[#FBBF24]/10 border border-[#FBBF24]/20 text-[13px] text-[#FBBF24] leading-relaxed">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>Your server will be paused if this server's credits reach 0.</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setHigherRewardDialogOpen(false);
                    setOfferHigherReward(false);
                    setBountyCoins(2);
                    syncUpdates({ offerHigherReward: false, rewardCoins: 2 });
                  }}
                  className="h-10 px-4 text-[13px] text-[#A1A1AA] hover:text-[#F4F4F5]"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setHigherRewardDialogOpen(false)}
                  className="h-10 px-4 text-[13px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-semibold"
                >
                  I understand
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── CONFIRM TURN OFF RECRUITING DIALOG ───────────────────────── */}
      <Dialog open={confirmTurnOffRecruitingOpen} onOpenChange={setConfirmTurnOffRecruitingOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-[420px] bg-[#0E0E11] border border-[var(--border,#27272A)] rounded-[16px] p-6 shadow-2xl relative text-[#F4F4F5]"
        >
          <button
            type="button"
            onClick={() => setConfirmTurnOffRecruitingOpen(false)}
            className="absolute top-4 right-4 size-7 rounded-[8px] flex items-center justify-center text-[#71717A] hover:text-[#F4F4F5] hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
          <div className="space-y-2">
            <DialogTitle className="text-[17px] font-semibold text-[#F4F4F5] font-sans">
              Turn off recruiting?
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#A1A1AA] font-sans leading-relaxed">
              This server currently has {activeRepsCount} active representative{activeRepsCount === 1 ? '' : 's'}. Turning off recruiting will remove existing representative slots and set wanted representatives to 0.
            </DialogDescription>
          </div>
          <div className="flex items-center justify-end gap-2.5 mt-6">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmTurnOffRecruitingOpen(false)}
              className="h-9 px-4 text-[13px] text-[#A1A1AA] hover:text-[#F4F4F5]"
            >
              Keep recruiting
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setRecruitRepresentatives(false);
                setRepresentativesWanted(0);
                syncUpdates({ recruitRepresentatives: false, representativesWanted: 0 });
                setConfirmTurnOffRecruitingOpen(false);
              }}
              className="h-9 px-4 text-[13px] bg-[#F87171] hover:bg-[#EF4444] text-white font-medium"
            >
              Turn off recruiting
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CROPPER MODAL ────────────────────────────────────────────── */}
      {isCropping && cropImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-[16px] border border-[rgba(255,255,255,0.13)] bg-[#0E0E11] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#F4F4F5] font-sans">
                Crop banner (3:1)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCropping(false);
                  setCropImage(null);
                }}
                className="text-[#71717A] hover:text-[#F4F4F5] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative h-64 w-full rounded-[10px] overflow-hidden bg-black">
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={3 / 1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
              />
            </div>

            <div className="space-y-1">
              <span className="text-[12px] text-[#71717A] font-sans">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1 bg-[#141417] rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCropping(false);
                  setCropImage(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={createCroppedImage}>
                Apply crop
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect ER:LC confirmation dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent className="max-w-[420px] bg-[#0E0E11] border border-[rgba(255,255,255,0.13)] rounded-[16px] p-6 space-y-4 shadow-2xl">
          <div className="space-y-1.5">
            <h3 className="text-[17px] font-semibold text-[#F4F4F5] font-sans">
              Disconnect ER:LC server?
            </h3>
            <p className="text-[13px] text-[#A1A1AA] font-sans leading-relaxed">
              Live player count will be removed from your listing. You can reconnect at any time.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDisconnectDialog(false)}
              className="h-9 px-4 text-[13px]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnectErlc}
              className="h-9 px-4 text-[13px] bg-[#F87171] hover:bg-[#ef4444] text-[#09090B] font-medium"
            >
              Disconnect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PromoteTab(props: PromoteTabProps) {
  return (
    <TabErrorBoundary tabTitle="Promote server">
      <PromoteTabInner {...props} />
    </TabErrorBoundary>
  );
}
