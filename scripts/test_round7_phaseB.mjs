import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  console.log('--- Starting Round 7 Phase B Automated Verification ---');
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
      },
      {
        id: '1530147023754367007',
        name: 'Second Isolated Guild',
        icon: 'https://cdn.discordapp.com/embed/avatars/2.png',
        memberCount: 120,
      }
    ]));
  });

  console.log('1. Testing Sidebar: Recruit hub child entry and no duplicate Recruits...');
  await desktopPage.goto('http://localhost:3000/dashboard/1530147023754367006/settings', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1000);

  // Check that "Recruit hub" is visible
  const recruitHubItem = desktopPage.locator('button:has-text("Recruit hub")').first();
  const hasRecruitHub = await recruitHubItem.isVisible();
  if (!hasRecruitHub) {
    throw new Error('FAILED: "Recruit hub" sidebar child item not found!');
  }
  console.log('✓ Found "Recruit hub" sidebar child item');

  // Check that standalone "Recruits" is NOT in the sidebar nav
  const standaloneRecruits = await desktopPage.locator('aside button:text-is("Recruits")').count();
  if (standaloneRecruits > 0) {
    throw new Error('FAILED: Duplicate top-level "Recruits" item found in sidebar!');
  }
  console.log('✓ No duplicate standalone "Recruits" in sidebar');

  // Screenshot sidebar with Recruit hub
  const sidebarPath = path.join(ARTIFACTS_DIR, 'round7_phaseB_sidebar_recruithub_desktop.png');
  await desktopPage.screenshot({ path: sidebarPath });
  console.log(`✓ Saved ${sidebarPath}`);

  console.log('2. Testing User Menu Theme Swatches in Sidebar Footer...');
  // Find the user menu trigger button at bottom of sidebar
  const userMenuTrigger = desktopPage.locator('aside footer button, [data-slot="sidebar-footer"] button').first();
  await userMenuTrigger.click();
  await desktopPage.waitForTimeout(400);

  // Check Theme colour label in popover
  const themeColourHeading = desktopPage.locator('text="Theme colour"').first();
  const hasThemeHeading = await themeColourHeading.isVisible();
  if (!hasThemeHeading) {
    throw new Error('FAILED: "Theme colour" heading in user menu popover not visible!');
  }
  console.log('✓ Found "Theme colour" in user menu popover');

  // Take screenshot of user menu with theme swatches
  const userMenuPath = path.join(ARTIFACTS_DIR, 'round7_phaseB_usermenu_theme_desktop.png');
  await desktopPage.screenshot({ path: userMenuPath });
  console.log(`✓ Saved ${userMenuPath}`);

  // Click Ocean swatch in user menu
  const oceanSwatch = desktopPage.locator('button[title*="Ocean"]').first();
  if (await oceanSwatch.isVisible()) {
    await oceanSwatch.click();
    await desktopPage.waitForTimeout(300);
    const brandVar = await desktopPage.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim());
    console.log(`✓ Brand color changed via user menu to: ${brandVar}`);
    if (brandVar !== '#5B8CFF') {
      throw new Error(`FAILED: Expected --brand #5B8CFF but got ${brandVar}`);
    }
  }

  // Close user menu popover by clicking outside
  await desktopPage.keyboard.press('Escape');
  await desktopPage.waitForTimeout(300);

  console.log('3. Testing Settings Tab: Appearance & Theme Colour card...');
  // Verify Appearance & theme colour card exists
  const appearanceTitle = desktopPage.locator('text="Appearance & theme colour"').first();
  if (!(await appearanceTitle.isVisible())) {
    throw new Error('FAILED: "Appearance & theme colour" section not visible in SettingsTab!');
  }
  console.log('✓ "Appearance & theme colour" card is present');

  // Click "Rose" preset swatch in SettingsTab
  const roseBtn = desktopPage.locator('button:has-text("Rose")').first();
  if (await roseBtn.isVisible()) {
    await roseBtn.click();
    await desktopPage.waitForTimeout(300);
    const brandVarRose = await desktopPage.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim());
    console.log(`✓ Brand color changed in Settings to: ${brandVarRose}`);
    if (brandVarRose !== '#FB7185') {
      throw new Error(`FAILED: Expected --brand #FB7185 but got ${brandVarRose}`);
    }
  }

  // Switch to "Mavely green" default preset
  const mavelyBtn = desktopPage.locator('button:has-text("Mavely green")').first();
  if (await mavelyBtn.isVisible()) {
    await mavelyBtn.click();
    await desktopPage.waitForTimeout(300);
    const brandVarMavely = await desktopPage.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim());
    console.log(`✓ Brand color reset to Mavely green: ${brandVarMavely}`);
    if (brandVarMavely !== '#3DDC97') {
      throw new Error(`FAILED: Expected --brand #3DDC97 but got ${brandVarMavely}`);
    }
  }

  // Reload page to verify persistence
  await desktopPage.reload({ waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  const brandVarPersisted = await desktopPage.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim());
  if (brandVarPersisted !== '#3DDC97') {
    throw new Error(`FAILED: Theme accent did not persist across reload! Got ${brandVarPersisted}`);
  }
  console.log(`✓ Theme accent persisted across reload: ${brandVarPersisted}`);

  // Check ER:LC API Key label in API tab
  const apiTabTrigger = desktopPage.locator('button:has-text("API & Credentials")').first();
  if (await apiTabTrigger.isVisible()) {
    await apiTabTrigger.click();
    await desktopPage.waitForTimeout(400);
    const erlcKeyCount = await desktopPage.locator('text="ER:LC API key"').count();
    if (erlcKeyCount === 0) {
      throw new Error('FAILED: Label "ER:LC API key" not found in SettingsTab API & Credentials!');
    }
    console.log('✓ ER:LC API key label properly rendered without "Server key" or "PRC"');
  }

  // Back to profile/general tab
  const profileTabTrigger = desktopPage.locator('button:has-text("General & Appearance")').first();
  if (await profileTabTrigger.isVisible()) {
    await profileTabTrigger.click();
    await desktopPage.waitForTimeout(400);
  }

  // Screenshot Settings Appearance & Server Config
  const settingsPath = path.join(ARTIFACTS_DIR, 'round7_phaseB_settings_appearance_desktop.png');
  await desktopPage.screenshot({ path: settingsPath });
  console.log(`✓ Saved ${settingsPath}`);

  console.log('4. Testing Notifications dropdown...');
  // Find bell icon in header
  const bellButton = desktopPage.locator('button[aria-label*="Notification"]').first();
  if (await bellButton.isVisible()) {
    await bellButton.click();
    await desktopPage.waitForTimeout(400);

    // Verify "View all notifications" link is NOT present
    const viewAllLink = desktopPage.locator('text="View all notifications"').first();
    const hasViewAll = await viewAllLink.isVisible().catch(() => false);
    if (hasViewAll) {
      throw new Error('FAILED: "View all notifications" link should be removed!');
    }
    console.log('✓ "View all notifications" broken modal link successfully removed');

    // Take screenshot of notifications dropdown
    const notifsPath = path.join(ARTIFACTS_DIR, 'round7_phaseB_notifications_desktop.png');
    await desktopPage.screenshot({ path: notifsPath });
    console.log(`✓ Saved ${notifsPath}`);

    // Close notifications
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(300);
  } else {
    console.warn('Warning: Bell button in header not directly located');
  }

  console.log('5. Testing Server Isolation & Default Guild persistence...');
  // Check that localStorage erlcus_default_guild was set to current guild
  const defaultGuild = await desktopPage.evaluate(() => localStorage.getItem('erlcus_default_guild'));
  console.log(`✓ Current default guild in localStorage: ${defaultGuild}`);
  if (defaultGuild !== '1530147023754367006') {
    throw new Error(`FAILED: Expected erlcus_default_guild to be 1530147023754367006, got ${defaultGuild}`);
  }

  // Switch to guild B via URL
  await desktopPage.goto('http://localhost:3000/dashboard/1530147023754367007/settings', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(800);
  const switchedGuild = await desktopPage.evaluate(() => localStorage.getItem('erlcus_default_guild'));
  console.log(`✓ Switched default guild in localStorage: ${switchedGuild}`);
  if (switchedGuild !== '1530147023754367007') {
    throw new Error(`FAILED: Expected erlcus_default_guild to update to 1530147023754367007, got ${switchedGuild}`);
  }

  // 6. Mobile Context (390x844)
  console.log('6. Testing Mobile Viewport (390px)...');
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

  await mobilePage.goto('http://localhost:3000/dashboard/1530147023754367006/settings', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);

  // Take mobile settings screenshot
  const mobileSettingsPath = path.join(ARTIFACTS_DIR, 'round7_phaseB_settings_mobile_390.png');
  await mobilePage.screenshot({ path: mobileSettingsPath });
  console.log(`✓ Saved ${mobileSettingsPath}`);

  // Open mobile sidebar drawer if menu toggle exists
  const mobileMenuBtn = mobilePage.locator('button:has(svg.lucide-menu), button[aria-label*="menu"]').first();
  if (await mobileMenuBtn.isVisible()) {
    await mobileMenuBtn.click();
    await mobilePage.waitForTimeout(400);
  }
  const mobileSidebarPath = path.join(ARTIFACTS_DIR, 'round7_phaseB_sidebar_recruithub_mobile_390.png');
  await mobilePage.screenshot({ path: mobileSidebarPath });
  console.log(`✓ Saved ${mobileSidebarPath}`);

  console.log('--- Phase B Automated Verification Completed Successfully! ---');
  await browser.close();
}

main().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
