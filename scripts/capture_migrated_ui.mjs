import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });

  const s = JSON.parse(fs.readFileSync('data/web_sessions.json', 'utf8'));
  const sid = Object.keys(s)[0];

  const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '390', width: 390, height: 844, isMobile: true },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
    });

    await context.addCookies([
      { name: 'connectingerlc_session', value: sid, domain: 'localhost', path: '/' },
      { name: 'mavely_session', value: sid, domain: 'localhost', path: '/' },
    ]);

    const page = await context.newPage();

    // 1. Earn credits page
    console.log(`Capturing Earn Credits at ${vp.name}...`);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006/earn', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `migrated_earn_credits_${vp.name}.png`) });

    // 2. Leaderboard page
    console.log(`Capturing Leaderboard at ${vp.name}...`);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006/leaderboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `migrated_leaderboard_${vp.name}.png`) });

    await context.close();
  }

  await browser.close();
  console.log('All migrated screenshots captured!');
}

main().catch(console.error);

