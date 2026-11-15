import fs from 'node:fs';

const BASE_URL = 'http://localhost:3001';

// Read an active session cookie from data/web_sessions.json
const rawSessions = JSON.parse(fs.readFileSync('data/web_sessions.json', 'utf8') || '{}');
const activeSessionId = Object.keys(rawSessions)[0] || '';
const authHeaders = {
  'Content-Type': 'application/json',
  'Cookie': `connectingerlc_session=${activeSessionId}`
};

console.log('Testing with session cookie:', activeSessionId ? 'found' : 'NONE');

async function runTests() {
  console.log('--- PHASE B AUTOMATED TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc} ${details}`);
      failed++;
    }
  }

  // 1. DIRECTORY ICONS TEST
  console.log('\n1. Checking directory API and icon_hash...');
  try {
    const res = await fetch(`${BASE_URL}/api/directory`);
    assert('Directory endpoint returns 200 OK', res.ok);
    const data = await res.json();
    assert('Directory has servers', Array.isArray(data.servers) && data.servers.length > 0);

    for (const server of data.servers) {
      assert(`Server ${server.id} (${server.name}) has icon_hash`, Boolean(server.icon_hash));
      assert(`Server ${server.id} icon_hash is not null`, server.icon_hash !== null);
      assert(`Server ${server.id} icon_hash format is valid`, typeof server.icon_hash === 'string' && server.icon_hash.length >= 10);
      assert(`Server ${server.id} iconUrl is populated`, Boolean(server.iconUrl || server.icon));
    }
  } catch (err) {
    assert('Directory check error', false, err.message);
  }

  // 2. BOT STATUS & 403 ENFORCEMENT TEST
  console.log('\n2. Checking bot presence & 403 BOT_NOT_IN_GUILD enforcement...');
  const uninvitedGuildId = '999888777666555444'; // server where bot is never added
  try {
    // Check bot-status endpoint for uninvited guild
    const bRes = await fetch(`${BASE_URL}/api/servers/${uninvitedGuildId}/bot-status`);
    assert('Bot status endpoint returns 200', bRes.ok);
    const bData = await bRes.json();
    assert('Uninvited server has bot_in_guild === false', bData.bot_in_guild === false);
    assert('Uninvited server has botStatus === "Not added"', bData.botStatus === 'Not added');

    // Test PUT /api/servers/:id/listing
    const putRes = await fetch(`${BASE_URL}/api/servers/${uninvitedGuildId}/listing`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Test Uninvited' })
    });
    const putData = await putRes.json().catch(() => ({}));
    assert('PUT /api/servers/:id/listing on uninvited server returns 403 BOT_NOT_IN_GUILD', putRes.status === 403 && putData.error === 'BOT_NOT_IN_GUILD');

    // Test POST /api/directory/promote
    const promRes = await fetch(`${BASE_URL}/api/directory/promote`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ id: uninvitedGuildId, name: 'Test' })
    });
    const promData = await promRes.json().catch(() => ({}));
    assert('POST /directory/promote returns 403 BOT_NOT_IN_GUILD', promRes.status === 403 && promData.error === 'BOT_NOT_IN_GUILD');

    // Test POST /api/directory/bump
    const bumpRes = await fetch(`${BASE_URL}/api/directory/bump`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ guildId: uninvitedGuildId })
    });
    const bumpData = await bumpRes.json().catch(() => ({}));
    assert('POST /directory/bump returns 403 BOT_NOT_IN_GUILD', bumpRes.status === 403 && bumpData.error === 'BOT_NOT_IN_GUILD');

    // Test GET /api/workspace/:guildId
    const wsRes = await fetch(`${BASE_URL}/api/workspace/${uninvitedGuildId}`, {
      headers: authHeaders
    });
    const wsData = await wsRes.json().catch(() => ({}));
    assert('GET /workspace/:guildId returns 403 BOT_NOT_IN_GUILD', wsRes.status === 403 && wsData.error === 'BOT_NOT_IN_GUILD');

    // Test real invited guild: 1323596011498897408
    const invitedGuildId = '1323596011498897408';
    const invitedRes = await fetch(`${BASE_URL}/api/servers/${invitedGuildId}/bot-status`);
    const invitedData = await invitedRes.json();
    assert(`Invited server ${invitedGuildId} has bot_in_guild === true`, invitedData.bot_in_guild === true);
    assert(`Invited server ${invitedGuildId} has botStatus === "Online"`, invitedData.botStatus === 'Online');

  } catch (err) {
    assert('Bot enforcement check error', false, err.message);
  }

  console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
