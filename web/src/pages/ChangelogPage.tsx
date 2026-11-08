import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, Tag } from 'lucide-react';
import { PublicIconRail } from '@/components/ui/PublicIconRail';
import { Changelog, type ChangelogEntry } from '@/components/ui/changelog';

export function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Changelog — ConnectingERLC';
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/changelog')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        const list = Array.isArray(data.entries) ? data.entries : (Array.isArray(data) ? data : []);
        setEntries(list);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] font-sans selection:bg-[var(--accent)]/20 selection:text-[var(--accent)]">
      <PublicIconRail />

      <main className="md:pl-16 pb-16 md:pb-0 flex flex-col">
        <section className="border-b border-white/[0.06] bg-[#0A0A0C] py-12 px-6 sm:px-10 lg:px-16 text-left">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              <FileText className="size-4" />
              <span>Product Updates</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight font-sans">
              ConnectingERLC Changelog
            </h1>
            <p className="text-sm text-zinc-400 font-sans max-w-xl leading-relaxed">
              New features, bug repairs, performance improvements, and protocol updates.
            </p>
          </div>
        </section>

        <section className="py-12 px-6 sm:px-10 lg:px-16 max-w-4xl mx-auto w-full text-left">
          {loading ? (
            <div className="space-y-8 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                  <div className="h-6 w-32 bg-white/10 rounded-md" />
                  <div className="h-4 w-64 bg-white/5 rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <Changelog entries={entries} />
          )}
        </section>
      </main>
    </div>
  );
}

export default ChangelogPage;
