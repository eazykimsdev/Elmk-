import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeSetting } from '@/components/ThemeSetting';
import { TopBanner } from '@/components/TopBanner';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  LayoutGrid,
  Users,
  Globe,
  ShieldAlert,
  AlertTriangle,
  Coins,
  UserX,
  UserCheck,
  Megaphone,
  Wrench,
  FileText,
  History,
  Activity,
  ShieldCheck,
  Check,
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Download,
  Eye,
  EyeOff,
  X,
  RefreshCw,
  RotateCcw,
  Clock,
  ExternalLink,
  Filter,
  HelpCircle,
  Shield,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Server as ServerIconLucide,
  Radio,
  Gavel,
  Edit2,
  CheckCircle,
  XCircle,
  Lock,
  Sliders,
  Layers,
  Settings2,
  Ticket,
  Send,
  Bug,
  Handshake,
  Gift,
  Sparkles,
  Copy,
  ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { NotFoundPage } from './NotFoundPage';
import { cn } from '@/lib/utils';

interface AdminUser {
  userId: string;
  username: string;
  displayName: string;
  role: 'Owner' | 'Admin' | 'Moderator' | 'Directive Board' | 'Reviewer';
  avatar?: string | null;
  avatarUrl?: string | null;
  addedAt: string;
  addedBy: string;
  last_seen_at?: string;
  lastAction?: string;
  isOnline?: boolean;
}

interface UserListItem {
  id: string;
  username: string;
  globalName: string;
  avatar: string;
  servers: number;
  serverList?: { id: string; name: string; icon?: string | null; memberCount?: number; category?: string }[];
  credits: number;
  status: 'active' | 'banned' | 'suspended' | 'not_signed_in';
  isSignedIn?: boolean;
  banDetails?: any;
  role: string;
  joinedAt: string;
}

interface ServerListItem {
  id: string;
  name: string;
  icon?: string;
  category: string;
  verified: boolean;
  memberCount: number;
  bumps: number;
  hidden?: boolean;
  delisted?: boolean;
  description?: string;
  inviteUrl?: string;
  ownerId?: string;
  ownerUsername?: string;
  ownerDisplayName?: string;
  ownerAvatar?: string;
  tags?: string[];
  createdAt?: string;
  reportsCount?: number;
  owner_discord_id?: string;
  representatives?: any[];
  balance?: number;
}

interface AuditItem {
  id: string;
  actor: { id: string; username: string };
  action: string;
  target: string;
  targetType: string;
  reason: string;
  before: any;
  after: any;
  timestamp: string;
}

interface ReportItem {
  id: string;
  reporterId: string;
  reporterTag: string;
  targetId: string;
  targetType: string;
  targetName: string;
  reason: string;
  details?: string;
  status: 'pending' | 'open' | 'reviewing' | 'resolved' | 'dismissed';
  adminNotes?: string;
  createdAt: string;
  snapshot?: any;
  serverId?: string | null;
  server?: {
    id: string;
    name: string;
    icon?: string | null;
    memberCount?: number;
    category?: string;
    delisted?: boolean;
  } | null;
  owner?: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string | null;
    isBanned?: boolean;
  } | null;
}

interface FlagTimelineEvent {
  timestamp: string;
  action: string;
  actor: string;
  note?: string;
}

interface FlagItem {
  id: string;
  severity?: 'High' | 'Medium' | 'Low';
  type: string;
  status: 'Open' | 'Reviewing' | 'Resolved' | 'Dismissed' | string;
  userId?: string;
  username?: string;
  userAvatar?: string | null;
  serverId?: string;
  serverName?: string;
  serverIcon?: string | null;
  guildId?: string;
  guildName?: string;
  details?: string;
  evidenceSummary?: string;
  createdAt?: string;
  timestamp?: string;
  creditAmount?: number;
  timeline?: FlagTimelineEvent[];
  resolvedAt?: string;
  resolvedBy?: string;
  actionReason?: string;
}

interface DetectorRules {
  joinsLeavesPerAccountPerDay: number;
  minStayHours: number;
  recruitsPerInviterPerHour: number;
  updatedAt?: string;
  updatedBy?: string;
}

interface AnnouncementItem {
  id: string;
  text: string;
  level: 'info' | 'warning' | 'alert' | 'critical';
  active: boolean;
  dismissible: boolean;
  link?: string;
  endDate?: string;
  createdAt: string;
  createdBy: string;
}

interface SystemCheckItem {
  id: string;
  name: string;
  description: string;
  status: string;
  isHealthy: boolean;
  lastChecked: string;
  details: string;
}

// ── SIDEBAR GROUPS IN EXACT REQUIRED ORDER (Section 6.1) ──
const SIDEBAR_GROUPS = [
  {
    group: null,
    items: [{ id: 'overview', label: 'Overview', icon: LayoutGrid }]
  },
  {
    group: 'Moderation',
    items: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'servers', label: 'Servers', icon: Globe },
      { id: 'hidden_servers', label: 'Hidden servers', icon: EyeOff },
      { id: 'premium_servers', label: 'Premium servers', icon: Sparkles },
      { id: 'reports', label: 'Reports', icon: ShieldAlert },
      { id: 'bugs', label: 'Bug reports', icon: Bug },
      { id: 'flags', label: 'Flags', icon: AlertTriangle },
      { id: 'blacklist', label: 'Blacklist', icon: UserX },
    ]
  },
  {
    group: 'Economy',
    items: [
      { id: 'credits', label: 'Credits', icon: Coins },
      { id: 'shop', label: 'Server shop', icon: ShoppingBag },
      { id: 'promos', label: 'Giveaway codes', icon: Ticket },
      { id: 'giveaway', label: 'Launch giveaway', icon: Gift }
    ]
  },
  {
    group: 'Site',
    items: [
      { id: 'announcements', label: 'Announcements', icon: Megaphone },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench },
      { id: 'changelog', label: 'Changelog', icon: FileText },
    ]
  },
  {
    group: 'System',
    items: [
      { id: 'system', label: 'Status', icon: Activity },
      { id: 'audit', label: 'Audit log', icon: History },
      { id: 'admins', label: 'Admins', icon: ShieldCheck },
    ]
  }
];

const NAV_TABS = SIDEBAR_GROUPS.flatMap(g => g.items);

interface AdminTabErrorBoundaryProps {
  tabName: string;
  children: React.ReactNode;
}

