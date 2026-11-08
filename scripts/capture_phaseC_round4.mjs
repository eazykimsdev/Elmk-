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
      localStorage.setItem('erlcus_credits_balance', '150');
      localStorage.setItem('server_verified_joins_1530147023754367006', '42');
      localStorage.setItem('server_bumps_count_1530147023754367006', '12');
      localStorage.setItem('server_views_1530147023754367006', '384');
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

  // 1. Desktop Overview (1440x900)
  console.log('1. Capturing Overview Desktop (1440x900)...');
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await initSession(page);
    await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'round4_phaseC_overview_desktop.png'),
    });
    console.log('Saved round4_phaseC_overview_desktop.png');
    await page.close();
  }

  // 2. Mobile Overview (390x844)
  console.log('2. Capturing Overview Mobile (390x844)...');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await initSession(page);
    await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'round4_phaseC_overview_mobile.png'),
    });
    console.log('Saved round4_phaseC_overview_mobile.png');
    await page.close();
  }

  // 3. Desktop Bump Confirmation Modal
  console.log('3. Capturing Bump Modal (1440x900)...');
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await initSession(page);
    await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // Find and click the Bump button
    const bumpBtn = page.getByRole('button', { name: /Bump now/i });
    if (await bumpBtn.isVisible()) {
      await bumpBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'round4_phaseC_bump_modal.png'),
    });
    console.log('Saved round4_phaseC_bump_modal.png');
    await page.close();
  }

  await browser.close();
  console.log('Phase C capture completed successfully!');
}

run().catch((err) => {
  console.error('Error running Phase C capture:', err);
  process.exit(1);
});

