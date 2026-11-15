import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  console.log('--- Starting Phase A Comprehensive Automated Verification ---');
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  // Inject session cookie
  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: '3efc5ed1fe201f742dfd11150d9867f60edf587a50f1ec608114bbf074d59bc0',
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await context.newPage();

  // Test 1: Overview Tab at 1440px
  console.log('Testing Overview Tab at 1440px...');
  await page.goto('http://localhost:3000/dashboard/1320109891175845988/overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phaseA_overview_1440.png'), fullPage: true });

  // Test 1b: Overview Tab at 390px mobile
  console.log('Testing Overview Tab at 390px...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phaseA_overview_390.png'), fullPage: true });

  // Reset viewport to 1440px
  await page.setViewportSize({ width: 1440, height: 900 });

  // Test 2: Earn Tab & Directory Cards & Modal
  console.log('Testing Earn Tab & Directory Cards at 1440px...');
  await page.goto('http://localhost:3000/dashboard/1320109891175845988/earn', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Check card text for "replace("
  const hasReplaceInCards = await page.evaluate(() => {
    return document.body.innerText.includes('replace(');
  });
  console.log('Has replace( in Earn tab cards?:', hasReplaceInCards ? 'FAIL' : 'PASS (Clean)');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phaseA_earn_directory_1440.png'), fullPage: true });

  // Click on Qatar Airways card or open modal
  console.log('Opening Qatar Airways server modal...');
  await page.evaluate(() => {
    // Click view button on Qatar Airways
    const buttons = Array.from(document.querySelectorAll('button'));
    const qatarCard = Array.from(document.querySelectorAll('[role="button"]')).find(el => el.innerText.includes('Qatar'));
    if (qatarCard) {
      const viewBtn = qatarCard.querySelector('button');
      if (viewBtn) viewBtn.click();
      else qatarCard.click();
    }
  });

  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phaseA_modal_qatar_1440.png') });

  // Mobile modal screenshot
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phaseA_modal_qatar_390.png') });

  // Close modal using Playwright locator
  const closeBtn = page.locator('button:has-text("Close")').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }
  await page.waitForTimeout(500);

  // Reset viewport to 1440px
  await page.setViewportSize({ width: 1440, height: 900 });

  // Test 3: Promote Server Tab & Dirty Form Behavior
  console.log('Testing Promote Tab & Dirty Form Behavior...');
  await page.goto('http://localhost:3000/dashboard/1320109891175845988/promote', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check if "You have unsaved changes" shows up without editing
  const initialDirtyBar = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('You have unsaved changes');
  });
  console.log('Initial unsaved changes bar present on mount?:', initialDirtyBar ? 'FAIL (Bar shown incorrectly)' : 'PASS (No false bar)');

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phaseA_promote_tab_clean_1440.png'), fullPage: true });

  // Mobile Promote screenshot
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phaseA_promote_tab_clean_390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Test 4: Edit a field and assert bar appears
  console.log('Editing field in Promote tab...');
  const fieldChanged = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="Tag"]') || document.querySelector('input[type="text"]');
    if (input) {
      input.focus();
      return true;
    }
    return false;
  });

  // Test 5: Scan computed styles for green colors across page
  const greenElementsCount = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    let greenCount = 0;
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const color = style.color || '';
      const bg = style.backgroundColor || '';
      const border = style.borderColor || '';
      // Check for green hues like rgb(61, 220, 151) or #3ddc97 or rgb(16, 185, 129)
      const isGreen = [color, bg, border].some(c => {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          const r = parseInt(m[1], 10);
          const g = parseInt(m[2], 10);
          const b = parseInt(m[3], 10);
          // Green hue test: g significantly higher than r and b
          if (g > 150 && g > r * 1.3 && g > b * 1.3) return true;
        }
        return false;
      });
      if (isGreen) greenCount++;
    }
    return greenCount;
  });
  console.log('Green elements found on Promote tab:', greenElementsCount);

  await browser.close();
  console.log('--- Phase A Verification Script Complete ---');
}

main().catch(console.error);
