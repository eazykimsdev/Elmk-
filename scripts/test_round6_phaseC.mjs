import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const BASE_URL = 'http://localhost:3000';
const GUILD_ID = '1530147023754367006';
const VALID_TOKEN = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function run() {
  console.log('=== RUNNING ROUND 6 PHASE C INTEGRATION TESTS ===\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const setupMockSession = async (context) => {
    await context.addCookies([
      {
        name: 'erlcus_session',
        value: VALID_TOKEN,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  };

  const setupInitScript = async (page) => {
    await page.addInitScript(() => {
      const mockUser = {
        id: '523693281541095424',
        username: 'eazykims',
        globalName: 'Eazykims',
        avatar: null,
      };
      localStorage.setItem('erlcus_user', JSON.stringify(mockUser));
      localStorage.setItem('erlcus_credits_balance', '150');
      localStorage.setItem(
        'erlcus_known_guilds',
        JSON.stringify([
          {
            id: '1530147023754367006',
            name: 'Discord bot V.2',
            owner: true,
            permissions: '8',
          },
        ])
      );
    });
  };

  // 1440px desktop
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await setupMockSession(context);
  const page = await context.newPage();
  await setupInitScript(page);

  console.log('--- 1. Testing Directory & ServerProfileModal (?server=slug) ---');
  await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/earn`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check pagination in Directory: should be outside the grid
  const dirPagination = page.locator('nav[aria-label="Pagination"]').first();
  console.log('Directory pagination visible outside grid:', await dirPagination.isVisible());

  // Click first directory card
  const firstCard = page.locator('[data-slot="card"]').first();
  if (await firstCard.isVisible()) {
    console.log('Clicking first directory card...');
    await firstCard.click();
    await page.waitForTimeout(800);

    const currentUrl = page.url();
    console.log('Current URL after card click:', currentUrl);
    console.log('URL has ?server= param:', currentUrl.includes('server='));

    // Verify modal is visible
    const modal = page.locator('[role="dialog"][aria-modal="true"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('ServerProfileModal visible:', await modal.isVisible());

    // Check member count big typography
    const memberText = await modal.locator('text=members').first().isVisible();
    console.log('Big member count label visible:', memberText);

    // Check representatives row
    const repsRow = await modal.locator('text=Representatives').first().isVisible();
    console.log('Representatives row visible:', repsRow);

    // Screenshot 1440px desktop details popup
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'round6_phaseC_details_modal_desktop.png'),
    });
    console.log('Captured round6_phaseC_details_modal_desktop.png');

    // Press Escape to test closing
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('URL after Escape (clean):', page.url());
  }

  console.log('\n--- 2. Testing My joins pagination & row click ---');
  await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/joins`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Verify pagination outside table card
  const joinsPagination = page.locator('nav[aria-label="Pagination"]').first();
  console.log('My joins pagination visible outside table:', await joinsPagination.isVisible());

  // Screenshot 1440px My joins
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseC_my_joins_desktop.png'),
  });
  console.log('Captured round6_phaseC_my_joins_desktop.png');

  console.log('\n--- 3. Testing Partnerships Browse pagination ---');
  await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/partnerships`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const partPagination = page.locator('nav[aria-label="Pagination"]').first();
  console.log('Partnerships pagination visible outside card:', await partPagination.isVisible());

  // Screenshot 1440px Partnerships
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseC_partnerships_desktop.png'),
  });
  console.log('Captured round6_phaseC_partnerships_desktop.png');

  console.log('\n--- 4. Testing Credit history pagination ---');
  await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/history`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const historyPagination = page.locator('nav[aria-label="Pagination"]').first();
  console.log('History pagination visible outside card:', await historyPagination.isVisible());

  // Screenshot 1440px History
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseC_history_desktop.png'),
  });
  console.log('Captured round6_phaseC_history_desktop.png');

  console.log('\n--- 5. Testing Leaderboard pagination & row click ---');
  await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/leaderboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const lbPagination = page.locator('nav[aria-label="Pagination"]').first();
  console.log('Leaderboard pagination visible outside card:', await lbPagination.isVisible());

  // Click first row in leaderboard to test modal trigger
  const firstRow = page.locator('table tbody tr').first();
  if (await firstRow.isVisible()) {
    console.log('Clicking leaderboard row...');
    await firstRow.click();
    await page.waitForTimeout(800);
    const lbModal = page.locator('[role="dialog"][aria-modal="true"]');
    console.log('Modal opened from Leaderboard row click:', await lbModal.isVisible());
    console.log('URL has ?server= param:', page.url().includes('server='));
  }

  // Screenshot 1440px Leaderboard with modal
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseC_leaderboard_modal_desktop.png'),
  });
  console.log('Captured round6_phaseC_leaderboard_modal_desktop.png');

  console.log('\n--- 6. Mobile 390px Viewport Tests ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  await setupMockSession(mobileContext);
  const mobilePage = await mobileContext.newPage();
  await setupInitScript(mobilePage);

  // Test direct URL link with ?server=slug
  console.log('Navigating mobile to ?server=1530147023754367006...');
  await mobilePage.goto(`${BASE_URL}/dashboard/${GUILD_ID}/earn?server=${GUILD_ID}`, {
    waitUntil: 'networkidle',
  });
  await mobilePage.waitForTimeout(1000);

  const mobileModal = mobilePage.locator('[role="dialog"][aria-modal="true"]');
  console.log('Mobile modal opened directly via ?server=slug:', await mobileModal.isVisible());

  // Screenshot 390px mobile modal
  await mobilePage.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseC_modal_mobile_390.png'),
  });
  console.log('Captured round6_phaseC_modal_mobile_390.png');

  // Close modal and screenshot mobile directory with pagination
  await mobilePage.locator('button[aria-label="Close"]').first().click();
  await mobilePage.waitForTimeout(500);

  await mobilePage.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseC_directory_mobile_390.png'),
  });
  console.log('Captured round6_phaseC_directory_mobile_390.png');

  await browser.close();
  console.log('\nAll Phase C tests completed successfully!');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
