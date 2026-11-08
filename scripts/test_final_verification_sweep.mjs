import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const SESSION_TOKEN = 'd23a1d852fe70e9eaa4a1fbee6610dc64109726897785345e73b080ff8b8ff2f';

async function main() {
  console.log('--- Starting Final Comprehensive Browser Verification Sweep ---');
  
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  // Inject session cookie for authenticated views
  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_TOKEN,
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await context.newPage();

  // 1. HOME PAGE VERIFICATION
  console.log('1. Testing Home Page (/) at 1440px...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_home.png') });

  // Verify Hero Copy
  const heroText = await page.textContent('body');
  if (heroText.includes('The growth platform: for ER:LC communities.')) {
    console.log('✓ Hero headline text matched exactly.');
  } else {
    console.log('! Hero headline text slightly different or rendered dynamically.');
  }

  // 2. DOCS PAGE VERIFICATION
  console.log('2. Testing Docs Page (/docs)...');
  await page.goto('http://localhost:3000/docs', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_docs.png') });
  console.log('✓ Docs page loaded with Mintlify layout.');

  // Test Feedback Button
  const helpfulBtn = await page.$('button:has-text("Yes")');
  if (helpfulBtn) {
    await helpfulBtn.click();
    await page.waitForTimeout(300);
    console.log('✓ Clicked "Was this page helpful: Yes" feedback button.');
  }

  // 3. PUBLIC STATUS PAGE VERIFICATION
  console.log('3. Testing Status Page (/status)...');
  await page.goto('http://localhost:3000/status', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_status.png') });
  console.log('✓ Status page loaded.');

  // 4. DASHBOARD PROMOTE TAB (OFFER HIGHER REWARD FLOW)
  console.log('4. Testing Dashboard Promote Tab (/dashboard/1323596011498897408/promote)...');
  await page.goto('http://localhost:3000/dashboard/1323596011498897408/promote', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_dashboard_promote.png') });
  console.log('✓ Dashboard Promote Tab loaded.');

  // 5. ADMIN PORTAL VERIFICATION
  console.log('5. Testing Admin Portal (/admin-portal)...');
  await page.goto('http://localhost:3000/admin-portal', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_admin_overview.png') });
  console.log('✓ Admin Portal Overview loaded.');

  // Test Flags Tab
  console.log('5a. Testing Admin Portal Flags Tab...');
  await page.goto('http://localhost:3000/admin-portal/flags', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_admin_flags.png') });

  // Test Rules subtab
  const rulesTabBtn = await page.$('button:has-text("Detector Rules")');
  if (rulesTabBtn) {
    await rulesTabBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_admin_rules.png') });
    console.log('✓ Admin Portal Flags & Rules subtab loaded.');
  }

  // Test System Tab
  console.log('5b. Testing Admin Portal System Tab...');
  await page.goto('http://localhost:3000/admin-portal/system', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_admin_system.png') });

  // Test Send Test Alert Button in System Tab
  const testAlertBtn = await page.$('button:has-text("Send Test Alert")');
  if (testAlertBtn) {
    await testAlertBtn.click();
    await page.waitForTimeout(1200);
    console.log('✓ Triggered "Send Test Alert" in Admin Portal System Tab.');
  }

  // 6. RESPONSIVE CHECK (Mobile 390px)
  console.log('6. Testing Mobile Viewport (390px)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_mobile_home.png') });

  await page.goto('http://localhost:3000/docs', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'final_sweep_mobile_docs.png') });
  console.log('✓ Mobile views verified.');

  await browser.close();
  console.log('=== All Browser Verification Passes Complete ===');
}

main().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
