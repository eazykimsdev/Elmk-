import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Shield,
  Eye,
  Link as LinkIcon,
  MessageSquare,
  Users,
  Settings,
  Inbox,
  Send,
  Flag,
  Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  label: string;
  description?: string;
  type: 'short_text' | 'long_text' | 'dropdown' | 'multiple_choice' | 'checkboxes' | 'number' | 'yes_no';
  required: boolean;
  options?: string[];
  min?: number | null;
  max?: number | null;
}

interface ExtraButton {
  label: string;
  url: string;
}

interface FormConfig {
  id?: string;
  name: string;
  slug: string;
  introText: string;
  closingMessage: string;
  submitButtonText: string;
  extraButtons: ExtraButton[];
  questions: Question[];
  isOpen: boolean;
  closeDate?: string | null;
  maxSubmissions?: number | null;
  denyCooldownDays?: number;
  roleRewardId?: string | null;
  isPartnershipForm?: boolean;
  submissionCount?: number;
  disabledByAdmin?: boolean;
  createdAt?: string;
}

interface Submission {
  id: string;
  formId: string;
  formName: string;
  applicantId: string;
  applicantUsername: string;
  applicantAvatar?: string | null;
  answers: Record<string, any>;
  status: 'pending' | 'accepted' | 'denied' | 'needs_info';
  staffNotes: Array<{
    id: string;
    author: string;
    content: string;
    action?: string;
    createdAt: string;
  }>;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  roleAssigned?: boolean;
  roleError?: string | null;
  dmDelivered?: boolean | null;
  createdAt: string;
}

interface FormsTabProps {
  currentGuildId: string;
  serverName: string;
  customUrl?: string | null;
  addToast?: (toast: { title: string; description?: string; type?: 'success' | 'error' | 'info' }) => void;
}

