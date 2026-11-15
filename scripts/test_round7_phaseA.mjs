import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  console.log('--- Starting Round 7 Phase A Automated Verification ---');
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

  // Desktop context (1440x900)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await setupMockSession(desktopCtx);

  const desktopPage = await desktopCtx.newPage();

  desktopPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore normal network or telemetry 404s if any
      if (!text.includes('/api/telemetry') && !text.includes('Failed to load resource')) {
        console.error('[Browser Error]', text);
        consoleErrors.push(text);
      }
    }
  });

  // Inject session
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

  console.log('1. Testing Recruit settings retention target select...');
  await desktopPage.goto('http://localhost:3000/dashboard/1530147023754367006/recruits', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1000);

  // Click on "Settings" tab in recruits if available
  const settingsTabBtn = desktopPage.locator('button:has-text("Settings"), button:has-text("Recruit settings")').first();
  if (await settingsTabBtn.isVisible()) {
    await settingsTabBtn.click();
    await desktopPage.waitForTimeout(500);
  }

  // Check console errors so far
  const maxDepthErrors = consoleErrors.filter(e => e.includes('Maximum update depth exceeded'));
  if (maxDepthErrors.length > 0) {
    throw new Error('FAILED: Maximum update depth exceeded encountered on recruits tab!');
  }
  console.log('✓ No Maximum update depth errors on recruits tab');

  console.log('2. Testing Promote server tab & ER:LC API key UI...');
  await desktopPage.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1000);

  // Click on "Invite and rewards" tab
  const rewardsSubTab = desktopPage.locator('button:has-text("Invite and rewards")').first();
  if (await rewardsSubTab.isVisible()) {
    await rewardsSubTab.click();
    await desktopPage.waitForTimeout(600);
  }

  // Check for ER:LC API key label
  const erlcLabel = await desktopPage.locator('text="ER:LC API key"').first().isVisible();
  console.log(`ER:LC API key label visible: ${erlcLabel}`);

  const promoteScreenshotPath = path.join(ARTIFACTS_DIR, 'round7_phaseA_erlc_desktop.png');
  await desktopPage.screenshot({ path: promoteScreenshotPath });
  console.log(`Saved screenshot: ${promoteScreenshotPath}`);

  console.log('3. Testing "This reward comes out of your credits" dialog...');
  // Locate Switch 1: Offer a higher reward switch
  const higherRewardSwitch = desktopPage.locator('button[role="switch"]').nth(1);
  if (await higherRewardSwitch.isVisible()) {
    await higherRewardSwitch.scrollIntoViewIfNeeded();
    await higherRewardSwitch.click();
    await desktopPage.waitForTimeout(600);
  }

  // Verify reward dialog is open and visible
  const rewardDialog = desktopPage.locator('[role="dialog"], [data-slot="dialog-content"]').first();
  const isRewardDialogOpen = await rewardDialog.isVisible();
  console.log(`Reward dialog visible: ${isRewardDialogOpen}`);

  const rewardScreenshotPath = path.join(ARTIFACTS_DIR, 'round7_phaseA_reward_dialog_desktop.png');
  await desktopPage.screenshot({ path: rewardScreenshotPath });
  console.log(`Saved screenshot: ${rewardScreenshotPath}`);

  // Dismiss reward dialog by clicking "I understand"
  const understandBtn = desktopPage.locator('button:has-text("I understand")').first();
  if (await understandBtn.isVisible()) {
    await understandBtn.click();
    await desktopPage.waitForTimeout(600);
  }

  console.log('4. Testing "Leave without saving?" dialog...');
  // Click back to Listing sub-tab
  const listingSubTab = desktopPage.locator('button:has-text("Listing")').first();
  if (await listingSubTab.isVisible()) {
    await listingSubTab.click();
    await desktopPage.waitForTimeout(500);
  }

  // Modify description to dirty the form
  const descInput = desktopPage.locator('textarea').first();
  if (await descInput.isVisible()) {
    await descInput.focus();
    await descInput.fill('Updated server description for round 7 phase A testing.');
    await desktopPage.waitForTimeout(500);
  }

  // Check if save bar appears
  const saveBar = desktopPage.locator('text="You have unsaved changes"').first();
  console.log(`Unsaved changes save bar visible: ${await saveBar.isVisible()}`);

  // Attempt to navigate to Overview via sidebar button
  const overviewNav = desktopPage.locator('button:has-text("Overview")').first();
  if (await overviewNav.isVisible()) {
    await overviewNav.click();
    await desktopPage.waitForTimeout(600);
  }

  // Check if leave dialog is visible
  const leaveDialog = desktopPage.locator('text="Leave without saving?"').first();
  const isLeaveDialogOpen = await leaveDialog.isVisible();
  console.log(`Leave dialog visible: ${isLeaveDialogOpen}`);

  const leaveScreenshotPath = path.join(ARTIFACTS_DIR, 'round7_phaseA_leave_dialog_desktop.png');
  await desktopPage.screenshot({ path: leaveScreenshotPath });
  console.log(`Saved screenshot: ${leaveScreenshotPath}`);

  // Mobile testing (390x844)
  console.log('5. Testing Mobile Viewports (390px)...');
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
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      {
        id: '1530147023754367006',
        name: 'Mavely Testing Server',
        icon: 'https://cdn.discordapp.com/embed/avatars/1.png',
        memberCount: 350,
      }
    ]));
  });

  await mobilePage.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);

  // Switch to Invite and rewards tab to see ER:LC
  const mobileRewardsTab = mobilePage.locator('button:has-text("Invite and rewards")').first();
  if (await mobileRewardsTab.isVisible()) {
    await mobileRewardsTab.click();
    await mobilePage.waitForTimeout(500);
  }

  // Mobile Promote screenshot
  const mobilePromotePath = path.join(ARTIFACTS_DIR, 'round7_phaseA_promote_mobile_390.png');
  await mobilePage.screenshot({ path: mobilePromotePath });
  console.log(`Saved mobile screenshot: ${mobilePromotePath}`);

  // Switch back to listing and dirty form
  const mobileListingTab = mobilePage.locator('button:has-text("Listing")').first();
  if (await mobileListingTab.isVisible()) {
    await mobileListingTab.click();
    await mobilePage.waitForTimeout(400);
  }

  const mobileDescInput = mobilePage.locator('textarea').first();
  if (await mobileDescInput.isVisible()) {
    await mobileDescInput.fill('Mobile updated description for testing.');
    await mobilePage.waitForTimeout(400);
  }

  // Open sidebar menu if on mobile
  const mobileMenuBtn = mobilePage.locator('button[aria-label*="sidebar" i], button[aria-label*="menu" i]').first();
  if (await mobileMenuBtn.isVisible()) {
    await mobileMenuBtn.click();
    await mobilePage.waitForTimeout(400);
  }
  const mobileOverviewBtn = mobilePage.locator('button:has-text("Overview")').first();
  if (await mobileOverviewBtn.isVisible()) {
    await mobileOverviewBtn.click();
    await mobilePage.waitForTimeout(600);
  }

  const mobileLeavePath = path.join(ARTIFACTS_DIR, 'round7_phaseA_leave_dialog_mobile_390.png');
  await mobilePage.screenshot({ path: mobileLeavePath });
  console.log(`Saved mobile leave dialog screenshot: ${mobileLeavePath}`);

  await browser.close();
  console.log('--- Round 7 Phase A Automated Verification Finished Successfully ---');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
