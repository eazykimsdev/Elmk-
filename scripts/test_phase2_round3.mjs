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

  // 1. Promote Server Desktop
  console.log('1. Promoting server (Desktop 1440x900)...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await initSession(page);

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006/promote`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Rapid category test
    const categoryButtons = await page.$$('[role="radiogroup"] button');
    if (categoryButtons.length >= 3) {
      await categoryButtons[1].click();
      await page.waitForTimeout(100);
      await categoryButtons[0].click();
      await page.waitForTimeout(100);
    }

    const outPath = path.join(ARTIFACT_DIR, 'round3_phase2_promote_desktop.png');
    await page.screenshot({ path: outPath, timeout: 8000 });
    console.log('Saved:', outPath);
    await context.close();
  }

  // 2. Promote Server Mobile
  console.log('2. Promoting server (Mobile 390x844)...');
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await initSession(page);

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006/promote`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'round3_phase2_promote_mobile.png');
    await page.screenshot({ path: outPath, timeout: 8000 });
    console.log('Saved:', outPath);
    await context.close();
  }

  // 3. Earn Credits Desktop
  console.log('3. Earn credits (Desktop 1440x900)...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await initSession(page);

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006/earn`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'round3_phase2_earn_desktop.png');
    await page.screenshot({ path: outPath, timeout: 8000 });
    console.log('Saved:', outPath);

    // Trigger shadcn Select
    const selectTrigger = await page.$('[role="combobox"]');
    if (selectTrigger) {
      await selectTrigger.click();
      await page.waitForTimeout(300);
      const openPath = path.join(ARTIFACT_DIR, 'round3_phase2_earn_select_open.png');
      await page.screenshot({ path: openPath, timeout: 8000 });
      console.log('Saved:', openPath);
    }

    await context.close();
  }

  // 4. Earn Credits Mobile
  console.log('4. Earn credits (Mobile 390x844)...');
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await initSession(page);

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006/earn`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'round3_phase2_earn_mobile.png');
    await page.screenshot({ path: outPath, timeout: 8000 });
    console.log('Saved:', outPath);
    await context.close();
  }

  // 5. Partnerships Desktop
  console.log('5. Partnerships (Desktop 1440x900)...');
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await initSession(page);

    await page.goto(`${BASE_URL}/dashboard/1530147023754367006/partnerships`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'round3_phase2_partnerships_desktop.png');
    await page.screenshot({ path: outPath, timeout: 8000 });
    console.log('Saved:', outPath);
    await context.close();
  }

  console.log('Phase 2 capture completed successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
