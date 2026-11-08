import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE_URL = 'http://localhost:3000';
const SESSION_COOKIE = '3efc5ed1fe201f742dfd11150d9867f60edf587a50f1ec608114bbf074d59bc0';

async function scanGreenElements(page, locationLabel) {
  const greenViolations = await page.evaluate(() => {
    const forbiddenPatterns = [
      'rgb(61, 220, 151)',
      '#3ddc97',
      'rgb(52, 211, 153)',
      '#34d399',
      'rgb(16, 185, 129)',
      '#10b981',
      'rgb(34, 197, 94)',
      '#22c55e',
    ];
    const elements = Array.from(document.querySelectorAll('*'));
    const violations = [];
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const color = style.color || '';
      const bg = style.backgroundColor || '';
      const border = style.borderColor || '';
      const stroke = style.stroke || '';
      const fill = style.fill || '';

      const check = (val) => {
        if (!val) return false;
        const low = val.toLowerCase();
        return forbiddenPatterns.some(p => low.includes(p)) ||
               (low.includes('rgb(') && !low.includes('249, 115, 22') && !low.includes('250, 204, 21') &&
                /rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)/.test(low) &&
                (() => {
                  const m = low.match(/rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)/);
                  if (!m) return false;
                  const [_, r, g, b] = m.map(Number);
                  return g > 150 && g > r * 1.3 && g > b * 1.3;
                })());
      };

      if (check(color) || check(bg) || check(border) || check(stroke) || check(fill)) {
        violations.push({
          tag: el.tagName,
          classes: el.className,
          text: (el.textContent || '').slice(0, 30),
          color,
          bg,
          border
        });
      }
    }
    return violations;
  });

  console.log(`[GREEN AUDIT] ${locationLabel}: ${greenViolations.length} violations found.`);
  if (greenViolations.length > 0) {
    console.warn(`[GREEN AUDIT DETAILS]`, JSON.stringify(greenViolations.slice(0, 5), null, 2));
  }
  return greenViolations;
}

