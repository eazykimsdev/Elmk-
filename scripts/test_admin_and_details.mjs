import { chromium } from 'playwright-core';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

const mockUser = {
  id: '523693281541095424',
  username: 'kims3166',
  globalName: 'Eazykims',
  role: 'Owner',
  avatar: null,
};

const mockGuilds = [
  {
    id: '1347902300324368414',
    name: '@ConnectingERLC',
    icon: null,
    iconUrl: 'https://theconnectingerlc.com/brand/logo.png',
    owner: true,
    hasWorkspace: true,
    configured: true,
    memberCount: 511,
    bot_in_guild: true,
    botStatus: 'Online',
  }
];

async function run() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  await page.addInitScript(
    ({ user, guilds }) => {
      localStorage.setItem('erlcus_user', JSON.stringify(user));
      localStorage.setItem('mavely_user', JSON.stringify(user));
      localStorage.setItem('connectingerlc_user', JSON.stringify(user));
      localStorage.setItem('mavely_token', 'mock_token');
      localStorage.setItem('erlcus_known_guilds', JSON.stringify(guilds));
      localStorage.setItem('mavely_user_guilds', JSON.stringify(guilds));
      localStorage.setItem('erlcus_current_guild', '1347902300324368414');
      localStorage.setItem('erlcus_credits_balance', '24');
    },
    { user: mockUser, guilds: mockGuilds }
  );

  // Set real session cookie
  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: 'd23a1d852fe70e9eaa4a1fbee6610dc64109726897785345e73b080ff8b8ff2f',
      domain: 'localhost',
      path: '/'
    }
  ]);

  // 1. Verify Server Details page (Mini Directory must be gone!)
  console.log('Navigating to Server Details page...');
  await page.goto('http://localhost:3000/dashboard/1347902300324368414/details', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const miniDirectoryCount = await page.locator('text=Mini Directory').count();
  console.log('Mini Directory count on Details page:', miniDirectoryCount);

  await page.screenshot({
    path: `${BRAIN_DIR}/details_page_no_mini_directory.png`,
    fullPage: true
  });
  console.log('Saved details_page_no_mini_directory.png');

  // 2. Verify Admin Portal User Accounts (All users & Has Server)
  console.log('Navigating to Admin Portal Users page...');
  await page.goto('http://localhost:3000/admin-portal/users', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: `${BRAIN_DIR}/admin_portal_all_users.png`
  });
  console.log('Saved admin_portal_all_users.png');

  // Click on "Has server" subtab
  const hasServerTab = page.locator('button:has-text("Has server")');
  if (await hasServerTab.count() > 0) {
    await hasServerTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${BRAIN_DIR}/admin_portal_has_server_users.png`
    });
    console.log('Saved admin_portal_has_server_users.png');
  }

  // Click first user with server to verify User Sheet
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count() > 0) {
    await firstRow.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${BRAIN_DIR}/admin_portal_user_sheet_modal.png`
    });
    console.log('Saved admin_portal_user_sheet_modal.png');
  }

  await context.close();
  await browser.close();
  console.log('Verification Playwright tests finished.');
}

run().catch(console.error);

