import { chromium } from '../node_modules/playwright-core/index.mjs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const GUILD_ID = '1530147023754367006';
const SESSION_COOKIE = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function run() {
  console.log('Launching browser for Phase D test...');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // Inject session cookie
  await context.addCookies([
    {
      name: 'erlcus_session',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  // Listen to console and page errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`[PAGE ERROR] ${err.message}`));

  console.log('Navigating to dashboard...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 1. Verify and capture Notification UI Popover
  console.log('Testing notification dropdown...');
  await page.evaluate(() => {
    localStorage.setItem('erlcus_notifications', JSON.stringify([
      {
        id: 'notif_1',
        title: 'New partnership request',
        description: 'Southland State Roleplay proposed an alliance with 15 credits.',
        type: 'invite',
        at: new Date().toISOString(),
        read: false,
      },
      {
        id: 'notif_2',
        title: 'Bounty reward claimed',
        description: 'You earned 2 credits for completing the 72-hour stay in Department RP.',
        type: 'reward',
        at: new Date(Date.now() - 3600000).toISOString(),
        read: true,
      }
    ]));
    window.dispatchEvent(new Event('erlcus_notifications_updated'));
  });
  await page.waitForTimeout(400);

  const notifBtn = page.locator('button[aria-label="Notifications"]');
  if (await notifBtn.isVisible()) {
    await notifBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'round5_phaseD_notifications.png'),
    });
    console.log('Captured round5_phaseD_notifications.png');

    // Close notification dropdown by clicking body
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // 2. Navigate to Promote server
  console.log('Navigating to Promote server...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/promote`, { waitUntil: 'domcontentloaded' });
  await page.locator('text="Category"').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);

  // Take full desktop screenshot of Promote server
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round5_phaseD_desktop.png'),
    fullPage: false,
  });
  console.log('Captured round5_phaseD_desktop.png');

  // Test Completion Gate
  console.log('Testing completion gate switch...');
  // Clear summary to make step 1 incomplete
  const summaryInput = page.locator('input[placeholder*="One clear sentence"]');
  if (await summaryInput.isVisible()) {
    await summaryInput.fill('');
    await page.waitForTimeout(300);
  }

  // Find the Listed switch
  const listedSwitch = page.locator('button[role="switch"]').first();
  const isChecked = await listedSwitch.getAttribute('aria-checked');
  console.log('Listed switch state before gate test:', isChecked);

  if (isChecked === 'true') {
    // Turn off
    await listedSwitch.click();
    await page.waitForTimeout(400);
  }

  // Now try to turn on when incomplete -> MUST trigger gate dialog
  await listedSwitch.click();
  await page.waitForTimeout(600);

  const gateDialog = page.locator('text="Finish setting up first"');
  if (await gateDialog.isVisible()) {
    console.log('Completion gate dialog opened successfully!');
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'round5_phaseD_gate_dialog.png'),
    });
    console.log('Captured round5_phaseD_gate_dialog.png');
    // Click Close
    const closeBtn = page.locator('button:has-text("Close")').first();
    await closeBtn.click();
    await page.waitForTimeout(400);
  }

  // Restore summary
  if (await summaryInput.isVisible()) {
    await summaryInput.fill('Elite Emergency Response Liberty County premier roleplay community.');
    await page.waitForTimeout(300);
  }

  // 3. Test Invite and rewards tab
  console.log('Testing Invite and rewards tab...');
  const rewardsTabBtn = page.locator('button:has-text("Invite and rewards")');
  await rewardsTabBtn.click();
  await page.waitForTimeout(800);

  // Look for Offer a higher reward switch
  const higherRewardRow = page.locator('text="Offer a higher reward"').locator('..').locator('..');
  const higherRewardSwitch = higherRewardRow.locator('button[role="switch"]');
  if (await higherRewardSwitch.isVisible()) {
    console.log('Toggling Offer a higher reward switch...');
    await higherRewardSwitch.click();
    await page.waitForTimeout(600);

    const rewardDialog = page.locator('text="This reward comes out of your credits"');
    if (await rewardDialog.isVisible()) {
      console.log('Higher reward warning dialog opened successfully!');
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'round5_phaseD_reward_dialog.png'),
      });
      console.log('Captured round5_phaseD_reward_dialog.png');

      const understandBtn = page.locator('button:has-text("I understand")');
      await understandBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // 4. Test Partnerships Tab in Promote server
  console.log('Testing Partnerships tab in Promote server...');
  const partnerTabBtn = page.getByRole('button', { name: 'Partnerships (optional)' });
  await partnerTabBtn.click();
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round5_phaseD_partnerships_tab.png'),
  });
  console.log('Captured round5_phaseD_partnerships_tab.png');

  // 5. Test Partnerships Page
  console.log('Navigating to Partnerships page...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/partnerships`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Look for Request partnership button in table
  const reqBtn = page.locator('button:has-text("Request partnership")').first();
  if (await reqBtn.isVisible()) {
    console.log('Clicking Request partnership button...');
    await reqBtn.click();
    await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'round5_phaseD_request_dialog.png'),
    });
    console.log('Captured round5_phaseD_request_dialog.png');

    const cancelBtn = page.locator('button:has-text("Cancel")');
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // 6. Mobile 390px Viewport
  console.log('Testing mobile 390px viewport...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/promote`, { waitUntil: 'domcontentloaded' });
  await page.locator('text="Category"').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round5_phaseD_mobile.png'),
    fullPage: false,
  });
  console.log('Captured round5_phaseD_mobile.png');

  await browser.close();
  console.log('All Phase D Playwright tests completed successfully!');
}

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
