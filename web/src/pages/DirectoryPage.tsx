import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Compass, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { PublicIconRail } from '@/components/ui/PublicIconRail';
import { DirectoryCard, type DirectoryServerData } from '@/components/ui/directory-card';
import { ServerProfileModal } from '@/components/ServerProfileModal';
import { Button } from '@/components/ui/button';
import { cleanSqlReplace } from '@/components/ui/markdown-renderer';

const CATEGORIES = [
  'All',
  'Design Server',
  'Roleplay Server',
  'Misc',
  'COTS',
  'Departments',
  'Events'
];

export function DirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [servers, setServers] = useState<DirectoryServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServerSlug, setSelectedServerSlug] = useState<string | null>(searchParams.get('server') || null);
  const [selectedServerData, setSelectedServerData] = useState<DirectoryServerData | null>(null);

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('cat') || 'All');
  const [sort, setSort] = useState<'members_desc' | 'members_asc'>('members_desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    document.title = 'Community Directory — ConnectingERLC';
  }, []);

  // Sync ?server= query param
  useEffect(() => {
    const slug = searchParams.get('server');
    if (slug) {
      setSelectedServerSlug(slug);
    }
  }, [searchParams]);

  // Fetch servers from /api/directory
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetch('/api/directory?pageSize=100&sort=members_desc')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        const list = Array.isArray(data.servers) ? data.servers : [];
        const sanitized = list.map((s: any) => ({
          ...s,
          name: cleanSqlReplace(s.name || ''),
          summary: cleanSqlReplace(s.summary || s.description || ''),
          description: cleanSqlReplace(s.description || '')
        }));
        setServers(sanitized);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Filter & sort
  const filtered = useMemo(() => {
    let res = [...servers];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      res = res.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.summary?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          (Array.isArray(s.tags) && s.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (selectedCategory !== 'All') {
      res = res.filter(
        (s) =>
          s.category?.toLowerCase() === selectedCategory.toLowerCase() ||
          (Array.isArray((s as any).categories) && (s as any).categories.includes(selectedCategory))
      );
    }

    if (sort === 'members_asc') {
      res.sort((a, b) => Number(a.memberCount || 0) - Number(b.memberCount || 0));
    } else {
      res.sort((a, b) => Number(b.memberCount || 0) - Number(a.memberCount || 0));
    }

    return res;
  }, [servers, search, selectedCategory, sort]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleOpenServer = (server: DirectoryServerData) => {
    setSelectedServerSlug(server.id);
    setSelectedServerData(server);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('server', server.id);
      return p;
    });
  };

  const handleCloseModal = () => {
    setSelectedServerSlug(null);
    setSelectedServerData(null);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('server');
      return p;
    });
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] font-sans selection:bg-[var(--accent)]/20 selection:text-[var(--accent)]">
      <PublicIconRail />

      <main className="md:pl-16 pb-16 md:pb-0 flex flex-col">
        {/* Header section */}
        <section className="border-b border-white/[0.06] bg-[#0A0A0C] py-12 px-6 sm:px-10 lg:px-16 text-left">
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              <Compass className="size-4" />
              <span>Public Directory</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight font-sans">
              Discover ER:LC Communities
            </h1>
            <p className="text-sm text-zinc-400 font-sans max-w-2xl leading-relaxed">
              Explore active Emergency Response: Liberty County roleplay servers, custom design communities, and official departments.
            </p>

            {/* Search & Sort Controls */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search servers by name or tag…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#141417] border border-white/[0.08] focus:border-[var(--accent)] focus:outline-hidden text-sm text-white placeholder-zinc-500 font-sans transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as any)}
                    className="h-10 pl-3 pr-8 rounded-xl bg-[#141417] border border-white/[0.08] text-xs font-medium text-zinc-300 focus:border-[var(--accent)] focus:outline-hidden appearance-none cursor-pointer font-sans"
                  >
                    <option value="members_desc">Most members</option>
                    <option value="members_asc">Fewest members</option>
                  </select>
                  <ArrowUpDown className="size-3 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans ${
                    selectedCategory === cat
                      ? 'bg-[var(--accent)] text-[#1C0A00] shadow-xs'
                      : 'bg-[#141417] text-zinc-400 hover:text-white border border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Directory Grid */}
        <section className="py-10 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full space-y-8 flex-1">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 rounded-2xl border border-white/[0.06] bg-[#0E0E11] text-center space-y-3">
              <p className="text-base font-semibold text-white font-sans">No communities found</p>
              <p className="text-xs text-zinc-400 font-sans">
                Try adjusting your search query or selecting a different category filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('All');
                  setPage(1);
                }}
                className="text-xs border-white/10"
              >
                Reset filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginated.map((server) => (
                  <DirectoryCard
                    key={server.id}
                    server={server}
                    onClick={() => handleOpenServer(server)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 border-t border-white/[0.06] text-xs text-zinc-400 font-sans">
                  <span>
                    Showing {Math.min((page - 1) * pageSize + 1, filtered.length)}–
                    {Math.min(page * pageSize, filtered.length)} of {filtered.length} communities
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="text-xs border-white/10 h-8"
                    >
                      Previous
                    </Button>
                    <span className="px-2 text-zinc-300 font-mono">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="text-xs border-white/10 h-8"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Modal */}
      {selectedServerSlug && (
        <ServerProfileModal
          serverSlug={selectedServerSlug}
          initialServer={selectedServerData as any}
          isOpen={Boolean(selectedServerSlug)}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

export default DirectoryPage;
