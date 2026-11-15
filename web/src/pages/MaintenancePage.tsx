import { useState, useEffect } from 'react';

export interface MaintenancePageProps {
  maintenance?: {
    active?: boolean;
    maintenance?: boolean;
    maintenance_on?: boolean;
    mode?: string;
    title?: string;
    message?: string;
    eta?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
  };
}

export function MaintenancePage({ maintenance: initialMaint }: MaintenancePageProps) {
  const [maint, setMaint] = useState<any>(() => {
    if (initialMaint && (initialMaint.active || initialMaint.maintenance || initialMaint.maintenance_on || initialMaint.mode === 'maintenance')) {
      return initialMaint;
    }
    return null;
  });

  useEffect(() => {
    let active = true;
    fetch('/api/status/maintenance')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        const isMaintenance = Boolean(
          data && (data.maintenance || data.maintenance_on || data.active || data.mode === 'maintenance')
        );

        if (!isMaintenance) {
          window.location.replace('/');
          return;
        }

        setMaint(data);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleCheckAgain = async () => {
    try {
      const res = await fetch('/api/status/maintenance');
      if (res.ok) {
        const data = await res.json();
        const isMaintenance = Boolean(
          data && (data.maintenance || data.maintenance_on || data.active || data.mode === 'maintenance')
        );
        if (!isMaintenance) {
          window.location.replace('/');
          return;
        }
        setMaint(data);
        return;
      }
    } catch {}
    window.location.reload();
  };

  const title = maint?.title || 'System Maintenance';
  const message =
    maint?.message ||
    'ConnectingERLC is currently undergoing scheduled upgrades to optimize platform performance. All services will resume shortly.';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-12 select-none font-sans">
      <div className="flex flex-col items-center text-center max-w-lg mx-auto animate-in fade-in-50 duration-300">
        {/* Massive 503 Headline */}
        <h1 className="text-8xl sm:text-9xl md:text-[140px] font-black tracking-tight text-white leading-none">
          503
        </h1>

        {/* Clean Subtitle & Description */}
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-6">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed max-w-md">
          {message}
        </p>

        {maint?.eta && (
          <div className="mt-4 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            Estimated completion: <span className="text-zinc-200 font-semibold">{maint.eta}</span>
          </div>
        )}

        {/* Pill Buttons: strictly Check again and System status. Never expose Admin Portal. */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <button
            onClick={handleCheckAgain}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs sm:text-sm hover:bg-zinc-200 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Check again
          </button>
          <a
            href="/status"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#18181b] text-white border border-zinc-800 font-semibold text-xs sm:text-sm hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer"
          >
            System status
          </a>
        </div>
      </div>
    </div>
  );
}

export default MaintenancePage;
