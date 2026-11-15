import assert from 'node:assert';
import { sanitizeMarkdown, stripMarkdown } from '../web/markdownSanitizer.js';
import { encryptKey, decryptKey, maskKey, checkRateLimit } from '../web/erlcManager.js';

console.log('=== RUNNING ROUND 6 PHASE B UNIT TESTS ===\n');

// 1. stripMarkdown tests
console.log('1. Testing stripMarkdown()...');
assert.strictEqual(stripMarkdown('**Design** community'), 'Design community');
assert.strictEqual(stripMarkdown('*Italic* text and __underline__'), 'Italic text and underline');
assert.strictEqual(stripMarkdown('~~strikethrough~~ and `code`'), 'strikethrough and code');
assert.strictEqual(stripMarkdown('Check this ||spoiler text||'), 'Check this spoiler text');
assert.strictEqual(stripMarkdown('[Mavely Site](https://mavely.us)'), 'Mavely Site');
assert.strictEqual(stripMarkdown('# Big Heading\n> A quote\n- List item 1\n1. Numbered'), 'Big Heading A quote List item 1 Numbered');
assert.strictEqual(stripMarkdown(null), '');
assert.strictEqual(stripMarkdown(undefined), '');
console.log('  [PASS] stripMarkdown works for all markdown markers and null values.');

// 2. sanitizeMarkdown XSS tests
console.log('\n2. Testing sanitizeMarkdown() XSS Prevention...');
const scriptPayload = 'Welcome to **State RP** <script>alert("hacked")</script>';
const sanitizedScript = sanitizeMarkdown(scriptPayload);
assert(!sanitizedScript.includes('<script>'), 'Must strip <script> tag');
assert(!sanitizedScript.includes('alert("hacked")'), 'Must strip script body');
assert(sanitizedScript.includes('**State RP**'), 'Must preserve valid markdown');

const iframePayload = 'Watch patrol: <iframe src="https://evil.com"></iframe>';
assert(!sanitizeMarkdown(iframePayload).includes('<iframe'), 'Must strip <iframe>');

const imgPayload = '<img src=x onerror=alert(1)> and ![logo](https://evil.com/pic.png)';
assert(!sanitizeMarkdown(imgPayload).includes('<img'), 'Must strip <img> tags');

const jsLinkPayload = '[Click here](javascript:alert(document.cookie))';
const sanitizedJsLink = sanitizeMarkdown(jsLinkPayload);
assert(!sanitizedJsLink.includes('javascript:'), 'Must strip javascript: links');
assert.strictEqual(sanitizedJsLink, 'Click here', 'Should retain safe link text');

const dataLinkPayload = '[Steal](data:text/html,<script>alert(1)</script>)';
assert(!sanitizeMarkdown(dataLinkPayload).includes('data:'), 'Must strip data: URI links');
console.log('  [PASS] sanitizeMarkdown successfully eradicated all XSS attack vectors.');

// 3. ER:LC AES-256-GCM encryption & decryption
console.log('\n3. Testing ER:LC AES-256-GCM encryption & decryption...');
const sampleKey = 'prc-key-live-123456789abcdef';
const encrypted = encryptKey(sampleKey);
assert.notStrictEqual(encrypted, sampleKey, 'Encrypted string must differ from plain key');
assert(encrypted.includes(':'), 'Encrypted string must contain iv:tag:cipher segments');

const decrypted = decryptKey(encrypted);
assert.strictEqual(decrypted, sampleKey, 'Decrypted key must match original plain key');

assert.strictEqual(decryptKey('corrupted:data:invalid'), null, 'Corrupted key must safely return null');
assert.strictEqual(decryptKey(null), null);
console.log('  [PASS] AES-256-GCM encryption and decryption verified.');

// 4. Key masking
console.log('\n4. Testing ER:LC key masking...');
assert.strictEqual(maskKey('prc-key-xyz-7890'), '••••••••••••••••7890');
assert.strictEqual(maskKey('1234'), '••••••••••••••••1234');
assert.strictEqual(maskKey(''), '');
console.log('  [PASS] Key masking correctly hides secrets and only preserves last 4 chars.');

// 5. Rate limiter
console.log('\n5. Testing rate limiter (5 req/min)...');
const testServerId = 'test-server-' + Date.now();
for (let i = 0; i < 5; i++) {
  assert.strictEqual(checkRateLimit(testServerId, 5), true, `Request ${i + 1} should be allowed`);
}
assert.strictEqual(checkRateLimit(testServerId, 5), false, '6th request must be rejected by rate limiter');
console.log('  [PASS] Rate limiter accurately clamped excessive requests.');

console.log('\n=== ALL ROUND 6 PHASE B UNIT TESTS PASSED ===');

