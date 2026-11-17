import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Clock,
  User,
  Shield,
  AlertCircle,
  Eye,
  ArrowLeft,
  Settings as SettingsIcon,
  Inbox as InboxIcon,
  Sparkles,
  Link as LinkIcon,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api';

interface Question {
  id: string;
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
  slug: string;
  isOpen: boolean;
  closeDate?: string | null;
  submissionLimit?: number | null;
  introText?: string;
  closingText?: string;
  submitButtonText?: string;
  linkButtons?: LinkButton[];
  autoRoleId?: string | null;
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
  const [savingForm, setSavingForm] = useState(false);

  // Inbox & Review State
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'denied' | 'needs_info'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Available Discord roles for auto-role
  const [availableRoles, setAvailableRoles] = useState<Array<{ id: string; name: string }>>([]);

  // Load Forms
  const loadForms = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/workspace/${currentGuildId}/forms`);
      if (res.ok) {
        const data = await res.json();
        setForms(data.forms || []);
      }
    } catch (err: any) {
      console.warn('[FORMS] Load failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentGuildId]);

  // Load Submissions Inbox
  const loadSubmissions = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      const res = await apiFetch(`/workspace/${currentGuildId}/submissions?status=${statusFilter}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err: any) {
      console.warn('[SUBMISSIONS] Load failed:', err.message);
    }
  }, [currentGuildId, statusFilter]);

  // Load Roles
  const loadRoles = useCallback(async () => {
    if (!currentGuildId) return;
    try {
      const res = await apiFetch(`/workspace/${currentGuildId}/roles`);
      if (res.ok) {
        const data = await res.json();
        setAvailableRoles(data.roles || []);
      }
    } catch {}
  }, [currentGuildId]);

  useEffect(() => {
    loadForms();
    loadRoles();
  }, [loadForms, loadRoles]);

  useEffect(() => {
    if (activeTab === 'inbox') {
      loadSubmissions();
    }
  }, [activeTab, loadSubmissions]);

  // Open Builder for new form
  const handleOpenCreateForm = () => {
    setEditingFormId(null);
    setFormName('');
    setFormSlug('');
    setIsOpen(true);
    setQuestions([
      { id: 'q_' + Date.now(), title: 'Why do you want to join our team?', type: 'long_text', required: true }
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

  // Open Builder for existing form
  const handleEditForm = (form: FormConfig) => {
    setEditingFormId(form.id);
    setFormName(form.name);
    setFormSlug(form.slug);
    setIsOpen(form.isOpen);
    setQuestions(form.questions && form.questions.length ? form.questions : [
      { id: 'q_' + Date.now(), title: 'Why do you want to join our team?', type: 'long_text', required: true }
    ]);
    setIntroText(form.introText || '');
    setClosingText(form.closingText || '');
    setSubmitButtonText(form.submitButtonText || 'Submit Application');
    setLinkButtons(form.linkButtons || []);
    setAutoRoleId(form.autoRoleId || '');
    setCooldownDays(form.cooldownDays ?? 7);
    setSubmissionLimit(form.submissionLimit ?? '');
    setShowMoreOptions(false);
    setIsBuilderOpen(true);
  };

  // Delete form
  const handleDeleteForm = async (formId: string) => {
    if (!window.confirm('Are you sure you want to delete this application form?')) return;
    try {
      const res = await apiFetch(`/workspace/${currentGuildId}/forms/${formId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete form');
      addToast?.('success', 'Form Deleted', 'Application form deleted successfully.');
      loadForms();
    } catch (err: any) {
      addToast?.('error', 'Delete Failed', err.message);
    }
  };

  // Save & Publish Form
  const handleSaveForm = async () => {
    const cleanName = formName.trim();
    const cleanSlug = formSlug.trim().toLowerCase();
    if (!cleanName) {
      addToast?.('error', 'Validation Error', 'Form name is required.');
      return;
    }
    if (!cleanSlug) {
      addToast?.('error', 'Validation Error', 'Link name is required.');
      return;
    }
    if (questions.length === 0) {
      addToast?.('error', 'Validation Error', 'Please include at least one question.');
      return;
    }

    setSavingForm(true);
    try {
      const payload = {
        id: editingFormId || undefined,
        name: cleanName,
        slug: cleanSlug,
        isOpen,
        questions,
        introText: introText.trim(),
        closingText: closingText.trim(),
        submitButtonText: submitButtonText.trim() || 'Submit Application',
        linkButtons,
        autoRoleId: autoRoleId || null,
        cooldownDays: Number(cooldownDays) || 7,
        submissionLimit: submissionLimit === '' ? null : Number(submissionLimit)
      };

      const res = await apiFetch(`/workspace/${currentGuildId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save form');

      addToast?.('success', 'Form Published', `Application form "${cleanName}" is ready.`);
      setIsBuilderOpen(false);
      loadForms();
    } catch (err: any) {
      addToast?.('error', 'Save Failed', err.message);
    } finally {
      setSavingForm(false);
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
      addToast?.('error', 'Review Failed', err.message);
    } finally {
      setReviewing(false);
    }
  };

  // Question manipulation
  const handleAddQuestion = () => {
    if (questions.length >= 25) {
      addToast?.('warning', 'Limit Reached', 'Maximum 25 questions per form.');
      return;
    }
    const newQ: Question = {
      id: 'q_' + Date.now(),
      title: 'New Question',
      type: 'short_text',
      required: true
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) return;
    setQuestions(prev => {
      const arr = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      const temp = arr[index];
      arr[index] = arr[target];
      arr[target] = temp;
      return arr;
    });
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const serverIdentifier = customUrl || currentGuildId;

  // ─────────────────────────────────────────────────────────────────────────────
  // FULL PAGE BUILDER VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (isBuilderOpen) {
    return (
      <div className="w-full max-w-[1100px] mx-auto space-y-6 pb-16 font-sans">
        {/* Builder Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsBuilderOpen(false)}
              className="size-8 p-0 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">
                {editingFormId ? 'Edit Application Form' : 'Create Application Form'}
              </h1>
              <p className="text-xs text-zinc-400">
                Configure your questions, publishing link, and review automation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsBuilderOpen(false)}
              disabled={savingForm}
              className="text-xs rounded-full text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingForm}
              onClick={handleSaveForm}
              className="text-xs rounded-full px-5 h-8 bg-white hover:bg-zinc-100 text-zinc-950 font-semibold shadow-sm"
            >
              {savingForm ? 'Saving...' : 'Save & Publish'}
            </Button>
          </div>
        </div>

        {/* 2-Column Desktop Grid / Stacked Mobile Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Editor (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Form Basic Info */}
            <div className="p-5 bg-[#121214] border border-white/[0.08] rounded-2xl space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-200">Form Name</label>
                <Input
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!formSlug) {
                      setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                    }
                  }}
                  placeholder="e.g. Staff Application, Partnership Request, Ban Appeal"
                  className="bg-black/40 border-white/[0.08] text-xs text-zinc-100 h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-200">Short Link Name</label>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-black/40 border border-white/[0.08] px-3 h-9 rounded-md">
                  <span className="text-zinc-500">connectingerlc.xyz/{serverIdentifier}/</span>
                  <input
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="staff"
                    className="bg-transparent border-none text-zinc-100 focus:outline-none flex-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">Open for Submissions</span>
                  <span className="text-[11px] text-zinc-400">Accept new applications immediately</span>
                </div>
                <Switch checked={isOpen} onCheckedChange={setIsOpen} />
              </div>
            </div>

            {/* Questions Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">Questions</h3>
                  <span className="text-[11px] text-zinc-400">{questions.length} of 25 maximum questions</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddQuestion}
                  className="text-xs rounded-full h-7 px-3 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.08]"
                >
                  <Plus className="size-3 mr-1" /> Add Question
                </Button>
              </div>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 bg-[#121214] border border-white/[0.08] rounded-2xl space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-semibold text-zinc-500 w-5">
                        #{idx + 1}
                      </span>
                      <Input
                        value={q.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, title: val } : item));
                        }}
                        placeholder="Question title"
                        className="bg-black/40 border-white/[0.08] text-xs h-8 flex-1"
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={idx === 0}
                          onClick={() => handleMoveQuestion(idx, 'up')}
                          className="size-7 p-0 rounded-lg text-zinc-400 hover:text-zinc-200"
                        >
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={idx === questions.length - 1}
                          onClick={() => handleMoveQuestion(idx, 'down')}
                          className="size-7 p-0 rounded-lg text-zinc-400 hover:text-zinc-200"
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="size-7 p-0 rounded-lg text-zinc-400 hover:text-rose-400"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-zinc-400">Type:</label>
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, type: val } : item));
                          }}
                          className="bg-black/40 border border-white/[0.08] text-xs text-zinc-200 rounded px-2 py-1 focus:outline-none"
                        >
                          <option value="short_text">Short Text</option>
                          <option value="long_text">Long Text</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="checkboxes">Checkboxes</option>
                          <option value="number">Number</option>
                          <option value="yes_no">Yes or No</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, required: val } : item));
                          }}
                          className="rounded border-zinc-700 bg-zinc-900 text-[var(--accent)]"
                        />
                        <span>Required</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Collapsed "More Options" Section */}
            <div className="p-5 bg-[#121214] border border-white/[0.08] rounded-2xl space-y-4">
              <button
                type="button"
                onClick={() => setShowMoreOptions(prev => !prev)}
                className="w-full flex items-center justify-between text-xs font-semibold text-zinc-200"
              >
                <span>More options (Roles, Links, Intro, Thank you message)</span>
                <ChevronDown className={`size-4 text-zinc-400 transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} />
              </button>

              {showMoreOptions && (
                <div className="space-y-4 pt-3 border-t border-white/[0.06]">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Intro Message</label>
                    <textarea
                      value={introText}
                      onChange={(e) => setIntroText(e.target.value)}
                      rows={2}
                      placeholder="Introductory instructions shown at top of the form"
                      className="w-full p-2.5 text-xs bg-black/40 border border-white/[0.08] rounded-lg text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Closing / Thank You Message</label>
                    <textarea
                      value={closingText}
                      onChange={(e) => setClosingText(e.target.value)}
                      rows={2}
                      placeholder="Message displayed after submission"
                      className="w-full p-2.5 text-xs bg-black/40 border border-white/[0.08] rounded-lg text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-300">Discord Role on Acceptance</label>
                      <select
                        value={autoRoleId}
                        onChange={(e) => setAutoRoleId(e.target.value)}
                        className="w-full p-2 text-xs bg-black/40 border border-white/[0.08] rounded-lg text-zinc-200 focus:outline-none"
                      >
                        <option value="">No automatic role</option>
                        {availableRoles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-300">Denial Cooldown (Days)</label>
                      <Input
                        type="number"
                        value={cooldownDays}
                        onChange={(e) => setCooldownDays(parseInt(e.target.value, 10) || 0)}
                        className="bg-black/40 border-white/[0.08] text-xs h-8"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Form Preview (lg:col-span-5) */}
          <div className="lg:col-span-5 sticky top-6 space-y-3">
            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Eye className="size-3.5" /> Live Applicant Preview
            </span>

            <div className="p-6 bg-[#0E0E10] border border-white/[0.1] rounded-2xl space-y-5 shadow-xl">
              <div className="text-center space-y-1">
                <h2 className="text-base font-semibold text-zinc-100">
                  {formName.trim() || 'Untitled Application Form'}
                </h2>
                <p className="text-xs text-zinc-400">
                  {introText.trim() || 'Please answer all questions below to apply.'}
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {questions.map((q, i) => (
                  <div key={q.id} className="space-y-1 text-xs">
                    <label className="text-zinc-300 font-medium">
                      {q.title || `Question ${i + 1}`}
                      {q.required && <span className="text-rose-400 ml-1">*</span>}
                    </label>
                    {q.type === 'long_text' ? (
                      <div className="h-16 p-2 rounded-lg bg-black/30 border border-white/[0.06] text-zinc-500 text-[11px]">
                        Applicant will write long answer here...
                      </div>
                    ) : (
                      <div className="h-8 p-2 rounded-lg bg-black/30 border border-white/[0.06] text-zinc-500 text-[11px] flex items-center">
                        Applicant short response...
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                disabled
                className="w-full text-xs h-9 rounded-full bg-white text-zinc-950 font-semibold"
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
    <div className="w-full max-w-[1100px] mx-auto space-y-6 pb-12 font-sans">
      {/* Header following Greed aesthetic */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Applications
        </h1>
        <p className="text-sm text-zinc-400">
          Build custom application forms for {serverName}, review candidate submissions, and automate Discord onboarding.
        </p>
      </div>

      {/* Thin divider */}
      <div className="border-b border-white/[0.08]" />

      {/* Tabs in one rounded pill group */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-[#18181B] border border-white/[0.08] rounded-full">
          <button
            type="button"
            onClick={() => setActiveTab('forms')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === 'forms'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Forms ({forms.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
              activeTab === 'inbox'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Inbox</span>
            {submissions.filter(s => s.status === 'pending').length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'inbox' ? 'bg-zinc-900 text-white' : 'bg-white/10 text-zinc-300'
              }`}>
                {submissions.filter(s => s.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === 'settings'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
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
            className="text-xs rounded-full px-4 h-8 bg-white hover:bg-zinc-100 text-zinc-950 font-semibold shadow-sm flex items-center gap-1.5"
          >
            <Plus className="size-3.5" /> Create form
          </Button>
        )}
      </div>

      {/* ─── TAB 1: FORMS LIST ─── */}
      {activeTab === 'forms' && (
        <div className="space-y-4 pt-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-zinc-400">
              <div className="size-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <span>Loading forms...</span>
            </div>
          ) : forms.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-white/10 rounded-2xl">
              <FileText className="size-8 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-200">No application forms yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Create your first form to start accepting staff applications, partnerships, or ban appeals.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleOpenCreateForm}
                className="mt-3 text-xs rounded-full px-4 h-8 bg-white text-zinc-950 font-semibold"
              >
                <Plus className="size-3.5 mr-1" /> Create form
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-2xl bg-[#121214] overflow-hidden">
              {forms.map((f) => {
                const publicUrl = `/${serverIdentifier}/${f.slug}`;
                return (
                  <div
                    key={f.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{f.name}</h3>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          f.isOpen ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {f.isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                        <a
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-zinc-200 hover:underline flex items-center gap-1"
                        >
                          {publicUrl} <ExternalLink className="size-3" />
                        </a>
                        <span className="text-zinc-600 font-sans">•</span>
                        <span className="font-sans text-zinc-500">
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
                        className="text-xs h-8 px-2.5 rounded-full text-zinc-500 hover:text-rose-400"
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

      {/* ─── TAB 2: INBOX ─── */}
      {activeTab === 'inbox' && (
        <div className="space-y-4 pt-2">
          {/* Status Filters */}
          <div className="flex items-center gap-2">
            {(['all', 'pending', 'accepted', 'denied', 'needs_info'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors capitalize ${
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
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-white/10 rounded-2xl">
              <InboxIcon className="size-8 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-200">No applications in inbox</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Applications submitted by community members will appear here for staff review.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-2xl bg-[#121214] overflow-hidden">
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
                        {sub.applicantDisplayName[0]}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">{sub.applicantDisplayName}</span>
                        <span className="text-xs text-zinc-500">@{sub.applicantUsername}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span>{sub.formName}</span>
                        <span>•</span>
                        <span>{new Date(sub.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] uppercase font-semibold px-2.5 py-0.5 rounded-full ${
                      sub.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      sub.status === 'denied' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      sub.status === 'needs_info' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-zinc-800 text-zinc-300'
                    }`}>
                      {sub.status.replace('_', ' ')}
                    </span>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSelectedSubmission(sub)}
                      className="text-xs rounded-full px-3.5 h-7 bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 border border-white/[0.08]"
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

      {/* ─── TAB 3: SETTINGS (Greed style rows) ─── */}
      {activeTab === 'settings' && (
        <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-2xl bg-[#121214] p-2">
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Automatic 90-Day Retention</span>
              <span className="text-[11px] text-zinc-400">Answers older than 90 days are safely pruned to preserve database hygiene.</span>
            </div>
            <Switch checked={true} disabled />
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Discord Account Age Protection</span>
              <span className="text-[11px] text-zinc-400">Requires applicant Discord accounts to be at least 2 days old to block newly created alts.</span>
            </div>
            <Switch checked={true} disabled />
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">One Open Application Rule</span>
              <span className="text-[11px] text-zinc-400">Applicants can only have one active open application per form at a time.</span>
            </div>
            <Switch checked={true} disabled />
          </div>
        </div>
      )}

      {/* ─── REVIEW MODAL ─── */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#121214] border border-white/[0.12] rounded-2xl p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                {selectedSubmission.applicantAvatar ? (
                  <img src={selectedSubmission.applicantAvatar} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-sm font-semibold">
                    {selectedSubmission.applicantDisplayName[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{selectedSubmission.applicantDisplayName}</h3>
                  <p className="text-xs text-zinc-500">
                    @{selectedSubmission.applicantUsername} • Account Age: {selectedSubmission.applicantAccountAgeDays} days
                  </p>
                </div>
              </div>

              <span className={`text-[10px] uppercase font-semibold px-2.5 py-0.5 rounded-full ${
                selectedSubmission.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                selectedSubmission.status === 'denied' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                'bg-zinc-800 text-zinc-300'
              }`}>
                {selectedSubmission.status}
              </span>
            </div>

            {/* Answers */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Responses</span>
              <div className="space-y-3">
                {Object.entries(selectedSubmission.answers || {}).map(([key, val]) => (
                  <div key={key} className="p-3 bg-black/40 border border-white/[0.06] rounded-xl space-y-1">
                    <span className="text-xs font-medium text-zinc-400 block">{key}</span>
                    <span className="text-xs text-zinc-200 block whitespace-pre-wrap">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff note input */}
            <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
              <label className="text-xs font-semibold text-zinc-300">Staff Note (Optional)</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Reason or feedback sent in Components V2 DM to applicant..."
                rows={2}
                className="w-full text-xs p-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-zinc-200 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
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
                  className="text-xs rounded-full h-8 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                >
                  Deny
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={reviewing}
                  onClick={() => handleReviewSubmission('accept')}
                  className="text-xs rounded-full h-8 px-4 bg-white text-zinc-950 font-semibold hover:bg-zinc-100"
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
