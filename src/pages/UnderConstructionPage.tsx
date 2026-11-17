import { useState, useEffect } from 'react';
import { Hammer, ExternalLink } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export interface UnderConstructionPageProps {
  maintenance?: {
    active?: boolean;
    title?: string;
    message?: string;
    eta?: string | null;
  };
  embedded?: boolean;
}

export function UnderConstructionPage({ maintenance: initialMaint, embedded = false }: UnderConstructionPageProps = {}) {
  const [fetchedMaint, setFetchedMaint] = useState<UnderConstructionPageProps['maintenance']>(initialMaint);
  const maintenance = initialMaint || fetchedMaint;

  useEffect(() => {
    if (initialMaint) return;
    let active = true;
    fetch('/api/status/maintenance')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) {
          setFetchedMaint(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [initialMaint]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft());

  function calculateTimeLeft(): TimeLeft {
    const STORAGE_KEY = 'erlc_construction_target';
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    
    let target = 0;
    if (maintenance?.eta) {
      const etaTime = new Date(maintenance.eta).getTime();
      if (!isNaN(etaTime) && etaTime > Date.now()) {
        target = etaTime;
      }
    }

    if (!target) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          target = parseInt(stored, 10);
        }
      } catch {}
    }

    const now = Date.now();
    // If not set, invalid, or already expired in the past, initialize a fresh 1-day countdown
    if (!target || isNaN(target) || target <= now) {
      target = now + ONE_DAY_MS;
      try {
        localStorage.setItem(STORAGE_KEY, String(target));
      } catch {}
    }

    const difference = Math.max(0, target - now);

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / (1000 / 60)) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return {
      days,
      hours,
      minutes,
      seconds,
      totalMs: difference,
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [maintenance?.eta]);

  const formatNum = (num: number) => String(num).padStart(2, '0');

  const mainContent = (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-20 text-center max-w-2xl mx-auto w-full font-sans">
      {/* Minimal pill label */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18181B] border border-[#27272A] text-xs text-zinc-300 font-medium mb-6">
        <Hammer className="size-3.5 text-zinc-400" />
        <span>Scheduled Platform Deployment</span>
      </div>

      {/* Primary Headline */}
      <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight sm:leading-none">
        {maintenance?.title || "We're currently under construction."}
      </h1>

      {/* Subtitle */}
      <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-lg leading-relaxed">
        {maintenance?.message || "ConnectingERLC is undergoing infrastructure updates, OAuth integrations, and security hardening. Public access is temporarily paused until setup is complete."}
      </p>

      {/* Flush Countdown Timer: NO heavy embed / card boxes behind numbers */}
      <div className="mt-12 w-full max-w-lg">
        <div className="flex items-center justify-center gap-3 sm:gap-6">
          {/* Days */}
          <div className="flex flex-col items-center min-w-[56px] sm:min-w-[80px]">
            <span className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight tabular-nums">
              {formatNum(timeLeft.days)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-2">
              Days
            </span>
          </div>

          <span className="text-2xl sm:text-4xl text-zinc-600 font-light -translate-y-3">:</span>

          {/* Hours */}
          <div className="flex flex-col items-center min-w-[56px] sm:min-w-[80px]">
            <span className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight tabular-nums">
              {formatNum(timeLeft.hours)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-2">
              Hours
            </span>
          </div>

          <span className="text-2xl sm:text-4xl text-zinc-600 font-light -translate-y-3">:</span>

          {/* Minutes */}
          <div className="flex flex-col items-center min-w-[56px] sm:min-w-[80px]">
            <span className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight tabular-nums">
              {formatNum(timeLeft.minutes)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-2">
              Mins
            </span>
          </div>

          <span className="text-2xl sm:text-4xl text-zinc-600 font-light -translate-y-3">:</span>

          {/* Seconds */}
          <div className="flex flex-col items-center min-w-[56px] sm:min-w-[80px]">
            <span className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight tabular-nums">
              {formatNum(timeLeft.seconds)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-2">
              Secs
            </span>
          </div>
        </div>
      </div>

      {/* Action Button: Check System Status hidden, only clean Community Discord */}
      <div className="flex items-center justify-center mt-12">
        <a
          href="https://discord.gg/connectingerlc"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-white text-black font-semibold text-xs sm:text-sm hover:bg-zinc-200 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <span>Community Discord</span>
          <ExternalLink className="size-3.5 text-zinc-600" />
        </a>
      </div>
    </main>
  );

  if (embedded) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center text-white selection:bg-white/10 selection:text-white font-sans antialiased">
        {mainContent}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col justify-between selection:bg-white/10 selection:text-white font-sans antialiased relative">
      {/* Top Navigation Bar: CE Logo (larger) with single non-duplicate brand name */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size="lg" showText={true} />
        </div>
        {/* Right side empty: "Under Construction" badge removed per user request */}
        <div />
      </header>

      {mainContent}

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-3">
        <div>
          &copy; {new Date().getFullYear()} ConnectingERLC. All rights reserved.
        </div>
        <div className="flex items-center gap-4">
          <a href="/terms" className="hover:text-zinc-300 transition-colors">Terms</a>
          <a href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</a>
          <a href="/admin-portal" className="text-zinc-600 hover:text-zinc-400 text-[11px] transition-colors">Staff Portal</a>
        </div>
      </footer>
    </div>
  );
}

export default UnderConstructionPage;
