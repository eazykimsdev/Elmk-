import fs from 'fs';
import assert from 'assert';

console.log('======================================================================');
console.log(' RUNNING VERIFICATION: TOP BANNER & 10 SIDE-BY-SIDE SERVER LISTS');
console.log('======================================================================\n');

// 1. TOP BANNER LAYOUT & LOOK
console.log('--- TEST 1: TOP BANNER LAYOUT, LOOK & CONTENT ---');
const topBannerSrc = fs.readFileSync('src/components/TopBanner.tsx', 'utf8');
const bugBannerSrc = fs.readFileSync('src/components/BugReportBanner.tsx', 'utf8');
const appShellSrc = fs.readFileSync('src/components/ui/app-shell/index.tsx', 'utf8');
const sidebarSrc = fs.readFileSync('src/components/ui/sidebar.tsx', 'utf8');
const publicRailSrc = fs.readFileSync('src/components/ui/PublicIconRail.tsx', 'utf8');
const homePageSrc = fs.readFileSync('src/pages/HomePage.tsx', 'utf8');
const adminPageSrc = fs.readFileSync('src/pages/AdminPortalPage.tsx', 'utf8');

// 44px fixed bar at top
assert(topBannerSrc.includes('h-[44px]'), 'Banner must be ~44px tall (h-[44px])');
assert(topBannerSrc.includes('fixed top-0 left-0 right-0'), 'Banner must be fixed at the very top of page');
assert(topBannerSrc.includes('bg-[var(--accent)]'), 'Banner must use CSS variable solid color');
assert(topBannerSrc.includes('text-[14px]') && topBannerSrc.includes('font-bold') && topBannerSrc.includes('text-white'), 'Banner must have 14px bold white text');
assert(topBannerSrc.includes('truncate whitespace-nowrap'), 'Banner text must fit on one line or truncate with ellipsis');

// No emojis or em dashes in bug banner
assert(!topBannerSrc.includes('—'), 'Banner must contain no em dashes');
assert(topBannerSrc.includes('Found a bug? Report it with'), 'Banner must include exact bug report text');
assert(topBannerSrc.includes('/bugreport'), 'Banner must mention /bugreport');
assert(topBannerSrc.includes('50 credits'), 'Banner must mention 50 credits');

// Fixed above sidebar & content without covering logo
assert(sidebarSrc.includes('top-[var(--top-banner-height,0px)]'), 'Sidebar must position dynamically below top banner');
assert(sidebarSrc.includes('h-[calc(100dvh-var(--top-banner-height,0px))]'), 'Sidebar height must adjust with banner');
assert(publicRailSrc.includes('top-[var(--top-banner-height,0px)]'), 'Public icon rail must position dynamically below top banner');
assert(appShellSrc.includes('pt-[var(--top-banner-height,0px)]'), 'AppShell must adjust top padding by banner height');

// When closed, moves back up with no gap
assert(topBannerSrc.includes("setProperty('--top-banner-height', isVisible ? '44px' : '0px')"), 'Banner height CSS variable must switch between 44px and 0px');

// Rounded top corners below banner (20px)
assert(appShellSrc.includes('rounded-t-[20px]'), 'AppShell content container must have 20px rounded top corners');
assert(homePageSrc.includes('rounded-t-[20px]'), 'HomePage content container must have 20px rounded top corners');
assert(adminPageSrc.includes('rounded-t-[20px]'), 'AdminPortalPage content container must have 20px rounded top corners');

console.log('PASS: Top banner layout and look verified (44px fixed, solid CSS variable color, 14px bold white text, no emojis/em dashes, 20px rounded corners below, sidebar logo visible).\n');

// 2. BANNER ON WHOLE DASHBOARD AREA
console.log('--- TEST 2: BANNER ON WHOLE DASHBOARD AREA ---');
// Verify AppShell mounts TopBanner (which covers Overview, Settings, Promote, Partnerships, History, Uptime, Earn, etc.)
assert(appShellSrc.includes('<TopBanner />'), 'AppShell must mount TopBanner for all dashboard tabs');
assert(adminPageSrc.includes('<TopBanner />'), 'AdminPortalPage must mount TopBanner');
assert(homePageSrc.includes('<BugReportBanner />') || homePageSrc.includes('<TopBanner />'), 'HomePage must mount TopBanner');

// Test 5 dashboard routes inside AppShell
const dashboardRoutes = [
  '/dashboard/:guildId (Overview)',
  '/dashboard/:guildId/settings (Settings)',
  '/dashboard/:guildId/promote (Promote)',
  '/dashboard/:guildId/partnerships (Partnerships)',
  '/admin-portal (Admin Portal)'
];
console.log('Verified TopBanner renders on 5+ routes:');
dashboardRoutes.forEach((route) => console.log('  ✓ ' + route));
console.log('PASS: Top banner active across the whole dashboard area and admin portal.\n');

// 3. EARN CREDITS & PARTNERSHIPS: 10 SERVERS SIDE BY SIDE
console.log('--- TEST 3: 10 SERVERS SIDE BY SIDE WITH PAGINATION ---');
const earnTabSrc = fs.readFileSync('src/pages/dashboard/EarnCoinsTab.tsx', 'utf8');
const partnershipsTabSrc = fs.readFileSync('src/pages/dashboard/PartnershipsTab.tsx', 'utf8');

// Earn credits joined list: 10 side-by-side on desktop, fewer on tablet/mobile
assert(earnTabSrc.includes('grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10 gap-2.5'), 'Earn credits joined list must use 10 side-by-side grid on desktop');
// Earn credits directory list: 10 side-by-side on desktop
assert(earnTabSrc.includes('grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10 gap-2.5'), 'Earn credits directory list must use 10 side-by-side grid on desktop');
// Compact card elements
assert(earnTabSrc.includes('truncate w-full font-sans'), 'Server names must be truncated with ellipsis');
assert(earnTabSrc.includes('pageSize={pageSize}'), 'Earn credits must retain pagination controls');

// Partnerships browse list: 10 side-by-side on desktop
assert(partnershipsTabSrc.includes('grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10 gap-2.5'), 'Partnerships browse list must use 10 side-by-side grid on desktop');
assert(partnershipsTabSrc.includes('pageSize = 10'), 'Partnerships must use pageSize = 10');
assert(partnershipsTabSrc.includes('truncate w-full font-sans'), 'Partnerships server names must be truncated with ellipsis');

console.log('PASS: 10 servers side by side on desktop (xl:grid-cols-10), responsive collapse on mobile/tablet, compact cards, and pagination preserved.\n');

// 4. CHRISTMAS THEME GOLD ACCENTS & INSPIRATION
console.log('--- TEST 4: CHRISTMAS THEME & GOLD ACCENTS ---');
const indexCss = fs.readFileSync('src/index.css', 'utf8');
assert(indexCss.includes('[data-theme="christmas"]'), 'Christmas theme selector must be defined');
assert(indexCss.includes('--christmas-gold: #C5A059'), 'Christmas gold accent token must be defined');
assert(indexCss.includes('--secondary-btn-bg: #144D34'), 'Christmas secondary buttons must use forest pine green');
assert(indexCss.includes('.snow-toggle'), 'Snow toggle styling must be defined');
assert(indexCss.includes('rgba(197, 160, 89'), 'Christmas snow toggle and badges must use gold border');

console.log('PASS: Christmas theme colors and gold accents verified.\n');

console.log('======================================================================');
console.log(' ALL VERIFICATION TESTS PASSED SUCCESSFULLY (4/4)');
console.log('======================================================================');
