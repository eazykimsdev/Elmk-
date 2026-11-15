import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { RecruitsTab } from './dashboard/RecruitsTab';
import NotificationsBlock, { type ToastNotification } from '@/components/ui/notifications-5';
import { useAuth } from '@/lib/auth';

export function RecruitHubPage() {
  const { serverSlug } = useParams<{ serverSlug?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [guildId, setGuildId] = useState<string>('');
  const [serverName, setServerName] = useState<string>('Community Server');
  const [serverIcon, setServerIcon] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (
    variant: 'success' | 'info' | 'warning' | 'error',
    title: string,
    body: string
  ) => {
    setToasts((prev) => {
      const id = Date.now() + Math.random();
      setTimeout(() => {
        setToasts((curr) => curr.filter((t) => t.id !== id));
      }, 4500);
      return [...prev, { id, variant, title, body }];
    });
  };

  useEffect(() => {
    async function resolveServer() {
      const slug = serverSlug || localStorage.getItem('erlcus_default_guild') || '';
      if (/^\d{17,20}$/.test(slug)) {
        setGuildId(slug);
      }

      try {
        const res = await fetch('/api/directory/servers');
        if (res.ok) {
          const list = await res.json();
          const match = list.find(
            (s: any) =>
              s.id === slug ||
              (s.name && s.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') === slug) ||
              (s.joinCode && s.joinCode.toLowerCase() === slug)
          );
          if (match) {
            setGuildId(match.id);
            setServerName(match.name);
            setServerIcon(match.iconUrl || null);
            return;
          }
        }
      } catch {}

      try {
        const wsRes = await fetch(`/api/workspace/${slug}`);
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          if (wsData?.guild) {
            setGuildId(wsData.guild.id);
            setServerName(wsData.guild.name);
            setServerIcon(wsData.guild.iconUrl || null);
          }
        }
      } catch {}
    }

    resolveServer();
  }, [serverSlug]);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] font-sans">
      <NotificationsBlock notifications={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      {/* Top Bar */}
      <header className="sticky top-0 z-40 h-12 border-b border-white/[0.06] bg-[#09090B]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back</span>
          </button>
          <span className="text-zinc-600">/</span>
          <Link to="/dashboard" className="text-xs text-zinc-400 hover:text-white transition-colors">
            Dashboard
          </Link>
        </div>

        <Link
          to={`/dashboard/${guildId}`}
          className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <span>Open in dashboard</span>
          <ChevronRight className="size-3" />
        </Link>
      </header>

      {/* Page Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <RecruitsTab
          currentGuildId={guildId}
          serverName={serverName}
          serverIcon={serverIcon}
          isOwner={true}
          addToast={addToast}
        />
      </main>
    </div>
  );
}

export default RecruitHubPage;

