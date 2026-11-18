import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { query, isPostgresConnected } from './db.js';
import { getPromotedServers } from './directoryManager.js';
import { normalizeLeet, getLeetVariants, RESERVED_WORDS, loadBlockedWords, resolveCustomUrl } from './customUrlManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

const FORMS_FILE = path.join(DATA_DIR, 'community_forms.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'form_submissions.json');
const REPORTS_FILE = path.join(DATA_DIR, 'form_reports.json');

export const MAX_FORMS_PER_SERVER = 10;
export const MAX_QUESTIONS_PER_FORM = 25;
export const MAX_ANSWER_LENGTH = 2000;
export const DEFAULT_RETENTION_DAYS = 90;
export const MIN_ACCOUNT_AGE_DAYS = 2;

export const QUESTION_TYPES = new Set([
  'short_text',
  'long_text',
  'dropdown',
  'multiple_choice',
  'checkboxes',
  'number',
  'yes_no',
  'page_break'
]);

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FORMS_FILE)) fs.writeFileSync(FORMS_FILE, JSON.stringify([], null, 2), 'utf8');
  if (!fs.existsSync(SUBMISSIONS_FILE)) fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2), 'utf8');
  if (!fs.existsSync(REPORTS_FILE)) fs.writeFileSync(REPORTS_FILE, JSON.stringify([], null, 2), 'utf8');
}

ensureFiles();

