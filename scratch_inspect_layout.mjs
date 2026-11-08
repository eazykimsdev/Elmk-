import { chromium } from './node_modules/playwright-core/index.mjs';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    const user = { id: '523693281541095424', username: 'eazykims', globalName: 'Eazykims', name: 'Eazykims' };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('mavely_user', JSON.stringify(user));
    localStorage.setItem('mavely_token', 'mock_token');
    localStorage.setItem('erlcus_current_guild', '1530147023754367006');
    localStorage.setItem('erlcus_credits_balance', '42');
  });
  await page.goto('http://localhost:3000/dashboard/1530147023754367006');
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const main = document.querySelector('main');
    const overviewDiv = main?.firstElementChild;
    const statGrid = overviewDiv?.children[1];
    const statCard = statGrid?.firstElementChild;
    return {
      windowInnerWidth: window.innerWidth,
      bodyWidth: document.body.clientWidth,
      mainWidth: main?.getBoundingClientRect().width,
      overviewDivWidth: overviewDiv?.getBoundingClientRect().width,
      statCardWidth: statCard?.getBoundingClientRect().width,
      statCardHeight: statCard?.getBoundingClientRect().height,
      parentPadding: window.getComputedStyle(main?.parentElement).padding,
    };
  });
  console.log('Layout info:', JSON.stringify(info, null, 2));
  await browser.close();
}
run().catch(console.error);

