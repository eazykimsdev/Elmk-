import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, CheckCircle2, Crown, ChevronUp, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

interface PremiumTabProps {
  guild: DiscordGuild | null;
  workspace: WorkspaceBot | null;
  config: WorkspaceCustomizations;
  onNavigateTab: (tab: string) => void;
  addToast: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

interface CommunityIdea {
  id: string;
  suggestion: string;
  status: 'accepted' | 'shipped';
  upvotes: number;
  hasUpvoted: boolean;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export function PremiumTab({ guild, onNavigateTab, addToast }: PremiumTabProps) {
  const [suggestionText, setSuggestionText] = useState('');
  const [contactOk, setContactOk] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Accepted community feature suggestions for the upvote board
  const [communityIdeas, setCommunityIdeas] = useState<CommunityIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [upvotingIds, setUpvotingIds] = useState<Record<string, boolean>>({});

  const loadCommunityIdeas = useCallback(async () => {
    setLoadingIdeas(true);
    try {
      const data = await api<{ ok: boolean; suggestions: CommunityIdea[] }>('/suggestions/premium');
      if (Array.isArray(data?.suggestions)) {
        setCommunityIdeas(data.suggestions);
      }
    } catch {
      // Clean fallback
    } finally {
      setLoadingIdeas(false);
    }
  }, []);

  useEffect(() => {
    loadCommunityIdeas();
  }, [loadCommunityIdeas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) {
      addToast('warning', 'Missing Details', 'Please share a few details about your suggestion.');
      return;
    }

    setSubmitting(true);
    try {
      await api<any>('/suggestions/premium', {
        method: 'POST',
        body: JSON.stringify({
          suggestion: suggestionText.trim(),
          contactOk,
          guildId: guild?.id,
          guildName: guild?.name,
        }),
      });
      setSubmitted(true);
      setSuggestionText('');
      addToast('success', 'Suggestion Delivered', 'Your idea has been sent directly to the founder. Thank you!');
      loadCommunityIdeas();
    } catch (err: any) {
      addToast('error', 'Submission Failed', err.message || 'Could not send suggestion.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleUpvote = async (ideaId: string) => {
    if (upvotingIds[ideaId]) return;
    setUpvotingIds((prev) => ({ ...prev, [ideaId]: true }));

    // Optimistic state update
    setCommunityIdeas((prev) =>
      prev.map((item) => {
        if (item.id === ideaId) {
          const nextHasUpvoted = !item.hasUpvoted;
          const nextCount = nextHasUpvoted ? item.upvotes + 1 : Math.max(0, item.upvotes - 1);
          return { ...item, hasUpvoted: nextHasUpvoted, upvotes: nextCount };
        }
        return item;
      })
    );

    try {
      const res = await api<{ ok: boolean; upvotes: number; hasUpvoted: boolean }>(
        `/suggestions/premium/${ideaId}/upvote`,
        { method: 'POST' }
      );
      if (res?.ok) {
        setCommunityIdeas((prev) =>
          prev.map((item) => {
            if (item.id === ideaId) {
              return { ...item, hasUpvoted: res.hasUpvoted, upvotes: res.upvotes };
            }
            return item;
          })
        );
      }
    } catch (err: any) {
      // Revert optimistic update
      loadCommunityIdeas();
      addToast('error', 'Upvote Failed', err.message || 'Please log in to upvote.');
    } finally {
      setUpvotingIds((prev) => ({ ...prev, [ideaId]: false }));
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* ── HEADER (Centered) ── */}
      <div className="text-center space-y-2 border-b border-white/[0.06] pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
          Premium
        </h1>
        <p className="text-sm text-zinc-400 font-sans max-w-lg mx-auto">
          Priority directory placement, elevated advertising channels, and creator perks.
        </p>
      </div>

      {/* ── ACTIVE PREMIUM COMMUNITIES (Clean Empty State) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white font-sans uppercase tracking-wider">
            Premium Communities
          </h2>
          <span className="text-xs text-zinc-500 font-sans">0 active</span>
        </div>

        <Card className="bg-[#121215] border-white/[0.08] p-10 text-center flex flex-col items-center justify-center space-y-3">
          <div className="size-12 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-zinc-400">
            <Crown className="size-5 text-zinc-500" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white font-sans">
              No active premium communities yet
            </p>
            <p className="text-xs text-zinc-400 font-sans max-w-md">
              Featured communities and verified partners with active Premium tiers will be showcased here. Tell us below what perks you want to see!
            </p>
          </div>
        </Card>
      </div>

      {/* ── ACCEPTED COMMUNITY FEATURE REQUESTS (UPVOTE BOARD) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white font-sans uppercase tracking-wider">
              Community Ideas & Roadmap
            </h2>
          </div>
          <span className="text-xs text-zinc-400 font-sans">
            {communityIdeas.length} accepted {communityIdeas.length === 1 ? 'idea' : 'ideas'}
          </span>
        </div>

        {communityIdeas.length === 0 ? (
          <Card className="bg-[#121215] border-white/[0.08] p-8 text-center space-y-2">
            <p className="text-xs text-zinc-400 font-sans">
              No accepted community ideas yet. Submit a suggestion below — once accepted, it appears here for community upvoting!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {communityIdeas.map((idea) => {
              const userInitial = (idea.user?.displayName || idea.user?.username || 'U')[0].toUpperCase();
              const isShipped = idea.status === 'shipped';

              return (
                <div
                  key={idea.id}
                  className="rounded-xl border border-white/[0.08] bg-[#121215] p-4 flex items-start justify-between gap-4 transition-colors hover:border-white/[0.14]"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {idea.user?.avatarUrl ? (
                      <img
                        src={idea.user.avatarUrl}
                        alt=""
                        className="size-9 rounded-full object-cover shrink-0 border border-white/10"
                      />
                    ) : (
                      <div className="size-9 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-xs flex items-center justify-center shrink-0 border border-white/10">
                        {userInitial}
                      </div>
                    )}

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white font-sans">
                          {idea.user?.displayName || idea.user?.username || 'Community Member'}
                        </span>
                        {idea.user?.username && (
                          <span className="text-[11px] text-zinc-500 font-sans">
                            @{idea.user.username}
                          </span>
                        )}
                        {isShipped ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Check className="size-3" />
                            Shipped
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
                            Planned
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-300 font-sans leading-relaxed break-words">
                        {idea.suggestion}
                      </p>
                    </div>
                  </div>

                  {/* Upvote Button Pill */}
                  <button
                    type="button"
                    onClick={() => handleToggleUpvote(idea.id)}
                    disabled={upvotingIds[idea.id]}
                    className={`flex flex-col items-center justify-center min-w-[52px] h-14 rounded-lg border transition-all cursor-pointer px-2 shrink-0 ${
                      idea.hasUpvoted
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm'
                        : 'bg-[#18181C] text-zinc-400 border-white/[0.08] hover:text-white hover:bg-white/[0.06]'
                    }`}
                    title={idea.hasUpvoted ? 'Remove upvote' : 'Upvote this idea'}
                  >
                    <ChevronUp className={`size-4 ${idea.hasUpvoted ? 'text-emerald-400' : 'text-zinc-400'}`} />
                    <span className="text-xs font-bold font-mono">
                      {idea.upvotes}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SHAPE THE FUTURE OF PREMIUM: SUGGESTION BOX ── */}
      <Card className="bg-[#121215] border-white/[0.08] p-6 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white font-sans">
              What would you like to see in Premium?
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-sans">
            We are building the next generation of server growth tools. Share what features, perks, or tools would make Premium most valuable to your community. Your suggestions go straight to the founder.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center space-y-3">
            <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white font-sans">Thank you for your suggestion!</h3>
              <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto">
                Your feedback has been logged and sent to the platform leadership team. Once accepted, it will appear in the Community Ideas upvote board above.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSubmitted(false)}
              className="text-xs border-white/[0.08] text-zinc-300 hover:text-white cursor-pointer"
            >
              Send another suggestion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Suggestion Textarea */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300 font-sans block">
                Your Suggestion
              </label>
              <Textarea
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                placeholder="Example: I would love an automated bump scheduler every 2 hours, or custom embed colors for our advertising broadcasts..."
                rows={4}
                className="bg-[#0E0E11] border-white/[0.08] text-xs font-sans placeholder:text-zinc-600 focus-visible:ring-emerald-500/20"
              />
              <span className="text-[11px] text-zinc-500 font-sans block text-right">
                {suggestionText.length} / 2000
              </span>
            </div>

            {/* Checkbox for contact permission */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="contactOk"
                checked={contactOk}
                onChange={(e) => setContactOk(e.target.checked)}
                className="rounded border-white/20 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/30 size-4 cursor-pointer"
              />
              <label htmlFor="contactOk" className="text-xs text-zinc-400 font-sans cursor-pointer select-none">
                Notify me on Discord when this feature or update is shipped
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={submitting || !suggestionText.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs h-9 px-4 font-sans flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Send className="size-3.5" />
                {submitting ? 'Sending idea...' : 'Submit Suggestion'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
export default PremiumTab;
