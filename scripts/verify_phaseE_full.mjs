import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE_URL = 'http://localhost:3000';

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
  console.log('[PHASE E VERIFICATION] Starting Home Page & Final Verification...');
  const browser = await chromium.launch({ executablePath: EDGE_PATH, headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('[TEST 1] Loading Home Page at 1440px...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check top nav elements
  const brandLogo = await page.locator('header img[alt="ConnectingERLC"]').isVisible();
  const wordmark = await page.locator('header').getByText('ConnectingERLC').first().isVisible();
  const searchKbd = await page.locator('header kbd:has-text("Ctrl K")').isVisible();
  const getStartedBtn = await page.locator('header').getByText('Get started').first().isVisible();
  console.log(`[TEST 1] Top Navigation: logo=${brandLogo}, wordmark=${wordmark}, searchKbd=${searchKbd}, getStartedBtn=${getStartedBtn}`);

  // Check Hero Headline & Subtitle
  const headline = await page.locator('text=The growth platform for ER:LC communities.').isVisible();
  const subtitle = await page.locator('text=List your server, join others to earn credits, bump to the top, partner up and recruit members.').isVisible();
  const countdown = await page.locator('text=Launching in — November 21').isVisible();
  console.log(`[TEST 1] Hero elements: headline=${headline}, subtitle=${subtitle}, countdown=${countdown}`);

  // Check Hero Visual
  const showcaseWindow = await page.locator('text=connectingerlc.com/directory').isVisible();
  console.log(`[TEST 1] Hero showcase framed window: ${showcaseWindow}`);

  // Scan green elements on hero
  await scanGreenElements(page, 'Home Hero 1440px');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseE_home_hero_1440.png'), fullPage: false });

  // Mobile Hero
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseE_home_hero_390.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Scroll to features
  console.log('[TEST 2] Verifying Feature Sections...');
  const featuresSection = page.locator('#features');
  await featuresSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const feat1 = await page.locator('text=Find active ER:LC servers').isVisible();
  const feat2 = await page.locator('text=Earn credits by joining').isVisible();
  const feat3 = await page.locator('text=Partner with other servers').isVisible();
  const feat4 = await page.locator('text=Recruit with your own invite link').isVisible();
  const feat5 = await page.locator('text=Real reviews from real members').isVisible();
  console.log(`[TEST 2] Feature sections: feat1=${feat1}, feat2=${feat2}, feat3=${feat3}, feat4=${feat4}, feat5=${feat5}`);

  await scanGreenElements(page, 'Home Features 1440px');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseE_home_features_1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseE_home_features_390.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // Scroll to Servers on ConnectingERLC and Footer
  console.log('[TEST 3] Verifying Servers row, CTA, and Footer...');
  const footer = page.locator('footer');
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const cta = await page.getByText('Ready to grow your community?').first().isVisible();
  const footerGeneral = await page.locator('footer').getByText('General').first().isVisible();
  const footerPlatform = await page.locator('footer').getByText('Platform').first().isVisible();
  const footerResources = await page.locator('footer').getByText('Resources').first().isVisible();
  const copyright = await page.locator('footer').getByText('All rights reserved.').first().isVisible();
  console.log(`[TEST 3] Footer & CTA: cta=${cta}, general=${footerGeneral}, platform=${footerPlatform}, resources=${footerResources}, copyright=${copyright}`);

  await scanGreenElements(page, 'Home Footer 1440px');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseE_home_footer_1440.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phaseE_home_footer_390.png'), fullPage: false });

  // Test Command Palette (Ctrl+K)
  console.log('[TEST 4] Testing Search Command Palette via key shortcut...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(600);
  const paletteOpen = await page.locator('input[placeholder="Search servers, documentation..."]').isVisible();
  console.log(`[TEST 4] Command palette triggered via Ctrl+K: ${paletteOpen}`);
  await page.keyboard.press('Escape');

  await browser.close();
  console.log('[PHASE E VERIFICATION] Completed successfully!');
}

runVerification().catch(err => {
  console.error('[PHASE E VERIFICATION ERROR]', err);
  process.exit(1);
});
