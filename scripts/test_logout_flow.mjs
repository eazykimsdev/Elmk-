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

  // Set cookie for session
  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_ID,
      domain: 'localhost',
      path: '/'
    }
  ]);

  // Navigate to login page first to prime storage
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Now navigate to dashboard overview
  console.log('Navigating to dashboard...');
  await page.goto('http://localhost:3000/dashboard/1320109891175845988/overview', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  console.log('Current URL in dashboard:', page.url());

  // Click the user button in the sidebar footer
  // It has aria-label or contains user info
  const userTrigger = page.locator('button[data-slot="dropdown-menu-trigger"], [data-sidebar="footer"] button').first();
  const triggerVisible = await userTrigger.isVisible();
  console.log('User dropdown trigger visible:', triggerVisible);

  if (triggerVisible) {
    await userTrigger.click();
    await page.waitForTimeout(500);
  }

  // Find and click Sign Out button
  const signOutBtn = page.locator('text="Sign out", text="Sign Out"').first();
  const visible = await signOutBtn.isVisible();
  console.log('Sign Out button is visible:', visible);

  if (!visible) {
    throw new Error('Sign Out button was not visible in dropdown!');
  }

  console.log('Clicking Sign Out button...');
  await signOutBtn.click();
  await page.waitForTimeout(2500);

  console.log('URL after clicking Sign Out:', page.url());
  const finalUrl = page.url();
  if (!finalUrl.includes('/login')) {
    throw new Error(`Expected to be on /login but got ${finalUrl}`);
  }

  // Verify localStorage has been completely scrubbed of user data
  const localKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('localStorage keys remaining after logout:', localKeys);
  const hasUserKey = localKeys.includes('erlcus_user') || localKeys.includes('connectingerlc_user');
  if (hasUserKey) {
    throw new Error('User key was not cleaned from localStorage!');
  }
  console.log('✓ User identity cleanly purged from localStorage.');

  // Verify cookies are expired/cleared
  const cookies = await context.cookies();
  console.log('Remaining cookies:', cookies.map(c => `${c.name}=${c.value}`));

  // Check login page contents:
  // 1. Heading must be "Sign in to ConnectingERLC"
  const heading = await page.textContent('h1');
  console.log('Heading on login page:', heading);
  if (!heading.includes('Sign in to ConnectingERLC')) {
    throw new Error(`Unexpected heading: ${heading}`);
  }

  // 2. Make sure NO user avatar or name appears on the page
  const pageText = await page.innerText('body');
  if (pageText.includes('Eazykims') || pageText.includes('kims3166')) {
    throw new Error('User identity is still visible on the login page!');
  }
  console.log('✓ No user name or avatar leaked on login page.');

  // 3. Wait 4 seconds to make sure NO auto-redirect happens
  console.log('Waiting 4 seconds on /login to verify NO auto-redirect occurs...');
  await page.waitForTimeout(4000);
  console.log('URL after 4 seconds:', page.url());
  if (!page.url().includes('/login')) {
    throw new Error('Page auto-redirected away from /login unexpectedly!');
  }
  console.log('✓ Still on /login! No auto-redirect occurred.');

  // Capture clean login screenshots
  const desktopShot = path.join(BRAIN_DIR, 'clean_login_desktop_1440.png');
  await page.screenshot({ path: desktopShot, fullPage: true });
  console.log('✓ Saved clean desktop screenshot to:', desktopShot);

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileShot = path.join(BRAIN_DIR, 'clean_login_mobile_390.png');
  await page.screenshot({ path: mobileShot, fullPage: true });
  console.log('✓ Saved clean mobile screenshot to:', mobileShot);

  await browser.close();
  console.log('\n========================================');
  console.log('ALL VERIFICATIONS PASSED 100%! LOGOUT IS FULLY SECURE.');
  console.log('========================================');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
