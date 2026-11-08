import { chromium } from 'playwright-core';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

async function checkPage() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[PAGE ERROR] ${err.message}`));

  console.log('Navigating to http://localhost:3000/ ...');
  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 8000 });
  } catch (e) {
    console.warn('Navigation wait error:', e.message);
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/localhost_home_current.png' });
  console.log('Screenshot saved to localhost_home_current.png');

  const rootHtml = await page.$eval('#root', el => el.innerHTML).catch(() => 'NO_ROOT');
  console.log('Root HTML length:', rootHtml.length);
  console.log('Root HTML preview:', rootHtml.substring(0, 300));
  console.log('\nConsole logs:');
  consoleLogs.forEach(l => console.log(' ', l));

  await browser.close();
}

checkPage();

