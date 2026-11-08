const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb');

const routes = [
  { name: 'phaseB_promote', url: 'http://localhost:3000/dashboard/118247000000000001/promote' },
  { name: 'phaseB_earn', url: 'http://localhost:3000/dashboard/118247000000000001/earn' },
  { name: 'phaseB_leaderboard', url: 'http://localhost:3000/dashboard/118247000000000001/leaderboard' },
  { name: 'phaseB_myjoins', url: 'http://localhost:3000/dashboard/118247000000000001/joins' },
  { name: 'phaseB_partnerships', url: 'http://localhost:3000/dashboard/118247000000000001/partnerships' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set mock auth in localStorage before navigation
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('mavely_user', JSON.stringify({
      id: '888888888888888888',
      username: 'eazykims',
      discriminator: '3166',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
    }));
    localStorage.setItem('mavely_token', 'mock_token');
    localStorage.setItem('erlcus_current_guild', '118247000000000001');
    localStorage.setItem('erlcus_credits_balance', '14');
  });

  for (const route of routes) {
    // 1. Desktop: 1440x900
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(route.url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    const desktopPath = path.join(ARTIFACT_DIR, `${route.name}_desktop.png`);
    await page.screenshot({ path: desktopPath, fullPage: false });
    console.log(`Saved desktop: ${desktopPath}`);

    // 2. Mobile: 390x844
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(route.url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    const mobilePath = path.join(ARTIFACT_DIR, `${route.name}_mobile.png`);
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log(`Saved mobile: ${mobilePath}`);
  }

  await browser.close();
  console.log('Phase B capture completed successfully.');
})();

