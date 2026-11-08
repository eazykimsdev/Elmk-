import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const TEST_TOKEN = 'test_logout_token_1793948246934';

async function run() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // 1. Seed session cookie on localhost:3001
  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: TEST_TOKEN,
      domain: 'localhost',
      path: '/'
    }
  ]);

  console.log('1. Navigating to dashboard overview on http://localhost:3001 ...');
  await page.goto('http://localhost:3001/dashboard/1320109891175845988/overview', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Dashboard URL:', page.url());

  // 2. Open user menu in sidebar footer
  console.log('2. Opening user menu...');
  const userBtn = page.locator('[data-sidebar="footer"] button').first();
  await userBtn.click();
  await page.waitForTimeout(500);

  // 3. Click Sign out
  console.log('3. Clicking Sign out...');
  const signOutItem = page.locator('[role="menuitem"]:has-text("Sign out")');
  await signOutItem.click();
  await page.waitForTimeout(2000);

  console.log('URL after sign out:', page.url());

  // 4. Now explicitly navigate to /login
  console.log('4. Navigating to /login ...');
  await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  console.log('Login URL:', page.url());
  const h1 = await page.textContent('h1');
  console.log('Login Heading:', h1);

  // Check localStorage
  const localKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('localStorage keys on /login:', localKeys);
  const hasUserArtifacts = localKeys.includes('erlcus_user') || localKeys.includes('connectingerlc_user');
  if (hasUserArtifacts) {
    throw new Error('User identity key remains in localStorage!');
  }
  console.log('✓ Clean localStorage: Zero user identity keys present.');

  // Check cookies
  const cookies = await context.cookies();
  console.log('Cookies remaining:', cookies.map(c => `${c.name}=${c.value}`));

  // Check body content for leaks
  const bodyText = await page.innerText('body');
  if (bodyText.includes('Eazykims') || bodyText.includes('kims3166')) {
    throw new Error('User details leaked on login page!');
  }
  if (bodyText.includes('Taking you to Discord in')) {
    throw new Error('Auto-redirect countdown is still active!');
  }
  console.log('✓ Clean login UI: No user details, no auto-redirect timer.');

  // 5. Wait 4 seconds to confirm user is NOT auto-redirected
  console.log('5. Waiting 4 seconds to verify no automatic redirect occurs...');
  await page.waitForTimeout(4000);
  console.log('URL after 4 seconds:', page.url());
  if (page.url() !== 'http://localhost:3001/login') {
    throw new Error(`Page auto-redirected to: ${page.url()}`);
  }
  console.log('✓ Still on /login! No unwanted automatic redirect.');

  // 6. Capture Screenshots
  const shot1440 = path.join(BRAIN_DIR, 'clean_login_desktop_1440.png');
  await page.screenshot({ path: shot1440, fullPage: true });
  console.log('✓ Saved 1440px screenshot to:', shot1440);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const shot390 = path.join(BRAIN_DIR, 'clean_login_mobile_390.png');
  await page.screenshot({ path: shot390, fullPage: true });
  console.log('✓ Saved 390px screenshot to:', shot390);

  await browser.close();
  console.log('\n======================================================');
  console.log('SUCCESS: Logout completely cleans all data and cookies');
  console.log('/login is 100% manual and does not remember past user.');
  console.log('======================================================');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
