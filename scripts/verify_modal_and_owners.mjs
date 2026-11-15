import { chromium } from 'playwright-core';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SESSION_TOKEN = 'd23a1d852fe70e9eaa4a1fbee6610dc64109726897785345e73b080ff8b8ff2f';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE_PATH, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_TOKEN,
      domain: 'localhost',
      path: '/',
    },
  ]);
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/servers ...');
  await page.goto('http://localhost:3000/servers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/servers_directory_verified.png' });
  console.log('Saved servers_directory_verified.png');

  // Open modal for ConnectingERLC
  console.log('Opening modal for @ConnectingERLC (1347902300324368414) ...');
  await page.goto('http://localhost:3000/servers?server=1347902300324368414', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/modal_connectingerlc_verified.png' });
  console.log('Saved modal_connectingerlc_verified.png');

  // Open modal for Qatar Airways
  console.log('Opening modal for Qatar Airways (1517130661306171472) ...');
  await page.goto('http://localhost:3000/servers?server=1517130661306171472', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/modal_qatar_verified.png' });
  console.log('Saved modal_qatar_verified.png');

  // Check login preview
  console.log('Opening login page ...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/login_overview_preview_verified.png' });
  console.log('Saved login_overview_preview_verified.png');

  await browser.close();
  console.log('Verification screenshots captured successfully.');
})();
