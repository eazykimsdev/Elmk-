import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SESSION_COOKIE = '3efc5ed1fe201f742dfd11150d9867f60edf587a50f1ec608114bbf074d59bc0';
const GUILD_ID = '1320109891175845988';

async function scanGreen(page, contextName) {
  const greens = await page.evaluate(() => {
    const prohibitedColors = [
      'rgb(61, 220, 151)',
      'rgb(52, 211, 153)',
      'rgb(16, 185, 129)',
      'rgb(34, 197, 94)',
      '#3ddc97',
      '#34d399',
      '#10b981',
      '#22c55e',
    ];
    const elements = Array.from(document.querySelectorAll('*'));
    const matches = [];
    for (const el of elements) {
      if (['SCRIPT', 'STYLE', 'SVG', 'PATH'].includes(el.tagName)) continue;
      const cs = window.getComputedStyle(el);
      const bg = cs.backgroundColor;
      const cl = cs.color;
      const bc = cs.borderColor;
      for (const p of prohibitedColors) {
        if (bg.includes(p) || cl.includes(p) || bc.includes(p)) {
          matches.push({ tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 30), bg, cl, bc });
        }
      }
    }
    return matches;
  });
  console.log(`[SCAN ${contextName}] Found ${greens.length} green elements.`);
  if (greens.length > 0) {
    console.warn(`[WARN ${contextName}] Matches:`, greens.slice(0, 3));
  }
  return greens.length;
}

async function run() {
  console.log('[PHASE C VERIFY] Starting verification...');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await context.newPage();

  // 1. Navigate to Partnerships Tab
  console.log('[STEP 1] Navigating to Partnerships tab...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/partnerships`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Scan green
  await scanGreen(page, 'Partnerships Desktop');

  // Verify DirectoryCard is present in Browse tab
  const directoryCards = await page.$$('[role="button"]');
  console.log(`[VERIFY] Found ${directoryCards.length} clickable cards.`);

  // Screenshot Partnerships Desktop
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phaseC_partnerships_1440.png'),
    fullPage: false,
  });
  console.log('[SCREENSHOT] Saved phaseC_partnerships_1440.png');

  // 2. Click on a card or open modal to test ServerProfileModal
  console.log('[STEP 2] Testing Details Popup (ServerProfileModal)...');
  const viewButtons = await page.$$('button:has-text("View")');
  if (viewButtons.length > 0) {
    await viewButtons[0].click();
    await page.waitForTimeout(1000);

    // Scan green in popup
    await scanGreen(page, 'Modal Popup');

    // Screenshot Details Popup Desktop
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'phaseC_popup_1440.png'),
      fullPage: false,
    });
    console.log('[SCREENSHOT] Saved phaseC_popup_1440.png');

    // Click More options three-dots menu to show report menu
    const moreBtn = await page.$('button[aria-label="More options"]');
    if (moreBtn) {
      await moreBtn.click();
      await page.waitForTimeout(400);

      const reportServerBtn = await page.$('button:has-text("Report server")');
      if (reportServerBtn) {
        console.log('[VERIFY] Report server menu option found. Clicking to open Report Dialog...');
        await reportServerBtn.click();
        await page.waitForTimeout(500);

        // Screenshot Report Dialog
        await page.screenshot({
          path: path.join(ARTIFACT_DIR, 'phaseC_report_dialog_1440.png'),
          fullPage: false,
        });
        console.log('[SCREENSHOT] Saved phaseC_report_dialog_1440.png');

        // Close report dialog
        const cancelBtn = await page.$('button:has-text("Cancel")');
        if (cancelBtn) await cancelBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Close server profile modal
    const closeBtn = await page.$('button[aria-label="Close dialog"]');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(400);
  }

  // 3. Test Active tab in Partnerships
  console.log('[STEP 3] Testing Active tab in Partnerships...');
  const activeTabBtn = await page.$('button:has-text("Active")');
  if (activeTabBtn) {
    await activeTabBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'phaseC_active_partners_1440.png'),
      fullPage: false,
    });
    console.log('[SCREENSHOT] Saved phaseC_active_partners_1440.png');
  }

  // 4. Test Recruits Tab (Owner view with Owner row)
  console.log('[STEP 4] Navigating to Recruits Tab...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/recruits`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click on Representatives sub-tab if in owner view
  const repsSubTab = await page.$('button:has-text("Representatives")');
  if (repsSubTab) {
    await repsSubTab.click();
    await page.waitForTimeout(500);
  }

  // Verify Owner row with Owner badge
  const ownerBadge = await page.$('span:has-text("Owner")');
  console.log(`[VERIFY] Owner row present: ${Boolean(ownerBadge)}`);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phaseC_reps_owner_1440.png'),
    fullPage: false,
  });
  console.log('[SCREENSHOT] Saved phaseC_reps_owner_1440.png');

  // 5. Mobile (390px) Viewport Tests
  console.log('[STEP 5] Testing Mobile 390px Viewport...');
  await page.setViewportSize({ width: 390, height: 844 });

  // Mobile Partnerships
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/partnerships`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phaseC_partnerships_390.png'),
    fullPage: false,
  });
  console.log('[SCREENSHOT] Saved phaseC_partnerships_390.png');

  // Open modal on mobile
  const mobileViewBtns = await page.$$('button:has-text("View")');
  if (mobileViewBtns.length > 0) {
    await mobileViewBtns[0].click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'phaseC_popup_390.png'),
      fullPage: false,
    });
    console.log('[SCREENSHOT] Saved phaseC_popup_390.png');
  }

  // Mobile Recruits
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/recruits`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phaseC_reps_owner_390.png'),
    fullPage: false,
  });
  console.log('[SCREENSHOT] Saved phaseC_reps_owner_390.png');

  await browser.close();
  console.log('[PHASE C VERIFY] Verification complete!');
}

run().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});

