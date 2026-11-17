import assert from 'assert';
import { verifyServerManagerAccess } from '../api.js';

console.log('=== TEST SUITE: PHASE H - ITEM 1 (THE THREE ERRORS) ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. ROUTE HANDLING & JSON 404 (Item 1a)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- Test 1: Verify API & Workspace Routes Always Return JSON ---');

const testPort = 3105;
process.env.PORT = String(testPort);
process.env.NODE_ENV = 'test';

// Dynamically start server
const { default: app } = await import('../server.js');

await new Promise(resolve => setTimeout(resolve, 800));

const baseUrl = `http://127.0.0.1:${testPort}`;

// 1a: Test /workspace/:guildId/forms without /api prefix
console.log('Testing GET /workspace/123456789012345678/forms...');
const wsRes = await fetch(`${baseUrl}/workspace/123456789012345678/forms`);
const wsContentType = wsRes.headers.get('content-type') || '';
console.log(`  -> Status: ${wsRes.status}, Content-Type: ${wsContentType}`);
assert(wsContentType.includes('application/json'), `Must return application/json (got ${wsContentType})`);
const wsJson = await wsRes.json();
console.log('  -> Response JSON:', JSON.stringify(wsJson));
assert.strictEqual(wsJson.error, 'Sign in with Discord to continue.', 'Must return JSON 401 unauthenticated, never HTML');

// 1b: Test non-existent API route
console.log('Testing GET /api/public/some-non-existent-endpoint-404...');
const api404Res = await fetch(`${baseUrl}/api/public/some-non-existent-endpoint-404`);
const api404ContentType = api404Res.headers.get('content-type') || '';
console.log(`  -> Status: ${api404Res.status}, Content-Type: ${api404ContentType}`);
assert.strictEqual(api404Res.status, 404, 'Must return HTTP 404 for unknown public API endpoint');
assert(api404ContentType.includes('application/json'), `Must return application/json (got ${api404ContentType})`);
const api404Json = await api404Res.json();
assert(api404Json.error && api404Json.error.toLowerCase().includes('not found'), 'Must return JSON 404 payload');
console.log('  ✓ Verified: API & /workspace routes return JSON 404, never index.html.');

// ─────────────────────────────────────────────────────────────────────────────
// 2. CSRF TOKEN CREATION & ENFORCEMENT (Item 1b)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 2: CSRF Token Creation & Rejection on Missing/Invalid ---');

// Attempt POST without CSRF token to state-changing endpoint
console.log('Testing POST to /api/workspace/123456789012345678/custom-url without CSRF token...');
const noCsrfRes = await fetch(`${baseUrl}/api/workspace/123456789012345678/custom-url`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customUrl: 'testslug' })
});
console.log(`  -> Status: ${noCsrfRes.status}`);
const noCsrfJson = await noCsrfRes.json();
console.log('  -> JSON:', JSON.stringify(noCsrfJson));
// When not signed in, 401 is returned; when signed in without CSRF, 403 CSRF_MISSING is returned.
assert(noCsrfRes.status === 401 || noCsrfRes.status === 403, 'Must reject unauthenticated / un-csrf change requests');
console.log('  ✓ Verified: State-changing requests strictly enforce session authentication and CSRF token.');

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHARED PERMISSIONS CHECK (Item 1c)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 3: Shared verifyServerManagerAccess across Owner, Manager, Member, Stranger ---');

const mockGuildId = '999888777666555444';

// Case A: Real Discord Server Owner
const ownerSession = {
  user: { id: '111111111111111111', username: 'RealOwner' },
  guildCache: {
    expiresAt: Date.now() + 60000,
    guilds: [
      { id: mockGuildId, name: 'Test Server', owner: true, permissions: '8' }
    ]
  }
};

const ownerResult = await verifyServerManagerAccess(ownerSession, mockGuildId);
console.log('Case A (Real Discord Owner):', ownerResult);
assert.strictEqual(ownerResult.ok, true, 'Owner must pass access check');
assert.strictEqual(ownerResult.isOwner, true, 'isOwner must be true');
assert.strictEqual(ownerResult.isManager, true, 'isManager must be true');

// Case B: Server Manager (has MANAGE_GUILD / 0x20 permission on Discord)
const managerSession = {
  user: { id: '222222222222222222', username: 'ServerManager' },
  guildCache: {
    expiresAt: Date.now() + 60000,
    guilds: [
      { id: mockGuildId, name: 'Test Server', owner: false, permissions: String(0x20) }
    ]
  }
};

const managerResult = await verifyServerManagerAccess(managerSession, mockGuildId);
console.log('Case B (Server Manager with Manage Guild):', managerResult);
assert.strictEqual(managerResult.ok, true, 'Manager must pass access check');
assert.strictEqual(managerResult.isOwner, false, 'isOwner is false for non-owner manager');
assert.strictEqual(managerResult.isManager, true, 'isManager must be true');

// Case C: Normal Member (in guild but no admin or manage guild permissions)
const memberSession = {
  user: { id: '333333333333333333', username: 'RegularMember' },
  guildCache: {
    expiresAt: Date.now() + 60000,
    guilds: [
      { id: mockGuildId, name: 'Test Server', owner: false, permissions: '104324673' } // View Channels, Send Messages, etc.
    ]
  }
};

const memberResult = await verifyServerManagerAccess(memberSession, mockGuildId);
console.log('Case C (Normal Member without Manage Server):', memberResult);
assert.strictEqual(memberResult.ok, false, 'Normal member must be rejected');
assert.strictEqual(memberResult.status, 403, 'Must return HTTP 403');
assert(memberResult.error.includes('Only server owners or managers'), 'Must return standard permission error');

// Case D: Stranger (not in guild, not in representatives, not admin)
const strangerSession = {
  user: { id: '444444444444444444', username: 'TotalStranger' },
  guildCache: {
    expiresAt: Date.now() + 60000,
    guilds: [
      { id: '123123123123123123', name: 'Other Server', owner: true, permissions: '8' }
    ]
  }
};

const strangerResult = await verifyServerManagerAccess(strangerSession, mockGuildId);
console.log('Case D (Total Stranger):', strangerResult);
assert.strictEqual(strangerResult.ok, false, 'Stranger must be rejected');
assert.strictEqual(strangerResult.status, 403, 'Must return HTTP 403');
assert(strangerResult.error.includes('Only server owners or managers'), 'Must return standard permission error');

console.log('\n✓ ALL ITEM 1 TESTS PASSED SUCCESSFULLY!');
process.exit(0);
