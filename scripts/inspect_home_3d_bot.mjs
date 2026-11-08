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

  // Scroll to the second section
  const section = page.locator('section').nth(1);
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: `${BRAIN_DIR}/home_3d_bot_showcase.png`
  });

  // Mobile
  const pageMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pageMobile.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await pageMobile.waitForTimeout(2000);

  const sectionMobile = pageMobile.locator('section').nth(1);
  await sectionMobile.scrollIntoViewIfNeeded();
  await pageMobile.waitForTimeout(1000);

  await pageMobile.screenshot({
    path: `${BRAIN_DIR}/home_mobile_bot_showcase.png`
  });

  await browser.close();
  console.log('Scroll into view screenshots saved.');
}

run().catch(console.error);
