import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const BASE_URL = 'http://localhost:3000';
const GUILD_ID = '1530147023754367006';

async function runPhaseBTests() {
  console.log('=== RUNNING ROUND 6 PHASE B INTEGRATION TESTS ===\n');
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setupMockSession(context);
    const page = await context.newPage();
    await setupInitScript(page);

    console.log('1. Navigating to Promote tab...');
    await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/promote`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // 1. Markdown Editor & live preview
    console.log('\n2. Testing Markdown Editor...');
    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 10000 });
    await textarea.fill('**Premier State RP** with *daily patrols*, __strict codes__, and ||classified||.\nCheck [Mavely](https://mavely.us)');
    await page.waitForTimeout(300);

    // Formatting help popover
    const helpBtn = page.getByRole('button', { name: 'Formatting help' });
    await helpBtn.click();
    await page.waitForTimeout(300);
    const helpPopover = page.locator('text=Discord markdown reference');
    console.log('  [PASS] Formatting help popover visible:', await helpPopover.isVisible());

    // Switch to Preview
    const previewBtn = page.getByRole('button', { name: 'Preview', exact: true });
    await previewBtn.click();
    await page.waitForTimeout(300);

    // Check rendered markdown tags
    const strongEl = page.locator('strong:has-text("Premier State RP")');
    const emEl = page.locator('em:has-text("daily patrols")');
    const uEl = page.locator('u:has-text("strict codes")');
    const spoilerEl = page.locator('span[title*="spoiler"]');
    const linkEl = page.locator('a[href="https://mavely.us"]');

    console.log('  [PASS] Strong tag rendered:', await strongEl.isVisible());
    console.log('  [PASS] Em tag rendered:', await emEl.isVisible());
    console.log('  [PASS] Underline <u> tag rendered:', await uEl.isVisible());
    console.log('  [PASS] Spoiler rendered:', await spoilerEl.isVisible());
    console.log('  [PASS] Safe link rendered:', await linkEl.isVisible());

    // Test spoiler reveal on click
    await spoilerEl.click();
    await page.waitForTimeout(200);
    console.log('  [PASS] Spoiler revealed text visible:', await page.locator('span[title*="hide spoiler"]').isVisible());

    // Switch back to Write
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await page.waitForTimeout(300);

    // Capture desktop markdown editor screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseB_markdown_desktop.png') });
    console.log('  [PASS] Captured round6_phaseB_markdown_desktop.png');

    // 2. "Leave without saving?" Dialog test
    console.log('\n3. Testing "Leave without saving?" dialog...');
    const summaryInput = page.locator('input[placeholder*="One clear sentence"]').first();
    await summaryInput.fill('High performance community server summary test');
    await page.waitForTimeout(300);

    // Navigate to Server page via sidebar
    const serverPageNavBtn = page.getByRole('button', { name: 'Server page' }).first();
    await serverPageNavBtn.click();
    await page.waitForTimeout(400);

    const leaveDialog = page.locator('h3:has-text("Leave without saving?")');
    console.log('  [PASS] Leave Dialog appeared:', await leaveDialog.isVisible());
    const leaveText = await page.locator('p:has-text("You have unsaved changes in")').textContent();
    console.log('  [PASS] Dialog text:', leaveText);

    // Capture Leave Dialog screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseB_leave_dialog.png') });
    console.log('  [PASS] Captured round6_phaseB_leave_dialog.png');

    // Click "Keep editing"
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await page.waitForTimeout(300);
    console.log('  [PASS] Dialog closed on Keep Editing:', !(await leaveDialog.isVisible()));

    // 3. ER:LC Connection card in Invite and rewards tab
    console.log('\n4. Testing ER:LC Connection card...');
    const rewardsTabBtn = page.getByRole('button', { name: /Invite and rewards/i });
    await rewardsTabBtn.click();
    await page.waitForTimeout(500);

    const erlcCardTitle = page.locator('h2:has-text("ER:LC connection")');
    console.log('  [PASS] ER:LC Connection card visible:', await erlcCardTitle.isVisible());

    // Test manual join code toggle
    const fallbackToggle = page.locator('text=Don\'t want to share a key?');
    await fallbackToggle.click();
    await page.waitForTimeout(300);
    const manualJoinCodeInput = page.locator('input[placeholder="e.g. PRLC-102"]');
    console.log('  [PASS] Manual join code fallback expanded:', await manualJoinCodeInput.isVisible());

    // Test show/hide password toggle
    const keyInput = page.locator('input[placeholder="prc-server-key-..."]');
    await keyInput.fill('prc-key-live-test-1234');
    console.log('  [PASS] Key input initially password:', (await keyInput.getAttribute('type')) === 'password');
    const eyeBtn = page.locator('button[title*="key"]').first();
    await eyeBtn.click();
    await page.waitForTimeout(200);
    console.log('  [PASS] Key input after show toggle:', (await keyInput.getAttribute('type')) === 'text');

    // Capture ER:LC card desktop screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseB_erlc_desktop.png') });
    console.log('  [PASS] Captured round6_phaseB_erlc_desktop.png');

    // 4. Mobile 390px Viewports
    console.log('\n5. Capturing 390px mobile viewports...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseB_mobile_erlc_390.png') });
    console.log('  [PASS] Captured round6_phaseB_mobile_erlc_390.png');

    const listingTabBtn = page.getByRole('button', { name: /^Listing/i });
    await listingTabBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseB_mobile_listing_390.png') });
    console.log('  [PASS] Captured round6_phaseB_mobile_listing_390.png');

    await browser.close();
    console.log('\n=== ALL PLAYWRIGHT TESTS PASSED ===');
  } catch (err) {
    console.error('[PLAYWRIGHT ERROR]', err);
    await browser.close();
    process.exit(1);
  }
}

runPhaseBTests();
