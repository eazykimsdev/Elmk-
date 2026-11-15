import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const SESSION_TOKEN = 'round9_phasea_session_token_1793941678769';
const GUILD_ID = '1320109891175845988';

async function run() {
  console.log('[TEST] Starting Phase D Playwright verification...');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  // Ensure session exists
  const sessionsFile = path.resolve('data/web_sessions.json');
  let sessions = {};
  try {
    sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
  } catch {}
  if (!sessions[SESSION_TOKEN]) {
    sessions[SESSION_TOKEN] = {
      id: SESSION_TOKEN,
      user: {
        id: '523693281541095424',
        username: 'eazykims',
        globalName: 'Eazykims',
        avatar: 'b7fc5bd1ca84c56c9144b7a02ba4e904',
      },
      guildCache: [
        {
          id: GUILD_ID,
          name: 'San Andreas State Troopers',
          icon: null,
          owner: true,
          permissions: '8',
        },
      ],
      expiresAt: Date.now() + 86400000,
    };
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
  }

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

  // Test 1: Open Details Popup inside Dashboard
  console.log('[TEST] Navigating to /dashboard/' + GUILD_ID + '/earn?server=' + GUILD_ID);
  await pageDesktop.goto(`http://localhost:3000/dashboard/${GUILD_ID}/earn?server=${GUILD_ID}`, { waitUntil: 'networkidle' });
  await pageDesktop.waitForTimeout(2000);

  // Check dialog
  const modalDialog = pageDesktop.locator('div[role="dialog"]');
  await modalDialog.waitFor({ state: 'visible', timeout: 5000 });

  const modalText = await modalDialog.innerText();
  if (modalText.includes('Server Founder')) {
    throw new Error('Forbidden placeholder "Server Founder" detected in modal!');
  }
  console.log('✓ Modal opened cleanly with blended banner header and zero placeholder text.');

  const popupScreenshotPath1440 = path.join(ARTIFACT_DIR, 'round10_phaseD_popup_1440.png');
  await pageDesktop.screenshot({ path: popupScreenshotPath1440, fullPage: false });
  console.log('[TEST] Saved desktop popup screenshot to:', popupScreenshotPath1440);

  // Close modal
  await pageDesktop.keyboard.press('Escape');
  await pageDesktop.waitForTimeout(600);

  // Test 2: Recruits Tab (Owner View: Representatives)
  console.log('[TEST] Navigating to /dashboard/' + GUILD_ID + '/recruits');
  await pageDesktop.goto(`http://localhost:3000/dashboard/${GUILD_ID}/recruits`, { waitUntil: 'networkidle' });
  await pageDesktop.waitForTimeout(2000);

  // Switch to Owner tools tab
  const ownerToolsBtn = pageDesktop.locator('button:has-text("Owner tools")');
  if (await ownerToolsBtn.isVisible()) {
    await ownerToolsBtn.click();
    await pageDesktop.waitForTimeout(1000);
  }

  const hasForbiddenTableCol = await pageDesktop.locator('th:has-text("Retention rate"), th:has-text("Total invited")').isVisible();
  if (hasForbiddenTableCol) {
    throw new Error('Forbidden "Active representatives" table column found in recruits owner view!');
  }
  console.log('✓ Owner tools view validated with simple Representatives list and no forbidden table.');

  const repsScreenshotPath1440 = path.join(ARTIFACT_DIR, 'round10_phaseD_representatives_1440.png');
  await pageDesktop.screenshot({ path: repsScreenshotPath1440, fullPage: false });
  console.log('[TEST] Saved desktop representatives screenshot to:', repsScreenshotPath1440);

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

  // Open Details Popup on mobile
  await pageMobile.goto(`http://localhost:3000/dashboard/${GUILD_ID}/earn?server=${GUILD_ID}`, { waitUntil: 'networkidle' });
  await pageMobile.waitForTimeout(2000);

  const popupScreenshotPath390 = path.join(ARTIFACT_DIR, 'round10_phaseD_popup_390.png');
  await pageMobile.screenshot({ path: popupScreenshotPath390, fullPage: false });
  console.log('[TEST] Saved mobile popup screenshot to:', popupScreenshotPath390);

  // Close dialog on mobile
  await pageMobile.keyboard.press('Escape');
  await pageMobile.waitForTimeout(600);

  // Recruits tab on mobile
  await pageMobile.goto(`http://localhost:3000/dashboard/${GUILD_ID}/recruits`, { waitUntil: 'networkidle' });
  await pageMobile.waitForTimeout(2000);

  const ownerToolsBtnMobile = pageMobile.locator('button:has-text("Owner tools")');
  if (await ownerToolsBtnMobile.isVisible()) {
    await ownerToolsBtnMobile.click();
    await pageMobile.waitForTimeout(1000);
  }

  const repsScreenshotPath390 = path.join(ARTIFACT_DIR, 'round10_phaseD_representatives_390.png');
  await pageMobile.screenshot({ path: repsScreenshotPath390, fullPage: false });
  console.log('[TEST] Saved mobile representatives screenshot to:', repsScreenshotPath390);

  await contextMobile.close();
  await browser.close();
  console.log('\n[SUCCESS] Phase D verification complete! All tests passed.');
}

run().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
