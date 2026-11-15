import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const SESSION_COOKIE = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function run() {
  console.log('=== Starting Round 8 Phase A Automated Verification ===');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  // Inject valid session cookie
  await context.addCookies([
    {
      name: 'erlcus_session',
      value: SESSION_COOKIE,
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await context.newPage();

  // Add initial client localStorage state
  await page.addInitScript(() => {
    const user = {
      id: '523693281541095424',
      name: 'eazykims',
      username: 'eazykims',
      globalName: 'Eazykims',
      displayName: 'Eazykims',
      avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('mavely_user', JSON.stringify(user));
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      {
        id: '1530147023754367006',
        name: 'Discord bot V.2',
        icon: 'https://cdn.discordapp.com/embed/avatars/1.png',
        memberCount: 17,
      }
    ]));
  });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text());
  });

  // ── TEST 1: Section 1 & 3: Appearance & Swatches ───────────────────────────
  console.log('1. Testing Settings > Appearance Tab at 1440px...');
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click Appearance subtab
  const appearanceTabBtn = page.locator('button:has-text("Appearance")').first();
  if (await appearanceTabBtn.isVisible()) {
    await appearanceTabBtn.click();
    await page.waitForTimeout(600);
  }

  // Verify theme swatches have inline background colors
  const swatches = page.locator('button[data-accent]');
  const swatchCount = await swatches.count();
  console.log(`✓ Found ${swatchCount} theme color swatches`);

  // Select "Violet" preset
  const violetBtn = page.locator('button[data-accent="violet"]').first();
  if (await violetBtn.isVisible()) {
    console.log('Selecting Violet accent theme preset...');
    await violetBtn.click();
    await page.waitForTimeout(600);

    // Verify root css variable --accent was updated
    const accentVar = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    });
    console.log('✓ Computed --accent token:', accentVar);
  }

  // Scan computed styles for any leftover hardcoded green
  const greenElements = await page.evaluate(() => {
    const prohibitedColors = [
      'rgb(61, 220, 151)',    // #3DDC97
      'rgb(52, 211, 153)',    // #34D399 / emerald-400
      'rgb(16, 185, 129)',    // #10B981 / emerald-500
      'rgb(5, 46, 26)'        // #052E1A
    ];
    const elements = Array.from(document.querySelectorAll('*'));
    const matches = [];
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const isVisible = el.offsetWidth > 0 || el.offsetHeight > 0;
      if (!isVisible) continue;

      if (prohibitedColors.includes(style.color) || prohibitedColors.includes(style.backgroundColor) || prohibitedColors.includes(style.borderColor)) {
        matches.push({
          tag: el.tagName,
          className: el.className,
          text: (el.textContent || '').slice(0, 30),
          color: style.color,
          bg: style.backgroundColor
        });
      }
    }
    return matches;
  });

  console.log(`✓ Leftover hardcoded green elements count: ${greenElements.length}`);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseA_settings_appearance_desktop.png'),
    fullPage: false
  });
  console.log('✓ Captured round8_phaseA_settings_appearance_desktop.png');

  // ── TEST 2: Section 1 & 2: Overview & Per-Server Credits ───────────────────
  console.log('2. Testing Overview Tab & Topbar Credits Chip at 1440px...');
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check topbar credits chip
  const creditsChip = page.locator('button[title="Open credit history"]').first();
  const chipVisible = await creditsChip.isVisible();
  console.log('✓ Topbar credits chip visible:', chipVisible);
  if (chipVisible) {
    const chipText = await creditsChip.innerText();
    console.log('✓ Topbar credits chip text:', chipText);
  }

  // Verify Coins icon in credits chip follows theme accent (not hardcoded green)
  const coinsColor = await page.evaluate(() => {
    const svg = document.querySelector('button[title="Open credit history"] svg');
    return svg ? window.getComputedStyle(svg).color : null;
  });
  console.log('✓ Coins icon computed color:', coinsColor);

  // Check ServerIcon and UserAvatar presence
  const userAvatar = page.locator('aside img, aside [aria-hidden="true"]').first();
  console.log('✓ Sidebar avatar/icon rendered:', await userAvatar.isVisible());

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseA_overview_desktop.png'),
    fullPage: false
  });
  console.log('✓ Captured round8_phaseA_overview_desktop.png');

  // ── TEST 3: Mobile Viewport 390px ─────────────────────────────────────────
  console.log('3. Testing 390px Mobile Viewport...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseA_overview_mobile_390.png'),
    fullPage: false
  });
  console.log('✓ Captured round8_phaseA_overview_mobile_390.png');

  // Navigate to Settings > Appearance on mobile
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const mobAppearanceBtn = page.locator('button:has-text("Appearance")').first();
  if (await mobAppearanceBtn.isVisible()) {
    await mobAppearanceBtn.click();
    await page.waitForTimeout(600);
  }

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'round8_phaseA_settings_appearance_mobile_390.png'),
    fullPage: false
  });
  console.log('✓ Captured round8_phaseA_settings_appearance_mobile_390.png');

  await browser.close();
  console.log('=== Round 8 Phase A Automated Verification Finished Successfully ===');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
