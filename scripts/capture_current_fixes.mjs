import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function main() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  let sessionCookie = '';
  try {
    const raw = fs.readFileSync('data/web_sessions.json', 'utf8');
    const sessions = JSON.parse(raw);
    const keys = Object.keys(sessions);
    if (keys.length > 0) sessionCookie = keys[0];
  } catch {}

  const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '390', width: 390, height: 844, isMobile: true },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
    });

    if (sessionCookie) {
      await context.addCookies([
        {
          name: 'connectingerlc_session',
          value: sessionCookie,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
        },
        {
          name: 'mavely_session',
          value: sessionCookie,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    }

    const page = await context.newPage();

    // 1. Overview Tab (Checklist)
    console.log(`Capturing Overview / Checklist at ${vp.name}...`);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `checklist_fixed_${vp.name}.png`),
    });

    // 2. Server Details Tab ("Your numbers" with real user icon)
    console.log(`Capturing Server Details at ${vp.name}...`);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006/details', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `server_details_icon_${vp.name}.png`),
    });

    // 3. Admin Portal Reports Tab
    console.log(`Capturing Admin Portal Reports at ${vp.name}...`);
    await page.goto('http://localhost:3000/admin-portal', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    // Click on Reports tab if present
    const reportsBtn = await page.$('button:has-text("Reports")');
    if (reportsBtn) {
      await reportsBtn.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `admin_portal_reports_${vp.name}.png`),
    });

    await context.close();
  }

  await browser.close();
  console.log('Capture complete!');
}

main().catch(console.error);

