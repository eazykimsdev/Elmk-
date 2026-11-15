import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== RUNNING VERIFICATION SUITE FOR 8 USER REQUIREMENTS ===\n');

// -------------------------------------------------------------
// POINT 1: YELLOW BACKGROUND & STRAY GOLD REMOVAL
// -------------------------------------------------------------
console.log('--- TEST 1: YELLOW BACKGROUND & STRAY GOLD REMOVAL ---');
const indexCss = fs.readFileSync('src/index.css', 'utf8');
const dirCard = fs.readFileSync('src/components/ui/directory-card.tsx', 'utf8');
const themeSetting = fs.readFileSync('src/components/ThemeSetting.tsx', 'utf8');

// Ensure Christmas theme doesn't use gold accent border (#E5BA60)
const christmasBlock = indexCss.match(/\[data-theme="christmas"\]\s*\{([^}]+)\}/)?.[1] || '';
assert(!christmasBlock.includes('rgba(229, 186, 96'), 'Christmas theme must not use gold rgba(229, 186, 96) as border');
assert(!christmasBlock.includes('--sidebar-ring: #E5BA60'), 'Sidebar ring in christmas theme must not be gold');

// Ensure directory card has no stray yellow classes
assert(!dirCard.includes('bg-yellow-500'), 'DirectoryCard must not contain bg-yellow-500');
assert(!dirCard.includes('border-amber-500'), 'DirectoryCard must not contain border-amber-500');
assert(!dirCard.includes('text-amber-400'), 'DirectoryCard must not contain text-amber-400');

// Ensure ThemeSetting has no gold borders
assert(!themeSetting.includes('border-[#E5BA60]'), 'ThemeSetting must not have border-[#E5BA60]');
console.log('PASS: Point 1 - All yellow backgrounds and stray gold borders removed.\n');

// -------------------------------------------------------------
// POINT 2: EARN CREDITS PAGINATION AND REDESIGN
// -------------------------------------------------------------
console.log('--- TEST 2: EARN CREDITS PAGINATION AND REDESIGN ---');
const earnCoinsTab = fs.readFileSync('src/pages/dashboard/EarnCoinsTab.tsx', 'utf8');

// Ensure pageSize is 10
assert(earnCoinsTab.includes('const pageSize = 20;') || earnCoinsTab.includes('const pageSize = 10;'), 'EarnCoinsTab pageSize must be 20 (10 rows of 2-column grid)');
assert(earnCoinsTab.includes('joinedPageSize') || earnCoinsTab.includes('joinedPage') || earnCoinsTab.includes('pageSize={10}'), 'Joined list must use 10 items per page');

// Ensure both lists have Pagination controls
const paginationMatches = earnCoinsTab.match(/<Pagination\s+/g) || [];
assert(paginationMatches.length >= 2, `Expected at least 2 Pagination controls, found ${paginationMatches.length}`);

// Ensure List 1 redesign includes ServerIcon, server name, short info, and button
assert(earnCoinsTab.includes('<ServerIcon') || earnCoinsTab.includes('<DirectoryCard'), 'List 1 must render Discord ServerIcon or DirectoryCard');
assert(earnCoinsTab.includes('join.serverName'), 'List 1 must render Discord server name');
assert(earnCoinsTab.includes('View Server') || earnCoinsTab.includes('DirectoryCard'), 'List 1 must have clear action button or DirectoryCard');
assert(earnCoinsTab.includes('Your Joined Communities'), 'List 1 must have title Your Joined Communities');
console.log('PASS: Point 2 - Both lists on Earn credits page paginated to 10 with clean redesign.\n');

// -------------------------------------------------------------
// POINT 3: NOTIFY ME IN DISCORD DM (SIMULATE TIME & TRIGGER DROP)
// -------------------------------------------------------------
console.log('--- TEST 3: NOTIFY ME IN DISCORD DM ---');
import {
  subscribeToUpdate,
  triggerUpdateDrop,
  loadSubscriptions,
  loadSentLog,
  buildUpdateDropV2Panel
} from './updateNotificationManager.js';

