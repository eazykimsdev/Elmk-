import { useState, useEffect } from 'react';
import { Hammer, ShieldCheck, Database, RefreshCw, ExternalLink } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function UnderConstructionPage() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft());

  function calculateTimeLeft(): TimeLeft {
    const STORAGE_KEY = 'erlc_construction_target';
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    
    let target = 0;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        target = parseInt(stored, 10);
      }
    } catch {}

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
    const minutes = Math.floor((difference / 1000 / 60) % 60);
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
  }, []);

  const formatNum = (num: number) => String(num).padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col justify-between selection:bg-white/10 selection:text-white font-sans antialiased relative overflow-hidden">
      {/* Background subtle radial lighting */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-zinc-800/20 rounded-full blur-[120px] -translate-y-12" />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-7 w-auto" />
          <span className="font-bold text-sm tracking-tight text-white">ConnectingERLC</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            Under Construction
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-16 text-center max-w-2xl mx-auto w-full">
        {/* Minimal pill label */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#18181B] border border-[#27272A] text-xs text-zinc-300 font-medium mb-6">
          <Hammer className="size-3.5 text-zinc-400" />
          <span>Scheduled Platform Deployment</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight sm:leading-none">
          We&apos;re currently under construction.
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-lg leading-relaxed">
          ConnectingERLC is undergoing infrastructure updates, OAuth integrations, and security hardening. Public access is temporarily paused until setup is complete.
        </p>

        {/* 1-Day Countdown Timer */}
        <div className="mt-10 w-full max-w-md">
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {/* Days */}
            <div className="flex flex-col items-center justify-center py-4 sm:py-5 px-2 bg-[#121216] border border-[#27272A] rounded-2xl shadow-sm">
              <span className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {formatNum(timeLeft.days)}
              </span>
              <span className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-widest font-semibold mt-1">
                Days
              </span>
            </div>

            {/* Hours */}
            <div className="flex flex-col items-center justify-center py-4 sm:py-5 px-2 bg-[#121216] border border-[#27272A] rounded-2xl shadow-sm">
              <span className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {formatNum(timeLeft.hours)}
              </span>
              <span className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-widest font-semibold mt-1">
                Hours
              </span>
            </div>

            {/* Minutes */}
            <div className="flex flex-col items-center justify-center py-4 sm:py-5 px-2 bg-[#121216] border border-[#27272A] rounded-2xl shadow-sm">
              <span className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {formatNum(timeLeft.minutes)}
              </span>
              <span className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-widest font-semibold mt-1">
                Mins
              </span>
            </div>

            {/* Seconds */}
            <div className="flex flex-col items-center justify-center py-4 sm:py-5 px-2 bg-[#121216] border border-[#27272A] rounded-2xl shadow-sm">
              <span className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {formatNum(timeLeft.seconds)}
              </span>
              <span className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-widest font-semibold mt-1">
                Secs
              </span>
            </div>
          </div>
        </div>

        {/* Deployment Status List */}
        <div className="mt-8 w-full max-w-md bg-[#121216]/60 border border-[#27272A]/80 rounded-2xl p-4 text-left">
          <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
            Deployment Checklist
          </div>
          <div className="space-y-2 text-xs text-zinc-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="size-3.5 text-emerald-400" />
                <span className="text-zinc-300">Database & Network Migration</span>
              </div>
              <span className="text-emerald-400 font-medium">Ready</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-3.5 text-amber-400 animate-spin" />
                <span className="text-zinc-300">Discord OAuth Handshake</span>
              </div>
              <span className="text-amber-400 font-medium">Pending Release</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                <span className="text-zinc-300">Anti-Raid Security Gateways</span>
              </div>
              <span className="text-emerald-400 font-medium">Ready</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <a
            href="/status"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs sm:text-sm hover:bg-zinc-200 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Check System Status
          </a>
          <a
            href="https://discord.gg/connectingerlc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-full bg-[#18181B] text-white border border-[#27272A] font-semibold text-xs sm:text-sm hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer"
          >
            <span>Community Discord</span>
            <ExternalLink className="size-3.5 text-zinc-400" />
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-3">
        <div>
          &copy; {new Date().getFullYear()} ConnectingERLC. All rights reserved.
        </div>
        <div className="flex items-center gap-4">
          <a href="/terms" className="hover:text-zinc-200 transition-colors">Terms</a>
          <a href="/privacy" className="hover:text-zinc-200 transition-colors">Privacy</a>
          <a href="/admin-portal" className="text-zinc-400 hover:text-zinc-400 text-[11px] transition-colors">Staff Portal</a>
        </div>
      </footer>
    </div>
  );
}

export default UnderConstructionPage;
