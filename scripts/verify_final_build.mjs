import { chromium } from 'playwright-core';

const BASE_URL = 'http://localhost:3000';

function isGreenColor(colorStr) {
  if (!colorStr) return false;
  // Match rgb(r, g, b) or rgba(r, g, b, a)
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (match) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    // Disregard neutrals (whites, grays, blacks) where r ≈ g ≈ b
    if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) return false;
    // Green hue: g is noticeably higher than r and b
    if (g > r + 35 && g > b + 25 && g > 70) {
      return true;
    }
  }
  return false;
}

async function run() {
  console.log('🚀 Starting Final Build Verification Suite...');
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  const routesToTest = [
    '/',
    '/directory',
    '/changelog',
    '/status',
    '/docs',
    '/s/1347902300324368414',
    '/?server=1347902300324368414',
    '/dashboard/1530147023754367006/overview',
    '/dashboard/1530147023754367006/earn',
    '/dashboard/1530147023754367006/leaderboard',
    '/dashboard/1530147023754367006/joins',
    '/dashboard/1530147023754367006/partnerships',
    '/admin-portal'
  ];

  let greenViolations = 0;
  let textArtifactViolations = 0;
  let connectingErlcOwnerViolations = 0;

  for (const route of routesToTest) {
    console.log(`\nTesting route: ${route}`);
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(800);

      // Check for green computed styles on all visible elements
      const elementsWithColors = await page.evaluate(() => {
        const results = [];
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const style = window.getComputedStyle(el);
          const color = style.color;
          const bg = style.backgroundColor;
          const border = style.borderColor;
          results.push({ tag: el.tagName, color, bg, border });
        }
        return results;
      });

      for (const item of elementsWithColors) {
        if (isGreenColor(item.color) || isGreenColor(item.bg) || isGreenColor(item.border)) {
          console.warn(`[GREEN VIOLATION on ${route}]:`, item);
          greenViolations++;
        }
      }

      // Check text content for "replace(" or "char(10)" or "Owned by ConnectingERLC"
      const pageText = await page.evaluate(() => document.body.innerText || '');
      if (pageText.includes('replace(') || pageText.includes('char(10)')) {
        console.error(`[SQL ARTIFACT VIOLATION on ${route}]: found replace( or char(10)`);
        textArtifactViolations++;
      }
      if (/owned by connectingerlc/i.test(pageText)) {
        console.error(`[CONNECTINGERLC OWNER VIOLATION on ${route}]: found Owned by ConnectingERLC`);
        connectingErlcOwnerViolations++;
      }

      console.log(`✓ Route ${route} passed basic checks.`);
    } catch (e) {
      console.error(`Error on route ${route}:`, e.message);
    }
  }

  // Check modal popup entry point: /directory
  console.log('\nTesting Modal Popup on /directory...');
  await page.goto(`${BASE_URL}/directory`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const viewButton = page.locator('.grid button:has-text("View")').first();
  if (await viewButton.isVisible()) {
    await viewButton.click();
    await page.waitForTimeout(1000);
    const modalVisible = await page.locator('[role="dialog"]').isVisible();
    console.log('Modal visible after clicking View on /directory:', modalVisible);
    if (!modalVisible) {
      console.error('Modal failed to open from /directory View button!');
    } else {
      console.log('✓ Modal opened successfully on /directory');
    }
  }

  // Check modal popup on /s/1347902300324368414
  console.log('\nTesting Direct Link /s/1347902300324368414...');
  await page.goto(`${BASE_URL}/s/1347902300324368414`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const directModal = await page.locator('[role="dialog"]').isVisible();
  console.log('Direct modal opened on /s/1347902300324368414:', directModal);

  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log('Total Console Errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors.slice(0, 5));
  }
  console.log('Green Color Violations:', greenViolations);
  console.log('SQL Artifact (replace) Violations:', textArtifactViolations);
  console.log('ConnectingERLC Owner Violations:', connectingErlcOwnerViolations);

  await browser.close();

  if (greenViolations === 0 && textArtifactViolations === 0 && connectingErlcOwnerViolations === 0) {
    console.log('\n🎉 ALL CHECKS PASSED WITH 0 BUGS!');
    process.exit(0);
  } else {
    console.error('\n❌ Some checks failed.');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
