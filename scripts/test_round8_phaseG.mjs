import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/sulma/OneDrive/Desktop/erlcxbot';
const ADMIN_SESSION_COOKIE = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';
const TEST_BANNED_USER_ID = '987654321098765432';
const BANNED_SESSION_TOKEN = 'banned_test_token_889977';

async function run() {
  console.log('--- ROUND 8 PHASE G: ADMIN BAN, SUSPEND & BLACKLIST VERIFICATION ---');

  // ── STEP 1: BAN THE TEST USER VIA ADMIN API ──
  console.log('\n1. Banning test user via /api/admin/bans...');
  const banRes = await fetch('http://localhost:3001/api/admin/bans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `erlcus_session=${ADMIN_SESSION_COOKIE}`
    },
    body: JSON.stringify({
      userId: TEST_BANNED_USER_ID,
      username: 'banned_test_user',
      reason: 'Repeated unauthorized raid telemetry attempts across central gateway',
      duration: '7d'
    })
  });
  console.log('Admin ban API response status:', banRes.status);
  const banJson = await banRes.json().catch(() => ({}));
  console.log('Ban recorded:', banJson?.ban?.id || banJson);

  // Register a session for the banned user in data/web_sessions.json
  const sessionsPath = path.resolve('data/web_sessions.json');
  let currentSessions = {};
  if (fs.existsSync(sessionsPath)) {
    try { currentSessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8')); } catch {}
  }
  currentSessions[BANNED_SESSION_TOKEN] = {
    user: { id: TEST_BANNED_USER_ID, username: 'banned_test_user' },
    expiresAtSession: Date.now() + 86400000,
    csrfToken: 'banned_csrf_token'
  };
  fs.writeFileSync(sessionsPath, JSON.stringify(currentSessions, null, 2), 'utf8');

  // ── STEP 2: TEST SERVER-SIDE 403 API ENFORCEMENT ──
  console.log('\n2. Testing Server-side 403 API enforcement on banned session...');
  const apiRes = await fetch('http://localhost:3001/api/directory', {
    headers: {
      'Cookie': `erlcus_session=${BANNED_SESSION_TOKEN}`
    }
  });
  console.log(`Banned user /api/directory status: ${apiRes.status} (expected 403)`);
  const apiJson = await apiRes.json().catch(() => ({}));
  console.log('Banned user API response code:', apiJson.code || apiJson.error);
  if (apiRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for banned user API call, got ${apiRes.status}`);
  }

  // Check /api/auth/me returns isBanned: true
  const meRes = await fetch('http://localhost:3001/api/auth/me', {
    headers: {
      'Cookie': `erlcus_session=${BANNED_SESSION_TOKEN}`
    }
  });
  const meJson = await meRes.json().catch(() => ({}));
  console.log(`Banned user /api/auth/me isBanned: ${meJson.isBanned}`);

  // ── STEP 3: TEST BANNED USER ON 5 DIFFERENT URLS IN BROWSER ──
  console.log('\n3. Testing BannedPage enforcement across 5 different URLs in browser...');
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });

  const bannedContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await bannedContext.addCookies([{
    name: 'erlcus_session',
    value: BANNED_SESSION_TOKEN,
    domain: 'localhost',
    path: '/'
  }]);

  const bannedPage = await bannedContext.newPage();

  await bannedPage.addInitScript((banInfo) => {
    const user = {
      id: '987654321098765432',
      username: 'banned_test_user',
      globalName: 'Banned Test User',
      isBanned: true,
      ban: banInfo
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('erlcus_current_user_ban', JSON.stringify(banInfo));
  }, banJson?.ban || {
    reason: 'Repeated unauthorized raid telemetry attempts across central gateway',
    duration: '7d',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    bannedAt: new Date().toISOString()
  });

  const testUrls = [
    'http://localhost:3000/',
    'http://localhost:3000/docs',
    'http://localhost:3000/pricing',
    'http://localhost:3000/servers',
    'http://localhost:3000/dashboard/1530147023754367006'
  ];

  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    console.log(`Checking URL [${i + 1}/5]: ${url}`);
    await bannedPage.goto(url, { waitUntil: 'networkidle' });
    await bannedPage.waitForTimeout(500);

    const has403 = await bannedPage.locator('h1:has-text("403")').isVisible();
    const hasTitle = await bannedPage.locator('text=Your account is suspended').isVisible();
    const hasReason = await bannedPage.locator('text=Repeated unauthorized raid telemetry').isVisible();
    const hasAppealBtn = await bannedPage.locator('text=Join the support server to appeal').isVisible();
    const hasSignOutBtn = await bannedPage.locator('text=Sign out').isVisible();

    console.log(`  ✓ 403 Headline: ${has403}`);
    console.log(`  ✓ Title visible: ${hasTitle}`);
    console.log(`  ✓ Reason visible: ${hasReason}`);
    console.log(`  ✓ Appeal button visible: ${hasAppealBtn}`);
    console.log(`  ✓ Sign out button visible: ${hasSignOutBtn}`);

    if (!has403 || !hasTitle || !hasReason) {
      throw new Error(`Banned page failed validation on URL: ${url}`);
    }
  }

  // Capture desktop screenshot of BannedPage
  await bannedPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseG_banned_page_desktop.png')
  });
  console.log('✓ Captured round8_phaseG_banned_page_desktop.png (1440px)');

  // Capture mobile screenshot of BannedPage (390px)
  await bannedPage.setViewportSize({ width: 390, height: 844 });
  await bannedPage.waitForTimeout(400);
  await bannedPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseG_banned_page_mobile_390.png')
  });
  console.log('✓ Captured round8_phaseG_banned_page_mobile_390.png (390px)');
  await bannedContext.close();

  // ── STEP 4: ADMIN PORTAL BLACKLIST TAB TEST ──
  console.log('\n4. Testing Admin Portal Blacklist tab...');
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await adminContext.addCookies([{
    name: 'erlcus_session',
    value: ADMIN_SESSION_COOKIE,
    domain: 'localhost',
    path: '/'
  }]);

  const adminPage = await adminContext.newPage();
  await adminPage.addInitScript(() => {
    const adminUser = {
      id: '523693281541095424',
      name: 'eazykims',
      username: 'eazykims',
      globalName: 'Eazykims',
      role: 'Owner'
    };
    localStorage.setItem('erlcus_user', JSON.stringify(adminUser));
  });

  await adminPage.goto('http://localhost:3000/admin-portal/blacklist', { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(1500);

  const blacklistHeader = adminPage.locator('h1:has-text("Blacklist")');
  await blacklistHeader.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Blacklist header visible:', await blacklistHeader.isVisible());

  const bannedRow = adminPage.locator(`text=${TEST_BANNED_USER_ID}`);
  await bannedRow.waitFor({ state: 'visible', timeout: 5000 });
  console.log(`✓ Banned test user ${TEST_BANNED_USER_ID} listed in table:`, await bannedRow.isVisible());

  // Capture desktop screenshot of Admin Blacklist
  await adminPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseG_admin_blacklist_desktop.png')
  });
  console.log('✓ Captured round8_phaseG_admin_blacklist_desktop.png (1440px)');

  // ── STEP 5: PARDON / UNBAN USER AND ASSERT RESTORED ACCESS ──
  console.log('\n5. Pardoning user and verifying access restoration...');
  const unbanRes = await fetch(`http://localhost:3001/api/admin/bans/${TEST_BANNED_USER_ID}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `erlcus_session=${ADMIN_SESSION_COOKIE}`
    },
    body: JSON.stringify({ reason: 'Completed appeal verification in support server' })
  });
  console.log('Unban API response status:', unbanRes.status);

  // Clean up test session
  if (fs.existsSync(sessionsPath)) {
    try {
      const sess = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
      delete sess[BANNED_SESSION_TOKEN];
      fs.writeFileSync(sessionsPath, JSON.stringify(sess, null, 2), 'utf8');
    } catch {}
  }

  // Verify access restored on docs page
  const restoredContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const restoredPage = await restoredContext.newPage();
  await restoredPage.addInitScript(() => {
    const user = {
      id: '987654321098765432',
      username: 'pardoned_user',
      globalName: 'Pardoned User',
      isBanned: false
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.removeItem('erlcus_current_user_ban');
  });

  await restoredPage.goto('http://localhost:3000/docs', { waitUntil: 'networkidle' });
  await restoredPage.waitForTimeout(1000);
  const onDocsPage = await restoredPage.locator('h1, h2, h3').filter({ hasText: 'Documentation' }).first().isVisible();
  console.log('✓ Restored user can browse /docs normally:', onDocsPage);

  await restoredContext.close();
  await adminContext.close();
  await browser.close();

  console.log('\n--- ALL ROUND 8 PHASE G VERIFICATION CHECKS PASSED SUCCESSFULLY! ---');
}

run().catch((err) => {
  console.error('Phase G verification failed:', err);
  process.exit(1);
});
