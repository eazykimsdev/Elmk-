import React, { useEffect, useState } from 'react';
import { applyTheme, currentTheme, type ThemeName } from '@/lib/theme';
import { Sparkles, Check, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeSetting({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeName>(() => currentTheme());
  const [snowEnabled, setSnowEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('erlc_snow') !== 'off';
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const onTheme = () => setTheme(currentTheme());
    window.addEventListener('erlc-theme-change', onTheme);
    fetch('/api/theme')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.theme === 'christmas' || d?.theme === 'default') {
          setTheme(d.theme);
        }
      })
      .catch(() => {});
    return () => window.removeEventListener('erlc-theme-change', onTheme);
  }, []);

  const selectTheme = async (next: ThemeName) => {
    setBusy(true);
    setMsg('');
    setTheme(next);
    applyTheme(next);
    try {
      const res = await fetch('/api/admin/theme', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      });
      if (res.ok) {
        setMsg('Saved globally');
      } else {
        setMsg('Theme applied');
      }
    } catch {
      setMsg('Theme applied');
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const toggleSnow = () => {
    const next = !snowEnabled;
    setSnowEnabled(next);
    try {
      localStorage.setItem('erlc_snow', next ? 'on' : 'off');
    } catch {}
    window.dispatchEvent(new Event('erlc-snow-change'));
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 py-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-white">Platform theme</span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Switch between Classic Orange and festive Christmas styles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => selectTheme('default')}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5',
              theme === 'default'
                ? 'bg-[#F97316]/10 border-[#F97316]/40 text-[#F97316]'
                : 'bg-[#141416] border-white/10 text-zinc-400 hover:text-white'
            )}
          >
            <span className="size-2 rounded-full bg-[#F97316]" />
            <span>Classic</span>
            {theme === 'default' && <Check className="size-3" />}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => selectTheme('christmas')}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5',
              theme === 'christmas'
                ? 'bg-[#C42B35]/20 border-[#C42B35]/60 text-white shadow-sm shadow-[#C42B35]/20'
                : 'bg-[#141416] border-white/10 text-zinc-400 hover:text-white'
            )}
          >
            <span className="size-2 rounded-full bg-gradient-to-r from-[#C42B35] to-[#164E35] border border-white/20" />
            <span>Christmas ❄</span>
            {theme === 'christmas' && <Check className="size-3 text-[#C42B35]" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-white">Platform theme & seasonal style</h3>
          </div>
          <p className="text-zinc-400 text-xs mt-1">
            Choose your active appearance. Seasonal themes include custom accents and subtle snowfall.
          </p>
        </div>

        {msg && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 animate-in fade-in">
            {msg}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Default Theme Card */}
        <button
          type="button"
          disabled={busy}
          onClick={() => selectTheme('default')}
          className={cn(
            'group relative flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer',
            theme === 'default'
              ? 'bg-[#141416] border-[#F97316] ring-1 ring-[#F97316]/50 shadow-md shadow-[#F97316]/5'
              : 'bg-[#121214] border-white/[0.08] hover:border-white/20 hover:bg-[#161619]'
          )}
        >
          <div className="size-8 rounded-lg bg-[#F97316]/15 border border-[#F97316]/40 flex items-center justify-center shrink-0 mt-0.5">
            <span className="size-3.5 rounded-full bg-[#F97316]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-white">ConnectingERLC Classic</span>
              {theme === 'default' && (
                <span className="size-4 rounded-full bg-[#F97316] text-black flex items-center justify-center">
                  <Check className="size-2.5 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Original high-contrast orange accent and dark neutral palette.
            </p>
          </div>
        </button>

        {/* Christmas Theme Card */}
        <button
          type="button"
          disabled={busy}
          onClick={() => selectTheme('christmas')}
          className={cn(
            'group relative flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer overflow-hidden',
            theme === 'christmas'
              ? 'bg-gradient-to-br from-[#1C1012] via-[#121714] to-[#121214] border-[#C42B35] ring-1 ring-[#C42B35]/50 shadow-md shadow-[#C42B35]/20'
              : 'bg-[#121214] border-white/[0.08] hover:border-[#C42B35]/30 hover:bg-[#161619]'
          )}
        >
          <div className="size-8 rounded-lg bg-gradient-to-br from-[#C42B35] to-[#164E35] border border-white/20 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <span className="text-white text-xs select-none">❄</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span>Merry Christmas</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#C42B35]/20 text-[#EF4444] border border-[#C42B35]/40 font-mono">
                  Seasonal
                </span>
              </span>
              {theme === 'christmas' && (
                <span className="size-4 rounded-full bg-[#C42B35] text-white flex items-center justify-center">
                  <Check className="size-2.5 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Rich holiday crimson, evergreen pine and warm champagne gold with light winter snow.
            </p>
          </div>
        </button>
      </div>

      {/* Snowfall Toggle when Christmas Theme is Active */}
      {theme === 'christmas' && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2.5">
            <Snowflake className="size-4 text-[#C42B35] shrink-0" />
            <div>
              <span className="text-white font-medium">Winter snowfall animation</span>
              <p className="text-zinc-500 text-[11px]">Subtle drift on home, dashboard and directory pages</p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSnow}
            className={cn(
              'h-7 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5',
              snowEnabled
                ? 'bg-[#C42B35]/20 border-[#C42B35]/40 text-white'
                : 'bg-[#18181B] border-white/10 text-zinc-400 hover:text-white'
            )}
          >
            <span>{snowEnabled ? '❄ Snow on' : 'Snow off'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ThemeSetting;
