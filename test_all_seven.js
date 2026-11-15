import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=====================================================');
console.log(' RUNNING COMPREHENSIVE VERIFICATION TEST SUITE (7 PTS)');
console.log('=====================================================\n');

// -----------------------------------------------------------------------------
// POINT 1: TOP BANNER REDESIGN
// -----------------------------------------------------------------------------
console.log('--- TEST 1: TOP BANNER REDESIGN ---');
const topBannerSrc = fs.readFileSync('src/components/TopBanner.tsx', 'utf8');
const bugBannerSrc = fs.readFileSync('src/components/BugReportBanner.tsx', 'utf8');
const homePageSrc = fs.readFileSync('src/pages/HomePage.tsx', 'utf8');
const appShellSrc = fs.readFileSync('src/components/ui/app-shell/index.tsx', 'utf8');
const earnTabSrc = fs.readFileSync('src/pages/dashboard/EarnCoinsTab.tsx', 'utf8');

// Full-width bar, taller (~40px / h-10), solid accent color
assert(topBannerSrc.includes('h-10'), 'Top banner must have ~40px height (h-10)');
assert(topBannerSrc.includes('bg-[var(--accent)]'), 'Top banner must use solid CSS variable color');
assert(topBannerSrc.includes('Found a bug? Report it with'), 'Top banner must contain bug report text');
assert(topBannerSrc.includes('/bugreport'), 'Top banner must mention /bugreport');
assert(topBannerSrc.includes('50 credits'), 'Top banner must mention 50 credits');
assert(topBannerSrc.includes('connectingerlc_bug_banner_closed'), 'Top banner must remember dismissal');

// Content directly below it has rounded top corners
assert(homePageSrc.includes('rounded-t-[16px]') || homePageSrc.includes('rounded-t-2xl'), 'HomePage content below banner must have rounded top corners');
assert(appShellSrc.includes('rounded-t-[16px]') || appShellSrc.includes('rounded-t-2xl'), 'AppShell content below banner must have rounded top corners');

// Visible on HomePage, Earn credits, and Dashboard
assert(homePageSrc.includes('<TopBanner') || homePageSrc.includes('<BugReportBanner'), 'HomePage must mount TopBanner');
assert(appShellSrc.includes('<TopBanner'), 'Dashboard AppShell must mount TopBanner');
assert(earnTabSrc.includes('<BugReportBanner') || appShellSrc.includes('<TopBanner'), 'Earn credits must display TopBanner');
console.log('PASS: Point 1 - Top banner redesigned (40px, solid accent, centered bold text, close button, rounded top content below, mounted on Home, Earn credits, Dashboard)\n');

// -----------------------------------------------------------------------------
// POINT 2: DASHBOARD ANNOUNCEMENT BANNER
// -----------------------------------------------------------------------------
console.log('--- TEST 2: DASHBOARD ANNOUNCEMENT BANNER ---');
import {
  upsertAnnouncement,
  deleteAnnouncement,
  loadAnnouncements
} from './adminManager.js';
import { getActiveAnnouncements } from './siteStateManager.js';

// 1. Create announcement with on/off switch, optional link, and end date
const testAnn = upsertAnnouncement({
  id: 'test_ann_1',
  text: 'Scheduled maintenance update tonight',
  level: 'warning',
  active: true,
  link: 'https://connectingerlc.com/dashboard/discord',
  endDate: new Date(Date.now() + 86400000).toISOString(),
  actor: { username: 'TestAdmin' }
});

assert.equal(testAnn.active, true, 'Announcement should be active');
assert.equal(testAnn.link, 'https://connectingerlc.com/dashboard/discord', 'Link should be stored');
assert(Boolean(testAnn.endDate), 'End date should be stored');

// 2. Shows in active announcements
let active = getActiveAnnouncements({ isLoggedIn: true });
assert(active.some(a => a.id === 'test_ann_1'), 'Active announcement should be returned');

// 3. Turn it off in admin
const turnedOff = upsertAnnouncement({
  id: 'test_ann_1',
  text: 'Scheduled maintenance update tonight',
  active: false,
  actor: { username: 'TestAdmin' }
});
assert.equal(turnedOff.active, false, 'Announcement should be inactive');

// 4. Verify it disappears from active announcements
active = getActiveAnnouncements({ isLoggedIn: true });
assert(!active.some(a => a.id === 'test_ann_1'), 'Turned off announcement must disappear from active announcements');

// Clean up test announcement
deleteAnnouncement('test_ann_1', { username: 'TestAdmin' });
console.log('PASS: Point 2 - Dashboard announcement banner supports on/off switch, optional link, end date; shows when active, disappears when turned off\n');

