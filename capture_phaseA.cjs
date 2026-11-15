const { chromium } = require('playwright-core');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function capture() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const setupMockState = async (page) => {
    await page.addInitScript(() => {
      const mockUser = {
        id: '123456789012345678',
        username: 'eazykims',
        globalName: 'Eazykims',
        avatar: 'b8134a63'
      };
      localStorage.setItem('mavely_user', JSON.stringify(mockUser));
      localStorage.setItem('erlcus_user', JSON.stringify(mockUser));

      const mockGuilds = [
        {
          id: '1530147023754367006',
          name: 'Liberty County Roleplay',
          icon: null,
          owner: true,
          permissions: '8',
          features: [],
          approximateMemberCount: 1420,
          hasWorkspace: true,
          configured: true
        },
        {
          id: '223456789012345679',
          name: 'Riverdale Police Department',
          icon: null,
          owner: false,
          permissions: '8',
          features: [],
          approximateMemberCount: 890,
          hasWorkspace: true,
          configured: true
        },
        {
          id: '323456789012345680',
          name: 'Aero Livery Design Studio',
          icon: null,
          owner: false,
          permissions: '8',
          features: [],
          approximateMemberCount: 650,
          hasWorkspace: false,
          configured: false
        },
        {
          id: '423456789012345681',
          name: 'Southland Fire & Rescue',
          icon: null,
          owner: false,
          permissions: '8',
          features: [],
          approximateMemberCount: 310,
          hasWorkspace: false,
          configured: false
        }
      ];
      localStorage.setItem('erlcus_known_guilds', JSON.stringify(mockGuilds));

      const mockConfig = {
        serverName: 'Liberty County Roleplay',
        serverCategory: 'Roleplay server',
        serverDescription: 'Official ER:LC roleplay community with daily supervised shifts, department sub-divisions, custom liveries and active civilian roleplay.',
        serverTags: 'roleplay, police, active, erlc',
        inviteUrl: 'https://discord.gg/liberty-county',
        joinCode: 'PRLC-102',
        bountiesClaimed: 14,
        lastBumpedAt: Date.now() - (3600 * 1000 * 2)
      };
      localStorage.setItem('erlcus_customizations_1530147023754367006', JSON.stringify(mockConfig));
      localStorage.setItem('erlcus_credits_balance', '48');
      localStorage.setItem('server_verified_joins_1530147023754367006', '14');
      localStorage.setItem('server_bumps_count_1530147023754367006', '6');
      localStorage.setItem('server_views_1530147023754367006', '128');
    });
  };

  // 1. Overview Desktop (1440px)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await setupMockState(page);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseA_overview_desktop.png') });
    await context.close();
  }

  // 2. Overview Mobile (390px)
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await setupMockState(page);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseA_overview_mobile.png') });
    await context.close();
  }

  // 3. Sidebar + User Popover Menu Desktop (1440px)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await setupMockState(page);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    // Click user footer trigger to open popover menu
    const trigger = await page.$('footer button, [data-slot="sidebar-footer"] button');
    if (trigger) {
      await trigger.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseA_usermenu_desktop.png') });
    await context.close();
  }

  // 4. Bot Setup Page Desktop (1440px) & Mobile (390px)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await setupMockState(page);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006/bot', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseA_bot_setup_desktop.png') });
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await setupMockState(page);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006/bot', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseA_bot_setup_mobile.png') });
    await context.close();
  }

  // 5. Your servers Page Desktop (1440px) & Mobile (390px)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await setupMockState(page);
    await page.goto('http://localhost:3000/servers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseA_servers_desktop.png') });
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await setupMockState(page);
    await page.goto('http://localhost:3000/servers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseA_servers_mobile.png') });
    await context.close();
  }

  // 6. Login Page Desktop (1440px) & Mobile (390px)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    // Do not set mock user so it renders login page
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseA_login_desktop.png') });
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseA_login_mobile.png') });
    await context.close();
  }

  await browser.close();
  console.log('Phase A captures completed.');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});

