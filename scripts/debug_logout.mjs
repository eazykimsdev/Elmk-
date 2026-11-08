import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const SESSION_ID = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function run() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_ID,
      domain: 'localhost',
      path: '/'
    }
  ]);

  console.log('1. Navigating to dashboard as authenticated user...');
  await page.goto('http://localhost:3000/dashboard/1320109891175845988/overview', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click user trigger
  console.log('2. Opening user menu in sidebar...');
  await page.click('[data-sidebar="footer"] button');
  await page.waitForTimeout(500);

  // Click Sign out
  console.log('3. Clicking Sign out button...');
  await page.click('[role="menuitem"]:has-text("Sign out")');
  await page.waitForTimeout(2000);
  console.log('URL after sign out:', page.url());

  // 4. Now explicitly visit /login as a user who has just logged out
  console.log('4. Navigating to http://localhost:3000/login ...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  console.log('Current URL:', page.url());
  const h1 = await page.textContent('h1');
  console.log('Page H1:', h1);

  // Check localStorage
  const localKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('localStorage keys:', localKeys);
  if (localKeys.includes('erlcus_user') || localKeys.includes('connectingerlc_user')) {
    throw new Error('User identity key found in localStorage!');
  }

  // Check cookies
  const cookies = await context.cookies();
  console.log('Remaining cookies:', cookies.map(c => `${c.name}=${c.value}`));

  // Check that body text has NO username or private user details
  const bodyText = await page.innerText('body');
  if (bodyText.includes('Eazykims') || bodyText.includes('kims3166')) {
    throw new Error('User name or handle leaked on login page!');
  }
  console.log('✓ Clean login form! No user details leaked.');

  // Check that no countdown / auto-redirect exists
  if (bodyText.includes('Taking you to Discord in')) {
    throw new Error('Auto-redirect countdown is still present!');
  }
  console.log('✓ No auto-redirect countdown.');

  // Wait 4 seconds to make sure browser STAYS on /login and doesn't auto-redirect
  console.log('5. Waiting 4 seconds to verify no automatic redirect occurs...');
  await page.waitForTimeout(4000);
  console.log('URL after waiting:', page.url());
  if (page.url() !== 'http://localhost:3000/login') {
    throw new Error(`Page redirected unexpectedly to ${page.url()}`);
  }
  console.log('✓ Page firmly stayed on /login without redirecting!');

  // Take 1440px screenshot
  const shot1440 = path.join(BRAIN_DIR, 'clean_login_desktop_1440.png');
  await page.screenshot({ path: shot1440, fullPage: true });
  console.log('Saved 1440px screenshot to:', shot1440);

  // Take 390px screenshot
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const shot390 = path.join(BRAIN_DIR, 'clean_login_mobile_390.png');
  await page.screenshot({ path: shot390, fullPage: true });
  console.log('Saved 390px screenshot to:', shot390);

  await browser.close();
  console.log('\n=============================================');
  console.log('TEST PASSED 100%! USER LOGOUT IS 100% CLEAN.');
  console.log('=============================================');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
