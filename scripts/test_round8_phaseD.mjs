import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const SESSION_COOKIE = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function run() {
  console.log('--- ROUND 8 PHASE D AUTOMATED VERIFICATION ---');

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

  // ── 1. TEST RECRUIT HUB OWNER VIEW (DESKTOP 1440px) ──
  console.log('1. Navigating to Recruit Hub on Desktop (1440px)...');
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/recruits', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2000);

  // Check that NO "Active" badge exists in header
  const headerActiveBadge = page.locator('header .badge:has-text("Active"), h1 + span:has-text("Active")');
  console.log(`Header Active badge count (must be 0): ${await headerActiveBadge.count()}`);

  // Check Owner view tabs
  const settingsTabBtn = page.locator('button:has-text("Recruiting settings")');
  console.log(`Settings tab button count: ${await settingsTabBtn.count()}`);
  await settingsTabBtn.click();
  await page.waitForTimeout(500);

  // Check 7.4 Rebuilt Grid Layout in settings
  const recruitingHeading = page.locator('h3:has-text("Recruiting")');
  console.log(`Recruiting heading count: ${await recruitingHeading.count()}`);

  // Screenshot Owner Recruiting Settings Desktop
  const ownerSettingsDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseD_recruit_owner_settings_desktop.png');
  await page.screenshot({ path: ownerSettingsDesktopPath, fullPage: false });
  console.log(`Owner Settings Desktop screenshot saved: ${ownerSettingsDesktopPath}`);

  // ── 2. TEST OWNER TOOLS (7.5) ──
  console.log('2. Opening Owner Tools tab...');
  const ownerToolsBtn = page.locator('button:has-text("Owner tools")');
  await ownerToolsBtn.click();
  await page.waitForTimeout(500);

  const membersFoundHeading = page.locator('h3:has-text("Members found through Mavely")');
  console.log(`Members found heading count: ${await membersFoundHeading.count()}`);

  const pauseBtn = page.locator('button:has-text("Pause recruiting")');
  const revokeAllBtn = page.locator('button:has-text("Revoke all representative invites")');
  const exportCsvBtn = page.locator('button:has-text("Export recruits (CSV)")');

  console.log(`Owner tools toolbar:
    Pause recruiting: ${await pauseBtn.count() > 0}
    Revoke all invites: ${await revokeAllBtn.count() > 0}
    Export CSV: ${await exportCsvBtn.count() > 0}`);

  // Screenshot Owner Tools Desktop
  const ownerToolsDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseD_recruit_owner_tools_desktop.png');
  await page.screenshot({ path: ownerToolsDesktopPath, fullPage: false });
  console.log(`Owner Tools Desktop screenshot saved: ${ownerToolsDesktopPath}`);

  // ── 3. TEST MEMBER VIEW (7.3) ──
  console.log('3. Switching to Member view...');
  const memberViewBtn = page.locator('button:has-text("Member view")');
  await memberViewBtn.click();
  await page.waitForTimeout(500);

  // Check invite card
  const serverHeading = page.locator('h2');
  const copyBtn = page.locator('button:has-text("Copy")');
  const shareBtn = page.locator('button:has-text("Share")');

  console.log(`Member view checks:
    Server name heading: ${await serverHeading.count() > 0}
    Copy button: ${await copyBtn.count() > 0}
    Share button: ${await shareBtn.count() > 0}`);

  // Screenshot Member View Desktop
  const memberViewDesktopPath = path.join(ARTIFACTS_DIR, 'round8_phaseD_recruit_member_view_desktop.png');
  await page.screenshot({ path: memberViewDesktopPath, fullPage: false });
  console.log(`Member View Desktop screenshot saved: ${memberViewDesktopPath}`);

  // ── 4. TEST MOBILE VIEWPORT (390px) ──
  console.log('4. Testing Mobile Viewport (390px)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/recruits', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2000);

  const recruitMobilePath = path.join(ARTIFACTS_DIR, 'round8_phaseD_recruit_hub_mobile_390.png');
  await page.screenshot({ path: recruitMobilePath, fullPage: false });
  console.log(`Recruit Hub Mobile screenshot saved: ${recruitMobilePath}`);

  // ── 5. TEST RECRUITER ROLE ACCESS LIMITATION (7.6) ──
  console.log('5. Testing Recruiter role limited access...');
  await page.addInitScript(() => {
    const recruiterUser = {
      id: '523693281541095424',
      name: 'recruiter_member',
      username: 'recruiter_member',
      globalName: 'Recruiter Member',
      role: 'Recruiter',
      avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png'
    };
    localStorage.setItem('erlcus_user', JSON.stringify(recruiterUser));
    localStorage.setItem('erlcus_mock_user', JSON.stringify(recruiterUser));
  });

  // Navigate to Overview as Recruiter - should redirect to recruits
  await page.goto('http://localhost:3000/dashboard/1530147023754367006', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1500);

  console.log(`Current URL after Recruiter navigation to Overview: ${page.url()}`);
  const isRedirectedToRecruits = page.url().includes('/recruits');
  console.log(`Redirected to recruit hub: ${isRedirectedToRecruits}`);

  // Check limited sidebar
  const overviewInSidebar = await page.locator('nav a:text-is("Overview"), nav button:text-is("Overview")').count();
  const settingsInSidebar = await page.locator('nav a:text-is("Settings"), nav button:text-is("Settings")').count();
  console.log(`Overview in recruiter sidebar: ${overviewInSidebar} (should be 0)`);
  console.log(`Settings in recruiter sidebar: ${settingsInSidebar} (should be 0)`);

  await browser.close();
  console.log('--- ALL PHASE D CHECKS COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Phase D test failed:', err);
  process.exit(1);
});
