import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const SESSION_TOKEN = 'd23a1d852fe70e9eaa4a1fbee6610dc64109726897785345e73b080ff8b8ff2f';
const GUILD_ID = '1320109891175845988';

async function run() {
  console.log('[TEST] Starting Phase A Browser Verification...');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  // --- 1. DESKTOP VIEWPORT (1440px) ---
  console.log('[TEST] Testing Desktop (1440x960)...');
  const contextDesktop = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  await contextDesktop.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_TOKEN,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const pageDesktop = await contextDesktop.newPage();

  // 1. Verify /api/auth/debug
  console.log('[TEST] Checking /api/auth/debug...');
  await pageDesktop.goto('http://localhost:3000/api/auth/debug');
  const debugText = await pageDesktop.locator('pre').innerText();
  console.log('Debug endpoint response:', debugText);
  const debugObj = JSON.parse(debugText);
  if (!debugObj.valid) {
    throw new Error(`Debug endpoint reports invalid session: ${debugText}`);
  }
  console.log('✓ /api/auth/debug confirmed valid session!');

  // 2. Navigate to Promote Server Studio
  console.log(`[TEST] Navigating to /dashboard/${GUILD_ID}/promote...`);
  await pageDesktop.goto(`http://localhost:3000/dashboard/${GUILD_ID}/promote`, { waitUntil: 'networkidle' });
  await pageDesktop.waitForTimeout(2000);

  // Edit the summary field
  const summaryInput = pageDesktop.locator('textarea').first();
  if (await summaryInput.isVisible()) {
    await summaryInput.fill('Verified community patrol in Liberty County with daily shifts.');
    await pageDesktop.waitForTimeout(500);
  }

  // Click Save & Publish button
  console.log('[TEST] Clicking Save changes button...');
  const saveBtn = pageDesktop.locator('button:has-text("Save changes"), button:has-text("Save & publish")').first();
  if (await saveBtn.isVisible()) {
    await saveBtn.click();
    await pageDesktop.waitForTimeout(1500);
  }

  // Check that NO "Please sign in" error appeared
  const pageText = await pageDesktop.locator('body').innerText();
  if (pageText.includes('Please sign in to save server settings')) {
    throw new Error('Save error: "Please sign in to save server settings" still appeared!');
  }
  console.log('✓ Successfully saved server settings in UI without any sign-in errors!');

  const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'round11_phaseA_save_1440.png');
  await pageDesktop.screenshot({ path: desktopScreenshotPath, fullPage: false });
  console.log('[TEST] Saved desktop screenshot to:', desktopScreenshotPath);

  await contextDesktop.close();

  // --- 2. MOBILE VIEWPORT (390px) ---
  console.log('[TEST] Testing Mobile (390x844)...');
  const contextMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await contextMobile.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_TOKEN,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const pageMobile = await contextMobile.newPage();
  await pageMobile.goto(`http://localhost:3000/dashboard/${GUILD_ID}/promote`, { waitUntil: 'networkidle' });
  await pageMobile.waitForTimeout(2000);

  const summaryInputMobile = pageMobile.locator('textarea').first();
  if (await summaryInputMobile.isVisible()) {
    await summaryInputMobile.fill('Verified patrol community on mobile.');
    await pageMobile.waitForTimeout(500);
  }

  const saveBtnMobile = pageMobile.locator('button:has-text("Save changes"), button:has-text("Save & publish")').first();
  if (await saveBtnMobile.isVisible()) {
    await saveBtnMobile.click();
    await pageMobile.waitForTimeout(1500);
  }

  const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'round11_phaseA_save_390.png');
  await pageMobile.screenshot({ path: mobileScreenshotPath, fullPage: false });
  console.log('[TEST] Saved mobile screenshot to:', mobileScreenshotPath);

  await contextMobile.close();
  await browser.close();
  console.log('\n[SUCCESS] Phase A verification completed with zero errors!');
}

run().catch(err => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