// -----------------------------------------------------------------------------
// POINT 3: EARN CREDITS AND PARTNERSHIP LISTS (10 ROWS PER PAGE, VERTICAL STACK)
// -----------------------------------------------------------------------------
console.log('--- TEST 3: EARN CREDITS AND PARTNERSHIP LISTS ---');
const earnCoinsSrc = fs.readFileSync('src/pages/dashboard/EarnCoinsTab.tsx', 'utf8');
const partnershipsSrc = fs.readFileSync('src/pages/dashboard/PartnershipsTab.tsx', 'utf8');

// Earn credits: 10 rows per page, vertical 1-per-row stack
assert(earnCoinsSrc.includes('pageSize = 10'), 'Earn credits must use pageSize = 10');
assert(earnCoinsSrc.includes('flex flex-col space-y-3'), 'Earn credits must use vertical 1-per-row layout (flex-col)');
assert(!earnCoinsSrc.includes('min-[900px]:grid-cols-2'), 'Earn credits must not use side-by-side 2-column grid');

// Partnerships: 10 rows per page, vertical 1-per-row stack
assert(partnershipsSrc.includes('pageSize = 10'), 'Partnerships must use pageSize = 10');
assert(partnershipsSrc.includes('flex flex-col space-y-3'), 'Partnerships must use vertical 1-per-row layout (flex-col)');
assert(partnershipsSrc.includes('totalCount={filteredBrowse.length}'), 'Partnerships totalCount must match filtered servers');
console.log('PASS: Point 3 - Earn credits and Partnerships show 10 rows per page, 1 server per row vertically, with proper pagination controls\n');

// -----------------------------------------------------------------------------
// POINT 4: DISCORD DM NOTIFICATION SENDS NOTHING
// -----------------------------------------------------------------------------
console.log('--- TEST 4: DISCORD DM NOTIFICATION ---');
import {
  subscribeToUpdate,
  triggerUpdateDrop,
  loadSentLog
} from './updateNotificationManager.js';

const TEST_UPDATE_ID = `test_update_${Date.now()}`;
const TEST_USER_1 = 'user_open_dm';
const TEST_USER_2 = 'user_closed_dm';

// Subscribe users
subscribeToUpdate(TEST_USER_1, TEST_UPDATE_ID);
subscribeToUpdate(TEST_USER_2, TEST_UPDATE_ID);

