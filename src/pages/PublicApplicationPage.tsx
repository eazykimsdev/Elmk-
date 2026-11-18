import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileText,
  Shield,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Send,
  HelpCircle,
  Edit3,
  UserCheck,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TopBanner } from '@/components/TopBanner';

interface Question {
  id: string;
  label: string;
  title?: string;
  description?: string;
  type: string;
  required: boolean;
  options?: string[];
  min?: number | null;
  max?: number | null;
}

export function PublicApplicationPage() {
  const { serverSlug, formSlug } = useParams<{
    serverSlug?: string;
    formSlug?: string;
  }>();

  const resolvedServerId = serverSlug || '';
  const resolvedFormSlug = formSlug || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any | null>(null);
  const [serverData, setServerData] = useState<any | null>(null);
  const [userApp, setUserApp] = useState<any | null>(null);

  // Form filling flow state
  // stages: 'intro' | 'questions' | 'review' | 'submitted'
  const [stage, setStage] = useState<'intro' | 'questions' | 'review' | 'submitted'>('intro');
  const [currentQuestionPageIndex, setCurrentQuestionPageIndex] = useState<number>(0);
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

  // Draft autosave debounce ref
  const autosaveTimerRef = useRef<any>(null);

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
        if (data.userApplication) {
          setUserApp(data.userApplication);
          setStage('submitted');
        } else if (data.applicantDraft?.answers) {
          setAnswers(data.applicantDraft.answers);
          if (data.applicantDraft.currentStep > 0) {
            setStage('questions');
            setCurrentQuestionPageIndex(Math.max(0, data.applicantDraft.currentStep - 1));
          }
        }
      })
      .catch((err) => {
        setError(err.message || 'Could not load application form.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [resolvedServerId, resolvedFormSlug]);

  // Group questions by page_break
  const questionPages: Question[][] = useMemo(() => {
    if (!formData?.questions || formData.questions.length === 0) return [[]];
    const pages: Question[][] = [];
    let curPage: Question[] = [];
    for (const q of formData.questions) {
      if (q.type === 'page_break') {
        if (curPage.length > 0) {
          pages.push(curPage);
          curPage = [];
        }
      } else {
        curPage.push(q);
      }
    }
    if (curPage.length > 0 || pages.length === 0) {
      pages.push(curPage);
    }
    return pages;
  }, [formData?.questions]);

  // Autosave draft answers to server
  const triggerAutosave = (newAnswers: Record<string, any>, stepNumber: number) => {
    if (!formData?.id) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/public/forms/${formData.id}/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ answers: newAnswers, currentStep: stepNumber })
        });
      } catch {}
    }, 800);
  };

  const handleInputChange = (questionId: string, value: any) => {
    setValidationError(null);
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      triggerAutosave(next, currentQuestionPageIndex + 1);
      return next;
    });
  };

  const handleCheckboxToggle = (questionId: string, option: string) => {
    setValidationError(null);
    setAnswers((prev) => {
      const currentList: string[] = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      const updated = currentList.includes(option)
        ? currentList.filter((item) => item !== option)
        : [...currentList, option];
      const next = { ...prev, [questionId]: updated };
      triggerAutosave(next, currentQuestionPageIndex + 1);
      return next;
    });
  };

  // Validate the current page before going to next page or review
  const validateCurrentPage = (): boolean => {
    const currentPageQuestions = questionPages[currentQuestionPageIndex] || [];
    for (const q of currentPageQuestions) {
      if (q.required) {
        const ans = answers[q.id];
        if (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
          setValidationError(`Please answer the required question: "${q.label}"`);
          return false;
        }
      }
    }
    setValidationError(null);
    return true;
  };

  const handleNextPage = () => {
    if (!validateCurrentPage()) return;

    if (currentQuestionPageIndex < questionPages.length - 1) {
      const nextIdx = currentQuestionPageIndex + 1;
      setCurrentQuestionPageIndex(nextIdx);
      triggerAutosave(answers, nextIdx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setStage('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    setValidationError(null);
    if (stage === 'review') {
      setStage('questions');
      setCurrentQuestionPageIndex(questionPages.length - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (currentQuestionPageIndex > 0) {
      const prevIdx = currentQuestionPageIndex - 1;
      setCurrentQuestionPageIndex(prevIdx);
      triggerAutosave(answers, prevIdx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setStage('intro');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinalSubmit = async () => {
    setValidationError(null);
    if (!formData?.id) return;

    // Validate all questions across all pages
    for (let pIdx = 0; pIdx < questionPages.length; pIdx++) {
      for (const q of questionPages[pIdx]) {
        if (q.required) {
          const ans = answers[q.id];
          if (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
            setValidationError(`Please answer the required question: "${q.label}"`);
            setCurrentQuestionPageIndex(pIdx);
            setStage('questions');
            return;
          }
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
      setStage('submitted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        setStage('intro');
        setAnswers({});
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
          <Link to="/" className="inline-flex items-center text-xs text-zinc-400 hover:text-white gap-1 transition-colors">
            <ArrowLeft className="size-3" /> Return to ConnectingERLC
          </Link>
        </div>
      </div>
    );
  }

  const activeApp = submittedApp || userApp;
  const totalPagesCount = questionPages.length;
  const currentStepNumber = stage === 'intro' ? 1 : stage === 'review' ? totalPagesCount + 2 : stage === 'submitted' ? totalPagesCount + 3 : currentQuestionPageIndex + 2;
  const totalStepsCount = totalPagesCount + 2; // Intro + Pages + Review

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col font-sans antialiased">
      <TopBanner />

      <main className="flex-1 max-w-[1040px] w-full mx-auto px-4 py-8 sm:py-12">
        {/* Banner image if configured */}
        {formData.bannerUrl && (
          <div className="w-full h-36 sm:h-48 rounded-xl overflow-hidden mb-6 border border-white/10 bg-zinc-900">
            <img src={formData.bannerUrl} alt="Form Banner" className="w-full h-full object-cover" />
          </div>
        )}

        {/* ── STAGE 1: SUBMITTED VIEW ── */}
        {activeApp ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="p-8 rounded-xl border border-white/10 bg-[#0E0E11] text-center space-y-6">
              {/* Status Stepper Line */}
              <div className="space-y-2">
                <div className="flex items-center justify-between max-w-md mx-auto pt-2">
                  {/* Step 1: Submitted */}
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="size-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs font-semibold">
                      <CheckCircle2 className="size-4" />
                    </div>
                    <span className="text-[11px] font-medium text-emerald-400">Submitted</span>
                  </div>

                  <div className={cn('h-0.5 flex-1 transition-colors', activeApp.status === 'pending' || activeApp.status === 'needs_info' || activeApp.status === 'accepted' || activeApp.status === 'denied' ? 'bg-emerald-500/40' : 'bg-white/10')} />

                  {/* Step 2: In Review */}
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={cn(
                      'size-7 rounded-full flex items-center justify-center text-xs font-semibold border',
                      activeApp.status === 'needs_info'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
                        : activeApp.status === 'accepted' || activeApp.status === 'denied'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-white/10 text-white border-white/20'
                    )}>
                      {activeApp.status === 'accepted' || activeApp.status === 'denied' ? <CheckCircle2 className="size-4" /> : <Clock className="size-3.5" />}
                    </div>
                    <span className="text-[11px] font-medium text-zinc-300">In Review</span>
                  </div>

                  <div className={cn('h-0.5 flex-1 transition-colors', activeApp.status === 'accepted' || activeApp.status === 'denied' ? 'bg-emerald-500/40' : 'bg-white/10')} />

                  {/* Step 3: Decision */}
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={cn(
                      'size-7 rounded-full flex items-center justify-center text-xs font-semibold border',
                      activeApp.status === 'accepted'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : activeApp.status === 'denied'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : 'bg-white/5 text-zinc-500 border-white/10'
                    )}>
                      {activeApp.status === 'accepted' ? '✓' : activeApp.status === 'denied' ? '✕' : '3'}
                    </div>
                    <span className="text-[11px] font-medium capitalize text-zinc-400">
                      {activeApp.status === 'accepted' ? 'Accepted' : activeApp.status === 'denied' ? 'Denied' : 'Decision'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <h2 className="text-xl font-bold text-white tracking-tight">{formData.name}</h2>
                <p className="text-xs text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                  {formData.closingMessage || 'Thank you for your application! Server staff will review your submission shortly.'}
                </p>
              </div>

              {/* Staff message if present */}
              {activeApp.staffNotes?.length > 0 && (
                <div className="max-w-md mx-auto text-left p-3.5 rounded-lg border border-white/10 bg-[#141417] text-xs space-y-2">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Staff Updates</span>
                  {activeApp.staffNotes.map((note: any) => (
                    <div key={note.id} className="text-zinc-300">
                      <p className="text-[10px] text-zinc-500">{note.author} • {new Date(note.createdAt).toLocaleDateString()}</p>
                      <p className="mt-0.5 leading-relaxed">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Quiet one-line note (no yellow warning box) */}
              <div className="py-2 text-[11px] text-zinc-500 border-t border-b border-white/5">
                Your submission is recorded securely. You will be notified in Discord when a decision is made.
              </div>

              {/* Withdraw Button */}
              {['pending', 'needs_info'].includes(activeApp.status) && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteApplication(activeApp.id)}
                    className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8 gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    Withdraw Application
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : formData.isOpen === false ? (
          /* Closed State */
          <div className="max-w-md mx-auto p-8 rounded-xl border border-white/10 bg-[#0E0E11] text-center space-y-3">
            <Clock className="size-8 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">This Form is Currently Closed</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This application form is no longer accepting new responses. Please check back later or contact server staff.
            </p>
          </div>
        ) : (
          /* ── ACTIVE APPLICANT FLOW ── */
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
            {/* Slim Step Rail on Desktop (Progress bar on Mobile) */}
            <aside className="w-full lg:sticky lg:top-8">
              {/* Mobile Progress Bar */}
              <div className="block lg:hidden mb-6 p-4 rounded-xl border border-white/10 bg-[#0E0E11] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">
                    {stage === 'intro' ? 'Welcome' : stage === 'review' ? 'Review & Submit' : `Page ${currentQuestionPageIndex + 1} of ${totalPagesCount}`}
                  </span>
                  <span className="text-zinc-500 font-mono">
                    Step {currentStepNumber} of {totalStepsCount}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${(currentStepNumber / totalStepsCount) * 100}%` }}
                  />
                </div>
              </div>

              {/* Desktop Slim Step Rail */}
              <div className="hidden lg:flex flex-col space-y-1.5 p-3 rounded-xl border border-white/10 bg-[#0E0E11]">
                {/* Intro step */}
                <button
                  type="button"
                  onClick={() => {
                    setStage('intro');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer',
                    stage === 'intro' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <span className={cn('size-5 rounded-full flex items-center justify-center text-[10px] border', stage === 'intro' ? 'border-white bg-white text-black font-bold' : 'border-white/20 text-zinc-400')}>
                    1
                  </span>
                  <span className="truncate">Overview</span>
                </button>

                {/* Question pages */}
                {questionPages.map((_, pIdx) => {
                  const stepNum = pIdx + 2;
                  const isCurrent = stage === 'questions' && currentQuestionPageIndex === pIdx;
                  return (
                    <button
                      key={`rail-page-${pIdx}`}
                      type="button"
                      disabled={stage === 'intro'}
                      onClick={() => {
                        if (stage !== 'intro') {
                          setCurrentQuestionPageIndex(pIdx);
                          setStage('questions');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors',
                        stage === 'intro' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                        isCurrent ? 'bg-white/10 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      )}
                    >
                      <span className={cn('size-5 rounded-full flex items-center justify-center text-[10px] border', isCurrent ? 'border-white bg-white text-black font-bold' : 'border-white/20 text-zinc-400')}>
                        {stepNum}
                      </span>
                      <span className="truncate">
                        {questionPages.length > 1 ? `Questions ${pIdx + 1}` : 'Questions'}
                      </span>
                    </button>
                  );
                })}

                {/* Review step */}
                <button
                  type="button"
                  disabled={stage === 'intro'}
                  onClick={() => {
                    if (stage !== 'intro' && validateCurrentPage()) {
                      setStage('review');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors',
                    stage === 'intro' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                    stage === 'review' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <span className={cn('size-5 rounded-full flex items-center justify-center text-[10px] border', stage === 'review' ? 'border-white bg-white text-black font-bold' : 'border-white/20 text-zinc-400')}>
                    {totalStepsCount}
                  </span>
                  <span className="truncate">Review</span>
                </button>
              </div>
            </aside>

            {/* Main Stage Content */}
            <div className="w-full space-y-6">
              {/* Validation alert banner */}
              {validationError && (
                <div className="p-3.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                  <HelpCircle className="size-4 shrink-0 text-rose-400" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* ── STAGE A: INTRO PAGE ── */}
              {stage === 'intro' && (
                <div className="p-6 sm:p-8 rounded-xl border border-white/10 bg-[#0E0E11] space-y-6">
                  {/* Community Header */}
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {serverData?.iconUrl ? (
                        <img src={serverData.iconUrl} alt={serverData.name} className="size-full object-cover" />
                      ) : (
                        serverData?.name?.slice(0, 2).toUpperCase() || 'RP'
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
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

                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">{formData.name}</h1>
                    {formData.introText && (
                      <p className="text-xs sm:text-sm text-zinc-400 mt-2.5 leading-relaxed whitespace-pre-line">
                        {formData.introText}
                      </p>
                    )}
                  </div>

                  {/* Info Lines (Profile shared, Role reward, Security) */}
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center gap-2.5 text-xs text-zinc-400 p-2.5 rounded-lg bg-[#141417] border border-white/5">
                      <UserCheck className="size-4 text-zinc-300 shrink-0" />
                      <span>Your Discord profile is shared with reviewers.</span>
                    </div>

                    {formData.roleRewardId && (
                      <div className="flex items-center gap-2.5 text-xs text-zinc-400 p-2.5 rounded-lg bg-[#141417] border border-white/5">
                        <Award className="size-4 text-emerald-400 shrink-0" />
                        <span>If approved, you will automatically receive the assigned role in Discord.</span>
                      </div>
                    )}

                    {Array.isArray(formData.infoLines) && formData.infoLines.map((line: any, idx: number) => {
                      if (line && line.enabled !== false && line.text) {
                        return (
                          <div key={idx} className="flex items-center gap-2.5 text-xs text-zinc-400 p-2.5 rounded-lg bg-[#141417] border border-white/5">
                            <Shield className="size-4 text-zinc-300 shrink-0" />
                            <span>{line.text}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="text-xs text-zinc-500">
                      {questionPages.flat().length} question{questionPages.flat().length !== 1 ? 's' : ''} total
                    </div>
                    <Button
                      onClick={() => {
                        setStage('questions');
                        setCurrentQuestionPageIndex(0);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="bg-white text-black hover:bg-zinc-200 text-xs font-semibold h-9 px-5 gap-1.5 cursor-pointer"
                    >
                      <span>{formData.startButtonText || 'Start Application'}</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STAGE B: QUESTION PAGES ── */}
              {stage === 'questions' && (
                <div className="p-6 sm:p-8 rounded-xl border border-white/10 bg-[#0E0E11] space-y-6">
                  {/* Question page header */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Page {currentQuestionPageIndex + 1} of {totalPagesCount}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Draft autosaved
                    </span>
                  </div>

                  {/* Questions on current page */}
                  <div className="space-y-6">
                    {(questionPages[currentQuestionPageIndex] || []).map((q, idx) => (
                      <div key={q.id} className="space-y-2.5">
                        <label className="text-sm font-medium text-white block leading-snug">
                          {q.label} {q.required && <span className="text-rose-400 font-bold">*</span>}
                        </label>
                        {q.description && <p className="text-xs text-zinc-400 leading-relaxed">{q.description}</p>}

                        {/* Short Text */}
                        {q.type === 'short_text' && (
                          <Input
                            value={answers[q.id] || ''}
                            onChange={(e) => handleInputChange(q.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleNextPage();
                              }
                            }}
                            placeholder="Your answer"
                            className="bg-[#141417] border-white/10 text-xs h-10 text-white rounded-lg focus:border-white/20"
                          />
                        )}

                        {/* Long Text (Paragraph) */}
                        {q.type === 'long_text' && (
                          <textarea
                            rows={4}
                            value={answers[q.id] || ''}
                            onChange={(e) => handleInputChange(q.id, e.target.value)}
                            placeholder="Your detailed response (max 2000 characters)..."
                            maxLength={2000}
                            className="w-full bg-[#141417] border border-white/10 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-white/20 leading-relaxed"
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleNextPage();
                              }
                            }}
                            placeholder="Enter a number"
                            className="bg-[#141417] border-white/10 text-xs h-10 text-white rounded-lg"
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
                                  'px-5 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer',
                                  answers[q.id] === choice
                                    ? 'bg-white text-black border-white font-semibold'
                                    : 'border-white/10 text-zinc-400 hover:text-white bg-[#141417]'
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
                            className="w-full bg-[#141417] border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-white/20 h-10 cursor-pointer"
                          >
                            <option value="">Select an option...</option>
                            {q.options?.map((opt: string, oIdx: number) => (
                              <option key={oIdx} value={opt} className="bg-[#141417] text-white">
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Multiple Choice (Radio) */}
                        {q.type === 'multiple_choice' && (
                          <div className="space-y-2 pt-1">
                            {q.options?.map((opt: string, oIdx: number) => (
                              <label key={oIdx} className="flex items-center gap-3 text-xs text-zinc-300 cursor-pointer p-2 rounded-lg hover:bg-white/[0.03] border border-white/5 bg-[#141417]">
                                <input
                                  type="radio"
                                  name={`radio_${q.id}`}
                                  checked={answers[q.id] === opt}
                                  onChange={() => handleInputChange(q.id, opt)}
                                  className="accent-white"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Checkboxes (Multi-select) */}
                        {q.type === 'checkboxes' && (
                          <div className="space-y-2 pt-1">
                            {q.options?.map((opt: string, oIdx: number) => {
                              const checked = Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                              return (
                                <label key={oIdx} className="flex items-center gap-3 text-xs text-zinc-300 cursor-pointer p-2 rounded-lg hover:bg-white/[0.03] border border-white/5 bg-[#141417]">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleCheckboxToggle(q.id, opt)}
                                    className="accent-white rounded"
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Navigation Buttons: Previous & Next */}
                  <div className="pt-6 border-t border-white/5 flex items-center justify-between gap-3">
                    {formData.allowPrevious !== false ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handlePrevPage}
                        className="bg-[#141417] text-zinc-300 hover:text-white border-white/10 text-xs h-9 px-4 gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="size-3.5" />
                        <span>Previous</span>
                      </Button>
                    ) : <div />}

                    <Button
                      type="button"
                      onClick={handleNextPage}
                      className="bg-white text-black hover:bg-zinc-200 text-xs font-semibold h-9 px-5 gap-1.5 cursor-pointer"
                    >
                      <span>{currentQuestionPageIndex < totalPagesCount - 1 ? 'Next' : 'Review Answers'}</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STAGE C: REVIEW & SUBMIT PAGE ── */}
              {stage === 'review' && (
                <div className="p-6 sm:p-8 rounded-xl border border-white/10 bg-[#0E0E11] space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Review Your Answers</h2>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Please double-check all your responses before submitting your application.
                    </p>
                  </div>

                  {/* Answers summary list with Edit link for each */}
                  <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-[#141417]">
                    {questionPages.map((pageQuestions, pIdx) =>
                      pageQuestions.map((q) => {
                        const ans = answers[q.id];
                        const displayAns = Array.isArray(ans)
                          ? ans.join(', ')
                          : ans !== undefined && ans !== null && ans !== ''
                          ? String(ans)
                          : 'Not answered';

                        return (
                          <div key={q.id} className="p-4 flex items-start justify-between gap-4 hover:bg-white/[0.01]">
                            <div className="min-w-0 space-y-1">
                              <p className="text-xs font-medium text-zinc-400">{q.label}</p>
                              <p className={cn('text-xs break-words leading-relaxed', ans ? 'text-white' : 'text-zinc-500 italic')}>
                                {displayAns}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setCurrentQuestionPageIndex(pIdx);
                                setStage('questions');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-xs text-zinc-400 hover:text-white h-7 px-2.5 gap-1 shrink-0 cursor-pointer"
                            >
                              <Edit3 className="size-3" />
                              <span>Edit</span>
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Final Submit and Back button */}
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handlePrevPage}
                      className="bg-[#141417] text-zinc-300 hover:text-white border-white/10 text-xs h-9 px-4 gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="size-3.5" />
                      <span>Back to Questions</span>
                    </Button>

                    <Button
                      type="button"
                      disabled={submitting}
                      onClick={handleFinalSubmit}
                      className="bg-white text-black hover:bg-zinc-200 text-xs font-semibold h-9 px-5 gap-1.5 cursor-pointer"
                    >
                      <Send className="size-3.5" />
                      <span>{submitting ? 'Submitting...' : formData.submitButtonText || 'Submit Application'}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions: Report form */}
        <div className="mt-8 flex items-center justify-between text-xs text-zinc-500 border-t border-white/5 pt-4">
          <span>Official Community Application • ConnectingERLC</span>
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <Flag className="size-3" />
            <span>Report application</span>
          </button>
        </div>

        {/* Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-[#0E0E11] border border-white/10 rounded-xl p-6 max-w-md w-full space-y-4">
              <h3 className="text-sm font-semibold text-white">Report Application Form</h3>
              {reportSuccess ? (
                <p className="text-xs text-emerald-400 py-4">Report submitted. Thank you for helping keep the community safe.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 block">Reason</label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full bg-[#141417] border border-white/10 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="Phishing / Credential harvesting">Phishing / Credential harvesting</option>
                      <option value="Malicious links">Malicious links</option>
                      <option value="Harassment or hate speech">Harassment or hate speech</option>
                      <option value="Spam / Commercial advertising">Spam / Commercial advertising</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 block">Additional Details</label>
                    <textarea
                      rows={3}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Explain what is suspicious about this form..."
                      className="w-full bg-[#141417] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowReportModal(false)}
                      className="text-xs text-zinc-400"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={submittingReport}
                      onClick={handleSubmitReport}
                      className="text-xs bg-rose-600 hover:bg-rose-500 text-white"
                    >
                      {submittingReport ? 'Submitting...' : 'Submit Report'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PublicApplicationPage;
