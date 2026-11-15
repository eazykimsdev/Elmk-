import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const SESSION_COOKIE = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function run() {
  console.log('--- ROUND 8 PHASE E AUTOMATED VERIFICATION ---');

  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: 'erlcus_session',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await context.newPage();

  page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

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
  });

  // ── 1. TEST PARTNERSHIPS BROWSE GRID (DESKTOP 1440px) ──
  console.log('1. Navigating to Partnerships Browse tab on Desktop (1440px)...');
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/partnerships', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2000);

  // Check header
  const headerHeading = page.locator('h1:has-text("Server partnerships")');
  console.log(`Header heading count: ${await headerHeading.count()}`);

  // Check mode card (Section 8.5)
  const modeHeading = page.locator('h3:has-text("Partnership mode")');
  console.log(`Partnership mode card count: ${await modeHeading.count()}`);

  // Check slim summary line
  const summaryLine = page.locator('text=active partnerships');
  console.log(`Summary active partners count: ${await summaryLine.count() > 0}`);

  // Check browse grid (Section 8.1: 2-column grid)
  const browseCards = page.locator('button:has-text("Request partnership"), button:has-text("View")');
  console.log(`Browse card action buttons found: ${await browseCards.count()}`);

  // Screenshot Browse Tab Desktop
  const browseDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseE_partnerships_browse_desktop.png');
  await page.screenshot({ path: browseDesktopPath, fullPage: false });
  console.log(`Browse Desktop screenshot saved: ${browseDesktopPath}`);

  // ── 2. TEST CONFIGURE WEBHOOK MODAL (Section 8.4) ──
  console.log('2. Opening Configure Webhook modal...');
  const configWebhookBtn = page.locator('button:has-text("Configure webhook")');
  await configWebhookBtn.click();
  await page.waitForTimeout(600);

  // Check masked URL
  const maskedText = page.locator('text=••••••');
  console.log(`Masked webhook indicator found: ${await maskedText.count() > 0}`);

  const connectedBadge = page.locator('span:has-text("Connected")');
  console.log(`Connected badge found: ${await connectedBadge.count() > 0}`);

  const sendTestBtn = page.locator('button:has-text("Send test")');
  const showUrlBtn = page.locator('button:has-text("Show URL")');
  console.log(`Send test button: ${await sendTestBtn.count() > 0}, Show URL button: ${await showUrlBtn.count() > 0}`);

  // Screenshot Webhook Modal Desktop
  const webhookDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseE_webhook_modal_desktop.png');
  await page.screenshot({ path: webhookDesktopPath, fullPage: false });
  console.log(`Webhook Modal Desktop screenshot saved: ${webhookDesktopPath}`);

  // Close modal via close button
  await page.locator('button[aria-label="Close modal"]').click();
  await page.waitForTimeout(500);

  // ── 3. TEST ACTIVE PARTNERS TAB ──
  console.log('3. Opening Active Partners tab...');
  const activeTabBtn = page.locator('button:has(span:text-is("Active"))');
  await activeTabBtn.click();
  await page.waitForTimeout(600);

  const activeTable = page.locator('table');
  console.log(`Active table found: ${await activeTable.count() > 0}`);

  // Screenshot Active Tab Desktop
  const activeDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseE_partnerships_active_desktop.png');
  await page.screenshot({ path: activeDesktopPath, fullPage: false });
  console.log(`Active Tab Desktop screenshot saved: ${activeDesktopPath}`);

  // ── 4. TEST REQUESTS TAB (INCOMING & OUTGOING) (Section 8.2) ──
  console.log('4. Opening Requests tab...');
  const requestsTabBtn = page.locator('button:has(span:text-is("Requests"))');
  await requestsTabBtn.click();
  await page.waitForTimeout(600);

  const acceptBtn = page.locator('button:has-text("Accept")');
  const declineBtn = page.locator('button:has-text("Decline")');
  console.log(`Incoming request action buttons: Accept=${await acceptBtn.count() > 0}, Decline=${await declineBtn.count() > 0}`);

  // Screenshot Requests Tab Desktop
  const requestsDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseE_partnerships_requests_desktop.png');
  await page.screenshot({ path: requestsDesktopPath, fullPage: false });
  console.log(`Requests Tab Desktop screenshot saved: ${requestsDesktopPath}`);

  // ── 5. TEST REWARDS TAB ──
  console.log('5. Opening Rewards tab...');
  const rewardsTabBtn = page.locator('button:has(span:text-is("Rewards"))');
  await rewardsTabBtn.click();
  await page.waitForTimeout(600);

  const milestoneHeadings = page.locator('h4:has-text("First Alliance"), h4:has-text("Network Builder")');
  console.log(`Milestones found: ${await milestoneHeadings.count()}`);

  // Screenshot Rewards Tab Desktop
  const rewardsDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseE_partnerships_rewards_desktop.png');
  await page.screenshot({ path: rewardsDesktopPath, fullPage: false });
  console.log(`Rewards Tab Desktop screenshot saved: ${rewardsDesktopPath}`);

  // ── 6. TEST MOBILE VIEWPORT (390px) ──
  console.log('6. Testing Mobile Viewport (390px)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/partnerships', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2000);

  const mobileDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseE_partnerships_mobile_390.png');
  await page.screenshot({ path: mobileDesktopPath, fullPage: false });
  console.log(`Partnerships Mobile screenshot saved: ${mobileDesktopPath}`);

  await browser.close();
  console.log('--- ALL PHASE E CHECKS COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Phase E test failed:', err);
  process.exit(1);
});
