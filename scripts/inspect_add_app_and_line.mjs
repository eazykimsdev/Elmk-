import { chromium } from 'playwright-core';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function run() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check the + Add App link
  const addAppLink = page.locator('a[title="Add ConnectingERLC App to Discord"]');
  const count = await addAppLink.count();
  console.log('Add App Link count:', count);
  if (count > 0) {
    const href = await addAppLink.getAttribute('href');
    console.log('Add App Link href:', href);
    const box = await addAppLink.boundingBox();
    console.log('Add App Link bounding box:', box);
  }

  // Capture hero area with the marquee and divider line below it
  await page.screenshot({
    path: `${BRAIN_DIR}/home_hero_clean_divider.png`,
    clip: { x: 0, y: 0, width: 1440, height: 950 }
  });

  // Scroll to Showcase
  const section = page.locator('section').nth(1);
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Capture Showcase with transparent 3D card
  await page.screenshot({
    path: `${BRAIN_DIR}/home_showcase_transparent_card.png`
  });

  await browser.close();
  console.log('Inspection complete.');
}

run().catch(console.error);

