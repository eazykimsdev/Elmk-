import assert from 'assert';
import fs from 'fs';
import {
  createOrUpdateForm,
  submitApplication,
  getServerForms,
  getServerSubmissions,
  reviewApplication,
  saveApplicantDraft,
  getApplicantDraft,
  deleteApplicantDraft,
  deleteForm
} from '../formsManager.js';

console.log('Testing Item 5: Applications Builder & Applicant Flow...');

const testServerId = 'test_guild_form_suite';
const testOwnerId = 'test_owner_form_1';
const testApplicantId = '123456789012345678'; // snowflake >= 2 days
const strangerId = '999999999999999999';

// 1. Build a 3-page form (using 2 page_break separators)
console.log('1. Building a 3-page form with page breaks & multiple question types...');
const formDef = {
  name: 'Community Moderator Application',
  slug: `mod-app-${Date.now()}`,
  bannerUrl: 'https://example.com/banner.png',
  startButtonText: 'Begin Application',
  allowPrevious: true,
  introText: 'Welcome! Please answer all pages honestly.',
  closingText: 'Thanks for applying. We will review soon.',
  submitButtonText: 'Submit Now',
  questions: [
    // Page 1
    { id: 'q1_name', label: 'What is your preferred name?', type: 'short_text', required: true },
    { id: 'q1_exp', label: 'Tell us about your moderation experience', type: 'long_text', required: true },
    // Page Break 1
    { id: 'pb_1', label: 'Page 2: Roleplay Knowledge', type: 'page_break', required: false },
    // Page 2
    { id: 'q2_age', label: 'How many years have you roleplayed?', type: 'number', required: false },
    { id: 'q2_mic', label: 'Do you have a working microphone?', type: 'yes_no', required: true },
    // Page Break 2
    { id: 'pb_2', label: 'Page 3: Scenarios', type: 'page_break', required: false },
    // Page 3
    { id: 'q3_choice', label: 'How would you handle RDM?', type: 'multiple_choice', options: ['Warn', 'Kick', 'Ban'], required: true },
    { id: 'q3_check', label: 'Which shifts can you work?', type: 'checkboxes', options: ['Morning', 'Afternoon', 'Night'], required: true }
  ]
};

const createdForm = await createOrUpdateForm(testServerId, formDef, testOwnerId);
assert(createdForm.id, 'Form must be created with an ID');
assert.strictEqual(createdForm.questions.length, 8, 'Form must have 8 items (6 questions + 2 page breaks)');
assert.strictEqual(createdForm.bannerUrl, 'https://example.com/banner.png', 'Banner URL must be saved');
assert.strictEqual(createdForm.startButtonText, 'Begin Application', 'Start button text must be saved');
assert.strictEqual(createdForm.allowPrevious, true, 'allowPrevious must be true');

// 2. Test applicant draft saving & retrieval (simulating refresh in the middle)
console.log('2. Testing draft autosave (refresh in the middle)...');
const partialAnswers = {
  q1_name: 'Alex',
  q1_exp: 'I have moderated several servers for 2 years.'
};
saveApplicantDraft(createdForm.id, testApplicantId, partialAnswers, 2);

const restoredDraft = getApplicantDraft(createdForm.id, testApplicantId);
assert(restoredDraft, 'Draft must exist after saving');
assert.strictEqual(restoredDraft.answers.q1_name, 'Alex', 'Draft answers must be preserved');
assert.strictEqual(restoredDraft.currentStep, 2, 'Draft currentStep must be preserved');

// 3. Test missing required answer (must fail)
console.log('3. Testing validation: missing required question must fail...');
let threwMissing = false;
try {
  await submitApplication(createdForm.id, { id: testApplicantId, username: 'TestApplicant' }, {
    q1_name: 'Alex',
    // missing q1_exp
    q2_mic: 'Yes',
    q3_choice: 'Warn',
    q3_check: ['Morning']
  });
} catch (err) {
  threwMissing = true;
  assert(err.message.includes('required question'), `Error should mention required question: ${err.message}`);
}
assert(threwMissing, 'Must reject submission with missing required answer');

// 4. Test XSS sanitization in answers
console.log('4. Testing XSS prevention in answers...');
const xssPayload = '<script>alert("xss")</script><b>Bold Answer</b>';
const validAnswers = {
  q1_name: 'Alex <script>alert("hack")</script>',
  q1_exp: xssPayload,
  q2_age: 3,
  q2_mic: 'Yes',
  q3_choice: 'Warn',
  q3_check: ['Morning', 'Night']
};

const submission = await submitApplication(
  createdForm.id,
  { id: testApplicantId, username: 'TestApplicant', avatar: 'abcdef123456' },
  validAnswers
);
assert(submission.id, 'Submission must succeed with valid answers');
assert(!submission.answers.q1_exp.includes('<script>'), 'Script tags must be stripped from answers');
assert(!submission.answers.q1_name.includes('<script>'), 'Script tags must be stripped from short text');

// Draft should be automatically cleared on successful submission
assert(!getApplicantDraft(createdForm.id, testApplicantId), 'Draft must be cleared after submission');

// 5. Test review action: Accept
console.log('5. Testing review action: Accept...');
const reviewResult = await reviewApplication(
  submission.id,
  testServerId,
  { id: testOwnerId, username: 'StaffReviewer' },
  'accept',
  'Welcome to the team! Great answers.'
);
assert.strictEqual(reviewResult.submission.status, 'accepted', 'Submission status must be accepted');
assert.strictEqual(reviewResult.submission.staffNotes.length, 1, 'Staff note must be recorded');

// 6. Test stranger trying to access answers / submissions
console.log('6. Testing access control: stranger cannot read or review applications...');
// Server submissions only for the correct serverId
const serverSubmissions = getServerSubmissions(testServerId, 'all');
assert(serverSubmissions.some(s => s.id === submission.id), 'Manager should see submission');

let strangerBlocked = false;
try {
  await reviewApplication(
    submission.id,
    'some_other_server_id',
    { id: strangerId, username: 'Stranger' },
    'deny',
    'Unauthorized review attempt'
  );
} catch (err) {
  strangerBlocked = true;
}
assert(strangerBlocked, 'Review from unauthorized server must fail');

// Clean up test form and submissions
deleteForm(createdForm.id, testServerId, testOwnerId);
deleteApplicantDraft(createdForm.id, testApplicantId);

console.log('Item 5: ALL CHECKS PASSED');
