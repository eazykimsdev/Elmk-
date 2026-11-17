import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Plus,
  Copy,
  ExternalLink,
  Trash2,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Eye,
  ArrowLeft,
  Inbox as InboxIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RolePicker } from '@/components/ui/RolePicker';
import { apiFetch } from '@/lib/api';

interface Question {
  id: string;
  label?: string;
  title: string;
  type: 'short_text' | 'long_text' | 'dropdown' | 'multiple_choice' | 'checkboxes' | 'number' | 'yes_no';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface LinkButton {
  label: string;
  url: string;
}

interface FormConfig {
  id: string;
  serverId: string;
  name: string;
  title?: string;
  slug: string;
  isOpen: boolean;
  status?: string;
  closeDate?: string | null;
  submissionLimit?: number | null;
  introText?: string;
  closingText?: string;
  thankYouText?: string;
  submitButtonText?: string;
  submitLabel?: string;
  linkButtons?: LinkButton[];
  autoRoleId?: string | null;
  acceptRoleId?: string | null;
  cooldownDays?: number;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
}

interface Submission {
  id: string;
  formId: string;
  formName: string;
  serverId: string;
  applicantId: string;
  applicantUsername: string;
  applicantDisplayName: string;
  applicantAvatar: string | null;
  applicantAccountAgeDays: number;
  status: 'pending' | 'accepted' | 'denied' | 'needs_info';
  answers: Record<string, any>;
  notes?: Array<{
    id: string;
    author: string;
    content: string;
    action?: string;
    createdAt: string;
  }>;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  roleAssigned?: boolean;
  createdAt: string;
}

interface FormsTabProps {
  currentGuildId: string;
  serverName: string;
  customUrl?: string | null;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void;
}

const CHOICE_TYPES = new Set(['multiple_choice', 'checkboxes', 'dropdown']);

export function FormsTab({ currentGuildId, serverName, customUrl, addToast }: FormsTabProps) {
  const [activeTab, setActiveTab] = useState<'forms' | 'inbox' | 'settings'>('forms');
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Builder State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [introText, setIntroText] = useState('');
  const [closingText, setClosingText] = useState('');
  const [submitButtonText, setSubmitButtonText] = useState('Submit Application');
  const [linkButtons, setLinkButtons] = useState<LinkButton[]>([]);
  const [autoRoleId, setAutoRoleId] = useState('');
  const [cooldownDays, setCooldownDays] = useState(7);
  const [submissionLimit, setSubmissionLimit] = useState<number | ''>('');
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Builder save & draft status
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'published' | 'error'>('idle');
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [draftRestoredBanner, setDraftRestoredBanner] = useState<boolean>(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inbox & Review State
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'denied' | 'needs_info'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const loadForms = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/workspace/${currentGuildId}/forms`);
      if (res.ok) {
        const data = await res.json();
        setForms(Array.isArray(data.forms) ? data.forms : []);
      }
    } catch (err: any) {
      console.warn('[FORMS] Load failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentGuildId]);

  const loadSubmissions = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      const res = await apiFetch(`/workspace/${currentGuildId}/submissions?status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      }
    } catch (err: any) {
      console.warn('[SUBMISSIONS] Load failed:', err.message);
    }
  }, [currentGuildId, statusFilter]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  useEffect(() => {
    if (activeTab === 'inbox') {
      loadSubmissions();
    }
  }, [activeTab, loadSubmissions]);

  // Check if there is a saved server-side draft when opening Create Form
  const handleOpenCreateForm = async () => {
    setBuilderError(null);
    setSaveState('idle');
    setDraftRestoredBanner(false);

    try {
      const res = await apiFetch(`/workspace/${currentGuildId}/forms/draft`);
      if (res.ok) {
        const data = await res.json();
        if (data?.draft && !data.draft.editingFormId) {
          const d = data.draft;
          setEditingFormId(null);
          setFormName(d.name || '');
          setFormSlug(d.slug || '');
          setIsOpen(d.isOpen !== false);
          setQuestions(
            Array.isArray(d.questions) && d.questions.length > 0
              ? d.questions.map((q: any) => ({
                  ...q,
                  title: q.title || q.label || '',
                  label: q.label || q.title || '',
                  options: Array.isArray(q.options) ? q.options : CHOICE_TYPES.has(q.type) ? ['Option 1', 'Option 2'] : undefined
                }))
              : [{ id: 'q_' + Date.now(), title: 'Why do you want to join our team?', label: 'Why do you want to join our team?', type: 'long_text', required: true }]
          );
          setIntroText(d.introText || '');
          setClosingText(d.closingText || '');
          setSubmitButtonText(d.submitButtonText || 'Submit Application');
          setLinkButtons(Array.isArray(d.linkButtons) ? d.linkButtons : []);
          setAutoRoleId(d.autoRoleId || '');
          setCooldownDays(d.cooldownDays ?? 7);
          setSubmissionLimit(d.submissionLimit ?? '');
          setShowMoreOptions(false);
          setDraftRestoredBanner(true);
          setIsBuilderOpen(true);
          return;
        }
      }
    } catch {}

    setEditingFormId(null);
    setFormName('');
    setFormSlug('');
    setIsOpen(true);
    setQuestions([
      {
        id: 'q_' + Date.now(),
        title: 'Why do you want to join our team?',
        label: 'Why do you want to join our team?',
        type: 'long_text',
        required: true
      }
    ]);
    setIntroText('Please answer the following questions honestly.');
    setClosingText('Thank you! Our staff will review your application soon.');
    setSubmitButtonText('Submit Application');
    setLinkButtons([]);
    setAutoRoleId('');
    setCooldownDays(7);
    setSubmissionLimit('');
    setShowMoreOptions(false);
    setIsBuilderOpen(true);
  };

  const handleEditForm = (form: FormConfig) => {
    setBuilderError(null);
    setSaveState('idle');
    setDraftRestoredBanner(false);
    setEditingFormId(form.id);
    setFormName(form.name || form.title || '');
    setFormSlug(form.slug || '');
    setIsOpen(form.isOpen !== false && form.status !== 'closed');
    setQuestions(
      form.questions && form.questions.length
        ? form.questions.map((q: any) => ({
            ...q,
            title: q.title || q.label || '',
            label: q.label || q.title || '',
            options: Array.isArray(q.options)
              ? q.options
              : CHOICE_TYPES.has(q.type)
              ? ['Option 1', 'Option 2']
              : undefined
          }))
        : [
            {
              id: 'q_' + Date.now(),
              title: 'Why do you want to join our team?',
              label: 'Why do you want to join our team?',
              type: 'long_text',
              required: true
            }
          ]
    );
    setIntroText(form.introText || '');
    setClosingText(form.closingText || form.thankYouText || '');
    setSubmitButtonText(form.submitButtonText || form.submitLabel || 'Submit Application');
    setLinkButtons(Array.isArray(form.linkButtons) ? form.linkButtons : []);
    setAutoRoleId(form.autoRoleId || form.acceptRoleId || '');
    setCooldownDays(form.cooldownDays ?? 7);
    setSubmissionLimit(form.submissionLimit ?? '');
    setShowMoreOptions(false);
    setIsBuilderOpen(true);
  };

  // Auto-save draft to server while builder is open
  useEffect(() => {
    if (!isBuilderOpen || !currentGuildId) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);

    draftTimerRef.current = setTimeout(async () => {
      try {
        setSaveState((prev) => (prev === 'saving' ? prev : 'saving'));
        const res = await apiFetch(`/workspace/${currentGuildId}/forms/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            editingFormId,
            name: formName,
            slug: formSlug,
            isOpen,
            questions: questions.map((q) => ({
              ...q,
              title: q.title,
              label: q.title
            })),
            introText,
            closingText,
            submitButtonText,
            linkButtons,
            autoRoleId,
            cooldownDays,
            submissionLimit
          })
        });
        if (res.ok) {
          setSaveState('saved');
        }
      } catch {}
    }, 900);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    isBuilderOpen,
    currentGuildId,
    editingFormId,
    formName,
    formSlug,
    isOpen,
    questions,
    introText,
    closingText,
    submitButtonText,
    linkButtons,
    autoRoleId,
    cooldownDays,
    submissionLimit
  ]);

  const handleDeleteForm = async (formId: string) => {
    if (!window.confirm('Are you sure you want to delete this application form?')) return;
    try {
      const res = await apiFetch(`/workspace/${currentGuildId}/forms/${formId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete form');
      addToast?.('success', 'Form Deleted', 'Application form deleted.');
      loadForms();
    } catch (err: any) {
      addToast?.('error', 'Delete Failed', err.message || 'Could not delete form.');
    }
  };

  // Validate & Publish Form
  const handleSaveForm = async () => {
    setBuilderError(null);
    const cleanName = formName.trim();
    const cleanSlug = (formSlug.trim() || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/(^-|-$)/g, '');

    if (!cleanName) {
      const msg = 'Form name is required.';
      setBuilderError(msg);
      setSaveState('error');
      addToast?.('error', 'Save Failed', msg);
      return;
    }
    if (!cleanSlug || cleanSlug.length < 2) {
      const msg = 'Short link name must be at least 2 characters.';
      setBuilderError(msg);
      setSaveState('error');
      addToast?.('error', 'Save Failed', msg);
      return;
    }
    if (questions.length === 0) {
      const msg = 'Please add at least one question.';
      setBuilderError(msg);
      setSaveState('error');
      addToast?.('error', 'Save Failed', msg);
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const text = (q.title || q.label || '').trim();
      if (!text) {
        const msg = `Question #${i + 1} is missing its question text.`;
        setBuilderError(msg);
        setSaveState('error');
        addToast?.('error', 'Save Failed', msg);
        return;
      }
      if (CHOICE_TYPES.has(q.type)) {
        const validOpts = (q.options || []).map((o) => String(o || '').trim()).filter(Boolean);
        if (validOpts.length < 2) {
          const msg = `Question #${i + 1} ("${text}") requires at least two non-empty options.`;
          setBuilderError(msg);
          setSaveState('error');
          addToast?.('error', 'Save Failed', msg);
          return;
        }
      }
    }

    setSaveState('saving');
    try {
      const normalizedQuestions = questions.map((q) => ({
        id: q.id,
        title: (q.title || q.label || '').trim(),
        label: (q.title || q.label || '').trim(),
        type: q.type,
        required: Boolean(q.required),
        options: CHOICE_TYPES.has(q.type)
          ? (q.options || []).map((o) => String(o || '').trim()).filter(Boolean)
          : []
      }));

      const payload = {
        id: editingFormId || undefined,
        name: cleanName,
        title: cleanName,
        slug: cleanSlug,
        isOpen,
        status: isOpen ? 'open' : 'closed',
        questions: normalizedQuestions,
        introText: introText.trim(),
        closingText: closingText.trim(),
        thankYouText: closingText.trim(),
        submitButtonText: submitButtonText.trim() || 'Submit Application',
        submitLabel: submitButtonText.trim() || 'Submit Application',
        linkButtons: linkButtons.filter((b) => b.label.trim() && b.url.trim()),
        autoRoleId: autoRoleId || null,
        acceptRoleId: autoRoleId || null,
        cooldownDays: Number(cooldownDays) || 7,
        submissionLimit: submissionLimit === '' ? null : Number(submissionLimit)
      };

      const res = await apiFetch(`/workspace/${currentGuildId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish form.');
      }

      // Clear server-side draft upon publish
      await apiFetch(`/workspace/${currentGuildId}/forms/draft`, { method: 'DELETE' }).catch(() => {});

      setSaveState('published');
      addToast?.('success', 'Published', `Form "${cleanName}" has been saved and published.`);
      setIsBuilderOpen(false);
      loadForms();
    } catch (err: any) {
      const msg = err.message || 'Could not save and publish form.';
      setBuilderError(msg);
      setSaveState('error');
      addToast?.('error', 'Save Failed', msg);
    }
  };

  // Review Application in Inbox
  const handleReviewSubmission = async (action: 'accept' | 'deny' | 'needs_info') => {
    if (!selectedSubmission) return;
    setReviewing(true);
    try {
      const res = await apiFetch(`/workspace/${currentGuildId}/submissions/${selectedSubmission.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: reviewNote.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete review');

      addToast?.('success', 'Application Reviewed', `Marked application as ${action}.`);
      setSelectedSubmission(null);
      setReviewNote('');
      loadSubmissions();
    } catch (err: any) {
      addToast?.('error', 'Review Failed', err.message || 'Could not update application.');
    } finally {
      setReviewing(false);
    }
  };

  // Question helpers
  const handleAddQuestion = () => {
    if (questions.length >= 25) {
      addToast?.('warning', 'Limit Reached', 'Maximum 25 questions per form.');
      return;
    }
    const newQ: Question = {
      id: 'q_' + Date.now(),
      title: 'New question',
      label: 'New question',
      type: 'short_text',
      required: true
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) return;
    setQuestions((prev) => {
      const arr = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      const temp = arr[index];
      arr[index] = arr[target];
      arr[target] = temp;
      return arr;
    });
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  // Question Options helpers (Multiple choice, Checkboxes, Dropdown)
  const handleAddOption = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const current = Array.isArray(q.options) ? q.options : [];
        return { ...q, options: [...current, `Option ${current.length + 1}`] };
      })
    );
  };

  const handleUpdateOption = (questionId: string, optIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const next = [...(q.options || [])];
        next[optIndex] = value;
        return { ...q, options: next };
      })
    );
  };

  const handleRemoveOption = (questionId: string, optIndex: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const next = (q.options || []).filter((_, idx) => idx !== optIndex);
        return { ...q, options: next };
      })
    );
  };

  const handleMoveOption = (questionId: string, optIndex: number, direction: 'up' | 'down') => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const arr = [...(q.options || [])];
        const target = direction === 'up' ? optIndex - 1 : optIndex + 1;
        if (target < 0 || target >= arr.length) return q;
        const temp = arr[optIndex];
        arr[optIndex] = arr[target];
        arr[target] = temp;
        return { ...q, options: arr };
      })
    );
  };

  // Link buttons helpers
  const handleAddLinkButton = () => {
    if (linkButtons.length >= 5) return;
    setLinkButtons((prev) => [...prev, { label: '', url: '' }]);
  };

  const serverIdentifier = customUrl || currentGuildId;
  const domainHost = typeof window !== 'undefined' ? window.location.host : 'connectingerlc.xyz';

  // ─────────────────────────────────────────────────────────────────────────────
  // FULL-WIDTH FORM BUILDER VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (isBuilderOpen) {
    return (
      <div className="w-full max-w-[1100px] mx-auto space-y-6 pb-20 font-sans text-zinc-200">
        {/* Builder Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsBuilderOpen(false)}
              className="size-9 p-0 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]"
              aria-label="Back to forms"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="text-xs text-zinc-500">Applications / Builder</div>
              <h1 className="text-xl font-semibold text-zinc-100">
                {editingFormId ? 'Edit Form' : 'Create Form'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Clear save state indicator */}
            <span className="text-xs text-zinc-400">
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && 'Saved'}
              {saveState === 'published' && 'Published'}
              {saveState === 'error' && <span className="text-red-400">Error</span>}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsBuilderOpen(false)}
              disabled={saveState === 'saving'}
              className="h-9 px-3.5 text-xs rounded-full text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saveState === 'saving'}
              onClick={handleSaveForm}
              className="h-9 px-5 text-xs rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold hover:opacity-90 cursor-pointer"
            >
              {saveState === 'saving' ? 'Saving…' : 'Save & Publish'}
            </Button>
          </div>
        </div>

        {draftRestoredBanner && (
          <div className="px-4 py-2.5 rounded-xl border border-white/[0.08] bg-zinc-900/70 flex items-center justify-between text-xs text-zinc-300">
            <span>Restored your unsaved form draft.</span>
            <button
              type="button"
              onClick={async () => {
                await apiFetch(`/workspace/${currentGuildId}/forms/draft`, { method: 'DELETE' }).catch(() => {});
                setDraftRestoredBanner(false);
              }}
              className="text-zinc-400 hover:text-zinc-100 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {builderError && (
          <div
            role="alert"
            className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-center gap-2.5"
          >
            <AlertCircle className="size-4 text-red-400 shrink-0" />
            <span>{builderError}</span>
          </div>
        )}

        {/* Full-width Builder Layout with 16px gaps and 44px (h-11) inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 8 Columns: Form Fields & Questions */}
          <div className="lg:col-span-8 space-y-4">
            {/* Core Settings Card */}
            <div className="p-6 bg-[#121215] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-200 block">Form name</label>
                <Input
                  value={formName}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setFormName(nextName);
                    if (!editingFormId) {
                      setFormSlug(
                        nextName
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)/g, '')
                      );
                    }
                  }}
                  placeholder="e.g. Staff Application"
                  className="h-11 bg-[#0E0E11] border-white/[0.08] text-xs text-zinc-100 px-3.5 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-200 block">Short link name</label>
                <div className="flex items-center h-11 rounded-xl bg-[#0E0E11] border border-white/[0.08] overflow-hidden focus-within:border-white/[0.2]">
                  <span className="px-3.5 text-xs text-zinc-500 bg-zinc-950/60 border-r border-white/[0.06] h-full flex items-center select-none shrink-0">
                    {domainHost}/{serverIdentifier}/
                  </span>
                  <input
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="staff-application"
                    className="w-full h-full px-3 bg-transparent text-xs text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-medium text-zinc-200 block">Open for submissions</span>
                  <span className="text-xs text-zinc-400">Allow members to submit this form right away.</span>
                </div>
                <Switch checked={isOpen} onCheckedChange={setIsOpen} />
              </div>
            </div>

            {/* Reorderable Questions List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Questions</h2>
                  <p className="text-xs text-zinc-400">{questions.length} of 25 questions</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddQuestion}
                  className="h-9 px-3.5 text-xs rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/[0.1]"
                >
                  <Plus className="size-3.5 mr-1" /> Add question
                </Button>
              </div>

              <div className="space-y-4">
                {questions.map((q, idx) => {
                  const isChoice = CHOICE_TYPES.has(q.type);
                  const opts = Array.isArray(q.options) ? q.options : [];

                  return (
                    <div
                      key={q.id}
                      className="p-5 bg-[#121215] border border-white/[0.08] rounded-2xl space-y-4"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-medium text-zinc-500 w-6 shrink-0">
                          #{idx + 1}
                        </span>
                        <Input
                          value={q.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestions((prev) =>
                              prev.map((item) =>
                                item.id === q.id ? { ...item, title: val, label: val } : item
                              )
                            );
                          }}
                          placeholder="Enter your question…"
                          className="h-11 bg-[#0E0E11] border-white/[0.08] text-xs text-zinc-100 flex-1 rounded-xl"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion(idx, 'up')}
                            className="size-8 p-0 rounded-lg text-zinc-400 hover:text-zinc-100"
                            aria-label="Move question up"
                          >
                            <ChevronUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={idx === questions.length - 1}
                            onClick={() => handleMoveQuestion(idx, 'down')}
                            className="size-8 p-0 rounded-lg text-zinc-400 hover:text-zinc-100"
                            aria-label="Move question down"
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="size-8 p-0 rounded-lg text-zinc-400 hover:text-red-400"
                            aria-label="Remove question"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
                        <div className="flex items-center gap-2.5">
                          <label className="text-xs text-zinc-400">Answer type</label>
                          <select
                            value={q.type}
                            onChange={(e) => {
                              const nextType = e.target.value as Question['type'];
                              setQuestions((prev) =>
                                prev.map((item) => {
                                  if (item.id !== q.id) return item;
                                  const nextOptions = CHOICE_TYPES.has(nextType)
                                    ? item.options && item.options.length >= 2
                                      ? item.options
                                      : ['Option 1', 'Option 2']
                                    : undefined;
                                  return { ...item, type: nextType, options: nextOptions };
                                })
                              );
                            }}
                            className="h-11 px-3 rounded-xl bg-[#0E0E11] border border-white/[0.08] text-xs text-zinc-200 focus:outline-none"
                          >
                            <option value="short_text">Short text</option>
                            <option value="long_text">Long text</option>
                            <option value="multiple_choice">Multiple choice</option>
                            <option value="checkboxes">Checkboxes</option>
                            <option value="dropdown">Dropdown</option>
                            <option value="number">Number</option>
                            <option value="yes_no">Yes / No</option>
                          </select>
                        </div>

                        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setQuestions((prev) =>
                                prev.map((item) => (item.id === q.id ? { ...item, required: val } : item))
                              );
                            }}
                            className="rounded border-zinc-700 bg-zinc-900 accent-[var(--accent)] size-4"
                          />
                          <span>Required</span>
                        </label>
                      </div>

                      {/* Options Editor for Multiple choice, Checkboxes, and Dropdown */}
                      {isChoice && (
                        <div className="p-4 rounded-xl bg-[#0E0E11] border border-white/[0.06] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-zinc-300">
                              Options (at least 2 required)
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddOption(q.id)}
                              className="h-7 px-2.5 rounded-full text-[11px] border-white/[0.08] bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                            >
                              <Plus className="size-3 mr-1" /> Add option
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {opts.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <span className="text-[11px] text-zinc-500 w-5 text-right shrink-0">
                                  {optIdx + 1}.
                                </span>
                                <Input
                                  value={opt}
                                  onChange={(e) => handleUpdateOption(q.id, optIdx, e.target.value)}
                                  placeholder={`Option ${optIdx + 1}`}
                                  className="h-10 bg-[#121215] border-white/[0.08] text-xs text-zinc-100 flex-1 rounded-lg"
                                />
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={optIdx === 0}
                                    onClick={() => handleMoveOption(q.id, optIdx, 'up')}
                                    className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
                                    aria-label="Move option up"
                                  >
                                    <ChevronUp className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={optIdx === opts.length - 1}
                                    onClick={() => handleMoveOption(q.id, optIdx, 'down')}
                                    className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
                                    aria-label="Move option down"
                                  >
                                    <ChevronDown className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={opts.length <= 2}
                                    onClick={() => handleRemoveOption(q.id, optIdx)}
                                    className="p-1 text-zinc-500 hover:text-red-400 disabled:opacity-25"
                                    aria-label="Remove option"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Collapsed "More options" Section */}
            <div className="p-6 bg-[#121215] border border-white/[0.08] rounded-2xl space-y-4">
              <button
                type="button"
                onClick={() => setShowMoreOptions((prev) => !prev)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-100">More options</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Intro text, thank-you text, submit button label, link buttons, Discord role on acceptance, cooldown days, and submission limit.
                  </div>
                </div>
                <ChevronDown
                  className={`size-4 text-zinc-400 transition-transform ${showMoreOptions ? 'rotate-180' : ''}`}
                />
              </button>

              {showMoreOptions && (
                <div className="space-y-4 pt-4 border-t border-white/[0.06]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-200 block">Intro text</label>
                    <textarea
                      value={introText}
                      onChange={(e) => setIntroText(e.target.value)}
                      rows={2}
                      placeholder="Instructions shown at the top of the application form"
                      className="w-full p-3 text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-200 block">Thank-you text</label>
                    <textarea
                      value={closingText}
                      onChange={(e) => setClosingText(e.target.value)}
                      rows={2}
                      placeholder="Message shown to the applicant after submitting"
                      className="w-full p-3 text-xs bg-[#0E0E11] border border-white/[0.08] rounded-xl text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-200 block">Submit button label</label>
                      <Input
                        value={submitButtonText}
                        onChange={(e) => setSubmitButtonText(e.target.value)}
                        placeholder="Submit Application"
                        className="h-11 bg-[#0E0E11] border-white/[0.08] text-xs text-zinc-100 rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-200 block">Discord role on acceptance</label>
                      <RolePicker
                        serverId={currentGuildId}
                        value={autoRoleId}
                        onChange={setAutoRoleId}
                        placeholder="No automatic role"
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-200 block">Re-apply cooldown (days)</label>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={cooldownDays}
                        onChange={(e) => setCooldownDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="h-11 bg-[#0E0E11] border-white/[0.08] text-xs text-zinc-100 rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-200 block">Submission limit (optional)</label>
                      <Input
                        type="number"
                        min={1}
                        value={submissionLimit}
                        onChange={(e) => setSubmissionLimit(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1))}
                        placeholder="Unlimited"
                        className="h-11 bg-[#0E0E11] border-white/[0.08] text-xs text-zinc-100 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Link buttons */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-200">Header link buttons</label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddLinkButton}
                        className="h-7 px-2.5 rounded-full text-[11px] border-white/[0.08] bg-zinc-900 text-zinc-200"
                      >
                        <Plus className="size-3 mr-1" /> Add link
                      </Button>
                    </div>
                    {linkButtons.map((btn, bIdx) => (
                      <div key={bIdx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <Input
                          value={btn.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLinkButtons((prev) =>
                              prev.map((item, i) => (i === bIdx ? { ...item, label: val } : item))
                            );
                          }}
                          placeholder="Label (e.g. Rules)"
                          className="h-10 bg-[#0E0E11] border-white/[0.08] text-xs rounded-xl"
                        />
                        <Input
                          value={btn.url}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLinkButtons((prev) =>
                              prev.map((item, i) => (i === bIdx ? { ...item, url: val } : item))
                            );
                          }}
                          placeholder="https://..."
                          className="h-10 bg-[#0E0E11] border-white/[0.08] text-xs rounded-xl"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLinkButtons((prev) => prev.filter((_, i) => i !== bIdx))}
                          className="size-9 p-0 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Columns: Live Applicant Preview */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-3">
            <div className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <Eye className="size-3.5" />
              <span>Applicant preview</span>
            </div>

            <div className="p-5 bg-[#0E0E11] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="space-y-1 border-b border-white/[0.06] pb-3">
                <h3 className="text-base font-semibold text-zinc-100">
                  {formName.trim() || 'Untitled Form'}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {introText.trim() || 'Please answer the questions below to apply.'}
                </p>
              </div>

              <div className="space-y-3.5">
                {questions.map((q, i) => (
                  <div key={q.id} className="space-y-1.5 text-xs">
                    <label className="text-zinc-200 font-medium block">
                      {q.title || `Question ${i + 1}`}
                      {q.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {CHOICE_TYPES.has(q.type) ? (
                      <div className="space-y-1 pl-1">
                        {(q.options || []).map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2 text-zinc-400 text-[11px]">
                            <span className="size-3 rounded-full border border-white/20 inline-block" />
                            <span>{opt || `Option ${oIdx + 1}`}</span>
                          </div>
                        ))}
                      </div>
                    ) : q.type === 'long_text' ? (
                      <div className="h-14 p-2 rounded-lg bg-zinc-900/70 border border-white/[0.06] text-zinc-500 text-[11px]">
                        Long response…
                      </div>
                    ) : (
                      <div className="h-9 px-2.5 rounded-lg bg-zinc-900/70 border border-white/[0.06] text-zinc-500 text-[11px] flex items-center">
                        Short response…
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                disabled
                className="w-full h-10 text-xs rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold opacity-80"
              >
                {submitButtonText.trim() || 'Submit Application'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN VIEW (Tabs: Forms, Inbox, Settings)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6 pb-12 font-sans text-zinc-200">
      {/* Header */}
      <div className="space-y-1 pb-5 border-b border-white/[0.08]">
        <div className="text-xs text-zinc-500">Growth / Applications</div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Applications
        </h1>
        <p className="text-sm text-zinc-400">
          Create application forms for {serverName}, review submissions, and automatically assign Discord roles on acceptance.
        </p>
      </div>

      {/* Pill Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-[#18181B] border border-white/[0.08] rounded-full">
          <button
            type="button"
            onClick={() => setActiveTab('forms')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              activeTab === 'forms'
                ? 'bg-white text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Forms ({forms.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-white text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Inbox</span>
            {submissions.filter((s) => s.status === 'pending').length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeTab === 'inbox' ? 'bg-zinc-900 text-white' : 'bg-white/10 text-zinc-300'
                }`}
              >
                {submissions.filter((s) => s.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Settings
          </button>
        </div>

        {activeTab === 'forms' && (
          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreateForm}
            className="text-xs rounded-full px-4 h-9 bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="size-3.5" /> Create form
          </Button>
        )}
      </div>

      {/* TAB 1: FORMS LIST */}
      {activeTab === 'forms' && (
        <div className="space-y-4 pt-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              Loading forms…
            </div>
          ) : forms.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-2 border border-white/[0.08] rounded-2xl bg-[#121215]">
              <FileText className="size-6 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-200">No application forms yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Create your first form to accept staff applications, department sign-ups, or appeals.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleOpenCreateForm}
                className="mt-2 text-xs rounded-full px-4 h-8 bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold"
              >
                <Plus className="size-3.5 mr-1" /> Create form
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-2xl bg-[#121215] overflow-hidden">
              {forms.map((f) => {
                const publicUrl = `/${serverIdentifier}/${f.slug}`;
                const formOpen = f.isOpen !== false && f.status !== 'closed';
                return (
                  <div
                    key={f.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{f.name || f.title}</h3>
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            formOpen
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {formOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-zinc-200 hover:underline flex items-center gap-1"
                        >
                          <span>{domainHost}{publicUrl}</span>
                          <ExternalLink className="size-3" />
                        </a>
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-500">
                          {f.submissionCount ?? 0} submission{f.submissionCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + publicUrl);
                          addToast?.('info', 'Link Copied', 'Public form link copied to clipboard.');
                        }}
                        className="text-xs h-8 px-3 rounded-full text-zinc-400 hover:text-zinc-200"
                      >
                        <Copy className="size-3.5 mr-1" /> Copy link
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditForm(f)}
                        className="text-xs h-8 px-3 rounded-full text-zinc-400 hover:text-zinc-200"
                      >
                        <Edit2 className="size-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteForm(f.id)}
                        className="text-xs h-8 px-2.5 rounded-full text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INBOX */}
      {activeTab === 'inbox' && (
        <div className="space-y-4 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'accepted', 'denied', 'needs_info'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors capitalize cursor-pointer ${
                  statusFilter === filter
                    ? 'bg-white text-zinc-950 font-semibold border-white'
                    : 'bg-[#18181B] text-zinc-400 border-white/[0.08] hover:border-white/20'
                }`}
              >
                {filter.replace('_', ' ')}
              </button>
            ))}
          </div>

          {submissions.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-2 border border-white/[0.08] rounded-2xl bg-[#121215]">
              <InboxIcon className="size-6 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-200">No applications in inbox</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Submitted applications will appear here for staff review.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-2xl bg-[#121215] overflow-hidden">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {sub.applicantAvatar ? (
                      <img src={sub.applicantAvatar} alt="" className="size-9 rounded-full object-cover" />
                    ) : (
                      <div className="size-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-semibold">
                        {(sub.applicantDisplayName || 'U')[0]}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">{sub.applicantDisplayName}</span>
                        <span className="text-xs text-zinc-500">@{sub.applicantUsername}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span>{sub.formName}</span>
                        <span>·</span>
                        <span>{new Date(sub.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[11px] capitalize font-medium px-2.5 py-0.5 rounded-full ${
                        sub.status === 'accepted'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : sub.status === 'denied'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : sub.status === 'needs_info'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {sub.status.replace('_', ' ')}
                    </span>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSelectedSubmission(sub)}
                      className="text-xs rounded-full px-3.5 h-8 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/[0.08]"
                    >
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-2xl bg-[#121215] p-2">
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Automatic 90-day retention</span>
              <span className="text-xs text-zinc-400">
                Submissions older than 90 days are automatically pruned.
              </span>
            </div>
            <Switch checked={true} disabled />
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Discord account age check</span>
              <span className="text-xs text-zinc-400">
                Requires applicant Discord accounts to be at least 2 days old.
              </span>
            </div>
            <Switch checked={true} disabled />
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Single open submission per form</span>
              <span className="text-xs text-zinc-400">
                Prevents duplicate open applications from the same Discord user.
              </span>
            </div>
            <Switch checked={true} disabled />
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#121215] border border-white/[0.12] rounded-2xl p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                {selectedSubmission.applicantAvatar ? (
                  <img src={selectedSubmission.applicantAvatar} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-sm font-semibold">
                    {(selectedSubmission.applicantDisplayName || 'U')[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{selectedSubmission.applicantDisplayName}</h3>
                  <p className="text-xs text-zinc-500">
                    @{selectedSubmission.applicantUsername} · Account age: {selectedSubmission.applicantAccountAgeDays} days
                  </p>
                </div>
              </div>

              <span className="text-xs capitalize font-medium px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                {selectedSubmission.status.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-medium text-zinc-400">Responses</span>
              <div className="space-y-2.5">
                {Object.entries(selectedSubmission.answers || {}).map(([key, val]) => (
                  <div key={key} className="p-3 bg-[#0E0E11] border border-white/[0.06] rounded-xl space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">{key}</span>
                    <span className="text-xs text-zinc-200 block whitespace-pre-wrap">
                      {Array.isArray(val) ? val.join(', ') : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
              <label className="text-xs font-medium text-zinc-300 block">Staff note (optional)</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Note sent to the applicant via Discord DM…"
                rows={2}
                className="w-full text-xs p-2.5 bg-[#0E0E11] border border-white/[0.08] rounded-xl text-zinc-200 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSubmission(null)}
                className="text-xs rounded-full text-zinc-400"
              >
                Close
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={reviewing}
                  onClick={() => handleReviewSubmission('needs_info')}
                  className="text-xs rounded-full h-8 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  Ask for info
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={reviewing}
                  onClick={() => handleReviewSubmission('deny')}
                  className="text-xs rounded-full h-8 border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  Deny
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={reviewing}
                  onClick={() => handleReviewSubmission('accept')}
                  className="text-xs rounded-full h-8 px-4 bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold hover:opacity-90"
                >
                  Accept
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormsTab;
