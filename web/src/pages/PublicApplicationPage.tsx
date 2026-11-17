import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Flag,
  Trash2,
  ArrowLeft,
  Send,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TopBanner } from '@/components/TopBanner';

export function PublicApplicationPage() {
  const { serverSlug, formSlug, customSlug } = useParams<{
    serverSlug?: string;
    formSlug?: string;
    customSlug?: string;
  }>();

  // If matched via /:serverSlug/:formSlug or /apply/:serverSlug/:formSlug
  const resolvedServerId = serverSlug || '';
  const resolvedFormSlug = formSlug || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any | null>(null);
  const [serverData, setServerData] = useState<any | null>(null);
  const [userApp, setUserApp] = useState<any | null>(null);

  // Form filling state
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Safety report modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Phishing / Credential harvesting');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    if (!resolvedServerId || !resolvedFormSlug) return;

    setLoading(true);
    setError(null);
    fetch(`/api/public/forms/${resolvedServerId}/${resolvedFormSlug}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Form not found');
        setFormData(data.form);
        setServerData(data.server);
        setUserApp(data.userApplication || null);
      })
      .catch((err) => {
        setError(err.message || 'Could not load application form.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [resolvedServerId, resolvedFormSlug]);

  const handleInputChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleCheckboxToggle = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const currentList: string[] = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      if (currentList.includes(option)) {
        return { ...prev, [questionId]: currentList.filter((item) => item !== option) };
      } else {
        return { ...prev, [questionId]: [...currentList, option] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData?.id) return;

    // Validate required questions
    for (const q of formData.questions || []) {
      const ans = answers[q.id];
      if (q.required) {
        if (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
          setValidationError(`Please answer the required question: "${q.label}"`);
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/public/forms/${formData.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      setSubmittedApp(data.submission);
      setUserApp(data.submission);
    } catch (err: any) {
      setValidationError(err.message || 'Could not submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteApplication = async (submissionId: string) => {
    if (!window.confirm('Are you sure you want to withdraw and delete your application?')) return;
    try {
      const res = await fetch(`/api/applications/${submissionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setUserApp(null);
        setSubmittedApp(null);
      }
    } catch {}
  };

  const handleSubmitReport = async () => {
    if (!formData?.id) return;
    try {
      setSubmittingReport(true);
      const res = await fetch(`/api/public/forms/${formData.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reportReason, details: reportDetails })
      });
      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setShowReportModal(false);
          setReportSuccess(false);
        }, 1500);
      }
    } catch {} finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col font-sans">
        <TopBanner />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-xs text-zinc-500 animate-pulse">Loading application form...</div>
        </div>
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col font-sans">
        <TopBanner />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="size-12 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center mb-4">
            <FileText className="size-6 text-zinc-600" />
          </div>
          <h1 className="text-lg font-bold text-white mb-1">Form Not Found</h1>
          <p className="text-xs text-zinc-400 max-w-sm mb-5">{error || 'This application form does not exist or has been removed.'}</p>
          <Link to="/" className="inline-flex items-center text-xs text-[var(--accent)] hover:underline gap-1">
            <ArrowLeft className="size-3" /> Return to ConnectingERLC
          </Link>
        </div>
      </div>
    );
  }

  const activeApp = submittedApp || userApp;

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col font-sans">
      <TopBanner />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12">
        {/* Community Identity & Header */}
        <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#121215] mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-white overflow-hidden shrink-0 border border-white/[0.08]">
              {serverData?.iconUrl ? (
                <img src={serverData.iconUrl} alt={serverData.name} className="size-full object-cover" />
              ) : (
                serverData?.name?.slice(0, 2).toUpperCase() || 'RP'
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-white">{serverData?.name || 'Community'}</h2>
                {serverData?.verified && (
                  <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-400 border-sky-500/20">
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500">Official Community Application</p>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{formData.name}</h1>
          {formData.introText && (
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed whitespace-pre-line">
              {formData.introText}
            </p>
          )}

          {/* Security Notice */}
          <div className="mt-4 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs flex items-start gap-2.5">
            <Shield className="size-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-semibold block">Security Notice</span>
              <span className="text-[11px] text-amber-300/90">
                Never share passwords, two-factor authentication codes, Discord bot tokens, or private sensitive credentials in any community application.
              </span>
            </div>
          </div>
        </div>

        {/* Existing Submission or Confirmation View */}
        {activeApp ? (
          <div className="p-8 rounded-2xl border border-white/[0.08] bg-[#121215] text-center space-y-4">
            <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-6 text-emerald-400" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Application Submitted</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                {formData.closingMessage || 'Thank you for your application! We will review it shortly.'}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-black/20 text-xs text-zinc-300">
              <span>Status:</span>
              <span className="font-semibold capitalize text-[var(--accent)]">{activeApp.status?.replace('_', ' ') || 'Pending'}</span>
            </div>

            {activeApp.staffNotes?.length > 0 && (
              <div className="max-w-md mx-auto text-left p-3.5 rounded-xl border border-white/[0.06] bg-black/30 text-xs space-y-2 mt-4">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Staff Updates</span>
                {activeApp.staffNotes.map((note: any) => (
                  <div key={note.id} className="text-zinc-300">
                    <p className="text-[10px] text-zinc-500">{note.author} • {new Date(note.createdAt).toLocaleDateString()}</p>
                    <p className="mt-0.5">{note.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 flex items-center justify-center gap-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteApplication(activeApp.id)}
                className="text-xs text-rose-400 hover:text-rose-300 h-8 gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Withdraw Application
              </Button>
            </div>
          </div>
        ) : formData.isClosed ? (
          /* Closed State */
          <div className="p-8 rounded-2xl border border-white/[0.08] bg-[#121215] text-center space-y-3">
            <Clock className="size-8 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">This Form is Currently Closed</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              This application form is no longer accepting new responses. Please check back later or contact server staff.
            </p>
          </div>
        ) : (
          /* Active Application Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#121215] space-y-6">
              {validationError && (
                <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs">
                  {validationError}
                </div>
              )}

              {formData.questions?.map((q: any, idx: number) => (
                <div key={q.id} className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-200 block">
                    {idx + 1}. {q.label} {q.required && <span className="text-rose-400">*</span>}
                  </label>
                  {q.description && <p className="text-[11px] text-zinc-500">{q.description}</p>}

                  {/* Short Text */}
                  {q.type === 'short_text' && (
                    <Input
                      value={answers[q.id] || ''}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      placeholder="Your answer"
                      className="bg-black/20 border-white/[0.08] text-xs h-9 text-white"
                    />
                  )}

                  {/* Long Text */}
                  {q.type === 'long_text' && (
                    <textarea
                      rows={4}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      placeholder="Your detailed response (max 2000 characters)..."
                      maxLength={2000}
                      className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-xs text-white focus:outline-none leading-relaxed"
                    />
                  )}

                  {/* Number */}
                  {q.type === 'number' && (
                    <Input
                      type="number"
                      min={q.min ?? undefined}
                      max={q.max ?? undefined}
                      value={answers[q.id] ?? ''}
                      onChange={(e) => handleInputChange(q.id, e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Enter a number"
                      className="bg-black/20 border-white/[0.08] text-xs h-9 text-white"
                    />
                  )}

                  {/* Yes / No */}
                  {q.type === 'yes_no' && (
                    <div className="flex items-center gap-3">
                      {(['Yes', 'No'] as const).map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => handleInputChange(q.id, choice)}
                          className={cn(
                            'px-4 py-1.5 rounded-lg border text-xs font-medium transition-all',
                            answers[q.id] === choice
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]'
                              : 'border-white/[0.08] text-zinc-400 hover:text-white bg-black/20'
                          )}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dropdown */}
                  {q.type === 'dropdown' && (
                    <select
                      value={answers[q.id] || ''}
                      onChange={(e) => handleInputChange(q.id, e.target.value)}
                      className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2 text-xs text-white focus:outline-none h-9"
                    >
                      <option value="">Select an option...</option>
                      {q.options?.map((opt: string, oIdx: number) => (
                        <option key={oIdx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Multiple Choice (Radio) */}
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-1.5 pt-1">
                      {q.options?.map((opt: string, oIdx: number) => (
                        <label key={oIdx} className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer p-1.5 rounded-md hover:bg-white/[0.02]">
                          <input
                            type="radio"
                            name={`radio_${q.id}`}
                            checked={answers[q.id] === opt}
                            onChange={() => handleInputChange(q.id, opt)}
                            className="accent-[var(--accent)]"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Checkboxes (Multi-select) */}
                  {q.type === 'checkboxes' && (
                    <div className="space-y-1.5 pt-1">
                      {q.options?.map((opt: string, oIdx: number) => {
                        const checked = Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                        return (
                          <label key={oIdx} className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer p-1.5 rounded-md hover:bg-white/[0.02]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleCheckboxToggle(q.id, opt)}
                              className="accent-[var(--accent)] rounded"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t border-white/[0.08] space-y-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs h-9 gap-1.5"
                >
                  <Send className="size-3.5" />
                  {submitting ? 'Submitting Application...' : formData.submitButtonText || 'Submit Application'}
                </Button>

                {formData.extraButtons?.map((btn: any, bIdx: number) => (
                  <a
                    key={bIdx}
                    href={btn.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-zinc-300 hover:text-white p-2 rounded-lg border border-white/[0.08] bg-black/20 hover:bg-white/[0.02] transition-colors"
                  >
                    {btn.label}
                    <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            </div>
          </form>
        )}

        {/* Footer actions: Report form */}
        <div className="mt-8 flex items-center justify-between text-xs text-zinc-500 border-t border-white/[0.06] pt-4">
          <span>Powered by ConnectingERLC</span>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Flag className="size-3" /> Report Form
          </button>
        </div>
      </main>

      {/* Safety Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/[0.08] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Flag className="size-4 text-rose-400" />
                Report Application Form
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setShowReportModal(false)} className="h-6 w-6 p-0 text-zinc-400">
                ✕
              </Button>
            </div>

            <p className="text-xs text-zinc-400">
              Help maintain community safety. Reports are strictly reviewed by platform administrators.
            </p>

            {reportSuccess ? (
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs text-center font-medium">
                ✓ Report submitted. Thank you for keeping our community safe.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-md p-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Phishing / Credential harvesting">Phishing / Asking for passwords or tokens</option>
                    <option value="Scam / Fraud">Scam or financial fraud</option>
                    <option value="Harassment / Hate speech">Harassment or hate speech</option>
                    <option value="Malicious content">Malicious or illegal content</option>
                    <option value="Other">Other violation</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Details (optional)</label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Describe why this form violates community safety guidelines..."
                    className="w-full bg-black/30 border border-white/[0.08] rounded-md p-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowReportModal(false)} className="text-xs text-zinc-400">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={submittingReport}
                    onClick={handleSubmitReport}
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-8 px-4"
                  >
                    {submittingReport ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
