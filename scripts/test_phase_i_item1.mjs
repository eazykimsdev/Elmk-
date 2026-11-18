import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing Item 1: Public Server Page Implementation & Open Graph...');

// 1. Verify PublicServerListingPage component content in both src/ and web/src/
const files = [
  'src/pages/PublicServerListingPage.tsx',
  'web/src/pages/PublicServerListingPage.tsx'
];

for (const file of files) {
  assert(fs.existsSync(file), `${file} should exist`);
  const content = fs.readFileSync(file, 'utf8');

  // Max width 1200px
  assert(content.includes('max-w-[1200px]'), `${file} must use max-w-[1200px]`);

  // Banner capped at 300px with 3/1 aspect ratio
  assert(content.includes('max-h-[300px]') || content.includes('aspect-[3/1]'), `${file} banner must have 3/1 ratio capped at 300px`);

  // 112px icon overlapping banner by 40px in front
  assert(content.includes('size-[112px]') || content.includes('112'), `${file} must have 112px server icon`);
  assert(content.includes('-mt-[40px]'), `${file} must overlap banner by 40px`);
  assert(content.includes('size={112}'), `${file} must pass numeric size={112} to ServerIcon to avoid frame clipping`);

  // 4 large stats with tabular numerals and line icons
  assert(content.includes('tabular-nums'), `${file} stats strip must use tabular numerals`);
  assert(content.includes('Users') && content.includes('Trophy') && content.includes('Shield') && content.includes('Coins'), `${file} must use line icons`);

  // Tabs: Overview, Reviews, Staff, Partners
  assert(content.includes("'overview'") && content.includes("'reviews'") && content.includes("'staff'") && content.includes("'partners'"), `${file} must have the 4 tabs`);

  // Badges shield row with max 6 and "View all"
  assert(content.includes('slice(0, 6)') && content.includes('View all'), `${file} must limit badges to 6 with View all modal`);

  // Live in-game panel with ER:LC key check
  assert(content.includes('Live status unavailable') || content.includes('erlc'), `${file} must show fallback when live status unavailable`);

  // Side column 340px with Owner card and Official links
  assert(content.includes('w-[340px]') || content.includes('lg:w-[340px]'), `${file} must have 340px side column`);
}

// 2. Verify server.js Open Graph injection
const serverJs = fs.readFileSync('server.js', 'utf8');
assert(serverJs.includes('og:title'), 'server.js must inject og:title');
assert(serverJs.includes('og:image'), 'server.js must inject og:image');
assert(serverJs.includes('og:description'), 'server.js must inject og:description');
assert(serverJs.includes('memberCount') || serverJs.includes('members'), 'server.js must include member count in og tags');

console.log('Item 1: ALL CHECKS PASSED');
