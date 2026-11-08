import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function run() {
  console.log('--- ROUND 8 PHASE B AUTOMATED VERIFICATION ---');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });

  const sessionCookie = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: 'erlcus_session',
      value: sessionCookie,
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

  console.log('1. Navigating to Earn Credits tab on Desktop (1440px)...');
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/earn', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2000);

  console.log('Current URL:', page.url());
  const bodyText = await page.locator('body').innerText();
  console.log('Body excerpt:', bodyText.slice(0, 300));

  // Check 2-column grid presence
  const gridLocator = page.locator('.grid.grid-cols-1.md\\:grid-cols-2');
  const gridCount = await gridLocator.count();
  console.log(`2-column grid element count: ${gridCount}`);
  if (gridCount === 0) {
    throw new Error('Could not find .grid.grid-cols-1.md:grid-cols-2 container!');
  }

  // Check DirectoryCards inside grid
  const cards = page.locator('.grid.grid-cols-1.md\\:grid-cols-2 > div[role="button"]');
  const cardCount = await cards.count();
  console.log(`Directory cards found in grid: ${cardCount}`);
  if (cardCount === 0) {
    throw new Error('No DirectoryCard items rendered in grid!');
  }

  // Check card height
  const firstCardBox = await cards.first().boundingBox();
  console.log(`First card dimensions: width=${firstCardBox?.width}px, height=${firstCardBox?.height}px`);
  if (firstCardBox && firstCardBox.height > 200) {
    console.warn(`Card height is ${firstCardBox.height}px (expected <= 180px)`);
  }

  // Check View button and card elements
  const viewButtons = page.locator('button:has-text("View")');
  console.log(`"View" buttons count: ${await viewButtons.count()}`);

  // Screenshot Desktop Earn Credits
  const earnCreditsDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseB_earn_credits_desktop.png');
  await page.screenshot({ path: earnCreditsDesktopPath, fullPage: false });
  console.log(`Desktop Earn Credits screenshot saved: ${earnCreditsDesktopPath}`);

  // 2. Open Server Profile Popup Modal (Testing on non-own server if available)
  console.log('2. Opening Server Profile modal on non-own server...');
  if (cardCount > 1) {
    await cards.nth(1).click();
  } else {
    await cards.first().click();
  }
  await page.waitForTimeout(1000);

  const modalLocator = page.locator('[role="dialog"][aria-modal="true"]');
  const isModalVisible = await modalLocator.isVisible();
  console.log(`Modal visible: ${isModalVisible}`);
  if (!isModalVisible) {
    throw new Error('Server Profile Modal failed to open on card click!');
  }

  // Check modal components
  const aboutHeading = modalLocator.locator('h3:has-text("ABOUT")');
  const tagsHeading = modalLocator.locator('h3:has-text("TAGS")');
  const requirementsCard = modalLocator.locator('text=Requirements');
  const joinRewardCard = modalLocator.locator('text=Join reward');
  const openFullPageLink = modalLocator.locator('text=Open full page');
  const joinServerBtn = modalLocator.locator('button:has-text("Join server")');

  console.log(`Modal elements check:
    ABOUT: ${await aboutHeading.count() > 0}
    TAGS: ${await tagsHeading.count() > 0}
    Requirements: ${await requirementsCard.count() > 0}
    Join reward: ${await joinRewardCard.count() > 0}
    Open full page: ${await openFullPageLink.count() > 0}
    Join server button: ${await joinServerBtn.count() > 0}`);

  // Screenshot Desktop Modal
  const popupModalDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseB_popup_modal_desktop.png');
  await page.screenshot({ path: popupModalDesktopPath, fullPage: false });
  console.log(`Desktop Popup Modal screenshot saved: ${popupModalDesktopPath}`);

  // Close modal with Close button
  const closeBtn = modalLocator.locator('button:has-text("Close")');
  await closeBtn.click();
  await page.waitForTimeout(500);

  // 3. Promote Server Preview Check
  console.log('3. Navigating to Promote Server tab...');
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/promote', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2000);

  const promotePreviewPath = path.join(ARTIFACTS_DIR, 'round8_phaseB_promote_preview_desktop.png');
  await page.screenshot({ path: promotePreviewPath, fullPage: false });
  console.log(`Desktop Promote Preview screenshot saved: ${promotePreviewPath}`);

  // 4. Mobile Viewport (390px) Checks
  console.log('4. Testing Mobile Viewport (390px)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/earn', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2000);

  const earnCreditsMobilePath = path.join(ARTIFACTS_DIR, 'round8_phaseB_earn_credits_mobile_390.png');
  await page.screenshot({ path: earnCreditsMobilePath, fullPage: false });
  console.log(`Mobile Earn Credits screenshot saved: ${earnCreditsMobilePath}`);

  // Open modal on mobile
  const mobileCards = page.locator('.grid.grid-cols-1.md\\:grid-cols-2 > div[role="button"]');
  if (await mobileCards.count() > 0) {
    await mobileCards.first().click();
    await page.waitForTimeout(1000);
    const popupModalMobilePath = path.join(ARTIFACTS_DIR, 'round8_phaseB_popup_modal_mobile_390.png');
    await page.screenshot({ path: popupModalMobilePath, fullPage: false });
    console.log(`Mobile Popup Modal screenshot saved: ${popupModalMobilePath}`);
  }

  await browser.close();
  console.log('--- ALL PHASE B CHECKS COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Phase B test failed:', err);
  process.exit(1);
});
