import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/dashboard/1320109891175845988/earn', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const cardIcons = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[role="button"]'));
    return cards.map(c => {
      const img = c.querySelector('img');
      const h4 = c.querySelector('h4');
      const fallback = c.querySelector('div[aria-hidden="true"]');
      return {
        title: h4?.textContent?.trim(),
        hasImg: Boolean(img),
        imgSrc: img?.src,
        textFallback: fallback?.textContent?.trim()
      };
    });
  });
  console.log('Cards:', JSON.stringify(cardIcons, null, 2));
  await browser.close();
}

main().catch(console.error);

