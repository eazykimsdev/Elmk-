import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  console.log('Navigating to /s/1347902300324368414...');
  await page.goto('http://localhost:3000/s/1347902300324368414', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('URL:', page.url());
  console.log('Dialog role count:', await page.locator('[role="dialog"]').count());
  console.log('Visible dialogs:', await page.locator('[role="dialog"]').isVisible());

  await browser.close();
}

run();

