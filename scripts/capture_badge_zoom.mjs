import { chromium } from 'playwright-core';
import fs from 'fs';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const s = JSON.parse(fs.readFileSync('data/web_sessions.json', 'utf8'));
  const sid = Object.keys(s)[0];
  await context.addCookies([{ name: 'connectingerlc_session', value: sid, domain: 'localhost', path: '/' }]);
  const page = await context.newPage();

  await page.route('**/api/partnerships/*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ summary: { waitingCount: 1, sentCount: 0, acceptedCount: 0, declinedCount: 0 }, requests: [] })
    });
  });

  await page.goto('http://localhost:3000/dashboard/1530147023754367006', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const partnershipsItem = page.locator('button:has-text("Partnerships")');
  if (await partnershipsItem.count() > 0) {
    await partnershipsItem.first().screenshot({ path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/partnerships_badge_zoom.png' });
  }
  await page.screenshot({ path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/sidebar_badge_1440.png' });
  await browser.close();
  console.log('Badge screenshot saved successfully');
}

main().catch(console.error);
