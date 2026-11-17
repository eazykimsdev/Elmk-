import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  KeyRound,
  ExternalLink,
  Save,
  Check,
  AlertCircle,
  Link as LinkIcon,
  Globe,
  Tag,
  Shield,
  Users,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  description: string;
  enabled: boolean;
}

const DEFAULT_SECTIONS: SectionItem[] = [
  { id: 'erlc', label: 'In-Game ER:LC Status', description: 'Live players, staff on duty, and queue size from the Police Roleplay Community API', enabled: true },
  { id: 'about', label: 'About Community', description: 'Server description and background story', enabled: true },
  { id: 'badges', label: 'Badges & Stats', description: 'Leaderboard ranking, verified/premium badges, and activity level', enabled: true },
  { id: 'reviews', label: 'Community Reviews', description: 'Ratings and feedback from verified community members', enabled: true },
  { id: 'staff', label: 'Staff Team', description: 'Leadership and administrative roster', enabled: false },
  { id: 'partners', label: 'Partner Communities', description: 'Affiliated and partner Discord communities', enabled: false }
];

export function ServerDetailsTab({
  guild,
  workspace,
  config: initialConfig,
  onNavigateTab: _onNavigateTab,
  addToast
}: ServerDetailsTabProps) {
  const guildId = guild?.id || workspace?.guildId || '';

  // Form states
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [discordInvite, setDiscordInvite] = useState<string>('');
  const [robloxLink, setRobloxLink] = useState<string>('');
  const [twitterLink, setTwitterLink] = useState<string>('');
  const [websiteLink, setWebsiteLink] = useState<string>('');
  
  // Custom URL (F4)
  const [customUrl, setCustomUrl] = useState<string>('');
  const [savedCustomUrl, setSavedCustomUrl] = useState<string>('');
  const [customUrlCooldown, setCustomUrlCooldown] = useState<string | null>(null);
  const [claimingCustomUrl, setClaimingCustomUrl] = useState<boolean>(false);

  // ER:LC Secret Key (F3)
  const [erlcApiKey, setErlcApiKey] = useState<string>('');
  const [maskedKey, setMaskedKey] = useState<string>('');
  const [erlcConnected, setErlcConnected] = useState<boolean>(false);
  const [erlcTesting, setErlcTesting] = useState<boolean>(false);
  const [erlcError, setErlcError] = useState<string | null>(null);

  // Sections Order & Visibility (F3)
  const [sections, setSections] = useState<SectionItem[]>(DEFAULT_SECTIONS);

  // Staff & Partner lists
  const [showStaffList, setShowStaffList] = useState<boolean>(false);
  const [staffList, setStaffList] = useState<Array<{ role: string; username: string }>>([]);
  const [newStaffRole, setNewStaffRole] = useState<string>('');
  const [newStaffName, setNewStaffName] = useState<string>('');

  const [showPartnerList, setShowPartnerList] = useState<boolean>(false);
  const [partnerList, setPartnerList] = useState<Array<{ name: string; link: string }>>([]);
  const [newPartnerName, setNewPartnerName] = useState<string>('');
  const [newPartnerLink, setNewPartnerLink] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // Fetch full server details from backend
  const loadServerData = async () => {
    if (!guildId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/servers/${guildId}`);
      if (res.ok) {
        const data = await res.json();
        const s = data.server || data;
        setBannerUrl(s.bannerUrl || '');
        setDescription(s.description || '');
        setTags(Array.isArray(s.tags) ? s.tags.join(', ') : (s.tags || ''));
        setDiscordInvite(s.inviteUrl || '');
        
        const social = s.socialLinks || {};
        setRobloxLink(social.roblox || '');
        setTwitterLink(social.twitter || '');
        setWebsiteLink(social.website || '');

        setCustomUrl(s.customUrl || '');
        setSavedCustomUrl(s.customUrl || '');
        if (s.customUrlChangedAt) {
          const diffMs = Date.now() - new Date(s.customUrlChangedAt).getTime();
          const cooldownMs = 30 * 86400 * 1000;
          if (diffMs < cooldownMs) {
            const daysLeft = Math.ceil((cooldownMs - diffMs) / (86400 * 1000));
            setCustomUrlCooldown(`${daysLeft} days remaining`);
          } else {
            setCustomUrlCooldown(null);
          }
        }

        setShowStaffList(Boolean(s.showStaffList));
        setStaffList(Array.isArray(s.staffList) ? s.staffList : []);
        setShowPartnerList(Boolean(s.showPartnerList));
        setPartnerList(Array.isArray(s.partnerList) ? s.partnerList : []);

        // Sections order and visibility
        if (Array.isArray(s.pageSections) && s.sectionVisibility) {
          const loaded: SectionItem[] = s.pageSections.map((secId: string) => {
            const def = DEFAULT_SECTIONS.find(d => d.id === secId) || {
              id: secId,
              label: secId.toUpperCase(),
              description: '',
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

        // ER:LC status
        if (s.erlc && s.erlc.connected) {
          setErlcConnected(true);
          setMaskedKey(s.erlc.maskedKey || '••••••••••••••••');
        } else {
          setErlcConnected(false);
          setMaskedKey('');
        }
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

  // Section reordering
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const updated = [...sections];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setSections(updated);
    setHasChanges(true);
  };

  const toggleSection = (id: string) => {
    setSections(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    setHasChanges(true);
  };

  // ER:LC Connection Handlers
  const handleConnectErlc = async () => {
    if (!erlcApiKey.trim() || !guildId) return;
    setErlcTesting(true);
    setErlcError(null);
    try {
      const res = await fetch(`/api/servers/${guildId}/erlc/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: erlcApiKey.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect ER:LC key.');
      }
      setErlcConnected(true);
      setMaskedKey(data.maskedKey || '••••••••••••••••' + erlcApiKey.trim().slice(-4));
      setErlcApiKey('');
      addToast('success', 'ER:LC Connected', 'Successfully authenticated ER:LC server key.');
      setHasChanges(false);
    } catch (err: any) {
      setErlcError(err.message || 'ER:LC connection test failed.');
      addToast('error', 'Connection Failed', err.message || 'ER:LC connection test failed.');
    } finally {
      setErlcTesting(false);
    }
  };

  const handleDisconnectErlc = async () => {
    if (!guildId) return;
    try {
      const res = await fetch(`/api/servers/${guildId}/erlc/disconnect`, {
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

  // Custom URL Claim Handler (F4)
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
        throw new Error(data.error || 'Failed to claim custom URL.');
      }
      setSavedCustomUrl(candidate);
      addToast('success', 'Custom URL Claimed', `Your server is now live at connectingerlc.xyz/${candidate}`);
      loadServerData();
    } catch (err: any) {
      addToast('error', 'Claim Failed', err.message || 'Could not claim custom URL.');
    } finally {
      setClaimingCustomUrl(false);
    }
  };

  // Staff and Partner helpers
  const handleAddStaff = () => {
    if (!newStaffName.trim()) return;
    setStaffList(prev => [...prev, { role: newStaffRole.trim() || 'Staff', username: newStaffName.trim() }]);
    setNewStaffName('');
    setNewStaffRole('');
    setHasChanges(true);
  };

  const handleRemoveStaff = (idx: number) => {
    setStaffList(prev => prev.filter((_, i) => i !== idx));
    setHasChanges(true);
  };

  const handleAddPartner = () => {
    if (!newPartnerName.trim()) return;
    setPartnerList(prev => [...prev, { name: newPartnerName.trim(), link: newPartnerLink.trim() }]);
    setNewPartnerName('');
    setNewPartnerLink('');
    setHasChanges(true);
  };

  const handleRemovePartner = (idx: number) => {
    setPartnerList(prev => prev.filter((_, i) => i !== idx));
    setHasChanges(true);
  };

  // Save All Changes (Single Save Bar)
  const handleSaveChanges = async () => {
    if (!guildId) return;
    setSaving(true);
    try {
      const pageSections = sections.map(s => s.id);
      const sectionVisibility = sections.reduce((acc, s) => {
        acc[s.id] = s.enabled;
        return acc;
      }, {} as Record<string, boolean>);

      const payload = {
        bannerUrl: bannerUrl.trim(),
        description: description.trim(),
        tags: tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean),
        inviteUrl: discordInvite.trim(),
        socialLinks: {
          discord: discordInvite.trim(),
          roblox: robloxLink.trim(),
          twitter: twitterLink.trim(),
          website: websiteLink.trim()
        },
        pageSections,
        sectionVisibility,
        showStaffList,
        staffList,
        showPartnerList,
        partnerList
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
        Loading server page editor…
      </div>
    );
  }

  const previewSlug = savedCustomUrl || guildId;
  const publicPageUrl = `${window.location.origin}/${previewSlug}`;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-24 font-sans text-zinc-200">
      {/* Header with Live Preview Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Globe className="size-5 text-zinc-400" />
            Server Page Editor
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Customize your public presence, reorder sections, and connect your ER:LC telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(publicPageUrl, '_blank')}
            className="text-xs border-white/[0.08] hover:bg-white/[0.04] flex items-center gap-1.5"
          >
            <span>View Public Page</span>
            <ExternalLink className="size-3.5 text-zinc-400" />
          </Button>
        </div>
      </div>

      {/* Row 1: Custom URL (F4) */}
      <div className="py-5 border-b border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div>
          <h2 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
            <LinkIcon className="size-4 text-zinc-400" />
            Custom Short URL
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Claim a vanity link for your server (e.g. connectingerlc.xyz/yourname). Old server ID links automatically redirect here.
          </p>
          {customUrlCooldown && (
            <div className="text-[11px] text-amber-400 mt-2 flex items-center gap-1">
              <AlertCircle className="size-3" />
              <span>Change cooldown: {customUrlCooldown}</span>
            </div>
          )}
        </div>

        <div className="md:col-span-2 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-xs text-zinc-500 select-none">
                /
              </span>
              <Input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="community-name"
                className="pl-6 text-xs h-9 bg-zinc-900/60 border-white/[0.08] text-zinc-200"
              />
            </div>
            <Button
              onClick={handleClaimCustomUrl}
              disabled={claimingCustomUrl || !customUrl.trim() || customUrl === savedCustomUrl}
              size="sm"
              className="text-xs h-9 px-4 bg-[var(--accent)] text-white hover:opacity-90"
            >
              {claimingCustomUrl ? 'Claiming…' : (savedCustomUrl ? 'Update URL' : 'Claim URL')}
            </Button>
          </div>
          {savedCustomUrl && (
            <p className="text-[11px] text-zinc-400 font-mono">
              Live link: <span className="text-zinc-200 font-sans">{publicPageUrl}</span>
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Banner Image */}
      <div className="py-5 border-b border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div>
          <h2 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
            <ImageIcon className="size-4 text-zinc-400" />
            Cover Banner
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            High-resolution banner displayed at the top of your public page. Recommended ratio: 16:9 or 3:1.
          </p>
        </div>

        <div className="md:col-span-2 space-y-3">
          <Input
            value={bannerUrl}
            onChange={(e) => {
              setBannerUrl(e.target.value);
              setHasChanges(true);
            }}
            placeholder="https://i.imgur.com/example.png or Discord CDN URL"
            className="text-xs h-9 bg-zinc-900/60 border-white/[0.08] text-zinc-200"
          />
          {bannerUrl && (
            <div className="h-32 w-full rounded-lg overflow-hidden border border-white/[0.08] bg-zinc-950 relative">
              <img
                src={bannerUrl}
                alt="Banner preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Row 3: ER:LC Server Key Connection (F3) */}
      <div className="py-5 border-b border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div>
          <h2 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
            <KeyRound className="size-4 text-zinc-400" />
            ER:LC Server Key
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Live in-game telemetry (players, staff, queue) connects via the Police Roleplay Community API. Keys are stored encrypted with AES-256-GCM.
          </p>
        </div>

        <div className="md:col-span-2 space-y-3">
          {erlcConnected ? (
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/[0.08] flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-400" />
                  Connected to ER:LC
                </div>
                <div className="text-[11px] text-zinc-400 font-mono mt-1">
                  Key: {maskedKey}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectErlc}
                className="text-xs h-8 text-red-400 border-red-500/20 hover:bg-red-500/10"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={erlcApiKey}
                  onChange={(e) => setErlcApiKey(e.target.value)}
                  placeholder="Paste your PRC Server Key here"
                  className="text-xs h-9 bg-zinc-900/60 border-white/[0.08] text-zinc-200 flex-1"
                />
                <Button
                  onClick={handleConnectErlc}
                  disabled={erlcTesting || !erlcApiKey.trim()}
                  size="sm"
                  className="text-xs h-9 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/[0.08]"
                >
                  {erlcTesting ? 'Testing…' : 'Connect Key'}
                </Button>
              </div>
              {erlcError && (
                <div className="text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="size-3" />
                  <span>{erlcError}</span>
                </div>
              )}
              <p className="text-[11px] text-zinc-500">
                Generate your Server-Key in ER:LC server settings under API permissions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Page Sections Order & Visibility (F3) */}
      <div className="py-5 border-b border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div>
          <h2 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
            <Sparkles className="size-4 text-zinc-400" />
            Sections & Order
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Toggle visibility and arrange the order of sections on your public page.
          </p>
        </div>

        <div className="md:col-span-2 space-y-2.5">
          {sections.map((section, idx) => (
            <div
              key={section.id}
              className={`p-3 rounded-xl border transition-colors flex items-center justify-between ${
                section.enabled
                  ? 'bg-zinc-900/60 border-white/[0.08]'
                  : 'bg-zinc-950/40 border-white/[0.04] opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={`size-7 rounded-lg flex items-center justify-center transition-colors ${
                    section.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-500 border border-white/[0.04]'
                  }`}
                  aria-label={section.enabled ? `Hide ${section.label}` : `Show ${section.label}`}
                >
                  {section.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
                <div>
                  <div className="text-xs font-medium text-zinc-200">{section.label}</div>
                  <div className="text-[11px] text-zinc-500 line-clamp-1">{section.description}</div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveSection(idx, 'up')}
                  className="size-7 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white/[0.04]"
                  aria-label="Move section up"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === sections.length - 1}
                  onClick={() => moveSection(idx, 'down')}
                  className="size-7 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-200 disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white/[0.04]"
                  aria-label="Move section down"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 5: About Markdown Text */}
      <div className="py-5 border-b border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div>
          <h2 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
            About Text
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Tell prospective members what makes your community unique. Markdown formatting is supported.
          </p>
        </div>

        <div className="md:col-span-2 space-y-2">
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setHasChanges(true);
            }}
            rows={5}
            placeholder="Write a clear, engaging overview of your server…"
            className="w-full text-xs p-3 bg-zinc-900/60 border border-white/[0.08] rounded-xl text-zinc-200 focus:outline-none focus:border-white/[0.2] resize-y"
          />
        </div>
      </div>

      {/* Row 6: Tags & Community Links */}
      <div className="py-5 border-b border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div>
          <h2 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
            <Tag className="size-4 text-zinc-400" />
            Tags & Links
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Discoverability tags and official community destinations.
          </p>
        </div>

        <div className="md:col-span-2 space-y-3">
          <div>
            <label className="text-[11px] text-zinc-400 mb-1 block">Tags (comma separated)</label>
            <Input
              value={tags}
              onChange={(e) => {
                setTags(e.target.value);
                setHasChanges(true);
              }}
              placeholder="erlc, roleplay, police, fire, dispatch"
              className="text-xs h-9 bg-zinc-900/60 border-white/[0.08] text-zinc-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block">Discord Invite URL</label>
              <Input
                value={discordInvite}
                onChange={(e) => {
                  setDiscordInvite(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="https://discord.gg/yourcode"
                className="text-xs h-9 bg-zinc-900/60 border-white/[0.08] text-zinc-200"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block">Roblox Group URL</label>
              <Input
                value={robloxLink}
                onChange={(e) => {
                  setRobloxLink(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="https://www.roblox.com/groups/..."
                className="text-xs h-9 bg-zinc-900/60 border-white/[0.08] text-zinc-200"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block">Twitter / X URL</label>
              <Input
                value={twitterLink}
                onChange={(e) => {
                  setTwitterLink(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="https://x.com/community"
                className="text-xs h-9 bg-zinc-900/60 border-white/[0.08] text-zinc-200"
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
                className="text-xs h-9 bg-zinc-900/60 border-white/[0.08] text-zinc-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Row 7: Staff List */}
      <div className="py-5 border-b border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
              <Shield className="size-4 text-zinc-400" />
              Staff Team
            </h2>
            <input
              type="checkbox"
              checked={showStaffList}
              onChange={(e) => {
                setShowStaffList(e.target.checked);
                setHasChanges(true);
              }}
              className="size-4 rounded border-white/[0.2] bg-zinc-900 text-[var(--accent)]"
            />
          </div>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Turn on to showcase leadership and moderators on your public page.
          </p>
        </div>

        <div className="md:col-span-2 space-y-3">
          {showStaffList ? (
            <div className="space-y-3">
              <div className="space-y-2">
                {staffList.map((member, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-zinc-200">{member.username}</span>
                      <span className="text-zinc-500 ml-2">({member.role})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStaff(idx)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="Discord Username"
                  className="text-xs h-8 bg-zinc-900/60 border-white/[0.08] text-zinc-200 flex-1"
                />
                <Input
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  placeholder="Role (e.g. Administrator)"
                  className="text-xs h-8 bg-zinc-900/60 border-white/[0.08] text-zinc-200 flex-1"
                />
                <Button
                  onClick={handleAddStaff}
                  size="sm"
                  className="text-xs h-8 px-3 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                >
                  <Plus className="size-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">Staff list is currently turned off.</p>
          )}
        </div>
      </div>

      {/* Row 8: Partner Communities */}
      <div className="py-5 border-b border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
              <Users className="size-4 text-zinc-400" />
              Partners List
            </h2>
            <input
              type="checkbox"
              checked={showPartnerList}
              onChange={(e) => {
                setShowPartnerList(e.target.checked);
                setHasChanges(true);
              }}
              className="size-4 rounded border-white/[0.2] bg-zinc-900 text-[var(--accent)]"
            />
          </div>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Turn on to showcase cross-promoted and partner communities.
          </p>
        </div>

        <div className="md:col-span-2 space-y-3">
          {showPartnerList ? (
            <div className="space-y-3">
              <div className="space-y-2">
                {partnerList.map((partner, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-zinc-200">{partner.name}</span>
                      {partner.link && <span className="text-zinc-500 ml-2 font-mono text-[11px]">{partner.link}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePartner(idx)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  placeholder="Partner Community Name"
                  className="text-xs h-8 bg-zinc-900/60 border-white/[0.08] text-zinc-200 flex-1"
                />
                <Input
                  value={newPartnerLink}
                  onChange={(e) => setNewPartnerLink(e.target.value)}
                  placeholder="Discord Link (optional)"
                  className="text-xs h-8 bg-zinc-900/60 border-white/[0.08] text-zinc-200 flex-1"
                />
                <Button
                  onClick={handleAddPartner}
                  size="sm"
                  className="text-xs h-8 px-3 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                >
                  <Plus className="size-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">Partner list is currently turned off.</p>
          )}
        </div>
      </div>

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E0E11]/95 backdrop-blur border-t border-white/[0.08] p-4 flex items-center justify-between max-w-4xl mx-auto rounded-t-xl">
        <div className="text-xs text-zinc-400">
          {hasChanges ? (
            <span className="text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="size-3.5" />
              You have unsaved changes
            </span>
          ) : (
            <span className="text-zinc-500">All changes up to date</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadServerData()}
            disabled={saving || !hasChanges}
            className="text-xs border-white/[0.08] hover:bg-white/[0.04]"
          >
            Reset
          </Button>
          <Button
            onClick={handleSaveChanges}
            disabled={saving}
            size="sm"
            className="text-xs px-5 bg-[var(--accent)] text-white hover:opacity-90 flex items-center gap-1.5"
          >
            <Save className="size-3.5" />
            <span>{saving ? 'Saving…' : 'Save Changes'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ServerDetailsTab;
