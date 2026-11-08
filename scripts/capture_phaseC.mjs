import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function capture() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  // Read active session cookie to access the server dashboard
  let sessionCookie = '';
  try {
    const raw = fs.readFileSync('data/web_sessions.json', 'utf8');
    const sessions = JSON.parse(raw);
    const keys = Object.keys(sessions);
    if (keys.length > 0) {
      sessionCookie = keys[0];
    }
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

    // 1. Home page
    console.log(`Capturing Home page at ${vp.name}...`);
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `round11_phaseC_home_${vp.name}.png`),
      fullPage: true,
    });

    // 2. Login preview
    console.log(`Capturing Login preview at ${vp.name}...`);
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `round11_phaseC_login_${vp.name}.png`),
      fullPage: false,
    });

    // 3. Server page (Dashboard details tab)
    console.log(`Capturing Server page at ${vp.name}...`);
    await page.goto('http://localhost:3000/dashboard/1530147023754367006/details', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `round11_phaseC_server_page_${vp.name}.png`),
      fullPage: true,
    });

    await context.close();
  }

  await browser.close();
  console.log('All Phase C screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
