import assert from 'node:assert';

async function run() {
  console.log('--- Running ConnectingERLC System Verification Tests ---');

  // Test 1: Fetch status endpoint
  try {
    const res = await fetch('http://localhost:3001/api/status');
    assert.strictEqual(res.status, 200, 'Status endpoint returned 200');
    const data = await res.json();
    console.log('Status API check:', data.status, '| Bot status:', data.botStatus);
    assert.ok(data.status === 'online', 'Platform status is online');
    assert.ok(typeof data.botStatus === 'string', 'botStatus is reported');
  } catch (err) {
    console.error('Test 1 failed:', err.message);
    throw err;
  }

  // Test 2: Fetch public showcase endpoint
  try {
    const res = await fetch('http://localhost:3001/api/public/showcase?limit=20');
    assert.strictEqual(res.status, 200, 'Showcase endpoint returned 200');
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.servers || data.listings || []);
    console.log(`Showcase API check: ${list.length} servers returned.`);
    assert.ok(list.length > 0, 'Showcase returned servers');
  } catch (err) {
    console.error('Test 2 failed:', err.message);
    throw err;
  }

  // Test 3: Bot Slash Commands verification
  try {
    const { BOT_COMMANDS } = await import('../botCommands.js');
    assert.strictEqual(BOT_COMMANDS.length, 4, 'Exactly 4 bot commands registered');
    const commandNames = BOT_COMMANDS.map(c => c.name);
    assert.deepStrictEqual(commandNames, ['bump', 'stats', 'info', 'status'], 'Commands are /bump, /stats, /info, /status');
    console.log('Bot Commands check: Exactly 4 commands verified (/bump, /stats, /info, /status).');
  } catch (err) {
    console.error('Test 3 failed:', err.message);
    throw err;
  }

  console.log('✓ All system tests passed successfully.');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
