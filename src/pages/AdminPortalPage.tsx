import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Settings2
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
  role: 'Owner' | 'Admin' | 'Moderator';
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
      { id: 'reports', label: 'Reports', icon: ShieldAlert },
      { id: 'flags', label: 'Flags', icon: AlertTriangle },
      { id: 'blacklist', label: 'Blacklist', icon: UserX },
    ]
  },
  {
    group: 'Economy',
    items: [
      { id: 'credits', label: 'Credits', icon: Coins }
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

export function AdminPortalPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  // ── AUTH & ROLE CHECK ──
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<'Owner' | 'Admin' | 'Moderator'>('Moderator');
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

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

  // Announcements Tab
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementLevel, setAnnouncementLevel] = useState<'info' | 'warning' | 'alert' | 'critical'>('info');
  const [announcementDismissible, setAnnouncementDismissible] = useState(true);

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
  const [newAdminRole, setNewAdminRole] = useState<'Admin' | 'Moderator'>('Moderator');
  const [newAdminReason, setNewAdminReason] = useState('Promoted to staff roster');
  const [removeAdminModalOpen, setRemoveAdminModalOpen] = useState(false);
  const [removeAdminTarget, setRemoveAdminTarget] = useState<AdminUser | null>(null);
  const [removeAdminReason, setRemoveAdminReason] = useState('Staff role revoked');

  // ── AUTH CHECK ──
  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      setAuthLoading(true);
      try {
        const res = await fetch('/api/admin/check');
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
      fetch('/api/admin/heartbeat', { method: 'POST' }).catch(() => {});
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
    else if (activeTab === 'credits') fetchLedger();
    else if (activeTab === 'reports') fetchReports();
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
      const res = await fetch('/api/admin/overview');
      if (res.ok) setOverview(await res.json());
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
      const res = await fetch(`/api/admin/users?${q.toString()}`);
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
      const res = await fetch(`/api/admin/users/${userId}`);
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
      const res = await fetch(`/api/admin/servers?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch {} finally {
      setServersLoading(false);
    }
  };

  const fetchBlacklist = async () => {
    setBlacklistLoading(true);
    try {
      const res = await fetch('/api/admin/bans');
      if (res.ok) {
        const data = await res.json();
        setBlacklistEntries(data.bans || []);
      }
    } catch {} finally {
      setBlacklistLoading(false);
    }
  };

  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const q = new URLSearchParams({ type: ledgerTypeFilter, search: ledgerSearch, limit: '100' });
      const res = await fetch(`/api/admin/ledger?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerTxs(data.transactions || []);
      }
    } catch {} finally {
      setLedgerLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await fetch('/api/admin/reports');
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

  const fetchFlags = async () => {
    setFlagsLoading(true);
    try {
      const res = await fetch('/api/admin/flags');
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
      const res = await fetch('/api/admin/rules');
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
      const res = await fetch('/api/admin/rules', {
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
      const res = await fetch('/api/admin/system/test-alert', { method: 'POST' });
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

  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch('/api/admin/announcements');
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      }
    } catch {} finally {
      setAnnouncementsLoading(false);
    }
  };

  const fetchMaintenance = async () => {
    try {
      const res = await fetch('/api/admin/maintenance');
      if (res.ok) {
        const data = await res.json();
        setMaintenance(data);
      }
    } catch {}
  };

  const fetchChangelog = async () => {
    setChangelogLoading(true);
    try {
      const res = await fetch('/api/admin/changelog');
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
      const res = await fetch(`/api/admin/audit?${q.toString()}`);
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
      const res = await fetch('/api/admin/system');
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
      const res = await fetch('/api/admin/admins');
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
      const res = await fetch('/api/admin/bans', {
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
      const res = await fetch(`/api/admin/bans/${unbanTargetUser.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: unbanReason.trim() })
      });
      if (res.ok) {
        showFeedback(`Pardon granted to ${unbanTargetUser.username || unbanTargetUser.id}.`);
        setUnbanModalOpen(false);
        setUnbanTargetUser(null);
        fetchUsers();
        if (selectedUserSheet?.user?.id === unbanTargetUser.id) openUserSheet(unbanTargetUser.id);
      } else {
        showFeedback('Failed to pardon user.', 'error');
      }
    } catch {
      showFeedback('Network error while lifting ban.', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Credit Modification
  const handleExecuteCreditTransaction = async () => {
    if (!creditTargetUser || !creditTargetServer) return;
    const amountNum = parseInt(creditAmount, 10);
    if (isNaN(amountNum) || amountNum < 1 || amountNum > 1000000) {
      showFeedback('Please enter a valid credit amount between 1 and 1,000,000.', 'error');
      return;
    }
    if (creditReason.trim().length < 10 || creditReason.trim().length > 200) {
      showFeedback('Please enter a reason between 10 and 200 characters.', 'error');
      return;
    }
    setActionSubmitting(true);
    try {
      const res = await fetch('/api/admin/credits/transact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: creditTargetUser.id,
          serverId: creditTargetServer.id,
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
    if (!addBlacklistId.trim() || addBlacklistReason.trim().length < 10) {
      showFeedback('Blacklist reason must be at least 10 characters.', 'error');
      return;
    }
    setActionSubmitting(true);
    try {
      const res = await fetch('/api/admin/bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: addBlacklistId.trim(),
          username: addBlacklistUsername.trim() || undefined,
          reason: addBlacklistReason.trim(),
          duration: addBlacklistDuration,
        }),
      });
      if (res.ok) {
        showFeedback(`User ID ${addBlacklistId} is now restricted on the blacklist.`);
        setAddBlacklistModalOpen(false);
        setAddBlacklistId('');
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
    if (!removeBlacklistTarget || removeBlacklistReason.trim().length < 5) return;
    setActionSubmitting(true);
    try {
      const res = await fetch(`/api/admin/bans/${removeBlacklistTarget.userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: removeBlacklistReason.trim() }),
      });
      if (res.ok) {
        showFeedback(`User ${removeBlacklistTarget.userId} was removed from the blacklist.`);
        setRemoveBlacklistModalOpen(false);
        setRemoveBlacklistTarget(null);
        setRemoveBlacklistReason('');
        fetchBlacklist();
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showFeedback(err.error || 'Could not unban user.', 'error');
      }
    } catch {
      showFeedback('Failed to communicate with server.', 'error');
    } finally {
      setActionSubmitting(false);
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
      const res = await fetch(`/api/admin/servers/${server.id}/action`, {
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
      const res = await fetch(`/api/admin/reports/${report.id}/action`, {
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
      const res = await fetch(`/api/admin/flags/${flagId}/action`, {
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
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: newMode || maintenance.mode,
          title: maintenance.title,
          message: maintenance.message,
          affectedServices: maintenance.affectedServices
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMaintenance(data.status);
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

  // Announcement Create / Delete
  const handleCreateAnnouncement = async () => {
    if (!announcementText.trim()) return;
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: announcementText.trim(),
          level: announcementLevel,
          active: true,
          dismissible: announcementDismissible
        })
      });
      if (res.ok) {
        showFeedback('Announcement published.');
        setAnnouncementModalOpen(false);
        setAnnouncementText('');
        fetchAnnouncements();
      }
    } catch {
      showFeedback('Failed to create announcement.', 'error');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/admin/changelog/${encodeURIComponent(version)}`, {
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
      const res = await fetch('/api/admin/changelog', {
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
      const res = await fetch(`/api/admin/reports/${reportId}/action`, {
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
      const res = await fetch('/api/admin/admins', {
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
      const res = await fetch(`/api/admin/admins/${removeAdminTarget.userId}`, {
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
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col">
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
                                <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                                  {u.serverList.map((srv) => (
                                    <span
                                      key={srv.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-zinc-200 hover:bg-white/[0.08] transition-colors"
                                      title={`${srv.name} (${srv.memberCount || 0} members)`}
                                    >
                                      <ServerIcon
                                        serverId={srv.id}
                                        icon={srv.icon}
                                        name={srv.name}
                                        size="sm"
                                        className="size-3.5 rounded-sm shrink-0"
                                      />
                                      <span className="truncate max-w-[110px] font-medium">{srv.name}</span>
                                    </span>
                                  ))}
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
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Hard restrictions blocking Discord accounts from authentication and server publishing.</p>
                </div>

                <Button
                  size="sm"
                  onClick={() => setAddBlacklistModalOpen(true)}
                  className="h-8 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-semibold"
                >
                  <Plus className="size-3.5 mr-1.5" /> Add to Blacklist
                </Button>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0E0E11] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Discord ID</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4">Restricted By</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Added</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {blacklistLoading ? (
                        [1, 2, 3].map(i => (
                          <tr key={i}>
                            <td colSpan={7} className="py-3.5 px-4">
                              <Skeleton className="h-4 w-full bg-white/[0.03]" />
                            </td>
                          </tr>
                        ))
                      ) : blacklistEntries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-zinc-500">
                            No accounts currently on the blacklist.
                          </td>
                        </tr>
                      ) : (
                        blacklistEntries.map(b => (
                          <tr key={b.userId} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4 font-semibold text-white">
                              {b.username || 'discord_user'}
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">{b.userId}</td>
                            <td className="py-3 px-4 text-zinc-300 max-w-xs truncate">{b.reason}</td>
                            <td className="py-3 px-4 text-zinc-400">{b.bannedBy?.username || 'Admin'}</td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400 border-rose-500/20">
                                {b.duration || 'Permanent'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-[11px]">
                              {new Date(b.bannedAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setRemoveBlacklistTarget(b);
                                  setRemoveBlacklistModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs text-[var(--accent)] hover:text-[var(--accent)]"
                                title="Revoke restriction"
                              >
                                Pardon
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
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md ${
                            a.level === 'alert' || a.level === 'critical'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : a.level === 'warning'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {a.level}
                          </span>
                          <span className="text-xs text-zinc-400">{new Date(a.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-white font-medium">{a.text}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="h-8 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
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

                  <div className="pt-2">
                    <Button
                      onClick={() => handleSaveMaintenance()}
                      disabled={maintenanceSaving}
                      className="text-xs bg-white/10 hover:bg-white/15 text-white"
                    >
                      Save Notice Changes
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

                {adminRole === 'Owner' && (
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
                        {adminRole === 'Owner' && <th className="py-3 px-4 text-right">Actions</th>}
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
                              {adminRole === 'Owner' && (
                                <td className="py-3 px-4 text-right">
                                  {!isYou && a.role !== 'Owner' && (
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
                  {selectedUserSheet.user.credits || 0} cr
                </div>
                <div className="text-[10px] text-zinc-500 pt-1">
                  Earned: {selectedUserSheet.ledger?.summary?.earned || 0} cr • Spent: {selectedUserSheet.ledger?.summary?.spent || 0} cr
                </div>
              </Card>

              {/* Associated Communities */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Associated Communities</h4>
                {selectedUserSheet.servers?.length === 0 ? (
                  <p className="text-xs text-zinc-500">No servers owned by this account.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedUserSheet.servers?.map((s: any) => (
                      <div key={s.id} className="p-2.5 rounded-xl bg-[#141417] border border-white/[0.08] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <ServerIcon serverId={s.id} icon={s.icon} name={s.name} size="sm" />
                          <span className="font-semibold text-white">{s.name}</span>
                        </div>
                        <span className="text-zinc-500 font-mono text-[10px]">{s.memberCount || 0} members</span>
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

                {selectedUserSheet.user.status === 'banned' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUnbanTargetUser(selectedUserSheet.user);
                      setUnbanModalOpen(true);
                    }}
                    className="flex-1 text-xs bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]"
                  >
                    <UserCheck className="size-3.5 mr-1.5" /> Pardon
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
                                (Array.isArray(s.representatives) && s.representatives.includes(u.id))
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
                      (Array.isArray(s.representatives) && s.representatives.includes(creditTargetUser.id))
                  )
                : [];

              return (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Target Server</label>
                  {userServers.length === 0 ? (
                    <div className="p-2.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs text-zinc-500 italic">
                      {creditTargetUser ? 'User has no servers' : 'Select a user first'}
                    </div>
                  ) : (
                    <select
                      value={creditTargetServer?.id || userServers[0]?.id || ''}
                      onChange={(e) => {
                        const s = userServers.find((srv) => String(srv.id) === String(e.target.value));
                        setCreditTargetServer(s || null);
                      }}
                      className="w-full h-9 px-3 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs font-medium text-zinc-200 focus:border-[var(--accent)] focus:outline-hidden appearance-none cursor-pointer font-sans"
                    >
                      {userServers.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#141417] text-white">
                          {s.name} • {s.balance ?? 0} cr
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
              const parsedAmt = parseInt(creditAmount, 10);
              const targetSrv = creditTargetServer || (creditTargetUser
                ? servers.find(
                    (s) => String(s.ownerId || s.owner_discord_id) === String(creditTargetUser.id) ||
                      (Array.isArray(s.representatives) && s.representatives.includes(creditTargetUser.id))
                  )
                : null);

              if (!targetSrv || isNaN(parsedAmt) || parsedAmt < 1) return null;
              const curBal = Number(targetSrv.balance || 0);
              const delta = creditDirection === 'add' ? parsedAmt : -parsedAmt;
              const newBal = Math.max(0, curBal + delta);

              return (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-300 font-sans leading-relaxed">
                  Will adjust <strong className="text-white">{targetSrv.name}</strong> balance from{' '}
                  <span className="font-mono text-zinc-400">{curBal} cr</span> to{' '}
                  <span className="font-mono text-[var(--accent)] font-semibold">{newBal} cr</span>{' '}
                  ({delta > 0 ? `+${delta}` : delta} cr). Current user will see this immediately.
                </div>
              );
            })()}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setCreditModalOpen(false)} className="text-xs border-white/[0.08]">
              Cancel
            </Button>
            {(() => {
              const parsedAmt = parseInt(creditAmount, 10);
              const targetSrv = creditTargetServer || (creditTargetUser
                ? servers.find(
                    (s) => String(s.ownerId || s.owner_discord_id) === String(creditTargetUser.id) ||
                      (Array.isArray(s.representatives) && s.representatives.includes(creditTargetUser.id))
                  )
                : null);
              const isDisabled =
                actionSubmitting ||
                !creditTargetUser ||
                !targetSrv ||
                isNaN(parsedAmt) ||
                parsedAmt < 1 ||
                parsedAmt > 1000000 ||
                creditReason.trim().length < 10 ||
                creditReason.trim().length > 200;

              return (
                <Button
                  disabled={isDisabled}
                  onClick={() => {
                    if (targetSrv && !creditTargetServer) setCreditTargetServer(targetSrv);
                    handleExecuteCreditTransaction();
                  }}
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
              <span>Add to Blacklist by Discord ID</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Restricts accounts that have never signed in or known bad actors.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Discord Snowflake ID</label>
              <Input
                placeholder="e.g. 523693281541095424"
                value={addBlacklistId}
                onChange={(e) => setAddBlacklistId(e.target.value)}
                className="text-xs font-mono bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Username (optional)</label>
              <Input
                placeholder="Known username handle"
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
              disabled={actionSubmitting || !addBlacklistId.trim() || addBlacklistReason.trim().length < 10}
              onClick={handleAddBlacklist}
              className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              Add to Blacklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PARDON BLACKLIST DIALOG */}
      <Dialog open={removeBlacklistModalOpen} onOpenChange={setRemoveBlacklistModalOpen}>
        <DialogContent className="bg-[#121215] border-white/[0.08] text-white sm:max-w-md p-6">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="size-4 text-[var(--accent)]" />
              <span>Remove from Blacklist</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Revokes restriction on this Discord snowflake ID.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-2.5 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs font-mono text-zinc-300">
              {removeBlacklistTarget?.userId}
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
              Confirm Removal
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
              <span>Add Administrator (Owner Only)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Grant staff portal permissions to a Discord account by snowflake ID.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Discord User ID</label>
              <Input
                placeholder="e.g. 523693281541095424"
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
                className="text-xs font-mono bg-[#0E0E11] border-white/[0.08]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Username</label>
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
    </div>
  );
}
