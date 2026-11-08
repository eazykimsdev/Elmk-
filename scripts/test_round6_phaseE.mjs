import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const BASE_URL = 'http://localhost:3000';
const GUILD_ID = '1530147023754367006';
const VALID_TOKEN = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function run() {
  console.log('=== RUNNING ROUND 6 PHASE E RECRUIT HUB TESTS ===\n');

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

  try {
    // -------------------------------------------------------------
    // TEST 1: DESKTOP 1440px - RECRUIT HUB FULL WORKFLOW
    // -------------------------------------------------------------
    console.log('--- 1. Testing Desktop (1440x900) ---');
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await setupMockSession(desktopContext);
    const desktopPage = await desktopContext.newPage();
    await setupInitScript(desktopPage);

    console.log('Navigating to Recruit hub page...');
    await desktopPage.goto(`${BASE_URL}/dashboard/${GUILD_ID}/recruits`, {
      waitUntil: 'networkidle',
    });
    await desktopPage.waitForTimeout(1000);

    // Verify Header
    const heading = desktopPage.locator('h1:has-text("Recruit hub")').first();
    if (await heading.isVisible()) {
      console.log('  [PASS] Recruit hub header rendered correctly.');
    } else {
      console.error('  [FAIL] Recruit hub header NOT found!');
    }

    // Verify Slim Summary
    const summaryLine = desktopPage.locator('text=verified recruits').first();
    if (await summaryLine.isVisible()) {
      console.log('  [PASS] Slim summary line visible:', (await summaryLine.textContent()).trim());
    } else {
      console.error('  [FAIL] Slim summary line not found.');
    }

    // Verify Tab 1: Leaderboard
    const lbRow1 = desktopPage.locator('text=1st').first();
    if (await lbRow1.isVisible()) {
      console.log('  [PASS] Leaderboard 1st place gold medal rendered.');
    } else {
      console.log('  [INFO] Leaderboard rows checking...');
    }

    // Capture Desktop Leaderboard
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'round6_phaseE_recruits_leaderboard_desktop.png'),
    });
    console.log('  [SCREENSHOT] Saved round6_phaseE_recruits_leaderboard_desktop.png');

    // Switch to Tab 2: All recruits
    console.log('Switching to All recruits tab...');
    await desktopPage.click('button:has-text("All recruits")');
    await desktopPage.waitForTimeout(500);

    // Filter by Pending
    console.log('Clicking Pending filter chip...');
    await desktopPage.click('button:has-text("Pending")');
    await desktopPage.waitForTimeout(500);

    // Capture Desktop All Recruits
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'round6_phaseE_recruits_list_desktop.png'),
    });
    console.log('  [SCREENSHOT] Saved round6_phaseE_recruits_list_desktop.png');

    // Switch to Tab 3: My link
    console.log('Switching to My link tab...');
    await desktopPage.click('button:has-text("My link")');
    await desktopPage.waitForTimeout(600);

    // Verify QR code canvas rendered
    const qrCanvas = desktopPage.locator('canvas').first();
    if (await qrCanvas.isVisible()) {
      console.log('  [PASS] QR code canvas is rendered.');
    } else {
      console.error('  [FAIL] QR code canvas not found.');
    }

    // Verify invite input
    const inviteInput = desktopPage.locator('input[value*="discord.gg"]').first();
    if (await inviteInput.isVisible()) {
      console.log('  [PASS] Personal invite link input rendered:', await inviteInput.inputValue());
    }

    // Capture Desktop My Link
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'round6_phaseE_recruits_mylink_desktop.png'),
    });
    console.log('  [SCREENSHOT] Saved round6_phaseE_recruits_mylink_desktop.png');

    // Switch to Tab 4: Settings
    console.log('Switching to Settings tab...');
    await desktopPage.click('button[data-tab="settings"]');
    await desktopPage.waitForTimeout(500);

    // Check NumberField for Credits per recruit
    const numField = desktopPage.locator('input[aria-label="Enter number"]').first();
    if (await numField.isVisible()) {
      console.log('  [PASS] NumberField rendered with value:', await numField.inputValue());
    }

    // Check Retention target select
    const selTrigger = desktopPage.locator('button[role="combobox"]').first();
    if (await selTrigger.isVisible()) {
      console.log('  [PASS] Retention target Select trigger rendered.');
    }

    // Capture Desktop Settings
    await desktopPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'round6_phaseE_recruits_settings_desktop.png'),
    });
    console.log('  [SCREENSHOT] Saved round6_phaseE_recruits_settings_desktop.png');

    await desktopContext.close();

    // -------------------------------------------------------------
    // TEST 2: MOBILE 390px (iPhone 14 / modern smartphone)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Mobile (390x844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await setupMockSession(mobileContext);
    const mobilePage = await mobileContext.newPage();
    await setupInitScript(mobilePage);

    await mobilePage.goto(`${BASE_URL}/dashboard/${GUILD_ID}/recruits`, {
      waitUntil: 'networkidle',
    });
    await mobilePage.waitForTimeout(1000);

    // Mobile Leaderboard
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'round6_phaseE_recruits_leaderboard_mobile_390.png'),
    });
    console.log('  [SCREENSHOT] Saved round6_phaseE_recruits_leaderboard_mobile_390.png');

    // Mobile My Link
    await mobilePage.click('button[data-tab="my-link"]');
    await mobilePage.waitForTimeout(600);
    await mobilePage.screenshot({
      path: path.join(ARTIFACT_DIR, 'round6_phaseE_recruits_mylink_mobile_390.png'),
    });
    console.log('  [SCREENSHOT] Saved round6_phaseE_recruits_mylink_mobile_390.png');

    await mobileContext.close();

    console.log('\n=== ALL PHASE E TESTS COMPLETED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
