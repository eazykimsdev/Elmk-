import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  GripVertical,
  ExternalLink,
  Save,
  Check,
  Copy,
  AlertCircle,
  Link as LinkIcon,
  Upload,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { api, apiFetch } from '@/lib/api';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

interface ServerDetailsTabProps {
  guild: DiscordGuild | null;
  workspace: WorkspaceBot | null;
  config: WorkspaceCustomizations;
  onNavigateTab?: (tab: string) => void;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

interface SectionItem {
  id: string;
  label: string;
  enabled: boolean;
}

interface DiscordStaffEntry {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
  role: string;
  roleId?: string | null;
}

interface PartnerEntry {
  id: string;
  name: string;
  icon?: string | null;
  customUrl?: string | null;
  link?: string;
}

interface RealFormItem {
  id: string;
  name: string;
  slug?: string;
}

const DEFAULT_SECTIONS: SectionItem[] = [
  { id: 'about', label: 'About', enabled: true },
  { id: 'erlc', label: 'Live in-game status', enabled: true },
  { id: 'reviews', label: 'Reviews', enabled: true },
  { id: 'badges', label: 'Badges & stats', enabled: true },
  { id: 'staff', label: 'Staff team', enabled: false },
  { id: 'partners', label: 'Partners', enabled: false }
];

export function ServerDetailsTab({
  guild,
  workspace,
  config: _initialConfig,
  onNavigateTab: _onNavigateTab,
  addToast
}: ServerDetailsTabProps) {
  const guildId = guild?.id || workspace?.guildId || '';
  const serverName = guild?.name || 'Community Server';
  const domainHost = typeof window !== 'undefined' ? window.location.host : 'connectingerlc.xyz';

  // Core page fields
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [pendingBannerPreview, setPendingBannerPreview] = useState<string | null>(null);
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState<boolean>(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [description, setDescription] = useState<string>('');
  const [tagList, setTagList] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [discordInvite, setDiscordInvite] = useState<string>('');
  const [robloxLink, setRobloxLink] = useState<string>('');
  const [twitterLink, setTwitterLink] = useState<string>('');
  const [websiteLink, setWebsiteLink] = useState<string>('');

  // Public link / Custom URL
  const [customUrl, setCustomUrl] = useState<string>('');
  const [savedCustomUrl, setSavedCustomUrl] = useState<string>('');
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const [customUrlCooldown, setCustomUrlCooldown] = useState<string | null>(null);
  const [claimingCustomUrl, setClaimingCustomUrl] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Real forms for this server (never show fake or example form links)
  const [realForms, setRealForms] = useState<RealFormItem[]>([]);

  // Page sections order & visibility (simple list with drag handle & Show switch only)
  const [sections, setSections] = useState<SectionItem[]>(DEFAULT_SECTIONS);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Staff team (verified against Discord via role or Discord ID)
  const [showStaffList, setShowStaffList] = useState<boolean>(false);
  const [staffList, setStaffList] = useState<DiscordStaffEntry[]>([]);
  const [guildRoles, setGuildRoles] = useState<Array<{ id: string; name: string; colorHex?: string }>>([]);
  const [selectedStaffRoleId, setSelectedStaffRoleId] = useState<string>('');
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');
  const [staffCandidates, setStaffCandidates] = useState<DiscordStaffEntry[]>([]);
  const [searchingStaff, setSearchingStaff] = useState<boolean>(false);

  // Partners (searchable multi-select from real accepted partnerships)
  const [showPartnerList, setShowPartnerList] = useState<boolean>(false);
  const [partnerList, setPartnerList] = useState<PartnerEntry[]>([]);
  const [availablePartners, setAvailablePartners] = useState<PartnerEntry[]>([]);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState<string>('');

  // Advanced section (collapsed by default)
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [showCredits, setShowCredits] = useState<boolean>(true);
  const [erlcApiKey, setErlcApiKey] = useState<string>('');
  const [maskedKey, setMaskedKey] = useState<string>('');
  const [erlcConnected, setErlcConnected] = useState<boolean>(false);
  const [erlcTesting, setErlcTesting] = useState<boolean>(false);
  const [erlcError, setErlcError] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const loadServerData = async () => {
    if (!guildId) return;
    try {
      setLoading(true);
      const [serverRes, rolesRes, partnersRes, formsRes] = await Promise.all([
        fetch(`/api/servers/${guildId}`),
        fetch(`/api/workspace/${guildId}/roles`).catch(() => null),
        fetch(`/api/partnerships/${guildId}`).catch(() => null),
        fetch(`/api/workspace/${guildId}/forms`).catch(() => null)
      ]);

      if (serverRes.ok) {
        const data = await serverRes.json();
        const s = data.server || data;
        setBannerUrl(s.bannerUrl || '');
        setDescription(s.description || '');
        const parsedTags = Array.isArray(s.tags)
          ? s.tags.map((t: string) => String(t).trim().replace(/^#/, '')).filter(Boolean)
          : typeof s.tags === 'string'
          ? s.tags.split(',').map((t: string) => t.trim().replace(/^#/, '')).filter(Boolean)
          : [];
        setTagList(parsedTags);
        setDiscordInvite(s.inviteUrl || '');

        const social = s.socialLinks || {};
        setRobloxLink(social.roblox || '');
        setTwitterLink(social.twitter || '');
        setWebsiteLink(social.website || '');

        const existingSlug = s.customUrl || s.customSlug || '';
        setCustomUrl(existingSlug);
        setSavedCustomUrl(existingSlug);
        setIsEditingUrl(!existingSlug);

        if (s.customUrlChangedAt) {
          const changedMs = new Date(s.customUrlChangedAt).getTime();
          const cooldownEndMs = changedMs + 30 * 86400 * 1000;
          if (Date.now() < cooldownEndMs) {
            setCustomUrlCooldown(
              new Date(cooldownEndMs).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            );
          } else {
            setCustomUrlCooldown(null);
          }
        } else {
          setCustomUrlCooldown(null);
        }

        setShowStaffList(Boolean(s.showStaffList));
        setStaffList(Array.isArray(s.staffList) ? s.staffList : []);
        setShowPartnerList(Boolean(s.showPartnerList));
        setPartnerList(Array.isArray(s.partnerList) ? s.partnerList : []);
        setShowCredits(s.showCredits !== false);

        if (Array.isArray(s.pageSections) && s.sectionVisibility) {
          const loaded: SectionItem[] = s.pageSections.map((secId: string) => {
            const def = DEFAULT_SECTIONS.find(d => d.id === secId) || {
              id: secId,
              label: secId.charAt(0).toUpperCase() + secId.slice(1),
              enabled: true
            };
            return {
              ...def,
              enabled: s.sectionVisibility[secId] !== undefined ? Boolean(s.sectionVisibility[secId]) : def.enabled
            };
          });
          for (const def of DEFAULT_SECTIONS) {
            if (!loaded.some(item => item.id === def.id)) {
              loaded.push({ ...def, enabled: s.sectionVisibility[def.id] ?? def.enabled });
            }
          }
          setSections(loaded);
        }

        if (s.erlc && s.erlc.connected) {
          setErlcConnected(true);
          setMaskedKey(s.erlc.maskedKey || '••••••••');
        } else {
          setErlcConnected(false);
          setMaskedKey('');
        }
      }

      if (rolesRes && rolesRes.ok) {
        const rolesData = await rolesRes.json().catch(() => ({}));
        if (Array.isArray(rolesData.roles)) {
          setGuildRoles(rolesData.roles);
        }
      }

      if (partnersRes && partnersRes.ok) {
        const pData = await partnersRes.json().catch(() => ({}));
        const active = Array.isArray(pData.activePartnerships) ? pData.activePartnerships : [];
        const mappedPartners: PartnerEntry[] = active.map((p: any) => {
          const isFrom = String(p.fromGuildId) === String(guildId);
          const partnerId = isFrom ? String(p.toGuildId || '') : String(p.fromGuildId || '');
          const partnerName = isFrom ? (p.toGuildName || p.partnerName || partnerId) : (p.fromGuildName || p.partnerName || partnerId);
          const partnerIcon = isFrom ? (p.toGuildIcon || null) : (p.fromGuildIcon || null);
          return {
            id: partnerId,
            name: partnerName,
            icon: partnerIcon,
            link: `/servers/${partnerId}`
          };
        }).filter((p: PartnerEntry) => Boolean(p.id && p.name));
        setAvailablePartners(mappedPartners);
      }

      if (formsRes && formsRes.ok) {
        const fData = await formsRes.json().catch(() => ({}));
        const rawForms = Array.isArray(fData.forms) ? fData.forms : [];
        setRealForms(rawForms.map((f: any) => ({
          id: String(f.id),
          name: f.name || f.title || 'Application',
          slug: f.slug || f.id
        })));
      }
    } catch (err) {
      console.warn('Failed to load server details:', err);
    } finally {
      setLoading(false);
      setHasChanges(false);
    }
  };

  useEffect(() => {
    loadServerData();
  }, [guildId]);

  // Search Discord staff members when role or search query changes
  const handleSearchDiscordStaff = async (roleIdOverride?: string, queryOverride?: string) => {
    if (!guildId) return;
    const roleId = roleIdOverride !== undefined ? roleIdOverride : selectedStaffRoleId;
    const q = (queryOverride !== undefined ? queryOverride : staffSearchQuery).trim();
    if (!roleId && !q) {
      setStaffCandidates([]);
      return;
    }
    setSearchingStaff(true);
    try {
      const params = new URLSearchParams();
      if (roleId) params.set('roleId', roleId);
      if (q) params.set('q', q);
      const res = await fetch(`/api/workspace/${guildId}/discord-members?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStaffCandidates(Array.isArray(data.members) ? data.members : []);
      }
    } catch {
      setStaffCandidates([]);
    } finally {
      setSearchingStaff(false);
    }
  };

  const handleAddVerifiedStaff = (candidate: DiscordStaffEntry) => {
    if (staffList.some(m => String(m.id || m.username) === String(candidate.id || candidate.username))) {
      return;
    }
    setStaffList(prev => [
      ...prev,
      {
        id: candidate.id,
        username: candidate.displayName || candidate.username,
        displayName: candidate.displayName || candidate.username,
        avatar: candidate.avatar || null,
        role: candidate.role || 'Staff',
        roleId: candidate.roleId || null
      }
    ]);
    setHasChanges(true);
  };

  const handleRemoveStaff = (index: number) => {
    setStaffList(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleTogglePartnerSelection = (partner: PartnerEntry) => {
    const exists = partnerList.some(p => String(p.id) === String(partner.id));
    if (exists) {
      setPartnerList(prev => prev.filter(p => String(p.id) !== String(partner.id)));
    } else {
      setPartnerList(prev => [...prev, partner]);
    }
    setHasChanges(true);
  };

  // Banner file selection & upload
  const handleSelectBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setBannerError('File must be PNG, JPG, WebP, or GIF.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setBannerError('Banner file size must be under 8MB.');
      return;
    }

    setBannerError(null);
    setPendingBannerFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPendingBannerPreview(objectUrl);
    setHasChanges(true);
  };

  const handleUploadBanner = async (): Promise<string | null> => {
    if (!pendingBannerFile || !guildId) return bannerUrl;
    setUploadingBanner(true);
    setBannerError(null);
    try {
      const formData = new FormData();
      formData.append('banner', pendingBannerFile);
      const res = await apiFetch(`/api/workspace/${guildId}/banner`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload banner.');
      }
      setBannerUrl(data.bannerUrl);
      setPendingBannerFile(null);
      setPendingBannerPreview(null);
      return data.bannerUrl;
    } catch (err: any) {
      setBannerError(err.message || 'Banner upload failed.');
      throw err;
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleAddTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleaned) return;
    if (!tagList.includes(cleaned) && tagList.length < 12) {
      setTagList(prev => [...prev, cleaned]);
      setHasChanges(true);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTagList(prev => prev.filter(t => t !== tag));
    setHasChanges(true);
  };

  // Section reordering via simple drag-and-drop
  const handleSectionDrop = (targetIndex: number) => {
    if (dragIdx === null || dragIdx === targetIndex) return;
    const updated = [...sections];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(targetIndex, 0, moved);
    setSections(updated);
    setDragIdx(null);
    setHasChanges(true);
  };

  const toggleSection = (id: string, checked: boolean) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, enabled: checked } : s)));
    if (id === 'staff') setShowStaffList(checked);
    if (id === 'partners') setShowPartnerList(checked);
    setHasChanges(true);
  };

  // ER:LC Connection Handlers with plain-word error messages
  const handleConnectErlc = async () => {
    if (!erlcApiKey.trim() || !guildId) return;
    setErlcTesting(true);
    setErlcError(null);
    try {
      const res = await apiFetch(`/api/servers/${guildId}/erlc/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: erlcApiKey.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid ER:LC API key. Check key and permissions.');
      }
      setErlcConnected(true);
      setMaskedKey(data.maskedKey || '••••••••' + erlcApiKey.trim().slice(-4));
      setErlcApiKey('');
      addToast('success', 'ER:LC Key Saved', 'Live ER:LC status is now connected.');
    } catch (err: any) {
      const cleanErr = err.message || 'Invalid ER:LC API key. Check key and permissions.';
      setErlcError(cleanErr);
      addToast('error', 'Connection Failed', cleanErr);
    } finally {
      setErlcTesting(false);
    }
  };

  const handleTestErlc = async () => {
    if (!guildId) return;
    setErlcTesting(true);
    setErlcError(null);
    try {
      const res = await apiFetch(`/api/servers/${guildId}/erlc/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(erlcApiKey.trim() ? { apiKey: erlcApiKey.trim() } : {})
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server offline or ER:LC could not be reached.');
      }
      addToast('success', 'ER:LC Test Passed', 'Live telemetry responded normally.');
    } catch (err: any) {
      const cleanErr = err.message || 'Server offline or ER:LC could not be reached.';
      setErlcError(cleanErr);
      addToast('error', 'Test Failed', cleanErr);
    } finally {
      setErlcTesting(false);
    }
  };

  const handleDisconnectErlc = async () => {
    if (!guildId) return;
    try {
      const res = await apiFetch(`/api/servers/${guildId}/erlc/disconnect`, {
        method: 'POST'
      });
      if (res.ok) {
        setErlcConnected(false);
        setMaskedKey('');
        setErlcApiKey('');
        addToast('info', 'ER:LC Disconnected', 'Removed ER:LC key from server.');
      }
    } catch {}
  };

  // Custom URL Claim Handler
  const handleClaimCustomUrl = async () => {
    const candidate = customUrl.trim().toLowerCase();
    if (!candidate || !guildId) return;
    setClaimingCustomUrl(true);
    try {
      const res = await apiFetch(`/api/workspace/${guildId}/custom-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customUrl: candidate })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not claim custom link.');
      }
      setSavedCustomUrl(candidate);
      setIsEditingUrl(false);
      addToast('success', 'Public Link Claimed', `Your server is now live at ${domainHost}/${candidate}`);
      loadServerData();
    } catch (err: any) {
      addToast('error', 'Claim Failed', err.message || 'Could not claim custom link.');
    } finally {
      setClaimingCustomUrl(false);
    }
  };

  const handleCopyPublicUrl = () => {
    const fullUrl = `${window.location.origin}/${savedCustomUrl || `servers/${guildId}`}`;
    navigator.clipboard.writeText(fullUrl).catch(() => {});
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Save All Changes (Single Save Bar)
  const handleSaveChanges = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      let finalBannerUrl = bannerUrl;
      if (pendingBannerFile) {
        const uploaded = await handleUploadBanner();
        if (uploaded) finalBannerUrl = uploaded;
      }

      const pageSections = sections.map(s => s.id);
      const sectionVisibility = sections.reduce((acc, s) => {
        acc[s.id] = s.enabled;
        return acc;
      }, {} as Record<string, boolean>);

      const payload = {
        bannerUrl: finalBannerUrl.trim(),
        description: description.trim(),
        tags: tagList,
        inviteUrl: discordInvite.trim(),
        socialLinks: {
          discord: discordInvite.trim(),
          roblox: robloxLink.trim(),
          twitter: twitterLink.trim(),
          website: websiteLink.trim()
        },
        pageSections,
        sectionVisibility,
        showStaffList: sectionVisibility.staff ?? showStaffList,
        staffList,
        showPartnerList: sectionVisibility.partners ?? showPartnerList,
        partnerList,
        showCredits
      };

      const res = await api<any>(`/servers/${guildId}/listing`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (res) {
        addToast('success', 'Settings Saved', 'Your public server page has been updated.');
        setHasChanges(false);
      }
    } catch (err: any) {
      addToast('error', 'Save Failed', err.message || 'Could not save page settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-zinc-500 font-sans">
        Loading server page settings…
      </div>
    );
  }

  const activeSlug = savedCustomUrl || customUrl.trim() || guildId;
  const publicPageUrl = savedCustomUrl
    ? `${window.location.origin}/${savedCustomUrl}`
    : `${window.location.origin}/servers/${guildId}`;
  const filteredPartners = availablePartners.filter(p =>
    !partnerSearchQuery.trim() || p.name.toLowerCase().includes(partnerSearchQuery.trim().toLowerCase())
  );

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 pb-36 font-sans text-zinc-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="text-xs text-zinc-500 mb-1">Server / Page Editor</div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            Server Page
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure your public server page, custom link, sections, and verified staff or partners.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(publicPageUrl, '_blank')}
            className="h-9 px-3.5 rounded-full text-xs border-white/[0.1] bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center gap-1.5"
          >
            <span>View public page</span>
            <ExternalLink className="size-3.5 text-zinc-400" />
          </Button>
        </div>
      </div>

      {/* Full Page Width 2-Column Layout: Labels and Help on Left, Wide Controls on Right */}
      <div className="divide-y divide-white/[0.06] pt-2">
        {/* Row 1: Public Link */}
        <div className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 pr-4">
            <div className="text-sm font-medium text-zinc-100">Public link</div>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Claim a short memorable link for your community page.
            </p>
            {customUrlCooldown && (
              <p className="text-[11px] text-amber-400 mt-2">
                Next change available after {customUrlCooldown}
              </p>
            )}
          </div>

          <div className="lg:col-span-8 space-y-3">
            {savedCustomUrl && !isEditingUrl ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/70 border border-white/[0.08]">
                <span className="text-xs text-zinc-200 truncate font-medium px-1">
                  {domainHost}/{savedCustomUrl}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPublicUrl}
                    className="h-7 px-3 rounded-full text-xs border-white/[0.08] bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                  >
                    {copiedUrl ? <Check className="size-3 mr-1" /> : <Copy className="size-3 mr-1" />}
                    {copiedUrl ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={Boolean(customUrlCooldown)}
                    onClick={() => setIsEditingUrl(true)}
                    className="h-7 px-3 rounded-full text-xs border-white/[0.08] bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center flex-1 h-10 rounded-xl bg-zinc-900/70 border border-white/[0.08] overflow-hidden focus-within:border-white/[0.2]">
                  <span className="px-3.5 text-xs text-zinc-500 bg-zinc-950/60 border-r border-white/[0.06] h-full flex items-center select-none shrink-0">
                    {domainHost}/
                  </span>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="your-server"
                    className="w-full h-full px-3.5 bg-transparent text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleClaimCustomUrl}
                  disabled={claimingCustomUrl || !customUrl.trim() || customUrl === savedCustomUrl}
                  className="h-10 px-5 rounded-full text-xs bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 shrink-0 font-medium"
                >
                  {claimingCustomUrl ? 'Claiming…' : 'Claim'}
                </Button>
                {savedCustomUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCustomUrl(savedCustomUrl);
                      setIsEditingUrl(false);
                    }}
                    className="h-10 px-4 rounded-full text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}

            {/* If server has real forms, show their real links in a small list (never fake/example links) */}
            {realForms.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                <div className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                  <FileText className="size-3" />
                  <span>Server Forms</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {realForms.map(form => {
                    const formPath = `/${activeSlug}/${form.slug || form.id}`;
                    return (
                      <a
                        key={form.id}
                        href={formPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/[0.06] text-xs text-zinc-300 hover:text-white hover:border-white/15 transition-colors"
                      >
                        <span>{form.name}</span>
                        <ExternalLink className="size-3 text-zinc-500" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Banner */}
        <div className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 pr-4">
            <div className="text-sm font-medium text-zinc-100">Banner</div>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Upload a PNG, JPG, or WebP banner (GIF for Premium servers). Displayed in 3:1 ratio capped at 300px.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleSelectBannerFile}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-4 rounded-full text-xs border-white/[0.1] bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center gap-1.5"
              >
                <Upload className="size-3.5" />
                <span>Upload banner</span>
              </Button>
              {bannerUrl && !pendingBannerPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBannerUrl('');
                    setHasChanges(true);
                  }}
                  className="h-9 px-3 rounded-full text-xs text-zinc-400 hover:text-red-400"
                >
                  Remove banner
                </Button>
              )}
            </div>

            {bannerError && (
              <div className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{bannerError}</span>
              </div>
            )}

            {(pendingBannerPreview || bannerUrl) && (
              <div className="w-full aspect-[3/1] max-h-[220px] rounded-xl overflow-hidden bg-zinc-900 border border-white/[0.08] relative">
                <img
                  src={pendingBannerPreview || bannerUrl}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* Row 3: About */}
        <div className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 pr-4">
            <div className="text-sm font-medium text-zinc-100">About</div>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Describe your roleplay community, lore, department opportunities, and requirements.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-2">
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setHasChanges(true);
              }}
              rows={5}
              maxLength={2000}
              placeholder="Tell visitors about your server..."
              className="w-full p-3.5 rounded-xl bg-zinc-900/70 border border-white/[0.08] text-xs text-zinc-100 focus:outline-none focus:border-white/[0.2] resize-y leading-relaxed font-sans"
            />
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>Supports basic markdown paragraphs</span>
              <span>{description.length} / 2000</span>
            </div>
          </div>
        </div>

        {/* Row 4: Tags and Links */}
        <div className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 pr-4">
            <div className="text-sm font-medium text-zinc-100">Tags and links</div>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Add discovery tags and connect your official Roblox group, Discord invite, and social links.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {/* Tag input and list */}
            <div>
              <div className="text-xs text-zinc-400 mb-1.5">Discovery tags (up to 12)</div>
              <div className="flex items-center gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="e.g. realistic, lapd, economy"
                  className="h-10 text-xs bg-zinc-900/70 border-white/[0.08] text-zinc-200"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  className="h-10 px-4 rounded-xl text-xs border-white/[0.08] bg-zinc-900 text-zinc-200 shrink-0"
                >
                  Add tag
                </Button>
              </div>

              {tagList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {tagList.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-zinc-900 border border-white/[0.08] text-zinc-300"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-zinc-500 hover:text-red-400 ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Official links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block">Discord Invite Link</label>
                <Input
                  value={discordInvite}
                  onChange={(e) => {
                    setDiscordInvite(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="https://discord.gg/yourserver"
                  className="h-10 text-xs bg-zinc-900/70 border-white/[0.08] text-zinc-200"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block">Roblox Group / Game</label>
                <Input
                  value={robloxLink}
                  onChange={(e) => {
                    setRobloxLink(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="https://roblox.com/groups/..."
                  className="h-10 text-xs bg-zinc-900/70 border-white/[0.08] text-zinc-200"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block">X / Twitter</label>
                <Input
                  value={twitterLink}
                  onChange={(e) => {
                    setTwitterLink(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="https://x.com/yourhandle"
                  className="h-10 text-xs bg-zinc-900/70 border-white/[0.08] text-zinc-200"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block">Official Website</label>
                <Input
                  value={websiteLink}
                  onChange={(e) => {
                    setWebsiteLink(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="https://yourserver.com"
                  className="h-10 text-xs bg-zinc-900/70 border-white/[0.08] text-zinc-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 5: Staff Team */}
        <div className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 pr-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-100">Staff team</span>
              <Switch
                checked={showStaffList}
                onCheckedChange={(checked) => {
                  setShowStaffList(checked);
                  setSections(prev => prev.map(s => (s.id === 'staff' ? { ...s, enabled: checked } : s)));
                  setHasChanges(true);
                }}
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Show verified staff members on your public page. Pick by Discord role or search by Discord ID/username.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {showStaffList ? (
              <>
                <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/40 space-y-3">
                  <div className="text-xs font-medium text-zinc-200">Add Staff Member</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-zinc-400 mb-1 block">Filter by Discord Role</label>
                      <select
                        value={selectedStaffRoleId}
                        onChange={(e) => {
                          setSelectedStaffRoleId(e.target.value);
                          handleSearchDiscordStaff(e.target.value, staffSearchQuery);
                        }}
                        className="w-full h-10 px-3 rounded-xl bg-zinc-900/70 border border-white/[0.08] text-xs text-zinc-200 focus:outline-none focus:border-white/20"
                      >
                        <option value="">All Roles / Search directly</option>
                        {guildRoles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-zinc-400 mb-1 block">Search Discord User / ID</label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={staffSearchQuery}
                          onChange={(e) => setStaffSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchDiscordStaff();
                            }
                          }}
                          placeholder="Username or Discord ID"
                          className="h-10 text-xs bg-zinc-900/70 border-white/[0.08] text-zinc-200"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={searchingStaff}
                          onClick={() => handleSearchDiscordStaff()}
                          className="h-10 px-3.5 rounded-xl text-xs border-white/[0.08] bg-zinc-900 text-zinc-200 shrink-0"
                        >
                          <Search className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {staffCandidates.length > 0 && (
                    <div className="pt-2 border-t border-white/[0.06] max-h-48 overflow-y-auto space-y-1">
                      <div className="text-[11px] text-zinc-400 px-1 py-0.5">Found Discord members:</div>
                      {staffCandidates.map(c => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/70 hover:bg-zinc-800/70 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                              user={{ id: c.id, username: c.username, avatar: c.avatar }}
                              size={28}
                              className="size-7 rounded-full shrink-0"
                            />
                            <div className="truncate text-xs">
                              <span className="font-medium text-zinc-200">{c.displayName || c.username}</span>
                              <span className="text-zinc-500 ml-2">({c.role})</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddVerifiedStaff(c)}
                            disabled={staffList.some(m => String(m.id) === String(c.id))}
                            className="h-7 px-3 rounded-full text-[11px] bg-zinc-100 text-zinc-900 hover:bg-white shrink-0 font-medium disabled:opacity-40"
                          >
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {staffList.length > 0 && (
                  <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 divide-y divide-white/[0.05]">
                    {staffList.map((member, idx) => (
                      <div
                        key={member.id || idx}
                        className="p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            user={{ id: member.id, username: member.username, avatar: member.avatar }}
                            size={28}
                            className="size-7 rounded-full shrink-0"
                          />
                          <div className="truncate">
                            <span className="font-medium text-zinc-200">{member.displayName || member.username}</span>
                            <span className="text-zinc-500 ml-2">{member.role}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(idx)}
                          className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                          aria-label="Remove staff member"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-zinc-500">Staff team section is hidden.</p>
            )}
          </div>
        </div>

        {/* Row 6: Partners */}
        <div className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 pr-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-100">Partners</span>
              <Switch
                checked={showPartnerList}
                onCheckedChange={(checked) => {
                  setShowPartnerList(checked);
                  setSections(prev => prev.map(s => (s.id === 'partners' ? { ...s, enabled: checked } : s)));
                  setHasChanges(true);
                }}
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Search and select accepted partnerships to showcase on your public page.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-3">
            {showPartnerList ? (
              availablePartners.length === 0 ? (
                <div className="p-4 rounded-xl border border-white/[0.06] bg-zinc-900/30 text-xs text-zinc-400">
                  No accepted partnerships yet. Communities you partner with in the Partnerships hub will appear here automatically.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="size-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={partnerSearchQuery}
                      onChange={(e) => setPartnerSearchQuery(e.target.value)}
                      placeholder="Search accepted partners…"
                      className="pl-8 h-10 text-xs bg-zinc-900/70 border-white/[0.08] text-zinc-200"
                    />
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-zinc-900/40 divide-y divide-white/[0.05] max-h-56 overflow-y-auto">
                    {filteredPartners.map(partner => {
                      const isSelected = partnerList.some(
                        p => String(p.id || p.name) === String(partner.id || partner.name)
                      );
                      return (
                        <button
                          key={partner.id}
                          type="button"
                          onClick={() => handleTogglePartnerSelection(partner)}
                          className="w-full px-3.5 py-3 flex items-center justify-between text-left text-xs hover:bg-white/[0.03] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <ServerIcon
                              guildId={partner.id}
                              iconUrl={partner.icon}
                              name={partner.name}
                              size={28}
                              className="size-7 rounded-lg shrink-0"
                            />
                            <span className="text-zinc-200 font-medium truncate">{partner.name}</span>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] border ${
                              isSelected
                                ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30 font-medium'
                                : 'bg-zinc-900 text-zinc-400 border-white/[0.08]'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            ) : (
              <p className="text-xs text-zinc-500">Partners section is hidden.</p>
            )}
          </div>
        </div>

        {/* Row 7: Page Sections (Simple list: Show switch + drag handle only) */}
        <div className="py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 pr-4">
            <div className="text-sm font-medium text-zinc-100">Page sections</div>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Drag to reorder sections or toggle which sections appear on your public page.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-2">
            {sections.map((section, idx) => (
              <div
                key={section.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleSectionDrop(idx)}
                className="px-4 py-3 rounded-xl bg-zinc-900/60 border border-white/[0.08] flex items-center justify-between gap-3 select-none"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-zinc-500 cursor-grab active:cursor-grabbing hover:text-zinc-300 transition-colors"
                    title="Drag to reorder"
                  >
                    <GripVertical className="size-4" />
                  </span>
                  <span className="text-xs font-medium text-zinc-200">{section.label}</span>
                </div>

                <Switch
                  checked={section.enabled}
                  onCheckedChange={(checked) => toggleSection(section.id, checked)}
                  aria-label={`Show ${section.label}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Row 8: Collapsed "Advanced" Section */}
        <div className="py-8">
          <button
            type="button"
            onClick={() => setAdvancedOpen(prev => !prev)}
            className="w-full flex items-center justify-between text-left py-1 group cursor-pointer"
          >
            <div>
              <div className="text-sm font-medium text-zinc-100 flex items-center gap-2">
                {advancedOpen ? (
                  <ChevronDown className="size-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="size-4 text-zinc-400" />
                )}
                <span>Advanced</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 pl-6">
                ER:LC Server-Key and public credit visibility.
              </p>
            </div>
            <span className="text-xs text-zinc-500 group-hover:text-zinc-300">
              {advancedOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          {advancedOpen && (
            <div className="mt-6 pl-6 space-y-6 border-l border-white/[0.06]">
              {/* Show server credits on my page */}
              <div className="flex items-center justify-between gap-4 max-w-2xl">
                <div>
                  <div className="text-xs font-medium text-zinc-200">Show server credits on my page</div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Display your server's total credit balance in the public stats card.
                  </p>
                </div>
                <Switch
                  checked={showCredits}
                  onCheckedChange={(checked) => {
                    setShowCredits(checked);
                    setHasChanges(true);
                  }}
                />
              </div>

              {/* ER:LC Server-Key Integration */}
              <div className="space-y-3 pt-4 border-t border-white/[0.06] max-w-2xl">
                <div>
                  <div className="text-xs font-medium text-zinc-200">ER:LC Server-Key (Police Roleplay Community)</div>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Connect your ER:LC private server API key to display live in-game player counts, staff presence, and queue length. Cached for 30–60 seconds.
                  </p>
                </div>

                {erlcConnected && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-xs">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Check className="size-4 shrink-0" />
                      <span>Connected with key: {maskedKey}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnectErlc}
                      className="h-7 px-2.5 rounded-full text-xs text-zinc-400 hover:text-red-400"
                    >
                      Disconnect
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="password"
                    value={erlcApiKey}
                    onChange={(e) => {
                      setErlcApiKey(e.target.value);
                      setErlcError(null);
                    }}
                    placeholder={erlcConnected ? 'Enter new Server-Key to replace…' : 'Paste your PRC Server-Key…'}
                    className="h-10 text-xs bg-zinc-900/70 border-white/[0.08] text-zinc-200 flex-1 min-w-[200px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={erlcTesting || (!erlcApiKey.trim() && !erlcConnected)}
                    onClick={handleTestErlc}
                    className="h-10 px-4 rounded-xl text-xs border-white/[0.08] bg-zinc-900 text-zinc-200"
                  >
                    Test
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={erlcTesting || !erlcApiKey.trim()}
                    onClick={handleConnectErlc}
                    className="h-10 px-5 rounded-xl text-xs bg-zinc-100 text-zinc-900 hover:bg-white font-medium"
                  >
                    Save key
                  </Button>
                </div>

                {erlcError && (
                  <div className="text-xs text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{erlcError}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single Save Bar with Clear Unsaved State (Generous bottom padding prevents overlap) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E0E11]/95 backdrop-blur border-t border-white/[0.08] px-6 py-3.5">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-4">
          <div className="text-xs">
            {hasChanges ? (
              <span className="text-amber-400 font-medium flex items-center gap-1.5">
                <AlertCircle className="size-3.5" />
                <span>Unsaved changes</span>
              </span>
            ) : (
              <span className="text-zinc-500">All changes saved</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadServerData()}
              disabled={saving || !hasChanges}
              className="h-9 px-4 rounded-full text-xs border-white/[0.08] bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveChanges}
              disabled={saving}
              className="h-9 px-5 rounded-full text-xs bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 flex items-center gap-1.5 font-medium"
            >
              <Save className="size-3.5" />
              <span>{saving ? 'Saving…' : 'Save changes'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServerDetailsTab;
