import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateCustomUrlName,
  adminAssignReservedCustomUrl,
  RESERVED_WORDS,
  loadBlockedWords,
  getAuditLogs
} from '../customUrlManager.js';
import {
  checkRateLimit,
  maskKey,
  encryptKey,
  decryptKey,
  queryPrcApi,
  PRC_API_BASE
} from '../erlcManager.js';

console.log('Testing Item 2: Server Page Editor & Backend Integration...');

// 1. Test reserved custom URL validation
console.log('1. Testing reserved words validation...');
for (const word of ['admin', 'api', 'dashboard', 'settings', 'shop']) {
  const res = validateCustomUrlName(word);
  assert.strictEqual(res.valid, false, `${word} should be invalid`);
  assert.strictEqual(res.error, 'This name is reserved. Contact staff.', `Error for reserved ${word} must be exact`);
}

// Test blocked/brand words
console.log('2. Testing brand names validation...');
for (const brand of ['discord', 'anthropic', 'connectingerlc', 'mavely']) {
  const res = validateCustomUrlName(brand);
  assert.strictEqual(res.valid, false, `${brand} should be invalid`);
  assert.strictEqual(res.error, 'This name is reserved. Contact staff.', `Error for brand ${brand} must be exact`);
}

// 2. Test Admin Reserved Name Assignment
console.log('3. Testing Admin Reserved Name Assignment...');
import { getPromotedServers } from '../directoryManager.js';
const existingServers = getPromotedServers(true);
const targetServer = existingServers[0] || { id: 'test_server_123', name: 'Test Server' };
const testServerId = String(targetServer.id || targetServer.guildId);
const testAdminId = '999888777666555444';
const testReservedSlug = 'official-admin';

// Assign reserved name as admin
const assignedRecord = await adminAssignReservedCustomUrl(
  testReservedSlug,
  testServerId,
  testAdminId,
  'Verified partner official claim'
);
assert.strictEqual(assignedRecord.slug, testReservedSlug);
assert.strictEqual(assignedRecord.serverId, testServerId);
assert.strictEqual(assignedRecord.isReservedAssignment, true);

// Verify audit log
const logs = getAuditLogs();
const latestLog = logs.find(l => l.action === 'admin_assign_reserved_custom_url' && l.details?.slug === testReservedSlug);
assert(latestLog, 'Audit log entry must exist for admin reserved assignment');
assert.strictEqual(latestLog.actorId, testAdminId);
assert.strictEqual(latestLog.details.reason, 'Verified partner official claim');

// 3. Test ER:LC API specification & error handling
console.log('4. Testing ER:LC Integration & Error Handling...');
assert.strictEqual(PRC_API_BASE, 'https://api.policeroleplay.community/v1');

// Rate limiting test: 5 requests per minute
const rateServerId = 'erlc_test_server_' + Date.now();
for (let i = 0; i < 5; i++) {
  assert.strictEqual(checkRateLimit(rateServerId, 5), true, `Request ${i + 1} should be allowed`);
}
assert.strictEqual(checkRateLimit(rateServerId, 5), false, '6th request in a minute must be rate limited');

// Key masking
const masked = maskKey('secret_prc_key_12345');
assert(masked.endsWith('2345'), 'Masked key must end in last 4 characters');
assert(!masked.includes('secret'), 'Masked key must not reveal secret prefix');

// Key encryption/decryption
const plain = 'prc_api_key_sample_1234';
const enc = encryptKey(plain);
assert.notStrictEqual(enc, plain);
const dec = decryptKey(enc);
assert.strictEqual(dec, plain);

// Plain word error messages test
try {
  await queryPrcApi('');
  assert.fail('Should have thrown on empty key');
} catch (err) {
  assert.strictEqual(err.message, 'Invalid ER:LC API key. Check key and permissions.');
}

// 4. Test ServerDetailsTab.tsx code structure
console.log('5. Testing ServerDetailsTab.tsx structure...');
const files = [
  'src/pages/dashboard/ServerDetailsTab.tsx',
  'web/src/pages/dashboard/ServerDetailsTab.tsx'
];

for (const file of files) {
  assert(fs.existsSync(file), `${file} must exist`);
  const content = fs.readFileSync(file, 'utf8');

  // Max width 1280px
  assert(content.includes('max-w-[1280px]'), `${file} must use max-w-[1280px]`);

  // No "Live preview" box
  assert(!content.includes('Live preview'), `${file} must completely remove "Live preview" box`);

  // No example form link preview line
  assert(!content.includes('staff-application'), `${file} must not have example "staff-application" form preview`);

  // Bottom padding pb-36 for save bar
  assert(content.includes('pb-36'), `${file} must have generous bottom padding`);

  // Simple page sections: GripVertical + Switch, no ArrowUp or ArrowDown
  assert(content.includes('GripVertical'), `${file} must have drag handle`);
  assert(!content.includes('ArrowUp'), `${file} must not have ArrowUp button`);
  assert(!content.includes('ArrowDown'), `${file} must not have ArrowDown button`);
}

console.log('Item 2: ALL CHECKS PASSED');