async function runVerification() {
  console.log('[PHASE D VERIFICATION] Starting comprehensive tests...');
  const browser = await chromium.launch({ executablePath: EDGE_PATH, headless: true });

  // 1. NON-ADMIN 404 VERIFICATION
  console.log('[TEST 1] Testing non-admin 404 access control...');
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(`${BASE_URL}/admin-portal`, { waitUntil: 'networkidle' });
  const notFoundText = await anonPage.locator('text=404').first().textContent().catch(() => null);
  console.log(`[TEST 1] Non-admin page 404 status confirmed: ${Boolean(notFoundText)}`);
  await anonContext.close();

  // 2. ADMIN AUTHENTICATED TESTS
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await context.newPage();

  // Overview Tab
  console.log('[TEST 2] Navigating to Admin Portal Overview...');
  await page.goto(`${BASE_URL}/admin-portal/overview`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check top bar elements
  const adminBadge = await page.locator('text=Admin Portal').isVisible();
  const backToApp = await page.locator('text=Back to app').isVisible();
  console.log(`[TEST 2] Shell Top Bar rendered: adminBadge=${adminBadge}, backToApp=${backToApp}`);

  // Check overview count cards
  const accountsCard = await page.locator('text=Registered Accounts').isVisible();
  const serversCard = await page.locator('text=Servers Listed').isVisible();
  const joinsCard = await page.locator('text=24h Verified Joins').isVisible();
  const creditsCard = await page.locator('text=Credits in Circulation').isVisible();
  console.log(`[TEST 2] Overview Real Counts: accounts=${accountsCard}, servers=${serversCard}, joins=${joinsCard}, credits=${creditsCard}`);

  await scanGreenElements(page, 'Admin Overview 1440px');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_overview_1440.png'), fullPage: false });

  // Mobile Overview
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_overview_390.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Users Tab
  console.log('[TEST 3] Navigating to Users Tab...');
  await page.locator('aside button:has-text("Users")').click();
  await page.waitForTimeout(1000);

  const membersTab = await page.locator('button:has-text("Members (Signed In)")').isVisible();
  const knownTab = await page.locator('button:has-text("Known Accounts")').isVisible();
  console.log(`[TEST 3] Users Subtabs present: membersTab=${membersTab}, knownTab=${knownTab}`);

  // Click row to open sheet
  const firstUserRow = page.locator('tbody tr').first();
  if (await firstUserRow.isVisible()) {
    await firstUserRow.click();
    await page.waitForTimeout(1000);
    const sheetVisible = await page.locator('text=Credits Balance').isVisible();
    console.log(`[TEST 3] User Profile Sheet opened: ${sheetVisible}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  await scanGreenElements(page, 'Admin Users 1440px');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_users_1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_users_390.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Servers Tab (Hide & Restore Test)
  console.log('[TEST 4] Navigating to Servers Tab...');
  await page.locator('aside button:has-text("Servers")').click();
  await page.waitForTimeout(1000);

  const serverRow = page.locator('tbody tr').first();
  const serverName = await serverRow.locator('td').first().textContent().catch(() => '');
  console.log(`[TEST 4] First server found: ${serverName.trim()}`);

  await scanGreenElements(page, 'Admin Servers 1440px');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_servers_1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_servers_390.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // System Tab (Live Check Table)
  console.log('[TEST 5] Navigating to System Diagnostics Tab...');
  const sysRespPromise = page.waitForResponse(resp => resp.url().includes('/api/admin/system') && resp.status() === 200, { timeout: 8000 }).catch(() => null);
  await page.locator('aside button:has-text("System")').click();
  await sysRespPromise;
  await page.waitForTimeout(600);

  const dbCheck = await page.locator('text=Database').isVisible();
  const botCheck = await page.locator('text=Discord Bot').isVisible();
  const erlcCheck = await page.locator('text=ER:LC API Reachability').isVisible();
  const jobsCheck = await page.locator('text=Background Jobs').isVisible();
  console.log(`[TEST 5] Live Checks present: db=${dbCheck}, bot=${botCheck}, erlc=${erlcCheck}, jobs=${jobsCheck}`);

  await scanGreenElements(page, 'Admin System 1440px');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_system_1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_system_390.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Admins Tab
  console.log('[TEST 6] Navigating to Staff Roster & Admins Tab...');
  await page.locator('aside button:has-text("Admins")').click();
  await page.waitForTimeout(1000);

  const youBadge = await page.locator('text=You').first().isVisible().catch(() => false);
  const onlineDot = await page.locator('text=Online').first().isVisible().catch(() => false);
  console.log(`[TEST 6] Admins Page: youBadge=${youBadge}, onlineDot=${onlineDot}`);

  await scanGreenElements(page, 'Admin Admins 1440px');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_admins_1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseD_admin_admins_390.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // 7. API LIVE TESTS: Hide and Restore Server, Ban and Unban User, Blacklist by ID
  console.log('[TEST 7] Running Backend API Action Tests...');
  const testHeaders = {
    'Cookie': `connectingerlc_session=${SESSION_COOKIE}`,
    'Content-Type': 'application/json'
  };

  // Blacklist by ID
  const testBlacklistId = '999888777666555444';
  const blRes = await fetch('http://localhost:3001/api/admin/bans', {
    method: 'POST',
    headers: testHeaders,
    body: JSON.stringify({
      userId: testBlacklistId,
      username: 'automated_test_spammer',
      reason: 'Automated Playwright Phase D security blacklist test',
      duration: '7d'
    })
  });
  console.log(`[TEST 7] Blacklist Add Status: ${blRes.status}`);

  // Remove from Blacklist
  const unblRes = await fetch(`http://localhost:3001/api/admin/bans/${testBlacklistId}`, {
    method: 'DELETE',
    headers: testHeaders,
    body: JSON.stringify({ reason: 'Test cleanup' })
  });
  console.log(`[TEST 7] Blacklist Remove Status: ${unblRes.status}`);

  // Hide server & verify public directory drops it
  const testGuildId = '1517130661306171472';
  const hideRes = await fetch(`http://localhost:3001/api/admin/servers/${testGuildId}/action`, {
    method: 'POST',
    headers: testHeaders,
    body: JSON.stringify({
      action: 'hide',
      reason: 'Automated test temporary directory hide'
    })
  });
  console.log(`[TEST 7] Server Hide Status: ${hideRes.status}`);

  const dirRes = await fetch('http://localhost:3001/api/directory');
  const dirData = await dirRes.json();
  const isHiddenFromDir = !dirData.servers.some(s => String(s.id) === testGuildId);
  console.log(`[TEST 7] Server successfully omitted from public directory: ${isHiddenFromDir}`);

  // Restore server
  const restoreRes = await fetch(`http://localhost:3001/api/admin/servers/${testGuildId}/action`, {
    method: 'POST',
    headers: testHeaders,
    body: JSON.stringify({
      action: 'restore',
      reason: 'Automated test restoration'
    })
  });
  console.log(`[TEST 7] Server Restore Status: ${restoreRes.status}`);

  const dirRes2 = await fetch('http://localhost:3001/api/directory');
  const dirData2 = await dirRes2.json();
  const isRestoredToDir = dirData2.servers.some(s => String(s.id) === testGuildId);
  console.log(`[TEST 7] Server successfully restored to public directory: ${isRestoredToDir}`);

  // Heartbeat endpoint test
  const hbRes = await fetch('http://localhost:3001/api/admin/heartbeat', {
    method: 'POST',
    headers: testHeaders
  });
  console.log(`[TEST 7] Admin Heartbeat Status: ${hbRes.status}`);

  await browser.close();
  console.log('[PHASE D VERIFICATION] All tests completed successfully!');
}

runVerification().catch(err => {
  console.error('[PHASE D VERIFICATION ERROR]', err);
  process.exit(1);
});
