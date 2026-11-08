import { chromium } from '../node_modules/playwright-core/index.mjs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE_URL = 'http://localhost:3000';

const mockUser = {
  id: '523693281541095424',
  username: 'eazykims',
  globalName: 'Eazykims',
  name: 'Eazykims',
  avatar: null,
};

const mockGuilds = [
  {
    id: '1530147023754367006',
    name: 'Liberty County Emergency RP',
    icon: null,
    iconUrl: null,
    owner: true,
    hasWorkspace: true,
    configured: true,
    memberCount: 418,
  },
  {
    id: '1249102938471029384',
    name: 'River City Department of Justice',
    icon: null,
    iconUrl: null,
    owner: false,
    hasWorkspace: true,
    configured: false,
    memberCount: 192,
  },
];

async function capture() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  // 1. Sidebar Expanded (1440x900)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(
      ({ user, guilds }) => {
        localStorage.setItem('erlcus_user', JSON.stringify(user));
        localStorage.setItem('mavely_user', JSON.stringify(user));
        localStorage.setItem('mavely_token', 'mock_token');
        localStorage.setItem('erlcus_known_guilds', JSON.stringify(guilds));
        localStorage.setItem('mavely_user_guilds', JSON.stringify(guilds));
        localStorage.setItem('erlcus_current_guild', '1530147023754367006');
        localStorage.setItem('erlcus_credits_balance', '24');
        localStorage.setItem('mavely_sidebar_collapsed', 'false');
      },
      { user: mockUser, guilds: mockGuilds }
    );

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const outPath = path.join(ARTIFACT_DIR, 'round3_phase1_sidebar_expanded.png');
    await page.screenshot({ path: outPath });
    console.log('Saved:', outPath);
    await context.close();
  }

  // 2. Sidebar Collapsed (1440x900)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(
      ({ user, guilds }) => {
        localStorage.setItem('erlcus_user', JSON.stringify(user));
        localStorage.setItem('mavely_user', JSON.stringify(user));
        localStorage.setItem('mavely_token', 'mock_token');
        localStorage.setItem('erlcus_known_guilds', JSON.stringify(guilds));
        localStorage.setItem('mavely_user_guilds', JSON.stringify(guilds));
        localStorage.setItem('erlcus_current_guild', '1530147023754367006');
        localStorage.setItem('erlcus_credits_balance', '24');
      },
      { user: mockUser, guilds: mockGuilds }
    );

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    // Click the sidebar collapse toggle button in HeaderBar
    const trigger = await page.$('[data-slot="header-bar"] button');
    if (trigger) {
      await trigger.click();
      await page.waitForTimeout(300);
    }

    const outPath = path.join(ARTIFACT_DIR, 'round3_phase1_sidebar_collapsed.png');
    await page.screenshot({ path: outPath });
    console.log('Saved:', outPath);
    await context.close();
  }

  // 3. User Menu Opened (1440x900)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(
      ({ user, guilds }) => {
        localStorage.setItem('erlcus_user', JSON.stringify(user));
        localStorage.setItem('mavely_user', JSON.stringify(user));
        localStorage.setItem('mavely_token', 'mock_token');
        localStorage.setItem('erlcus_known_guilds', JSON.stringify(guilds));
        localStorage.setItem('mavely_user_guilds', JSON.stringify(guilds));
        localStorage.setItem('erlcus_current_guild', '1530147023754367006');
        localStorage.setItem('erlcus_credits_balance', '24');
      },
      { user: mockUser, guilds: mockGuilds }
    );

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Click the user card in the sidebar footer
    await page.click('[data-slot="sidebar-footer"] [data-slot="dropdown-menu-trigger"]');
    await page.waitForTimeout(400);

    const outPath = path.join(ARTIFACT_DIR, 'round3_phase1_usermenu_open.png');
    await page.screenshot({ path: outPath });
    console.log('Saved:', outPath);
    await context.close();
  }

  // 4. Mobile View (390x844)
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(
      ({ user, guilds }) => {
        localStorage.setItem('erlcus_user', JSON.stringify(user));
        localStorage.setItem('mavely_user', JSON.stringify(user));
        localStorage.setItem('mavely_token', 'mock_token');
        localStorage.setItem('erlcus_known_guilds', JSON.stringify(guilds));
        localStorage.setItem('mavely_user_guilds', JSON.stringify(guilds));
        localStorage.setItem('erlcus_current_guild', '1530147023754367006');
        localStorage.setItem('erlcus_credits_balance', '24');
      },
      { user: mockUser, guilds: mockGuilds }
    );

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Open mobile sidebar
    const trigger = await page.$('[data-slot="header-bar"] button');
    if (trigger) {
      await trigger.click();
      await page.waitForTimeout(400);
    }

    const outPath = path.join(ARTIFACT_DIR, 'round3_phase1_mobile_sheet.png');
    await page.screenshot({ path: outPath });
    console.log('Saved:', outPath);
    await context.close();
  }

  await browser.close();
  console.log('Phase 1 capture completed successfully.');
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
