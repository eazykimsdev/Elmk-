import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  console.log('--- Starting Round 7 Phase C Automated Verification ---');
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
        name: 'Mavely Testing Server',
        icon: 'https://cdn.discordapp.com/embed/avatars/1.png',
        memberCount: 350,
      }
    ]));
  });

  console.log('1. Testing Recruit Hub direct route /recruit/:serverSlug...');
  await desktopPage.goto('http://localhost:3000/recruit/1530147023754367006', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1500);

  // Check breadcrumbs: My joins > {serverName} > Recruit hub
  const breadcrumbs = desktopPage.locator('nav[aria-label="Breadcrumb"]').first();
  const hasBreadcrumbs = await breadcrumbs.isVisible();
  if (!hasBreadcrumbs) throw new Error('FAILED: Breadcrumbs nav not visible');
  console.log('✓ Breadcrumbs visible');

  // Check header server name & status badge
  const headerTitle = desktopPage.locator('h1').first();
  const statusBadge = desktopPage.locator('text="Active"').first();
  if (!(await headerTitle.isVisible()) || !(await statusBadge.isVisible())) {
    throw new Error('FAILED: Header or status badge not visible');
  }
  console.log('✓ Header & status badge visible');

  // Check Your invite link card: real invite URL, Copy and Share buttons, no QR code, no staff sentence
  const inviteCard = desktopPage.locator('text="Your invite link"').first();
  const copyButton = desktopPage.locator('button:has-text("Copy")').first();
  const shareButton = desktopPage.locator('button:has-text("Share")').first();
  if (!(await inviteCard.isVisible()) || !(await copyButton.isVisible()) || !(await shareButton.isVisible())) {
    throw new Error('FAILED: Invite card or Copy/Share buttons not visible');
  }
  console.log('✓ "Your invite link" card with Copy & Share buttons visible');

  // Assert NO QR code and NO staff sentence
  const qrCodeCount = await desktopPage.locator('canvas, img[alt*="QR"], [data-qr]').count();
  const staffSentenceCount = await desktopPage.locator('text="staff promotion"').count();
  if (qrCodeCount > 0 || staffSentenceCount > 0) {
    throw new Error(`FAILED: Found unwanted elements! QR count=${qrCodeCount}, staffSentenceCount=${staffSentenceCount}`);
  }
  console.log('✓ Zero QR code and zero staff promotion copy found');

  // Check 4 performance tiles: Joined, Staying, Verified, Credits earned
  const joinedTile = desktopPage.locator('text="Joined"').first();
  const stayingTile = desktopPage.locator('text="Staying"').first();
  const verifiedTile = desktopPage.locator('text="Verified"').first();
  const creditsTile = desktopPage.locator('text="Credits earned"').first();
  if (
    !(await joinedTile.isVisible()) ||
    !(await stayingTile.isVisible()) ||
    !(await verifiedTile.isVisible()) ||
    !(await creditsTile.isVisible())
  ) {
    throw new Error('FAILED: Performance tiles not all visible');
  }
  console.log('✓ 4 performance tiles visible (Joined, Staying, Verified, Credits earned)');

  // Check 30-day mini area chart container
  const chart = desktopPage.locator('.recharts-responsive-container').first();
  if (!(await chart.isVisible())) {
    throw new Error('FAILED: Recharts 30-day mini area chart container not visible');
  }
  console.log('✓ Recharts 30-day mini area chart rendered');

  // Check step down ghost button
  const stepDownBtn = desktopPage.locator('button:has-text("Step down as representative")').first();
  if (!(await stepDownBtn.isVisible())) {
    throw new Error('FAILED: Step down ghost button not visible');
  }
  console.log('✓ "Step down as representative" ghost button visible');

  // Screenshot Member view
  const memberPath = path.join(ARTIFACTS_DIR, 'round7_phaseC_recruithub_member_desktop.png');
  await desktopPage.screenshot({ path: memberPath });
  console.log(`✓ Saved ${memberPath}`);

  // Test Step Down modal dialog
  console.log('2. Testing Step down confirmation dialog...');
  await stepDownBtn.click();
  await desktopPage.waitForTimeout(400);

  const stepDownDialog = desktopPage.locator('text="Step down as representative?"').first();
  const isDialogVisible = await stepDownDialog.isVisible();
  if (!isDialogVisible) {
    throw new Error('FAILED: Step down dialog did not open');
  }
  console.log('✓ Step down dialog opened');

  // Cancel dialog
  const cancelBtn = desktopPage.locator('button:text-is("Cancel")').first();
  await cancelBtn.click();
  await desktopPage.waitForTimeout(400);
  console.log('✓ Step down dialog cancelled');

  // 3. Switch to Owner View
  console.log('3. Testing Owner view in Recruit hub...');
  const ownerSwitchBtn = desktopPage.locator('button:text-is("Owner view")').first();
  const hasOwnerBtn = await ownerSwitchBtn.isVisible();
  if (!hasOwnerBtn) {
    throw new Error('FAILED: "Owner view" switcher button not found');
  }
  await ownerSwitchBtn.click();
  await desktopPage.waitForTimeout(500);

  // Check Owner tabs: Representatives, Requests, Activity, Recruiting settings
  const repsTab = desktopPage.locator('button:text-is("Representatives")').first();
  const requestsTab = desktopPage.locator('button:text-is("Requests")').first();
  const activityTab = desktopPage.locator('button:text-is("Activity")').first();
  const settingsTab = desktopPage.locator('button:text-is("Recruiting settings")').first();

  if (
    !(await repsTab.isVisible()) ||
    !(await requestsTab.isVisible()) ||
    !(await activityTab.isVisible()) ||
    !(await settingsTab.isVisible())
  ) {
    throw new Error('FAILED: Owner tabs not all visible');
  }
  console.log('✓ Owner tabs visible (Representatives, Requests, Activity, Recruiting settings)');

  // Switch to Recruiting settings tab
  await settingsTab.click();
  await desktopPage.waitForTimeout(500);

  // Check Recruiting settings controls: NumberFields, Minimum stay Select, Channel picker, Role pickers, Send test panel
  const repsWantedField = desktopPage.locator('text="Representatives wanted"').first();
  const creditsPerRecruitField = desktopPage.locator('text="Credits per recruit"').first();
  const minStaySelect = desktopPage.locator('text="Minimum stay"').first();
  const testPanelBtn = desktopPage.locator('button:has-text("Send a test panel to your log channel")').first();

  if (
    !(await repsWantedField.isVisible()) ||
    !(await creditsPerRecruitField.isVisible()) ||
    !(await minStaySelect.isVisible()) ||
    !(await testPanelBtn.isVisible())
  ) {
    throw new Error('FAILED: Recruiting settings controls not all visible');
  }
  console.log('✓ Recruiting settings controls visible');

  // Screenshot Owner view
  const ownerPath = path.join(ARTIFACTS_DIR, 'round7_phaseC_recruithub_owner_desktop.png');
  await desktopPage.screenshot({ path: ownerPath });
  console.log(`✓ Saved ${ownerPath}`);

  // 4. Test Promote Server > Invite and rewards tab
  console.log('4. Testing Promote Server > Invite and rewards tab...');
  await desktopPage.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1000);

  const inviteRewardsTab = desktopPage.locator('button:has-text("Invite and rewards")').first();
  await inviteRewardsTab.click();
  await desktopPage.waitForTimeout(500);

  // Check Minimum stay select exists
  const promoteMinStay = desktopPage.locator('text="Minimum stay"').first();
  if (!(await promoteMinStay.isVisible())) {
    throw new Error('FAILED: Minimum stay select not found in Promote tab');
  }
  console.log('✓ Minimum stay select visible in Promote tab');

  // Check Recruiting card in Promote tab
  const recruitCard = desktopPage.locator('text="Recruiting & representatives"').first();
  if (!(await recruitCard.isVisible())) {
    throw new Error('FAILED: Recruiting card not found in Promote tab');
  }
  console.log('✓ Recruiting card visible in Promote tab');

  // Screenshot Promote tab
  const promotePath = path.join(ARTIFACTS_DIR, 'round7_phaseC_promote_rewards_desktop.png');
  await desktopPage.screenshot({ path: promotePath });
  console.log(`✓ Saved ${promotePath}`);

  // 5. Mobile Testing (390x844)
  console.log('5. Testing Mobile Viewport (390px)...');
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

  await mobilePage.goto('http://localhost:3000/recruit/1530147023754367006', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);

  const mobileRecruitPath = path.join(ARTIFACTS_DIR, 'round7_phaseC_recruithub_mobile_390.png');
  await mobilePage.screenshot({ path: mobileRecruitPath });
  console.log(`✓ Saved ${mobileRecruitPath}`);

  await mobilePage.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);

  const mobileInviteTab = mobilePage.locator('button:text-is("Invite and rewards")').first();
  if (await mobileInviteTab.isVisible()) {
    await mobileInviteTab.click();
    await mobilePage.waitForTimeout(500);
  }

  const mobilePromotePath = path.join(ARTIFACTS_DIR, 'round7_phaseC_promote_rewards_mobile_390.png');
  await mobilePage.screenshot({ path: mobilePromotePath });
  console.log(`✓ Saved ${mobilePromotePath}`);

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('Captured console errors during Phase C verification:');
    consoleErrors.forEach((e) => console.error(' - ', e));
    throw new Error('FAILED: Console errors occurred during test.');
  }

  console.log('--- Round 7 Phase C Verified Successfully! ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
