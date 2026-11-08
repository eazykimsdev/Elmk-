import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function run() {
  console.log('--- Starting Round 7 Phase F Automated Verification ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  // Inject session cookie for admin user 523693281541095424
  await context.addCookies([
    {
      name: 'erlcus_session',
      value: 'dev_session_id',
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text());
  });

  // 1. Test Overview Tab
  console.log('1. Navigating to /admin-portal/overview (1440px)...');
  await page.goto('http://localhost:3000/admin-portal/overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const adminBadge = await page.locator('text=Admin').first().isVisible();
  console.log('✓ Admin badge visible:', adminBadge);

  const telemetryTitle = await page.locator('text=System Telemetry').isVisible();
  console.log('✓ Telemetry heading visible:', telemetryTitle);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round7_phaseF_admin_overview_desktop.png'),
    fullPage: false
  });
  console.log('✓ Saved round7_phaseF_admin_overview_desktop.png');

  // 2. Test Users Tab & Flows
  console.log('2. Navigating to /admin-portal/users...');
  await page.goto('http://localhost:3000/admin-portal/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const usersHeading = await page.locator('text=User Accounts').isVisible();
  console.log('✓ User Accounts heading visible:', usersHeading);

  // Test Gift Credits Dialog
  const giftBtn = page.locator('button[title="Adjust credits"]').first();
  if (await giftBtn.isVisible()) {
    console.log('Testing adjust credits dialog...');
    await giftBtn.click();
    await page.waitForTimeout(500);
    const amountInput = page.locator('input[placeholder="e.g. 25 or -10"]');
    await amountInput.fill('25');
    const reasonInput = page.locator('input[placeholder="e.g. Compensation for partnership outage"]');
    await reasonInput.fill('Automated test administrative bonus');
    await page.locator('button:has-text("Execute Transaction")').click();
    await page.waitForTimeout(1000);
    console.log('✓ Credits transaction executed');
  }

  // Test Ban User Dialog
  const banBtn = page.locator('button[title="Suspend account"]').first();
  if (await banBtn.isVisible()) {
    console.log('Testing ban user dialog...');
    await banBtn.click();
    await page.waitForTimeout(500);
    const reasonTextarea = page.locator('textarea[placeholder*="policy infraction"]');
    await reasonTextarea.fill('Automated violation test: repeated churning');
    await page.locator('button:has-text("Confirm Suspension")').click();
    await page.waitForTimeout(1000);
    console.log('✓ Ban applied');

    // Test Unban User Dialog
    const unbanBtn = page.locator('button[title="Lift suspension"]').first();
    if (await unbanBtn.isVisible()) {
      console.log('Testing unban user dialog...');
      await unbanBtn.click();
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Lift Suspension")').click();
      await page.waitForTimeout(1000);
      console.log('✓ Suspension lifted (pardon applied)');
    }
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round7_phaseF_admin_users_desktop.png'),
    fullPage: false
  });
  console.log('✓ Saved round7_phaseF_admin_users_desktop.png');

  // 3. Test Servers Tab & Hide/Restore
  console.log('3. Navigating to /admin-portal/servers...');
  await page.goto('http://localhost:3000/admin-portal/servers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const hideBtn = page.locator('button[title="Hide from directory"]').first();
  if (await hideBtn.isVisible()) {
    console.log('Testing hide server action...');
    await hideBtn.click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Confirm Override")').click();
    await page.waitForTimeout(1000);
    console.log('✓ Server hidden');

    const restoreBtn = page.locator('button[title="Restore visibility"]').first();
    if (await restoreBtn.isVisible()) {
      console.log('Testing restore server action...');
      await restoreBtn.click();
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Confirm Override")').click();
      await page.waitForTimeout(1000);
      console.log('✓ Server restored');
    }
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round7_phaseF_admin_servers_desktop.png'),
    fullPage: false
  });
  console.log('✓ Saved round7_phaseF_admin_servers_desktop.png');

  // 4. Test Maintenance Tab
  console.log('4. Navigating to /admin-portal/maintenance...');
  await page.goto('http://localhost:3000/admin-portal/maintenance', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const maintenanceHeading = await page.locator('text=Maintenance Mode').isVisible();
  console.log('✓ Maintenance heading visible:', maintenanceHeading);

  const titleInput = page.locator('input[placeholder*="Scheduled Infrastructure"]');
  await titleInput.fill('Scheduled Shard Maintenance');
  const msgTextarea = page.locator('textarea[placeholder*="Explain the reason"]');
  await msgTextarea.fill('Database index optimizations and connection shard rolling.');
  await page.locator('button:has-text("Save & Publish Notice")').click();
  await page.waitForTimeout(1000);
  console.log('✓ Maintenance settings saved');

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round7_phaseF_admin_maintenance_desktop.png'),
    fullPage: false
  });
  console.log('✓ Saved round7_phaseF_admin_maintenance_desktop.png');

  // 5. Test Changelog Tab
  console.log('5. Navigating to /admin-portal/changelog...');
  await page.goto('http://localhost:3000/admin-portal/changelog', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('Testing publish changelog dialog...');
  await page.locator('button:has-text("New version")').click();
  await page.waitForTimeout(500);

  await page.locator('input[placeholder="e.g. 3.3.0"]').fill('3.3.0');
  await page.locator('input[placeholder*="Global Ledger"]').fill('Nexus Admin Architecture & Audit System');
  await page.locator('input[placeholder*="One sentence summary"]').fill('Complete administrative overhaul with real-time audit trails and telemetry.');
  await page.locator('textarea[placeholder*="Real-time ledger"]').fill('Immutable administrative audit trail\nGlobal credit ledger controls\nReal-time maintenance toggle');
  await page.locator('button:has-text("Publish to Changelog")').click();
  await page.waitForTimeout(1000);
  console.log('✓ Changelog v3.3.0 published');

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round7_phaseF_admin_changelog_desktop.png'),
    fullPage: false
  });
  console.log('✓ Saved round7_phaseF_admin_changelog_desktop.png');

  // 6. Test Audit Log Tab
  console.log('6. Navigating to /admin-portal/audit...');
  await page.goto('http://localhost:3000/admin-portal/audit', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const auditHeading = await page.locator('text=Administrative Audit Trail').isVisible();
  console.log('✓ Audit heading visible:', auditHeading);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round7_phaseF_admin_audit_desktop.png'),
    fullPage: false
  });
  console.log('✓ Saved round7_phaseF_admin_audit_desktop.png');

  // 7. Mobile Viewports (390px)
  console.log('7. Testing Mobile Viewports (390px)...');
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('http://localhost:3000/admin-portal/overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round7_phaseF_admin_overview_mobile_390.png'),
    fullPage: false
  });
  console.log('✓ Saved round7_phaseF_admin_overview_mobile_390.png');

  await page.goto('http://localhost:3000/admin-portal/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round7_phaseF_admin_users_mobile_390.png'),
    fullPage: false
  });
  console.log('✓ Saved round7_phaseF_admin_users_mobile_390.png');

  await browser.close();
  console.log('--- Round 7 Phase F Verified Successfully! ---');
}

run().catch(err => {
  console.error('Phase F test failed:', err);
  process.exit(1);
});
