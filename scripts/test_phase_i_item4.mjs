import assert from 'assert';
import fs from 'fs';

console.log('Testing Item 4: Earn Credits Layout (Featured Panel)...');

const earnCoinsSource = fs.readFileSync('src/pages/dashboard/EarnCoinsTab.tsx', 'utf8');

// 1. Verify right side sticky panel exists on desktop
assert(earnCoinsSource.includes('lg:sticky lg:top-6'), 'Must have lg:sticky lg:top-6 for desktop sticky positioning');

// 2. Verify panel is called "Featured"
assert(earnCoinsSource.includes('Featured'), 'Must have panel called Featured');

// 3. Verify mobile positioning (above the list on mobile)
assert(earnCoinsSource.includes('order-first lg:order-last'), 'Must place featured panel above list on mobile (order-first) and to the right on desktop (lg:order-last)');

// 4. Verify calm empty state when no featured servers
assert(earnCoinsSource.includes('No featured communities'), 'Must show calm empty state when no featured servers');

// 5. Verify featured servers are derived from isFeaturedSpot
assert(earnCoinsSource.includes('s.isFeaturedSpot'), 'Must filter by isFeaturedSpot');

// 6. Verify main list width and two-column flex container
assert(earnCoinsSource.includes('flex flex-col lg:flex-row items-start gap-6 w-full'), 'Must wrap in responsive two-column flex layout');

console.log('Item 4: ALL CHECKS PASSED');