interface AdminTabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AdminTabErrorBoundary extends React.Component<AdminTabErrorBoundaryProps, AdminTabErrorBoundaryState> {
  constructor(props: AdminTabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AdminTabErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ADMIN TAB ERROR in ${this.props.tabName}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-8 text-center max-w-xl mx-auto my-8 space-y-3">
          <div className="size-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="size-5" />
          </div>
          <h3 className="text-base font-semibold text-white">
            Could not load {this.props.tabName}
          </h3>
          <p className="text-xs text-zinc-400">
            {this.state.error?.message || 'An unexpected rendering error occurred in this tab.'}
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-xs border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]"
            >
              <RotateCcw className="size-3.5 mr-1.5" /> Retry Tab
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AdminPortalPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  // ── AUTH & ROLE CHECK ──
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<'Owner' | 'Admin' | 'Moderator' | 'Directive Board' | 'Reviewer'>('Moderator');
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  // Authenticated fetch wrapper for admin APIs (strictly uses credentials / session cookies)
  const adminFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => {
    return fetch(input, {
      ...init,
      credentials: 'include',
    });
  }, []);

  // Active Tab
  const activeTab = useMemo(() => {
    const valid = NAV_TABS.map(t => t.id);
    return tab && valid.includes(tab) ? tab : 'overview';
  }, [tab]);

  const handleTabChange = (t: string) => {
    navigate(`/admin-portal/${t}`);
  };

  // Feedback banner
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showFeedback = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ── DATA STATES ──
  const [overview, setOverview] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Users Tab
  const [userSubtab, setUserSubtab] = useState<'all' | 'has_server' | 'members' | 'known'>('all');
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'banned' | 'has_server'>('all');
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserSheet, setSelectedUserSheet] = useState<any | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [serverOwnersCount, setServerOwnersCount] = useState<number>(0);
  const [allUsersCount, setAllUsersCount] = useState<number>(0);

  // User Action Modals
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banTargetUser, setBanTargetUser] = useState<UserListItem | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('Permanent');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [unbanModalOpen, setUnbanModalOpen] = useState(false);
  const [unbanTargetUser, setUnbanTargetUser] = useState<UserListItem | null>(null);
  const [unbanReason, setUnbanReason] = useState('Pardon issued by administration');

  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditTargetUser, setCreditTargetUser] = useState<any | null>(null);
  const [creditTargetServer, setCreditTargetServer] = useState<any | null>(null);
  const [creditDirection, setCreditDirection] = useState<'add' | 'deduct'>('add');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [userSearchText, setUserSearchText] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [membersCount, setMembersCount] = useState<number>(0);
  const [knownCount, setKnownCount] = useState<number>(0);
  const [clTab, setClTab] = useState<'edit' | 'preview'>('edit');
  const [clStatus, setClStatus] = useState<'published' | 'draft'>('published');
  const [deleteConfirmVersion, setDeleteConfirmVersion] = useState<string | null>(null);

  // Blacklist Tab
  const [blacklistEntries, setBlacklistEntries] = useState<any[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [addBlacklistModalOpen, setAddBlacklistModalOpen] = useState(false);
  const [addBlacklistId, setAddBlacklistId] = useState('');
  const [addBlacklistUsername, setAddBlacklistUsername] = useState('');
  const [addBlacklistReason, setAddBlacklistReason] = useState('');
  const [addBlacklistDuration, setAddBlacklistDuration] = useState('Permanent');
  const [removeBlacklistModalOpen, setRemoveBlacklistModalOpen] = useState(false);
  const [removeBlacklistTarget, setRemoveBlacklistTarget] = useState<any | null>(null);
  const [removeBlacklistReason, setRemoveBlacklistReason] = useState('Pardon issued by administration');
  const [blacklistSubtab, setBlacklistSubtab] = useState<'accounts' | 'ips' | 'cidrs'>('accounts');
  const [instantUnblacklistInput, setInstantUnblacklistInput] = useState('');
  const [addBlacklistType, setAddBlacklistType] = useState<'discord_id' | 'ip' | 'cidr'>('discord_id');
  const [addBlacklistValue, setAddBlacklistValue] = useState('');

  // Promo Codes Tab
  const [promos, setPromos] = useState<any[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [createPromoOpen, setCreatePromoOpen] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoCreditsInput, setPromoCreditsInput] = useState('100');
  const [promoMaxUsesInput, setPromoMaxUsesInput] = useState('10');
  const [promoExpiresInput, setPromoExpiresInput] = useState('');
  const [selectedPromoRedemptions, setSelectedPromoRedemptions] = useState<any[] | null>(null);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);

  // Launch Giveaway Tab
  const [giveawaySettings, setGiveawaySettings] = useState<any>(null);
  const [giveawayClaims, setGiveawayClaims] = useState<any[]>([]);
  const [giveawayLoading, setGiveawayLoading] = useState(false);
  const [giveawayToggling, setGiveawayToggling] = useState(false);
  const [giveawayMaxClaimsInput, setGiveawayMaxClaimsInput] = useState('20');
  const [giveawayCreditsInput, setGiveawayCreditsInput] = useState('200');
  const [giveawaySupportUrlInput, setGiveawaySupportUrlInput] = useState('');
  const [giveawaySaving, setGiveawaySaving] = useState(false);

  // Servers Tab
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [serverSearch, setServerSearch] = useState('');
  const [serverCategory, setServerCategory] = useState('all');
  const [serversLoading, setServersLoading] = useState(false);
  const [serverActionModal, setServerActionModal] = useState<{
    open: boolean;
    server: ServerListItem | null;
    action: 'hide' | 'restore' | 'remove' | 'verify' | 'unverify' | 'edit';
    reason: string;
    patch?: any;
  }>({ open: false, server: null, action: 'hide', reason: '' });

  // Hidden Servers Tab
  const [hiddenServers, setHiddenServers] = useState<any[]>([]);
  const [hiddenServersLoading, setHiddenServersLoading] = useState(false);
  const [hiddenServersSearch, setHiddenServersSearch] = useState('');
  const [hiddenReasonFilter, setHiddenReasonFilter] = useState('all');

  // Premium Servers Tab
  const [premiumServers, setPremiumServers] = useState<any[]>([]);
  const [premiumServersLoading, setPremiumServersLoading] = useState(false);
  const [premiumSearch, setPremiumSearch] = useState('');
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [grantTargetServer, setGrantTargetServer] = useState<any>(null);
  const [grantDays, setGrantDays] = useState(30);
  const [grantReason, setGrantReason] = useState('');
  const [isSubmittingGrant, setIsSubmittingGrant] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeTargetServer, setRevokeTargetServer] = useState<any>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isSubmittingRevoke, setIsSubmittingRevoke] = useState(false);

  // Credits Tab
  const [ledgerTxs, setLedgerTxs] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Reports Tab
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [reportActionModal, setReportActionModal] = useState<{
    open: boolean;
    report: ReportItem | null;
    status: 'resolved' | 'dismissed';
    notes: string;
    deleteContent?: boolean;
  }>({ open: false, report: null, status: 'resolved', notes: '', deleteContent: false });

  // Bug Reports Tab
  const [bugs, setBugs] = useState<any[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [bugFilter, setBugFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'duplicate'>('all');
  const [bugSearch, setBugSearch] = useState('');
  const [selectedBug, setSelectedBug] = useState<any | null>(null);
  const [bugStaffNote, setBugStaffNote] = useState('');
  const [bugSubmitting, setBugSubmitting] = useState(false);

  // Flags / Moderation Queue Tab
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagsSubtab, setFlagsSubtab] = useState<'queue' | 'rules'>('queue');
  const [selectedFlag, setSelectedFlag] = useState<FlagItem | null>(null);
  const [flagActionModal, setFlagActionModal] = useState<{
    open: boolean;
    flag: FlagItem | null;
    action: 'approve' | 'reverse' | 'ban' | 'hide' | 'dismiss';
    reason: string;
    submitting: boolean;
  }>({
    open: false,
    flag: null,
    action: 'approve',
    reason: '',
    submitting: false
  });
  const [detectorRules, setDetectorRules] = useState<DetectorRules>({
    joinsLeavesPerAccountPerDay: 5,
    minStayHours: 24,
    recruitsPerInviterPerHour: 10
  });
  const [rulesLoading, setRulesLoading] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [sendingTestAlert, setSendingTestAlert] = useState(false);
  const [sendingTestPartnershipDM, setSendingTestPartnershipDM] = useState(false);

  // Announcements Tab
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementLevel, setAnnouncementLevel] = useState<'info' | 'warning' | 'alert' | 'critical'>('info');
  const [announcementDismissible, setAnnouncementDismissible] = useState(true);
  const [announcementActive, setAnnouncementActive] = useState(true);
  const [announcementLink, setAnnouncementLink] = useState('');
  const [announcementEndDate, setAnnouncementEndDate] = useState('');

  // Default Banner Customization (Point 6)
  const [defaultBannerText, setDefaultBannerText] = useState('Found a bug? Report it with /bugreport and earn 50 credits');
  const [defaultBannerSaving, setDefaultBannerSaving] = useState(false);

  // Maintenance Tab
  const [maintenance, setMaintenance] = useState<{
    mode: 'operational' | 'maintenance';
    title: string;
    message: string;
    affectedServices: string[];
    updatedAt: string;
    updatedBy: string;
  }>({
    mode: 'operational',
    title: '',
    message: '',
    affectedServices: [],
    updatedAt: '',
    updatedBy: ''
  });
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  // Changelog Tab
  const [changelogEntries, setChangelogEntries] = useState<any[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogModalOpen, setChangelogModalOpen] = useState(false);
  const [editingChangelogVersion, setEditingChangelogVersion] = useState<string | null>(null);
  const [clVersion, setClVersion] = useState('');
  const [clTitle, setClTitle] = useState('');
  const [clDesc, setClDesc] = useState('');
  const [clTags, setClTags] = useState<string[]>(['new']);
  const [clItems, setClItems] = useState('');

  // Audit Tab
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');

  // System Tab (Section 7)
  const [systemChecks, setSystemChecks] = useState<any>(null);
  const [systemLoading, setSystemLoading] = useState(false);

  // Admins Tab
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [addAdminModalOpen, setAddAdminModalOpen] = useState(false);
  const [newAdminId, setNewAdminId] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'Owner' | 'Admin' | 'Moderator' | 'Directive Board' | 'Reviewer'>('Moderator');
  const [newAdminReason, setNewAdminReason] = useState('Promoted to staff roster');
  const [removeAdminModalOpen, setRemoveAdminModalOpen] = useState(false);
  const [removeAdminTarget, setRemoveAdminTarget] = useState<AdminUser | null>(null);
  const [removeAdminReason, setRemoveAdminReason] = useState('Staff role revoked');

  // Directive Board State (Phase E3)
  const [directiveAllowance, setDirectiveAllowance] = useState<{
    weeklyCap: number;
    usedThisWeek: number;
    remainingThisWeek: number;
    weekStartIso?: string;
  } | null>(null);
  const [directiveModalOpen, setDirectiveModalOpen] = useState(false);
  const [directiveTargetServer, setDirectiveTargetServer] = useState('');
  const [directiveAmount, setDirectiveAmount] = useState<number>(50);
  const [directiveReason, setDirectiveReason] = useState('');
  const [directiveGifting, setDirectiveGifting] = useState(false);

  // Server Shop Admin State (Phase E1)
  const [shopItemsList, setShopItemsList] = useState<any[]>([]);
  const [shopItemsLoading, setShopItemsLoading] = useState(false);
  const [editShopItemModalOpen, setEditShopItemModalOpen] = useState(false);
  const [editingShopItem, setEditingShopItem] = useState<any>(null);
  const [grantBoostModalOpen, setGrantBoostModalOpen] = useState(false);
  const [grantBoostServerId, setGrantBoostServerId] = useState('');
  const [grantBoostEffect, setGrantBoostEffect] = useState('double_bumps');
  const [grantBoostDays, setGrantBoostDays] = useState(1);
  const [grantBoostReason, setGrantBoostReason] = useState('Administrative perk');
  const [grantingBoost, setGrantingBoost] = useState(false);

  // ── AUTH CHECK ──
  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      setAuthLoading(true);
      try {
        const res = await adminFetch('/api/admin/check');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setIsAdmin(Boolean(data.isAdmin));
            setAdminRole(data.role || 'Moderator');
            setCurrentAdmin(data.user);
          }
        } else {
          if (mounted) setIsAdmin(false);
        }
      } catch {
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };
    checkAuth();
    return () => { mounted = false; };
  }, []);

  // ── HEARTBEAT (updates last_seen_at for online admins) ──
  useEffect(() => {
    if (!isAdmin) return;
    const sendHeartbeat = () => {
      adminFetch('/api/admin/heartbeat', { method: 'POST' }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // ── DATA FETCH ROUTER ──
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'blacklist') fetchBlacklist();
    else if (activeTab === 'servers') fetchServers();
    else if (activeTab === 'hidden_servers') fetchHiddenServers();
    else if (activeTab === 'premium_servers') fetchPremiumServers();
    else if (activeTab === 'credits') {
      fetchLedger();
      fetchDirectiveBoardAllowance();
    }
    else if (activeTab === 'shop') fetchShopItems();
    else if (activeTab === 'reports') fetchReports();
    else if (activeTab === 'bugs') fetchBugs();
    else if (activeTab === 'flags') {
      fetchFlags();
      fetchRules();
    }
    else if (activeTab === 'announcements') fetchAnnouncements();
    else if (activeTab === 'maintenance') fetchMaintenance();
    else if (activeTab === 'changelog') fetchChangelog();
    else if (activeTab === 'audit') fetchAudit();
    else if (activeTab === 'system') fetchSystem();
    else if (activeTab === 'admins') fetchAdmins();
    else if (activeTab === 'promos') fetchPromos();
    else if (activeTab === 'giveaway') fetchGiveaway();
  }, [activeTab, isAdmin, userPage, userFilter, userSubtab, serverCategory, ledgerTypeFilter, auditActionFilter, reportStatusFilter]);

  // Periodic refresh for System tab
  useEffect(() => {
    if (activeTab === 'system' && isAdmin) {
      const interval = setInterval(fetchSystem, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isAdmin]);

  // ── FETCH HANDLERS ──
  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await adminFetch('/api/admin/overview');
      if (res.ok) setOverview(await res.json());
      fetchPromos();
    } catch {} finally {
      setOverviewLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(userPage),
        limit: '15',
        filter: userFilter,
        subtab: userSubtab
      });
      if (userSearch.trim()) q.set('search', userSearch.trim());
      const res = await adminFetch(`/api/admin/users?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUsersTotal(data.total || 0);
        if (data.allCount !== undefined) setAllUsersCount(data.allCount);
        if (data.serverOwnersCount !== undefined) setServerOwnersCount(data.serverOwnersCount);
        if (data.membersCount !== undefined) setMembersCount(data.membersCount);
        if (data.knownCount !== undefined) setKnownCount(data.knownCount);
      }
    } catch {} finally {
      setUsersLoading(false);
    }
  };

  const openUserSheet = async (userId: string) => {
    setSheetLoading(true);
    setSelectedUserSheet({ id: userId, username: 'Loading...', credits: 0, servers: 0, status: 'active' });
    try {
      const res = await adminFetch(`/api/admin/users/${userId}`);
      if (res.ok) {
        setSelectedUserSheet(await res.json());
      }
    } catch {} finally {
      setSheetLoading(false);
    }
  };

  const fetchServers = async () => {
    setServersLoading(true);
    try {
      const q = new URLSearchParams({
        category: serverCategory,
        search: serverSearch
      });
      const res = await adminFetch(`/api/admin/servers?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch {} finally {
      setServersLoading(false);
    }
  };

  const fetchHiddenServers = async () => {
    setHiddenServersLoading(true);
    try {
      const q = new URLSearchParams({
        reason: hiddenReasonFilter,
        search: hiddenServersSearch
      });
      const res = await adminFetch(`/api/admin/servers/hidden?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHiddenServers(data.servers || []);
      }
    } catch {} finally {
      setHiddenServersLoading(false);
    }
  };

  const fetchPremiumServers = async () => {
    setPremiumServersLoading(true);
    try {
      const res = await adminFetch('/api/admin/premium-servers');
      if (res.ok) {
        const data = await res.json();
        setPremiumServers(data.servers || []);
      }
    } catch {} finally {
      setPremiumServersLoading(false);
    }
  };

  const handleGrantPremium = async () => {
    if (!grantTargetServer) return;
    setIsSubmittingGrant(true);
    try {
      const res = await adminFetch(`/api/admin/servers/${grantTargetServer.id}/grant-premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: grantDays, reason: grantReason.trim() || 'Admin manual grant' })
      });
      if (res.ok) {
        setGrantModalOpen(false);
        setGrantReason('');
        fetchPremiumServers();
      }
    } catch {} finally {
      setIsSubmittingGrant(false);
    }
  };

  const handleRevokePremium = async () => {
    if (!revokeTargetServer) return;
    setIsSubmittingRevoke(true);
    try {
      const res = await adminFetch(`/api/admin/servers/${revokeTargetServer.id}/remove-premium`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason.trim() || 'Admin manual revocation' })
      });
      if (res.ok) {
        setRevokeModalOpen(false);
        setRevokeReason('');
        fetchPremiumServers();
      }
    } catch {} finally {
      setIsSubmittingRevoke(false);
    }
  };

  const fetchBlacklist = async () => {
    setBlacklistLoading(true);
    try {
      const res = await adminFetch('/api/admin/blacklist');
      if (res.ok) {
        const data = await res.json();
        setBlacklistEntries(data.entries || data.blacklist || []);
      }
    } catch {} finally {
      setBlacklistLoading(false);
    }
  };

  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const q = new URLSearchParams({ type: ledgerTypeFilter, search: ledgerSearch, limit: '100' });
      const res = await adminFetch(`/api/admin/ledger?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerTxs(data.transactions || []);
      }
    } catch {} finally {
      setLedgerLoading(false);
    }
  };

  const fetchDirectiveBoardAllowance = async () => {
    try {
      const res = await adminFetch('/api/admin/directive-board/allowance');
      if (res.ok) {
        const data = await res.json();
        setDirectiveAllowance(data);
      }
    } catch {}
  };

  const handleDirectiveGift = async () => {
    if (!directiveTargetServer || !directiveAmount || !directiveReason) {
      setFeedback({ type: 'error', message: 'Please provide target server ID, gift amount, and reason.' });
      return;
    }
    setDirectiveGifting(true);
    try {
      const res = await adminFetch('/api/admin/directive-board/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: directiveTargetServer.trim(),
          amount: directiveAmount,
          reason: directiveReason.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Directive gift failed.');

      setFeedback({
        type: 'success',
        message: `Successfully gifted ${directiveAmount} credits to ${data.serverName || directiveTargetServer}! (${data.remainingWeeklyLimit} cr left this week)`
      });
      setDirectiveModalOpen(false);
      setDirectiveTargetServer('');
      setDirectiveReason('');
      fetchDirectiveBoardAllowance();
      fetchLedger();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Directive gift failed.' });
    } finally {
      setDirectiveGifting(false);
    }
  };

  const fetchShopItems = async () => {
    setShopItemsLoading(true);
    try {
      const res = await adminFetch('/api/admin/shop/items');
      if (res.ok) {
        const data = await res.json();
        setShopItemsList(data.items || []);
      }
    } catch {} finally {
      setShopItemsLoading(false);
    }
  };

  const handleSaveShopItem = async () => {
    if (!editingShopItem) return;
    try {
      const res = await adminFetch(`/api/admin/shop/items/${editingShopItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingShopItem.name,
          price: editingShopItem.price,
          durationMs: editingShopItem.durationMs,
          isActive: editingShopItem.isActive,
          description: editingShopItem.description
        })
      });
      if (!res.ok) throw new Error('Could not update shop item.');
      setFeedback({ type: 'success', message: `Saved changes to ${editingShopItem.name}` });
      setEditShopItemModalOpen(false);
      fetchShopItems();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update shop item.' });
    }
  };

  const handleGrantBoost = async () => {
    if (!grantBoostServerId || !grantBoostReason) {
      setFeedback({ type: 'error', message: 'Server ID and reason are required.' });
      return;
    }
    setGrantingBoost(true);
    try {
      const res = await adminFetch('/api/admin/shop/boosts/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: grantBoostServerId.trim(),
          effect: grantBoostEffect,
          durationDays: grantBoostDays,
          reason: grantBoostReason.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to grant boost.');

      setFeedback({ type: 'success', message: `Successfully granted ${grantBoostEffect} to server ${grantBoostServerId} for ${grantBoostDays} days!` });
      setGrantBoostModalOpen(false);
      setGrantBoostServerId('');
      setGrantBoostReason('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to grant boost.' });
    } finally {
      setGrantingBoost(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await adminFetch('/api/admin/reports');
      if (res.ok) {
        const data = await res.json();
        let list = data.reports || [];
        if (reportStatusFilter !== 'all') {
          list = list.filter((r: ReportItem) => {
            const st = (r.status || '').toLowerCase();
            if (reportStatusFilter === 'pending') return st === 'pending' || st === 'open';
            return st === reportStatusFilter.toLowerCase();
          });
        }
        setReports(list);
      }
    } catch {} finally {
      setReportsLoading(false);
    }
  };

  const fetchBugs = async (filter = bugFilter) => {
    setBugsLoading(true);
    try {
      const res = await adminFetch(`/api/admin/bugs?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setBugs(Array.isArray(data.bugs) ? data.bugs : []);
      }
    } catch {
      showFeedback('Failed to load bug reports.', 'error');
    } finally {
      setBugsLoading(false);
    }
  };

  const bugCounts = useMemo(() => {
    const counts = { all: bugs.length, pending: 0, accepted: 0, rejected: 0, duplicate: 0 };
    for (const b of bugs) {
      const s = (b.status || 'pending').toLowerCase();
      if (s in counts) (counts as any)[s]++;
    }
    return counts;
  }, [bugs]);

  const filteredBugs = useMemo(() => {
    return bugs.filter((b) => {
      if (!bugSearch.trim()) return true;
      const q = bugSearch.toLowerCase();
      return (
        (b.title || '').toLowerCase().includes(q) ||
        (b.description || '').toLowerCase().includes(q) ||
        (b.stepsToReproduce || '').toLowerCase().includes(q) ||
        (b.username || '').toLowerCase().includes(q) ||
        (b.displayName || '').toLowerCase().includes(q) ||
        (b.userId || '').includes(q) ||
        (b.id || '').includes(q)
      );
    });
  }, [bugs, bugSearch]);

  const handleBugAction = async (bugId: string, status: 'accepted' | 'rejected' | 'duplicate') => {
    setBugSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/bugs/${bugId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: bugStaffNote.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        if (status === 'accepted') {
          if (data?.bug?.rewardGuildId === 'pending') {
            showFeedback('Bug report accepted. 50 credits saved as pending reward (deposits on server listing).', 'success');
          } else if (data?.bug?.rewardGiven) {
            showFeedback('Bug report accepted. 50 credits deposited to server wallet.', 'success');
          }
        } else {
          showFeedback(`Bug report marked as ${status}.`, 'info');
        }
        setSelectedBug(null);
        setBugStaffNote('');
        fetchBugs();
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to update bug report.', 'error');
      }
    } catch {
      showFeedback('Network error while updating bug report.', 'error');
    } finally {
      setBugSubmitting(false);
    }
  };

  const handleSendTestDM = async (bugId: string) => {
    setBugSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/bugs/${bugId}/test-dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: currentAdmin?.userId || currentAdmin?.id })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.delivered) {
        showFeedback('[TEST] DM panel sent to your Discord account.', 'success');
      } else {
        showFeedback(data.note || data.error || 'Could not deliver test DM. Check if DMs are enabled.', 'error');
      }
    } catch (err: any) {
      showFeedback(err.message || 'Failed to dispatch test DM.', 'error');
    } finally {
      setBugSubmitting(false);
    }
  };

  const fetchFlags = async () => {
    setFlagsLoading(true);
    try {
      const res = await adminFetch('/api/admin/flags');
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags || []);
      }
    } catch {} finally {
      setFlagsLoading(false);
    }
  };

  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const res = await adminFetch('/api/admin/rules');
      if (res.ok) {
        const data = await res.json();
        if (data.rules) setDetectorRules(data.rules);
      }
    } catch {} finally {
      setRulesLoading(false);
    }
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const res = await adminFetch('/api/admin/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detectorRules)
      });
      if (res.ok) {
        showFeedback('Detector rules updated successfully.');
        fetchRules();
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to update detector rules.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    } finally {
      setSavingRules(false);
    }
  };

  const handleSendTestAlert = async () => {
    setSendingTestAlert(true);
    try {
      const res = await adminFetch('/api/admin/system/test-alert', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(`Test alert delivered to ${data.delivered} recipient(s).`);
      } else {
        showFeedback(data.error || 'Failed to deliver test alert.', 'error');
      }
    } catch {
      showFeedback('Network error delivering test alert.', 'error');
    } finally {
      setSendingTestAlert(false);
    }
  };

  const handleSendTestPartnershipDM = async () => {
    setSendingTestPartnershipDM(true);
    try {
      const res = await adminFetch('/api/admin/partnerships/test-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showFeedback(data.message || 'Test partnership DM dispatched to your Discord account.');
      } else {
        showFeedback(data.error || 'Failed to dispatch test partnership DM.', 'error');
      }
    } catch {
      showFeedback('Network error delivering test partnership DM.', 'error');
    } finally {
      setSendingTestPartnershipDM(false);
    }
  };

  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await adminFetch('/api/admin/announcements');
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      }
      const bRes = await adminFetch('/api/public/default-banner');
      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData?.text) setDefaultBannerText(bData.text);
      }
    } catch {} finally {
      setAnnouncementsLoading(false);
    }
  };

  const handleSaveDefaultBanner = async () => {
    setDefaultBannerSaving(true);
    try {
      const res = await adminFetch('/api/admin/default-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: defaultBannerText })
      });
      if (res.ok) {
        showFeedback('Default banner text updated successfully!');
      } else {
        showFeedback('Failed to update banner text.', 'error');
      }
    } catch {
      showFeedback('Network error updating banner text.', 'error');
    } finally {
      setDefaultBannerSaving(false);
    }
  };

  const fetchMaintenance = async () => {
    try {
      const res = await adminFetch('/api/admin/maintenance');
      if (res.ok) {
        const data = await res.json();
        const next = data.status || data.maintenance || data;
        if (next && typeof next === 'object') {
          setMaintenance({
            mode: (next.mode === 'maintenance' || next.maintenance_on) ? 'maintenance' : 'operational',
            title: next.title || '',
            message: next.message || '',
            affectedServices: Array.isArray(next.affectedServices) ? next.affectedServices : [],
            updatedAt: next.updatedAt || next.updated_at || '',
            updatedBy: next.updatedBy || next.updated_by || 'Admin'
          });
        }
      }
    } catch {}
  };

  const fetchChangelog = async () => {
    setChangelogLoading(true);
    try {
      const res = await adminFetch('/api/admin/changelog');
      if (res.ok) {
        const data = await res.json();
        setChangelogEntries(data.entries || data.changelogs || []);
      }
    } catch {} finally {
      setChangelogLoading(false);
    }
  };

  const fetchAudit = async () => {
    setAuditLoading(true);
    try {
      const q = new URLSearchParams({ action: auditActionFilter, search: auditSearch, limit: '100' });
      const res = await adminFetch(`/api/admin/audit?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.audit || []);
      }
    } catch {} finally {
      setAuditLoading(false);
    }
  };

  const fetchSystem = async () => {
    setSystemLoading(true);
    try {
      const res = await adminFetch('/api/admin/system');
      if (res.ok) {
        setSystemChecks(await res.json());
      }
    } catch {} finally {
      setSystemLoading(false);
    }
  };

  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      const res = await adminFetch('/api/admin/admins');
      if (res.ok) {
        const data = await res.json();
        setAdminsList(data.admins || []);
      }
    } catch {} finally {
      setAdminsLoading(false);
    }
  };

  // ── ACTION HANDLERS ──

  // Ban or Suspend User
  const handleExecuteBan = async () => {
    if (!banTargetUser || banReason.trim().length < 10) {
      showFeedback('Ban reason must be at least 10 characters.', 'error');
      return;
    }
    setActionSubmitting(true);
    try {
      const res = await adminFetch('/api/admin/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: banTargetUser.id,
          username: banTargetUser.username,
          reason: banReason.trim(),
          duration: banDuration
        })
      });
      if (res.ok) {
        showFeedback(`User ${banTargetUser.username || banTargetUser.id} suspended successfully.`);
        setBanModalOpen(false);
        setBanTargetUser(null);
        setBanReason('');
        fetchUsers();
        if (selectedUserSheet?.user?.id === banTargetUser.id) openUserSheet(banTargetUser.id);
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to ban user.', 'error');
      }
    } catch {
      showFeedback('Network error while applying ban.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Unban User
  const handleExecuteUnban = async () => {
    if (!unbanTargetUser) return;
    setActionSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/bans/${unbanTargetUser.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: unbanReason.trim() })
      });
      await adminFetch('/api/admin/blacklist/unblacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: unbanTargetUser.id, target: unbanTargetUser.id, reason: unbanReason.trim() })
      }).catch(() => {});
      if (res.ok) {
        showFeedback(`Pardon granted to ${unbanTargetUser.username || unbanTargetUser.id}.`);
        setUnbanModalOpen(false);
        try {
          localStorage.removeItem('erlcus_current_user_ban');
        } catch {}
        fetchUsers();
        if (selectedUserSheet?.user?.id === unbanTargetUser.id) openUserSheet(unbanTargetUser.id);
        setUnbanTargetUser(null);
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to pardon user.', 'error');
      }
    } catch {
      showFeedback('Network error while lifting ban.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Credit Modification
  const handleExecuteCreditTransaction = async () => {
    if (!creditTargetUser) return;
    const amountNum = parseInt(creditAmount, 10);
    if (isNaN(amountNum) || amountNum < 1 || amountNum > 1000000) {
      showFeedback('Please enter a valid credit amount between 1 and 1,000,000.', 'error');
      return;
    }
    if (creditReason.trim().length < 10 || creditReason.trim().length > 200) {
      showFeedback('Please enter a reason between 10 and 200 characters.', 'error');
      return;
    }

    const curBal = Number(creditTargetServer ? (creditTargetServer.balance || 0) : (creditTargetUser?.credits || 0));
    const newBal = creditDirection === 'add' ? curBal + amountNum : Math.max(0, curBal - amountNum);
    const targetLabel = creditTargetServer ? `Server: ${creditTargetServer.name}` : `User: ${creditTargetUser?.globalName || creditTargetUser?.username || 'User'} (Personal Wallet)`;
    const confirmed = window.confirm(`Confirm Credit Adjustment:\n\n${targetLabel}\nBalance change: from ${curBal} cr to ${newBal} cr (${creditDirection === 'add' ? `+${amountNum}` : `-${amountNum}`} cr)\nReason: ${creditReason.trim()}\n\nProceed?`);
    if (!confirmed) return;

    setActionSubmitting(true);
    try {
      const res = await adminFetch('/api/admin/credits/transact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: creditTargetUser.id,
          serverId: creditTargetServer?.id || null,
          amount: amountNum,
          direction: creditDirection,
          reason: creditReason.trim()
        })
      });
      if (res.ok) {
        showFeedback(`Successfully updated credit balance (${creditDirection === 'add' ? `+${amountNum}` : `-${amountNum}`} cr).`);
        setCreditModalOpen(false);
        setCreditTargetUser(null);
        setCreditTargetServer(null);
        setCreditAmount('');
        setCreditReason('');
        setUserSearchText('');
        fetchUsers();
        fetchServers();
        if (selectedUserSheet?.user?.id === creditTargetUser.id) openUserSheet(creditTargetUser.id);
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to update credit ledger.', 'error');
      }
    } catch {
      showFeedback('Network error while modifying credits.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Blacklist Add/Remove
  const handleAddBlacklist = async () => {
    const val = (addBlacklistValue || addBlacklistId).trim();
    if (!val || addBlacklistReason.trim().length < 10) {
      showFeedback('Target value and reason (at least 10 characters) are required.', 'error');
      return;
    }
    setActionSubmitting(true);
    try {
      const res = await adminFetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: addBlacklistType,
          value: val,
          reason: addBlacklistReason.trim(),
          notes: addBlacklistUsername.trim() || undefined,
        }),
      });
      if (res.ok) {
        showFeedback(`Added ${val} to security blacklist.`);
        setAddBlacklistModalOpen(false);
        setAddBlacklistId('');
        setAddBlacklistValue('');
        setAddBlacklistUsername('');
        setAddBlacklistReason('');
        fetchBlacklist();
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Could not add to blacklist.', 'error');
      }
    } catch {
      showFeedback('Failed to communicate with server.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleRemoveBlacklist = async () => {
    if (!removeBlacklistTarget) return;
    setActionSubmitting(true);
    try {
      const targetId = removeBlacklistTarget.id || removeBlacklistTarget.value || removeBlacklistTarget.userId;
      const res = await adminFetch('/api/admin/blacklist/unblacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: removeBlacklistTarget.id,
          value: removeBlacklistTarget.value,
          userId: removeBlacklistTarget.userId,
          target: targetId,
          reason: removeBlacklistReason.trim()
        }),
      });
      if (res.ok) {
        showFeedback(`Target was unblacklisted successfully.`);
        setRemoveBlacklistModalOpen(false);
        setRemoveBlacklistTarget(null);
        setRemoveBlacklistReason('Pardon issued by administration');
        fetchBlacklist();
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to unblacklist target.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleInstantUnblacklist = async () => {
    const val = instantUnblacklistInput.trim();
    if (!val) {
      showFeedback('Please enter a Discord ID, IP, or CIDR to unblacklist.', 'error');
      return;
    }
    setActionSubmitting(true);
    try {
      const res = await adminFetch('/api/admin/blacklist/unblacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: val, reason: 'Instant unblacklist from admin portal' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showFeedback(`"${val}" has been unblacklisted successfully.`);
        setInstantUnblacklistInput('');
        fetchBlacklist();
        fetchUsers();
      } else {
        showFeedback(data.error || 'Failed to unblacklist identifier.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Promo Codes Actions
  const fetchPromos = async () => {
    setPromosLoading(true);
    try {
      const res = await adminFetch('/api/admin/promos');
      if (res.ok) {
        const data = await res.json();
        setPromos(data.promos || []);
      }
    } catch {} finally {
      setPromosLoading(false);
    }
  };

  const handleCreatePromo = async () => {
    const credits = parseInt(promoCreditsInput, 10);
    const max_uses = parseInt(promoMaxUsesInput, 10);
    if (isNaN(credits) || credits < 1) {
      showFeedback('Valid credit amount required.', 'error');
      return;
    }
    setActionSubmitting(true);
    try {
      const res = await adminFetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCodeInput.trim().toUpperCase() || undefined,
          credits,
          max_uses: isNaN(max_uses) ? 10 : max_uses,
          expires_at: promoExpiresInput ? new Date(promoExpiresInput).toISOString() : null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showFeedback(`Promo code created: ${data.promo?.code}`);
        setCreatePromoOpen(false);
        setPromoCodeInput('');
        fetchPromos();
      } else {
        showFeedback(data.error || 'Failed to create promo code.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleTogglePromo = async (id: string, active: boolean) => {
    try {
      const res = await adminFetch(`/api/admin/promos/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      if (res.ok) {
        showFeedback(`Promo code ${active ? 'enabled' : 'disabled'}.`);
        fetchPromos();
      }
    } catch {}
  };

  const handleDeletePromo = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this promotional code?')) return;
    try {
      const res = await adminFetch(`/api/admin/promos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showFeedback('Promo code deleted.');
        fetchPromos();
      }
    } catch {}
  };

  const handleViewRedemptions = async (id: string) => {
    setRedemptionsLoading(true);
    setSelectedPromoRedemptions([]);
    try {
      const res = await adminFetch(`/api/admin/promos/${id}/redemptions`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPromoRedemptions(data.redemptions || []);
      }
    } catch {} finally {
      setRedemptionsLoading(false);
    }
  };

  const handleGenerateRandomCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 10; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPromoCodeInput(code);
  };

  // Launch Giveaway Actions
  const fetchGiveaway = async () => {
    setGiveawayLoading(true);
    try {
      const res = await adminFetch('/api/admin/giveaway');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || null;
        setGiveawaySettings(s);
        setGiveawayClaims(data.claims || []);
        if (s) {
          setGiveawayMaxClaimsInput(String(s.max_claims ?? 20));
          setGiveawayCreditsInput(String(s.credits_amount ?? 200));
          setGiveawaySupportUrlInput(String(s.support_server_url ?? ''));
        }
      }
    } catch {} finally {
      setGiveawayLoading(false);
    }
  };

  const handleSaveGiveawaySettings = async (enableToo = false) => {
    const max_claims = parseInt(giveawayMaxClaimsInput, 10);
    const credits_amount = parseInt(giveawayCreditsInput, 10);
    if (isNaN(max_claims) || max_claims < 1) {
      showFeedback('Please enter a valid number of spots (at least 1).', 'error');
      return;
    }
    if (isNaN(credits_amount) || credits_amount < 1) {
      showFeedback('Please enter a valid credit reward amount (at least 1).', 'error');
      return;
    }
    setGiveawaySaving(true);
    try {
      const payload: any = {
        max_claims,
        credits_amount,
        support_server_url: giveawaySupportUrlInput.trim() || undefined
      };
      if (enableToo) payload.enabled = true;
      const res = await adminFetch('/api/admin/giveaway/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setGiveawaySettings(data.settings);
        showFeedback(enableToo ? `Giveaway launched: ${max_claims} spots at ${credits_amount} cr each!` : `Giveaway updated: ${max_claims} spots at ${credits_amount} cr each.`);
      } else {
        showFeedback(data.error || 'Failed to save giveaway settings.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    } finally {
      setGiveawaySaving(false);
    }
  };

  const handleResetGiveawayClaims = async () => {
    if (!window.confirm('Reset all claimed spots to 0 so you can start a fresh giveaway round? (Past credit ledger entries are kept.)')) return;
    setGiveawaySaving(true);
    try {
      const res = await adminFetch('/api/admin/giveaway/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setGiveawaySettings(data.settings || giveawaySettings);
        setGiveawayClaims([]);
        showFeedback('Giveaway claims reset to 0 for a new round.');
      } else {
        showFeedback('Failed to reset giveaway claims.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    } finally {
      setGiveawaySaving(false);
    }
  };

  const handleToggleGiveaway = async () => {
    if (!giveawaySettings) return;
    const nextState = !giveawaySettings.enabled;
    setGiveawayToggling(true);
    try {
      const res = await adminFetch('/api/admin/giveaway/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState })
      });
      if (res.ok) {
        const data = await res.json();
        setGiveawaySettings(data.settings);
        showFeedback(`Launch giveaway ${nextState ? 'enabled' : 'disabled'}.`);
      } else {
        showFeedback('Failed to update giveaway state.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    } finally {
      setGiveawayToggling(false);
    }
  };

  // Server Action (Hide / Restore / Verify / Remove)
  const handleExecuteServerAction = async () => {
    const { server, action, reason, patch } = serverActionModal;
    if (!server) return;
    if ((action === 'hide' || action === 'remove') && (!reason || reason.trim().length < 5)) {
      showFeedback('Please provide a valid reason for this action.', 'error');
      return;
    }
    setActionSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/servers/${server.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason ? reason.trim() : undefined, patch })
      });
      if (res.ok) {
        const labels: Record<string, string> = {
          hide: 'Server hidden from public directory.',
          restore: 'Server restored to public directory.',
          verify: 'Server verified.',
          unverify: 'Server verification revoked.',
          remove: 'Server listing removed.',
          edit: 'Server details updated.'
        };
        showFeedback(labels[action] || 'Action completed.');
        setServerActionModal({ open: false, server: null, action: 'hide', reason: '' });
        fetchServers();
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Server action failed.', 'error');
      }
    } catch {
      showFeedback('Network error while processing server action.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Report Resolution
  const handleExecuteReportAction = async () => {
    const { report, status, notes, deleteContent } = reportActionModal;
    if (!report) return;
    setActionSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/reports/${report.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes: notes.trim(), deleteContent })
      });
      if (res.ok) {
        showFeedback(`Report marked as ${status}.`);
        setReportActionModal({ open: false, report: null, status: 'resolved', notes: '', deleteContent: false });
        fetchReports();
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to update report.', 'error');
      }
    } catch {
      showFeedback('Network error while updating report.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Flag Action
  const handleExecuteFlagAction = async (flagId: string, action: string, reason: string) => {
    try {
      const res = await adminFetch(`/api/admin/flags/${flagId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reason || 'Moderator action' })
      });
      if (res.ok) {
        const data = await res.json();
        showFeedback(`Flag updated: action "${action}" applied.`);
        fetchFlags();
        if (selectedFlag && selectedFlag.id === flagId) {
          setSelectedFlag(data.flag || null);
        }
        setFlagActionModal({ open: false, flag: null, action: 'approve', reason: '', submitting: false });
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to update flag.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    }
  };

  // Maintenance Toggle
  const handleSaveMaintenance = async (newMode?: 'operational' | 'maintenance') => {
    setMaintenanceSaving(true);
    try {
      const res = await adminFetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: newMode || maintenance?.mode || 'operational',
          title: maintenance?.title || '',
          message: maintenance?.message || '',
          affectedServices: maintenance?.affectedServices || []
        })
      });
      if (res.ok) {
        const data = await res.json();
        const next = data.status || data.maintenance || data;
        if (next && typeof next === 'object') {
          setMaintenance({
            mode: (next.mode === 'maintenance' || next.maintenance_on) ? 'maintenance' : 'operational',
            title: next.title || '',
            message: next.message || '',
            affectedServices: Array.isArray(next.affectedServices) ? next.affectedServices : [],
            updatedAt: next.updatedAt || next.updated_at || new Date().toISOString(),
            updatedBy: next.updatedBy || next.updated_by || 'Admin'
          });
        }
        showFeedback('Maintenance settings persisted successfully.');
      } else {
        showFeedback('Failed to save maintenance state.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    } finally {
      setMaintenanceSaving(false);
    }
  };

  // Announcement Create / Toggle / Delete
  const handleCreateAnnouncement = async () => {
    if (!announcementText.trim()) return;
    try {
      const res = await adminFetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: announcementText.trim(),
          level: announcementLevel,
          active: announcementActive,
          link: announcementLink.trim() || null,
          endDate: announcementEndDate || null,
          dismissible: announcementDismissible
        })
      });
      if (res.ok) {
        showFeedback('Announcement published.');
        setAnnouncementModalOpen(false);
        setAnnouncementText('');
        setAnnouncementLink('');
        setAnnouncementEndDate('');
        setAnnouncementActive(true);
        fetchAnnouncements();
      }
    } catch {
      showFeedback('Failed to create announcement.', 'error');
    }
  };

  const handleToggleAnnouncement = async (item: AnnouncementItem) => {
    try {
      const res = await adminFetch(`/api/admin/announcements/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active })
      });
      if (res.ok) {
        showFeedback(item.active ? 'Announcement turned off.' : 'Announcement turned on.');
        fetchAnnouncements();
      }
    } catch {
      showFeedback('Failed to update announcement.', 'error');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const res = await adminFetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showFeedback('Announcement deleted.');
        fetchAnnouncements();
      }
    } catch {
      showFeedback('Failed to delete announcement.', 'error');
    }
  };

  // Changelog Publish & Edit
  const handleOpenEditChangelog = (entry: any) => {
    setEditingChangelogVersion(entry.version);
    setClVersion(entry.version);
    setClTitle(entry.title || '');
    setClDesc(entry.description || '');
    setClTags(Array.isArray(entry.tags) ? entry.tags : ['new']);
    setClItems(Array.isArray(entry.items) ? entry.items.join('\n') : '');
    setChangelogModalOpen(true);
  };

  const handleDeleteChangelog = async (version: string) => {
    if (!window.confirm(`Are you sure you want to delete changelog release ${version}?`)) return;
    try {
      const res = await adminFetch(`/api/admin/changelog/${encodeURIComponent(version)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showFeedback(`Changelog release ${version} deleted.`);
        fetchChangelog();
      } else {
        showFeedback('Failed to delete changelog release.', 'error');
      }
    } catch {
      showFeedback('Network error deleting changelog release.', 'error');
    }
  };

  const handlePublishChangelog = async () => {
    if (!clVersion.trim() || !clTitle.trim() || !clItems.trim()) {
      showFeedback('Please fill out all required changelog fields.', 'error');
      return;
    }
    const itemsArray = clItems.split('\n').map(s => s.trim()).filter(Boolean);
    try {
      const res = await adminFetch('/api/admin/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: clVersion.trim(),
          title: clTitle.trim(),
          description: clDesc.trim(),
          tags: clTags,
          items: itemsArray
        })
      });
      if (res.ok) {
        showFeedback(editingChangelogVersion ? `Changelog ${clVersion} updated.` : 'Changelog release published.');
        setChangelogModalOpen(false);
        setEditingChangelogVersion(null);
        setClVersion('');
        setClTitle('');
        setClDesc('');
        setClItems('');
        fetchChangelog();
      }
    } catch {
      showFeedback('Failed to publish changelog.', 'error');
    }
  };

  // Direct Community Report Actions (Ban Owner, Delist Server, Resolve, Dismiss)
  const handleReportActionDirect = async (
    reportId: string,
    action: 'ban_owner' | 'delist_server' | 'resolved' | 'dismissed',
    reasonText?: string
  ) => {
    try {
      const res = await adminFetch(`/api/admin/reports/${reportId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          status: action === 'dismissed' ? 'dismissed' : 'resolved',
          reason: reasonText || (action === 'ban_owner' ? 'Community owner banned for violation' : action === 'delist_server' ? 'Server delisted for violation' : 'Report resolved')
        })
      });
      if (res.ok) {
        showFeedback(
          action === 'ban_owner' ? 'Community owner banned and report resolved.' :
          action === 'delist_server' ? 'Server delisted from directory.' :
          action === 'dismissed' ? 'Report dismissed.' : 'Report marked as resolved.'
        );
        fetchReports();
        if (action === 'ban_owner') fetchUsers();
      } else {
        showFeedback('Failed to execute report action.', 'error');
      }
    } catch {
      showFeedback('Network error executing report action.', 'error');
    }
  };

  // Admins Add / Remove
  const handleAddAdmin = async () => {
    if (!newAdminId.trim()) {
      showFeedback('Discord User ID is required.', 'error');
      return;
    }
    try {
      const res = await adminFetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newAdminId.trim(),
          username: newAdminUsername.trim() || 'staff_member',
          role: newAdminRole,
          reason: newAdminReason.trim()
        })
      });
      if (res.ok) {
        showFeedback('Administrator added.');
        setAddAdminModalOpen(false);
        setNewAdminId('');
        setNewAdminUsername('');
        fetchAdmins();
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to add admin.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    }
  };

  const handleRemoveAdmin = async () => {
    if (!removeAdminTarget) return;
    try {
      const res = await adminFetch(`/api/admin/admins/${removeAdminTarget.userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: removeAdminReason.trim() })
      });
      if (res.ok) {
        showFeedback('Staff role revoked.');
        setRemoveAdminModalOpen(false);
        setRemoveAdminTarget(null);
        fetchAdmins();
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Failed to remove admin.', 'error');
      }
    } catch {
      showFeedback('Network error.', 'error');
    }
  };

  // CSV Export for Audit Log
  const exportAuditCSV = () => {
    if (!auditLogs.length) return;
    const headers = ['Timestamp', 'Actor ID', 'Actor Username', 'Action', 'Target', 'Target Type', 'Reason'];
    const rows = auditLogs.map(a => [
      a.timestamp,
      a.actor?.id || '',
      a.actor?.username || '',
      a.action,
      a.target,
      a.targetType,
      `"${(a.reason || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for Credits Ledger
  const exportLedgerCSV = () => {
    if (!ledgerTxs.length) return;
    const headers = ['Timestamp', 'Transaction ID', 'User ID', 'Guild ID', 'Type', 'Amount', 'Description'];
    const rows = ledgerTxs.map(t => [
      t.timestamp,
      t.id,
      t.userId || '',
      t.guildId || '',
      t.type,
      t.amount,
      `"${(t.description || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `credits_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── ACCESS RESTRICTION: 404 FOR NON-ADMINS ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <span className="text-xs text-zinc-400">Verifying administrator credentials...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <NotFoundPage />;
  }

  return (
    <div className="min-h-screen bg-[var(--top-banner-bg,var(--background))] text-white flex flex-col pt-[var(--top-banner-height,0px)] transition-[padding,background-color] duration-150">
      <TopBanner />
      <div
        className="flex-1 flex flex-col min-h-0 w-full overflow-hidden bg-[#09090B] transition-[border-radius] duration-150 rounded-t-[var(--app-corner-radius,0px)]"
        style={{
          borderTopLeftRadius: 'var(--app-corner-radius, 0px)',
          borderTopRightRadius: 'var(--app-corner-radius, 0px)'
        }}
      >
        {/* ── TOP BAR (Section 6.1) ── */}
        <header className="h-14 border-b border-white/[0.08] bg-[#0E0E11] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <img src="/brand/logo.png" alt="ConnectingERLC" className="size-6 object-contain rounded-md" />
            <span className="font-bold text-sm tracking-tight text-white group-hover:text-zinc-200 transition-colors">
              ConnectingERLC
            </span>
          </Link>
          <span className="text-[11px] font-medium text-zinc-400 bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-md">
            Admin
          </span>
          <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />
          <div className="text-xs text-zinc-400 hidden sm:flex items-center gap-1.5 font-sans">
            <span>Admin</span>
            <span>&gt;</span>
            <span className="text-zinc-200 font-medium">
              {NAV_TABS.find(t => t.id === activeTab)?.label || 'Overview'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all font-sans"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Back to app</span>
          </Link>

          <div className="h-4 w-[1px] bg-white/[0.08]" />

          <div className="flex items-center gap-2 pl-1">
            <UserAvatar
              userId={currentAdmin?.userId || currentAdmin?.id}
              avatarHash={currentAdmin?.avatarHash}
              avatarUrl={currentAdmin?.avatar}
              name={currentAdmin?.displayName || currentAdmin?.username || 'Admin'}
              size={24}
              className="size-6 rounded-full"
            />
            <span className="text-xs font-medium text-zinc-300 hidden md:inline font-sans">
              {currentAdmin?.displayName || currentAdmin?.username || 'Admin'}
            </span>
            <span className="text-[10px] text-zinc-400 border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 rounded-full inline-flex font-sans">
              {adminRole || 'Admin'}
            </span>
          </div>
        </div>
      </header>

      {/* ── FEEDBACK NOTIFICATION ── */}
      {feedback && (
        <div className="bg-[#121215] border-b border-white/[0.08] px-4 py-2 flex items-center justify-between animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2 text-xs">
            {feedback.type === 'error' ? (
              <AlertCircle className="size-3.5 text-rose-400" />
            ) : (
              <Check className="size-3.5 text-[var(--accent)]" />
            )}
            <span className={feedback.type === 'error' ? 'text-rose-300' : 'text-zinc-200'}>
              {feedback.message}
            </span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── BODY LAYOUT: SIDEBAR + CONTENT ── */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Mobile Horizontal Subnav */}
        <div className="md:hidden border-b border-white/[0.08] bg-[#0E0E11] px-3 overflow-x-auto scrollbar-none flex items-center gap-1 py-2">
          {NAV_TABS.map((tabItem) => {
            const Icon = tabItem.icon;
            const isActive = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                onClick={() => handleTabChange(tabItem.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all font-sans ${
                  isActive
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`size-3.5 ${isActive ? 'text-[var(--accent)]' : 'text-zinc-500'}`} />
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop Sidebar with Groups (Section 6.1) */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-white/[0.08] bg-[#0E0E11] p-3 space-y-4">
          {SIDEBAR_GROUPS.map((groupObj, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {groupObj.group && (
                <div className="px-3 pb-1 text-[12px] font-medium text-zinc-500 font-sans">
                  {groupObj.group}
                </div>
              )}
              {groupObj.items.map((tabItem) => {
                const Icon = tabItem.icon;
                const isActive = activeTab === tabItem.id;
                const isSystemDown = tabItem.id === 'system' && Boolean(systemChecks?.anyDown);
                return (
                  <button
                    key={tabItem.id}
                    onClick={() => handleTabChange(tabItem.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left font-sans ${
                      isActive
                        ? 'bg-[var(--accent-soft)] text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`size-4 ${isActive ? 'text-[var(--accent)]' : 'text-zinc-500'}`} />
                    <span className="flex-1">{tabItem.label}</span>
                    {isSystemDown && (
                      <span className="size-2 rounded-full bg-rose-500 animate-pulse shrink-0" title="System issue detected" />
                    )}
                    {tabItem.id === 'reports' && overview?.openReports > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
                        {overview.openReports}
                      </span>
                    )}
                    {tabItem.id === 'flags' && overview?.openFlags > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400">
                        {overview.openFlags}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
          <AdminTabErrorBoundary tabName={activeTab} key={activeTab}>

          {/* ═══════════════════════════════════════════════════════════
              1. OVERVIEW TAB (Section 6.1 Clean Rebuild)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div>
                <h1 className="text-[28px] font-semibold text-white tracking-tight font-sans">Overview</h1>
                <p className="text-xs text-zinc-400 mt-1 font-sans">A quick look at the platform.</p>
              </div>

              {overviewLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.03]" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-[#121215] border-white/[0.08] p-5">
                    <span className="text-[13px] text-zinc-400 font-sans block">Accounts</span>
                    <div className="text-[28px] font-semibold text-white mt-1.5 tracking-tight font-sans">
                      {overview?.usersCount ?? 0}
                    </div>
                    <span className="text-xs text-zinc-500 mt-1 block font-sans">
                      {overview?.membersCount ?? 0} signed in, {overview?.knownCount ?? 0} not signed in yet
                    </span>
                  </Card>

                  <Card className="bg-[#121215] border-white/[0.08] p-5">
                    <span className="text-[13px] text-zinc-400 font-sans block">Listed servers</span>
                    <div className="text-[28px] font-semibold text-white mt-1.5 tracking-tight font-sans">
                      {overview?.serversListed ?? 0}
                    </div>
                    <span className="text-xs text-zinc-500 mt-1 block font-sans">Active directory listings</span>
                  </Card>

                  <Card className="bg-[#121215] border-white/[0.08] p-5">
                    <span className="text-[13px] text-zinc-400 font-sans block">Verified joins today</span>
                    <div className="text-[28px] font-semibold text-white mt-1.5 tracking-tight font-sans">
                      {overview?.verifiedJoins24h ?? 0}
                    </div>
                    <span className="text-xs text-zinc-500 mt-1 block font-sans">Completed 24h joins</span>
                  </Card>

                  <Card className="bg-[#121215] border-white/[0.08] p-5">
                    <span className="text-[13px] text-zinc-400 font-sans block">Credits in total</span>
                    <div className="text-[28px] font-semibold text-white mt-1.5 tracking-tight font-sans">
                      {overview?.creditsInCirculation ?? 0} cr
                    </div>
                    <span className="text-xs text-zinc-500 mt-1 block font-sans">Combined platform balances</span>
                  </Card>
                </div>
              )}

              {/* Status Summary Card & Needs Attention Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Status card listing the four components */}
                <Card className="bg-[#121215] border-white/[0.08] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[14px] font-semibold text-white font-sans">System status</h2>
                      <p className="text-xs text-zinc-400 font-sans mt-0.5">Automated monitoring checks</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTabChange('system')}
                      className="text-xs text-zinc-300 hover:text-white h-7 px-2 font-sans"
                    >
                      View system &rarr;
                    </Button>
                  </div>

                  <div className="divide-y divide-white/[0.04]">
                    {['Core API', 'Database', 'Discord bot', 'ER:LC API'].map((compName) => {
                      const comp = systemChecks?.components?.find((c: any) => c.name === compName);
                      const isUp = comp?.status === 'Operational';
                      const isDegraded = comp?.status === 'Degraded';
                      const isNotInUse = comp?.status === 'Not in use';
                      return (
                        <div key={compName} className="py-2.5 flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-300 font-sans">{compName}</span>
                          <div className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${
                              isUp ? 'bg-zinc-400' :
                              isDegraded ? 'bg-amber-400' :
                              isNotInUse ? 'bg-zinc-600' :
                              'bg-rose-500'
                            }`} />
                            <span className="text-xs text-zinc-400 font-sans">
                              {comp?.status || 'Operational'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Needs Attention Card */}
                <Card className="bg-[#121215] border-white/[0.08] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[14px] font-semibold text-white font-sans">Needs attention</h2>
                      <p className="text-xs text-zinc-400 font-sans mt-0.5">Active moderation queues</p>
                    </div>
                  </div>

                  {overview?.needsAttention && overview.needsAttention.length > 0 ? (
                    <div className="space-y-2.5">
                      {overview.needsAttention.map((item: any) => (
                        <div
                          key={item.id}
                          onClick={() => handleTabChange(item.tab || 'reports')}
                          className="p-3 rounded-xl border border-white/[0.06] bg-[#0E0E11] flex items-center justify-between cursor-pointer hover:border-white/[0.12] transition-colors"
                        >
                          <div>
                            <div className="text-xs font-medium text-white font-sans">{item.title}</div>
                            <div className="text-[11px] text-zinc-400 font-sans">{item.desc}</div>
                          </div>
                          <span className="text-xs text-zinc-400 font-sans">
                            {item.count} item{item.count === 1 ? '' : 's'} &rarr;
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-zinc-500 font-sans">
                      Nothing needs attention.
                    </div>
                  )}
                </Card>
              </div>

              {/* Recent Activity Card with last 10 audit rows */}
              <Card className="bg-[#121215] border-white/[0.08] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[14px] font-semibold text-white font-sans">Recent activity</h2>
                    <p className="text-xs text-zinc-400 font-sans mt-0.5">Latest administrative actions</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTabChange('audit')}
                    className="text-xs text-zinc-300 hover:text-white h-7 px-2 font-sans"
                  >
                    View audit log &rarr;
                  </Button>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500 font-sans">No recent activity recorded.</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {auditLogs.slice(0, 10).map((audit) => (
                      <div key={audit.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar
                            userId={audit.actor?.id}
                            name={audit.actor?.username || 'Staff'}
                            size={24}
                          />
                          <div className="min-w-0">
                            <span className="text-xs text-zinc-200 font-sans block truncate">
                              <strong className="text-white">{audit.actor?.username || 'Staff'}</strong>: {audit.action.replace(/_/g, ' ')} {audit.target ? `on ${audit.target}` : ''}
                            </span>
                            {audit.reason && (
                              <span className="text-[11px] text-zinc-400 font-sans block truncate">{audit.reason}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-zinc-500 shrink-0 font-sans">
                          {new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Promotional Codes Management Card in Overview */}
              <Card className="bg-[#121215] border-white/[0.08] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[14px] font-semibold text-white font-sans flex items-center gap-2">
                      <Ticket className="size-4 text-emerald-400" />
                      Promotional Codes
                    </h2>
                    <p className="text-xs text-zinc-400 font-sans mt-0.5">Manage and delete reward promo codes directly</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTabChange('promos')}
                    className="text-xs text-zinc-300 hover:text-white h-7 px-2 font-sans cursor-pointer"
                  >
                    View all promo codes &rarr;
                  </Button>
                </div>

                {promos.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-500 font-sans">No promotional codes found.</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {promos.map((p) => (
                      <div key={p.id} className="py-2.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <code className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">
                            {p.code}
                          </code>
                          <span className="text-xs text-emerald-400 font-medium font-sans">
                            +{p.credits} cr
                          </span>
                          <span className="text-[11px] text-zinc-500 font-sans">
                            {p.used_count || 0}/{p.max_uses || '∞'} claimed
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePromo(p.id)}
                          className="h-7 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-sans flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              2. USERS TAB (Members vs Known accounts subtabs, Sheet)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">User Accounts</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Manage user status, snowflake identities, credits, and suspension states.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-64">
                    <Search className="size-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                      className="pl-8 h-8 text-xs bg-[#121215] border-white/[0.08]"
                    />
                  </div>

                  <Select value={userFilter} onValueChange={(val: any) => setUserFilter(val)}>
                    <SelectTrigger className="w-32 h-8 text-xs bg-[#121215] border-white/[0.08]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121215] border-white/[0.08] text-xs">
                      <SelectItem value="all">All accounts</SelectItem>
                      <SelectItem value="active">Active only</SelectItem>
                      <SelectItem value="banned">Banned / Suspended</SelectItem>
                      <SelectItem value="has_server">Has server</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sub-tabs: All accounts vs Has server vs Members vs Known accounts */}
              <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2 flex-wrap">
                <button
                  onClick={() => { setUserSubtab('all'); setUserPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    userSubtab === 'all'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All accounts ({allUsersCount || (userSubtab === 'all' ? usersTotal : 0)})
                </button>
                <button
                  onClick={() => { setUserSubtab('has_server'); setUserPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    userSubtab === 'has_server'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Has server ({serverOwnersCount || (userSubtab === 'has_server' ? usersTotal : 0)})
                </button>
                <button
                  onClick={() => { setUserSubtab('members'); setUserPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    userSubtab === 'members'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Members ({membersCount || (userSubtab === 'members' ? usersTotal : 0)})
                </button>
                <button
                  onClick={() => { setUserSubtab('known'); setUserPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    userSubtab === 'known'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Known Accounts ({knownCount || (userSubtab === 'known' ? usersTotal : 0)})
                </button>
              </div>

              {/* Users Table */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Discord ID</th>
                        <th className="py-3 px-4">Servers</th>
                        <th className="py-3 px-4">Credits</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Joined / Added</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {usersLoading ? (
                        [1, 2, 3, 4, 5].map(i => (
                          <tr key={i}>
                            <td colSpan={7} className="py-3.5 px-4">
                              <Skeleton className="h-4 w-full bg-white/[0.03]" />
                            </td>
                          </tr>
                        ))
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-zinc-500">
                            No accounts found matching filter.
                          </td>
                        </tr>
                      ) : (
                        users.map(u => (
                          <tr
                            key={u.id}
                            className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                            onClick={() => openUserSheet(u.id)}
                          >
                            <td className="py-3 px-4 flex items-center gap-2.5">
                              <UserAvatar
                                userId={u.id}
                                avatarUrl={u.avatar}
                                name={u.username || 'User'}
                                size={28}
                                className="size-7 rounded-full bg-zinc-800"
                              />
                              <div>
                                <div className="font-semibold text-white group-hover:text-[var(--accent)] transition-colors">
                                  {u.username || 'Name unavailable'}
                                </div>
                                <div className="text-[10px] text-zinc-500">{u.globalName || u.username || 'Name unavailable'}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">{u.id}</td>
                            <td className="py-3 px-4">
                              {u.serverList && u.serverList.length > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex -space-x-1.5 overflow-hidden py-0.5">
                                    {u.serverList.slice(0, 3).map((srv) => (
                                      <div key={srv.id} className="size-5 rounded-full overflow-hidden ring-1.5 ring-[#121215] bg-zinc-800 shrink-0" title={srv.name}>
                                        <ServerIcon
                                          serverId={srv.id}
                                          icon={srv.icon}
                                          name={srv.name}
                                          size="sm"
                                          className="size-full rounded-full"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  {u.serverList.length > 3 ? (
                                    <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.06] border border-white/10 px-1.5 py-0.5 rounded-full font-semibold">
                                      +{u.serverList.length - 3}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-zinc-300 font-medium truncate max-w-[120px]">
                                      {u.serverList[0]?.name}
                                    </span>
                                  )}
                                </div>
                              ) : u.servers > 0 ? (
                                <span className="text-zinc-300 font-medium">{u.servers} {u.servers === 1 ? 'server' : 'servers'}</span>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-semibold text-white">{u.credits} cr</td>
                            <td className="py-3 px-4">
                              {u.status === 'banned' ? (
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]">
                                  Banned
                                </Badge>
                              ) : u.status === 'suspended' ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                  Suspended
                                </Badge>
                              ) : u.status === 'not_signed_in' ? (
                                <Badge variant="outline" className="bg-zinc-800 text-zinc-400 border-white/[0.08] text-[10px]">
                                  Not signed in
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)] text-[10px]">
                                  Active
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-[11px]">
                              {new Date(u.joinedAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setCreditTargetUser(u);
                                    setUserSearchText(`${u.globalName || u.username} (${u.id})`);
                                    setShowUserDropdown(false);
                                    const userServers = servers.filter(
                                      (s) => String(s.ownerId || s.owner_discord_id) === String(u.id) ||
                                        (Array.isArray(s.representatives) && s.representatives.map(String).includes(String(u.id))) ||
                                        ((u.id === '523693281541095424' || u.id === '1317231689361133650') && String(s.id) === '1347902300324368414')
                                    );
                                    setCreditTargetServer(userServers[0] || null);
                                    setCreditModalOpen(true);
                                  }}
                                  className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
                                  title="Adjust credits"
                                >
                                  <Coins className="size-3.5" />
                                </Button>
                                {u.status === 'banned' || u.status === 'suspended' ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setUnbanTargetUser(u);
                                      setUnbanModalOpen(true);
                                    }}
                                    className="h-7 px-2 text-xs text-[var(--accent)] hover:text-[var(--accent)]"
                                    title="Pardon user"
                                  >
                                    <UserCheck className="size-3.5" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setBanTargetUser(u);
                                      setBanModalOpen(true);
                                    }}
                                    className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300"
                                    title="Suspend account"
                                  >
                                    <UserX className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="py-3 px-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-zinc-500">
                  <span>Showing {users.length} of {usersTotal} accounts</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={userPage <= 1}
                      onClick={() => setUserPage(p => Math.max(1, p - 1))}
                      className="h-7 px-2.5 text-xs bg-transparent border-white/[0.08]"
                    >
                      Previous
                    </Button>
                    <span className="text-zinc-400 font-mono">Page {userPage}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={users.length < 15}
                      onClick={() => setUserPage(p => p + 1)}
                      className="h-7 px-2.5 text-xs bg-transparent border-white/[0.08]"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              3. SERVERS TAB (Hide, Restore, Verify, Remove)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'servers' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Community Listings</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Moderate server visibility, verification status, and directory listings.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-64">
                    <Search className="size-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search servers..."
                      value={serverSearch}
                      onChange={(e) => setServerSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchServers()}
                      className="pl-8 h-8 text-xs bg-[#121215] border-white/[0.08]"
                    />
                  </div>

                  <Select value={serverCategory} onValueChange={(val: any) => setServerCategory(val)}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-[#121215] border-white/[0.08]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121215] border-white/[0.08] text-xs">
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="Design Server">Design Server</SelectItem>
                      <SelectItem value="Roleplay Server">Roleplay Server</SelectItem>
                      <SelectItem value="Misc">Misc</SelectItem>
                      <SelectItem value="COTS">COTS</SelectItem>
                      <SelectItem value="Departments">Departments</SelectItem>
                      <SelectItem value="Events">Events</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">Community</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Members</th>
                        <th className="py-3 px-4">Bumps</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {serversLoading ? (
                        [1, 2, 3, 4].map(i => (
                          <tr key={i}>
                            <td colSpan={7} className="py-3.5 px-4">
                              <Skeleton className="h-4 w-full bg-white/[0.03]" />
                            </td>
                          </tr>
                        ))
                      ) : servers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-zinc-500">
                            No servers found matching query.
                          </td>
                        </tr>
                      ) : (
                        servers.map(s => (
                          <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4 flex items-center gap-2.5">
                              <ServerIcon serverId={s.id} icon={s.icon} name={s.name} size="sm" />
                              <div>
                                <div className="font-semibold text-white flex items-center gap-1.5">
                                  <span>{s.name}</span>
                                  {s.verified && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]">
                                      VERIFIED
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-500 font-mono">{s.id}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-zinc-400">
                              {s.ownerDisplayName || s.ownerUsername ? (
                                <span className="text-zinc-200 font-medium">{s.ownerDisplayName || s.ownerUsername}</span>
                              ) : s.ownerId ? (
                                <span className="font-mono text-[10px] text-zinc-500">{s.ownerId}</span>
                              ) : (
                                <span className="text-zinc-600">Unclaimed</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-300">
                                {s.category || 'Roleplay Server'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-300 font-medium">{s.memberCount || 0}</td>
                            <td className="py-3 px-4 text-zinc-400">{s.bumps || 0}</td>
                            <td className="py-3 px-4">
                              {s.delisted ? (
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]">
                                  Removed
                                </Badge>
                              ) : s.hidden ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                  Hidden
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)] text-[10px]">
                                  Published
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Verify / Unverify */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setServerActionModal({
                                      open: true,
                                      server: s,
                                      action: s.verified ? 'unverify' : 'verify',
                                      reason: s.verified ? 'Verification revoked by administration' : 'Verification granted'
                                    });
                                  }}
                                  className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
                                  title={s.verified ? 'Revoke verification' : 'Grant verification'}
                                >
                                  <Shield className="size-3.5" />
                                </Button>

                                {/* Hide / Restore */}
                                {s.hidden || s.delisted ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setServerActionModal({
                                        open: true,
                                        server: s,
                                        action: 'restore',
                                        reason: 'Restored directory visibility'
                                      });
                                    }}
                                    className="h-7 px-2 text-xs text-[var(--accent)] hover:text-[var(--accent)]"
                                    title="Restore visibility"
                                  >
                                    <Eye className="size-3.5" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setServerActionModal({
                                        open: true,
                                        server: s,
                                        action: 'hide',
                                        reason: 'Violates platform listing guidelines'
                                      });
                                    }}
                                    className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300"
                                    title="Hide from directory"
                                  >
                                    <EyeOff className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              HIDDEN SERVERS TAB (Unfinished, missing invite, bot missing)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'hidden_servers' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Hidden Servers</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Servers where setup was never completed, bot left, or invite link is missing.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-64">
                    <Search className="size-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search hidden servers..."
                      value={hiddenServersSearch}
                      onChange={(e) => setHiddenServersSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchHiddenServers()}
                      className="pl-8 h-8 text-xs bg-[#121215] border-white/[0.08]"
                    />
                  </div>

                  <Select value={hiddenReasonFilter} onValueChange={(val: any) => setHiddenReasonFilter(val)}>
                    <SelectTrigger className="w-36 h-8 text-xs bg-[#121215] border-white/[0.08]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121215] border-white/[0.08] text-xs">
                      <SelectItem value="all">All reasons</SelectItem>
                      <SelectItem value="not set up">Not set up</SelectItem>
                      <SelectItem value="no invite">No invite</SelectItem>
                      <SelectItem value="bot missing">Bot missing</SelectItem>
                      <SelectItem value="blacklisted">Blacklisted</SelectItem>
                      <SelectItem value="delisted">Delisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">Community</th>
                        <th className="py-3 px-4">Owner</th>
                        <th className="py-3 px-4">Hidden Reason</th>
                        <th className="py-3 px-4">Missing Item</th>
                        <th className="py-3 px-4">Members</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {hiddenServersLoading ? (
                        [1, 2, 3, 4].map(i => (
                          <tr key={i} className="animate-pulse">
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-32" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-20" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-24" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-28" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-12" /></td>
                          </tr>
                        ))
                      ) : hiddenServers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-zinc-500">
                            No hidden servers found.
                          </td>
                        </tr>
                      ) : (
                        hiddenServers.map((s) => {
                          const reason = s.hiddenReason || 'not set up';
                          const missingInvite = !s.inviteUrl && !s.discordInvite;
                          const missingDesc = !s.description || s.description === 'ConnectingERLC Verified Community Server';
                          const missingCat = !s.category;
                          const botMissing = s.bot_in_guild === false;

                          return (
                            <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-7 rounded-lg bg-[#19191D] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                    {s.icon || s.iconUrl ? (
                                      <img src={s.icon || s.iconUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                      <Globe className="size-3.5 text-zinc-500" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-white truncate max-w-[180px]">{s.name}</div>
                                    <div className="text-[10px] text-zinc-500 font-mono">{s.id}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-zinc-400">
                                {s.ownerUsername || s.owner_display_name || s.ownerId || '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className={cn(
                                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                                  reason === 'bot missing' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  reason === 'no invite' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                                  reason === 'blacklisted' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                                  reason === 'delisted' ? 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20' :
                                  'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                                )}>
                                  {reason}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-zinc-400 text-[11px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {botMissing && <span className="text-red-400">• Bot left</span>}
                                  {missingInvite && <span className="text-amber-400">• No invite link</span>}
                                  {missingDesc && <span className="text-zinc-400">• Description not saved</span>}
                                  {missingCat && <span className="text-zinc-400">• Category not set</span>}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-zinc-300 font-medium">
                                {s.memberCount && s.memberCount > 1 ? s.memberCount : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              PREMIUM SERVERS TAB (Subscribed, Days remaining, Admin grants)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'premium_servers' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <Sparkles className="size-5 text-[var(--accent)]" />
                    Premium Servers
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                    Manage active premium subscriptions, grant or revoke premium status with full audit logging.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="size-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search servers..."
                      value={premiumSearch}
                      onChange={(e) => setPremiumSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-[#121215] border-white/[0.08]"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPremiumServers}
                    className="h-8 text-xs border-white/[0.08] hover:bg-white/5"
                  >
                    <RefreshCw className={cn("size-3.5 mr-1.5", premiumServersLoading && "animate-spin")} />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#0E0E11] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-[#121215] border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Server</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Days Left</th>
                        <th className="py-3 px-4">Expiry</th>
                        <th className="py-3 px-4">Balance</th>
                        <th className="py-3 px-4">Granted By</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {premiumServersLoading ? (
                        [1, 2, 3, 4].map(i => (
                          <tr key={i} className="animate-pulse">
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-32" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-20" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-16" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-24" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-16" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-20" /></td>
                            <td className="py-4 px-4"><div className="h-4 bg-white/10 rounded w-12 ml-auto" /></td>
                          </tr>
                        ))
                      ) : (() => {
                        const filtered = premiumServers.filter(s => {
                          if (!premiumSearch.trim()) return true;
                          const q = premiumSearch.toLowerCase();
                          return (s.name || '').toLowerCase().includes(q) || (s.id || '').includes(q);
                        });
                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-zinc-500">
                                No servers found.
                              </td>
                            </tr>
                          );
                        }
                        return filtered.map((s) => (
                          <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="size-7 rounded-lg bg-[#19191D] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                  {s.icon ? (
                                    <img src={s.icon.startsWith('http') ? s.icon : `https://cdn.discordapp.com/icons/${s.id}/${s.icon}.png`} alt="" className="size-full object-cover" />
                                  ) : (
                                    <Globe className="size-3.5 text-zinc-500" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-white truncate max-w-[180px]">{s.name}</div>
                                  <div className="text-[10px] text-zinc-500 font-mono">{s.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {s.is_premium ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
                                  <Sparkles className="size-2.5" />
                                  Premium
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-white/5">
                                  Standard
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-medium">
                              {s.is_premium ? `${s.daysLeft}d` : '—'}
                            </td>
                            <td className="py-3 px-4 text-zinc-400 text-[11px]">
                              {s.premiumUntil ? new Date(s.premiumUntil).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 px-4 text-zinc-300 font-medium">
                              {s.balance || 0} cr
                            </td>
                            <td className="py-3 px-4 text-zinc-400 text-[11px]">
                              {s.premium_granted_by ? (
                                <span title={s.premium_grant_reason || ''}>{s.premium_granted_by}</span>
                              ) : s.is_premium ? (
                                'Purchased'
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setGrantTargetServer(s);
                                    setGrantDays(30);
                                    setGrantReason('');
                                    setGrantModalOpen(true);
                                  }}
                                  className="h-7 px-2 text-[11px] text-zinc-300 hover:text-white hover:bg-white/5"
                                >
                                  {s.is_premium ? 'Extend' : 'Grant'}
                                </Button>
                                {s.is_premium && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setRevokeTargetServer(s);
                                      setRevokeReason('');
                                      setRevokeModalOpen(true);
                                    }}
                                    className="h-7 px-2 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                  >
                                    Revoke
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              4. REPORTS TAB (Open, Reviewing, Resolved, Dismissed)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'reports' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Community Reports</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Review member flags against servers, reviews, and community owners with live moderation telemetry.</p>
                </div>

                <Select value={reportStatusFilter} onValueChange={(val) => setReportStatusFilter(val)}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-[#121215] border-white/[0.08]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121215] border-white/[0.08] text-xs">
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Open / Pending</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reportsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-32 rounded-2xl bg-white/[0.03]" />
                  ))}
                </div>
              ) : reports.length === 0 ? (
                <div className="p-12 rounded-2xl border border-white/[0.08] bg-[#121215] text-center text-xs text-zinc-500">
                  No reports found matching selected status filter.
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map(r => (
                    <div key={r.id} className="p-5 rounded-2xl border border-white/[0.08] bg-[#121215] space-y-4">
                      {/* Top Bar: Status, Reason, ID & Date */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] font-semibold uppercase px-2 py-0.5 ${
                            r.status === 'resolved'
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]'
                              : r.status === 'dismissed'
                              ? 'bg-zinc-800 text-zinc-400 border-white/[0.08]'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {r.status}
                          </Badge>
                          <span className="text-xs font-semibold text-white px-2 py-0.5 rounded-md bg-white/[0.06]">
                            {r.reason}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">ID: {r.id}</span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          Reported {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {/* Dual Information Grid: Reported Server & Server Owner */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Reported Community / Server */}
                        <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#0E0E11] space-y-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            Reported Community
                          </div>
                          {r.server ? (
                            <div className="flex items-center gap-3">
                              <ServerIcon
                                serverId={r.server.id}
                                icon={r.server.icon}
                                name={r.server.name}
                                size="md"
                                className="size-10 rounded-xl shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white text-sm truncate flex items-center gap-1.5">
                                  <span>{r.server.name}</span>
                                  {r.server.delisted && (
                                    <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-400 border-rose-500/20">
                                      Delisted
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                                  <span>{r.server.category || 'Roleplay Server'}</span>
                                  <span>•</span>
                                  <span>{r.server.memberCount || 0} members</span>
                                </div>
                                <div className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">
                                  Snowflake: {r.server.id}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-zinc-400 py-1">
                              Target Item: <span className="text-white font-mono">{r.targetName || r.targetId}</span>
                            </div>
                          )}
                        </div>

                        {/* Community Owner */}
                        <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#0E0E11] space-y-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            Server Owner
                          </div>
                          {r.owner ? (
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                userId={r.owner.id}
                                avatarUrl={r.owner.avatar}
                                name={r.owner.displayName || r.owner.username}
                                size={40}
                                className="size-10 rounded-full bg-zinc-800 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white text-sm truncate flex items-center gap-1.5">
                                  <span>{r.owner.displayName || r.owner.username}</span>
                                  {r.owner.isBanned && (
                                    <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-400 border-rose-500/20">
                                      Banned
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-0.5">
                                  @{r.owner.username}
                                </div>
                                <div className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">
                                  Owner ID: {r.owner.id}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-zinc-500 py-2">
                              No server owner linked to this record.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Statement Details */}
                      {r.details && (
                        <div className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.02] text-xs text-zinc-300">
                          <span className="text-zinc-500 font-medium block text-[10px] uppercase mb-1">Reporter Statement</span>
                          "{r.details}"
                        </div>
                      )}

                      {/* Footer Actions: Reporter Info & Mod Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <div className="text-[11px] text-zinc-400">
                          Reported by <span className="text-white font-medium">{r.reporterTag}</span> <span className="text-zinc-500 font-mono text-[10px]">({r.reporterId})</span>
                        </div>

                        {r.status === 'pending' || r.status === 'open' || r.status === 'reviewing' ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.owner && !r.owner.isBanned && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to BAN server owner @${r.owner?.username}?`)) {
                                    handleReportActionDirect(r.id, 'ban_owner');
                                  }
                                }}
                                className="h-8 text-xs bg-rose-600/90 hover:bg-rose-600 text-white font-medium"
                              >
                                <Gavel className="size-3.5 mr-1.5" /> Ban Owner
                              </Button>
                            )}

                            {r.server && !r.server.delisted && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to DELIST ${r.server?.name} from the directory?`)) {
                                    handleReportActionDirect(r.id, 'delist_server');
                                  }
                                }}
                                className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-medium"
                              >
                                <EyeOff className="size-3.5 mr-1.5" /> Delist Server
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReportActionDirect(r.id, 'dismissed')}
                              className="h-8 text-xs border-white/[0.08] text-zinc-400 hover:text-white"
                            >
                              <X className="size-3.5 mr-1.5" /> Dismiss
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleReportActionDirect(r.id, 'resolved')}
                              className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                            >
                              <Check className="size-3.5 mr-1.5" /> Resolve Report
                            </Button>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                            <CheckCircle className="size-3.5 text-emerald-400" />
                            <span>Action completed ({r.status})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              4b. BUG REPORTS TAB (Global /bugreport Submissions)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'bugs' && (
            <AdminTabErrorBoundary tabName="Bug reports">
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 font-sans">
                      <Bug className="size-6 text-[var(--accent)]" />
                      Bug Reports
                      <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                        {bugs.length} total
                      </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-sans">
                      Review in-game and dashboard bug reports submitted via /bugreport.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await adminFetch('/api/admin/test-invite-expired-dm', {
                            method: 'POST',
                            body: JSON.stringify({ adminUserId: '523693281541095424' })
                          });
                          const data = await res.json();
                          if (res.ok) {
                            showFeedback('Components V2 test DM sent to admin 523693281541095424!');
                          } else {
                            showFeedback(data.error || 'Failed to dispatch test DM', 'error');
                          }
                        } catch {
                          showFeedback('Network error sending test DM', 'error');
                        }
                      }}
                      className="h-8 text-xs border-white/[0.08] hover:bg-white/5 font-sans cursor-pointer flex items-center gap-1.5 text-zinc-300 hover:text-white"
                    >
                      <Send className="size-3 text-emerald-400" />
                      Test V2 Expired DM
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchBugs()}
                      className="h-8 text-xs border-white/[0.08] hover:bg-white/5 font-sans cursor-pointer"
                    >
                      <RefreshCw className={cn("size-3.5 mr-1.5", bugsLoading && "animate-spin")} />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Filter Tabs & Search Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                  {/* Status Pills */}
                  <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-[#121215] p-1 flex-wrap gap-1">
                    {[
                      { id: 'all' as const, label: 'All', count: bugCounts.all },
                      { id: 'pending' as const, label: 'Pending', count: bugCounts.pending, badgeColor: 'bg-blue-500/20 text-blue-300' },
                      { id: 'accepted' as const, label: 'Accepted', count: bugCounts.accepted, badgeColor: 'bg-emerald-500/20 text-emerald-300' },
                      { id: 'rejected' as const, label: 'Rejected', count: bugCounts.rejected, badgeColor: 'bg-rose-500/20 text-rose-300' },
                      { id: 'duplicate' as const, label: 'Duplicate', count: bugCounts.duplicate, badgeColor: 'bg-zinc-700 text-zinc-300' },
                    ].map((tab) => {
                      const isActive = bugFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setBugFilter(tab.id);
                            fetchBugs(tab.id);
                          }}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer font-sans',
                            isActive
                              ? 'bg-[#1C1C21] text-white shadow-xs'
                              : 'text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          <span>{tab.label}</span>
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.2 rounded-full font-semibold',
                              isActive ? (tab.badgeColor || 'bg-white/10 text-zinc-200') : 'bg-white/5 text-zinc-400'
                            )}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full md:w-72">
                    <Search className="size-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search title, details, reporter..."
                      value={bugSearch}
                      onChange={(e) => setBugSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-[#121215] border-white/[0.08] font-sans"
                    />
                  </div>
                </div>

                {/* Bug Reports Cards List */}
                {bugsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-44 rounded-xl border border-white/[0.06] bg-[#0E0E11] p-5 space-y-3 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-white/10 shrink-0" />
                          <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 bg-white/10 rounded w-36" />
                            <div className="h-2.5 bg-white/5 rounded w-24" />
                          </div>
                        </div>
                        <div className="h-4 bg-white/10 rounded w-2/3" />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="h-16 bg-white/5 rounded" />
                          <div className="h-16 bg-white/5 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredBugs.length === 0 ? (
                  <div className="p-12 rounded-xl border border-white/[0.08] bg-[#0E0E11] text-center space-y-2">
                    <Bug className="size-8 text-zinc-600 mx-auto" />
                    <div className="text-sm font-medium text-white font-sans">No bug reports found</div>
                    <p className="text-xs text-zinc-500 font-sans">
                      {bugSearch ? 'Try a different search term or clear the filter.' : 'No bug reports submitted for this filter.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredBugs.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl border border-white/[0.08] bg-[#0E0E11] hover:border-white/[0.18] transition-all p-5 space-y-4 shadow-sm"
                      >
                        {/* Reporter & Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              userId={b.userId}
                              avatarUrl={b.avatarUrl}
                              name={b.displayName || b.username}
                              size={40}
                              className="rounded-full ring-1 ring-white/10 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-white truncate font-sans">
                                  {b.displayName || b.username}
                                </span>
                                <span className="text-[11px] text-zinc-400 font-sans">
                                  @{b.username}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-sans mt-0.5">
                                <span className="font-mono text-[10px]">ID: {b.userId}</span>
                                <span className="text-zinc-600">•</span>
                                <span className="font-mono text-[10px] text-zinc-600">Ticket #{b.id.slice(-6)}</span>
                                <span className="text-zinc-600">•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3 text-zinc-500" />
                                  {new Date(b.createdAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge & Reward Indicator */}
                          <div className="flex items-center gap-2 shrink-0">
                            {b.rewardGiven && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25 font-sans">
                                <Sparkles className="size-3 text-amber-400" />
                                +50 Credits Awarded
                              </span>
                            )}
                            {b.pendingReward && !b.rewardGiven && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25 font-sans">
                                <Sparkles className="size-3 text-amber-400" />
                                +50 Credits Pending
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 font-sans',
                                b.status === 'accepted'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : b.status === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : b.status === 'duplicate'
                                  ? 'bg-zinc-800 text-zinc-400 border-white/[0.08]'
                                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              )}
                            >
                              {b.status === 'accepted' && <CheckCircle className="size-3" />}
                              {b.status === 'rejected' && <XCircle className="size-3" />}
                              {b.status === 'duplicate' && <Copy className="size-3" />}
                              {b.status === 'pending' && <Clock className="size-3" />}
                              <span className="capitalize">{b.status}</span>
                            </Badge>
                          </div>
                        </div>

                        {/* Title */}
                        <div>
                          <h3 className="text-[15px] font-semibold text-white font-sans leading-snug">
                            {b.title}
                          </h3>
                        </div>

                        {/* What Happened & Steps Content */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
                          <div className="p-3.5 rounded-xl bg-[#141417] border border-white/[0.05] space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                              <AlertCircle className="size-3 text-zinc-400" />
                              What Happened
                            </div>
                            <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed line-clamp-4">
                              {b.description}
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-[#141417] border border-white/[0.05] space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                              <Layers className="size-3 text-zinc-400" />
                              Steps to Reproduce
                            </div>
                            <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed line-clamp-4">
                              {b.stepsToReproduce}
                            </p>
                          </div>
                        </div>

                        {/* Reviewer Notice (if reviewed) */}
                        {b.reviewedBy && (
                          <div className="p-3 rounded-lg bg-[#141417]/60 border border-white/[0.04] text-[11px] text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-sans">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-zinc-500">Reviewed by</span>
                              <span className="text-white font-medium">{b.reviewedBy}</span>
                              {b.reviewedAt && (
                                <span className="text-zinc-500">on {new Date(b.reviewedAt).toLocaleDateString()}</span>
                              )}
                              {b.staffNotes && (
                                <>
                                  <span className="text-zinc-600">—</span>
                                  <span className="text-zinc-300 italic">"{b.staffNotes}"</span>
                                </>
                              )}
                            </div>
                            {b.dmDelivered === false && (
                              <span className="text-amber-400 text-[10px]">{b.dmNote || 'DMs closed'}</span>
                            )}
                          </div>
                        )}

                        {/* Card Footer: Actions */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.04]">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setSelectedBug(b); setBugStaffNote(b.staffNotes || ''); }}
                            className="h-8 text-xs border-white/[0.08] hover:bg-white/5 text-zinc-300 hover:text-white cursor-pointer font-sans"
                          >
                            Review & Details
                          </Button>
                          {b.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBugAction(b.id, 'rejected')}
                                disabled={bugSubmitting}
                                className="h-8 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer font-sans"
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleBugAction(b.id, 'accepted')}
                                disabled={bugSubmitting}
                                className="h-8 px-3 text-xs bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] font-semibold cursor-pointer font-sans"
                              >
                                Accept (+50 Cr)
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bug Details & Action Modal */}
                {selectedBug && (
                  <Dialog open={true} onOpenChange={() => setSelectedBug(null)}>
                    <DialogContent className="max-w-xl bg-[#0E0E11] border border-white/[0.1] text-white font-sans p-6 rounded-2xl space-y-5 shadow-2xl">
                      <DialogHeader className="space-y-3 pb-3 border-b border-white/[0.07]">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full font-sans',
                              selectedBug.status === 'accepted'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : selectedBug.status === 'rejected'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : selectedBug.status === 'duplicate'
                                ? 'bg-zinc-800 text-zinc-400 border-white/[0.08]'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            )}
                          >
                            {selectedBug.status}
                          </Badge>
                          <span className="text-[10px] font-mono text-zinc-500">ID: {selectedBug.id}</span>
                        </div>

                        {/* Reporter Banner */}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141417] border border-white/[0.05]">
                          <UserAvatar
                            userId={selectedBug.userId}
                            avatarUrl={selectedBug.avatarUrl}
                            name={selectedBug.displayName || selectedBug.username}
                            size={44}
                            className="rounded-full ring-1 ring-white/10 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-white font-sans">
                              {selectedBug.displayName || selectedBug.username}
                            </div>
                            <div className="text-[11px] text-zinc-400 font-sans flex items-center gap-2">
                              <span>@{selectedBug.username}</span>
                              <span className="text-zinc-600">•</span>
                              <span className="font-mono text-zinc-500">{selectedBug.userId}</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-zinc-500 font-sans text-right">
                            <div>Submitted</div>
                            <div>{new Date(selectedBug.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>

                        <DialogTitle className="text-base font-bold text-white pt-1">
                          {selectedBug.title}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-3.5 text-xs">
                        <div className="p-3.5 rounded-xl bg-[#141417] border border-white/[0.06] space-y-1.5">
                          <div className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                            <AlertCircle className="size-3 text-zinc-400" />
                            What Happened
                          </div>
                          <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed">{selectedBug.description}</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#141417] border border-white/[0.06] space-y-1.5">
                          <div className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                            <Layers className="size-3 text-zinc-400" />
                            Steps to Reproduce
                          </div>
                          <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed">{selectedBug.stepsToReproduce}</p>
                        </div>

                        {/* Bounty Reward Eligibility */}
                        <div className="p-3.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 space-y-1.5 font-sans">
                          <div className="font-semibold text-amber-400 text-[11px] flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-amber-400" />
                            Bounty Reward Eligibility
                          </div>
                          <p className="text-zinc-300 text-[11px] leading-relaxed">
                            {selectedBug.rewardGiven
                              ? (selectedBug.rewardGuildId === 'pending'
                                  ? '50 credits are pending: will auto-deposit once the reporter lists their first server.'
                                  : `50 credits already awarded to guild ${selectedBug.rewardGuildId}.`)
                              : 'When marked Accepted, 50 credits are awarded to the reporter’s listed server wallet. If no server is listed yet, a pending 50 credit reward is saved and deposits automatically when they list their first server.'}
                          </p>
                        </div>

                        {selectedBug.dmDelivered === false && (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-sans">
                            Notice: {selectedBug.dmNote || 'Recipient Discord DMs are closed or private.'}
                          </div>
                        )}

                        {/* Staff Notes */}
                        <div className="space-y-1.5 pt-1 font-sans">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-medium text-zinc-400">Staff internal note / reason (sent to reporter in DM):</label>
                            <div className="flex items-center gap-1">
                              {['Fixed in next update', 'Duplicate ticket', 'Works as intended'].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setBugStaffNote(preset)}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea
                            value={bugStaffNote}
                            onChange={(e) => setBugStaffNote(e.target.value)}
                            placeholder="Add notes explaining the decision..."
                            className="w-full h-20 p-2.5 rounded-xl bg-[#141417] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)] font-sans resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBug(null)}
                          disabled={bugSubmitting}
                          className="h-8 text-xs text-zinc-400 cursor-pointer font-sans"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSendTestDM(selectedBug.id)}
                          disabled={bugSubmitting}
                          className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer font-sans"
                        >
                          Send Test DM
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleBugAction(selectedBug.id, 'duplicate')}
                          disabled={bugSubmitting}
                          className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer font-sans"
                        >
                          Duplicate
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleBugAction(selectedBug.id, 'rejected')}
                          disabled={bugSubmitting}
                          className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer font-sans"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleBugAction(selectedBug.id, 'accepted')}
                          disabled={bugSubmitting}
                          className="h-8 text-xs bg-[var(--accent)] hover:opacity-90 text-[var(--accent-foreground)] font-semibold cursor-pointer font-sans"
                        >
                          {bugSubmitting ? 'Saving...' : 'Accept (+50 Credits)'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </AdminTabErrorBoundary>
          )}

          {/* ═══════════════════════════════════════════════════════════
              5. FLAGS TAB (Moderation Queue & Detector Rules)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'flags' && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              {/* Header with Subtabs Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Moderation Queue</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                    Review automated abuse flags, farming activity, and detector sensitivity thresholds.
                  </p>
                </div>

                <div className="flex items-center gap-2 p-1 rounded-xl bg-[#0E0E11] border border-white/[0.06] shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setFlagsSubtab('queue')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      flagsSubtab === 'queue'
                        ? 'bg-zinc-800 text-white font-semibold border border-white/[0.08]'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Queue ({flags.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlagsSubtab('rules')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      flagsSubtab === 'rules'
                        ? 'bg-zinc-800 text-white font-semibold border border-white/[0.08]'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Detector Rules
                  </button>
                </div>
              </div>

              {/* Subtab: Queue */}
              {flagsSubtab === 'queue' && (
                <div className="space-y-4">
                  {flagsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-16 rounded-2xl bg-white/[0.03]" />
                      ))}
                    </div>
                  ) : flags.length === 0 ? (
                    <div className="p-16 rounded-2xl border border-white/[0.08] bg-[#121215] text-center space-y-2">
                      <ShieldAlert className="size-8 mx-auto text-zinc-600 mb-2" />
                      <div className="font-semibold text-sm text-white">No flags. Nothing looks suspicious right now.</div>
                      <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        Automated activity monitors and detector rules have not flagged any anomalous events.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                            <tr>
                              <th className="py-3 px-4">Severity</th>
                              <th className="py-3 px-4">Type</th>
                              <th className="py-3 px-4">Involved Entities</th>
                              <th className="py-3 px-4">Evidence Summary</th>
                              <th className="py-3 px-4">Created Date</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {flags.map(f => {
                              const severity = f.severity || 'Medium';
                              const status = f.status || 'Open';
                              return (
                                <tr
                                  key={f.id}
                                  onClick={() => setSelectedFlag(f)}
                                  className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                                >
                                  <td className="py-3.5 px-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                      severity === 'High'
                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                        : severity === 'Low'
                                        ? 'bg-zinc-800 text-zinc-400 border border-white/[0.06]'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}>
                                      {severity}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold text-white">
                                    {f.type}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-2">
                                      {f.userId && (
                                        <div className="flex items-center gap-1.5">
                                          <UserAvatar
                                            userId={f.userId}
                                            avatarUrl={f.userAvatar}
                                            name={f.username || 'User'}
                                            size={20}
                                            className="size-5 rounded-full"
                                          />
                                          <span className="text-zinc-300 font-mono text-[11px]">{f.username || f.userId}</span>
                                        </div>
                                      )}
                                      {(f.serverId || f.guildId) && (
                                        <div className="flex items-center gap-1.5 border-l border-white/[0.08] pl-2">
                                          <ServerIcon
                                            serverId={f.serverId || f.guildId || ''}
                                            icon={f.serverIcon}
                                            name={f.serverName || f.guildName || 'Server'}
                                            size="sm"
                                            className="size-5 rounded-md"
                                          />
                                          <span className="text-zinc-400 text-[11px] truncate max-w-[120px]">
                                            {f.serverName || f.guildName}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-zinc-300 max-w-xs truncate">
                                    {f.evidenceSummary || f.details || 'Automated behavioral anomaly flagged by detector.'}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-zinc-500 text-[11px]">
                                    {f.createdAt || f.timestamp ? new Date(f.createdAt || f.timestamp || '').toLocaleDateString() : '—'}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <Badge variant="outline" className={`text-[10px] font-semibold uppercase ${
                                      status === 'Resolved' || status === 'approved'
                                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]'
                                        : status === 'Dismissed'
                                        ? 'bg-zinc-800 text-zinc-500 border-white/[0.06]'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                      {status}
                                    </Badge>
                                  </td>
                                  <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedFlag(f)}
                                      className="h-7 text-[11px] border-white/[0.08]"
                                    >
                                      Inspect
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Subtab: Rules */}
              {flagsSubtab === 'rules' && (
                <Card className="p-6 rounded-2xl border border-white/[0.08] bg-[#121215] space-y-6 max-w-2xl">
                  <div>
                    <h2 className="text-base font-semibold text-white">Detector Thresholds & Anti-Abuse Rules</h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Configure algorithmic tripwires that trigger moderation review flags. Changes write to the audit log.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white">
                        Max joins and leaves per account per day
                      </label>
                      <p className="text-[11px] text-zinc-500">
                        Flags accounts repeatedly cycling in and out of communities to farm bounties.
                      </p>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={detectorRules.joinsLeavesPerAccountPerDay}
                        onChange={(e) => setDetectorRules({ ...detectorRules, joinsLeavesPerAccountPerDay: parseInt(e.target.value) || 1 })}
                        className="h-9 text-xs bg-[#0E0E11] border-white/[0.08] max-w-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white">
                        Minimum stay before leave counts as farming (hours)
                      </label>
                      <p className="text-[11px] text-zinc-500">
                        Members leaving earlier than this threshold after claiming bounty trigger a review flag.
                      </p>
                      <Input
                        type="number"
                        min="1"
                        max="720"
                        value={detectorRules.minStayHours}
                        onChange={(e) => setDetectorRules({ ...detectorRules, minStayHours: parseInt(e.target.value) || 1 })}
                        className="h-9 text-xs bg-[#0E0E11] border-white/[0.08] max-w-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-white">
                        Max recruits from one inviter per hour
                      </label>
                      <p className="text-[11px] text-zinc-500">
                        Rapid clustering of incoming recruits from a single inviter link triggers sybil flag.
                      </p>
                      <Input
                        type="number"
                        min="1"
                        max="500"
                        value={detectorRules.recruitsPerInviterPerHour}
                        onChange={(e) => setDetectorRules({ ...detectorRules, recruitsPerInviterPerHour: parseInt(e.target.value) || 1 })}
                        className="h-9 text-xs bg-[#0E0E11] border-white/[0.08] max-w-xs"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {detectorRules.updatedAt ? `Last tuned: ${new Date(detectorRules.updatedAt).toLocaleString()}` : 'Default policy'}
                    </span>
                    <Button
                      onClick={handleSaveRules}
                      disabled={savingRules}
                      className="h-8 px-4 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                    >
                      {savingRules ? 'Saving...' : 'Save Detector Rules'}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Slide-over Sheet for Flag Details & Moderation Actions */}
              <Sheet open={Boolean(selectedFlag)} onOpenChange={(open) => !open && setSelectedFlag(null)}>
                <SheetContent side="right" className="w-full sm:max-w-lg bg-[#0E0E11] border-l border-white/[0.08] p-6 space-y-6 overflow-y-auto text-white">
                  {selectedFlag && (
                    <>
                      <SheetHeader className="text-left space-y-2 border-b border-white/[0.06] pb-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            (selectedFlag.severity || 'Medium') === 'High'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {selectedFlag.severity || 'Medium'} Severity
                          </span>
                          <span className="text-xs font-mono text-zinc-500">{selectedFlag.id}</span>
                        </div>
                        <SheetTitle className="text-lg font-bold text-white">{selectedFlag.type}</SheetTitle>
                        <SheetDescription className="text-xs text-zinc-400">
                          Automated telemetry event detected {selectedFlag.createdAt || selectedFlag.timestamp ? new Date(selectedFlag.createdAt || selectedFlag.timestamp || '').toLocaleString() : 'recently'}.
                        </SheetDescription>
                      </SheetHeader>

                      {/* Involved Entities */}
                      <div className="space-y-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          Involved Entities
                        </div>
                        <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#121215] space-y-3">
                          {selectedFlag.userId && (
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                userId={selectedFlag.userId}
                                avatarUrl={selectedFlag.userAvatar}
                                name={selectedFlag.username || 'User'}
                                size={36}
                                className="size-9 rounded-full"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-white">{selectedFlag.username || 'User'}</div>
                                <div className="text-[10px] font-mono text-zinc-500">ID: {selectedFlag.userId}</div>
                              </div>
                            </div>
                          )}

                          {(selectedFlag.serverId || selectedFlag.guildId) && (
                            <div className="flex items-center gap-3 border-t border-white/[0.04] pt-2.5">
                              <ServerIcon
                                serverId={selectedFlag.serverId || selectedFlag.guildId || ''}
                                icon={selectedFlag.serverIcon}
                                name={selectedFlag.serverName || selectedFlag.guildName || 'Server'}
                                size="sm"
                                className="size-8 rounded-lg"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-white">{selectedFlag.serverName || selectedFlag.guildName}</div>
                                <div className="text-[10px] font-mono text-zinc-500">Guild: {selectedFlag.serverId || selectedFlag.guildId}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Evidence Summary */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          Evidence Summary
                        </div>
                        <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#121215] text-xs text-zinc-300">
                          {selectedFlag.evidenceSummary || selectedFlag.details || 'Suspicious behavioral frequency detected.'}
                        </div>
                      </div>

                      {/* Event Timeline */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          Event Timeline
                        </div>
                        <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#121215] space-y-2 text-xs">
                          {selectedFlag.timeline && selectedFlag.timeline.length > 0 ? (
                            selectedFlag.timeline.map((ev, idx) => (
                              <div key={idx} className="flex items-start gap-2 border-l border-white/[0.08] pl-2.5 py-1">
                                <div className="flex-1">
                                  <div className="text-white font-medium capitalize">{ev.action} by {ev.actor}</div>
                                  {ev.note && <div className="text-zinc-400 text-[11px]">{ev.note}</div>}
                                  <div className="text-zinc-500 text-[10px] font-mono">{new Date(ev.timestamp).toLocaleString()}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-zinc-500 text-xs py-1">
                              Flag created: {selectedFlag.createdAt || selectedFlag.timestamp ? new Date(selectedFlag.createdAt || selectedFlag.timestamp || '').toLocaleString() : 'Initial detection'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Moderation Actions Bar */}
                      <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          Administrative Actions
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            onClick={() => setFlagActionModal({
                              open: true,
                              flag: selectedFlag,
                              action: 'approve',
                              reason: 'Flag inspected and confirmed legitimate',
                              submitting: false
                            })}
                            className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                          >
                            Approve Credit
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setFlagActionModal({
                              open: true,
                              flag: selectedFlag,
                              action: 'reverse',
                              reason: 'Reversing unearned credit from farming pattern',
                              submitting: false
                            })}
                            className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                          >
                            Reverse Credit
                          </Button>

                          {selectedFlag.userId && (
                            <Button
                              size="sm"
                              onClick={() => setFlagActionModal({
                                open: true,
                                flag: selectedFlag,
                                action: 'ban',
                                reason: 'Abuse of community bounty system / multi-accounting',
                                submitting: false
                              })}
                              className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                            >
                              Ban User
                            </Button>
                          )}

                          {(selectedFlag.serverId || selectedFlag.guildId) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setFlagActionModal({
                                open: true,
                                flag: selectedFlag,
                                action: 'hide',
                                reason: 'Listing delisted pending community ownership review',
                                submitting: false
                              })}
                              className="h-8 text-xs border-white/[0.08] text-zinc-300"
                            >
                              Hide Listing
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setFlagActionModal({
                              open: true,
                              flag: selectedFlag,
                              action: 'dismiss',
                              reason: 'False positive / dismissed',
                              submitting: false
                            })}
                            className="h-8 text-xs border-white/[0.08] text-zinc-400"
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </SheetContent>
              </Sheet>

              {/* Action Confirmation Modal */}
              <Dialog open={flagActionModal.open} onOpenChange={(open) => !open && setFlagActionModal({ ...flagActionModal, open: false })}>
                <DialogContent className="bg-[#121215] border border-white/[0.08] text-white max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold capitalize">
                      Confirm Action: {flagActionModal.action}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400">
                      Provide a required administrative reason for this action. This will be permanently recorded in the audit log.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 py-2">
                    <label className="text-xs font-semibold text-white">Administrative Reason</label>
                    <Input
                      placeholder="e.g. Verified farming pattern across 3 accounts"
                      value={flagActionModal.reason}
                      onChange={(e) => setFlagActionModal({ ...flagActionModal, reason: e.target.value })}
                      className="h-9 text-xs bg-[#0E0E11] border-white/[0.08]"
                    />
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFlagActionModal({ ...flagActionModal, open: false })}
                      className="text-xs border-white/[0.08]"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!flagActionModal.reason.trim()}
                      onClick={() => {
                        if (!flagActionModal.flag) return;
                        handleExecuteFlagAction(flagActionModal.flag.id, flagActionModal.action, flagActionModal.reason);
                      }}
                      className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                    >
                      Confirm & Execute
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              6. CREDITS TAB (Ledger, CSV Export, Adjust Tool)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'credits' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Credits Ledger</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Audit transaction history across community growth bounties, bumps, and payouts.</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportLedgerCSV}
                    className="h-8 text-xs border-white/[0.08]"
                  >
                    <Download className="size-3.5 mr-1.5" /> Export CSV
                  </Button>
                  {(adminRole === 'Directive Board' || adminRole === 'Admin' || adminRole === 'Owner') && (
                    <Button
                      size="sm"
                      onClick={() => setDirectiveModalOpen(true)}
                      className="h-8 text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-medium"
                    >
                      <Gift className="size-3.5 mr-1.5" /> Directive Gift
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setCreditTargetUser(null);
                      setCreditModalOpen(true);
                    }}
                    className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                  >
                    <Coins className="size-3.5 mr-1.5" /> Adjust Credits
                  </Button>
                </div>
              </div>

              {directiveAllowance && (adminRole === 'Directive Board' || adminRole === 'Admin' || adminRole === 'Owner') && (
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Gift className="size-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">
                        Directive Board Weekly Allowance
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        <span className="text-indigo-400 font-medium">{directiveAllowance.remainingThisWeek}</span> of {directiveAllowance.weeklyCap} credits available this week (resets Mondays 00:00 UTC).
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setDirectiveModalOpen(true)}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
                  >
                    Gift to Server
                  </Button>
                </div>
              )}

              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Transaction ID</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">User / Guild</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {ledgerLoading ? (
                        [1, 2, 3, 4].map(i => (
                          <tr key={i}>
                            <td colSpan={6} className="py-3.5 px-4">
                              <Skeleton className="h-4 w-full bg-white/[0.03]" />
                            </td>
                          </tr>
                        ))
                      ) : ledgerTxs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-zinc-500">
                            No ledger transactions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        ledgerTxs.map(t => (
                          <tr key={t.id || Math.random()} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                              {new Date(t.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">{t.id}</td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-300">
                                {t.type}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">
                              {t.userId && t.userId !== 'NULL' ? `User: ${t.userId}` : `Guild: ${t.guildId || 'Platform'}`}
                            </td>
                            <td className="py-3 px-4 font-semibold text-white">
                              <span className={t.amount >= 0 ? 'text-[var(--accent)]' : 'text-rose-400'}>
                                {t.amount >= 0 ? `+${t.amount}` : t.amount} cr
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-400">{t.description}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Directive Board Gift Modal */}
              <Dialog open={directiveModalOpen} onOpenChange={setDirectiveModalOpen}>
                <DialogContent className="max-w-md bg-zinc-950 border-white/[0.1]">
                  <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                      <Gift className="size-4 text-indigo-400" />
                      Directive Board Credit Gift
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400">
                      Gift community growth credits directly to a server. Maximum 500 credits per week. Cannot gift to servers you own or manage.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 py-2 text-xs">
                    {directiveAllowance && (
                      <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-indigo-300 flex justify-between items-center">
                        <span>Weekly Remaining:</span>
                        <span className="font-semibold text-white">{directiveAllowance.remainingThisWeek} credits</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-zinc-300 font-medium">Target Server ID</label>
                      <Input
                        placeholder="e.g. 1347902300324368414"
                        value={directiveTargetServer}
                        onChange={(e) => setDirectiveTargetServer(e.target.value)}
                        className="bg-[#0E0E11] border-white/[0.08] text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-300 font-medium">Gift Amount (credits)</label>
                      <Input
                        type="number"
                        min="1"
                        max={directiveAllowance?.remainingThisWeek || 500}
                        value={directiveAmount}
                        onChange={(e) => setDirectiveAmount(parseInt(e.target.value, 10) || 0)}
                        className="bg-[#0E0E11] border-white/[0.08] text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-300 font-medium">Required Reason</label>
                      <Input
                        placeholder="e.g. Exceptional event sponsorship and growth reward"
                        value={directiveReason}
                        onChange={(e) => setDirectiveReason(e.target.value)}
                        className="bg-[#0E0E11] border-white/[0.08] text-xs"
                      />
                    </div>
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setDirectiveModalOpen(false)} className="text-xs border-white/[0.08]" disabled={directiveGifting}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDirectiveGift}
                      disabled={directiveGifting || !directiveTargetServer.trim() || directiveAmount <= 0 || !directiveReason.trim()}
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                    >
                      {directiveGifting ? 'Gifting...' : 'Confirm Gift'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SERVER SHOP MANAGEMENT TAB (Phase E1)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'shop' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <ShoppingBag className="size-5 text-[var(--accent)]" />
                    Server Shop & Boosts
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                    Configure shop boost catalog, prices, and grant or revoke boosts to communities with administrative logging.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setGrantBoostModalOpen(true)}
                    className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                  >
                    <Sparkles className="size-3.5 mr-1.5" /> Grant Boost
                  </Button>
                </div>
              </div>

              {/* Shop Items Table */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">Catalog Items</span>
                  <span className="text-[11px] text-zinc-500">Live in database & admin settings</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">Item Name</th>
                        <th className="py-3 px-4">Effect</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Price</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {shopItemsLoading ? (
                        <tr><td colSpan={6} className="py-8 text-center text-zinc-500">Loading catalog...</td></tr>
                      ) : shopItemsList.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-zinc-500">No shop items defined.</td></tr>
                      ) : (
                        shopItemsList.map((item) => (
                          <tr key={item.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4 font-medium text-zinc-200">
                              <div>{item.name}</div>
                              <div className="text-[11px] text-zinc-500 mt-0.5">{item.description}</div>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">{item.effect}</td>
                            <td className="py-3 px-4 text-zinc-300">
                              {Math.round(item.durationMs / 86400000)} days
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-amber-400">{item.price}</span> cr
                            </td>
                            <td className="py-3 px-4">
                              {item.isActive ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-zinc-800 text-zinc-400 border-white/[0.08]">Disabled</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingShopItem({ ...item });
                                  setEditShopItemModalOpen(true);
                                }}
                                className="h-7 text-xs border-white/[0.08]"
                              >
                                Edit Item
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edit Shop Item Modal */}
              <Dialog open={editShopItemModalOpen} onOpenChange={setEditShopItemModalOpen}>
                <DialogContent className="max-w-md bg-zinc-950 border-white/[0.1]">
                  <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-zinc-100">
                      Edit Shop Item
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400">
                      Update price, description, and visibility for {editingShopItem?.name}.
                    </DialogDescription>
                  </DialogHeader>

                  {editingShopItem && (
                    <div className="space-y-3 py-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-zinc-300 font-medium">Display Name</label>
                        <Input
                          value={editingShopItem.name}
                          onChange={(e) => setEditingShopItem({ ...editingShopItem, name: e.target.value })}
                          className="bg-[#0E0E11] border-white/[0.08] text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-zinc-300 font-medium">Price (credits)</label>
                        <Input
                          type="number"
                          min="0"
                          value={editingShopItem.price}
                          onChange={(e) => setEditingShopItem({ ...editingShopItem, price: parseInt(e.target.value, 10) || 0 })}
                          className="bg-[#0E0E11] border-white/[0.08] text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-zinc-300 font-medium">Description</label>
                        <Input
                          value={editingShopItem.description}
                          onChange={(e) => setEditingShopItem({ ...editingShopItem, description: e.target.value })}
                          className="bg-[#0E0E11] border-white/[0.08] text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="item_active_check"
                          checked={editingShopItem.isActive}
                          onChange={(e) => setEditingShopItem({ ...editingShopItem, isActive: e.target.checked })}
                          className="rounded border-zinc-700 bg-zinc-900"
                        />
                        <label htmlFor="item_active_check" className="text-zinc-300 cursor-pointer">
                          Item enabled and purchasable in shop
                        </label>
                      </div>
                    </div>
                  )}

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setEditShopItemModalOpen(false)} className="text-xs border-white/[0.08]">
                      Cancel
                    </Button>
                    <Button onClick={handleSaveShopItem} className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-medium">
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Grant Boost Modal */}
              <Dialog open={grantBoostModalOpen} onOpenChange={setGrantBoostModalOpen}>
                <DialogContent className="max-w-md bg-zinc-950 border-white/[0.1]">
                  <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                      <Sparkles className="size-4 text-[var(--accent)]" />
                      Grant Server Boost
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400">
                      Grant or extend an active server boost with full administrative audit logging.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 py-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-medium">Target Server ID</label>
                      <Input
                        placeholder="e.g. 1561253849816113265"
                        value={grantBoostServerId}
                        onChange={(e) => setGrantBoostServerId(e.target.value)}
                        className="bg-[#0E0E11] border-white/[0.08] text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-300 font-medium">Boost Effect</label>
                      <Select value={grantBoostEffect} onValueChange={(v) => setGrantBoostEffect(v)}>
                        <SelectTrigger className="w-full text-xs bg-[#0E0E11] border-white/[0.08]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0E0E11] border-white/[0.08] text-xs">
                          <SelectItem value="double_bumps">2x Bumps (Halved cooldown)</SelectItem>
                          <SelectItem value="premium">Premium Status</SelectItem>
                          <SelectItem value="auto_bump">Auto Bump</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-300 font-medium">Duration (days)</label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={grantBoostDays}
                        onChange={(e) => setGrantBoostDays(parseInt(e.target.value, 10) || 1)}
                        className="bg-[#0E0E11] border-white/[0.08] text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-300 font-medium">Administrative Reason</label>
                      <Input
                        placeholder="e.g. Compensation for downtime or community partnership reward"
                        value={grantBoostReason}
                        onChange={(e) => setGrantBoostReason(e.target.value)}
                        className="bg-[#0E0E11] border-white/[0.08] text-xs"
                      />
                    </div>
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setGrantBoostModalOpen(false)} className="text-xs border-white/[0.08]" disabled={grantingBoost}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleGrantBoost}
                      disabled={grantingBoost || !grantBoostServerId.trim() || !grantBoostReason.trim()}
                      className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                    >
                      {grantingBoost ? 'Granting...' : 'Confirm & Grant Boost'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              PROMO CODES TAB
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'promos' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Promotional Codes</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                    Generate and manage promotional reward codes that deposit credits into community server treasuries.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.open('/api/admin/promos/export', '_blank');
                    }}
                    className="h-8 text-xs border-white/[0.08]"
                  >
                    <Download className="size-3.5 mr-1.5" /> Export CSV
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setPromoCodeInput('');
                      setPromoCreditsInput('100');
                      setPromoMaxUsesInput('10');
                      setCreatePromoOpen(true);
                    }}
                    className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                  >
                    <Plus className="size-3.5 mr-1.5" /> New Promo Code
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Reward Amount</th>
                        <th className="py-3 px-4">Redemptions</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Expires</th>
                        <th className="py-3 px-4">Created</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {promosLoading ? (
                        [1, 2, 3].map((i) => (
                          <tr key={i}>
                            <td colSpan={7} className="py-3.5 px-4">
                              <Skeleton className="h-4 w-full bg-white/[0.03]" />
                            </td>
                          </tr>
                        ))
                      ) : promos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-zinc-500">
                            No promotional codes created yet. Click "New Promo Code" to get started.
                          </td>
                        </tr>
                      ) : (
                        promos.map((p) => (
                          <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-white tracking-wider">
                              <span className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/10 select-all">
                                {p.code}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-[var(--accent)] font-mono">
                              +{p.credits} cr
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-300">
                              {p.used_count || 0} / {p.max_uses || '∞'}
                            </td>
                            <td className="py-3 px-4">
                              {p.active ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                                  Disabled
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                              {p.expires_at ? new Date(p.expires_at).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-[11px]">
                              {new Date(p.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewRedemptions(p.id)}
                                className="h-7 px-2 text-xs text-zinc-300 hover:text-white"
                              >
                                Uses ({p.used_count || 0})
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleTogglePromo(p.id, !p.active)}
                                className="h-7 px-2 text-xs text-[var(--accent)]"
                              >
                                {p.active ? 'Disable' : 'Enable'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeletePromo(p.id)}
                                className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300"
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              7. BLACKLIST TAB (Manage banned IDs)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'blacklist' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Security Blacklist</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                    Hard restrictions blocking Discord accounts, IP addresses, and CIDR ranges from authentication and publishing.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => setAddBlacklistModalOpen(true)}
                  className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                >
                  <Plus className="size-3.5 mr-1.5" /> Add to Blacklist
                </Button>
              </div>

              {/* Quick Unblacklist Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#121215] border border-white/[0.08]">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-white">Instant Unblacklist</h3>
                  <p className="text-xs text-zinc-400">
                    Enter any Discord User ID, IP address, or CIDR to immediately remove it from the blacklist.
                  </p>
                </div>
                <div className="flex items-center gap-2 max-w-md w-full sm:w-auto">
                  <Input
                    type="text"
                    placeholder="Paste Discord ID, IP, or CIDR..."
                    value={instantUnblacklistInput}
                    onChange={(e) => setInstantUnblacklistInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleInstantUnblacklist(); }}
                    className="h-8 text-xs bg-[#0E0E11] border-white/[0.08] text-white font-mono flex-1 sm:w-72"
                  />
                  <Button
                    size="sm"
                    disabled={!instantUnblacklistInput.trim() || actionSubmitting}
                    onClick={handleInstantUnblacklist}
                    className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold shrink-0"
                  >
                    Unblacklist
                  </Button>
                </div>
              </div>

              {/* Sub-tabs: Accounts vs IPs vs CIDRs */}
              <div className="flex items-center gap-1 p-1 bg-[#121215] border border-white/[0.08] rounded-xl w-fit text-xs">
                <button
                  type="button"
                  onClick={() => setBlacklistSubtab('accounts')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    blacklistSubtab === 'accounts' ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Discord Accounts
                </button>
                <button
                  type="button"
                  onClick={() => setBlacklistSubtab('ips')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    blacklistSubtab === 'ips' ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  IP Addresses
                </button>
                <button
                  type="button"
                  onClick={() => setBlacklistSubtab('cidrs')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    blacklistSubtab === 'cidrs' ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  CIDR Subnets
                </button>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">Identifier / Value</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4">Restricted By</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Added</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {blacklistLoading ? (
                        [1, 2, 3].map((i) => (
                          <tr key={i}>
                            <td colSpan={7} className="py-3.5 px-4">
                              <Skeleton className="h-4 w-full bg-white/[0.03]" />
                            </td>
                          </tr>
                        ))
                      ) : blacklistEntries.filter((b) => {
                          if (blacklistSubtab === 'ips') return b.type === 'ip';
                          if (blacklistSubtab === 'cidrs') return b.type === 'cidr';
                          return b.type === 'discord_id' || !b.type;
                        }).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-zinc-500">
                            No entries found in this blacklist category.
                          </td>
                        </tr>
                      ) : (
                        blacklistEntries
                          .filter((b) => {
                            if (blacklistSubtab === 'ips') return b.type === 'ip';
                            if (blacklistSubtab === 'cidrs') return b.type === 'cidr';
                            return b.type === 'discord_id' || !b.type;
                          })
                          .map((b) => (
                            <tr key={b.id || b.userId || b.value} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 font-semibold text-white font-mono">
                                {b.value || b.userId}
                                {b.username && <span className="ml-2 font-sans text-xs text-zinc-400">({b.username})</span>}
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-300">
                                  {b.type || 'discord_id'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-zinc-300 max-w-xs truncate">{b.reason}</td>
                              <td className="py-3 px-4 text-zinc-400">{b.bannedBy?.username || b.banned_by || 'Admin'}</td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">
                                  {b.duration || 'Permanent'}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-zinc-500 text-[11px]">
                                {new Date(b.bannedAt || b.created_at || Date.now()).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setRemoveBlacklistTarget(b);
                                    setRemoveBlacklistModalOpen(true);
                                  }}
                                  className="h-7 px-2.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20"
                                  title="Unblacklist target"
                                >
                                  Unblacklist
                                </Button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              LAUNCH GIVEAWAY TAB
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'giveaway' && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              {/* Header with On/Off Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#121215] border border-white/[0.08]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Launch Giveaway</h1>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        giveawaySettings?.enabled
                          ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {giveawaySettings?.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    First {giveawaySettings?.max_claims ?? 20} newly listed communities receive {giveawaySettings?.credits_amount ?? 200} free credits deposited directly to their server treasury.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-medium text-zinc-300">Giveaway status</span>
                  <button
                    type="button"
                    disabled={giveawayToggling || giveawayLoading}
                    onClick={handleToggleGiveaway}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                      giveawaySettings?.enabled ? 'bg-[var(--accent)]' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        giveawaySettings?.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Customize Giveaway Configuration Card */}
              <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Customize Giveaway Parameters</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Configure any number of spots (10, 20, 50, 100, etc.) and credit reward per server.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[5, 10, 20, 50, 100].map((presetSpots) => (
                      <button
                        key={presetSpots}
                        type="button"
                        onClick={() => setGiveawayMaxClaimsInput(String(presetSpots))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                          Number(giveawayMaxClaimsInput) === presetSpots
                            ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40'
                            : 'bg-white/[0.03] text-zinc-400 border-white/[0.08] hover:text-white'
                        }`}
                      >
                        {presetSpots} Spots
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-zinc-400">Total Server Spots</label>
                    <Input
                      type="number"
                      min={1}
                      value={giveawayMaxClaimsInput}
                      onChange={(e) => setGiveawayMaxClaimsInput(e.target.value)}
                      placeholder="e.g. 20"
                      className="h-9 bg-[#0E0E11] border-white/[0.08] text-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-zinc-400">Credits Awarded Per Server</label>
                    <Input
                      type="number"
                      min={1}
                      value={giveawayCreditsInput}
                      onChange={(e) => setGiveawayCreditsInput(e.target.value)}
                      placeholder="e.g. 200"
                      className="h-9 bg-[#0E0E11] border-white/[0.08] text-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-zinc-400">Support Server Invite URL</label>
                    <Input
                      type="text"
                      value={giveawaySupportUrlInput}
                      onChange={(e) => setGiveawaySupportUrlInput(e.target.value)}
                      placeholder="https://discord.gg/connectingerlc"
                      className="h-9 bg-[#0E0E11] border-white/[0.08] text-white text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={giveawaySaving}
                    onClick={handleResetGiveawayClaims}
                    className="h-8 text-xs border-white/[0.08] text-zinc-300 hover:text-white"
                  >
                    Reset Claimed Spots (New Round)
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={giveawaySaving}
                      onClick={() => handleSaveGiveawaySettings(false)}
                      className="h-8 text-xs border-white/[0.08]"
                    >
                      Save Settings
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={giveawaySaving}
                      onClick={() => handleSaveGiveawaySettings(true)}
                      className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                    >
                      Save & Launch Giveaway
                    </Button>
                  </div>
                </div>
              </div>

              {/* Metric summary pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-[#121215] border-white/[0.08] p-4 space-y-1">
                  <span className="text-[11px] text-zinc-400 font-medium">Spots Claimed</span>
                  <div className="text-2xl font-bold text-white">
                    {giveawayClaims.length} <span className="text-xs font-normal text-zinc-500">/ {giveawaySettings?.max_claims ?? 20}</span>
                  </div>
                </Card>
                <Card className="bg-[#121215] border-white/[0.08] p-4 space-y-1">
                  <span className="text-[11px] text-zinc-400 font-medium">Spots Remaining</span>
                  <div className="text-2xl font-bold text-[var(--accent)]">
                    {Math.max(0, (giveawaySettings?.max_claims ?? 20) - giveawayClaims.length)}
                  </div>
                </Card>
                <Card className="bg-[#121215] border-white/[0.08] p-4 space-y-1">
                  <span className="text-[11px] text-zinc-400 font-medium">Award Per Server</span>
                  <div className="text-2xl font-bold text-white">
                    {giveawaySettings?.credits_amount ?? 200} cr
                  </div>
                </Card>
              </div>

              {/* Claims List Table */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Claimed Spots ({giveawayClaims.length})</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchGiveaway}
                    disabled={giveawayLoading}
                    className="text-xs border-white/[0.08] hover:bg-white/[0.04]"
                  >
                    <RefreshCw className={`size-3.5 mr-1.5 ${giveawayLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {giveawayLoading && giveawayClaims.length === 0 ? (
                  <div className="p-12 text-center text-xs text-zinc-400">Loading claims...</div>
                ) : giveawayClaims.length === 0 ? (
                  <div className="p-12 text-center text-zinc-400 space-y-2">
                    <p className="text-sm font-medium text-white">No giveaway claims yet</p>
                    <p className="text-xs text-zinc-500">
                      When servers list in the directory, their giveaway claim and spot number will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#141417] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-white/[0.06]">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Spot</th>
                          <th className="py-3 px-4 font-semibold">Community Server</th>
                          <th className="py-3 px-4 font-semibold">Claimed By (Owner)</th>
                          <th className="py-3 px-4 font-semibold">Credits</th>
                          <th className="py-3 px-4 font-semibold">DM Status</th>
                          <th className="py-3 px-4 font-semibold">Claim Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                        {giveawayClaims.map((claim) => (
                          <tr key={claim.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4 font-bold text-[var(--accent)] font-mono">
                              #{claim.spot_number}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <ServerIcon
                                  guildId={claim.server_id}
                                  iconUrl={claim.server_icon}
                                  name={claim.server_name}
                                  size={24}
                                  className="size-6 rounded-md object-cover"
                                />
                                <div>
                                  <div className="font-medium text-white">{claim.server_name}</div>
                                  <div className="font-mono text-[10px] text-zinc-500">{claim.server_id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div>
                                <div className="font-medium text-zinc-200">{claim.owner_username}</div>
                                <div className="font-mono text-[10px] text-zinc-500">{claim.owner_user_id}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-white">
                              +{claim.credits_awarded} cr
                            </td>
                            <td className="py-3 px-4">
                              {claim.dm_sent ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] font-medium">
                                  <Check className="size-3 text-[var(--accent)]" />
                                  DM Delivered
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-medium">
                                  <AlertTriangle className="size-3 text-amber-400" />
                                  Closed DMs (Dashboard)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                              {new Date(claim.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              8. ANNOUNCEMENTS TAB (Banners with live preview)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'announcements' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">In-App Announcements</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Broadcast system notices, maintenance alerts, and major release announcements.</p>
                </div>

                <Button
                  size="sm"
                  onClick={() => setAnnouncementModalOpen(true)}
                  className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                >
                  <Plus className="size-3.5 mr-1.5" /> New Announcement
                </Button>
              </div>

              {/* Default Bug Report Banner Customization (Point 6) */}
              <div className="p-4 sm:p-5 rounded-2xl border border-white/[0.08] bg-[#121215] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Default Top Banner Notice</h3>
                    <p className="text-xs text-zinc-400">Displayed at the top of the site when no broadcast announcement is active.</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={defaultBannerSaving || !defaultBannerText.trim()}
                    onClick={handleSaveDefaultBanner}
                    className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold self-start sm:self-auto cursor-pointer"
                  >
                    {defaultBannerSaving ? 'Saving...' : 'Save Banner Text'}
                  </Button>
                </div>
                <Input
                  value={defaultBannerText}
                  onChange={(e) => setDefaultBannerText(e.target.value)}
                  placeholder="Found a bug? Report it with /bugreport and earn 50 credits"
                  className="h-9 text-xs bg-[#0E0E11] border-white/10 text-white font-sans"
                />
              </div>

              {announcementsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <Skeleton key={i} className="h-20 rounded-2xl bg-white/[0.03]" />
                  ))}
                </div>
              ) : announcements.length === 0 ? (
                <div className="p-12 rounded-2xl border border-white/[0.08] bg-[#121215] text-center text-xs text-zinc-500">
                  No active announcements configured.
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map(a => (
                    <div key={a.id} className="p-4 rounded-2xl border border-white/[0.08] bg-[#121215] flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md ${
                            a.active === false
                              ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              : a.level === 'alert' || a.level === 'critical'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : a.level === 'warning'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {a.active === false ? 'OFF' : (a.level || 'INFO')}
                          </span>
                          <span className="text-xs text-zinc-400">{new Date(a.createdAt).toLocaleString()}</span>
                          {a.endDate && (
                            <span className="text-[11px] text-zinc-500">
                              Ends: {new Date(a.endDate).toLocaleDateString()}
                            </span>
                          )}
                          {a.link && (
                            <span className="text-[11px] text-[var(--accent)] underline truncate max-w-[200px]">
                              {a.link}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white font-medium">{a.text}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleAnnouncement(a)}
                          className={`h-8 px-2.5 text-xs font-semibold ${
                            a.active === false
                              ? 'border-zinc-700 text-zinc-400 hover:text-white'
                              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          {a.active === false ? 'Turn ON' : 'Turn OFF'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteAnnouncement(a.id)}
                          className="h-8 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              9. MAINTENANCE TAB (Switch, Notice, Affected Services)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6 max-w-2xl animate-in fade-in-50 duration-200">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Maintenance Mode</h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Control public downtime screens and maintenance banners while allowing admins to remain signed in.</p>
              </div>

              <Card className="bg-[#121215] border-white/[0.08] p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-white">Maintenance State</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">When enabled, public visitors see the scheduled maintenance screen.</p>
                  </div>

                  <Button
                    onClick={() => handleSaveMaintenance(maintenance.mode === 'operational' ? 'maintenance' : 'operational')}
                    disabled={maintenanceSaving}
                    className={`text-xs font-semibold ${
                      maintenance.mode === 'maintenance'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950'
                    }`}
                  >
                    {maintenance.mode === 'maintenance' ? 'Disable Maintenance' : 'Enable Maintenance'}
                  </Button>
                </div>

                <div className="space-y-3 pt-3 border-t border-white/[0.08]">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Notice Title</label>
                    <Input
                      value={maintenance.title || ''}
                      onChange={(e) => setMaintenance(m => ({ ...m, title: e.target.value }))}
                      placeholder="Scheduled Infrastructure Upgrade"
                      className="text-xs bg-[#0E0E11] border-white/[0.08]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Maintenance Notice Message</label>
                    <textarea
                      value={maintenance.message || ''}
                      onChange={(e) => setMaintenance(m => ({ ...m, message: e.target.value }))}
                      rows={3}
                      placeholder="We are currently upgrading database nodes. All services will resume shortly."
                      className="w-full text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                    <label className="text-xs font-medium text-zinc-300">Feature-Specific Maintenance (Selective)</label>
                    <p className="text-[11px] text-zinc-400">
                      Put individual features under construction if something goes wrong, without bringing down the full website:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { id: 'server-page', label: 'Public Server Page' },
                        { id: 'boosts', label: 'Boosts & Shop' },
                        { id: 'forms', label: 'Applications & Forms' },
                        { id: 'earn', label: 'Earn Credits Directory' },
                        { id: 'partnerships', label: 'Partnerships' },
                      ].map((feature) => {
                        const isSelected = Array.isArray(maintenance.affectedServices) && maintenance.affectedServices.includes(feature.id);
                        return (
                          <button
                            key={feature.id}
                            type="button"
                            onClick={() => {
                              setMaintenance((m) => {
                                const current = Array.isArray(m.affectedServices) ? m.affectedServices : [];
                                const updated = isSelected
                                  ? current.filter((id) => id !== feature.id)
                                  : [...current, feature.id];
                                return { ...m, affectedServices: updated };
                              });
                            }}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-[#0E0E11] text-zinc-400 border-white/[0.08] hover:text-zinc-200'
                            }`}
                          >
                            {feature.label} {isSelected ? '(Under Maintenance)' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={() => handleSaveMaintenance()}
                      disabled={maintenanceSaving}
                      className="text-xs bg-white/10 hover:bg-white/15 text-white"
                    >
                      Save Notice & Maintenance Changes
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              10. CHANGELOG TAB (Publish Markdown notes)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'changelog' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Changelog Manager</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Author, edit, and publish Markdown release notes consumed by the public Changelog page.</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="h-8 text-xs border-white/[0.08] text-zinc-300 hover:text-white"
                  >
                    <Link to="/changelog" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5 mr-1.5" /> View Public Page
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingChangelogVersion(null);
                      setClVersion('');
                      setClTitle('');
                      setClDesc('');
                      setClTags(['new']);
                      setClItems('');
                      setChangelogModalOpen(true);
                    }}
                    className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                  >
                    <Plus className="size-3.5 mr-1.5" /> Publish Release
                  </Button>
                </div>
              </div>

              {changelogLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.03]" />
                  ))}
                </div>
              ) : changelogEntries.length === 0 ? (
                <div className="p-12 rounded-2xl border border-white/[0.08] bg-[#121215] text-center text-xs text-zinc-500">
                  No changelog entries published yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {changelogEntries.map((c: any) => (
                    <div key={c.version} className="p-5 rounded-2xl border border-white/[0.08] bg-[#121215] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)] font-mono">
                            {c.version}
                          </Badge>
                          <span className="font-bold text-white text-sm">{c.title}</span>
                          {Array.isArray(c.tags) && c.tags.map((t: string) => (
                            <span key={t} className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300">
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">{new Date(c.date).toLocaleDateString()}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditChangelog(c)}
                            className="h-7 px-2 text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                          >
                            <Edit2 className="size-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteChangelog(c.version)}
                            className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                          >
                            <Trash2 className="size-3.5 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>

                      {c.description && <p className="text-xs text-zinc-400">{c.description}</p>}
                      <ul className="text-xs text-zinc-300 space-y-1 list-disc pl-4 pt-1">
                        {c.items?.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              11. AUDIT LOG TAB (Every action with actor, reason, export)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'audit' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Administrative Audit Log</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Immutable record of staff actions, ban issuances, credit grants, and directory edits.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-64">
                    <Search className="size-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search audit actions..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchAudit()}
                      className="pl-8 h-8 text-xs bg-[#121215] border-white/[0.08]"
                    />
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportAuditCSV}
                    className="h-8 text-xs border-white/[0.08]"
                  >
                    <Download className="size-3.5 mr-1.5" /> Export CSV
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Actor</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Target</th>
                        <th className="py-3 px-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {auditLoading ? (
                        [1, 2, 3, 4].map(i => (
                          <tr key={i}>
                            <td colSpan={5} className="py-3.5 px-4">
                              <Skeleton className="h-4 w-full bg-white/[0.03]" />
                            </td>
                          </tr>
                        ))
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-zinc-500">
                            No audit log events found.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map(a => (
                          <tr key={a.id || Math.random()} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                              {new Date(a.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-medium text-white">
                              {a.actor?.username || 'Staff'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-300">
                                {a.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">
                              {a.targetType}: {a.target}
                            </td>
                            <td className="py-3 px-4 text-zinc-300 max-w-sm truncate">{a.reason}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              12. SYSTEM TAB (4 Components, Last 20 Checks, Incidents, Alert Recipients)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'system' && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <ThemeSetting />
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">System Diagnostics & Health</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                    Live probe telemetry across Core API, Database, Discord bot, and ER:LC API. Auto-refreshes every 30s.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchSystem}
                    disabled={systemLoading}
                    className="h-8 text-xs border-white/[0.08]"
                  >
                    <RefreshCw className={`size-3.5 mr-1.5 ${systemLoading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSendTestPartnershipDM}
                    disabled={sendingTestPartnershipDM}
                    className="h-8 text-xs border-white/[0.08] text-zinc-300 hover:text-white"
                    title="Send sample Components V2 partnership proposal DM to your Discord account"
                  >
                    <Handshake className={`size-3.5 mr-1.5 ${sendingTestPartnershipDM ? 'animate-pulse' : ''}`} />
                    {sendingTestPartnershipDM ? 'Sending...' : 'Send Test Partnership DM'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSendTestAlert}
                    disabled={sendingTestAlert}
                    className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                  >
                    <Radio className={`size-3.5 mr-1.5 ${sendingTestAlert ? 'animate-pulse' : ''}`} />
                    {sendingTestAlert ? 'Sending...' : 'Send Test Alert'}
                  </Button>
                </div>
              </div>

              {/* Failing Components Alert Banner (Bright Red) */}
              {(systemChecks?.anyDown || systemChecks?.components?.some((c: any) => c.status !== 'Operational')) && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-white">
                  <AlertTriangle className="size-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1">
                    <h3 className="font-semibold text-sm text-rose-300">
                      Service Disruption Detected
                    </h3>
                    <p className="text-xs text-rose-200/80">
                      One or more critical services are currently degraded or down:{' '}
                      <span className="font-semibold text-white">
                        {systemChecks?.components?.filter((c: any) => c.status !== 'Operational').map((c: any) => `${c.name} (${c.status})`).join(', ') || 'Service Alert'}
                      </span>
                      . Telemetry monitors are actively alerting configured Discord recipients.
                    </p>
                  </div>
                </div>
              )}

              {/* 4 Components Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {systemLoading && !systemChecks ? (
                  [1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.03]" />
                  ))
                ) : (
                  (systemChecks?.components || [
                    { name: 'Core API', status: 'Operational', latency_ms: 2 },
                    { name: 'Database', status: 'Operational', latency_ms: 3 },
                    { name: 'Discord bot', status: 'Operational', latency_ms: 15 },
                    { name: 'ER:LC API', status: 'Operational', latency_ms: 120 }
                  ]).map((comp: any) => {
                    const isOp = comp.status === 'Operational';
                    const isDeg = comp.status === 'Degraded';
                    return (
                      <div
                        key={comp.name}
                        className="p-4 rounded-2xl border border-white/[0.08] bg-[#121215] space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">{comp.name}</span>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isOp
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)]'
                              : isDeg
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            <span className={`size-1.5 rounded-full ${isOp ? 'bg-[var(--accent)]' : isDeg ? 'bg-amber-400' : 'bg-rose-500'}`} />
                            {comp.status}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-xl font-bold font-mono text-white">
                            {comp.latency_ms !== undefined ? `${comp.latency_ms}ms` : '—'}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {comp.last_checked_at ? new Date(comp.last_checked_at).toLocaleTimeString() : 'Nominal'}
                          </span>
                        </div>

                        {comp.error_summary && (
                          <div className="text-[11px] text-rose-400 truncate pt-1 border-t border-white/[0.04]">
                            {comp.error_summary}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Alert Notification Recipients */}
              <Card className="p-5 rounded-2xl border border-white/[0.08] bg-[#121215] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Discord Incident Alert Recipients</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Configured administrators notified immediately on component degradation or recovery via Bot Direct Messages.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSendTestAlert}
                    disabled={sendingTestAlert}
                    className="h-8 text-xs border-white/[0.08] self-start sm:self-auto"
                  >
                    <Radio className="size-3.5 mr-1.5" /> Send Test Alert
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {systemChecks?.alertRecipients && systemChecks.alertRecipients.length > 0 ? (
                    systemChecks.alertRecipients.map((id: string) => (
                      <div
                        key={id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0E0E11] border border-white/[0.06] text-xs"
                      >
                        <UserAvatar userId={id} size={18} className="size-4.5 rounded-full" />
                        <span className="font-mono text-zinc-300 text-[11px]">{id}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 pl-1 border-l border-white/[0.08]">
                          <CheckCircle className="size-3 text-[var(--accent)]" /> Reachable
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-500 py-1 font-mono">
                      No ALERT_DISCORD_IDS configured in environment.
                    </div>
                  )}
                </div>
              </Card>

              {/* Table of Recent Checks (Last 20 Probes) */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Telemetry Probe History (Last 20 Checks)
                </h3>
                <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                        <tr>
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Component</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Latency</th>
                          <th className="py-3 px-4">Message / Response</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {systemLoading && !systemChecks ? (
                          [1, 2, 3, 4, 5].map(i => (
                            <tr key={i}>
                              <td colSpan={5} className="py-3 px-4">
                                <Skeleton className="h-4 w-full bg-white/[0.03]" />
                              </td>
                            </tr>
                          ))
                        ) : !systemChecks?.recentChecks?.length ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-zinc-500">
                              No probe telemetry recorded yet.
                            </td>
                          </tr>
                        ) : (
                          systemChecks.recentChecks.map((chk: any, idx: number) => {
                            const isOp = chk.status === 'Operational';
                            const isDeg = chk.status === 'Degraded';
                            return (
                              <tr key={chk.id || idx} className="hover:bg-white/[0.02] transition-colors">
                                <td className="py-3 px-4 font-mono text-zinc-500 text-[11px]">
                                  {chk.checked_at ? new Date(chk.checked_at).toLocaleTimeString() : '—'}
                                </td>
                                <td className="py-3 px-4 font-semibold text-white">
                                  {chk.component}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isOp
                                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)]'
                                      : isDeg
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}>
                                    <span className={`size-1.5 rounded-full ${isOp ? 'bg-[var(--accent)]' : isDeg ? 'bg-amber-400' : 'bg-rose-500'}`} />
                                    {chk.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-mono text-zinc-300">
                                  {chk.latency_ms !== undefined ? `${chk.latency_ms}ms` : '—'}
                                </td>
                                <td className="py-3 px-4 text-zinc-400">
                                  {chk.error_summary || 'Nominal health probe'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Table of Incidents */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Incident Log
                </h3>
                <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                        <tr>
                          <th className="py-3 px-4">Started</th>
                          <th className="py-3 px-4">Resolved</th>
                          <th className="py-3 px-4">Component</th>
                          <th className="py-3 px-4">Reason / Details</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {!systemChecks?.incidents?.length ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-zinc-500">
                              No service incidents recorded. Platform running normally.
                            </td>
                          </tr>
                        ) : (
                          systemChecks.incidents.map((inc: any) => (
                            <tr key={inc.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">
                                {inc.started_at ? new Date(inc.started_at).toLocaleString() : '—'}
                              </td>
                              <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">
                                {inc.resolved_at ? new Date(inc.resolved_at).toLocaleString() : (
                                  <span className="text-amber-400 font-semibold">Ongoing</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-semibold text-white">
                                {inc.component}
                              </td>
                              <td className="py-3 px-4 text-zinc-300">
                                {inc.reason}
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${
                                  inc.status === 'Resolved'
                                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}>
                                  {inc.status || (inc.resolved_at ? 'Resolved' : 'Ongoing')}
                                </Badge>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              13. ADMINS TAB (Online dot, Owner-only Add/Remove)
             ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'admins' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Staff Roster & Presence</h1>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Staff members with portal access and active session heartbeats.</p>
                </div>

                {(adminRole === 'Owner' || adminRole === 'Admin') && (
                  <Button
                    size="sm"
                    onClick={() => setAddAdminModalOpen(true)}
                    className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                  >
                    <Plus className="size-3.5 mr-1.5" /> Add Administrator
                  </Button>
                )}
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">Administrator</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Presence</th>
                        <th className="py-3 px-4">Discord ID</th>
                        <th className="py-3 px-4">Last Seen</th>
                        {(adminRole === 'Owner' || adminRole === 'Admin') && <th className="py-3 px-4 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {adminsLoading ? (
                        [1, 2].map(i => (
                          <tr key={i}>
                            <td colSpan={6} className="py-3.5 px-4">
                              <Skeleton className="h-4 w-full bg-white/[0.03]" />
                            </td>
                          </tr>
                        ))
                      ) : adminsList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-zinc-500">
                            No administrators found.
                          </td>
                        </tr>
                      ) : (
                        adminsList.map(a => {
                          const isYou = String(a.userId) === String(currentAdmin?.userId || currentAdmin?.id);
                          return (
                            <tr key={a.userId} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 flex items-center gap-2.5">
                                <UserAvatar
                                  userId={a.userId}
                                  avatarUrl={a.avatar || a.avatarUrl}
                                  name={a.displayName || a.username}
                                  size={28}
                                  className="size-7 rounded-full bg-zinc-800"
                                />
                                <div>
                                  <div className="font-semibold text-white flex items-center gap-1.5">
                                    <span>{a.displayName || a.username}</span>
                                    {isYou && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)] font-semibold">
                                        You
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-zinc-500">@{a.username}</div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  a.role === 'Owner'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : a.role === 'Admin'
                                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)]'
                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}>
                                  {a.role}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {a.isOnline ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)]">
                                    <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                                    Online
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400">
                                    Offline
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">{a.userId}</td>
                              <td className="py-3 px-4 text-zinc-500 text-[11px]">
                                {a.last_seen_at ? new Date(a.last_seen_at).toLocaleTimeString() : 'Recently'}
                              </td>
                              {(adminRole === 'Owner' || adminRole === 'Admin') && (
                                <td className="py-3 px-4 text-right">
                                  {!isYou && (adminRole === 'Owner' || a.role !== 'Owner') && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setRemoveAdminTarget(a);
                                        setRemoveAdminModalOpen(true);
                                      }}
                                      className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300"
                                      title="Revoke admin access"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          </AdminTabErrorBoundary>
        </main>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          USER PROFILE SHEET (Section 7)
         ═════════════════════════════════════════════════════════════ */}
      <Sheet open={Boolean(selectedUserSheet)} onOpenChange={(open) => !open && setSelectedUserSheet(null)}>
        <SheetContent className="bg-[#121215] border-l border-white/[0.08] text-white w-full sm:max-w-md p-6 overflow-y-auto">
          {sheetLoading ? (
            <div className="space-y-4 pt-6">
              <Skeleton className="h-12 w-full bg-white/[0.03]" />
              <Skeleton className="h-24 w-full bg-white/[0.03]" />
              <Skeleton className="h-32 w-full bg-white/[0.03]" />
            </div>
          ) : selectedUserSheet?.user ? (
            <div className="space-y-6 pt-2">
              <SheetHeader className="text-left space-y-1">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    userId={selectedUserSheet.user.id}
                    avatarUrl={selectedUserSheet.user.avatar}
                    name={selectedUserSheet.user.username || 'User'}
                    size={48}
                    className="size-12 rounded-full"
                  />
                  <div>
                    <SheetTitle className="text-base font-bold text-white">
                      {selectedUserSheet.user.username || 'Name unavailable'}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-zinc-400 font-mono">
                      {selectedUserSheet.user.id}
                    </SheetDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Badge variant="outline" className={`text-[10px] ${
                    selectedUserSheet.user.status === 'banned'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]'
                  }`}>
                    {selectedUserSheet.user.status === 'banned' ? 'Suspended' : 'Active'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-zinc-400 border-white/[0.08]">
                    {selectedUserSheet.user.role || 'Member'}
                  </Badge>
                </div>
              </SheetHeader>

              {/* Balance Summary */}
              <Card className="bg-[#141417] border-white/[0.08] p-4 space-y-1">
                <span className="text-[11px] text-zinc-400 font-medium">Credits Balance</span>
                <div className="text-2xl font-bold text-[var(--accent)]">
                  {selectedUserSheet?.user?.credits || 0} cr
                </div>
                <div className="text-[10px] text-zinc-500 pt-1">
                  Earned: {selectedUserSheet.ledger?.summary?.earned || 0} cr • Spent: {selectedUserSheet.ledger?.summary?.spent || 0} cr
                </div>
              </Card>

              {/* Associated Communities grouped by role with sheet link */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Associated Communities ({selectedUserSheet.servers?.length || 0})
                  </h4>
                </div>
                {(!selectedUserSheet.servers || selectedUserSheet.servers.length === 0) ? (
                  <p className="text-xs text-zinc-500">No servers associated with this account.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedUserSheet.servers.slice(0, 10).map((s: any) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedUserSheet(null);
                          window.open(`/s/${s.slug || s.id}`, '_blank');
                        }}
                        className="p-2.5 rounded-xl bg-[#141417] border border-white/[0.08] flex items-center justify-between text-xs hover:border-[var(--accent)] hover:bg-white/[0.04] transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ServerIcon serverId={s.id} icon={s.icon} name={s.name} size="sm" />
                          <div className="min-w-0">
                            <span className="font-semibold text-white group-hover:text-[var(--accent)] transition-colors truncate block">{s.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              Role: {s.category || (s.ownerId === selectedUserSheet.user.id ? 'Owner' : 'Affiliate')}
                            </span>
                          </div>
                        </div>
                        <span className="text-zinc-500 font-mono text-[10px] shrink-0">{s.memberCount || 0} members</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Ledger Transactions */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Recent Transactions</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedUserSheet.ledger?.items?.length === 0 ? (
                    <p className="text-xs text-zinc-500">No transaction records.</p>
                  ) : (
                    selectedUserSheet.ledger?.items?.map((tx: any) => (
                      <div key={tx.id || Math.random()} className="p-2 rounded-lg bg-[#141417] text-xs flex items-center justify-between">
                        <span className="text-zinc-300 truncate max-w-[200px]">{tx.description || tx.reason}</span>
                        <span className={`font-mono font-semibold ${tx.type === 'earned' ? 'text-[var(--accent)]' : 'text-rose-400'}`}>
                          {tx.type === 'earned' ? '+' : '-'}{tx.amount} cr
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions in Sheet */}
              <div className="pt-4 border-t border-white/[0.08] flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCreditTargetUser(selectedUserSheet.user);
                    setCreditModalOpen(true);
                  }}
                  className="flex-1 text-xs border-white/[0.08]"
                >
                  <Coins className="size-3.5 mr-1.5" /> Adjust Credits
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!selectedUserSheet?.user?.id) return;
                    try {
                      const res = await adminFetch(`/api/admin/users/${selectedUserSheet.user.id}/clear-promo-lock`, {
                        method: 'POST',
                        credentials: 'include'
                      });
                      if (res.ok) {
                        showFeedback('Promo lockout cleared successfully.');
                      } else {
                        showFeedback('Failed to clear promo lock.', 'error');
                      }
                    } catch {
                      showFeedback('Network error clearing promo lock.', 'error');
                    }
                  }}
                  className="flex-1 text-xs border-white/[0.08]"
                >
                  <RotateCcw className="size-3.5 mr-1.5" /> Clear Promo Lock
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const uid = selectedUserSheet.user.id;
                    try {
                      await adminFetch('/api/admin/blacklist/unblacklist', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: uid, target: uid, reason: 'Unblacklisted from user sheet' })
                      });
                      showFeedback(`User ${selectedUserSheet.user.username || uid} unblacklisted.`);
                      fetchBlacklist();
                      fetchUsers();
                    } catch {
                      showFeedback('Failed to unblacklist user.', 'error');
                    }
                  }}
                  className="flex-1 text-xs border-white/[0.08] text-zinc-300 hover:text-white"
                >
                  <UserCheck className="size-3.5 mr-1.5" /> Unblacklist
                </Button>

                {selectedUserSheet.user.status === 'banned' || selectedUserSheet.user.status === 'suspended' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUnbanTargetUser(selectedUserSheet.user);
                      setUnbanModalOpen(true);
                    }}
                    className="flex-1 text-xs bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]"
                  >
                    <UserCheck className="size-3.5 mr-1.5" /> Unban
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBanTargetUser(selectedUserSheet.user);
                      setBanModalOpen(true);
                    }}
                    className="flex-1 text-xs bg-rose-500/10 text-rose-400 border-rose-500/20"
                  >
                    <UserX className="size-3.5 mr-1.5" /> Suspend
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ═════════════════════════════════════════════════════════════
          MODALS & DIALOGS
         ═════════════════════════════════════════════════════════════ */}

      {/* BAN / SUSPEND DIALOG (Section 7: min 10-char reason, duration 1d, 7d, 30d, perm) */}
      <Dialog open={banModalOpen} onOpenChange={setBanModalOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <UserX className="size-4 text-rose-400" />
              <span>Suspend Account</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Restricts account login, growth bounty claiming, and directory updates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Target User</label>
              <div className="p-2.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs font-mono text-zinc-300 flex items-center justify-between">
                <span>{banTargetUser?.username || 'user'}</span>
                <span className="text-zinc-500">{banTargetUser?.id}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Duration</label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger className="w-full text-xs bg-[#0E0E11] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0E0E11] border-white/[0.08] text-xs">
                  <SelectItem value="1d">1 Day</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="30d">30 Days</SelectItem>
                  <SelectItem value="Permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Reason (min 10 characters)</label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Violated terms regarding bot farm automation and duplicate bounty claims."
                rows={3}
                className="w-full text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBanModalOpen(false)}
              className="text-xs border-white/[0.08]"
            >
              Cancel
            </Button>
            <Button
              disabled={actionSubmitting || banReason.trim().length < 10}
              onClick={handleExecuteBan}
              className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              Confirm Suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UNBAN DIALOG */}
      <Dialog open={unbanModalOpen} onOpenChange={setUnbanModalOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="size-4 text-[var(--accent)]" />
              <span>Pardon Account</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Restores login access and normal community directory capabilities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-2.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs font-mono text-zinc-300">
              {unbanTargetUser?.username || unbanTargetUser?.id}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Pardon Reason</label>
              <Input
                value={unbanReason}
                onChange={(e) => setUnbanReason(e.target.value)}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUnbanModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              disabled={actionSubmitting}
              onClick={handleExecuteUnban}
              className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
            >
              Lift Suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADJUST CREDITS DIALOG (Section 2.3) */}
      <Dialog open={creditModalOpen} onOpenChange={(open) => {
        setCreditModalOpen(open);
        if (!open) {
          setShowUserDropdown(false);
        }
      }}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6 font-sans">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="size-4 text-[var(--accent)]" />
              <span>Adjust User Credits</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Modifies user & server ledger balance with recorded audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. User Selection Combobox */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Target User</label>
              <div className="relative">
                <Input
                  placeholder="Type user name or Discord snowflake ID..."
                  value={userSearchText || (creditTargetUser ? `${creditTargetUser.globalName || creditTargetUser.username} (${creditTargetUser.id})` : '')}
                  onChange={(e) => {
                    setUserSearchText(e.target.value);
                    setShowUserDropdown(true);
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  className="text-xs bg-[#0E0E11] border-white/[0.08]"
                />
                {showUserDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#141417] border border-white/10 rounded-xl shadow-2xl z-50 p-1 divide-y divide-white/[0.04]">
                    {users
                      .filter((u) => {
                        if (!userSearchText.trim()) return true;
                        const q = userSearchText.toLowerCase().trim();
                        return (u.globalName || '').toLowerCase().includes(q) ||
                          (u.username || '').toLowerCase().includes(q) ||
                          String(u.id).includes(q);
                      })
                      .slice(0, 8)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setCreditTargetUser(u);
                            setUserSearchText(`${u.globalName || u.username} (${u.id})`);
                            setShowUserDropdown(false);
                            // Auto select server
                            const userServers = servers.filter(
                              (s) => String(s.ownerId || s.owner_discord_id) === String(u.id) ||
                                (Array.isArray(s.representatives) && s.representatives.map(String).includes(String(u.id))) ||
                                ((u.id === '523693281541095424' || u.id === '1317231689361133650') && String(s.id) === '1347902300324368414')
                            );
                            setCreditTargetServer(userServers[0] || null);
                          }}
                          className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.06] text-left transition-colors cursor-pointer"
                        >
                          <UserAvatar userId={u.id} avatarUrl={u.avatar} name={u.globalName || u.username} size={24} className="size-6 rounded-full" />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-white truncate block">{u.globalName || u.username}</span>
                            <span className="text-[10px] font-mono text-zinc-400 truncate block">ID: {u.id} • {u.credits ?? 0} cr</span>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Server Selection */}
            {(() => {
              const userServers = creditTargetUser
                ? servers.filter(
                    (s) => String(s.ownerId || s.owner_discord_id) === String(creditTargetUser.id) ||
                      (Array.isArray(s.representatives) && s.representatives.map(String).includes(String(creditTargetUser.id))) ||
                      ((creditTargetUser.id === '523693281541095424' || creditTargetUser.id === '1317231689361133650') && String(s.id) === '1347902300324368414')
                  )
                : [];
              const otherServers = servers.filter((s) => !userServers.some((us) => us.id === s.id));

              return (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Target Server or Wallet</label>
                  {!creditTargetUser ? (
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-400">
                      Search and select a user above first.
                    </div>
                  ) : userServers.length === 0 ? (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-300 flex items-center justify-between">
                      <span className="font-medium">Personal User Wallet</span>
                      <span className="font-mono text-[var(--accent)]">{creditTargetUser?.credits ?? 0} cr</span>
                    </div>
                  ) : (
                    <select
                      value={creditTargetServer?.id || ''}
                      onChange={(e) => {
                        const s = servers.find((srv) => String(srv.id) === String(e.target.value));
                        setCreditTargetServer(s || null);
                      }}
                      className="w-full h-9 px-3 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs font-medium text-zinc-200 focus:border-[var(--accent)] focus:outline-hidden appearance-none cursor-pointer font-sans"
                    >
                      <option value="" className="bg-[#141417] text-white">
                        Personal User Wallet ({creditTargetUser?.credits ?? 0} cr)
                      </option>
                      {userServers.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#141417] text-white">
                          Server: {s.name} • {s.balance ?? 0} cr
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })()}

            {/* 3. Direction & Amount (NumberField starting empty) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300">Adjustment Direction & Amount</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs">
                <button
                  type="button"
                  onClick={() => setCreditDirection('add')}
                  className={`py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    creditDirection === 'add'
                      ? 'bg-[var(--accent)] text-[#1C0A00] shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Add credits
                </button>
                <button
                  type="button"
                  onClick={() => setCreditDirection('deduct')}
                  className={`py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    creditDirection === 'deduct'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Deduct credits
                </button>
              </div>

              <Input
                type="number"
                min={1}
                max={1000000}
                placeholder="Amount (1 - 1,000,000)"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            {/* 4. Reason (10-200 chars) */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <label className="font-medium text-zinc-300">Reason (10-200 characters)</label>
                <span className={`text-[11px] font-mono ${creditReason.trim().length >= 10 && creditReason.trim().length <= 200 ? 'text-zinc-500' : 'text-amber-400'}`}>
                  {creditReason.trim().length}/200
                </span>
              </div>
              <Input
                placeholder="Reason for adjustment (required 10-200 chars)"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                maxLength={200}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            {/* 5. Preview line */}
            {(() => {
              if (!creditTargetUser) return null;
              const parsedAmt = parseInt(creditAmount, 10);
              if (isNaN(parsedAmt) || parsedAmt < 1) return null;
              const delta = creditDirection === 'add' ? parsedAmt : -parsedAmt;

              if (creditTargetServer) {
                const curBal = Number(creditTargetServer.balance || 0);
                const newBal = Math.max(0, curBal + delta);
                return (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-300 font-sans leading-relaxed">
                    Will adjust <strong className="text-white">{creditTargetServer.name}</strong> balance from{' '}
                    <span className="font-mono text-zinc-400">{curBal} cr</span> to{' '}
                    <span className="font-mono text-[var(--accent)] font-semibold">{newBal} cr</span>{' '}
                    ({delta > 0 ? `+${delta}` : delta} cr). Current user will see this immediately.
                  </div>
                );
              } else {
                const curBal = Number(creditTargetUser?.credits || 0);
                const newBal = Math.max(0, curBal + delta);
                return (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-300 font-sans leading-relaxed">
                    Will adjust <strong className="text-white">{creditTargetUser?.globalName || creditTargetUser?.username || 'User'}</strong> wallet balance from{' '}
                    <span className="font-mono text-zinc-400">{curBal} cr</span> to{' '}
                    <span className="font-mono text-[var(--accent)] font-semibold">{newBal} cr</span>{' '}
                    ({delta > 0 ? `+${delta}` : delta} cr). Direct user allocation.
                  </div>
                );
              }
            })()}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setCreditModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            {(() => {
              const parsedAmt = parseInt(creditAmount, 10);
              const isDisabled =
                actionSubmitting ||
                !creditTargetUser ||
                isNaN(parsedAmt) ||
                parsedAmt < 1 ||
                parsedAmt > 1000000 ||
                creditReason.trim().length < 10 ||
                creditReason.trim().length > 200;

              return (
                <Button
                  disabled={isDisabled}
                  onClick={handleExecuteCreditTransaction}
                  className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                >
                  Post Transaction
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD TO BLACKLIST DIALOG */}
      <Dialog open={addBlacklistModalOpen} onOpenChange={setAddBlacklistModalOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <UserX className="size-4 text-rose-400" />
              <span>Add to Security Blacklist</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Restricts accounts, IP addresses, or CIDR subnets across authentication and portal access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Restriction Type</label>
              <select
                value={addBlacklistType}
                onChange={(e) => setAddBlacklistType(e.target.value as any)}
                className="w-full h-9 px-3 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs font-medium text-zinc-200 focus:border-[var(--accent)] focus:outline-hidden cursor-pointer"
              >
                <option value="discord_id">Discord Snowflake ID</option>
                <option value="ip">IP Address (IPv4 / IPv6)</option>
                <option value="cidr">CIDR Subnet Block</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">
                {addBlacklistType === 'discord_id' ? 'Discord Snowflake ID' : addBlacklistType === 'ip' ? 'IP Address' : 'CIDR Range'}
              </label>
              <Input
                placeholder={addBlacklistType === 'discord_id' ? 'e.g. 523693281541095424' : addBlacklistType === 'ip' ? 'e.g. 192.168.1.1' : 'e.g. 192.168.1.0/24'}
                value={addBlacklistValue}
                onChange={(e) => setAddBlacklistValue(e.target.value)}
                className="text-xs font-mono bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Notes / Handle (optional)</label>
              <Input
                placeholder="Known username or context"
                value={addBlacklistUsername}
                onChange={(e) => setAddBlacklistUsername(e.target.value)}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Reason (min 10 characters)</label>
              <textarea
                value={addBlacklistReason}
                onChange={(e) => setAddBlacklistReason(e.target.value)}
                placeholder="Raid bot infrastructure / known banned affiliate."
                rows={3}
                className="w-full text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddBlacklistModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              disabled={actionSubmitting || !(addBlacklistValue.trim() || addBlacklistId.trim()) || addBlacklistReason.trim().length < 10}
              onClick={handleAddBlacklist}
              className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              Add to Blacklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE PROMO CODE DIALOG */}
      <Dialog open={createPromoOpen} onOpenChange={setCreatePromoOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Ticket className="size-4 text-[var(--accent)]" />
              <span>Create Promotional Code</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Generates a promo code with assigned boost credits for community treasuries.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">Code (10 uppercase chars)</label>
                <button
                  type="button"
                  onClick={handleGenerateRandomCode}
                  className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
                >
                  Generate random
                </button>
              </div>
              <Input
                placeholder="e.g. SUMMER2026"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                className="text-xs font-mono uppercase bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Credits Granted</label>
                <Input
                  type="number"
                  min={1}
                  max={100000}
                  value={promoCreditsInput}
                  onChange={(e) => setPromoCreditsInput(e.target.value)}
                  className="text-xs font-mono bg-[#0E0E11] border-white/[0.08]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Max Redemptions</label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={promoMaxUsesInput}
                  onChange={(e) => setPromoMaxUsesInput(e.target.value)}
                  className="text-xs font-mono bg-[#0E0E11] border-white/[0.08]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Expiration Date (optional)</label>
              <Input
                type="date"
                value={promoExpiresInput}
                onChange={(e) => setPromoExpiresInput(e.target.value)}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreatePromoOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              disabled={actionSubmitting || parseInt(promoCreditsInput, 10) < 1}
              onClick={handleCreatePromo}
              className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
            >
              Create Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PROMO REDEMPTIONS SHEET */}
      <Sheet open={selectedPromoRedemptions !== null} onOpenChange={(open) => !open && setSelectedPromoRedemptions(null)}>
        <SheetContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6 font-sans">
          <SheetHeader className="text-left space-y-1">
            <SheetTitle className="text-base font-bold text-white flex items-center gap-2">
              <History className="size-4 text-[var(--accent)]" />
              <span>Promo Code Redemptions</span>
            </SheetTitle>
            <SheetDescription className="text-xs text-zinc-400">
              Audit log of users and servers that claimed this promotional code.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {redemptionsLoading ? (
              <p className="text-xs text-zinc-500">Loading redemptions...</p>
            ) : (!selectedPromoRedemptions || selectedPromoRedemptions.length === 0) ? (
              <p className="text-xs text-zinc-500">No redemptions recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {selectedPromoRedemptions.map((r, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#141417] border border-white/[0.06] space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Server: {r.serverId}</span>
                      <span className="font-mono text-[var(--accent)] font-semibold">+{r.credits} cr</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>User ID: {r.userId}</span>
                      <span>{new Date(r.redeemedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* PARDON BLACKLIST DIALOG */}
      <Dialog open={removeBlacklistModalOpen} onOpenChange={setRemoveBlacklistModalOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="size-4 text-[var(--accent)]" />
              <span>Unblacklist Target</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Removes restriction on this identifier and lifts network block.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-2.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs font-mono text-zinc-300">
              {removeBlacklistTarget?.value || removeBlacklistTarget?.userId || removeBlacklistTarget?.id || "Target"}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Reason</label>
              <Input
                value={removeBlacklistReason}
                onChange={(e) => setRemoveBlacklistReason(e.target.value)}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRemoveBlacklistModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              disabled={actionSubmitting}
              onClick={handleRemoveBlacklist}
              className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
            >
              Confirm Unblacklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SERVER ACTION MODAL (Hide / Restore / Verify / Remove) */}
      <Dialog open={serverActionModal.open} onOpenChange={(open) => !open && setServerActionModal(m => ({ ...m, open: false }))}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="size-4 text-[var(--accent)]" />
              <span className="capitalize">{serverActionModal.action} Server Listing</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {serverActionModal.action === 'hide'
                ? 'Hides this community listing from the public directory immediately and cancels pending partnerships.'
                : serverActionModal.action === 'restore'
                ? 'Restores visibility in the public directory and partnership exchange.'
                : serverActionModal.action === 'verify'
                ? 'Grants verified status badge to this community.'
                : 'Applies administrative state to this server.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-2.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs flex items-center gap-2">
              <ServerIcon serverId={serverActionModal.server?.id} icon={serverActionModal.server?.icon} name={serverActionModal.server?.name} size="sm" />
              <span className="font-semibold text-white">{serverActionModal.server?.name}</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Administrative Reason</label>
              <textarea
                value={serverActionModal.reason}
                onChange={(e) => setServerActionModal(m => ({ ...m, reason: e.target.value }))}
                placeholder="Reason for this action..."
                rows={3}
                className="w-full text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setServerActionModal(m => ({ ...m, open: false }))} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              disabled={actionSubmitting}
              onClick={handleExecuteServerAction}
              className={`text-xs font-semibold ${
                serverActionModal.action === 'hide' || serverActionModal.action === 'remove'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950'
              }`}
            >
              Confirm {serverActionModal.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REPORT ACTION MODAL */}
      <Dialog open={reportActionModal.open} onOpenChange={(open) => !open && setReportActionModal(m => ({ ...m, open: false }))}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="size-4 text-[var(--accent)]" />
              <span>{reportActionModal.status === 'resolved' ? 'Resolve Report' : 'Dismiss Report'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Provide administrative notes and resolution action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Staff Notes</label>
              <textarea
                value={reportActionModal.notes}
                onChange={(e) => setReportActionModal(m => ({ ...m, notes: e.target.value }))}
                rows={3}
                className="w-full text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReportActionModal(m => ({ ...m, open: false }))} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              disabled={actionSubmitting}
              onClick={handleExecuteReportAction}
              className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
            >
              Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE ANNOUNCEMENT MODAL */}
      <Dialog open={announcementModalOpen} onOpenChange={setAnnouncementModalOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Megaphone className="size-4 text-[var(--accent)]" />
              <span>Create Announcement</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Broadcasts an in-app banner to logged in members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Banner Level</label>
              <Select value={announcementLevel} onValueChange={(val: any) => setAnnouncementLevel(val)}>
                <SelectTrigger className="w-full text-xs bg-[#0E0E11] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0E0E11] border-white/[0.08] text-xs">
                  <SelectItem value="info">Info (Blue)</SelectItem>
                  <SelectItem value="warning">Warning (Yellow)</SelectItem>
                  <SelectItem value="alert">Alert (Red)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Banner Text</label>
              <textarea
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="Scheduled maintenance will take place tonight at 02:00 UTC."
                rows={3}
                className="w-full text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Optional Action Link</label>
              <input
                type="url"
                value={announcementLink}
                onChange={(e) => setAnnouncementLink(e.target.value)}
                placeholder="https://connectingerlc.com/dashboard/discord"
                className="w-full text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl p-2.5 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Optional End Date</label>
              <input
                type="date"
                value={announcementEndDate}
                onChange={(e) => setAnnouncementEndDate(e.target.value)}
                className="w-full text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl p-2.5 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="text-xs font-medium text-zinc-300">Active Switch</label>
              <button
                type="button"
                onClick={() => setAnnouncementActive(!announcementActive)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${
                  announcementActive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                {announcementActive ? 'Enabled (ON)' : 'Disabled (OFF)'}
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAnnouncementModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              disabled={!announcementText.trim()}
              onClick={handleCreateAnnouncement}
              className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
            >
              Publish Banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PUBLISH / EDIT CHANGELOG MODAL */}
      <Dialog open={changelogModalOpen} onOpenChange={setChangelogModalOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="size-4 text-[var(--accent)]" />
              <span>{editingChangelogVersion ? 'Edit Changelog Release' : 'Publish Changelog Release'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {editingChangelogVersion ? `Editing notes for release ${clVersion}` : 'Publishes release notes to the public changelog page.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Version</label>
                <Input
                  placeholder="v2.4.0"
                  value={clVersion}
                  onChange={(e) => setClVersion(e.target.value)}
                  className="text-xs font-mono bg-[#0E0E11] border-white/[0.08]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Title</label>
                <Input
                  placeholder="Platform Overhaul"
                  value={clTitle}
                  onChange={(e) => setClTitle(e.target.value)}
                  className="text-xs bg-[#0E0E11] border-white/[0.08]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Description</label>
              <Input
                placeholder="High-level release summary..."
                value={clDesc}
                onChange={(e) => setClDesc(e.target.value)}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Tags (comma-separated)</label>
              <Input
                placeholder="new, improvement, fix"
                value={clTags.join(', ')}
                onChange={(e) => setClTags(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Bullets (one item per line)</label>
              <textarea
                value={clItems}
                onChange={(e) => setClItems(e.target.value)}
                placeholder="Added live system check table&#10;Upgraded admin portal UI&#10;Fixed dirty form check"
                rows={4}
                className="w-full text-xs font-mono bg-[#0E0E11] border border-white/[0.08] rounded-xl p-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setChangelogModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              disabled={!clVersion.trim() || !clTitle.trim() || !clItems.trim()}
              onClick={handlePublishChangelog}
              className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
            >
              {editingChangelogVersion ? 'Save Changes' : 'Publish Release'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD ADMINISTRATOR MODAL (Owner only) */}
      <Dialog open={addAdminModalOpen} onOpenChange={setAddAdminModalOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="size-4 text-[var(--accent)]" />
              <span>Add Administrator</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Grant staff portal permissions to a Discord account by snowflake ID, mention, or username.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Discord User ID or Username</label>
              <Input
                placeholder="e.g. 523693281541095424 or @username"
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
                className="text-xs font-mono bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Username (Optional)</label>
              <Input
                placeholder="staff_handle"
                value={newAdminUsername}
                onChange={(e) => setNewAdminUsername(e.target.value)}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Role</label>
              <Select value={newAdminRole} onValueChange={(val: any) => setNewAdminRole(val)}>
                <SelectTrigger className="w-full text-xs bg-[#0E0E11] border-white/[0.08]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0E0E11] border-white/[0.08] text-xs">
                  {adminRole === 'Owner' && <SelectItem value="Owner">Owner</SelectItem>}
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Appointment Reason</label>
              <Input
                value={newAdminReason}
                onChange={(e) => setNewAdminReason(e.target.value)}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddAdminModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              disabled={!newAdminId.trim()}
              onClick={handleAddAdmin}
              className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
            >
              Appoint Administrator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REMOVE ADMINISTRATOR MODAL */}
      <Dialog open={removeAdminModalOpen} onOpenChange={setRemoveAdminModalOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Trash2 className="size-4 text-rose-400" />
              <span>Revoke Administrator Role</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Revokes staff credentials and portal access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-2.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs font-mono text-zinc-300 flex items-center justify-between">
              <span>{removeAdminTarget?.displayName || removeAdminTarget?.username}</span>
              <span className="text-zinc-500">{removeAdminTarget?.userId}</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Reason</label>
              <Input
                value={removeAdminReason}
                onChange={(e) => setRemoveAdminReason(e.target.value)}
                className="text-xs bg-[#0E0E11] border-white/[0.08]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRemoveAdminModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              onClick={handleRemoveAdmin}
              className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              Revoke Staff Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant / Extend Premium Modal */}
      <Dialog open={grantModalOpen} onOpenChange={setGrantModalOpen}>
        <DialogContent className="max-w-[440px] bg-[#0E0E11] border border-white/[0.1] rounded-2xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--accent)]" />
              {grantTargetServer?.is_premium ? 'Extend Premium Status' : 'Grant Premium Status'}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Grant or extend premium subscription for <span className="text-white font-medium">{grantTargetServer?.name}</span>. This will be recorded in the administrative audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Days to add</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={grantDays}
                onChange={(e) => setGrantDays(Math.max(1, parseInt(e.target.value) || 30))}
                className="text-xs bg-[#141417] border-white/[0.08]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Administrative Reason</label>
              <Input
                placeholder="e.g. Community partnership award, staff grant"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                className="text-xs bg-[#141417] border-white/[0.08]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" size="sm" onClick={() => setGrantModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingGrant}
              onClick={handleGrantPremium}
              className="text-xs bg-[var(--accent)] hover:opacity-90 text-white font-semibold"
            >
              {isSubmittingGrant ? 'Processing...' : 'Confirm Grant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Premium Modal */}
      <Dialog open={revokeModalOpen} onOpenChange={setRevokeModalOpen}>
        <DialogContent className="max-w-[440px] bg-[#0E0E11] border border-white/[0.1] rounded-2xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Sparkles className="size-4 text-rose-400" />
              Revoke Premium Status
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Revoke premium subscription from <span className="text-white font-medium">{revokeTargetServer?.name}</span> immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Revocation Reason</label>
              <Input
                placeholder="e.g. Terms violation, requested cancellation"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="text-xs bg-[#141417] border-white/[0.08]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRevokeModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingRevoke}
              onClick={handleRevokePremium}
              className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              {isSubmittingRevoke ? 'Revoking...' : 'Revoke Premium'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
