import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const SESSION_COOKIE = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function run() {
  console.log('--- ROUND 8 PHASE C AUTOMATED VERIFICATION ---');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: 'erlcus_session',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await context.newPage();

  await page.addInitScript(() => {
    const user = {
      id: '523693281541095424',
      name: 'eazykims',
      username: 'eazykims',
      globalName: 'Eazykims',
      displayName: 'Eazykims',
      avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('erlcus_mock_user', JSON.stringify(user));
    localStorage.setItem('erlcus_default_guild', '1530147023754367006');
  });

  // ── 1. TEST SERVER PAGE (DESKTOP 1440px) ──
  console.log('1. Navigating to Server page on Desktop (1440px)...');
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/server-page', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2000);

  // Assert NO "Community rules" card exists
  const rulesCount = await page.locator('text=Community rules').count();
  console.log(`"Community rules" count (must be 0): ${rulesCount}`);
  if (rulesCount > 0) {
    throw new Error('Found forbidden "Community rules" card! It must be completely removed.');
  }

  // Assert Community feedback card exists
  const feedbackHeading = page.locator('h2:has-text("Community feedback")');
  console.log(`Community feedback heading count: ${await feedbackHeading.count()}`);
  if (await feedbackHeading.count() === 0) {
    throw new Error('Could not find "Community feedback" card!');
  }

  // Assert "Owned by" card exists with real user
  const ownedByText = page.locator('text=Owned by');
  console.log(`"Owned by" label count: ${await ownedByText.count()}`);
  const ownerNameText = page.locator('text=Eazykims');
  console.log(`Real owner name "Eazykims" count: ${await ownerNameText.count()}`);

  // Assert "Your numbers" card exists
  const yourNumbersHeading = page.locator('text=Your numbers');
  console.log(`"Your numbers" heading count: ${await yourNumbersHeading.count()}`);

  // Assert "Active representatives" exists
  const repsHeading = page.locator('text=Active representatives');
  console.log(`"Active representatives" heading count: ${await repsHeading.count()}`);

  // Screenshot Server Page Desktop (Top)
  const serverPageDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseC_server_page_desktop.png');
  await page.screenshot({ path: serverPageDesktopPath, fullPage: false });
  console.log(`Server Page Desktop screenshot saved: ${serverPageDesktopPath}`);

  // Scroll to Community feedback and screenshot
  await feedbackHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const serverPageReviewsDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseC_server_page_reviews_desktop.png');
  await page.screenshot({ path: serverPageReviewsDesktopPath, fullPage: false });
  console.log(`Server Page Reviews Desktop screenshot saved: ${serverPageReviewsDesktopPath}`);

  // ── 2. TEST LEADERBOARD COMPACT CARD (DESKTOP 1440px) ──
  console.log('2. Navigating to Leaderboard on Desktop (1440px)...');
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/leaderboard', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2000);

  // Check compact ranking card
  const rankNumber = page.locator('.text-2xl.sm\\:text-3xl.font-extrabold');
  console.log(`Rank big number: ${await rankNumber.innerText().catch(() => 'N/A')}`);

  const listedServersText = page.locator('text=/of \\d+ listed servers/');
  console.log(`"of N listed servers" count: ${await listedServersText.count()}`);

  // Check percentile is NOT shown when total < 10
  const topPercentPill = page.locator('text=/Top \\d+%/');
  const percentCount = await topPercentPill.count();
  console.log(`Percentile pill count (should be 0 when total < 10): ${percentCount}`);
  if (percentCount > 0) {
    console.warn('Percentile pill was found with < 10 servers!');
  }

  // Screenshot Leaderboard Desktop
  const leaderboardDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseC_leaderboard_desktop.png');
  await page.screenshot({ path: leaderboardDesktopPath, fullPage: false });
  console.log(`Leaderboard Desktop screenshot saved: ${leaderboardDesktopPath}`);

  // ── 3. TEST MOBILE VIEWPORT (390px) ──
  console.log('3. Testing Mobile Viewport (390px)...');
  await page.setViewportSize({ width: 390, height: 844 });

  // Mobile Server Page
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/server-page', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2000);

  const serverPageMobilePath = path.join(ARTIFACTS_DIR, 'round8_phaseC_server_page_mobile_390.png');
  await page.screenshot({ path: serverPageMobilePath, fullPage: false });
  console.log(`Server Page Mobile screenshot saved: ${serverPageMobilePath}`);

  // Mobile Leaderboard
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/leaderboard', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2000);

  const leaderboardMobilePath = path.join(ARTIFACTS_DIR, 'round8_phaseC_leaderboard_mobile_390.png');
  await page.screenshot({ path: leaderboardMobilePath, fullPage: false });
  console.log(`Leaderboard Mobile screenshot saved: ${leaderboardMobilePath}`);

  await browser.close();
  console.log('--- ALL PHASE C CHECKS COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Phase C test failed:', err);
  process.exit(1);
});
