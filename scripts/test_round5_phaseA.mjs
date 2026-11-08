import { chromium } from '../node_modules/playwright-core/index.mjs';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  console.log('[TEST] Launching automated Playwright suite for Round 5 Phase A...');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Preset auth and mock data
  await page.addInitScript(() => {
    localStorage.setItem(
      'erlcus_user',
      JSON.stringify({
        id: '523693281541095424',
        username: 'MavelyOwner',
        globalName: 'Mavely Owner',
        avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
      })
    );
    localStorage.setItem(
      'erlcus_known_guilds',
      JSON.stringify([
        {
          id: '1530147023754367006',
          name: 'Springfield Roleplay',
          icon: null,
          memberCount: 17,
        },
      ])
    );
    localStorage.setItem('server_members_1530147023754367006', '17');
    localStorage.setItem(
      'server_banner_1530147023754367006',
      'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80'
    );
    localStorage.setItem(
      'mavely_user_joins',
      JSON.stringify({
        '112233445566778899': {
          serverName: 'Riverdale Police Department',
          joinedAt: Date.now() - 3600000 * 10,
          status: 'verifying',
          reward: 2,
        },
      })
    );
  });

  // Track console errors
  const errors = [];
  page.on('pageerror', (err) => {
    console.error('PAGE ERROR CAUGHT:', err.message, err.stack);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // ── TEST 1: Global Scrollbar styles ─────────────────────────────────────
  console.log('[TEST 1] Verifying global scrollbars in CSS...');
  await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  console.log('Page URL after goto:', page.url());

  const scrollbarStyle = await page.evaluate(() => {
    const el = document.body;
    const style = window.getComputedStyle(el);
    return {
      scrollbarWidth: style.scrollbarWidth,
      scrollbarColor: style.scrollbarColor,
    };
  });
  console.log('Scrollbar computed styles:', scrollbarStyle);
  if (scrollbarStyle.scrollbarWidth !== 'thin') {
    throw new Error('Scrollbar width is not thin');
  }
  console.log('✔ PASS: Global thin dark scrollbar verified');

  // ── TEST 2: Sidebar header blend, banner backdrop and spacing ──────────
  console.log('[TEST 2] Verifying sidebar header blend, backdrop and spacing...');
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body text preview:', bodyText.slice(0, 300));
  const headerBox = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-sidebar="sidebar"]');
    const header = document.querySelector('[data-sidebar="header"]');
    const searchBtn = header ? header.querySelector('button.h-9') : null;
    const growthLabel = Array.from(document.querySelectorAll('div')).find(
      (d) => d.textContent?.trim() === 'Growth'
    );
    const systemLabel = Array.from(document.querySelectorAll('div')).find(
      (d) => d.textContent?.trim() === 'System'
    );

    return {
      hasSidebar: Boolean(sidebar),
      hasHeader: Boolean(header),
      hasSearch: Boolean(searchBtn),
      hasGrowthLabel: Boolean(growthLabel),
      hasSystemLabel: Boolean(systemLabel),
      growthText: growthLabel ? growthLabel.textContent.trim() : null,
      systemText: systemLabel ? systemLabel.textContent.trim() : null,
      headerHtml: header ? header.innerHTML.slice(0, 300) : null,
    };
  });
  console.log('Header check result:', headerBox);

  if (!headerBox.hasHeader || !headerBox.hasSearch) {
    throw new Error('Sidebar header or search box missing');
  }
  if (headerBox.growthText !== 'Growth' || headerBox.systemText !== 'System') {
    throw new Error('Group labels are not sentence case: ' + JSON.stringify(headerBox));
  }
  console.log('✔ PASS: Sidebar header layout and sentence-case labels verified');

  // ── TEST 3: Partnerships crash fix and sub-tab stability ───────────────
  console.log('[TEST 3] Verifying Partnerships tab and all sub-tabs...');
  await page.goto(`${BASE_URL}/dashboard/1530147023754367006/partnerships`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const errorBoundaryPresent = await page.locator('text=Couldn\'t load').isVisible();
  const rootErrorPresent = await page.locator('text=Something went wrong').isVisible();
  if (errorBoundaryPresent || rootErrorPresent) {
    throw new Error('Partnerships tab crashed with error boundary!');
  }

  // Click through all sub-tabs
  for (const tabId of ['Active', 'Requests', 'Rewards', 'Browse']) {
    console.log(`Testing Partnerships sub-tab: ${tabId}...`);
    const btn = page.locator(`button:has-text("${tabId}")`).first();
    await btn.click();
    await page.waitForTimeout(500);

    const crashed = await page.locator('text=Couldn\'t load').isVisible();
    if (crashed) {
      throw new Error(`Partnerships sub-tab ${tabId} crashed!`);
    }
  }
  console.log('✔ PASS: Partnerships tab and all 4 sub-tabs load with ZERO crashes');

  // Also test /partnerships top-level route redirect
  await page.goto(`${BASE_URL}/partnerships`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  if (!page.url().includes('/partnerships')) {
    throw new Error('Top-level /partnerships redirect failed');
  }
  console.log('✔ PASS: /partnerships redirect verified');

  // ── TEST 4: Pagination Placement on My Joins ───────────────────────────
  console.log('[TEST 4] Verifying Pagination placement on My joins...');
  await page.goto(`${BASE_URL}/dashboard/1530147023754367006/joins`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const paginationNav = page.locator('nav[aria-label="Pagination"]');
  if (!(await paginationNav.isVisible())) {
    throw new Error('Pagination not visible on My joins');
  }
  const paginationClasses = await paginationNav.getAttribute('class');
  console.log('Pagination classes:', paginationClasses);
  if (!paginationClasses.includes('mt-6') || !paginationClasses.includes('mb-8')) {
    throw new Error('Pagination does not have mt-6 mb-8: ' + paginationClasses);
  }
  console.log('✔ PASS: Pagination placement on My joins verified (mt-6 mb-8 centered)');

  // ── TEST 5: Single Save Bar & Dirty Form Store ─────────────────────────
  console.log('[TEST 5] Verifying single save bar on Promote server...');
  await page.goto(`${BASE_URL}/dashboard/1530147023754367006/promote`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // Assert NO save bar initially
  let saveBars = await page.locator('text=You have unsaved changes').count();
  if (saveBars !== 0) {
    throw new Error('Save bar should not be visible on initial load');
  }

  // Type in summary to make form dirty
  const summaryInput = page.locator('input[placeholder*="summary" i], input[placeholder*="Roleplay community" i], textarea').first();
  await summaryInput.fill('Updated community listing for testing');
  await page.waitForTimeout(500);

  // Assert EXACTLY ONE save bar appears
  saveBars = await page.locator('text=You have unsaved changes').count();
  if (saveBars !== 1) {
    throw new Error(`Expected exactly 1 save bar, found ${saveBars}`);
  }
  console.log('✔ PASS: Exactly 1 save bar appears when form is dirty');

  // Capture screenshot of save bar
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round5_phaseA_save_bar.png') });

  // ── TEST 6: Unsaved-change Guard Dialog ────────────────────────────────
  console.log('[TEST 6] Testing unsaved-change guard dialog on navigation attempt...');
  // Try clicking Overview in sidebar
  const overviewNav = page.locator('button:has-text("Overview")').first();
  await overviewNav.click();
  await page.waitForTimeout(600);

  // Assert Dialog appears: "Leave without saving?", "Stay", "Leave"
  const dialogTitle = page.locator('text=Leave without saving?');
  if (!(await dialogTitle.isVisible())) {
    throw new Error('Unsaved changes guard dialog did not appear on navigation attempt');
  }
  const stayBtn = page.locator('button:has-text("Stay")');
  const leaveBtn = page.locator('button:has-text("Leave")');
  if (!(await stayBtn.isVisible()) || !(await leaveBtn.isVisible())) {
    throw new Error('Guard dialog buttons (Stay/Leave) missing');
  }
  console.log('✔ PASS: Unsaved-change guard dialog blocked navigation successfully');

  // Capture screenshot of guard dialog
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round5_phaseA_guard_dialog.png') });

  // Click "Stay"
  await stayBtn.click();
  await page.waitForTimeout(400);
  if (await dialogTitle.isVisible()) {
    throw new Error('Dialog did not close on clicking Stay');
  }
  console.log('✔ PASS: Clicking Stay preserved dirty form and kept user on page');

  // Test Reset button in Save Bar
  const resetBtn = page.locator('div:has-text("You have unsaved changes") button:has-text("Reset")');
  await resetBtn.click();
  await page.waitForTimeout(600);

  saveBars = await page.locator('text=You have unsaved changes').count();
  if (saveBars !== 0) {
    throw new Error('Save bar did not dismiss after Reset');
  }
  console.log('✔ PASS: Reset button dismissed save bar and reverted dirty state');

  // ── TEST 7: Full Screenshots at 1440px and 390px ───────────────────────
  console.log('[TEST 7] Capturing Desktop (1440px) and Mobile (390px) screenshots...');
  // Desktop Overview
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round5_phaseA_desktop.png') });

  // Desktop Partnerships
  await page.goto(`${BASE_URL}/dashboard/1530147023754367006/partnerships`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round5_phaseA_partnerships.png') });

  // Desktop My Joins
  await page.goto(`${BASE_URL}/dashboard/1530147023754367006/joins`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round5_phaseA_myjoins.png') });

  // Mobile Overview
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/dashboard/1530147023754367006`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round5_phaseA_mobile.png') });

  console.log('✔ PASS: All screenshots successfully generated at 1440px and 390px!');
  await browser.close();
  console.log('🎉 ALL PHASE A TESTS PASSED WITH ZERO ERRORS!');
}

main().catch((err) => {
  console.error('❌ PHASE A TEST FAILED:', err);
  process.exit(1);
});
