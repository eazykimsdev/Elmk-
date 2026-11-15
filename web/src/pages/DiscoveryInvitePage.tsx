import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle, Coins, ArrowRight } from 'lucide-react';

interface DiscoveryResponse {
  ok: boolean;
  error?: string;
  signedIn?: boolean;
  eligible?: boolean;
  inviteUrl?: string;
  server?: {
    id: string;
    name: string;
    iconUrl?: string | null;
    memberCount?: number;
    rewardCoins?: number;
  };
}

export function DiscoveryInvitePage() {
  const { serverId } = useParams<{ serverId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serverId) {
      setError('Missing community ID.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchDiscovery() {
      try {
        const res = await fetch(`/api/discovery/${serverId}/invite?format=json`, {
          headers: { Accept: 'application/json' },
          credentials: 'include'
        });

        const json = await res.json().catch(() => null);

        if (!isMounted) return;

        if (!res.ok || !json?.ok) {
          setError(json?.error || 'Community not found or invite unavailable.');
          setLoading(false);
          return;
        }

        setData(json);
        setLoading(false);

        // If user is already signed in, auto-redirect directly to the Discord invite
        if (json.signedIn && json.inviteUrl) {
          window.location.replace(json.inviteUrl);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError('Failed to resolve invite link. Please try again.');
        setLoading(false);
      }
    }

    fetchDiscovery();

    return () => {
      isMounted = false;
    };
  }, [serverId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="size-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <p className="text-sm text-zinc-400 font-medium">Resolving community invite…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full border border-white/[0.08] bg-[#0E0E11] rounded-2xl p-8 text-center shadow-2xl">
          <div className="inline-flex items-center justify-center size-12 rounded-full bg-rose-500/10 text-rose-400 mb-4 border border-rose-500/20">
            <AlertCircle className="size-6" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2 tracking-tight">Community Not Found</h1>
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            {error || 'This server is not currently listed in the ConnectingERLC discovery directory.'}
          </p>
          <div className="flex justify-center">
            <Link
              to="/dashboard?tab=earn"
              className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-white text-zinc-950 font-semibold text-xs tracking-tight hover:bg-zinc-200 transition-colors"
            >
              Browse communities
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If signed in, show redirecting state (or fallback manual link)
  if (data.signedIn && data.inviteUrl) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full border border-white/[0.08] bg-[#0E0E11] rounded-2xl p-8 text-center shadow-2xl">
          <div className="size-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mx-auto mb-4" />
          <h1 className="text-lg font-bold text-white mb-2 tracking-tight">Redirecting to Discord…</h1>
          <p className="text-sm text-zinc-400 leading-relaxed mb-6">
            We are opening the server invite for you. If you are not redirected automatically within a few seconds, click below.
          </p>
          <div className="flex justify-center">
            <a
              href={data.inviteUrl}
              className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-full bg-white text-zinc-950 font-semibold text-xs tracking-tight hover:bg-zinc-200 transition-colors"
            >
              Continue to Discord
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // If NOT signed in: show prompt with "Log in with Discord to earn credits" and "Continue without credits"
  const serverName = data.server?.name || 'Community';
  const rewardCoins = data.server?.rewardCoins || 2;
  const targetInviteUrl = data.inviteUrl || '#';
  const returnUrl = encodeURIComponent(`/discovery/${serverId}/invite`);

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full border border-white/[0.08] bg-[#0E0E11] rounded-2xl p-8 text-center shadow-2xl">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#C42B35] bg-[#C42B35]/10 border border-[#C42B35]/25 rounded-full px-3 py-1 mb-5 uppercase tracking-wider">
          <Coins className="size-3" />
          +{rewardCoins} Credits Bounty
        </div>

        <h1 className="text-xl font-bold text-white mb-2 tracking-tight">
          Join {serverName}
        </h1>

        <p className="text-sm text-zinc-400 leading-relaxed mb-7">
          Sign in with Discord to earn growth credits for your community when joining, or continue directly to the server.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href={`/api/auth/discord?returnTo=${returnUrl}`}
            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white text-zinc-950 font-semibold text-xs tracking-tight hover:bg-zinc-200 transition-colors"
          >
            Log in with Discord to earn credits
            <ArrowRight className="size-3.5" />
          </a>

          <a
            href={targetInviteUrl}
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-transparent border border-white/[0.12] text-zinc-400 font-medium text-xs tracking-tight hover:text-white hover:border-white/25 transition-colors"
          >
            Continue without credits
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
