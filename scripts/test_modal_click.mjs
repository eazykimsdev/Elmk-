import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('http://localhost:3000/directory', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const viewBtns = page.locator('button:has-text("View")');
  const count = await viewBtns.count();
  console.log('View buttons count on /directory:', count);

  for (let i = 0; i < count; i++) {
    const html = await viewBtns.nth(i).evaluate(el => el.outerHTML);
    console.log(`Button ${i}:`, html);
  }

  // Click the card View button inside the directory grid
  const cardViewBtn = page.locator('.grid button:has-text("View")').first();
  if (await cardViewBtn.isVisible()) {
    console.log('Clicking card View button...');
    await cardViewBtn.click();
    await page.waitForTimeout(1000);
    console.log('URL after click:', page.url());
    console.log('Dialog role count:', await page.locator('[role="dialog"]').count());
    console.log('Visible dialogs:', await page.locator('[role="dialog"]').isVisible());
  }

  await browser.close();
}

run();
