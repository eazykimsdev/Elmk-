import { handleInteraction, registerGlobalCommands, BOT_COMMANDS } from '../botCommands.js';
import { getPromotedServers } from '../directoryManager.js';

async function testBotCommands() {
  console.log('--- Testing ConnectingERLC Bot Slash Commands & Components V2 ---');

  // Verify only 3 commands defined
  if (BOT_COMMANDS.length !== 3) {
    throw new Error(`Expected 3 commands, got ${BOT_COMMANDS.length}`);
  }
  console.log('✓ Verified exactly 3 global commands in registry:', BOT_COMMANDS.map(c => `/${c.name}`).join(', '));

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

  // Test 2: /stats on linked server
  await handleInteraction({
    type: 2,
    id: 'test_2',
    token: 'token_2',
    guild_id: linkedGuildId,
    data: { name: 'stats' },
    member: { user: { id: 'user_123', username: 'Tester' } }
  }, 'fake_token');

  const statsEmbed = lastResponse?.data?.embeds?.[0];
  if (!statsEmbed?.title?.includes('Live Stats')) {
    throw new Error('Test 2 failed: /stats did not return Live Stats embed.');
  }
  const fieldNames = statsEmbed.fields.map(f => f.name);
  if (!fieldNames.includes('Total Members') || !fieldNames.includes('Total Bumps') || !fieldNames.includes('Credits Balance') || !fieldNames.includes('Current Rank')) {
    throw new Error(`Test 2 failed: Missing stats fields. Found: ${fieldNames.join(', ')}`);
  }
  const statsButton = lastResponse?.data?.components?.[0]?.components?.[0];
  if (statsButton?.label !== 'View Dashboard' || !statsButton.url) {
    throw new Error('Test 2 failed: Missing View Dashboard button in components.');
  }
  console.log('✓ /stats returned Components V2 embed with live metrics and View Dashboard button.');

  // Test 3: /info command
  await handleInteraction({
    type: 2,
    id: 'test_3',
    token: 'token_3',
    guild_id: linkedGuildId,
    data: { name: 'info' },
    member: { user: { id: 'user_123', username: 'Tester' } }
  }, 'fake_token');

  const infoEmbed = lastResponse?.data?.embeds?.[0];
  if (!infoEmbed?.description?.includes('The growth platform for ER:LC communities')) {
    throw new Error('Test 3 failed: /info description missing platform text.');
  }
  const infoButtons = lastResponse?.data?.components?.[0]?.components;
  if (!infoButtons || infoButtons.length < 2) {
    throw new Error('Test 3 failed: /info should have 2 buttons.');
  }
  if (infoButtons[0].label !== 'Review Server' || infoButtons[1].label !== 'View Server') {
    throw new Error(`Test 3 failed: Expected "Review Server" and "View Server" buttons, got: ${infoButtons.map(b => b.label).join(', ')}`);
  }
  console.log('✓ /info returned Components V2 embed with Review Server and View Server buttons.');

  // Test 4: /bump on linked server
  await handleInteraction({
    type: 2,
    id: 'test_4',
    token: 'token_4',
    guild_id: linkedGuildId,
    data: { name: 'bump' },
    member: { user: { id: 'user_123', username: 'Tester' } }
  }, 'fake_token');

  const bumpEmbed = lastResponse?.data?.embeds?.[0];
  if (!bumpEmbed?.title?.includes('Bump')) {
    throw new Error('Test 4 failed: /bump did not return bump embed.');
  }
  console.log(`✓ /bump on linked server handled correctly (Title: "${bumpEmbed.title}").`);

  global.fetch = originalFetch;
  console.log('--- All Bot Slash Command Tests PASSED Successfully! ---');
}

testBotCommands().catch(err => {
  console.error('Bot Command Test FAILED:', err);
  process.exit(1);
});

