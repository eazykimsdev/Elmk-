import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Route /api/auth/me to return a mock logged-in user
  await page.route('**/api/auth/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '123456789012345678',
          username: 'sulma',
          global_name: 'Sulma',
          avatar: null
        },
        guilds: []
      })
    });
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click on user avatar trigger in rail
  const avatarTrigger = page.locator('[data-slot="dropdown-menu-trigger"]').first();
  await avatarTrigger.click();
  await page.waitForTimeout(500);

  // Take screenshot with dropdown open
  await page.screenshot({
    path: 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/user_dropdown_open.png'
  });

  const menuText = await page.locator('[data-slot="dropdown-menu-content"]').textContent();
  console.log('Dropdown menu text found:', menuText ? menuText.slice(0, 100) : 'null');

  await browser.close();
  console.log('User dropdown verified successfully!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

