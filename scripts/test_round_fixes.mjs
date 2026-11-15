import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Verify marquee is rendered
  const marqueeCount = await page.locator('.mask-\\[linear-gradient\\(to_right\\,transparent\\,black_10\\%\\,black_90\\%\\,transparent\\)\\]').count();
  console.log('Server marquee rendered:', marqueeCount > 0);

  // 2. Hover over Directory icon and check tooltip
  const dirLink = page.locator('a[aria-label="Directory"]').first();
  await dirLink.hover();
  await page.waitForTimeout(400);

  // Check if tooltip arrow exists
  const arrowCount = await page.locator('[data-slot="tooltip-content"] > div, [data-slot="tooltip-content"] > svg').count();
  console.log('Tooltip arrow element count (should be 0):', arrowCount);

  // 3. Take desktop screenshot
  await page.screenshot({
    path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/home_updated_1440.png',
    fullPage: false
  });

  // 4. Mobile screenshot
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/home_updated_390.png',
    fullPage: false
  });

  console.log('Total console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Console errors:', consoleErrors);
  }

  await browser.close();
  console.log('Test completed successfully!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

