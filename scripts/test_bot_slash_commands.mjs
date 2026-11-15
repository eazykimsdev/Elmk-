import { handleInteraction, GLOBAL_BOT_COMMANDS } from '../botCommands.js';
import { getPromotedServers } from '../directoryManager.js';

async function testBotCommands() {
  console.log('--- Testing ConnectingERLC Bot Slash Commands & Components V2 Panels ---');

  // Verify commands defined
  if (GLOBAL_BOT_COMMANDS.length !== 5) {
    throw new Error(`Expected 5 commands, got ${GLOBAL_BOT_COMMANDS.length}`);
  }
  console.log('✓ Verified 5 global commands:', GLOBAL_BOT_COMMANDS.map(c => `/${c.name}`).join(', '));

  // Find a linked server
  const servers = getPromotedServers(true);
  const linkedServer = servers[0];
  if (!linkedServer) throw new Error('No promoted servers in database to test against.');
  const linkedGuildId = linkedServer.id;
  const unlinkedGuildId = '999999999999999999';

  console.log(`Using linked server: "${linkedServer.name}" (${linkedGuildId})`);

  // Mock respond collector
  let lastResponse = null;
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (url.includes('/callback')) {
      lastResponse = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    return originalFetch(url, opts);
  };

  // Test 1: /bump on unlinked server -> ephemeral error
  await handleInteraction({
    type: 2,
    id: 'test_1',
    token: 'token_1',
    guild_id: unlinkedGuildId,
    data: { name: 'bump' },
    member: { user: { id: 'user_123', username: 'Tester' } }
  }, 'fake_token');

  if (!lastResponse?.data?.content?.includes('This server is not set up on ConnectingERLC')) {
    throw new Error('Test 1 failed: unlinked /bump should return setup error message.');
  }
  if (lastResponse.data.flags !== 64) {
    throw new Error('Test 1 failed: unlinked /bump should be ephemeral (flags: 64).');
  }
  console.log('✓ /bump on unlinked server returned ephemeral error with dashboard link.');

  // Test 2: /status command -> Components V2 Panel
  await handleInteraction({
    type: 2,
    id: 'test_2',
    token: 'token_2',
    guild_id: linkedGuildId,
    data: { name: 'status' },
    member: { user: { id: 'user_123', username: 'Tester' } }
  }, 'fake_token');

  const statusContainer = lastResponse?.data?.components?.[0];
  if (statusContainer?.type !== 17) {
    throw new Error(`Test 2 failed: /status should return Container (type 17), got: ${statusContainer?.type}`);
  }
  if (!(lastResponse.data.flags & 32768)) {
    throw new Error('Test 2 failed: /status must have MessageFlags.IsComponentsV2 (32768)');
  }
  console.log('✓ /status returned Components V2 container panel.');

  // Test 3: /leaderboard command -> Components V2 Panel
  await handleInteraction({
    type: 2,
    id: 'test_3',
    token: 'token_3',
    guild_id: linkedGuildId,
    data: { name: 'leaderboard' },
    member: { user: { id: 'user_123', username: 'Tester' } }
  }, 'fake_token');

  const lbContainer = lastResponse?.data?.components?.[0];
  if (lbContainer?.type !== 17) {
    throw new Error(`Test 3 failed: /leaderboard should return Container (type 17), got: ${lbContainer?.type}`);
  }
  if (!(lastResponse.data.flags & 32768)) {
    throw new Error('Test 3 failed: /leaderboard must have MessageFlags.IsComponentsV2 (32768)');
  }
  const lbText = lbContainer.components.find(c => c.type === 10)?.content || '';
  if (lbText.includes('`')) {
    throw new Error('Test 3 failed: /leaderboard must NOT contain backticks (`` ` ``)');
  }
  if (lbText.includes('⚡') || lbText.includes('🏆') || lbText.includes('🎉')) {
    throw new Error('Test 3 failed: /leaderboard must NOT contain trophy, lightning, or party popper emojis.');
  }
  if (!lbText.includes('🥇') || !lbText.includes('2️⃣') || !lbText.includes('3️⃣')) {
    throw new Error('Test 3 failed: /leaderboard must use 🥇, 2️⃣, and 3️⃣ for top 3.');
  }
  const lbButton = lbContainer.components.find(c => c.type === 1)?.components?.[0];
  if (lbButton?.label !== 'View Leaderboard') {
    throw new Error(`Test 3 failed: Button must be named "View Leaderboard", got: "${lbButton?.label}"`);
  }
  console.log('✓ /leaderboard returned Components V2 panel without backticks, clean emojis, and "View Leaderboard" button.');

  // Test 4: /ad command -> Components V2 Panel
  await handleInteraction({
    type: 2,
    id: 'test_4',
    token: 'token_4',
    guild_id: linkedGuildId,
    data: { name: 'ad' },
    member: { user: { id: 'user_123', username: 'Tester' } }
  }, 'fake_token');

  if (lastResponse?.data?.components?.[0]?.type !== 17) {
    throw new Error('Test 4 failed: /ad must return Components V2 Container');
  }
  console.log('✓ /ad returned Components V2 panel.');

  // Test 5: /setup command -> Components V2 Panel
  await handleInteraction({
    type: 2,
    id: 'test_5',
    token: 'token_5',
    guild_id: linkedGuildId,
    data: { name: 'setup' },
    member: { user: { id: 'user_123', username: 'Tester' } }
  }, 'fake_token');

  if (lastResponse?.data?.components?.[0]?.type !== 17) {
    throw new Error('Test 5 failed: /setup must return Components V2 Container');
  }
  console.log('✓ /setup returned Components V2 panel.');

  global.fetch = originalFetch;
  console.log('--- All Bot Slash Command Tests PASSED Successfully! ---');
}

testBotCommands().catch(err => {
  console.error('Bot Command Test FAILED:', err);
  process.exit(1);
});
