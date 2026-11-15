import fs from 'fs';
import assert from 'assert';

console.log('======================================================================');
console.log(' RUNNING VERIFICATION: SUPPORT SERVER INVITE URLS & BANNED PAGE APPEAL');
console.log('======================================================================\n');

const TARGET_SUPPORT_URL = 'https://discord.gg/connectingerlc';

// TEST 1: BRAND CONFIGURATION
console.log('--- TEST 1: BRAND CONFIGURATION ---');
const brandSrc = fs.readFileSync('src/config/brand.ts', 'utf8');
const webBrandSrc = fs.readFileSync('web/src/config/brand.ts', 'utf8');
assert(brandSrc.includes(TARGET_SUPPORT_URL), `src/config/brand.ts must default supportInvite to ${TARGET_SUPPORT_URL}`);
assert(webBrandSrc.includes(TARGET_SUPPORT_URL), `web/src/config/brand.ts must default supportInvite to ${TARGET_SUPPORT_URL}`);
assert(!brandSrc.includes('discord.gg/central'), 'src/config/brand.ts must not contain obsolete central invite');
console.log(`PASS: BRAND.supportInvite defaults to ${TARGET_SUPPORT_URL}\n`);

// TEST 2: BANNED PAGE APPEAL BUTTON
console.log('--- TEST 2: BANNED PAGE APPEAL BUTTON ---');
const bannedSrc = fs.readFileSync('src/pages/BannedPage.tsx', 'utf8');
const webBannedSrc = fs.readFileSync('web/src/pages/BannedPage.tsx', 'utf8');
assert(bannedSrc.includes('Join the support server to appeal'), 'BannedPage must have appeal button');
assert(bannedSrc.includes('BRAND.supportInvite') && bannedSrc.includes(TARGET_SUPPORT_URL), `BannedPage must link appeal button to ${TARGET_SUPPORT_URL}`);
assert(webBannedSrc.includes('BRAND.supportInvite') && webBannedSrc.includes(TARGET_SUPPORT_URL), `web/src/pages/BannedPage.tsx must link appeal button to ${TARGET_SUPPORT_URL}`);
console.log(`PASS: BannedPage appeal button securely links to ${TARGET_SUPPORT_URL}\n`);

// TEST 3: DASHBOARD SIDEBAR SUPPORT
console.log('--- TEST 3: DASHBOARD SIDEBAR SUPPORT LINK ---');
const sidebarSrc = fs.readFileSync('src/components/DashboardSidebar.tsx', 'utf8');
const webSidebarSrc = fs.readFileSync('web/src/components/DashboardSidebar.tsx', 'utf8');
assert(sidebarSrc.includes(TARGET_SUPPORT_URL), `DashboardSidebar must open ${TARGET_SUPPORT_URL}`);
assert(webSidebarSrc.includes(TARGET_SUPPORT_URL), `web/src/components/DashboardSidebar must open ${TARGET_SUPPORT_URL}`);
assert(!sidebarSrc.includes('discord.gg/mavely'), 'DashboardSidebar must not contain mavely invite');
console.log(`PASS: DashboardSidebar opens ${TARGET_SUPPORT_URL} on Support click\n`);

// TEST 4: PUBLIC NAVIGATION & HOMEPAGE SUPPORT URL
console.log('--- TEST 4: PUBLIC NAVIGATION & HOMEPAGE ---');
const homeSrc = fs.readFileSync('src/pages/HomePage.tsx', 'utf8');
const publicRailSrc = fs.readFileSync('src/components/ui/PublicIconRail.tsx', 'utf8');
assert(homeSrc.includes(TARGET_SUPPORT_URL), `HomePage must use ${TARGET_SUPPORT_URL}`);
assert(publicRailSrc.includes(TARGET_SUPPORT_URL), `PublicIconRail must use ${TARGET_SUPPORT_URL}`);
console.log(`PASS: HomePage and PublicIconRail point to ${TARGET_SUPPORT_URL}\n`);

// TEST 5: BACKEND API BAN RESPONSE
console.log('--- TEST 5: BACKEND API BAN RESPONSES ---');
const apiSrc = fs.readFileSync('api.js', 'utf8');
assert(apiSrc.includes(TARGET_SUPPORT_URL), `api.js must return ${TARGET_SUPPORT_URL} for banned users and support invites`);
console.log(`PASS: Backend API provides ${TARGET_SUPPORT_URL} in ban payloads\n`);

console.log('======================================================================');
console.log(' ALL SUPPORT URL CHECKS PASSED (5/5)');
console.log('======================================================================');
