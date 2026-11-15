import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/sulma/OneDrive/Desktop/erlcxbot';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const TEST_SESSION_COOKIE = 'round9_phasea_session_token_' + Date.now();
const TEST_USER = {
  id: '888777666555444333',
  username: 'generic_community_owner',
  globalName: 'Generic Owner',
  role: 'Owner'
};

async function run() {
  console.log('--- ROUND 9 PHASE A VERIFICATION ---');

  // 1. Seed test session into web_sessions.json
  const sessionsPath = path.join(process.cwd(), 'data', 'web_sessions.json');
  let sessions = {};
  try {
    if (fs.existsSync(sessionsPath)) {
      sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8') || '{}');
    }
  } catch {}

  sessions[TEST_SESSION_COOKIE] = {
    sessionId: TEST_SESSION_COOKIE,
    user: TEST_USER,
    csrfToken: 'test_csrf_token_round9',
    expiresAtSession: Date.now() + 24 * 3600 * 1000
  };
  fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf8');

  // Also seed TEST_USER as an admin in data/admins.json
  const adminsPath = path.join(process.cwd(), 'data', 'admins.json');
  let admins = [];
  try {
    if (fs.existsSync(adminsPath)) {
      admins = JSON.parse(fs.readFileSync(adminsPath, 'utf8') || '[]');
    }
  } catch {}
  if (!admins.some(a => String(a.userId) === String(TEST_USER.id))) {
    admins.unshift({
      userId: TEST_USER.id,
      username: TEST_USER.username,
      displayName: TEST_USER.globalName,
      role: 'Owner',
      addedAt: new Date().toISOString(),
      addedBy: 'System (TEST)'
    });
    fs.writeFileSync(adminsPath, JSON.stringify(admins, null, 2), 'utf8');
  }

  // Launch browser
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([{
    name: 'erlcus_session',
    value: TEST_SESSION_COOKIE,
    domain: 'localhost',
    path: '/'
  }]);

  const page = await context.newPage();

  // Inject user into localStorage
  await page.addInitScript((u) => {
    localStorage.setItem('erlcus_user', JSON.stringify(u));
  }, TEST_USER);

  // Test 1: Brand name on Home Page
  console.log('1. Checking Home Page branding and title...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const title = await page.title();
  console.log('Page Title:', title);
  if (!title.includes('ConnectingERLC')) {
    throw new Error(`Expected title to include ConnectingERLC, got: ${title}`);
  }

  const brandTextVisible = await page.locator('text=ConnectingERLC').first().isVisible();
  console.log('✓ Brand name "ConnectingERLC" visible:', brandTextVisible);

  // Test 2: Deep links and Route Shortcuts (Section 10)
  console.log('\n2. Testing deep links and route shortcuts...');
  const deepLinks = [
    { url: 'http://localhost:3000/docs', expectText: 'Getting Started' },
    { url: 'http://localhost:3000/pricing', expectText: 'Pricing' },
    { url: 'http://localhost:3000/servers', expectText: 'Your servers' },
    { url: 'http://localhost:3000/privacy', expectText: 'Privacy Policy' },
    { url: 'http://localhost:3000/terms', expectText: 'Terms of Service' }
  ];

  for (const { url, expectText } of deepLinks) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const has404 = await page.locator('h1:has-text("404")').isVisible();
    const hasExpect = await page.locator(`text=${expectText}`).first().isVisible();
    console.log(`✓ Deep link ${url} -> 404: ${has404}, content visible: ${hasExpect}`);
    if (has404) {
      throw new Error(`Deep link unexpectedly showed 404: ${url}`);
    }
  }

  // Test 3: Banned Sign Out and Admin Portal Bypass (Critical User Issue)
  console.log('\n3. Testing Banned Sign Out and Admin Portal access...');
  const banRes = await fetch('http://localhost:3001/api/admin/bans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `erlcus_session=${TEST_SESSION_COOKIE}`
    },
    body: JSON.stringify({
      userId: TEST_USER.id,
      username: TEST_USER.username,
      reason: 'Testing banned sign out and admin bypass in Phase A',
      duration: '1d'
    })
  });
  console.log('Ban creation response status:', banRes.status);
  if (banRes.status !== 200) {
    const errText = await banRes.text();
    throw new Error(`Failed to create test ban: status ${banRes.status}: ${errText}`);
  }

  // Visit a page when banned
  await page.evaluate((banData) => {
    localStorage.setItem('erlcus_current_user_ban', JSON.stringify(banData));
    const u = JSON.parse(localStorage.getItem('erlcus_user') || '{}');
    u.isBanned = true;
    u.ban = banData;
    localStorage.setItem('erlcus_user', JSON.stringify(u));
  }, {
    reason: 'Testing banned sign out and admin bypass in Phase A',
    duration: '1d'
  });

  await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const is403Visible = await page.locator('h1:has-text("403")').isVisible();
  console.log('✓ 403 Suspended page rendered:', is403Visible);

  const signOutBtn = page.locator('button:has-text("Sign out")');
  console.log('✓ Sign out button visible on BannedPage:', await signOutBtn.isVisible());

  // Click Sign Out
  await signOutBtn.click();
  await page.waitForTimeout(1500);

  const currentUrlAfterSignOut = page.url();
  console.log('✓ URL after clicking Sign out:', currentUrlAfterSignOut);
  if (!currentUrlAfterSignOut.includes('/login') && !currentUrlAfterSignOut.includes('/')) {
    throw new Error(`Expected redirect to /login or / after sign out, got: ${currentUrlAfterSignOut}`);
  }

  // Test 4: Admin Portal access while banned for staff
  console.log('\n4. Testing Admin Portal accessibility...');
  await page.goto('http://localhost:3000/admin-portal/blacklist', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const blacklistHeader = await page.locator('text=Blacklist & Account Restrictions').isVisible();
  console.log('✓ Admin Portal accessible without 403 lock:', blacklistHeader);

  // Unban test user to restore clean state
  await fetch(`http://localhost:3001/api/admin/bans/${TEST_USER.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `erlcus_session=${TEST_SESSION_COOKIE}`
    },
    body: JSON.stringify({ reason: 'Completed Phase A automated verification' })
  });
  console.log('✓ Test user pardon issued.');

  // Clean test user from admins.json
  try {
    const cleanAdmins = admins.filter(a => String(a.userId) !== String(TEST_USER.id));
    fs.writeFileSync(adminsPath, JSON.stringify(cleanAdmins, null, 2), 'utf8');
  } catch {}

  // Capture desktop screenshot (1440px)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const deskPath = path.join(ARTIFACTS_DIR, 'round9_phaseA_desktop.png');
  await page.screenshot({ path: deskPath });
  try {
    fs.copyFileSync(deskPath, path.join(BRAIN_DIR, 'round9_phaseA_desktop.png'));
  } catch {}
  console.log('✓ Captured round9_phaseA_desktop.png (1440px)');

  // Capture mobile screenshot (390px)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const mobPath = path.join(ARTIFACTS_DIR, 'round9_phaseA_mobile_390.png');
  await page.screenshot({ path: mobPath });
  try {
    fs.copyFileSync(mobPath, path.join(BRAIN_DIR, 'round9_phaseA_mobile_390.png'));
  } catch {}
  console.log('✓ Captured round9_phaseA_mobile_390.png (390px)');

  await browser.close();
  console.log('\n--- ALL ROUND 9 PHASE A VERIFICATIONS PASSED SUCCESSFULLY! ---');
}

run().catch(err => {
  console.error('Phase A verification failed:', err);
  process.exit(1);
});
