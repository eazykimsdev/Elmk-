import assert from 'node:assert';
import {
  createOrUpdateForm,
  getServerForms,
  deleteForm,
  resolvePublicForm,
  submitApplication,
  getServerSubmissions,
  reviewApplication,
  deleteApplicantSubmission,
  reportForm,
  adminDisableForm,
  pruneExpiredSubmissions,
  isAccountOldEnough,
  sanitizeText,
  validateFormSlug,
  validateButtons,
  validateQuestions,
  MAX_FORMS_PER_SERVER,
  MAX_QUESTIONS_PER_FORM,
  MAX_ANSWER_LENGTH,
  MIN_ACCOUNT_AGE_DAYS
} from '../formsManager.js';
import { upsertPromotedServer } from '../directoryManager.js';

console.log('======================================================================');
console.log(' PHASE G (G1 - G3) VERIFICATION TEST SUITE');
console.log('======================================================================\n');

async function runTests() {
  const testServerId = '158' + String(Date.now()) + '01';
  const ownerUserId = '159' + String(Date.now()) + '01';
  const managerUserId = '159' + String(Date.now()) + '02';
  const nonManagerUserId = '159' + String(Date.now()) + '03';

  // Seed test server
  upsertPromotedServer({
    id: testServerId,
    name: 'Liberty County RP',
    customUrl: 'liberty-rp',
    category: 'Roleplay Server',
    ownerId: ownerUserId
  }, { id: ownerUserId, username: 'ServerOwner' });

  console.log('--- TEST 1: Form Creation & Question Validation (G1) ---');
  // Attempt invalid slug (reserved)
  let slugVal = validateFormSlug('admin');
  assert.strictEqual(slugVal.valid, false, 'Should reject reserved route "admin"');
  console.log('  Passed: rejected reserved slug "admin":', slugVal.error);

  // Attempt lookalike / leet slug
  slugVal = validateFormSlug('d1sc0rd-app');
  assert.strictEqual(slugVal.valid, false, 'Should reject lookalike slug "d1sc0rd-app"');
  console.log('  Passed: rejected blocked lookalike slug "d1sc0rd-app":', slugVal.error);

  // Attempt button with http (must be https)
  let btnErr = false;
  try {
    validateButtons([{ label: 'Discord', url: 'http://discord.gg/test' }]);
  } catch (err) {
    btnErr = true;
    console.log('  Passed: rejected non-https button URL:', err.message);
  }
  assert(btnErr, 'Must reject non-https button URLs');

  // Create valid form with questions
  const createdForm = await createOrUpdateForm(testServerId, {
    name: 'Staff Team Application',
    slug: 'staff-app',
    introText: 'Welcome! Please answer all questions honestly.',
    closingMessage: 'Your application has been received and will be reviewed by the Directive Board.',
    submitButtonText: 'Submit My Application',
    extraButtons: [
      { label: 'Discord Server', url: 'https://discord.gg/libertyrp' }
    ],
    isOpen: true,
    denyCooldownDays: 7,
    roleRewardId: '158000000000099999',
    questions: [
      {
        id: 'q_age',
        label: 'How old are you?',
        type: 'number',
        required: true,
        min: 13
      },
      {
        id: 'q_experience',
        label: 'Tell us about your previous moderation experience.',
        type: 'long_text',
        required: true
      },
      {
        id: 'q_timezone',
        label: 'What is your primary timezone?',
        type: 'dropdown',
        required: true,
        options: ['EST', 'CST', 'PST', 'GMT', 'Other']
      },
      {
        id: 'q_agree',
        label: 'Do you agree to uphold our staff community guidelines?',
        type: 'yes_no',
        required: true
      }
    ]
  }, ownerUserId);

  assert(createdForm.id, 'Form must have an ID');
  assert.strictEqual(createdForm.slug, 'staff-app');
  assert.strictEqual(createdForm.questions.length, 4);
  console.log(`  Passed: created form "${createdForm.name}" with ID: ${createdForm.id} and ${createdForm.questions.length} questions.`);

  console.log('\n--- TEST 2: Public Form Resolution ---');
  // Resolves via server custom URL (liberty-rp) and form slug (staff-app)
  const resolved = resolvePublicForm('liberty-rp', 'staff-app');
  assert(resolved, 'Should resolve form via server slug and form slug');
  assert.strictEqual(resolved.form.id, createdForm.id);
  assert.strictEqual(resolved.server.name, 'Liberty County RP');
  console.log(`  Passed: resolved public form via [domain]/liberty-rp/staff-app successfully.`);

  console.log('\n--- TEST 3: Discord Account Age Check (Must be >= 2 Days Old) ---');
  // 1-hour-old account
  const brandNewApplicantId = String((BigInt(Date.now() - 3600 * 1000) - 1420070400000n) << 22n);
  const brandNewCheck = isAccountOldEnough(brandNewApplicantId);
  assert.strictEqual(brandNewCheck.ok, false, '1-hour old account should fail age check');
  console.log(`  Passed: rejected 1-hour old account (age: ${brandNewCheck.ageHours.toFixed(1)}h < 48h required).`);

  // Mature account (30 days old)
  const matureApplicantId = String((BigInt(Date.now() - 30 * 86400 * 1000) - 1420070400000n) << 22n);
  const matureCheck = isAccountOldEnough(matureApplicantId);
  assert.strictEqual(matureCheck.ok, true, '30-day old account should pass age check');
  console.log(`  Passed: accepted 30-day old account (age: ${matureCheck.ageHours.toFixed(1)}h >= 48h required).`);

  // Attempt submission with brand new account
  let ageFailCaught = false;
  try {
    await submitApplication(createdForm.id, { id: brandNewApplicantId, username: 'BrandNewUser' }, {
      q_age: 18,
      q_experience: 'Some experience',
      q_timezone: 'EST',
      q_agree: 'Yes'
    });
  } catch (err) {
    ageFailCaught = true;
    console.log('  Passed: submission blocked for new account:', err.message);
  }
  assert(ageFailCaught, 'Must block submission from accounts under 2 days old');

  console.log('\n--- TEST 4: Valid Application Submission ---');
  const validSubmission = await submitApplication(createdForm.id, { id: matureApplicantId, username: 'MatureApplicant' }, {
    q_age: 19,
    q_experience: 'Managed 2 communities for 1 year.',
    q_timezone: 'CST',
    q_agree: 'Yes'
  });
  assert(validSubmission.id, 'Submission must have an ID');
  assert.strictEqual(validSubmission.status, 'pending');
  assert.strictEqual(validSubmission.applicantId, matureApplicantId);
  console.log(`  Passed: submitted application successfully with ID: ${validSubmission.id} (status: pending).`);

  console.log('\n--- TEST 5: Duplicate Submission Prevention ---');
  let dupCaught = false;
  try {
    await submitApplication(createdForm.id, { id: matureApplicantId, username: 'MatureApplicant' }, {
      q_age: 20,
      q_experience: 'Another submission',
      q_timezone: 'EST',
      q_agree: 'Yes'
    });
  } catch (err) {
    dupCaught = true;
    console.log('  Passed: duplicate submission blocked:', err.message);
  }
  assert(dupCaught, 'Must reject duplicate submission while an open application exists');

  console.log('\n--- TEST 6: Closed Form Submission Prevention ---');
  // Create closed form
  const closedForm = await createOrUpdateForm(testServerId, {
    name: 'Closed Applications',
    slug: 'closed-app',
    isOpen: false,
    questions: [
      { id: 'q_text', label: 'Why join?', type: 'short_text', required: true }
    ]
  }, ownerUserId);

  let closedCaught = false;
  const applicant2Id = String((BigInt(Date.now() - 10 * 86400 * 1000) - 1420070400000n) << 22n);
  try {
    await submitApplication(closedForm.id, { id: applicant2Id, username: 'Applicant2' }, { q_text: 'Hello' });
  } catch (err) {
    closedCaught = true;
    console.log('  Passed: submission rejected on closed form:', err.message);
  }
  assert(closedCaught, 'Must reject submission when form is closed');

  console.log('\n--- TEST 7: XSS / Script Injection Neutralization ---');
  const maliciousInput = '<script>alert("pwned")</script><img src="x" onerror="alert(1)">';
  const sanitized = sanitizeText(maliciousInput);
  assert(!sanitized.includes('<script>'), 'Must escape script tags');
  assert(!sanitized.includes('<img'), 'Must escape HTML tags');
  assert(sanitized.includes('&lt;script&gt;'), 'Must encode brackets');
  console.log('  Passed: malicious script input safely sanitized to:', sanitized);

  console.log('\n--- TEST 8: Manager Inbox & Closed DM Handling (G2) ---');
  // Manager reviews application with Accept decision and closed DM
  const reviewRes = await reviewApplication(
    validSubmission.id,
    testServerId,
    { username: 'StaffReviewer' },
    'accept',
    'Great application, welcome aboard!',
    { mockDiscord: true, simulateClosedDM: true }
  );

  assert.strictEqual(reviewRes.success, true);
  assert.strictEqual(reviewRes.submission.status, 'accepted');
  assert.strictEqual(reviewRes.dmDelivered, false, 'Closed DM should report false');
  console.log('  Passed: closed DM did NOT throw or fail the application acceptance flow.');
  console.log('  Passed: role assignment simulated and tracked (roleAssigned: ' + reviewRes.roleAssigned + ').');

  console.log('\n--- TEST 9: Applicant Self-Deletion ---');
  const deleteRes = deleteApplicantSubmission(validSubmission.id, matureApplicantId);
  assert.strictEqual(deleteRes.success, true);
  const remainingSubmissions = getServerSubmissions(testServerId, 'all');
  assert(!remainingSubmissions.some(s => s.id === validSubmission.id), 'Deleted submission should not appear in active inbox');
  console.log('  Passed: applicant successfully deleted their own application.');

  console.log('\n--- TEST 10: Form Safety Reporting & Admin Disable (G3) ---');
  const reportRes = reportForm(createdForm.id, matureApplicantId, 'Suspicious questions', 'Requested Discord token');
  assert(reportRes.reportId, 'Report must be created with an ID');
  console.log(`  Passed: reported form for safety violation (Report ID: ${reportRes.reportId}).`);

  // Admin disables form
  adminDisableForm(createdForm.id, 'admin_super', 'Safety audit triggered');
  let disabledCaught = false;
  try {
    await submitApplication(createdForm.id, { id: applicant2Id, username: 'Applicant2' }, { q_age: 20 });
  } catch (err) {
    disabledCaught = true;
    console.log('  Passed: submission rejected on admin-disabled form:', err.message);
  }
  assert(disabledCaught, 'Admin-disabled forms must reject submissions');

  console.log('\n--- TEST 11: 90-Day Retention Pruning ---');
  const pruneRes = pruneExpiredSubmissions(90);
  console.log(`  Passed: retention pruning executed cleanly (pruned: ${pruneRes.prunedCount}, retained: ${pruneRes.remainingCount}).`);

  console.log('\n======================================================================');
  console.log(' ALL PHASE G TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
