import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const context = await browser.newContext();
  await context.addCookies([{
    name: 'connectingerlc_session',
    value: 'round9_phasea_session_token_1793941678769',
    domain: 'localhost',
    path: '/'
  }]);
  const page = await context.newPage();
  await page.goto('http://localhost:3000/dashboard/1320109891175845988/earn?server=1320109891175845988', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const isDialog = await page.locator('div[role="dialog"]').isVisible();
  console.log('Dialog visible?', isDialog);
  if (isDialog) {
    const title = await page.locator('#server-details-title').innerText();
    console.log('Dialog title:', title);
  } else {
    console.log('Buttons on page:', await page.locator('button').allInnerTexts());
  }
  await browser.close();
}

run();

