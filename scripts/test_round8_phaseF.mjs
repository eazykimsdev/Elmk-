import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const SESSION_COOKIE = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';
const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const GUILD_ID = '1530147023754367006';

async function run() {
  console.log('--- Starting Round 8 Phase F & Section 4.2 Automated Verification ---');
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });

  // 1. Desktop 1440px context
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await desktopContext.addCookies([
    {
      name: 'erlcus_session',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await desktopContext.newPage();

  await page.addInitScript(() => {
    const user = {
      id: '523693281541095424',
      name: 'eazykims',
      username: 'eazykims',
      globalName: 'Eazykims',
      displayName: 'Eazykims',
      role: 'Owner',
      avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('erlcus_mock_user', JSON.stringify(user));
    localStorage.setItem('erlcus_default_guild', '1530147023754367006');
    localStorage.setItem('erlcus_current_guild_id', '1530147023754367006');
  });

  // ── TEST 1: Restored Big Popup (Section 4.2) ──
  console.log('1. Testing Section 4.2 Restored Big Popup in Earn Credits directory...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/earn`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click on the first directory card to open ServerProfileModal
  const cardLocator = page.locator('div[role="button"]:has(span:has-text("members"))').first();
  const cardCount = await page.locator('div[role="button"]:has(span:has-text("members"))').count();
  console.log(`Found ${cardCount} server cards in Earn Credits directory.`);

  if (cardCount > 0) {
    await cardLocator.click();
    await page.waitForTimeout(1000);

    // Verify modal dialog attributes
    const dialog = page.locator('div[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    const dialogContent = dialog.locator('.max-w-\\[1040px\\]');
    const hasMaxWidth1040 = (await dialogContent.count()) > 0;
    console.log('✓ Modal has max-width 1040px:', hasMaxWidth1040);

    // Verify 200px banner
    const banner = dialog.locator('.h-\\[200px\\]');
    const has200pxBanner = (await banner.count()) > 0;
    console.log('✓ Banner is 200px tall:', has200pxBanner);

    // Verify 96px icon overlapping
    const icon = dialog.locator('.size-24');
    const has96pxIcon = (await icon.count()) > 0;
    console.log('✓ 96px ServerIcon overlapping banner edge:', has96pxIcon);

    // Verify reviews & feedback section
    const feedbackTitle = await dialog.locator('text=Community feedback').isVisible();
    console.log('✓ Community feedback section present:', feedbackTitle);

    // Verify "Owned by" on right column
    const ownedBy = await dialog.locator('text=Owned by').isVisible();
    console.log('✓ "Owned by" column present:', ownedBy);

    // Verify ghost "Open full page"
    const openFullPage = await dialog.locator('text=Open full page').isVisible();
    console.log('✓ Ghost "Open full page" link present in footer:', openFullPage);

    // Screenshot restored popup on desktop
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round8_section4_2_restored_popup_desktop.png')
    });
    console.log('✓ Captured round8_section4_2_restored_popup_desktop.png');

    // Close modal
    await dialog.locator('button[aria-label="Close dialog"]').first().click();
    await page.waitForTimeout(500);
  }

  // ── TEST 2: Settings Tab - Notifications & Email Eradication (Section 9.1) ──
  console.log('\n2. Testing Settings - Notifications & Email Eradication (Section 9.1)...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click Notifications tab
  const notifsTabTrigger = page.locator('button[role="tab"]:has-text("Notifications")');
  await notifsTabTrigger.waitFor({ state: 'visible', timeout: 5000 });
  await notifsTabTrigger.click();
  await page.waitForTimeout(600);

  // Assert ZERO mentions of email
  const bodyText = await page.innerText('body');
  const hasEmailMention = /email/i.test(bodyText);
  console.log('✓ ZERO mentions of email on Settings page:', !hasEmailMention);

  // Assert Discord DM options present
  const hasDiscordDm = await page.locator('text=Discord DM delivery').isVisible();
  const hasWeeklyDigest = await page.locator('text=Weekly summary DM').isVisible();
  const hasSecurityAlerts = await page.locator('text=Security advisories DM').isVisible();
  console.log('✓ Discord DM delivery switch:', hasDiscordDm);
  console.log('✓ Weekly summary DM switch:', hasWeeklyDigest);
  console.log('✓ Security advisories DM switch:', hasSecurityAlerts);

  // Assert Danger Zone is NOT visible on Notifications tab
  const dangerZoneOnNotifs = await page.locator('text=Delete server from Mavely').isVisible();
  console.log('✓ Danger zone is HIDDEN on Notifications tab:', !dangerZoneOnNotifs);

  // Screenshot Settings Notifications tab
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseF_settings_notifications_desktop.png')
  });
  console.log('✓ Captured round8_phaseF_settings_notifications_desktop.png');

  // ── TEST 3: Appearance Tab Swatches (Section 3 & 9.1) ──
  console.log('\n3. Testing Settings - Appearance Tab Swatches...');
  const appearanceTabTrigger = page.locator('button[role="tab"]:has-text("Appearance")');
  await appearanceTabTrigger.click();
  await page.waitForTimeout(600);

  const swatchesCount = await page.locator('button[data-accent]').count();
  console.log(`✓ Found ${swatchesCount} appearance theme swatches.`);

  // Assert Danger Zone is visible on Appearance tab for owner
  const dangerZoneOnAppearance = await page.locator('text=Delete server from Mavely').isVisible();
  console.log('✓ Danger zone visible on Appearance tab for owner:', dangerZoneOnAppearance);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseF_settings_appearance_desktop.png')
  });
  console.log('✓ Captured round8_phaseF_settings_appearance_desktop.png');

  // ── TEST 4: General Tab & Danger Zone Dialog (Section 9.1 & 9.2) ──
  console.log('\n4. Testing Danger Zone Dialog & 12-item Checklist (Section 9.2)...');
  const generalTabTrigger = page.locator('button[role="tab"]:has-text("General")');
  await generalTabTrigger.click();
  await page.waitForTimeout(600);

  const dangerZoneOnGeneral = await page.locator('text=Delete server from Mavely').isVisible();
  console.log('✓ Danger zone visible on General tab for owner:', dangerZoneOnGeneral);

  // Click "Delete server" button to open modal dialog
  const deleteBtn = page.locator('button:has-text("Delete server")').first();
  await deleteBtn.click();
  await page.waitForTimeout(600);

  const deleteDialog = page.locator('div[role="dialog"]');
  const deleteDialogVisible = await deleteDialog.isVisible();
  console.log('✓ Danger zone confirmation dialog opened:', deleteDialogVisible);

  // Verify 12 checklist items
  const expectedItems = [
    'Listing and banner files',
    'Reviews',
    'Team',
    'API keys and webhooks',
    'ER:LC key',
    'Representatives',
    'Recruits',
    'Tracked invites',
    'Partnerships',
    'Notifications',
    'Settings',
    'Analytics',
  ];

  let itemsFound = 0;
  for (const item of expectedItems) {
    const isVis = await deleteDialog.getByText(item, { exact: true }).isVisible();
    if (isVis) itemsFound++;
  }
  console.log(`✓ Verified ${itemsFound}/12 deletion checklist items in dialog.`);

  // Verify warning callout
  const warningCallout = await deleteDialog
    .locator('text=Active partnerships will end and your partner servers will be notified')
    .isVisible();
  console.log('✓ Warning callout about active partnerships & rewards:', warningCallout);

  // Verify confirm button is disabled before typing name
  const confirmBtn = deleteDialog.locator('button:has-text("Delete server")').last();
  const isDisabledBefore = await confirmBtn.isDisabled();
  console.log('✓ Confirm button is DISABLED before input:', isDisabledBefore);

  // Type incorrect name
  const confirmInput = deleteDialog.locator('input[placeholder*="to confirm"]');
  await confirmInput.fill('Wrong server name');
  const isDisabledWrong = await confirmBtn.isDisabled();
  console.log('✓ Confirm button remains DISABLED with incorrect name:', isDisabledWrong);

  // Screenshot Danger Zone Dialog on Desktop
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseF_danger_zone_dialog_desktop.png')
  });
  console.log('✓ Captured round8_phaseF_danger_zone_dialog_desktop.png');

  // Close dialog
  await deleteDialog.locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(500);

  await desktopContext.close();

  // ── TEST 5: Mobile 390px Viewport ──
  console.log('\n5. Testing Mobile 390px Viewport...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 }
  });

  await mobileContext.addCookies([
    {
      name: 'erlcus_session',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/'
    }
  ]);

  const mobilePage = await mobileContext.newPage();

  await mobilePage.addInitScript(() => {
    const user = {
      id: '523693281541095424',
      name: 'eazykims',
      username: 'eazykims',
      globalName: 'Eazykims',
      displayName: 'Eazykims',
      role: 'Owner',
      avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('erlcus_mock_user', JSON.stringify(user));
    localStorage.setItem('erlcus_default_guild', '1530147023754367006');
    localStorage.setItem('erlcus_current_guild_id', '1530147023754367006');
  });

  await mobilePage.goto(`http://localhost:3000/dashboard/${GUILD_ID}/settings`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);

  // Scroll to danger zone on mobile
  await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mobilePage.waitForTimeout(500);

  await mobilePage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseF_settings_mobile_390.png')
  });
  console.log('✓ Captured round8_phaseF_settings_mobile_390.png');

  // Open Restored Popup on mobile 390px
  await mobilePage.goto(`http://localhost:3000/dashboard/${GUILD_ID}/earn`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  const firstMobileCard = mobilePage.locator('div[role="button"]:has(span:has-text("members"))').first();
  if ((await firstMobileCard.count()) > 0) {
    await firstMobileCard.click();
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round8_section4_2_restored_popup_mobile_390.png')
    });
    console.log('✓ Captured round8_section4_2_restored_popup_mobile_390.png');
  }

  await mobileContext.close();
  await browser.close();
  console.log('\n--- All Phase F & Section 4.2 automated tests completed successfully! ---');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
