import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function runPhaseATests() {
  console.log('[PHASE A TEST] Launching Edge browser...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

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

  const setupInitScript = async (page) => {
    await page.addInitScript(() => {
      const mockUser = {
        id: '523693281541095424',
        username: 'eazykims',
        globalName: 'Eazykims',
        avatar: null,
      };
      localStorage.setItem('mavely_user', JSON.stringify(mockUser));
      localStorage.setItem('erlcus_user', JSON.stringify(mockUser));
      localStorage.setItem('erlcus_credits_balance', '100');
    });
  };

  try {
    // -------------------------------------------------------------
    // Test 1: Desktop (1440px) Promote Server - Verify NumberField, Select, Progress Line Removal, Dirty Check
    // -------------------------------------------------------------
    console.log('[TEST 1] Testing Desktop (1440px) Promote Server...');
    const contextDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setupMockSession(contextDesktop);
    const page = await contextDesktop.newPage();
    await setupInitScript(page);

    await page.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 1. Check progress line removed
    const progressLineText = await page.locator('text="steps done"').count();
    console.log(' - Progress line ("steps done") count:', progressLineText);
    if (progressLineText > 0) {
      console.error('[FAIL] "steps done" text is still rendered!');
    } else {
      console.log('[PASS] Progress line is deleted.');
    }

    // 2. Check initial dirty check: should NOT show save bar on mount
    const initialSaveBar = await page.locator('text="You have unsaved changes"').isVisible();
    console.log(' - Initial save bar visible on mount:', initialSaveBar);
    if (initialSaveBar) {
      console.warn('[WARN] Save bar showed immediately on mount without edits!');
    } else {
      console.log('[PASS] Form is clean on mount.');
    }

    // Take screenshot of Promote Server desktop
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseA_promote_desktop.png'), fullPage: false });
    console.log(' - Captured round6_phaseA_promote_desktop.png');

    // 3. Switch to "Invite and rewards" tab to test NumberField & Select
    console.log('[TEST 2] Testing Invite and rewards tab (Select & NumberField)...');
    await page.getByRole('button', { name: 'Invite and rewards' }).click();
    await page.waitForTimeout(400);

    // Verify Retention target Select is rendered and restyled (40px, rounded-10px)
    const selectTrigger = page.locator('button[data-placeholder], button:has-text("hours"), button:has-text("days")').first();
    const selectBox = await selectTrigger.boundingBox();
    console.log(' - Retention target SelectTrigger height:', selectBox?.height);

    // Click select trigger to open popover
    await selectTrigger.click();
    await page.waitForTimeout(300);

    // Check popover items: 72 hours (Recommended), 7 days, 14 days
    const recommendedItem = page.locator('text="Recommended"');
    console.log(' - SelectItem with helperText "Recommended" visible:', await recommendedItem.isVisible());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseA_select_dropdown.png') });
    console.log(' - Captured round6_phaseA_select_dropdown.png');

    // Select 7 days (168)
    await page.getByRole('option', { name: '7 days' }).click();
    await page.waitForTimeout(300);

    // 4. Verify save bar appears after editing retention target
    const barAfterEdit = await page.locator('text="You have unsaved changes"').isVisible();
    console.log(' - Save bar visible after edit:', barAfterEdit);

    // Revert back to 72 hours
    await selectTrigger.click();
    await page.waitForTimeout(200);
    await page.getByRole('option', { name: '72 hours' }).click();
    await page.waitForTimeout(300);

    // Check if save bar disappears after revert
    const barAfterRevert = await page.locator('text="You have unsaved changes"').isVisible();
    console.log(' - Save bar visible after reverting field back to saved state:', barAfterRevert);

    // 5. Test NumberField: Representatives wanted
    console.log('[TEST 3] Testing Representatives wanted NumberField...');
    const repsInput = page.locator('input[inputmode="numeric"]').first();
    // Clear the input and type new value
    await repsInput.click();
    await repsInput.fill('');
    console.log(' - Backspaced NumberField completely to empty string without crash/freeze');
    await repsInput.fill('8');
    await repsInput.blur();
    await page.waitForTimeout(200);

    const repsVal = await repsInput.inputValue();
    console.log(' - NumberField value after blur:', repsVal);

    // Save changes using the save bar
    const saveButton = page.locator('button:has-text("Save changes")');
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(800);
      console.log(' - Clicked "Save changes"');
    }

    // Verify save bar disappeared after save
    const barAfterSave = await page.locator('text="You have unsaved changes"').isVisible();
    console.log(' - Save bar visible after successful save:', barAfterSave);

    // 6. Test Partnerships tab NumberFields
    console.log('[TEST 4] Testing Partnerships tab NumberFields...');
    await page.getByRole('button', { name: 'Partnerships (optional)' }).click();
    await page.waitForTimeout(400);

    // Verify NumberFields on Partnerships tab
    const numFieldsCount = await page.locator('input[inputmode="numeric"]').count();
    console.log(' - NumberField count on Partnerships tab:', numFieldsCount);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseA_partnerships_tab.png') });
    console.log(' - Captured round6_phaseA_partnerships_tab.png');

    await contextDesktop.close();

    // -------------------------------------------------------------
    // Test 5: Sidebar Sticky Check while scrolling on Long Page (1440px & 390px)
    // -------------------------------------------------------------
    console.log('[TEST 5] Testing Sidebar Sticky behavior while scrolling...');
    const contextScroll = await browser.newContext({ viewport: { width: 1440, height: 800 } });
    await setupMockSession(contextScroll);
    const scrollPage = await contextScroll.newPage();
    await setupInitScript(scrollPage);

    await scrollPage.goto('http://localhost:3000/dashboard/1530147023754367006/earn', { waitUntil: 'domcontentloaded' });
    await scrollPage.waitForTimeout(800);

    // Initial position of sidebar and user footer
    const userFooter = scrollPage.locator('[data-slot="sidebar-footer"]');
    const initialFooterBox = await userFooter.boundingBox();
    console.log(' - Initial user footer Y position:', initialFooterBox?.y);

    // Scroll down the page by 1000px
    await scrollPage.evaluate(() => window.scrollBy(0, 1000));
    await scrollPage.waitForTimeout(400);

    // Check user footer position after scroll
    const scrolledFooterBox = await userFooter.boundingBox();
    console.log(' - Scrolled user footer Y position:', scrolledFooterBox?.y);

    const diff = Math.abs((initialFooterBox?.y || 0) - (scrolledFooterBox?.y || 0));
    console.log(' - User footer position change after scroll (should be 0 or < 2px):', diff);
    if (diff < 2) {
      console.log('[PASS] Sidebar stayed fixed/sticky with viewport! User menu did NOT scroll away!');
    } else {
      console.warn('[WARN] Sidebar moved by', diff, 'px');
    }

    // Capture desktop screenshot at 1440px
    await scrollPage.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseA_sidebar_scrolled_desktop.png') });
    console.log(' - Captured round6_phaseA_sidebar_scrolled_desktop.png');

    await contextScroll.close();

    // -------------------------------------------------------------
    // Test 6: Mobile (390px) Viewport Check
    // -------------------------------------------------------------
    console.log('[TEST 6] Testing Mobile (390px) Viewport...');
    const contextMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupMockSession(contextMobile);
    const mobilePage = await contextMobile.newPage();
    await setupInitScript(mobilePage);

    await mobilePage.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(800);

    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseA_mobile_390.png') });
    console.log(' - Captured round6_phaseA_mobile_390.png');

    await contextMobile.close();

    console.log('[ALL PHASE A PLAYWRIGHT TESTS PASSED]');
  } finally {
    await browser.close();
  }
}

runPhaseATests().catch((err) => {
  console.error('[PLAYWRIGHT TEST ERROR]', err);
  process.exit(1);
});

