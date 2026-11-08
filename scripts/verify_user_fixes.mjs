import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });

  const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
  const SESSION_TOKEN = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';
  const GUILD_ID = '1320109891175845988';

  // 1. Desktop Context
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await desktopContext.addCookies([
    { name: 'connectingerlc_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' },
    { name: 'erlcus_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' },
    { name: 'erlc_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' }
  ]);

  const page = await desktopContext.newPage();

  // Overview Tab
  console.log('Navigating to Overview (Desktop)...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${BRAIN_DIR}/overview_remodel_desktop_1440.png` });
  console.log('✓ Saved overview_remodel_desktop_1440.png');

  // Earn Credits Tab
  console.log('Navigating to Earn Credits (Desktop)...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/earn-credits`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${BRAIN_DIR}/directory_single_server_desktop.png` });

  // Open modal via query param
  console.log('Opening server details modal...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/earn-credits?server=${GUILD_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${BRAIN_DIR}/modal_banner_fixed_desktop_1440.png` });
  console.log('✓ Saved modal_banner_fixed_desktop_1440.png');

  // 2. Mobile Context (390px)
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobileContext.addCookies([
    { name: 'connectingerlc_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' },
    { name: 'erlcus_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' },
    { name: 'erlc_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' }
  ]);
  const mobPage = await mobileContext.newPage();

  console.log('Navigating to Overview (Mobile)...');
  await mobPage.goto(`http://localhost:3000/dashboard/${GUILD_ID}`, { waitUntil: 'networkidle' });
  await mobPage.waitForTimeout(1000);
  await mobPage.screenshot({ path: `${BRAIN_DIR}/overview_remodel_mobile_390.png` });
  console.log('✓ Saved overview_remodel_mobile_390.png');

  console.log('Opening server details modal (Mobile)...');
  await mobPage.goto(`http://localhost:3000/dashboard/${GUILD_ID}/earn-credits?server=${GUILD_ID}`, { waitUntil: 'networkidle' });
  await mobPage.waitForTimeout(1200);
  await mobPage.screenshot({ path: `${BRAIN_DIR}/modal_banner_fixed_mobile_390.png` });
  console.log('✓ Saved modal_banner_fixed_mobile_390.png');

  await browser.close();
  console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
}

main().catch(console.error);

