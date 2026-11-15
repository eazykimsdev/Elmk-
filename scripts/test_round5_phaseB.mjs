import { chromium } from '../node_modules/playwright-core/index.mjs';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SESSION_ID = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';
const GUILD_ID = '1530147023754367006';

async function runPhaseBTests() {
  console.log('--- STARTING ROUND 5 PHASE B VERIFICATION ---');

  // 1. Test backend mathematical integrity via direct API
  console.log('[1/5] Testing Credit History backend mathematical integrity...');
  const res = await fetch('http://localhost:3001/api/credits/history', {
    headers: { 'Cookie': `erlcus_session=${SESSION_ID}` }
  });
  if (!res.ok) throw new Error(`Backend history endpoint returned ${res.status}`);
  const data = await res.json();

  console.log(`Summary: Balance=${data.summary.balance}, Earned=${data.summary.earned}, Spent=${data.summary.spent}`);
  if (data.summary.earned - data.summary.spent !== data.summary.balance) {
    throw new Error(`Mathematical integrity failure: ${data.summary.earned} - ${data.summary.spent} != ${data.summary.balance}`);
  }
  console.log('✓ Summary mathematical equality passed: earned - spent === balance');

  // Verify chronological running balance on rows
  const sortedChrono = [...data.items].sort((a, b) => a.timestamp - b.timestamp);
  let runningBalance = 0;
  for (const tx of sortedChrono) {
    if (tx.type === 'earned') runningBalance += tx.amount;
    else if (tx.type === 'spent') runningBalance -= tx.amount;
    if (tx.balanceAfter !== runningBalance) {
      throw new Error(`Row ${tx.id} balanceAfter mismatch: expected ${runningBalance}, got ${tx.balanceAfter}`);
    }
  }
  console.log(`✓ All ${data.items.length} transactions have valid chronological balanceAfter values`);

  // Verify CSV export
  const csvRes = await fetch('http://localhost:3001/api/credits/export-csv', {
    headers: { 'Cookie': `erlcus_session=${SESSION_ID}` }
  });
  const csvText = await csvRes.text();
  if (!csvText.startsWith('ID,Date,Description,Reason,Type,Amount,Balance After,Status,Triggered By')) {
    throw new Error('CSV export does not have valid header format');
  }
  console.log('✓ CSV export endpoint verified successfully');

  // 2. Launch browser for UI tests
  console.log('[2/5] Launching Microsoft Edge via Playwright...');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: 'erlcus_session',
      value: SESSION_ID,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await context.newPage();

  // Test 1: Overview & BumpDialog
  console.log('[3/5] Testing BumpDialog on Overview...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Find Bump button
  const bumpButton = page.locator('button:has-text("Bump now"), button:has-text("Bump in")').first();
  await bumpButton.click();
  await page.waitForTimeout(500);

  // Check BumpDialog rendered
  const bumpDialog = page.locator('[role="dialog"]:has-text("Bump your server")');
  await bumpDialog.waitFor({ state: 'visible', timeout: 5000 });

  // Take screenshot of BumpDialog
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseB_bump_dialog.png') });
  console.log('✓ BumpDialog opened and screenshot captured');

  // Close BumpDialog with Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Test 2: Credit History page
  console.log('[4/5] Testing Credit History page & Sheet details...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/history`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Verify header and summary tiles
  const balanceTile = page.locator('text=Available for bumps and promotions');
  await balanceTile.waitFor({ state: 'visible', timeout: 5000 });

  // Take desktop screenshot of Credit history
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseB_history.png') });
  console.log('✓ Credit history table screenshot captured');

  // Click first transaction row to open Sheet details
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.click();
  await page.waitForTimeout(600);

  // Verify Sheet opened
  const sheet = page.locator('text=Transaction details');
  await sheet.waitFor({ state: 'visible', timeout: 5000 });

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseB_history_sheet.png') });
  console.log('✓ Transaction Detail Sheet screenshot captured');

  // Close sheet
  const closeDetailsBtn = page.locator('button:has-text("Close details")');
  await closeDetailsBtn.click();
  await page.waitForTimeout(400);

  // Test 3: Notifications Popover
  console.log('[5/5] Testing Notifications Popover...');
  const bellBtn = page.locator('button[aria-label^="Notifications"]').first();
  await bellBtn.click();
  await page.waitForTimeout(500);

  // Verify Popover visible
  const notifHeader = page.locator('text=Notifications').first();
  await notifHeader.waitFor({ state: 'visible', timeout: 5000 });

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseB_notifications.png') });
  console.log('✓ Notifications popover screenshot captured');

  // Capture full desktop overview
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseB_desktop.png') });

  // Mobile Viewport: 390x844
  console.log('Capturing mobile view at 390px...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/history`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseB_mobile.png') });
  console.log('✓ Mobile screenshot captured');

  await browser.close();
  console.log('--- ROUND 5 PHASE B VERIFICATION COMPLETED WITH 0 ERRORS ---');
}

runPhaseBTests().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});

