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
    memberCount: 1740,
    owner: true,
  },
];

function initSession(page) {
  return page.addInitScript(
    ({ user, guilds }) => {
      localStorage.setItem('erlcus_user', JSON.stringify(user));
      localStorage.setItem('mavely_user', JSON.stringify(user));
      localStorage.setItem('mavely_token', 'mock_token');
      localStorage.setItem('erlcus_known_guilds', JSON.stringify(guilds));
      localStorage.setItem('mavely_user_guilds', JSON.stringify(guilds));
      localStorage.setItem('erlcus_current_guild', '1530147023754367006');
      localStorage.setItem('erlcus_credits_balance', '42');
      localStorage.setItem('mavely_sidebar_collapsed', 'false');
    },
    { user: mockUser, guilds: mockGuilds }
  );
}

async function run() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  // 1. Dashboard Overview Desktop (1440x900)
  console.log('1. Capturing Overview with new Dark Tokens & Poppins (Desktop 1440x900)...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await initSession(page);

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'round4_phaseA_overview_desktop.png');
    await page.screenshot({ path: outPath, timeout: 8000 });
    console.log('Saved:', outPath);
    await context.close();
  }

  // 2. Dashboard Overview Mobile (390x844)
  console.log('2. Capturing Overview (Mobile 390x844)...');
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await initSession(page);

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'round4_phaseA_overview_mobile.png');
    await page.screenshot({ path: outPath, timeout: 8000 });
    console.log('Saved:', outPath);
    await context.close();
  }

  // 3. Earn Credits Directory Desktop (with Always-Visible Pagination & New Buttons)
  console.log('3. Capturing Earn Credits with Always-Visible Pagination (Desktop 1440x900)...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await initSession(page);

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006/earn`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'round4_phaseA_earn_desktop.png');
    await page.screenshot({ path: outPath, timeout: 8000 });
    console.log('Saved:', outPath);
    await context.close();
  }

  // 4. Earn Credits Directory Mobile (390x844)
  console.log('4. Capturing Earn Credits (Mobile 390x844)...');
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await initSession(page);

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006/earn`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'round4_phaseA_earn_mobile.png');
    await page.screenshot({ path: outPath, timeout: 8000 });
    console.log('Saved:', outPath);
    await context.close();
  }

  console.log('Phase A captures completed successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});

