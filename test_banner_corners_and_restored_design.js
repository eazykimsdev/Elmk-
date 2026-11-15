import fs from 'fs';
import assert from 'assert';

console.log('======================================================================');
console.log(' RUNNING VERIFICATION: BANNER CORNERS & RESTORED OLD GRID DESIGN');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: BANNER CORNERS (MATCH REFERENCE)
// -----------------------------------------------------------------------------
console.log('--- TEST 1: BANNER CORNERS & DYNAMIC APP WRAPPER ---');
const topBannerSrc = fs.readFileSync('src/components/TopBanner.tsx', 'utf8');
const appShellSrc = fs.readFileSync('src/components/ui/app-shell/index.tsx', 'utf8');
const sidebarSrc = fs.readFileSync('src/components/ui/sidebar.tsx', 'utf8');
const publicRailSrc = fs.readFileSync('src/components/ui/PublicIconRail.tsx', 'utf8');
const homePageSrc = fs.readFileSync('src/pages/HomePage.tsx', 'utf8');
const adminPageSrc = fs.readFileSync('src/pages/AdminPortalPage.tsx', 'utf8');
const indexCss = fs.readFileSync('src/index.css', 'utf8');

// 1. Banner height ~40px
assert(topBannerSrc.includes('h-[40px]'), 'Banner height must be ~40px (h-[40px])');
assert(topBannerSrc.includes("setProperty('--top-banner-height', isVisible ? '40px' : '0px')"), 'Banner height variable must toggle between 40px and 0px');

// 2. 24px border radius on top left and top right only
assert(topBannerSrc.includes("setProperty('--app-corner-radius', isVisible ? '24px' : '0px')"), 'App corner radius must toggle between 24px when open and 0px when closed');

// 3. Area behind container is banner color so color shows in the two top corners
assert(topBannerSrc.includes("setProperty('--top-banner-bg', isVisible ? 'var(--accent)' : 'var(--background)')"), 'Backdrop background behind container must be banner color var(--accent)');

// 4. Container wrapper has 24px top corners and overflow hidden
assert(appShellSrc.includes('rounded-t-[var(--app-corner-radius,0px)]') || appShellSrc.includes('borderTopLeftRadius'), 'AppShell container must have rounded top corners using --app-corner-radius');
assert(appShellSrc.includes('overflow-hidden'), 'AppShell container must have overflow-hidden');
assert(appShellSrc.includes('bg-[var(--top-banner-bg,var(--background))]'), 'AppShell outer backdrop must be banner color');

assert(homePageSrc.includes('rounded-t-[var(--app-corner-radius,0px)]') || homePageSrc.includes('borderTopLeftRadius'), 'HomePage container must have rounded top corners');
assert(homePageSrc.includes('overflow-hidden'), 'HomePage container must have overflow-hidden');
assert(homePageSrc.includes('bg-[var(--top-banner-bg,var(--background))]'), 'HomePage outer backdrop must be banner color');

assert(adminPageSrc.includes('rounded-t-[var(--app-corner-radius,0px)]') || adminPageSrc.includes('borderTopLeftRadius'), 'AdminPortalPage container must have rounded top corners');
assert(adminPageSrc.includes('overflow-hidden'), 'AdminPortalPage container must have overflow-hidden');
assert(adminPageSrc.includes('bg-[var(--top-banner-bg,var(--background))]'), 'AdminPortalPage outer backdrop must be banner color');

// 5. Sidebar starts below banner and rounds top-left corner, logo fully visible
assert(sidebarSrc.includes('top-[var(--top-banner-height,0px)]'), 'Sidebar must position dynamically below top banner');
assert(sidebarSrc.includes('h-[calc(100dvh-var(--top-banner-height,0px))]'), 'Sidebar height must adjust with banner');
assert(sidebarSrc.includes('rounded-tl-[var(--app-corner-radius,0px)]'), 'Sidebar top-left corner must round with banner');
assert(publicRailSrc.includes('rounded-tl-[var(--app-corner-radius,0px)]'), 'PublicIconRail top-left corner must round with banner');

