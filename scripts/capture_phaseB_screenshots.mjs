import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function capture() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  const rawSessions = JSON.parse(fs.readFileSync('data/web_sessions.json', 'utf8') || '{}');
  const activeSessionId = Object.keys(rawSessions)[0] || '';
  const onlineGuildId = '1323596011498897408'; // Guild where bot is present & online
  const uninvitedGuildId = '1320109891175845988'; // Guild where bot is Not added

  // 1. DESKTOP VIEWPORT (1440px)
  {
    console.log('Capturing Desktop (1440px)...');
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 }
    });
    if (activeSessionId) {
      await context.addCookies([
        {
          name: 'connectingerlc_session',
          value: activeSessionId,
          domain: 'localhost',
          path: '/'
        }
      ]);
    }

    const page = await context.newPage();

    // A. DIRECTORY ICONS
    console.log(`Navigating to /dashboard/${onlineGuildId}/earn...`);
    await page.goto(`http://localhost:3000/dashboard/${onlineGuildId}/earn`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round11_phaseB_directory_icons_1440.png'),
      fullPage: false
    });
    console.log('Saved round11_phaseB_directory_icons_1440.png');

    // B. SERVER PROFILE MODAL (Showing banner, real icon, real owner, retention 2 minutes)
    console.log('Opening server details modal...');
    await page.goto(`http://localhost:3000/dashboard/${onlineGuildId}/earn?server=1320109891175845988`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round11_phaseB_modal_1440.png'),
      fullPage: false
    });
    console.log('Saved round11_phaseB_modal_1440.png');

    // C. YOUR SERVERS (BOT STATUS)
    console.log('Navigating to /servers with need_bot redirect...');
    await page.goto(`http://localhost:3000/servers?need_bot=${uninvitedGuildId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round11_phaseB_bot_status_1440.png'),
      fullPage: false
    });
    console.log('Saved round11_phaseB_bot_status_1440.png');

    await context.close();
  }

  // 2. MOBILE VIEWPORT (390px)
  {
    console.log('Capturing Mobile (390px)...');
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    if (activeSessionId) {
      await context.addCookies([
        {
          name: 'connectingerlc_session',
          value: activeSessionId,
          domain: 'localhost',
          path: '/'
        }
      ]);
    }

    const page = await context.newPage();

    // A. DIRECTORY ICONS
    console.log(`Navigating to /dashboard/${onlineGuildId}/earn on mobile...`);
    await page.goto(`http://localhost:3000/dashboard/${onlineGuildId}/earn`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round11_phaseB_directory_icons_390.png'),
      fullPage: false
    });
    console.log('Saved round11_phaseB_directory_icons_390.png');

    // B. SERVER PROFILE MODAL MOBILE
    console.log('Opening server details modal on mobile...');
    await page.goto(`http://localhost:3000/dashboard/${onlineGuildId}/earn?server=1320109891175845988`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round11_phaseB_modal_390.png'),
      fullPage: false
    });
    console.log('Saved round11_phaseB_modal_390.png');

    // C. YOUR SERVERS (BOT STATUS) MOBILE
    console.log('Navigating to /servers on mobile...');
    await page.goto(`http://localhost:3000/servers?need_bot=${uninvitedGuildId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'round11_phaseB_bot_status_390.png'),
      fullPage: false
    });
    console.log('Saved round11_phaseB_bot_status_390.png');

    await context.close();
  }

  await browser.close();
  console.log('Phase B captures complete!');
}

capture().catch(console.error);
