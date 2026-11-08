import assert from 'node:assert/strict';
import { queryPrcApi } from '../erlcManager.js';

// Save original fetch
const originalFetch = global.fetch;

async function runTests() {
  console.log('Testing ER:LC API Key queryPrcApi handling...');

  // Test 1: Mock 200 Success
  global.fetch = async (url, options) => {
    assert.strictEqual(url, 'https://api.policeroleplay.community/v1/server');
    assert.strictEqual(options.headers['Server-Key'], 'valid-test-key-123');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        Name: 'Liberty County Police RP',
        CurrentPlayers: 18,
        MaxPlayers: 40,
        JoinKey: 'LCRP2026',
        AccVerified: true,
      }),
    };
  };

  const successResult = await queryPrcApi('  valid-test-key-123  ');
  assert.strictEqual(successResult.name, 'Liberty County Police RP');
  assert.strictEqual(successResult.currentPlayers, 18);
  assert.strictEqual(successResult.maxPlayers, 40);
  assert.strictEqual(successResult.joinCode, 'LCRP2026');
  console.log('✓ 200 OK test passed');

  // Test 2: Mock 401 Unauthorized
  global.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => 'Unauthorized',
  });

  await assert.rejects(
    async () => queryPrcApi('invalid-key'),
    { message: 'Invalid ER:LC API key. Check key and permissions.' }
  );
  console.log('✓ 401 Unauthorized test passed');

  // Test 3: Mock 403 Forbidden
  global.fetch = async () => ({
    ok: false,
    status: 403,
    text: async () => 'Forbidden',
  });

  await assert.rejects(
    async () => queryPrcApi('forbidden-key'),
    { message: 'Invalid ER:LC API key. Check key and permissions.' }
  );
  console.log('✓ 403 Forbidden test passed');

  // Test 4: Mock 429 Rate Limited
  global.fetch = async () => ({
    ok: false,
    status: 429,
    text: async () => 'Too Many Requests',
  });

  await assert.rejects(
    async () => queryPrcApi('ratelimited-key'),
    { message: 'Rate limited by ER:LC API. Try again in a minute.' }
  );
  console.log('✓ 429 Rate Limited test passed');

  // Test 5: Mock 500 Server Error
  global.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => 'Internal Server Error',
  });

  await assert.rejects(
    async () => queryPrcApi('server-error-key'),
    { message: 'ER:LC could not be reached. Try again in a minute.' }
  );
  console.log('✓ 500 Server Error test passed');

  // Test 6: Mock Network / Timeout Error
  global.fetch = async () => {
    throw new Error('fetch failed / timeout');
  };

  await assert.rejects(
    async () => queryPrcApi('timeout-key'),
    { message: 'ER:LC could not be reached. Try again in a minute.' }
  );
  console.log('✓ Network / Timeout error test passed');

  // Restore fetch
  global.fetch = originalFetch;
  console.log('ALL ER:LC API KEY TESTS PASSED!');
}

runTests().catch((err) => {
  global.fetch = originalFetch;
  console.error('Test failed:', err);
  process.exit(1);
});

