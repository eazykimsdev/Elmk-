import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check search modal visibility on load (should be false)
  const isSearchModalVisible = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="Search servers"]');
    return input ? input.offsetParent !== null : false;
  });
  console.log('Search modal visible on load (should be false):', isSearchModalVisible);

  // Check the URL title bar of the framed browser window
  const frameTitle = await page.textContent('span:has-text("theconnectingerlc.com/dashboard?tab=earn")');
  console.log('Framed browser title found:', Boolean(frameTitle));

  // Check FAQs section
  const faqHeading = await page.textContent('h2:has-text("FAQs")');
  console.log('FAQ heading found:', Boolean(faqHeading));

  // Take desktop screenshot
  await page.screenshot({
    path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/home_page_fixed_1440.png',
    fullPage: false
  });

  // Mobile screenshot
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/home_page_fixed_390.png',
    fullPage: false
  });

  console.log('Total console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }

  await browser.close();
  console.log('Verification finished successfully!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
