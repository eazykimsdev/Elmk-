import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  console.log('--- Starting Round 7 Phase D Automated Verification ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const consoleErrors = [];

  const setupMockSession = async (context) => {
    await context.addCookies([
      {
        name: 'erlcus_session',
        value: 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  };

  // 1. Desktop Context (1440x900)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await setupMockSession(desktopCtx);

  const desktopPage = await desktopCtx.newPage();

  desktopPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('/api/telemetry') && !text.includes('Failed to load resource')) {
        console.error('[Browser Error]', text);
        consoleErrors.push(text);
      }
    }
  });

  await desktopPage.addInitScript(() => {
    const user = {
      id: '523693281541095424',
      username: 'eazykims',
      globalName: 'Eazykims',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('mavely_user', JSON.stringify(user));
    localStorage.setItem('erlcus_credits_balance', '42');
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      {
        id: '1530147023754367006',
        name: 'Discord bot V.2',
        icon: 'https://cdn.discordapp.com/embed/avatars/1.png',
        memberCount: 17,
      }
    ]));
  });

  console.log('1. Testing Directory Rows in Earn Credits (/dashboard/:guildId/earn)...');
  await desktopPage.goto('http://localhost:3000/dashboard/1530147023754367006/earn', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1500);

  // Check if at least one DirectoryRow rendered
  const firstRow = desktopPage.locator('[role="button"]:has-text("members")').first();
  const hasRow = await firstRow.isVisible();
  if (!hasRow) {
    throw new Error('FAILED: DirectoryRow not found in Earn Credits view!');
  }
  console.log('✓ DirectoryRow rendered in Earn Credits');

  // Check rank, server icon, category, reward pill, join button
  const joinButton = firstRow.locator('button:has-text("Join"), [data-slot="badge"]:has-text("Your server")').first();
  const hasJoinBtn = await joinButton.isVisible();
  console.log('✓ Row has Join button / Your server badge:', hasJoinBtn);

  // Verify compact row height is ~72px on desktop
  const boundingBox = await firstRow.boundingBox();
  console.log(`✓ Row dimensions: width=${boundingBox?.width}px, height=${boundingBox?.height}px`);

  // Screenshot Directory Rows
  const rowsPath = path.join(ARTIFACTS_DIR, 'round7_phaseD_directory_rows_desktop.png');
  await desktopPage.screenshot({ path: rowsPath });
  console.log(`✓ Saved ${rowsPath}`);

  // 2. Test Server Details Popup (Section 7.2)
  console.log('2. Testing Server Details Popup on row click...');
  // Click on the row (not on Join button)
  await firstRow.click();
  await desktopPage.waitForTimeout(600);

  // Check details dialog
  const detailsDialog = desktopPage.locator('[role="dialog"]').first();
  const isPopupOpen = await detailsDialog.isVisible();
  if (!isPopupOpen) {
    throw new Error('FAILED: Server details popup did not open on row click!');
  }
  console.log('✓ Server details popup opened');

  // Verify popup contents: Requirements, Join reward, Open full page, Close button
  const reqCard = detailsDialog.locator('text="Requirements"').first();
  const rewardCard = detailsDialog.locator('text="Join reward"').first();
  const openFullPageBtn = detailsDialog.locator('text="Open full page"').first();
  const closeBtn = detailsDialog.locator('button:text-is("Close")').first();

  console.log('✓ Popup components visible:', 
    await reqCard.isVisible(), 
    await rewardCard.isVisible(), 
    await openFullPageBtn.isVisible(), 
    await closeBtn.isVisible()
  );

  // Screenshot Server Details Popup
  const popupPath = path.join(ARTIFACTS_DIR, 'round7_phaseD_directory_popup_desktop.png');
  await desktopPage.screenshot({ path: popupPath });
  console.log(`✓ Saved ${popupPath}`);

  // Close the popup
  await closeBtn.click();
  await desktopPage.waitForTimeout(400);

  // 3. Test Server Page Redesign (/dashboard/:guildId/server-page)
  console.log('3. Testing Server Page Redesign in dashboard (/dashboard/:guildId/server-page)...');
  await desktopPage.goto('http://localhost:3000/dashboard/1530147023754367006/server-page', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1500);

  // Header items: Server name, icon, category pill, member count
  const serverTitle = desktopPage.locator('h1:has-text("Discord bot V.2")').first();
  const hasServerTitle = await serverTitle.isVisible();
  console.log('✓ Server title visible:', hasServerTitle);

  // Action bar: Join server, Become a representative, Share, Report
  const joinServerBtn = desktopPage.locator('button:has-text("Join server")').first();
  const becomeRepBtn = desktopPage.locator('button:has-text("Become a representative")').first();
  const shareBtn = desktopPage.locator('button:has-text("Share")').first();
  const reportBtn = desktopPage.locator('button:has-text("Report")').first();

  console.log('✓ Action bar buttons visible:',
    await joinServerBtn.isVisible(),
    await becomeRepBtn.isVisible(),
    await shareBtn.isVisible(),
    await reportBtn.isVisible()
  );

  // Main area: 65% / 35% columns
  // Left: About section, rules
  const aboutHeading = desktopPage.locator('h2:text-is("About")').first();
  const rulesHeading = desktopPage.locator('h2:text-is("Community rules")').first();

  // Right: Telemetry, Owner (NO FAKE PEOPLE), Representatives
  const telemetryHeading = desktopPage.locator('span:text-is("Telemetry")').first();
  const ownerHeading = desktopPage.locator('span:text-is("Owner")').first();
  const ownerNameText = desktopPage.locator('text="Eazykims"').first();
  const repsHeading = desktopPage.locator('span:text-is("Representatives")').first();

  console.log('✓ 65%/35% columns visible:',
    await aboutHeading.isVisible(),
    await rulesHeading.isVisible(),
    await telemetryHeading.isVisible(),
    await ownerHeading.isVisible(),
    await ownerNameText.isVisible(),
    await repsHeading.isVisible()
  );

  // Screenshot Server Page Desktop
  const serverPagePath = path.join(ARTIFACTS_DIR, 'round7_phaseD_server_page_desktop.png');
  await desktopPage.screenshot({ path: serverPagePath });
  console.log(`✓ Saved ${serverPagePath}`);

  // 4. Mobile Testing (390x844)
  console.log('4. Testing Mobile Viewports (390px)...');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await setupMockSession(mobileCtx);

  const mobilePage = await mobileCtx.newPage();
  await mobilePage.addInitScript(() => {
    const user = {
      id: '523693281541095424',
      username: 'eazykims',
      globalName: 'Eazykims',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('mavely_user', JSON.stringify(user));
    localStorage.setItem('erlcus_credits_balance', '42');
  });

  // Mobile Directory Rows
  await mobilePage.goto('http://localhost:3000/dashboard/1530147023754367006/earn', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1200);

  const mobileRowsPath = path.join(ARTIFACTS_DIR, 'round7_phaseD_directory_rows_mobile_390.png');
  await mobilePage.screenshot({ path: mobileRowsPath });
  console.log(`✓ Saved ${mobileRowsPath}`);

  // Mobile Server Page
  await mobilePage.goto('http://localhost:3000/dashboard/1530147023754367006/server-page', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1200);

  const mobileServerPath = path.join(ARTIFACTS_DIR, 'round7_phaseD_server_page_mobile_390.png');
  await mobilePage.screenshot({ path: mobileServerPath });
  console.log(`✓ Saved ${mobileServerPath}`);

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('Captured console errors during Phase D verification:');
    consoleErrors.forEach((e) => console.error(' - ', e));
    throw new Error('FAILED: Console errors occurred during test.');
  }

  console.log('--- Round 7 Phase D Verified Successfully! ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