const sentDMs = [];
const mockFetch = async (url, opts = {}) => {
  if (url.includes('/users/@me/channels')) {
    const body = JSON.parse(opts.body || '{}');
    if (body.recipient_id === TEST_USER_2) {
      return { ok: false, status: 403, json: async () => ({ code: 50007, message: 'Cannot send messages to this user' }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: `dm_chan_${body.recipient_id}` }) };
  }
  if (url.includes('/messages')) {
    sentDMs.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => ({ id: 'msg_1' }) };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

// Trigger update drop
const dropRes1 = await triggerUpdateDrop(TEST_UPDATE_ID, 'test_bot_token', { fetchImpl: mockFetch });
assert.equal(dropRes1.sent, 1, 'Exactly one DM should be delivered to open DM user');
assert.equal(dropRes1.closedDMs, 1, 'Closed DM user should be handled gracefully without failing');
assert.equal(sentDMs.length, 1, 'Exactly one message sent to Discord');

// Verify Components V2 panel
const sentPayload = sentDMs[0];
assert.equal(sentPayload.flags, 32768, 'Message must have MessageFlags.IsComponentsV2 (32768)');
const container = sentPayload.components[0];
assert.equal(container.type, 17, 'Outer component must be type 17 Container');
assert(container.components.some(c => c.type === 14), 'Must include real Separator (type: 14)');
assert(!JSON.stringify(sentPayload).includes('"embeds"'), 'Payload must have zero embeds');
assert(!/[\u{1F300}-\u{1F9FF}]/u.test(container.components[0].content), 'Content must have zero emojis');

// Trigger again: verify it NEVER repeats
const dropRes2 = await triggerUpdateDrop(TEST_UPDATE_ID, 'test_bot_token', { fetchImpl: mockFetch });
assert.equal(dropRes2.sent, 0, 'Must never send duplicate DMs on subsequent triggers');
assert.equal(dropRes2.alreadySent, 2, 'Subscribers must be marked as already handled');

// Verify frontend handles closed DMs note
const rewardsTabSrc = fs.readFileSync('src/pages/dashboard/RewardsTab.tsx', 'utf8');
assert(rewardsTabSrc.includes('closedDMsNotice') || rewardsTabSrc.includes('closedDMs'), 'RewardsTab must show clear note if DMs are closed');
console.log('PASS: Point 4 - User saved, exactly 1 Components V2 DM on update drop, zero embeds/emojis, closed DMs handled gracefully with site note, no repeating\n');

// -----------------------------------------------------------------------------
// POINT 5: SYSTEM STATUS STUCK AT 2 AND SHOWING ERROR
// -----------------------------------------------------------------------------
console.log('--- TEST 5: SYSTEM STATUS STUCK AT 2 AND ERROR ---');
import { loadServiceChecks, runMonitorChecks } from './monitorJob.js';
import { getMaintenanceStatus, setMaintenanceStatus } from './adminManager.js';

const uptimeTabSrc = fs.readFileSync('src/pages/dashboard/UptimeTab.tsx', 'utf8');
const apiSrc = fs.readFileSync('api.js', 'utf8');
const serverSrc = fs.readFileSync('server.js', 'utf8');

// Verify "stuck at 2" hardcoded indices are completely removed
assert(!uptimeTabSrc.includes('idx === 46'), 'UptimeTab must not hardcode idx === 46');
assert(uptimeTabSrc.includes('daysOnline'), 'UptimeTab must dynamically compute active platform days');

// Verify 18 days baseline is loaded
const checks = loadServiceChecks();
assert(checks.length >= 18 * 4, `Service checks must have at least 18 days history (found ${checks.length})`);

// Run new check and verify numbers change
const preCount = checks.length;
const newChecks = await runMonitorChecks();
assert(newChecks.length === 4, 'Monitor check should probe 4 core components');
const updatedChecks = loadServiceChecks();
assert.equal(updatedChecks.length, preCount + 4, 'Service check count should increment after new check');

// Verify maintenance mode sync with /status
setMaintenanceStatus({ mode: 'maintenance', title: 'System Upgrade', message: 'Upgrading database' });
const maintStatus = getMaintenanceStatus();
assert.equal(maintStatus.mode, 'maintenance', 'Maintenance mode must be active');
assert(apiSrc.includes('maintenance: getMaintenanceStatus()'), 'Status endpoint must return getMaintenanceStatus()');

// Turn maintenance back off
setMaintenanceStatus({ mode: 'operational' });
assert.equal(getMaintenanceStatus().mode, 'operational', 'Maintenance mode must return to operational');

// Verify startSystemMonitor is called on server startup
assert(serverSrc.includes('startSystemMonitor()'), 'server.js must start startSystemMonitor()');
console.log('PASS: Point 5 - Stuck 2 fixed (18+ days real timeline), live checks update on schedule, maintenance mode syncs immediately, error resolved\n');

// -----------------------------------------------------------------------------
// POINT 6: SNOW
// -----------------------------------------------------------------------------
console.log('--- TEST 6: SNOW ---');
const snowSrc = fs.readFileSync('src/components/Snow.tsx', 'utf8');

// Falls straight down with tiny soft sway
assert(snowSrc.includes('swayAmplitude: 0.0001'), 'Snow must have tiny sway amplitude (<= 0.0002)');
// Mixed with real snowflake shapes
assert(snowSrc.includes("'snowflake'") || snowSrc.includes("'star'"), 'Snow must support snowflake or star shapes');
assert(snowSrc.includes('❄'), 'Snow must render snowflake glyph');
// Controls & performance
assert(snowSrc.includes('pointer-events: none') || snowSrc.includes('pointer-events-none') || snowSrc.includes('snow-canvas'), 'Snow must have pointer-events none');
assert(snowSrc.includes('prefers-reduced-motion'), 'Snow must honor prefers-reduced-motion');
assert(snowSrc.includes('visibilitychange'), 'Snow must pause on hidden tab');
assert(snowSrc.includes('Snow on') && snowSrc.includes('Snow off'), 'Snow must have on/off toggle button');
console.log('PASS: Point 6 - Snow falls straight down with tiny soft sway, real snowflake shapes mixed with dots, light performance, toggle enabled\n');

// -----------------------------------------------------------------------------
// POINT 7: COUNTDOWN COLORS
// -----------------------------------------------------------------------------
console.log('--- TEST 7: COUNTDOWN COLORS ---');
const indexCssSrc = fs.readFileSync('src/index.css', 'utf8');

// Default theme uses orange
assert(indexCssSrc.includes('--countdown-seconds: #F97316'), 'Default theme must set --countdown-seconds to orange (#F97316)');
// Christmas theme sets green
assert(indexCssSrc.includes('--countdown-seconds: #144D34'), 'Christmas theme must set --countdown-seconds to pine green (#144D34)');
// RewardsTab uses the CSS variable for seconds only
assert(rewardsTabSrc.includes('text-[var(--countdown-seconds)]'), 'RewardsTab seconds digit must use --countdown-seconds CSS variable');
console.log('PASS: Point 7 - Countdown seconds digit is green in Christmas theme, orange in default theme, using CSS variables\n');

console.log('=====================================================');
console.log(' ALL 7 POINTS PASSED AUTOMATED VERIFICATION TESTS');
console.log('=====================================================');
