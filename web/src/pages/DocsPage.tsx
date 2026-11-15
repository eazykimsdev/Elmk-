import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  ArrowRight,
  Menu,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DOCS_SECTIONS,
  ALL_DOCS_PAGES,
  findDocPage,
  DocPage,
  DocBlock
} from '@/docs/docsData';
import { siteUrl } from '@/lib/siteUrl';

export function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const pageParam = searchParams.get('page') || 'introduction';

  const [activePageId, setActivePageId] = useState<string>(pageParam);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedPage, setCopiedPage] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(() => {
    try {
      return (localStorage.getItem(`docs_feedback_${activePageId}`) as any) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (pageParam && pageParam !== activePageId) {
      setActivePageId(pageParam);
    }
  }, [pageParam]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`docs_feedback_${activePageId}`);
      setFeedbackGiven(saved as any);
    } catch {}
  }, [activePageId]);

  const currentPage = useMemo(() => {
    return findDocPage(activePageId) || ALL_DOCS_PAGES[0];
  }, [activePageId]);

  const handleSelectPage = (id: string) => {
    setActivePageId(id);
    setSearchParams({ page: id });
    setMobileMenuOpen(false);
    setIsSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keyboard shortcut Ctrl+K / Cmd+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return ALL_DOCS_PAGES.filter(p => {
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.content.some(c => 'text' in c && c.text.toLowerCase().includes(q))
      );
    });
  }, [searchQuery]);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleCopyPageLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedPage(true);
    setTimeout(() => setCopiedPage(false), 2000);
  };

  const handleFeedback = (val: 'yes' | 'no') => {
    setFeedbackGiven(val);
    try {
      localStorage.setItem(`docs_feedback_${activePageId}`, val);
    } catch {}
  };

  // Find prev and next page
  const currentIndex = ALL_DOCS_PAGES.findIndex(p => p.id === currentPage.id);
  const prevPage = currentIndex > 0 ? ALL_DOCS_PAGES[currentIndex - 1] : null;
  const nextPage = currentIndex < ALL_DOCS_PAGES.length - 1 ? ALL_DOCS_PAGES[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-[#0E0E11] text-white flex flex-col font-sans selection:bg-[var(--accent)] selection:text-white">
      {/* ── TOP BAR (Mintlify style) ── */}
      <header className="h-16 border-b border-white/[0.08] bg-[#0E0E11]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04]"
          >
            <Menu className="size-5" />
          </button>

          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/brand/logo.png" alt="ConnectingERLC" className="size-7 object-contain rounded-md" />
            <span className="font-bold text-sm tracking-tight text-white group-hover:text-zinc-200 transition-colors">
              ConnectingERLC
            </span>
          </Link>

          <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />
          <span className="text-xs font-medium text-zinc-400 hidden sm:inline">Documentation</span>
        </div>

        {/* Center Search Field */}
        <div className="flex-1 max-w-md mx-4 hidden sm:block">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-white/[0.08] bg-[#141417] text-xs text-zinc-400 hover:border-white/[0.14] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Search className="size-3.5 text-zinc-500" />
              <span>Search docs...</span>
            </div>
            <kbd className="text-[10px] font-mono text-zinc-500 bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Action Links */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all font-medium"
          >
            Dashboard
          </Link>
          <a
            href="https://discord.gg/connectingerlc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all font-medium"
          >
            <span>Support</span>
            <ExternalLink className="size-3 text-zinc-500" />
          </a>
        </div>
      </header>

      {/* ── MAIN THREE-COLUMN LAYOUT ── */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto flex">
        {/* LEFT COLUMN: Navigation Sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/[0.06] p-4 space-y-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto scrollbar-none">
          {DOCS_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1.5">
              <div className="px-3 text-[12px] font-semibold text-zinc-500 tracking-wide">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = activePageId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectPage(item.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all text-left ${
                        isActive
                          ? 'border-l-2 border-[var(--accent)] text-white font-medium bg-white/[0.04] pl-2.5'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                      }`}
                    >
                      <span className="truncate">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* CENTER COLUMN: Document Content (max 720px) */}
        <main className="flex-1 min-w-0 py-8 px-4 sm:px-8 lg:px-12 flex justify-center">
          <div className="w-full max-w-[720px] space-y-8">
            {/* Breadcrumb & Copy Page Button */}
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <span>Docs</span>
                <span>/</span>
                <span>{currentPage.section}</span>
                <span>/</span>
                <span className="text-zinc-300 font-medium">{currentPage.title}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyPageLink}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-white/[0.04] transition-colors"
              >
                {copiedPage ? <Check className="size-3 text-[var(--accent)]" /> : <Copy className="size-3" />}
                <span>{copiedPage ? 'Copied' : 'Copy link'}</span>
              </button>
            </div>

            {/* Document Header */}
            <div className="space-y-2 border-b border-white/[0.06] pb-6">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-sans">
                {currentPage.title}
              </h1>
              <p className="text-base text-zinc-400 font-sans leading-relaxed">
                {currentPage.description}
              </p>
            </div>

            {/* Document Body Blocks */}
            <div className="space-y-6">
              {currentPage.content.map((block, bIdx) => {
                if (block.type === 'paragraph') {
                  return (
                    <p key={bIdx} className="text-[15px] text-zinc-300 leading-relaxed font-sans">
                      {block.text}
                    </p>
                  );
                }

                if (block.type === 'heading') {
                  return (
                    <div key={bIdx} id={block.id} className="pt-4 scroll-mt-24">
                      <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2 group">
                        <span>{block.text}</span>
                        <a href={`#${block.id}`} className="text-zinc-600 group-hover:text-zinc-400 text-sm">#</a>
                      </h2>
                    </div>
                  );
                }

                if (block.type === 'callout') {
                  const styles = {
                    note: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
                    tip: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-zinc-200',
                    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  };
                  return (
                    <div key={bIdx} className={`p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-3 ${styles[block.kind]}`}>
                      <AlertCircle className="size-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                      <div>{block.text}</div>
                    </div>
                  );
                }

                if (block.type === 'steps') {
                  return (
                    <div key={bIdx} className="space-y-4 pt-2">
                      {block.steps.map((st) => (
                        <div key={st.step} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="size-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold text-xs flex items-center justify-center shrink-0">
                              {st.step}
                            </div>
                            <div className="w-[1px] h-full bg-white/[0.08] my-1" />
                          </div>
                          <div className="pb-4 space-y-1">
                            <h3 className="text-sm font-semibold text-white">{st.title}</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">{st.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                if (block.type === 'cards') {
                  return (
                    <div key={bIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {block.cards.map((c, cIdx) => (
                        <div
                          key={cIdx}
                          onClick={() => c.linkId && handleSelectPage(c.linkId)}
                          className={`p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-1.5 transition-colors ${
                            c.linkId ? 'cursor-pointer hover:border-white/[0.12]' : ''
                          }`}
                        >
                          <div className="text-sm font-semibold text-white flex items-center justify-between">
                            <span>{c.title}</span>
                            {c.linkId && <ChevronRight className="size-3.5 text-zinc-500" />}
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  );
                }

                if (block.type === 'table') {
                  return (
                    <div key={bIdx} className="rounded-xl border border-white/[0.06] overflow-x-auto bg-[#141417]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-white/[0.02] border-b border-white/[0.06] text-zinc-400 uppercase tracking-wider font-semibold">
                          <tr>
                            {block.headers.map((h, hIdx) => (
                              <th key={hIdx} className="px-4 py-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {block.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-white/[0.01]">
                              {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="px-4 py-3 text-zinc-300 font-sans">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                if (block.type === 'code') {
                  const codeId = `code_${bIdx}`;
                  const isCopied = copiedCodeId === codeId;
                  return (
                    <div key={bIdx} className="rounded-xl border border-white/[0.08] bg-[#0E0E11] overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
                        <span className="text-[11px] font-mono text-zinc-500 uppercase">{block.language}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(block.code, codeId)}
                          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                        >
                          {isCopied ? <Check className="size-3 text-[var(--accent)]" /> : <Copy className="size-3" />}
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto">
                        <code>{block.code}</code>
                      </pre>
                    </div>
                  );
                }

                if (block.type === 'accordion') {
                  return (
                    <div key={bIdx} className="space-y-2 pt-2">
                      {block.items.map((acc, aIdx) => (
                        <details key={aIdx} className="group rounded-xl border border-white/[0.06] bg-[#141417] p-4 text-xs">
                          <summary className="font-semibold text-white cursor-pointer list-none flex items-center justify-between">
                            <span>{acc.trigger}</span>
                            <ChevronRight className="size-3.5 text-zinc-500 transition-transform group-open:rotate-90" />
                          </summary>
                          <p className="mt-2 text-zinc-400 leading-relaxed">{acc.content}</p>
                        </details>
                      ))}
                    </div>
                  );
                }

                return null;
              })}
            </div>

            {/* Document Footer: "Was this helpful" & Last Modified */}
            <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">Was this page helpful?</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleFeedback('yes')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      feedbackGiven === 'yes'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]'
                        : 'border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <ThumbsUp className="size-3" />
                    <span>Yes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback('no')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      feedbackGiven === 'no'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <ThumbsDown className="size-3" />
                    <span>No</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-zinc-500">
                Last modified on {currentPage.lastModified}
              </div>
            </div>

            {/* Previous and Next Navigation Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              {prevPage ? (
                <button
                  type="button"
                  onClick={() => handleSelectPage(prevPage.id)}
                  className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] text-left hover:border-white/[0.12] transition-colors space-y-1"
                >
                  <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                    <ArrowLeft className="size-3" />
                    <span>Previous</span>
                  </div>
                  <div className="text-sm font-semibold text-white">{prevPage.title}</div>
                </button>
              ) : <div />}

              {nextPage ? (
                <button
                  type="button"
                  onClick={() => handleSelectPage(nextPage.id)}
                  className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] text-right hover:border-white/[0.12] transition-colors space-y-1 ml-auto w-full sm:w-auto"
                >
                  <div className="text-[11px] text-zinc-500 flex items-center justify-end gap-1">
                    <span>Next</span>
                    <ArrowRight className="size-3" />
                  </div>
                  <div className="text-sm font-semibold text-white">{nextPage.title}</div>
                </button>
              ) : <div />}
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: "On this page" TOC (desktop only) */}
        <aside className="hidden lg:flex w-56 shrink-0 flex-col p-6 space-y-3 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto scrollbar-none">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
            On this page
          </div>
          {currentPage.headings.length === 0 ? (
            <span className="text-xs text-zinc-600">Overview</span>
          ) : (
            <div className="space-y-1.5 border-l border-white/[0.06] pl-3">
              {currentPage.headings.map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className="text-xs text-zinc-400 hover:text-white block transition-colors leading-relaxed"
                >
                  {h.title}
                </a>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ── SEARCH MODAL (Ctrl+K) ── */}
      {isSearchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-sm animate-in fade-in-50"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-[#141417] border border-white/10 shadow-2xl overflow-hidden space-y-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 border-b border-white/[0.08] flex items-center gap-2">
              <Search className="size-4 text-zinc-500 shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search documentation..."
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-hidden"
              />
              <button onClick={() => setIsSearchOpen(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-white/[0.04]">
              {searchResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  {searchQuery ? 'No documentation found matching your search.' : 'Type to search all pages...'}
                </div>
              ) : (
                searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPage(p.id)}
                    className="w-full p-2.5 rounded-lg text-left hover:bg-white/[0.04] transition-colors block space-y-0.5"
                  >
                    <div className="text-xs font-semibold text-white flex items-center justify-between">
                      <span>{p.title}</span>
                      <span className="text-[10px] text-zinc-500">{p.section}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-1">{p.description}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE DRAWER ── */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 bg-[#0E0E11] border-r border-white/10 h-full p-4 overflow-y-auto space-y-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <span className="text-sm font-bold text-white">Documentation</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-zinc-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            {DOCS_SECTIONS.map((section, sIdx) => (
              <div key={sIdx} className="space-y-1">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase px-2">{section.title}</div>
                {section.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectPage(item.id)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg ${
                      activePageId === item.id ? 'bg-[var(--accent-soft)] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