export function FormsTab({ currentGuildId, serverName, customUrl, addToast }: FormsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'forms' | 'inbox'>('forms');
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Builder State
  const [isEditing, setIsEditing] = useState(false);
  const [editingForm, setEditingForm] = useState<FormConfig | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  // Inbox State
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'denied' | 'needs_info'>('all');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Available Discord roles for role reward
  const [availableRoles, setAvailableRoles] = useState<Array<{ id: string; name: string }>>([]);

  const fetchForms = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/workspace/${currentGuildId}/forms`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load forms');
      setForms(data.forms || []);
    } catch (err: any) {
      setError(err.message || 'Error loading forms');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const res = await fetch(`/workspace/${currentGuildId}/submissions?status=${statusFilter}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setSubmissions(data.submissions || []);
      }
    } catch {}
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch(`/workspace/${currentGuildId}/roles`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.roles)) {
        setAvailableRoles(data.roles);
      }
    } catch {}
  };

  useEffect(() => {
    if (currentGuildId) {
      fetchForms();
      fetchSubmissions();
      fetchRoles();
    }
  }, [currentGuildId, statusFilter]);

  const handleStartNewForm = () => {
    setEditingForm({
      name: '',
      slug: '',
      introText: '',
      closingMessage: 'Thank you for your application! We will review it shortly.',
      submitButtonText: 'Submit Application',
      extraButtons: [],
      questions: [
        {
          id: `q_${Date.now()}_1`,
          label: 'Why would you like to join?',
          type: 'long_text',
          required: true
        }
      ],
      isOpen: true,
      denyCooldownDays: 7,
      roleRewardId: null,
      isPartnershipForm: false
    });
    setIsEditing(true);
    setShowPreview(false);
  };

  const handleEditForm = (form: FormConfig) => {
    setEditingForm(JSON.parse(JSON.stringify(form)));
    setIsEditing(true);
    setShowPreview(false);
  };

  const handleDeleteForm = async (formId: string) => {
    if (!window.confirm('Are you sure you want to delete this form? Submissions will be preserved.')) return;
    try {
      const res = await fetch(`/workspace/${currentGuildId}/forms/${formId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete form');
      addToast?.({ title: 'Form deleted successfully', type: 'success' });
      fetchForms();
    } catch (err: any) {
      addToast?.({ title: 'Could not delete form', description: err.message, type: 'error' });
    }
  };

  const handleSaveForm = async () => {
    if (!editingForm) return;
    if (!editingForm.name.trim()) {
      addToast?.({ title: 'Validation error', description: 'Form name is required', type: 'error' });
      return;
    }
    if (!editingForm.slug.trim()) {
      addToast?.({ title: 'Validation error', description: 'Short link name is required', type: 'error' });
      return;
    }
    if (editingForm.questions.length === 0) {
      addToast?.({ title: 'Validation error', description: 'At least one question is required', type: 'error' });
      return;
    }

    try {
      setSavingForm(true);
      const res = await fetch(`/workspace/${currentGuildId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editingForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save form');

      addToast?.({ title: 'Form published successfully', type: 'success' });
      setIsEditing(false);
      setEditingForm(null);
      fetchForms();
    } catch (err: any) {
      addToast?.({ title: 'Could not save form', description: err.message, type: 'error' });
    } finally {
      setSavingForm(false);
    }
  };

  const handleReviewSubmission = async (action: 'accept' | 'deny' | 'needs_info') => {
    if (!selectedSubmission) return;
    try {
      setReviewing(true);
      const res = await fetch(`/workspace/${currentGuildId}/submissions/${selectedSubmission.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, notes: reviewNote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');

      addToast?.({
        title: action === 'accept' ? 'Application Accepted' : action === 'deny' ? 'Application Denied' : 'Information Requested',
        description: data.roleAssigned ? 'Role assigned on Discord.' : data.dmDelivered ? 'Applicant notified via Discord DM.' : 'Applicant will see status upon login.',
        type: 'success'
      });

      setSelectedSubmission(null);
      setReviewNote('');
      fetchSubmissions();
    } catch (err: any) {
      addToast?.({ title: 'Could not complete review', description: err.message, type: 'error' });
    } finally {
      setReviewing(false);
    }
  };

  const serverIdentifier = customUrl || currentGuildId;

  return (
    <div className="space-y-6 max-w-6xl font-sans">
      {/* Tab Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Applications & Forms</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Build custom application forms for staff, partnerships, and community requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#121215] border border-white/[0.08] rounded-lg p-1">
            <button
              onClick={() => { setActiveSubTab('forms'); setIsEditing(false); }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                activeSubTab === 'forms' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <FileText className="size-3.5" />
              Forms ({forms.length})
            </button>
            <button
              onClick={() => { setActiveSubTab('inbox'); setIsEditing(false); }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                activeSubTab === 'inbox' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Inbox className="size-3.5" />
              Inbox ({submissions.filter(s => s.status === 'pending').length} pending)
            </button>
          </div>

          {activeSubTab === 'forms' && !isEditing && (
            <Button
              size="sm"
              onClick={handleStartNewForm}
              className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs h-8 gap-1.5"
            >
              <Plus className="size-3.5" />
              Create Form
            </Button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. FORMS LIST VIEW
         ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'forms' && !isEditing && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-zinc-500">Loading forms...</div>
          ) : error ? (
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs">{error}</div>
          ) : forms.length === 0 ? (
            <div className="p-12 text-center border border-white/[0.08] rounded-2xl bg-[#121215]">
              <FileText className="size-8 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white">No forms created yet</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
                Create your first application form for staff recruitment, partnerships, or ban appeals.
              </p>
              <Button size="sm" onClick={handleStartNewForm} className="bg-[var(--accent)] text-white text-xs">
                Create Form
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forms.map((form) => {
                const publicUrl = `/${serverIdentifier}/${form.slug}`;
                return (
                  <div
                    key={form.id}
                    className="p-5 rounded-2xl border border-white/[0.08] bg-[#121215] flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            {form.name}
                            {form.isPartnershipForm && (
                              <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-400 border-sky-500/20">
                                Partnership
                              </Badge>
                            )}
                          </h3>
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            /{serverIdentifier}/{form.slug}
                            <ExternalLink className="size-3" />
                          </a>
                        </div>

                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            form.isOpen && !form.disabledByAdmin
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          )}
                        >
                          {form.disabledByAdmin ? 'Disabled' : form.isOpen ? 'Open' : 'Closed'}
                        </Badge>
                      </div>

                      <p className="text-xs text-zinc-400 line-clamp-2 mt-2">
                        {form.introText || 'No introductory text configured.'}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-zinc-500 mt-4">
                        <span>{form.questions?.length || 0} questions</span>
                        <span>•</span>
                        <span>{form.submissionCount || 0} submissions</span>
                        {form.roleRewardId && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-400">Auto-role configured</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}${publicUrl}`);
                          addToast?.({ title: 'Link copied to clipboard', type: 'info' });
                        }}
                        className="text-xs h-7 text-zinc-400 hover:text-white"
                      >
                        <Share2 className="size-3 mr-1.5" />
                        Copy Link
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditForm(form)}
                          className="text-xs h-7 text-zinc-300 hover:text-white"
                        >
                          <Edit2 className="size-3 mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => form.id && handleDeleteForm(form.id)}
                          className="text-xs h-7 text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. FORM BUILDER & EDITOR
         ───────────────────────────────────────────────────────────── */}
      {isEditing && editingForm && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                className="text-xs text-zinc-400 hover:text-white h-8"
              >
                Cancel
              </Button>
              <h2 className="text-base font-semibold text-white">
                {editingForm.id ? `Edit Form: ${editingForm.name}` : 'New Application Form'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs border-white/[0.08] bg-[#121215] text-zinc-300 h-8 gap-1.5"
              >
                <Eye className="size-3.5" />
                {showPreview ? 'Exit Preview' : 'Interactive Preview'}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveForm}
                disabled={savingForm}
                className="bg-[var(--accent)] text-white text-xs font-medium h-8 px-4"
              >
                {savingForm ? 'Saving...' : 'Publish Form'}
              </Button>
            </div>
          </div>

          {showPreview ? (
            /* INTERACTIVE PREVIEW */
            <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#121215] max-w-xl mx-auto space-y-5">
              <div className="text-center pb-4 border-b border-white/[0.08]">
                <h2 className="text-lg font-bold text-white">{editingForm.name || 'Application Title'}</h2>
                <p className="text-xs text-zinc-400 mt-1">{editingForm.introText || 'Introductory note will appear here.'}</p>
                <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-300 text-[11px] mt-3">
                  ⚠️ Security Notice: Never share passwords, two-factor codes, bot tokens, or private sensitive information in applications.
                </div>
              </div>

              <div className="space-y-4">
                {editingForm.questions.map((q, idx) => (
                  <div key={q.id} className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-200 block">
                      {idx + 1}. {q.label} {q.required && <span className="text-rose-400">*</span>}
                    </label>
                    {q.description && <p className="text-[11px] text-zinc-500">{q.description}</p>}

                    {q.type === 'short_text' && (
                      <Input disabled placeholder="Short answer text" className="bg-black/20 border-white/[0.08] text-xs h-8" />
                    )}
                    {q.type === 'long_text' && (
                      <textarea disabled rows={3} placeholder="Paragraph answer text" className="w-full bg-black/20 border border-white/[0.08] rounded-md p-2 text-xs text-zinc-400" />
                    )}
                    {q.type === 'number' && (
                      <Input type="number" disabled placeholder="Numeric value" className="bg-black/20 border-white/[0.08] text-xs h-8" />
                    )}
                    {q.type === 'yes_no' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled className="text-xs h-7 border-white/[0.08]">Yes</Button>
                        <Button size="sm" variant="outline" disabled className="text-xs h-7 border-white/[0.08]">No</Button>
                      </div>
                    )}
                    {['dropdown', 'multiple_choice'].includes(q.type) && (
                      <div className="space-y-1">
                        {q.options?.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2 text-xs text-zinc-400">
                            <input type="radio" disabled />
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'checkboxes' && (
                      <div className="space-y-1">
                        {q.options?.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2 text-xs text-zinc-400">
                            <input type="checkbox" disabled />
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/[0.08] space-y-2">
                <Button disabled className="w-full bg-[var(--accent)] text-white text-xs">
                  {editingForm.submitButtonText || 'Submit Application'}
                </Button>
                {editingForm.extraButtons?.map((btn, bIdx) => (
                  <Button key={bIdx} variant="outline" disabled className="w-full border-white/[0.08] text-xs h-8">
                    {btn.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            /* BUILDER FORM */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Form Settings */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-white/[0.08] bg-[#121215] space-y-3">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">General Settings</h3>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Form Name *</label>
                    <Input
                      value={editingForm.name}
                      onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })}
                      placeholder="e.g. Staff Application"
                      className="bg-black/20 border-white/[0.08] text-xs h-8"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Short Link Slug *</label>
                    <div className="flex items-center rounded-md border border-white/[0.08] bg-black/20 px-2 h-8">
                      <span className="text-xs text-zinc-500">/{serverIdentifier}/</span>
                      <input
                        value={editingForm.slug}
                        onChange={(e) => setEditingForm({ ...editingForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        placeholder="staff-app"
                        className="bg-transparent border-0 text-xs text-white focus:outline-none w-full ml-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Introductory Message</label>
                    <textarea
                      rows={3}
                      value={editingForm.introText}
                      onChange={(e) => setEditingForm({ ...editingForm, introText: e.target.value })}
                      placeholder="Welcome! Please answer all questions accurately..."
                      className="w-full bg-black/20 border border-white/[0.08] rounded-md p-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Post-Submission Message</label>
                    <textarea
                      rows={2}
                      value={editingForm.closingMessage}
                      onChange={(e) => setEditingForm({ ...editingForm, closingMessage: e.target.value })}
                      placeholder="Thank you! We will review your answers soon."
                      className="w-full bg-black/20 border border-white/[0.08] rounded-md p-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                    <div>
                      <span className="text-xs text-white block">Form Open Status</span>
                      <span className="text-[10px] text-zinc-500">Accepting new submissions</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingForm.isOpen}
                      onChange={(e) => setEditingForm({ ...editingForm, isOpen: e.target.checked })}
                      className="rounded accent-[var(--accent)]"
                    />
                  </div>
                </div>

                {/* Automation & Discord Roles */}
                <div className="p-4 rounded-xl border border-white/[0.08] bg-[#121215] space-y-3">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Discord Role Automation</h3>
                  <p className="text-[11px] text-zinc-400">
                    Automatically award a Discord role when an applicant is accepted.
                  </p>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Role to Give Upon Acceptance</label>
                    <select
                      value={editingForm.roleRewardId || ''}
                      onChange={(e) => setEditingForm({ ...editingForm, roleRewardId: e.target.value || null })}
                      className="w-full bg-black/20 border border-white/[0.08] rounded-md p-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="">No automatic role</option>
                      {availableRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          @{r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2.5 rounded-lg border border-white/[0.06] bg-black/30 text-[11px] text-zinc-400 space-y-1">
                    <p className="font-semibold text-zinc-300">Bot Role Hierarchy Rule:</p>
                    <p>The bot requires the <strong>Manage Roles</strong> permission. In Server Settings &gt; Roles, drag the bot's highest role <strong>ABOVE</strong> the role it assigns. The bot never requires Administrator.</p>
                  </div>
                </div>

                {/* Extra Link Buttons */}
                <div className="p-4 rounded-xl border border-white/[0.08] bg-[#121215] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">External Link Buttons</h3>
                    <span className="text-[10px] text-zinc-500">{editingForm.extraButtons?.length || 0}/3</span>
                  </div>

                  {editingForm.extraButtons?.map((btn, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2">
                      <Input
                        value={btn.label}
                        onChange={(e) => {
                          const updated = [...editingForm.extraButtons];
                          updated[bIdx].label = e.target.value;
                          setEditingForm({ ...editingForm, extraButtons: updated });
                        }}
                        placeholder="Button Label"
                        className="bg-black/20 border-white/[0.08] text-xs h-7 flex-1"
                      />
                      <Input
                        value={btn.url}
                        onChange={(e) => {
                          const updated = [...editingForm.extraButtons];
                          updated[bIdx].url = e.target.value;
                          setEditingForm({ ...editingForm, extraButtons: updated });
                        }}
                        placeholder="https://"
                        className="bg-black/20 border-white/[0.08] text-xs h-7 flex-1"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const updated = editingForm.extraButtons.filter((_, idx) => idx !== bIdx);
                          setEditingForm({ ...editingForm, extraButtons: updated });
                        }}
                        className="h-7 w-7 p-0 text-rose-400"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}

                  {(editingForm.extraButtons?.length || 0) < 3 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const updated = [...(editingForm.extraButtons || []), { label: 'Discord Server', url: 'https://' }];
                        setEditingForm({ ...editingForm, extraButtons: updated });
                      }}
                      className="w-full text-xs border-dashed border-white/[0.1] text-zinc-400 h-7"
                    >
                      <Plus className="size-3 mr-1" /> Add Link Button (https only)
                    </Button>
                  )}
                </div>
              </div>

              {/* Right Columns: Question Builder */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Form Questions</h3>
                    <p className="text-xs text-zinc-400">Add up to 25 questions with diverse input types.</p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      if (editingForm.questions.length >= 25) {
                        addToast?.({ title: 'Limit reached', description: 'Maximum 25 questions per form', type: 'error' });
                        return;
                      }
                      const newQ: Question = {
                        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        label: 'New Question',
                        type: 'short_text',
                        required: true
                      };
                      setEditingForm({ ...editingForm, questions: [...editingForm.questions, newQ] });
                    }}
                    className="bg-white/10 hover:bg-white/15 text-white text-xs h-7 gap-1"
                  >
                    <Plus className="size-3" /> Add Question
                  </Button>
                </div>

                <div className="space-y-3">
                  {editingForm.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-white/[0.08] bg-[#121215] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-[var(--accent)]">Question {idx + 1}</span>

                        <div className="flex items-center gap-1">
                          {/* Reorder Up */}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={idx === 0}
                            onClick={() => {
                              const updated = [...editingForm.questions];
                              const temp = updated[idx];
                              updated[idx] = updated[idx - 1];
                              updated[idx - 1] = temp;
                              setEditingForm({ ...editingForm, questions: updated });
                            }}
                            className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                          >
                            <ChevronUp className="size-3.5" />
                          </Button>

                          {/* Reorder Down */}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={idx === editingForm.questions.length - 1}
                            onClick={() => {
                              const updated = [...editingForm.questions];
                              const temp = updated[idx];
                              updated[idx] = updated[idx + 1];
                              updated[idx + 1] = temp;
                              setEditingForm({ ...editingForm, questions: updated });
                            }}
                            className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                          >
                            <ChevronDown className="size-3.5" />
                          </Button>

                          {/* Delete Question */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const updated = editingForm.questions.filter((_, qIdx) => qIdx !== idx);
                              setEditingForm({ ...editingForm, questions: updated });
                            }}
                            className="h-6 w-6 p-0 text-rose-400 hover:text-rose-300 ml-1"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-zinc-400 block mb-1">Question Text</label>
                          <Input
                            value={q.label}
                            onChange={(e) => {
                              const updated = [...editingForm.questions];
                              updated[idx].label = e.target.value;
                              setEditingForm({ ...editingForm, questions: updated });
                            }}
                            placeholder="e.g. Why should we select you?"
                            className="bg-black/20 border-white/[0.08] text-xs h-8"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1">Answer Type</label>
                          <select
                            value={q.type}
                            onChange={(e) => {
                              const updated = [...editingForm.questions];
                              updated[idx].type = e.target.value as any;
                              if (['dropdown', 'multiple_choice', 'checkboxes'].includes(e.target.value) && !updated[idx].options) {
                                updated[idx].options = ['Option 1', 'Option 2'];
                              }
                              setEditingForm({ ...editingForm, questions: updated });
                            }}
                            className="w-full bg-black/20 border border-white/[0.08] rounded-md p-1.5 text-xs text-white focus:outline-none h-8"
                          >
                            <option value="short_text">Short Text</option>
                            <option value="long_text">Paragraph Text</option>
                            <option value="number">Numeric Value</option>
                            <option value="yes_no">Yes / No</option>
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="dropdown">Dropdown Selection</option>
                            <option value="checkboxes">Checkboxes (Multi-select)</option>
                          </select>
                        </div>
                      </div>

                      {/* Options editor for choice types */}
                      {['dropdown', 'multiple_choice', 'checkboxes'].includes(q.type) && (
                        <div className="p-3 rounded-lg border border-white/[0.06] bg-black/20 space-y-2">
                          <label className="text-[11px] text-zinc-400 block font-medium">Choices / Options</label>
                          {q.options?.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...editingForm.questions];
                                  if (!updated[idx].options) updated[idx].options = [];
                                  updated[idx].options![oIdx] = e.target.value;
                                  setEditingForm({ ...editingForm, questions: updated });
                                }}
                                placeholder={`Option ${oIdx + 1}`}
                                className="bg-black/20 border-white/[0.08] text-xs h-7 flex-1"
                              />
                              {(q.options?.length || 0) > 2 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const updated = [...editingForm.questions];
                                    updated[idx].options = updated[idx].options!.filter((_, i) => i !== oIdx);
                                    setEditingForm({ ...editingForm, questions: updated });
                                  }}
                                  className="h-7 w-7 p-0 text-zinc-500 hover:text-rose-400"
                                >
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const updated = [...editingForm.questions];
                              if (!updated[idx].options) updated[idx].options = [];
                              updated[idx].options!.push(`Option ${updated[idx].options!.length + 1}`);
                              setEditingForm({ ...editingForm, questions: updated });
                            }}
                            className="text-[11px] text-[var(--accent)] hover:text-[var(--accent)] h-6 p-0"
                          >
                            + Add Option
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) => {
                              const updated = [...editingForm.questions];
                              updated[idx].required = e.target.checked;
                              setEditingForm({ ...editingForm, questions: updated });
                            }}
                            className="rounded accent-[var(--accent)]"
                          />
                          Required question
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MANAGER SUBMISSIONS INBOX
         ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'inbox' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(['all', 'pending', 'accepted', 'denied', 'needs_info'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-all capitalize',
                    statusFilter === st
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)] font-medium'
                      : 'border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={fetchSubmissions}
              className="text-xs text-zinc-400 hover:text-white h-7"
            >
              Refresh Inbox
            </Button>
          </div>

          {submissions.length === 0 ? (
            <div className="p-12 text-center border border-white/[0.08] rounded-2xl bg-[#121215]">
              <Inbox className="size-8 text-zinc-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white">No submissions found</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                {statusFilter === 'all'
                  ? 'No applications have been submitted to your community forms yet.'
                  : `No applications with status "${statusFilter}" found.`}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#121215] overflow-hidden">
              <div className="divide-y divide-white/[0.06]">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedSubmission(sub)}
                    className="p-4 hover:bg-white/[0.02] cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-white overflow-hidden shrink-0">
                        {sub.applicantAvatar ? (
                          <img src={sub.applicantAvatar} alt={sub.applicantUsername} className="size-full object-cover" />
                        ) : (
                          sub.applicantUsername.slice(0, 2).toUpperCase()
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white">{sub.applicantUsername}</span>
                          <span className="text-[11px] text-zinc-500 font-mono">({sub.applicantId})</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Applied for: {sub.formName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] capitalize',
                          sub.status === 'pending' && 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                          sub.status === 'accepted' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                          sub.status === 'denied' && 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                          sub.status === 'needs_info' && 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        )}
                      >
                        {sub.status.replace('_', ' ')}
                      </Badge>

                      <span className="text-[11px] text-zinc-500">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBMISSION REVIEW MODAL */}
          {selectedSubmission && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#121215] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-white overflow-hidden">
                      {selectedSubmission.applicantAvatar ? (
                        <img src={selectedSubmission.applicantAvatar} alt={selectedSubmission.applicantUsername} className="size-full object-cover" />
                      ) : (
                        selectedSubmission.applicantUsername.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{selectedSubmission.applicantUsername}</h3>
                      <p className="text-[11px] text-zinc-400">{selectedSubmission.formName} • Submitted {new Date(selectedSubmission.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <Button size="sm" variant="ghost" onClick={() => setSelectedSubmission(null)} className="h-7 w-7 p-0 text-zinc-400 hover:text-white">
                    <X className="size-4" />
                  </Button>
                </div>

                {/* Modal Content */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
                  {/* Answers Display */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Applicant Answers</h4>
                    {Object.entries(selectedSubmission.answers || {}).map(([qId, ans]) => (
                      <div key={qId} className="p-3 rounded-lg border border-white/[0.06] bg-black/20 space-y-1">
                        <span className="text-[11px] text-zinc-500 block">Question {qId}</span>
                        <div className="text-xs text-zinc-200 whitespace-pre-wrap">
                          {Array.isArray(ans) ? ans.join(', ') : String(ans ?? 'No answer provided')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Staff Notes History */}
                  {selectedSubmission.staffNotes?.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                      <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Staff Notes</h4>
                      {selectedSubmission.staffNotes.map((note) => (
                        <div key={note.id} className="p-2.5 rounded-lg border border-white/[0.04] bg-white/[0.02] text-xs">
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                            <span>{note.author}</span>
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-zinc-300">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Review Actions */}
                  <div className="pt-3 border-t border-white/[0.08] space-y-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Staff Note / Feedback (sent to applicant via DM & on site)</label>
                      <textarea
                        rows={2}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Add reason for approval, denial, or details needed..."
                        className="w-full bg-black/30 border border-white/[0.08] rounded-md p-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={reviewing}
                        onClick={() => handleReviewSubmission('needs_info')}
                        className="bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs h-8"
                      >
                        Ask for Info
                      </Button>
                      <Button
                        size="sm"
                        disabled={reviewing}
                        onClick={() => handleReviewSubmission('deny')}
                        className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs h-8"
                      >
                        Deny Application
                      </Button>
                      <Button
                        size="sm"
                        disabled={reviewing}
                        onClick={() => handleReviewSubmission('accept')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 font-medium px-4"
                      >
                        Accept Application
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
