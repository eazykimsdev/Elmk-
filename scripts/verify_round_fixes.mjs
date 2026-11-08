import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  console.log('Navigating to Home Page...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Verify Headline
  const headline = await page.locator('h1').textContent();
  console.log('Headline:', headline.trim());

  // 2. Verify Subtext
  const subtext = await page.locator('p:has-text("Promote your server")').textContent();
  console.log('Subtext:', subtext.trim());

  // 3. Verify Old Showcase is GONE
  const hasOldShowcase = await page.locator('text=theconnectingerlc.com/dashboard?tab=earn').count();
  console.log('Has old showcase URL bar (must be 0):', hasOldShowcase);

  const hasOldEverything = await page.locator('text=Everything your community needs').count();
  console.log('Has old "Everything your community needs" (must be 0):', hasOldEverything);

  // 4. Verify New Sliding Cards Section Header
  const slidingHeader = await page.locator('text=Top Verified ERLC Communities').count();
  console.log('Has "Top Verified ERLC Communities" header (must be 1):', slidingHeader);

  // Take screenshot of Hero
  await page.screenshot({
    path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/home_hero_updated.png',
    fullPage: false
  });

  // Scroll down to the sliding server cards
  await page.evaluate(() => window.scrollTo(0, 650));
  await page.waitForTimeout(600);

  // Take screenshot of sliding cards
  await page.screenshot({
    path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/home_sliding_cards.png',
    fullPage: false
  });

  // 5. Click the first card to verify modal opens
  const firstCard = page.locator('.slide-track [role="button"]').first();
  if (await firstCard.count() > 0) {
    await firstCard.click({ force: true });
    await page.waitForTimeout(600);
    const modalVisible = await page.locator('[role="dialog"]').count();
    console.log('Server modal opened on card click:', modalVisible > 0);
    await page.screenshot({
      path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/home_card_modal_opened.png',
      fullPage: false
    });
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 6. Check /status page
  console.log('Navigating to /status...');
  await page.goto('http://localhost:3000/status', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/status_page_verified.png',
    fullPage: false
  });

  console.log('Total console errors on visited pages:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  }

  await browser.close();
  console.log('Visual and functional verification complete!');
}

main().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
