import { useState, useEffect } from 'react';
import { ShieldAlert, ExternalLink, LogOut, Clock, Hash, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/brand';
import { BrandLogo } from '@/components/BrandLogo';

export interface BannedPageProps {
  banDetails?: {
    id?: string;
    referenceId?: string;
    reason?: string;
    duration?: string;
    expiresAt?: string | null;
    bannedAt?: string;
    admin?: string;
  };
}

export function BannedPage({ banDetails: initialDetails }: BannedPageProps) {
  const [details, setDetails] = useState<any>(() => {
    if (initialDetails) return initialDetails;
    try {
      const stored = localStorage.getItem('erlcus_current_user_ban');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      id: 'ban_system',
      reason: `Account restriction enforced on ${BRAND.name}.`,
      duration: 'Permanent',
      bannedAt: new Date().toISOString(),
      expiresAt: null,
    };
  });

  const [isAdminUser, setIsAdminUser] = useState(false);
  const [unbanningSelf, setUnbanningSelf] = useState(false);
  const [selfUnbanSuccess, setSelfUnbanSuccess] = useState(false);

  // Fetch fresh ban status from /api/auth/me if not fully populated
  useEffect(() => {
    async function checkBan() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data && !data.isBanned && !data?.user?.isBanned) {
            try {
              localStorage.removeItem('erlcus_current_user_ban');
            } catch {}
            window.location.replace('/dashboard');
            return;
          }
          if (data?.ban) {
            const enriched = {
              ...data.ban,
              supportServerUrl: data.supportServerUrl || data.ban.supportServerUrl || 'https://discord.gg/connectingerlc'
            };
            setDetails(enriched);
            localStorage.setItem('erlcus_current_user_ban', JSON.stringify(enriched));
          }
          if (data?.user?.isAdmin || data?.user?.role === 'Owner' || data?.user?.role === 'Admin' || data?.user?.role === 'Moderator') {
            setIsAdminUser(true);
          }
        }
      } catch {}

      // Also check admin status in case user is staff
      try {
        const adminCheck = await fetch('/api/admin/check');
        if (adminCheck.ok) {
          const adm = await adminCheck.json();
          if (adm.isAdmin || adm.ok) setIsAdminUser(true);
        }
      } catch {}
    }
    checkBan();
  }, []);

  const handleSelfUnban = async () => {
    setUnbanningSelf(true);
    try {
      const res = await fetch('/api/admin/self-unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setSelfUnbanSuccess(true);
        try { localStorage.removeItem('erlcus_current_user_ban'); } catch {}
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 700);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to unban account.');
      }
    } catch {
      alert('Network error communicating with server.');
    } finally {
      setUnbanningSelf(false);
    }
  };

  const isPermanent = !details.expiresAt || details.duration === 'Permanent';
  const banDate = details.bannedAt
    ? new Date(details.bannedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Active';

  const expiryDate = details.expiresAt
    ? new Date(details.expiresAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const referenceId =
    details.referenceId ||
    details.id ||
    `REF-${Math.abs(
      (details.reason || 'mavely').split('').reduce((a: number, b: string) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0)
    ).toString(16).toUpperCase()}`;

  // Live countdown timer for temporary suspensions
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    if (isPermanent || !details.expiresAt) return;

    function updateTimer() {
      const remainingMs = new Date(details.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setCountdown('Suspension expired. Refresh to restore access.');
        return;
      }
      const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((remainingMs / (1000 * 60)) % 60);
      const seconds = Math.floor((remainingMs / 1000) % 60);

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setCountdown(parts.join(' ') + ' remaining');
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [details.expiresAt, isPermanent]);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    } catch {}
    // Clear cookie client-side
    document.cookie = 'erlcus_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'connectingerlc_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-12 select-none font-sans">
      <div className="flex flex-col items-center text-center max-w-lg mx-auto animate-in fade-in-50 duration-300 w-full">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 mb-4">
          <BrandLogo size="md" />
        </div>

        {/* Massive 403 Headline */}
        <h1 className="text-8xl sm:text-9xl md:text-[140px] font-black tracking-tight text-white leading-none">
          403
        </h1>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-6">
          {isPermanent ? 'Your account is banned' : 'Your account is suspended'}
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed max-w-md">
          {isPermanent
            ? `Your account has been permanently banned from the ${BRAND.name} platform by an administrator.`
            : `Your account has been temporarily suspended from the ${BRAND.name} platform by an administrator.`}
        </p>

        {/* Administrative Notice Box */}
        <div className="mt-6 p-4 rounded-2xl bg-[#0E0E11] border border-white/[0.08] text-left w-full space-y-3 font-sans">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Administrative notice</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              {details.duration || (isPermanent ? 'Permanent' : 'Temporary')}
            </span>
          </div>

          <p className="text-xs text-zinc-200 leading-relaxed font-sans">
            {details.reason || `Account restriction enforced on ${BRAND.name}.`}
          </p>

          <div className="pt-2 border-t border-white/[0.06] space-y-1.5 text-[11px] text-zinc-400 font-sans">
            <div className="flex items-center justify-between">
              <span>Enforced on:</span>
              <span className="text-zinc-200 font-medium">{banDate}</span>
            </div>

            {!isPermanent && expiryDate && (
              <div className="flex items-center justify-between">
                <span>Expires on:</span>
                <span className="text-zinc-200 font-medium">{expiryDate}</span>
              </div>
            )}

            {!isPermanent && countdown && (
              <div className="flex items-center justify-between text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3" />
                  <span>Time remaining:</span>
                </span>
                <span className="font-mono font-medium">{countdown}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-[10px] text-zinc-500 font-mono">
              <span className="flex items-center gap-1">
                <Hash className="size-3" />
                <span>Reference ID:</span>
              </span>
              <span className="select-all text-zinc-400">{referenceId}</span>
            </div>
          </div>
        </div>

        {/* Pill Buttons (Section 10 & Rule 13) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 w-full sm:w-auto">
          <a
            href={details?.supportServerUrl || BRAND.supportInvite || 'https://discord.gg/connectingerlc'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs sm:text-sm hover:bg-zinc-200 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <span>Join the support server to appeal</span>
            <ExternalLink className="size-3.5 ml-2" />
          </a>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#18181b] text-zinc-300 border border-white/10 font-semibold text-xs sm:text-sm hover:bg-[#27272a] hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            <LogOut className="size-3.5 mr-2" />
            <span>Sign out</span>
          </button>
        </div>

        {/* Admin Portal & Emergency Self-Unban Override */}
        {isAdminUser && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center space-y-3 w-full font-sans animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold text-xs sm:text-sm">
              <Shield className="size-4" />
              <span>Staff / Administrator Account Detected</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed max-w-sm mx-auto">
              You are recognized as platform staff. You can instantly lift this suspension from your account or enter the admin portal.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
              <Button
                size="sm"
                disabled={unbanningSelf || selfUnbanSuccess}
                onClick={handleSelfUnban}
                className="w-full sm:w-auto h-8 px-4 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-zinc-950 font-bold"
              >
                {selfUnbanSuccess ? 'Account Unbanned! Redirecting...' : unbanningSelf ? 'Lifting Suspension...' : 'Unban & Unblacklist My Account'}
              </Button>
              <a
                href="/admin-portal"
                className="w-full sm:w-auto inline-flex items-center justify-center h-8 px-4 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white text-xs font-semibold transition-colors"
              >
                <span>Open Admin Portal</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BannedPage;
