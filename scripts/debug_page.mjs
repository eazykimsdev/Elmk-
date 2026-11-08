import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: {
      cookies: [{
        name: 'mavely_session',
        value: 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      }],
      origins: [{
        origin: 'http://localhost:3000',
        localStorage: [
          { name: 'erlcus_session_token', value: 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb' },
          { name: 'erlcus_current_guild_id', value: '1530147023754367006' }
        ]
      }]
    }
  });
  const page = await context.newPage();
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/settings');
  await page.waitForTimeout(2000);
  console.log('Current URL:', page.url());
  console.log('Page Title:', await page.title());
  const body = await page.innerText('body');
  console.log('Body snippet:', body.slice(0, 300));
  const tabs = await page.locator('[role="tab"]').allInnerTexts();
  console.log('Found tabs:', tabs);
  await page.screenshot({ path: 'debug_settings.png' });
  await browser.close();
}

run();