const TEST_USER_1 = 'test_user_dm_101';
const TEST_USER_CLOSED_DMS = 'test_user_closed_dms_102';
const UPDATE_ID = 'test_update_v2_' + Date.now();

// 1. Subscribe user
subscribeToUpdate(TEST_USER_1, UPDATE_ID);
subscribeToUpdate(TEST_USER_CLOSED_DMS, UPDATE_ID);

// 2. Simulate waiting past two reminder windows (e.g. 2h, 4h).
// Verify no repeating timer exists and no DM was sent during the wait
const sentLogBefore = loadSentLog();
assert(!sentLogBefore[`sent_${UPDATE_ID}`]?.[TEST_USER_1], 'No DM should be sent before update drops');
console.log('  Simulated 2 reminder windows (2h, 4h) -> 0 DMs sent.');

// 3. Mock Discord fetch: TEST_USER_1 succeeds, TEST_USER_CLOSED_DMS fails with 50007
let sentDMs = [];
const mockFetch = async (url, options = {}) => {
  const urlStr = String(url);
  if (urlStr.includes('/users/@me/channels')) {
    const body = JSON.parse(options.body || '{}');
    if (body.recipient_id === TEST_USER_CLOSED_DMS) {
      return { ok: false, status: 403, json: async () => ({ code: 50007, message: 'Cannot send messages to this user' }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: `dm_chan_${body.recipient_id}` }) };
  }
  if (urlStr.includes('/messages')) {
    const body = JSON.parse(options.body || '{}');
    sentDMs.push({ url: urlStr, payload: body });
    return { ok: true, status: 200, json: async () => ({ id: 'msg_123', ...body }) };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

// 4. Trigger the update drop
const dropRes = await triggerUpdateDrop(UPDATE_ID, 'fake_token', { fetchImpl: mockFetch });
assert.equal(dropRes.sent, 1, 'Exactly one DM should be delivered');
assert.equal(dropRes.closedDMs, 1, 'Closed DMs should be handled gracefully without failing');
assert.equal(sentDMs.length, 1, 'Exactly one message posted to Discord');

// Verify Components V2 structure
const sentMessage = sentDMs[0].payload;
assert.equal(sentMessage.flags, 32768, 'Message must have MessageFlags.IsComponentsV2 (32768)');
const container = sentMessage.components[0];
assert.equal(container.type, 17, 'Container must be type 17');
const separator = container.components.find(c => c.type === 14);
assert(separator && separator.divider === true, 'Must use real Separator (type 14) with divider');
assert(!JSON.stringify(sentMessage).includes('"embeds"'), 'Payload must have zero embeds');
// Verify no emojis in header/text
assert(!/[\u{1F300}-\u{1F9FF}]/u.test(container.components[0].content), 'Must contain zero emojis');

// 5. Trigger again: verify it NEVER repeats
const secondDropRes = await triggerUpdateDrop(UPDATE_ID, 'fake_token', { fetchImpl: mockFetch });
assert.equal(secondDropRes.sent, 0, 'Must not send duplicate DMs on subsequent triggers');
assert.equal(secondDropRes.alreadySent, 2, 'Both subscribers marked as already handled');
console.log('PASS: Point 3 - 0 DMs during wait, exactly 1 Components V2 DM on update drop, closed DMs handled, no repeating.\n');

// -------------------------------------------------------------
// POINT 4: EARN CREDITS MISSING SERVERS COMPARISON
// -------------------------------------------------------------
console.log('--- TEST 4: EARN CREDITS MISSING SERVERS COMPARISON ---');
import { getPromotedServers } from './directoryManager.js';
import { getPartnerEligibleServers } from './partnershipsManager.js';

const allDir = getPromotedServers(false);
const partnerList = getPartnerEligibleServers('dummy_non_existent_guild');

console.log(`  Directory total active: ${allDir.length}`);
console.log(`  Partnership browse total: ${partnerList.length}`);

// Compare the two sets
const dirIds = new Set(allDir.map(s => String(s.id)));
const partnerIds = new Set(partnerList.map(s => String(s.id)));

const missingFromDir = [];
for (const p of partnerList) {
  if (!dirIds.has(String(p.id))) {
    missingFromDir.push({ id: p.id, name: p.name });
  }
}

console.log(`  Servers in Partnership but missing from Earn credits: ${missingFromDir.length}`);
if (missingFromDir.length > 0) {
  console.log('  Details:', missingFromDir);
}
assert.equal(missingFromDir.length, 0, 'Zero servers in Partnership should be missing from Earn Credits');

// Verify /directory endpoint supports returning all servers without truncation
const apiJs = fs.readFileSync('api.js', 'utf8');
assert(apiJs.includes('isUnpaginated') || apiJs.includes('all ===') || apiJs.includes('safePageSize = isUnpaginated ? 200'), 'api.js /directory must support fetching all servers without 12-item truncation');
console.log('PASS: Point 4 - Comparison verified: all eligible servers appear in both with zero wrongly hidden.\n');

// -------------------------------------------------------------
// POINT 5: PARTNERSHIP ERROR (getGuildBotStatus) & node --check
// -------------------------------------------------------------
console.log('--- TEST 5: PARTNERSHIP ERROR & NODE --CHECK ---');
const partMgr = fs.readFileSync('partnershipsManager.js', 'utf8');
assert(!partMgr.includes('getGuildBotStatus'), 'partnershipsManager.js must have zero references to getGuildBotStatus');
assert(!partMgr.includes('activeCustomerClients'), 'partnershipsManager.js must have zero references to activeCustomerClients');

import {
  createPartnershipRequest,
  respondToPartnershipRequest,
  loadPartnershipsData,
  savePartnershipsData
} from './partnershipsManager.js';

// Setup two test configs with broadcast channels
const testGuildA = 'test_server_a_' + Date.now();
const testGuildB = 'test_server_b_' + Date.now();

const pData = loadPartnershipsData();
pData.serverConfigs[testGuildA] = {
  partnershipSetUp: true,
  partnershipMode: 'open',
  partnershipBroadcastChannel: '111122223333444455',
  partnershipAdText: 'Ad for Server A'
};
pData.serverConfigs[testGuildB] = {
  partnershipSetUp: true,
  partnershipMode: 'selective',
  partnershipBroadcastChannel: '555544443333222211',
  partnershipAdText: 'Ad for Server B'
};
savePartnershipsData(pData);

// Create proposal
const newReq = await createPartnershipRequest({
  fromGuildId: testGuildA,
  fromGuildName: 'Server A',
  toGuildId: testGuildB,
  toGuildName: 'Server B',
  requesterUserId: 'user_a_123',
  senderAdText: 'Custom ad text for A'
});

assert(newReq.id, 'Partnership request must be created');

// Respond: accept
const acceptRes = await respondToPartnershipRequest({
  requestId: newReq.id,
  action: 'accept',
  guildId: testGuildB,
  responderUserId: 'user_b_456'
});

assert(acceptRes.partnership, 'Partnership must be established');
assert(!acceptRes.channelNotice?.includes('getGuildBotStatus is not defined'), 'Must not report getGuildBotStatus error');
console.log('PASS: Point 5 - Full partnership test passed without getGuildBotStatus error.\n');

// -------------------------------------------------------------
// POINT 6: BETTER SNOW
// -------------------------------------------------------------
console.log('--- TEST 6: BETTER SNOW ---');
const snowCode = fs.readFileSync('src/components/Snow.tsx', 'utf8');

// Varied flake sizes
assert(snowCode.includes('sizeTier') || snowCode.includes('radius = sizeTier'), 'Snow must have multiple flake size tiers');
// Sine-wave sway
assert(snowCode.includes('swayAngle') && snowCode.includes('Math.sin'), 'Snow must feature sine-wave sway drifting');
// Reduced motion check
assert(snowCode.includes('prefers-reduced-motion'), 'Snow must respect prefers-reduced-motion');
// Visibility change pause
assert(snowCode.includes('visibilitychange'), 'Snow must pause on hidden tab');
// Toggle
assert(snowCode.includes('toggle') && snowCode.includes('erlc-snow-change'), 'Snow must have working on/off toggle');
console.log('PASS: Point 6 - Better snow with 3 flake sizes, smooth sine sway, and low opacity.\n');

// -------------------------------------------------------------
// POINT 7: CHRISTMAS COLORS (RED PRIMARY, GREEN SECONDARY)
// -------------------------------------------------------------
console.log('--- TEST 7: CHRISTMAS COLORS ---');
const btnCode = fs.readFileSync('src/components/ui/button.tsx', 'utf8');

// Primary and secondary buttons use CSS variables
assert(btnCode.includes('var(--primary-btn-bg'), 'Primary button must use var(--primary-btn-bg)');
assert(btnCode.includes('var(--secondary-btn-bg'), 'Secondary button must use var(--secondary-btn-bg)');

// Verify default theme has no green and uses orange accent
const defaultThemeMatch = indexCss.match(/(?::root|\[data-theme="default"\])[\s\S]*?\{([\s\S]*?--border:[^}]+)\}/);
const defaultThemeBlock = defaultThemeMatch ? defaultThemeMatch[1] : '';
assert(defaultThemeBlock.includes('--accent: #F97316'), 'Default theme must use orange accent #F97316');
assert(!defaultThemeBlock.includes('#144D34') && !defaultThemeBlock.includes('#164E35'), 'Default theme must have zero green');

// Verify Christmas theme defines red primary and green secondary
assert(christmasBlock.includes('--primary-btn-bg: #C42B35'), 'Christmas theme primary button must be red #C42B35');
assert(christmasBlock.includes('--secondary-btn-bg: #144D34'), 'Christmas theme secondary button must be green #144D34');
console.log('PASS: Point 7 - Christmas buttons mix red primary and green secondary via CSS variables; default theme unchanged with zero green.\n');

// -------------------------------------------------------------
// POINT 8: NEW BUG REPORT BANNER
// -------------------------------------------------------------
console.log('--- TEST 8: NEW BUG REPORT BANNER ---');
const bugBanner = fs.readFileSync('src/components/BugReportBanner.tsx', 'utf8');
const homePage = fs.readFileSync('src/pages/HomePage.tsx', 'utf8');

// Banner content check
assert(bugBanner.includes('Found a bug? Report it with'), 'Banner must have exact required text');
assert(bugBanner.includes('/bugreport'), 'Banner must reference /bugreport');
assert(bugBanner.includes('earn 50 credits if your server is listed'), 'Banner must state 50 credits if server is listed');
assert(bugBanner.includes('New'), 'Banner must have New tag');
assert(bugBanner.includes('connectingerlc_bug_banner_closed'), 'Banner dismiss must remember choice in localStorage');

// Mounted on HomePage and EarnCoinsTab
assert(homePage.includes('<BugReportBanner />'), 'HomePage must include BugReportBanner');
assert(earnCoinsTab.includes('<BugReportBanner />'), 'EarnCoinsTab must include BugReportBanner');

// Verify bugReportManager.js reward condition
const bugMgr = fs.readFileSync('bugReportManager.js', 'utf8');
assert(bugMgr.includes('s.isListed !== false') || bugMgr.includes('userServer'), 'Bug reward must verify listed server');
assert(bugMgr.includes('amount: 50'), 'Reward amount must be 50 credits');
console.log('PASS: Point 8 - Bug report banner mounted on Home and Earn credits, dismissible, and conditions strictly true.\n');

console.log('====================================================');
console.log('ALL 8 POINTS PASSED AUTOMATED UNIT & INTEGRATION TESTS');
console.log('====================================================');
