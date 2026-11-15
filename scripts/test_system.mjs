import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import { createDashboardRouter } from '../api.js';
import { GLOBAL_BOT_COMMANDS } from '../botCommands.js';
import { setMaintenanceStatus } from '../adminManager.js';
import { invalidateSiteStateCache } from '../siteStateManager.js';

async function run() {
  console.log('--- Running ConnectingERLC System Verification Tests ---');

  // Ensure operational state for base system tests
  setMaintenanceStatus({ mode: 'operational', title: '', message: '', actor: { username: 'SystemTest' } });
  delete process.env.MAINTENANCE_FORCE_OFF;
  invalidateSiteStateCache();

  // 1. Bot Slash Commands verification
  const commandNames = GLOBAL_BOT_COMMANDS.map(c => c.name);
  assert(commandNames.includes('bump'), 'Must include /bump');
  assert(commandNames.includes('bugreport'), 'Must include /bugreport');
  assert(commandNames.includes('ad'), 'Must include /ad');
  assert(commandNames.includes('setup'), 'Must include /setup');
  assert(commandNames.includes('status'), 'Must include /status');
  assert(commandNames.includes('leaderboard'), 'Must include /leaderboard');
  assert(commandNames.includes('website'), 'Must include /website');
  console.log(`  ✓ Bot Commands check: ${GLOBAL_BOT_COMMANDS.length} commands verified including /website.`);

  // 2. Start self-contained in-memory server for API tests
  const app = express();
  app.use(express.json());
  app.use('/api', createDashboardRouter());

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // Test Status endpoint
    const statusRes = await fetch(`${baseUrl}/status`);
    assert.strictEqual(statusRes.status, 200, 'Status endpoint returned 200');
    const statusData = await statusRes.json();
    assert.ok(statusData.status === 'online', 'Platform status is online');
    console.log(`  ✓ Status API check: ${statusData.status} | Bot status: ${statusData.botStatus}`);

    // Test Public Showcase endpoint
    const showcaseRes = await fetch(`${baseUrl}/public/showcase?limit=20`);
    assert.strictEqual(showcaseRes.status, 200, 'Showcase endpoint returned 200');
    const showcaseData = await showcaseRes.json();
    const list = Array.isArray(showcaseData) ? showcaseData : (showcaseData.servers || showcaseData.listings || []);
    console.log(`  ✓ Showcase API check: ${list.length} servers returned.`);

    // Test Discord Connection Channels/Roles cached endpoint
    const dummyGuildId = '1347902300324368414';
    const channelsRes = await fetch(`${baseUrl}/servers/${dummyGuildId}/discord/channels`);
    assert.strictEqual(channelsRes.status, 200, 'Channels endpoint returned 200');
    const channelsData = await channelsRes.json();
    assert.ok(Array.isArray(channelsData.channels), 'Channels returned array');
    console.log(`  ✓ Discord Channels endpoint verified: ${channelsData.channels.length} channels.`);

    console.log('✓ All system tests passed successfully.');
    process.exit(0);
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
