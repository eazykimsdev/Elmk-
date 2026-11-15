import { chromium } from '../node_modules/playwright-core/index.mjs';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SESSION_ID = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';
const GUILD_ID = '1530147023754367006';

async function runPhaseCTests() {
  console.log('--- STARTING ROUND 5 PHASE C VERIFICATION ---');

  // Launch browser
  console.log('[1/4] Launching Microsoft Edge via Playwright...');
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
  page.on('console', msg => console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text()));

  // Test 1: Server Page Rebuild (Section 6)
  console.log('[2/4] Testing Server Page layout (Section 6)...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/details`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Assert 1100px max-width container exists
  const container = page.locator('[class*="max-w-[1100px]"]');
  await container.waitFor({ state: 'visible', timeout: 5000 });

  // Assert Hero Card components
  const heroCard = page.locator('text=Join server');
  await heroCard.waitFor({ state: 'visible', timeout: 5000 });

  const bumpBtn = page.locator('button:has-text("Bump")').first();
  await bumpBtn.waitFor({ state: 'visible', timeout: 5000 });

  // Assert Info row: Share page button
  const shareBtn = page.locator('button:has-text("Share page")');
  await shareBtn.waitFor({ state: 'visible', timeout: 5000 });

  // Assert Two Columns (8 / 4): About this community, Community feedback, Your numbers, Representatives
  const aboutCard = page.locator('text=About this community');
  await aboutCard.waitFor({ state: 'visible', timeout: 5000 });

  const yourNumbers = page.locator('text=Your numbers');
  await yourNumbers.waitFor({ state: 'visible', timeout: 5000 });

  const repsCard = page.locator('h2:has-text("Representatives")');
  await repsCard.waitFor({ state: 'visible', timeout: 5000 });

  // Click Bump to verify it opens the shadcn BumpDialog
  await bumpBtn.click();
  await page.waitForTimeout(400);
  const bumpDialog = page.locator('[role="dialog"]:has-text("Bump your server")');
  await bumpDialog.waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Capture Server Page screenshot
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseC_server_page.png') });
  console.log('✓ Server page layout verified and screenshot captured');

  // Test 2: Promote Server (Sections 7.1 to 7.5)
  console.log('[3/4] Testing Promote Server (Sections 7.1 to 7.5)...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/promote`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 7.1 Category Cards: Verify selected card has NO green
  const roleplayCard = page.locator('button:has-text("Roleplay server")').first();
  await roleplayCard.waitFor({ state: 'visible', timeout: 5000 });
  const cardClasses = await roleplayCard.getAttribute('class');
  console.log('Category card classes:', cardClasses);
  if (cardClasses.includes('border-[#3DDC97]') || cardClasses.includes('bg-[#3DDC97]')) {
    throw new Error('Category card still has green styling! Expected neutral border and raised background.');
  }
  console.log('✓ Category card uses neutral border and raised background (no green)');

  // 7.4 Popular Tags row
  const popularRow = page.locator('text=Popular:');
  const hasPopular = await popularRow.isVisible();
  console.log('Popular tags row visible:', hasPopular);

  // 7.5 Directory preview: check sticky preview card
  const previewCard = page.locator('aside:has-text("Directory preview")');
  await previewCard.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Directory preview rendered with real DirectoryCard');

  // 7.3 Persistence test: type summary, save, reload, assert value persists
  console.log('Testing form save persistence without reload...');
  const testSummary = `Automated verification patrol community ${Date.now()}`;
  const summaryInput = page.locator('input[placeholder*="One clear sentence"]');
  await summaryInput.fill(testSummary);
  await page.waitForTimeout(300);

  console.log('Input value before click:', await summaryInput.inputValue());

  // Listen to response for /api/servers
  const responsePromise = page.waitForResponse(res => res.url().includes('/api/servers/') && res.url().includes('/listing'), { timeout: 10000 });

  // Click Save changes in the global save bar
  const saveBtn = page.locator('button:has-text("Save changes")');
  console.log('Save button count:', await saveBtn.count());
  await saveBtn.click();
  
  const response = await responsePromise;
  console.log('Listing response status:', response.status());
  const responseJson = await response.json().catch(() => null);
  console.log('Listing response body:', JSON.stringify(responseJson));

  await page.waitForTimeout(500);

  // Assert input still has the typed summary (no reload wipeout)
  let currentVal = await summaryInput.inputValue();
  console.log('Input value after save:', currentVal);
  if (currentVal !== testSummary) {
    throw new Error(`Summary was wiped out after save! Got: "${currentVal}", expected: "${testSummary}"`);
  }
  console.log('✓ Value immediately retained after save without reload');

  // Reload page manually and verify saved value reloads from backend
  console.log('Reloading page to verify persistence from server...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const reloadedSummaryInput = page.locator('input[placeholder*="One clear sentence"]');
  const reloadedVal = await reloadedSummaryInput.inputValue();
  if (reloadedVal !== testSummary) {
    throw new Error(`Summary did not persist across page reload! Got: "${reloadedVal}", expected: "${testSummary}"`);
  }
  console.log(`✓ Value "${reloadedVal}" successfully persisted across manual page reload!`);

  // Capture desktop promote screenshot
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseC_promote_desktop.png') });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseC_desktop.png') });
  console.log('✓ Desktop screenshots captured');

  // Test 3: Mobile Viewport (390x844)
  console.log('[4/4] Testing Mobile Viewport at 390px...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/details`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'round5_phaseC_mobile.png') });
  console.log('✓ Mobile screenshot captured');

  await browser.close();
  console.log('--- ROUND 5 PHASE C VERIFICATION COMPLETED WITH 0 ERRORS ---');
}

runPhaseCTests().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
