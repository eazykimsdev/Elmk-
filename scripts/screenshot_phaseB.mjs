import { chromium } from '../node_modules/playwright-core/index.mjs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE_URL = 'http://localhost:3000';

const mockUser = {
  id: '523693281541095424',
  username: 'eazykims',
  globalName: 'Eazykims',
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

const routes = [
  { name: 'phaseB_promote', path: '/dashboard/1530147023754367006/promote' },
  { name: 'phaseB_earn', path: '/dashboard/1530147023754367006/earn' },
  { name: 'phaseB_leaderboard', path: '/dashboard/1530147023754367006/leaderboard' },
  { name: 'phaseB_myjoins', path: '/dashboard/1530147023754367006/joins' },
  { name: 'phaseB_partnerships', path: '/dashboard/1530147023754367006/partnerships' },
];

async function capture() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  for (const route of routes) {
    for (const [label, viewport] of [
      ['desktop', { width: 1440, height: 900 }],
      ['mobile', { width: 390, height: 844, isMobile: true, hasTouch: true }],
    ]) {
      const context = await browser.newContext({ viewport });
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

      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const outPath = path.join(ARTIFACT_DIR, `${route.name}_${label}.png`);
      await page.screenshot({ path: outPath });
      console.log(`Saved: ${route.name}_${label}.png`);
      await context.close();
    }
  }

  await browser.close();
  console.log('Finished capturing all Phase B screens.');
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
