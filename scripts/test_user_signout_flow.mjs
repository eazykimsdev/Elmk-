import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const GUILD_ID = '1320109891175845988';

async function run() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Seed localStorage and cookie
  await page.addInitScript((guildId) => {
    localStorage.setItem('erlcus_default_guild', guildId);
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      { id: guildId, name: 'Alabama State Roleplay', icon: null }
    ]));
    localStorage.setItem('connectingerlc_user', JSON.stringify({
      id: '523693281541095424',
      username: 'kims3166',
      globalName: 'Eazykims'
    }));
    localStorage.setItem('erlcus_user', JSON.stringify({
      id: '523693281541095424',
      username: 'kims3166',
      globalName: 'Eazykims'
    }));
  }, GUILD_ID);

  console.log('1. Navigating to dashboard overview...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/overview`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Dashboard URL:', page.url());

  // Check user footer trigger
  const userBtn = page.locator('[data-sidebar="footer"] button').first();
  const triggerVisible = await userBtn.isVisible();
  console.log('User footer trigger visible:', triggerVisible);

  if (triggerVisible) {
    await userBtn.click();
    await page.waitForTimeout(500);

    const signOutItem = page.locator('[role="menuitem"]:has-text("Sign out")');
    const signOutVisible = await signOutItem.isVisible();
    console.log('Sign out menu item visible:', signOutVisible);

    if (signOutVisible) {
      console.log('Clicking Sign out...');
      await signOutItem.click();
      await page.waitForTimeout(2500);
    }
  }

  console.log('URL after clicking Sign Out:', page.url());

  // 2. Now user visits /login directly
  console.log('2. Visiting /login ...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('Login URL:', page.url());
  const h1 = await page.textContent('h1');
  console.log('Login Heading:', h1);

  // Assert localStorage has zero user keys
  const localKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('localStorage keys on /login:', localKeys);
  const userKeys = localKeys.filter(k => k.includes('user') || k.includes('guild'));
  if (userKeys.length > 0) {
    throw new Error(`Remaining user keys in localStorage: ${userKeys.join(', ')}`);
  }
  console.log('✓ Zero user keys in localStorage.');

  // Assert no user details on page
  const bodyText = await page.innerText('body');
  if (bodyText.includes('Eazykims') || bodyText.includes('kims3166')) {
    throw new Error('User details leaked on /login page!');
  }
  if (bodyText.includes('Taking you to Discord in')) {
    throw new Error('Auto-redirect countdown is present!');
  }
  console.log('✓ Clean /login page: no user info, no auto-redirect countdown.');

  // Assert no auto-redirect after 4 seconds
  console.log('3. Waiting 4 seconds on /login to ensure user is NOT redirected...');
  await page.waitForTimeout(4000);
  console.log('URL after waiting 4 seconds:', page.url());
  if (page.url() !== 'http://localhost:3000/login') {
    throw new Error(`Page auto-redirected to ${page.url()}!`);
  }
  console.log('✓ Successfully stayed on /login without redirecting!');

  // Capture clean login screenshots
  const shot1440 = path.join(BRAIN_DIR, 'clean_login_desktop_1440.png');
  await page.screenshot({ path: shot1440, fullPage: true });
  console.log('✓ Saved 1440px screenshot to:', shot1440);

  // Mobile 390px
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const shot390 = path.join(BRAIN_DIR, 'clean_login_mobile_390.png');
  await page.screenshot({ path: shot390, fullPage: true });
  console.log('✓ Saved 390px screenshot to:', shot390);

  await browser.close();
  console.log('\n=============================================');
  console.log('ALL VERIFICATIONS PASSED 100%!');
  console.log('=============================================');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

