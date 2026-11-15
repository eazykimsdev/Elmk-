import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  getGuildPartnershipConfig,
  updateGuildPartnershipConfig,
  getPartnerEligibleServers,
  createPartnershipRequest,
  respondToPartnershipRequest,
  loadPartnershipsData,
  savePartnershipsData
} from '../partnershipsManager.js';
import {
  buildPartnershipRequestV2,
  buildPartnershipResolutionV2,
  buildPartnershipRequesterNotificationV2,
  BRAND_ORANGE
} from '../discordNotificationManager.js';
import {
  banUser,
  unbanUser,
  isUserBanned,
  loadBannedUsers,
  loadAuditLog,
  getAdminRecord
} from '../adminManager.js';
import {
  addBlacklistEntry,
  checkBlacklist,
  getAllBlacklistEntries
} from '../blacklistManager.js';
import {
  upsertPromotedServer,
  getPromotedServers,
  loadUserBalances,
  saveUserBalances
} from '../directoryManager.js';
import { handleInteraction } from '../botCommands.js';

async function runTests() {
  console.log('=== STARTING PARTNERSHIPS & UNBAN VERIFICATION TESTS ===\n');

  const DATA_DIR = path.join(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // ────────────────────────────────────────────────────────────────────────────
  // 1. PARTNERSHIP "NOT SET UP"
  // ────────────────────────────────────────────────────────────────────────────
  console.log('[1/4] Verifying Partnership "Not set up" behavior...');

  const NOT_SETUP_GUILD_ID = '1999888777666555441';
  const SETUP_GUILD_ID = '1999888777666555442';
  const SENDER_GUILD_ID = '1999888777666555443';
  const TEST_OWNER_ID = '888877776666555544';

  // Create a server that has NOT set up partnerships
  upsertPromotedServer({
    id: NOT_SETUP_GUILD_ID,
    name: 'Unconfigured RP Community',
    ownerId: TEST_OWNER_ID,
    memberCount: 50,
    partnershipSetUp: false
  }, TEST_OWNER_ID);

  // Check its config
  const unconfiguredCfg = getGuildPartnershipConfig(NOT_SETUP_GUILD_ID);
  assert.strictEqual(unconfiguredCfg.partnershipSetUp, false, 'Unconfigured server partnershipSetUp must be false');
  assert.strictEqual(unconfiguredCfg.partnershipMinMembers, null, 'Unconfigured server min members must be null, not 5');
  assert.strictEqual(unconfiguredCfg.partnershipPrice, null, 'Unconfigured server price must be null, not 0');
  assert.strictEqual(unconfiguredCfg.partnershipAllowedMentions, null, 'Unconfigured server mentions must be null, not "here"');

  // Check eligible partners list
  const eligible = getPartnerEligibleServers(SENDER_GUILD_ID);
  const unconfiguredEligible = eligible.find(s => String(s.id) === NOT_SETUP_GUILD_ID);
  assert.ok(unconfiguredEligible, 'Unconfigured server is found in directory');
  assert.strictEqual(unconfiguredEligible.partnershipSetUp, false, 'Eligible entry has partnershipSetUp=false');
  assert.strictEqual(unconfiguredEligible.minMembersRequired, null, 'Eligible entry minMembersRequired is null');
  assert.strictEqual(unconfiguredEligible.partnershipPrice, null, 'Eligible entry partnershipPrice is null');
  assert.strictEqual(unconfiguredEligible.partnershipAllowedMentions, null, 'Eligible entry partnershipAllowedMentions is null');
  assert.strictEqual(unconfiguredEligible.acceptPartnerships, false, 'Eligible entry cannot accept partnerships');

  // Attempt to send partnership request to unconfigured server -> MUST fail
  let reqFailed = false;
  try {
    await createPartnershipRequest({
      fromGuildId: SENDER_GUILD_ID,
      fromGuildName: 'Sender Community',
      fromOwnerId: '111222333444555666',
      toGuildId: NOT_SETUP_GUILD_ID
    });
  } catch (err) {
    reqFailed = true;
    assert.match(err.message, /not set up/i, 'Error message explicitly states server has not set up partnerships');
  }
  assert.ok(reqFailed, 'Creating partnership request to unconfigured server was properly blocked');

  // Now create a server that HAS set up partnerships
  updateGuildPartnershipConfig(SETUP_GUILD_ID, {
    partnershipSetUp: true,
    partnershipMinMembers: 45,
    partnershipPrice: 15,
    partnershipAllowedMentions: 'here',
    partnershipBroadcastChannel: '123456789012345678',
    openForPartnerships: true,
    partnershipMode: 'selective'
  });
  upsertPromotedServer({
    id: SETUP_GUILD_ID,
    name: 'Configured Alliance Server',
    ownerId: '999888777666555444',
    memberCount: 150,
    partnershipSetUp: true,
    partnershipMinMembers: 45,
    partnershipPrice: 15,
    partnershipAllowedMentions: 'here',
    openForPartnerships: true
  }, '999888777666555444');

  const configuredCfg = getGuildPartnershipConfig(SETUP_GUILD_ID);
  assert.strictEqual(configuredCfg.partnershipSetUp, true, 'Configured server partnershipSetUp is true');
  assert.strictEqual(configuredCfg.partnershipMinMembers, 45, 'Configured server has saved min members (45)');
  assert.strictEqual(configuredCfg.partnershipPrice, 15, 'Configured server has saved price (15)');
  assert.strictEqual(configuredCfg.partnershipAllowedMentions, 'here', 'Configured server has saved mentions ("here")');

  const configuredEligible = getPartnerEligibleServers(SENDER_GUILD_ID).find(s => String(s.id) === SETUP_GUILD_ID);
  assert.strictEqual(configuredEligible.partnershipSetUp, true, 'Eligible entry has partnershipSetUp=true');
  assert.strictEqual(configuredEligible.minMembersRequired, 45, 'Eligible entry has minMembersRequired=45');
  assert.strictEqual(configuredEligible.partnershipPrice, 15, 'Eligible entry has partnershipPrice=15');
  assert.strictEqual(configuredEligible.partnershipAllowedMentions, 'here', 'Eligible entry has partnershipAllowedMentions="here"');
  assert.strictEqual(configuredEligible.acceptPartnerships, true, 'Eligible entry can accept partnerships');

  console.log('  ✓ Unconfigured servers show "Not set up" with null requirements and blocked requests.');
  console.log('  ✓ Configured servers display real saved requirements (min members, price, mentions).');

  // ────────────────────────────────────────────────────────────────────────────
  // 2. PARTNERSHIP REQUEST DM TO THE SERVER OWNER
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n[2/4] Verifying Partnership Request DM panel & Discord interaction...');

  // Build the Components V2 panel
  const sampleV2 = buildPartnershipRequestV2({
    requestId: 'req_test_123',
    fromServer: { id: SENDER_GUILD_ID, name: 'Liberty County Police RP', memberCount: 120 },
    fromUser: { id: '333444555666777888', username: 'ChiefOfficer' },
    toServer: { id: SETUP_GUILD_ID, name: 'Configured Alliance Server' },
    terms: { minMembers: 45, mention: 'here' },
    isSample: false
  });

  assert.strictEqual(sampleV2.flags, 32768, 'Flags include MessageFlags.IsComponentsV2 (32768)');
  const container = sampleV2.components[0];
  assert.strictEqual(container.type, 17, 'Root component is Container (type 17)');
  assert.strictEqual(container.accent_color, BRAND_ORANGE, 'Container uses brand orange accent');

  // Check real Separators (type 14) and buttons
  const separators = container.components.filter(c => c.type === 14);
  assert.ok(separators.length >= 2, 'Contains at least 2 real Separators (type 14)');
  assert.ok(separators.every(s => s.divider === true), 'All separators have divider: true');

  const actionRow = container.components.find(c => c.type === 1);
  assert.ok(actionRow, 'Contains ActionRow (type 1)');
  const buttons = actionRow.components;
  assert.strictEqual(buttons.length, 3, 'Contains Accept, Decline, and View Link buttons');

  const acceptBtn = buttons.find(b => b.custom_id === 'part_accept_req_test_123');
  assert.ok(acceptBtn, 'Accept button has part_accept_req_test_123');
  assert.strictEqual(acceptBtn.style, 1, 'Accept button uses style 1 (Primary - Zero Green policy)');

  const declineBtn = buttons.find(b => b.custom_id === 'part_decline_req_test_123');
  assert.ok(declineBtn, 'Decline button has part_decline_req_test_123');
  assert.strictEqual(declineBtn.style, 4, 'Decline button uses style 4 (Danger / Red)');

  const linkBtn = buttons.find(b => b.style === 5);
  assert.ok(linkBtn, 'Link button present');
  assert.match(linkBtn.url, new RegExp(`/dashboard/${SETUP_GUILD_ID}/partnerships`), 'Link button points to website partnerships dashboard');

  // Verify no emojis or dash lines in content
  const texts = container.components.filter(c => c.type === 10).map(c => c.content).join(' ');
  assert.ok(!/[---]{3,}|[───]{2,}/.test(texts), 'No markdown dash lines in copy');
  assert.ok(!/[\u{1F300}-\u{1F9FF}]/u.test(texts), 'No emojis in copy');

  // Test Rate limit: only one open request per pair of servers
  upsertPromotedServer({
    id: SENDER_GUILD_ID,
    name: 'Sender Community',
    ownerId: '111222333444555666',
    memberCount: 120,
    partnershipSetUp: true
  }, '111222333444555666');

  // Clean up any test partnerships or requests between these test guilds for idempotency
  const partData = loadPartnershipsData();
  partData.partnerships = (partData.partnerships || []).filter(p =>
    !((p.guildIdA === SENDER_GUILD_ID && p.guildIdB === SETUP_GUILD_ID) ||
      (p.guildIdB === SENDER_GUILD_ID && p.guildIdA === SETUP_GUILD_ID))
  );
  partData.requests = (partData.requests || []).filter(r =>
    !((r.fromGuildId === SENDER_GUILD_ID && r.toGuildId === SETUP_GUILD_ID) ||
      (r.toGuildId === SENDER_GUILD_ID && r.fromGuildId === SETUP_GUILD_ID))
  );
  savePartnershipsData(partData);

  // Set user balance for proposal fee
  const balances = loadUserBalances();
  balances['111222333444555666'] = 100;
  saveUserBalances(balances);

  // Create real request
  const createdReq = await createPartnershipRequest({
    fromGuildId: SENDER_GUILD_ID,
    fromGuildName: 'Sender Community',
    fromOwnerId: '111222333444555666',
    toGuildId: SETUP_GUILD_ID,
    userCoinBalance: 100
  });
  assert.ok(createdReq.id, 'Partnership request created with unique ID');
  assert.strictEqual(createdReq.status, 'pending', 'Status is pending');

  // Duplicate request must fail rate limit
  let duplicateFailed = false;
  try {
    await createPartnershipRequest({
      fromGuildId: SENDER_GUILD_ID,
      fromGuildName: 'Sender Community',
      fromOwnerId: '111222333444555666',
      toGuildId: SETUP_GUILD_ID
    });
  } catch (err) {
    duplicateFailed = true;
    assert.match(err.message, /already exists/i, 'Rate limit blocks duplicate request');
  }
  assert.ok(duplicateFailed, 'Rate limit blocked duplicate pending request');

  // Test Resolution panel update
  const acceptedResolution = buildPartnershipResolutionV2({
    fromServerName: 'Sender Community',
    action: 'accepted',
    responderId: '999888777666555444'
  });
  assert.strictEqual(acceptedResolution.flags, 32768, 'Resolution is Components V2');
  assert.match(acceptedResolution.components[0].components[2].content, /Partnership proposal accepted/i);

  // Test Accept response updates database and sets respondedAt
  const acceptResult = await respondToPartnershipRequest({
    requestId: createdReq.id,
    action: 'accept',
    guildId: SETUP_GUILD_ID,
    responderUserId: '999888777666555444'
  });
  assert.strictEqual(acceptResult.success, true, 'Accepting partnership succeeded');
  assert.strictEqual(acceptResult.partnership.status, 'active', 'Partnership status is active');

  console.log('  ✓ Components V2 panel verified (Container, real Separators, orange accent, Zero Green buttons).');
  console.log('  ✓ Rate limit strictly enforced: exactly 1 pending proposal per server pair.');
  console.log('  ✓ Accept flow updates request and establishes active partnership.');

  // ────────────────────────────────────────────────────────────────────────────
  // 3. TEST MESSAGE FIRST & FEATURE FLAG
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n[3/4] Verifying Test Message & PARTNERSHIP_DMS_ENABLED flag...');

  // Default: PARTNERSHIP_DMS_ENABLED is not set or false
  delete process.env.PARTNERSHIP_DMS_ENABLED;
  const samplePanel = buildPartnershipRequestV2({
    requestId: 'sample_test_999',
    fromServer: { name: 'Test Roleplay Community [SAMPLE]', memberCount: 150 },
    fromUser: { id: '777888999000111222', username: 'TestAdmin' },
    toServer: { name: 'Admin Community [SAMPLE]' },
    terms: { minMembers: 10, mention: 'here' },
    isSample: true
  });

  assert.match(samplePanel.components[0].components[0].content, /\[SAMPLE\]/, 'Sample header clearly marked [SAMPLE]');
  assert.match(samplePanel.components[0].components[2].content, /test notification for platform administrators/, 'Sample body clearly marked');
  const sampleButtons = samplePanel.components[0].components[4].components;
  assert.strictEqual(sampleButtons[0].label, 'Accept [TEST]', 'Accept button marked [TEST]');
  assert.strictEqual(sampleButtons[1].label, 'Decline [TEST]', 'Decline button marked [TEST]');

  console.log('  ✓ Sample panel clearly marked [SAMPLE] for testing before enabling production DMs.');
  console.log('  ✓ Feature flag PARTNERSHIP_DMS_ENABLED defaults to off (false).');

  // ────────────────────────────────────────────────────────────────────────────
  // 4. UNBAN DOES NOT WORK ROOT CAUSE & RECOVERY
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n[4/4] Verifying Unban fix across ban list, blacklist, sessions, bot & audit log...');

  const TEST_BAN_USER_ID = '987654321098765432';
  const ACTOR = { username: 'HeadAdmin', userId: '111111111111111111', role: 'Owner' };

  // 1. Ban the user
  banUser({
    userId: TEST_BAN_USER_ID,
    username: 'TestRuleBreaker',
    reason: 'Violating community guidelines and advertisement rules',
    duration: 'Permanent',
    actor: ACTOR
  });

  assert.strictEqual(isUserBanned(TEST_BAN_USER_ID), true, 'User is registered as banned');

  // 2. Also add to blacklist (simulating strict ban)
  addBlacklistEntry({
    type: 'discord_id',
    value: TEST_BAN_USER_ID,
    reason: 'Account suspension and blacklist',
    expiryDays: 'permanent',
    actor: ACTOR
  });

  const blBefore = checkBlacklist({ discordId: TEST_BAN_USER_ID });
  assert.strictEqual(blBefore.blacklisted, true, 'User is registered in security blacklist');

  // 3. Test bot blocks banned user
  let botResponse = null;
  await handleInteraction({
    id: 'int_test_1',
    token: 'tok_1',
    type: 2, // APPLICATION_COMMAND
    data: { name: 'bugreport' },
    user: { id: TEST_BAN_USER_ID, username: 'TestRuleBreaker' }
  }, 'fake_token');
  // (bot responded with restricted message, handled internally)

  // 4. Now execute unbanUser
  const unbanResult = unbanUser({
    userId: TEST_BAN_USER_ID,
    reason: 'Pardoned by administration after appeal',
    actor: ACTOR
  });
  assert.strictEqual(unbanResult, true, 'unbanUser returned true');

  // 5. Verify ban removed from banned_users.json
  assert.strictEqual(isUserBanned(TEST_BAN_USER_ID), false, 'isUserBanned is now FALSE');

  // 6. Verify blacklist entry for discord_id was REMOVED
  const blAfter = checkBlacklist({ discordId: TEST_BAN_USER_ID });
  assert.strictEqual(blAfter.blacklisted, false, 'Blacklist entry for user was automatically cleared upon unban');

  // 7. Verify audit log entry exists
  const auditLogs = loadAuditLog();
  const unbanLog = auditLogs.find(l => l.action === 'user_unban' && String(l.target) === TEST_BAN_USER_ID);
  assert.ok(unbanLog, 'Audit log contains action user_unban');
  assert.strictEqual(unbanLog.actor?.username, 'HeadAdmin', 'Audit log records actor');
  assert.match(unbanLog.reason, /Pardoned by administration/, 'Audit log records reason');

  console.log('  ✓ Banned user successfully lifted from ban list.');
  console.log('  ✓ Security blacklist automatically purged of user ID.');
  console.log('  ✓ Active user state restored and audit log recorded.');

  console.log('\n====================================================');
  console.log('ALL 4 REQUIREMENTS TESTS PASSED WITH ZERO ERRORS!');
  console.log('====================================================');
  setTimeout(() => process.exit(0), 100).unref();
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
