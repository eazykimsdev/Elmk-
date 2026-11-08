import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Users,
  ShieldCheck,
  Flame,
  KeyRound,
  Copy,
  Check,
  Compass,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ServerIcon } from '@/components/ui/ServerIcon';
import { PublicIconRail } from '@/components/ui/PublicIconRail';
import { MarkdownRenderer, stripMarkdown } from '@/components/ui/markdown-renderer';
import { ServerProfileModal } from '@/components/ServerProfileModal';
import type { PromotedServer } from './dashboard/EarnCoinsTab';

export function PublicServerListingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<PromotedServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [modalOpen, setModalOpen] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadListing() {
      setLoading(true);
      try {
        if (slug) {
          const singleRes = await fetch(`/api/servers/${encodeURIComponent(slug)}`);
          if (singleRes.ok) {
            const data = await singleRes.json();
            const found = data.server || data;
            if (found && active) {
              setServer(found);
              updateMeta(found);
              setLoading(false);
              return;
            }
          }
        }
      } catch {}

      try {
        const res = await fetch(`/api/directory`);
        if (res.ok) {
          const data = await res.json();
          const list: PromotedServer[] = data.servers || (Array.isArray(data) ? data : []);
          const match = list.find(
            (s) =>
              s.id === slug ||
              (s.name && s.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') === slug) ||
              (s.joinCode && s.joinCode.toLowerCase() === slug)
          );
          if (match && active) {
            setServer(match);
            updateMeta(match);
            setLoading(false);
            return;
          }
        }
      } catch {}

      // Fallback: check localStorage for local workspace config
      try {
        const raw = localStorage.getItem(`erlcus_customizations_${slug}`);
        if (raw && active) {
          const parsed = JSON.parse(raw);
          const fallbackServer: PromotedServer = {
            id: slug || 'community',
            name: parsed.serverName || 'Community Server',
            icon: parsed.serverIconUrl || null,
            category: parsed.serverCategory || 'Roleplay Server',
            language: 'English',
            description: parsed.serverDescription || 'A welcoming ER:LC roleplay community on ConnectingERLC.',
            tags: parsed.serverTags ? parsed.serverTags.split(',').map((t: string) => t.trim().replace(/^#/, '')) : ['roleplay'],
            rewardCoins: 2,
            inviteUrl: parsed.inviteUrl || 'https://discord.gg',
            bannerUrl: parsed.serverBannerUrl || parsed.bannerUrl,
            joinCode: parsed.joinCode
          };
          setServer(fallbackServer);
          updateMeta(fallbackServer);
          setLoading(false);
          return;
        }
      } catch {}

      if (active) setLoading(false);
    }

    function updateMeta(s: PromotedServer) {
      document.title = `${s.name} · ConnectingERLC Discord Directory`;
      
      const setOrCreateMeta = (property: string, content: string) => {
        let meta = document.querySelector(`meta[property="${property}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', property);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };

      setOrCreateMeta('og:title', `${s.name} on ConnectingERLC`);
      setOrCreateMeta('og:description', stripMarkdown(s.description) || `Join ${s.name} on Discord.`);
      if (s.bannerUrl) {
        setOrCreateMeta('og:image', s.bannerUrl);
      } else if (s.icon) {
        setOrCreateMeta('og:image', s.icon);
      }
      setOrCreateMeta('og:url', window.location.href);
      setOrCreateMeta('og:type', 'website');
    }

    loadListing();

    return () => {
      active = false;
    };
  }, [slug]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleJoin = () => {
    if (!server?.inviteUrl) return;
    window.open(server.inviteUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-svh bg-[#09090B] flex flex-col items-center justify-center gap-3 text-sm text-[#A1A1AA] font-sans">
        <div className="size-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <span>Loading server listing…</span>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="min-h-svh bg-[#09090B] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md space-y-4">
          <div className="text-[28px] font-bold text-[#F4F4F5]">404</div>
          <h1 className="text-[18px] font-semibold text-[#F4F4F5]">Server not found</h1>
          <p className="text-[14px] text-[#A1A1AA]">
            This server listing does not exist or has not been published yet.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link to="/">
              <Button variant="primary">Go home</Button>
            </Link>
            <Link to="/servers">
              <Button variant="secondary">Browse directory</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tags = (server.tags || []).slice(0, 5);

  return (
    <div className="min-h-svh bg-[#09090B] text-[#F4F4F5] font-sans flex flex-col selection:bg-[var(--accent)]/20 selection:text-[var(--accent)]">
      <PublicIconRail />
      <div className="md:pl-16 pb-16 md:pb-0 flex-1 flex flex-col">

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] overflow-hidden">
          {/* Banner Container (Fixed h-48 sm:h-56, centered, overflow-hidden, rounded-t-[16px]) */}
          <div className="h-48 sm:h-56 w-full overflow-hidden bg-[#141417] border-b border-[var(--border)] rounded-t-[16px] relative">
            {server.bannerUrl ? (
              <img
                src={server.bannerUrl}
                alt={`${server.name} banner`}
                className="w-full h-full object-cover object-center block"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#18181B] via-[#141417] to-[#0E0E11]" />
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <ServerIcon
                  guildId={server.id}
                  iconUrl={server.icon}
                  name={server.name}
                  size={72}
                  className="size-16 sm:size-20 rounded-[16px] object-cover bg-[#141417] border border-[var(--border)] shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-[22px] sm:text-[24px] font-semibold text-[#F4F4F5] leading-tight">
                      {server.name}
                    </h1>
                    {server.verified && (
                      <Badge variant="outline" className="border-[var(--accent-border)] text-[var(--accent)] bg-[var(--accent-soft)]">
                        <ShieldCheck className="size-3" />
                        <span>Verified</span>
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 text-[13px] text-[#A1A1AA] flex-wrap">
                    <span className="font-medium text-[#F4F4F5]">
                      {server.category}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-[#71717A]" />
                      <span>{server.memberCount || 0} members</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleJoin}
                  className="w-full sm:w-auto h-11 px-6 text-[14px] font-medium"
                >
                  <span>Join server</span>
                  <ExternalLink className="size-4" />
                </Button>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <h2 className="text-[13px] font-medium text-[#71717A] uppercase tracking-wider">
                About this community
              </h2>
              <div className="text-[14px] leading-6 text-[#D4D4D8] font-sans">
                <MarkdownRenderer content={server.description || 'No description provided.'} />
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <h2 className="text-[13px] font-medium text-[#71717A] uppercase tracking-wider">
                  Tags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="px-2.5 py-1 text-[12px] font-medium text-[#F4F4F5] bg-[#141417] border-[var(--border)] capitalize"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* ER:LC Join Code if configured */}
            {server.joinCode && (
              <div className="rounded-[10px] bg-[#141417] border border-[var(--border)] p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <KeyRound className="size-4 text-[var(--accent)]" />
                  <div>
                    <div className="text-[13px] font-medium text-[#F4F4F5]">
                      ER:LC Join Code
                    </div>
                    <div className="text-[12px] text-[#A1A1AA] font-mono">
                      {server.joinCode}
                    </div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopyCode(server.joinCode!)}
                >
                  {copiedCode ? <Check className="size-3.5 text-[var(--accent)]" /> : <Copy className="size-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy code'}</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Callout below */}
        <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-[15px] font-semibold text-[#F4F4F5]">
              Own an ER:LC or roleplay community?
            </h3>
            <p className="text-[13px] text-[#A1A1AA]">
              List your Discord server on ConnectingERLC to gain members and climb the directory.
            </p>
          </div>
          <Link to="/login" className="shrink-0 w-full sm:w-auto">
            <Button variant="secondary" size="sm" className="w-full">
              <span>List your server</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </main>
      </div>

      {/* Details Popup Modal (?server=slug or /s/:slug entry point) */}
      {slug && modalOpen && (
        <ServerProfileModal
          serverSlug={slug}
          initialServer={server}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}