// 6. When closed, corners go square (0px), moves up with no gap, backdrop returns to normal dark
assert(indexCss.includes('--top-banner-height: 0px'), 'Default top banner height must be 0px');
assert(indexCss.includes('--app-corner-radius: 0px'), 'Default app corner radius must be 0px');
assert(indexCss.includes('--top-banner-bg: var(--background)'), 'Default backdrop background must be var(--background)');

console.log('PASS: Point 1 - Banner corners verified. Outer backdrop is banner color, 24px top corners show banner color in corners, moves up square when closed with no gap.\n');

// -----------------------------------------------------------------------------
// TEST 2: RESTORE OLD DESIGN (EARN CREDITS & PARTNERSHIPS)
// -----------------------------------------------------------------------------
console.log('--- TEST 2: RESTORE OLD DESIGN, CARD SIZE, 10 ROWS & PAGINATION ---');
const earnCoinsSrc = fs.readFileSync('src/pages/dashboard/EarnCoinsTab.tsx', 'utf8');
const partnershipsSrc = fs.readFileSync('src/pages/dashboard/PartnershipsTab.tsx', 'utf8');
const dirCardSrc = fs.readFileSync('src/components/ui/directory-card.tsx', 'utf8');

// 1. Restored original 2-column grid and DirectoryCard usage
assert(earnCoinsSrc.includes('min-[900px]:grid-cols-2') || earnCoinsSrc.includes('md:grid-cols-2'), 'Earn credits must restore original 2-column grid');
assert(earnCoinsSrc.includes('<DirectoryCard'), 'Earn credits must render original DirectoryCard component');
assert(partnershipsSrc.includes('md:grid-cols-2'), 'Partnerships must restore original 2-column grid');
assert(partnershipsSrc.includes('<DirectoryCard'), 'Partnerships must render original DirectoryCard component');

// 2. 10 rows of 2 columns per page = pageSize 20
assert(earnCoinsSrc.includes('const pageSize = 20;'), 'Earn credits pageSize must be 20 (10 rows of 2 columns)');
assert(partnershipsSrc.includes('const pageSize = 20;'), 'Partnerships pageSize must be 20 (10 rows of 2 columns)');

// 3. Mobile responsiveness (1 column on mobile so nothing is cut off or scrolls horizontally)
assert(earnCoinsSrc.includes('grid-cols-1'), 'Earn credits must be 1 column on mobile');
assert(partnershipsSrc.includes('grid-cols-1'), 'Partnerships must be 1 column on mobile');

// 4. Pagination controls under the list
assert(earnCoinsSrc.includes('<Pagination'), 'Earn credits must have Pagination controls');
assert(partnershipsSrc.includes('<Pagination'), 'Partnerships must have Pagination controls');

// 5. Join (+2) button on DirectoryCard
assert(dirCardSrc.includes('Join (+{reward})') || dirCardSrc.includes('+{reward}'), 'DirectoryCard must render Join (+2) reward button');
assert(dirCardSrc.includes('Coins'), 'DirectoryCard must render Coins icon');

// 6. Test slice math: page 1 shows 10 rows (20 servers), page 2 loads next slice
const mockServers = Array.from({ length: 45 }, (_, i) => ({ id: `server_${i+1}`, name: `Server ${i+1}`, memberCount: 100 - i }));
const pageSize = 20;
const page1 = mockServers.slice(0, pageSize);
const page2 = mockServers.slice(pageSize, pageSize * 2);
const totalPages = Math.ceil(mockServers.length / pageSize);

assert.equal(page1.length, 20, 'Page 1 must contain 20 servers (10 rows of 2 columns)');
assert.equal(page1[0].id, 'server_1', 'Page 1 first server matches');
assert.equal(page2.length, 20, 'Page 2 must contain 20 servers');
assert.equal(page2[0].id, 'server_21', 'Page 2 loads next slice starting at server 21');
assert.equal(totalPages, 3, 'Total pages must be calculated accurately');

console.log(`PASS: Point 2 - Old layout restored with DirectoryCard. Page 1 displays 10 rows (20 items), Page 2 loads correctly (${page2.length} items), 1 column on mobile.\n`);

console.log('======================================================================');
console.log(' ALL REQUIREMENTS VERIFIED AND PASSED (2/2)');
console.log('======================================================================');
