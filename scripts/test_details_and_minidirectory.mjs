import { chromium } from 'playwright-core';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

const mockUser = {
  id: '523693281541095424',
  username: 'eazykims',
  globalName: 'Eazykims',
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
  },
  {
    id: '1530147023754367006',
    name: 'Liberty County Emergency RP',
    icon: null,
    iconUrl: null,
    owner: false,
    hasWorkspace: true,
    configured: true,
    memberCount: 418,
    bot_in_guild: true,
    botStatus: 'Online',
  }
];

async function setupPageRoutes(page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: mockUser,
        guilds: mockGuilds,
      }),
    });
  });

  await page.route('**/api/workspaces/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        guild: mockGuilds[0],
        workspace: {
          id: '1347902300324368414',
          name: '@ConnectingERLC',
          bot_status: 'online',
          customizations: {
            bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
            serverDescription: 'The premier roleplay community for ER:LC players with active sessions.',
            serverCategory: 'Roleplay server',
            inviteUrl: 'https://discord.gg/connectingerlc',
            reviewsEnabled: true,
          }
        },
      }),
    });
  });
}

async function run() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  // 1. Desktop Test
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  await setupPageRoutes(page);

  await page.addInitScript(
    ({ user, guilds }) => {
      localStorage.setItem('erlcus_user', JSON.stringify(user));
      localStorage.setItem('mavely_user', JSON.stringify(user));
      localStorage.setItem('mavely_token', 'mock_token');
      localStorage.setItem('erlcus_known_guilds', JSON.stringify(guilds));
      localStorage.setItem('mavely_user_guilds', JSON.stringify(guilds));
      localStorage.setItem('erlcus_current_guild', '1347902300324368414');
      localStorage.setItem('erlcus_credits_balance', '24');
    },
    { user: mockUser, guilds: mockGuilds }
  );

  console.log('Navigating desktop to /dashboard/1347902300324368414/details ...');
  await page.goto('http://localhost:3000/dashboard/1347902300324368414/details', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Capture Hero Banner
  await page.screenshot({
    path: `${BRAIN_DIR}/dashboard_server_banner_fixed.png`,
    clip: { x: 260, y: 70, width: 1140, height: 350 }
  });
  console.log('Saved dashboard_server_banner_fixed.png');

  // Scroll to Mini Directory section
  const miniDirectory = page.locator('text=Mini Directory').first();
  await miniDirectory.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Capture Mini Directory section
  await page.screenshot({
    path: `${BRAIN_DIR}/dashboard_mini_directory_section.png`
  });
  console.log('Saved dashboard_mini_directory_section.png');

  // Click on the first card in the Mini Directory to test ServerProfileModal
  const card = page.locator('div[role="button"]').first();
  if (await card.count() > 0) {
    await card.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `${BRAIN_DIR}/dashboard_mini_directory_modal_opened.png`
    });
    console.log('Saved dashboard_mini_directory_modal_opened.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  await context.close();

  // 2. Mobile Viewport Test
  const contextMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const pageMobile = await contextMobile.newPage();
  await setupPageRoutes(pageMobile);

  await pageMobile.addInitScript(
    ({ user, guilds }) => {
      localStorage.setItem('erlcus_user', JSON.stringify(user));
      localStorage.setItem('mavely_user', JSON.stringify(user));
      localStorage.setItem('mavely_token', 'mock_token');
      localStorage.setItem('erlcus_known_guilds', JSON.stringify(guilds));
      localStorage.setItem('mavely_user_guilds', JSON.stringify(guilds));
      localStorage.setItem('erlcus_current_guild', '1347902300324368414');
      localStorage.setItem('erlcus_credits_balance', '24');
    },
    { user: mockUser, guilds: mockGuilds }
  );

  console.log('Navigating mobile to /dashboard/1347902300324368414/details ...');
  await pageMobile.goto('http://localhost:3000/dashboard/1347902300324368414/details', { waitUntil: 'domcontentloaded' });
  await pageMobile.waitForTimeout(2000);

  await pageMobile.screenshot({
    path: `${BRAIN_DIR}/dashboard_mobile_banner.png`,
    clip: { x: 0, y: 50, width: 390, height: 420 }
  });
  console.log('Saved dashboard_mobile_banner.png');

  const miniMobile = pageMobile.locator('text=Mini Directory').first();
  await miniMobile.scrollIntoViewIfNeeded();
  await pageMobile.waitForTimeout(1000);

  await pageMobile.screenshot({
    path: `${BRAIN_DIR}/dashboard_mobile_mini_directory.png`
  });
  console.log('Saved dashboard_mobile_mini_directory.png');

  await contextMobile.close();
  await browser.close();
  console.log('All screenshots captured successfully.');
}

run().catch(console.error);