export function loadForms() {
  try {
    return JSON.parse(fs.readFileSync(FORMS_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

export function saveForms(data) {
  try {
    fs.writeFileSync(FORMS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[FORMS] Failed to save community_forms.json:', err.message);
  }
}

export function loadSubmissions() {
  try {
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

export function saveSubmissions(data) {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[FORMS] Failed to save form_submissions.json:', err.message);
  }
}

export function loadFormReports() {
  try {
    return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

export function saveFormReports(data) {
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[FORMS] Failed to save form_reports.json:', err.message);
  }
}

/**
 * HTML and XSS sanitization
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Validate form slug against blocked words, reserved routes, and leet lookalikes
 */
export function validateFormSlug(rawSlug) {
  if (!rawSlug || typeof rawSlug !== 'string') {
    return { valid: false, error: 'Short link name is required.' };
  }
  const slug = rawSlug.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 32) {
    return { valid: false, error: 'Short link name must be between 3 and 32 characters.' };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) {
    return { valid: false, error: 'Short link name must contain only lowercase letters, numbers, and hyphens.' };
  }

  // Check reserved route words
  if (RESERVED_WORDS.has(slug)) {
    return { valid: false, error: `The short name "${slug}" is reserved and cannot be used.` };
  }

  // Check blocked words & leet lookalikes (excluding community role terms like staff/moderator/support which are valid form categories)
  const allowedFormTerms = new Set(['staff', 'moderator', 'administrator', 'support']);
  const variants = getLeetVariants(slug);
  const blockedList = loadBlockedWords().filter(w => !allowedFormTerms.has(w.toLowerCase()));
  for (const blocked of blockedList) {
    const bVariants = getLeetVariants(blocked);
    for (const bVar of bVariants) {
      if (!bVar) continue;
      for (const nVar of variants) {
        if (nVar.includes(bVar) || slug.includes(blocked.toLowerCase())) {
          return { valid: false, error: `The short name "${slug}" contains blocked or restricted words.` };
        }
      }
    }
  }

  return { valid: true, cleanSlug: slug };
}

/**
 * Validate extra link buttons (https only, max 3)
 */
export function validateButtons(buttons) {
  if (!Array.isArray(buttons)) return [];
  const clean = [];
  for (const btn of buttons.slice(0, 3)) {
    if (!btn || typeof btn !== 'object') continue;
    const label = sanitizeText(String(btn.label || '').slice(0, 50));
    const url = String(btn.url || '').trim();
    if (!label || !url) continue;
    if (!url.startsWith('https://')) {
      throw new Error(`Button "${label}" URL must start with https://`);
    }
    clean.push({ label, url });
  }
  return clean;
}

/**
 * Validate questions list
 */
export function validateQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  if (questions.length > MAX_QUESTIONS_PER_FORM) {
    throw new Error(`A form cannot have more than ${MAX_QUESTIONS_PER_FORM} questions.`);
  }

  return questions.map((q, idx) => {
    if (!q || typeof q !== 'object') throw new Error(`Question ${idx + 1} is invalid.`);
    const type = String(q.type || 'short_text').toLowerCase();
    if (!QUESTION_TYPES.has(type)) {
      throw new Error(`Question ${idx + 1} has an invalid type "${type}".`);
    }

    if (type === 'page_break') {
      const pageTitle = sanitizeText(String(q.label || q.title || 'Page Break').slice(0, 100));
      return {
        id: q.id || `pb_${Date.now()}_${randomBytes(3).toString('hex')}`,
        label: pageTitle,
        title: pageTitle,
        type: 'page_break',
        required: false,
        options: []
      };
    }

    const label = sanitizeText(String(q.label || q.title || '').slice(0, 300));
    if (!label) throw new Error(`Question ${idx + 1} must have question text.`);

    const description = sanitizeText(String(q.description || '').slice(0, 500));
    const required = Boolean(q.required);

    let options = [];
    if (['dropdown', 'multiple_choice', 'checkboxes'].includes(type)) {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`Question "${label}" must have at least 2 options.`);
      }
      options = q.options.slice(0, 20).map(opt => sanitizeText(String(opt).slice(0, 100))).filter(Boolean);
      if (options.length < 2) {
        throw new Error(`Question "${label}" must have at least 2 valid options.`);
      }
    }

    return {
      id: q.id || `q_${Date.now()}_${randomBytes(3).toString('hex')}`,
      label,
      title: label,
      description,
      type,
      required,
      options,
      min: typeof q.min === 'number' ? q.min : null,
      max: typeof q.max === 'number' ? q.max : null
    };
  });
}

/**
 * Create or update a form for a server
 */
export async function createOrUpdateForm(serverId, formData, userId) {
  const sid = String(serverId);
  const uid = String(userId);
  const now = Date.now();

  const forms = loadForms();
  const serverForms = forms.filter(f => String(f.serverId) === sid && !f.deleted);

  const slugVal = validateFormSlug(formData.slug);
  if (!slugVal.valid) {
    throw new Error(slugVal.error);
  }
  const cleanSlug = slugVal.cleanSlug;

  const existingForm = formData.id ? forms.find(f => f.id === formData.id && String(f.serverId) === sid) : null;

  if (!existingForm && serverForms.length >= MAX_FORMS_PER_SERVER) {
    throw new Error(`This server has reached the limit of ${MAX_FORMS_PER_SERVER} application forms.`);
  }

  // Check unique slug per server
  const duplicateSlug = serverForms.find(f => f.slug === cleanSlug && (!existingForm || f.id !== existingForm.id));
  if (duplicateSlug) {
    throw new Error(`A form with the short link "${cleanSlug}" already exists for this community.`);
  }

  const name = sanitizeText(String(formData.name || 'Application Form').slice(0, 100));
  const introText = sanitizeText(String(formData.introText || '').slice(0, 2000));
  const closingMessage = sanitizeText(String(formData.closingMessage || formData.closingText || 'Thank you for your application! We will review it shortly.').slice(0, 1000));
  const submitButtonText = sanitizeText(String(formData.submitButtonText || 'Submit Application').slice(0, 50));
  const extraButtons = validateButtons(formData.extraButtons || formData.linkButtons || []);
  const questions = validateQuestions(formData.questions || []);

  const isOpen = formData.isOpen !== undefined ? Boolean(formData.isOpen) : true;
  const closeDate = formData.closeDate ? new Date(formData.closeDate).toISOString() : null;
  const rawMaxSub = formData.maxSubmissions ?? formData.submissionLimit;
  const maxSubmissions = Number(rawMaxSub) > 0 ? Math.floor(Number(rawMaxSub)) : null;
  const rawCooldown = formData.denyCooldownDays ?? formData.cooldownDays;
  const denyCooldownDays = Number.isFinite(Number(rawCooldown)) && Number(rawCooldown) >= 0 ? Math.floor(Number(rawCooldown)) : 7;
  const rawRole = formData.roleRewardId || formData.autoRoleId;
  const roleRewardId = rawRole ? String(rawRole).trim() : null;
  const isPartnershipForm = Boolean(formData.isPartnershipForm);

  if (existingForm) {
    existingForm.name = name;
    existingForm.slug = cleanSlug;
    existingForm.introText = introText;
    existingForm.closingMessage = closingMessage;
    existingForm.closingText = closingMessage;
    existingForm.submitButtonText = submitButtonText;
    existingForm.extraButtons = extraButtons;
    existingForm.linkButtons = extraButtons;
    existingForm.questions = questions;
    existingForm.isOpen = isOpen;
    existingForm.closeDate = closeDate;
    existingForm.maxSubmissions = maxSubmissions;
    existingForm.submissionLimit = maxSubmissions;
    existingForm.denyCooldownDays = denyCooldownDays;
    existingForm.cooldownDays = denyCooldownDays;
    existingForm.roleRewardId = roleRewardId;
    existingForm.autoRoleId = roleRewardId;
    existingForm.isPartnershipForm = isPartnershipForm;
    existingForm.bannerUrl = formData.bannerUrl ? String(formData.bannerUrl).trim() : null;
    existingForm.startButtonText = formData.startButtonText ? sanitizeText(String(formData.startButtonText).slice(0, 50)) : 'Start Application';
    existingForm.allowPrevious = formData.allowPrevious !== undefined ? Boolean(formData.allowPrevious) : true;
    existingForm.infoLines = Array.isArray(formData.infoLines) ? formData.infoLines : [];
    existingForm.updatedAt = new Date(now).toISOString();
    saveForms(forms);
    deleteFormDraft(sid, existingForm.id);
    deleteFormDraft(sid, 'new');
    return existingForm;
  }

  const newForm = {
    id: `form_${now}_${randomBytes(4).toString('hex')}`,
    serverId: sid,
    createdBy: uid,
    name,
    slug: cleanSlug,
    introText,
    closingMessage,
    closingText: closingMessage,
    submitButtonText,
    extraButtons,
    linkButtons: extraButtons,
    questions,
    isOpen,
    closeDate,
    maxSubmissions,
    submissionLimit: maxSubmissions,
    denyCooldownDays,
    cooldownDays: denyCooldownDays,
    roleRewardId,
    autoRoleId: roleRewardId,
    isPartnershipForm,
    bannerUrl: formData.bannerUrl ? String(formData.bannerUrl).trim() : null,
    startButtonText: formData.startButtonText ? sanitizeText(String(formData.startButtonText).slice(0, 50)) : 'Start Application',
    allowPrevious: formData.allowPrevious !== undefined ? Boolean(formData.allowPrevious) : true,
    infoLines: Array.isArray(formData.infoLines) ? formData.infoLines : [],
    submissionCount: 0,
    disabledByAdmin: false,
    disabledReason: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  };

  forms.unshift(newForm);
  saveForms(forms);
  deleteFormDraft(sid, 'new');
  return newForm;
}

const DRAFTS_FILE = path.join(DATA_DIR, 'form_drafts.json');

function loadDrafts() {
  try {
    if (fs.existsSync(DRAFTS_FILE)) {
      return JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf8') || '{}');
    }
  } catch {}
  return {};
}

function saveDrafts(data) {
  try {
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

export function getFormDraft(serverId, formId = 'new') {
  const sid = String(serverId || '');
  const fid = String(formId || 'new');
  const drafts = loadDrafts();
  return drafts[`${sid}:${fid}`] || null;
}

export function saveFormDraft(serverId, formId = 'new', draftData = {}, userId = null) {
  const sid = String(serverId || '');
  const fid = String(formId || 'new');
  const drafts = loadDrafts();
  const entry = {
    serverId: sid,
    formId: fid,
    userId: userId ? String(userId) : null,
    draft: draftData,
    updatedAt: new Date().toISOString()
  };
  drafts[`${sid}:${fid}`] = entry;
  saveDrafts(drafts);
  return entry;
}

export function deleteFormDraft(serverId, formId = 'new') {
  const sid = String(serverId || '');
  const fid = String(formId || 'new');
  const drafts = loadDrafts();
  if (drafts[`${sid}:${fid}`]) {
    delete drafts[`${sid}:${fid}`];
    saveDrafts(drafts);
  }
  return true;
}

const APPLICANT_DRAFTS_FILE = path.join(DATA_DIR, 'form_applicant_drafts.json');

function loadApplicantDrafts() {
  try {
    if (fs.existsSync(APPLICANT_DRAFTS_FILE)) {
      return JSON.parse(fs.readFileSync(APPLICANT_DRAFTS_FILE, 'utf8') || '{}');
    }
  } catch {}
  return {};
}

function saveApplicantDrafts(data) {
  try {
    fs.writeFileSync(APPLICANT_DRAFTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

export function getApplicantDraft(formId, userId) {
  if (!formId || !userId) return null;
  const drafts = loadApplicantDrafts();
  return drafts[`${formId}:${userId}`] || null;
}

export function saveApplicantDraft(formId, userId, answers = {}, currentStep = 0) {
  if (!formId || !userId) return null;
  const drafts = loadApplicantDrafts();
  const key = `${formId}:${userId}`;
  const entry = {
    formId: String(formId),
    userId: String(userId),
    answers,
    currentStep,
    updatedAt: new Date().toISOString()
  };
  drafts[key] = entry;
  saveApplicantDrafts(drafts);
  return entry;
}

export function deleteApplicantDraft(formId, userId) {
  if (!formId || !userId) return true;
  const drafts = loadApplicantDrafts();
  const key = `${formId}:${userId}`;
  if (drafts[key]) {
    delete drafts[key];
    saveApplicantDrafts(drafts);
  }
  return true;
}

/**
 * Get all forms for a server
 */
export function getServerForms(serverId) {
  const sid = String(serverId);
  const forms = loadForms();
  return forms.filter(f => String(f.serverId) === sid && !f.deleted);
}

/**
 * Delete a form (soft delete)
 */
export function deleteForm(formId, serverId, userId) {
  const forms = loadForms();
  const form = forms.find(f => f.id === formId && String(f.serverId) === String(serverId));
  if (!form) throw new Error('Form not found.');

  form.deleted = true;
  form.deletedAt = new Date().toISOString();
  form.deletedBy = String(userId);
  saveForms(forms);
  return { success: true };
}

/**
 * Resolve public form by server slug (or server id) and form slug
 */
export function resolvePublicForm(serverIdentifier, formSlug) {
  const cleanServer = String(serverIdentifier || '').trim().toLowerCase();
  const cleanForm = String(formSlug || '').trim().toLowerCase();

  let targetServerId = null;
  const customRec = resolveCustomUrl(cleanServer);
  if (customRec) {
    targetServerId = String(customRec.serverId);
  }

  const servers = getPromotedServers(true);
  const targetServer = servers.find(s => 
    (targetServerId && String(s.id) === targetServerId) ||
    String(s.id).toLowerCase() === cleanServer ||
    String(s.guildId).toLowerCase() === cleanServer ||
    (s.customUrl && s.customUrl.toLowerCase() === cleanServer)
  );

  if (!targetServer) return null;

  const forms = loadForms();
  const form = forms.find(f => 
    String(f.serverId) === String(targetServer.id) &&
    f.slug.toLowerCase() === cleanForm &&
    !f.deleted
  );

  if (!form) return null;

  // Check if closed by closeDate
  let isClosed = !form.isOpen || form.disabledByAdmin;
  if (form.closeDate && new Date(form.closeDate).getTime() <= Date.now()) {
    isClosed = true;
  }
  if (form.maxSubmissions && form.submissionCount >= form.maxSubmissions) {
    isClosed = true;
  }

  return {
    form: {
      ...form,
      isClosed
    },
    server: {
      id: targetServer.id,
      name: targetServer.name,
      iconUrl: targetServer.iconUrl || targetServer.icon,
      bannerUrl: targetServer.bannerUrl,
      customUrl: targetServer.customUrl,
      verified: targetServer.verified,
      is_premium: targetServer.is_premium
    }
  };
}

/**
 * Check Discord account age (must be >= 2 days)
 */
export function isAccountOldEnough(userId) {
  try {
    const snowflake = BigInt(userId);
    const createdAtMs = Number((snowflake >> 22n) + 1420070400000n);
    const ageMs = Date.now() - createdAtMs;
    const minAgeMs = MIN_ACCOUNT_AGE_DAYS * 86400 * 1000;
    return { ok: ageMs >= minAgeMs, ageHours: ageMs / (3600 * 1000) };
  } catch {
    return { ok: false, ageHours: 0 };
  }
}

/**
 * Submit an application
 */
export async function submitApplication(formId, applicantUser, answers) {
  const forms = loadForms();
  const form = forms.find(f => f.id === formId && !f.deleted);
  if (!form) throw new Error('Application form not found.');

  if (form.disabledByAdmin) {
    throw new Error('This application form has been disabled by platform administration.');
  }

  if (!form.isOpen) {
    throw new Error('This application form is currently closed.');
  }

  if (form.closeDate && new Date(form.closeDate).getTime() <= Date.now()) {
    throw new Error('This application form has closed and is no longer accepting responses.');
  }

  if (form.maxSubmissions && form.submissionCount >= form.maxSubmissions) {
    throw new Error('This application form has reached its submission limit.');
  }

  const uid = String(applicantUser.id);

  // Check account age >= 2 days
  const ageCheck = isAccountOldEnough(uid);
  if (!ageCheck.ok) {
    throw new Error(`Your Discord account is too new to apply (must be at least ${MIN_ACCOUNT_AGE_DAYS} days old).`);
  }

  const submissions = loadSubmissions();

  // One open application per person per form (status: pending or needs_info)
  const existingOpen = submissions.find(s => 
    s.formId === formId && 
    s.applicantId === uid && 
    !s.deleted &&
    ['pending', 'needs_info'].includes(s.status)
  );

  if (existingOpen) {
    throw new Error('You already have an open application for this form awaiting review.');
  }

  // Denial cooldown check
  const lastDenied = submissions
    .filter(s => s.formId === formId && s.applicantId === uid && s.status === 'denied' && !s.deleted)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  if (lastDenied && form.denyCooldownDays > 0) {
    const deniedAt = new Date(lastDenied.reviewedAt || lastDenied.updatedAt).getTime();
    const cooldownMs = form.denyCooldownDays * 86400 * 1000;
    if (Date.now() - deniedAt < cooldownMs) {
      const daysLeft = Math.ceil((cooldownMs - (Date.now() - deniedAt)) / (86400 * 1000));
      throw new Error(`You must wait ${daysLeft} day(s) before applying again after a denial.`);
    }
  }

  // Validate and sanitize answers
  const sanitizedAnswers = {};
  for (const q of form.questions) {
    if (q.type === 'page_break') continue;
    const rawAns = answers[q.id];

    if (q.required && (rawAns === undefined || rawAns === null || rawAns === '')) {
      throw new Error(`Please answer the required question: "${q.label}"`);
    }

    if (rawAns !== undefined && rawAns !== null) {
      if (Array.isArray(rawAns)) {
        // Multi-select / checkboxes
        sanitizedAnswers[q.id] = rawAns.map(v => sanitizeText(String(v).slice(0, 200)));
      } else {
        const strVal = String(rawAns);
        if (strVal.length > MAX_ANSWER_LENGTH) {
          throw new Error(`Answer to "${q.label}" exceeds maximum length of ${MAX_ANSWER_LENGTH} characters.`);
        }
        sanitizedAnswers[q.id] = sanitizeText(strVal);
      }
    } else {
      sanitizedAnswers[q.id] = null;
    }
  }

  const now = Date.now();
  const submissionRecord = {
    id: `sub_${now}_${randomBytes(4).toString('hex')}`,
    formId: form.id,
    formName: form.name,
    formSlug: form.slug,
    serverId: form.serverId,
    applicantId: uid,
    applicantUsername: applicantUser.username || applicantUser.globalName || `User_${uid.slice(0, 6)}`,
    applicantAvatar: applicantUser.avatar ? `https://cdn.discordapp.com/avatars/${uid}/${applicantUser.avatar}.png?size=128` : null,
    answers: sanitizedAnswers,
    status: 'pending', // pending, accepted, denied, needs_info
    staffNotes: [],
    reviewedBy: null,
    reviewedAt: null,
    reviewDecision: null,
    roleAssigned: false,
    roleError: null,
    dmDelivered: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  };

  submissions.unshift(submissionRecord);
  saveSubmissions(submissions);

  // Increment submissionCount on form
  form.submissionCount = (form.submissionCount || 0) + 1;
  saveForms(forms);

  // Clear applicant draft on successful submission
  deleteApplicantDraft(form.id, uid);

  return submissionRecord;
}

/**
 * Get submissions for a server's manager inbox
 */
export function getServerSubmissions(serverId, filterStatus = 'all') {
  const sid = String(serverId);
  const submissions = loadSubmissions();
  return submissions.filter(s => {
    if (String(s.serverId) !== sid || s.deleted) return false;
    if (filterStatus && filterStatus !== 'all') {
      return s.status === filterStatus;
    }
    return true;
  });
}

/**
 * Review an application (Accept, Deny, Ask for more info)
 */
export async function reviewApplication(submissionId, serverId, reviewerUser, action, notes = '', options = {}) {
  const validActions = new Set(['accept', 'deny', 'needs_info']);
  if (!validActions.has(action)) {
    throw new Error('Invalid review action. Must be accept, deny, or needs_info.');
  }

  const submissions = loadSubmissions();
  const sub = submissions.find(s => s.id === submissionId && String(s.serverId) === String(serverId) && !s.deleted);
  if (!sub) throw new Error('Submission not found.');

  const forms = loadForms();
  const form = forms.find(f => f.id === sub.formId);

  const now = Date.now();
  const reviewerTag = reviewerUser.username || reviewerUser.globalName || 'Staff';

  if (action === 'accept') {
    sub.status = 'accepted';
  } else if (action === 'deny') {
    sub.status = 'denied';
  } else if (action === 'needs_info') {
    sub.status = 'needs_info';
  }

  sub.reviewedBy = reviewerTag;
  sub.reviewedAt = new Date(now).toISOString();
  sub.updatedAt = new Date(now).toISOString();
  sub.reviewDecision = action;

  if (notes && typeof notes === 'string') {
    sub.staffNotes.push({
      id: `note_${now}`,
      author: reviewerTag,
      content: sanitizeText(notes.slice(0, 1000)),
      action,
      createdAt: new Date(now).toISOString()
    });
  }

  // If accepted and form has roleRewardId, assign role via Discord API
  let roleAssigned = false;
  let roleError = null;
  if (action === 'accept' && form?.roleRewardId && !options.skipDiscord) {
    try {
      const assignRes = await assignDiscordRole(sub.serverId, sub.applicantId, form.roleRewardId, options);
      if (assignRes.ok) {
        roleAssigned = true;
      } else {
        roleError = assignRes.error;
      }
    } catch (err) {
      roleError = err.message;
    }
  }
  sub.roleAssigned = roleAssigned;
  sub.roleError = roleError;

  // Send Discord Components V2 DM to applicant (closed DMs must not fail)
  let dmDelivered = false;
  if (!options.skipDiscord) {
    try {
      const dmRes = await sendApplicationResultDM(sub, action, notes, form, options);
      dmDelivered = dmRes.ok;
    } catch {
      dmDelivered = false;
    }
  }
  sub.dmDelivered = dmDelivered;

  saveSubmissions(submissions);

  return {
    success: true,
    submission: sub,
    roleAssigned,
    roleError,
    dmDelivered
  };
}

/**
 * Assign Discord role to user in guild
 * Bot needs MANAGE_ROLES (0x10000000)
 * Bot's highest role must be placed above the role to assign.
 * Bot must never be or require Administrator.
 */
export async function assignDiscordRole(guildId, userId, roleId, options = {}) {
  const botToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
  if (!botToken && !options.mockDiscord) {
    return { ok: false, error: 'Discord bot token not configured.' };
  }

  if (options.mockDiscord) {
    return { ok: true, mocked: true };
  }

  const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
  const fetchFn = options.fetchFn || fetch;

  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`;
    const res = await fetchFn(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${cleanToken}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok || res.status === 204) {
      return { ok: true };
    }

    const err = await res.json().catch(() => ({}));
    let msg = `Discord API error: ${res.status}`;
    if (res.status === 403) {
      msg = 'Bot lacks permission to assign this role. Ensure the bot has "Manage Roles" and the bot\'s highest role is dragged ABOVE this role in Server Settings > Roles.';
    }
    return { ok: false, error: msg };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send Components V2 DM notification to applicant
 * Closed DMs must never throw or fail the review flow
 */
export async function sendApplicationResultDM(submission, action, notes, form, options = {}) {
  const botToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
  if (!botToken && !options.mockDiscord) {
    return { ok: false, error: 'No bot token' };
  }

  if (options.mockDiscord) {
    if (options.simulateClosedDM) {
      return { ok: false, error: 'Cannot send messages to this user (DMs disabled)' };
    }
    return { ok: true, mocked: true };
  }

  const fetchFn = options.fetchFn || fetch;
  const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
  const siteDomain = process.env.SITE_URL || 'https://connectingerlc.xyz';
  const appUrl = `${siteDomain}/application/${submission.id}`;

  let actionTitle = 'Application Update';
  let actionMessage = 'Your application status has been updated.';

  if (action === 'accept') {
    actionTitle = `Application Accepted: ${form?.name || 'Application'}`;
    actionMessage = `Congratulations, your application for **${form?.name || 'the community'}** has been accepted!`;
  } else if (action === 'deny') {
    actionTitle = `Application Update: ${form?.name || 'Application'}`;
    actionMessage = `Thank you for your interest. Your application for **${form?.name || 'the community'}** was not accepted at this time.`;
  } else if (action === 'needs_info') {
    actionTitle = `More Information Requested: ${form?.name || 'Application'}`;
    actionMessage = `The staff team has requested additional information regarding your application for **${form?.name || 'the community'}**.`;
  }

  let textContent = `### ${actionTitle}\n\n${actionMessage}`;
  if (notes) {
    textContent += `\n\n**Staff Note:**\n${notes}`;
  }

  const payload = {
    flags: 32768, // MessageFlags.IsComponentsV2
    components: [
      {
        type: 17, // Container (No accent_color = no color on the side)
        components: [
          {
            type: 10, // TextDisplay
            content: textContent
          },
          {
            type: 14, // Real Separator
            divider: true
          },
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: 'View Application',
                url: appUrl
              }
            ]
          }
        ]
      }
    ]
  };

  try {
    // 1. Open DM channel
    const dmRes = await fetchFn('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${cleanToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: submission.applicantId }),
      signal: AbortSignal.timeout(5000)
    });

    if (!dmRes.ok) {
      return { ok: false, error: 'Failed to open DM channel' };
    }

    const dmChannel = await dmRes.json();

    // 2. Send message
    const msgRes = await fetchFn(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${cleanToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });

    if (!msgRes.ok) {
      return { ok: false, error: `DM rejected by Discord: ${msgRes.status}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Applicant self-deletion of submission
 */
export function deleteApplicantSubmission(submissionId, applicantUserId) {
  const submissions = loadSubmissions();
  const sub = submissions.find(s => s.id === submissionId && String(s.applicantId) === String(applicantUserId) && !s.deleted);
  if (!sub) throw new Error('Submission not found or unauthorized.');

  sub.deleted = true;
  sub.deletedAt = new Date().toISOString();
  saveSubmissions(submissions);
  return { success: true };
}

/**
 * Report a public form for safety violations
 */
export function reportForm(formId, reporterUserId, reason, details = '') {
  const forms = loadForms();
  const form = forms.find(f => f.id === formId && !f.deleted);
  if (!form) throw new Error('Form not found.');

  const reports = loadFormReports();
  const reportRecord = {
    id: `rep_${Date.now()}_${randomBytes(3).toString('hex')}`,
    formId,
    formName: form.name,
    formSlug: form.slug,
    serverId: form.serverId,
    reporterId: String(reporterUserId),
    reason: sanitizeText(String(reason).slice(0, 100)),
    details: sanitizeText(String(details).slice(0, 500)),
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  reports.unshift(reportRecord);
  saveFormReports(reports);
  return { success: true, reportId: reportRecord.id };
}

/**
 * Admin: Disable a form
 */
export function adminDisableForm(formId, adminUserId, reason = 'Safety violation') {
  const forms = loadForms();
  const form = forms.find(f => f.id === formId);
  if (!form) throw new Error('Form not found.');

  form.disabledByAdmin = true;
  form.disabledReason = sanitizeText(reason);
  form.disabledBy = String(adminUserId);
  form.disabledAt = new Date().toISOString();
  saveForms(forms);
  return { success: true };
}

/**
 * Prune submissions older than retention days (default 90)
 */
export function pruneExpiredSubmissions(retentionDays = DEFAULT_RETENTION_DAYS) {
  const submissions = loadSubmissions();
  const cutoff = Date.now() - retentionDays * 86400 * 1000;
  let prunedCount = 0;

  const retained = submissions.filter(s => {
    const created = new Date(s.createdAt).getTime();
    if (created < cutoff) {
      prunedCount++;
      return false;
    }
    return true;
  });

  if (prunedCount > 0) {
    saveSubmissions(retained);
  }

  return { prunedCount, remainingCount: retained.length };
}
