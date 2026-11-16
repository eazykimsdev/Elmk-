import { useState } from 'react';
import { Sparkles, MessageSquare, Send, CheckCircle2, Crown, Layers, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const CATEGORIES = [
  'Directory Visibility',
  'Advertising & Broadcasts',
  'Staff & Moderation Tools',
  'Analytics & Growth Insights',
  'Custom Bot Branding',
  'Other Ideas',
];

export function PremiumTab({ guild, onNavigateTab, addToast }: PremiumTabProps) {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [suggestionText, setSuggestionText] = useState('');
  const [contactOk, setContactOk] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
          category: selectedCategory,
          contactOk,
          guildId: guild?.id,
          guildName: guild?.name,
        }),
      });
      setSubmitted(true);
      setSuggestionText('');
      addToast('success', 'Suggestion Delivered', 'Your idea has been sent directly to the founder. Thank you!');
    } catch (err: any) {
      addToast('error', 'Submission Failed', err.message || 'Could not send suggestion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Premium</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider font-sans">
              <Sparkles className="size-3" />
              Early Access
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1 font-sans">
            Priority directory placement, elevated advertising channels, and creator perks.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigateTab('promote')}
          className="h-8 text-xs font-sans border-white/[0.08] hover:bg-white/[0.04] text-zinc-300 self-start sm:self-auto cursor-pointer"
        >
          View Promote Server &rarr;
        </Button>
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
                Your feedback has been logged and sent to the platform leadership team. We review every community proposal.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSubmitted(false)}
              className="text-xs border-white/[0.08] text-zinc-300 hover:text-white"
            >
              Send another suggestion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300 font-sans block">
                Suggestion Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium'
                          : 'bg-white/[0.03] text-zinc-400 border border-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

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
