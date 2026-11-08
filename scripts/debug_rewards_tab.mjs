import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{
    name: 'connectingerlc_session',
    value: '3efc5ed1fe201f742dfd11150d9867f60edf587a50f1ec608114bbf074d59bc0',
    domain: 'localhost',
    path: '/'
  }]);
  const page = await context.newPage();
  await page.goto('http://localhost:3000/dashboard/1320109891175845988/promote', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const rewardsTab = page.locator('button:has-text("Invite and rewards")').first();
  await rewardsTab.click();
  await page.waitForTimeout(1000);

  const recruitSwitches = page.locator('button[role="switch"]');
  const count = await recruitSwitches.count();
  console.log('Switches count:', count);
  for (let i = 0; i < count; i++) {
    const sw = recruitSwitches.nth(i);
    const checked = await sw.getAttribute('aria-checked');
    console.log(`Switch ${i}: aria-checked=${checked}`);
  }

  // Find switch for Recruit representatives
  const recruitSwitch = page.locator('div:has(h3:has-text("Recruit representatives")) > button[role="switch"]');
  console.log('Recruit switch initial checked:', await recruitSwitch.getAttribute('aria-checked'));
  
  console.log('Clicking recruit switch...');
  await recruitSwitch.click();
  await page.waitForTimeout(600);
  console.log('Recruit switch after click checked:', await recruitSwitch.getAttribute('aria-checked'));

  // Test Offer a higher reward
  const higherRewardSwitch = page.locator('div:has-text("Offer a higher reward") > button[role="switch"]');
  console.log('Higher reward switch initial checked:', await higherRewardSwitch.getAttribute('aria-checked'));
  console.log('Clicking higher reward switch...');
  await higherRewardSwitch.click();
  await page.waitForTimeout(600);

  const dialogTitle = await page.locator('[role="dialog"] h2, [role="dialog"] [class*="DialogTitle"]').allInnerTexts();
  console.log('Dialog opened with title:', dialogTitle);
  const understandBtn = page.locator('button:has-text("I understand")').first();
  await understandBtn.click();
  await page.waitForTimeout(600);

  const extraCreditsField = page.locator('text=Extra credits per join').count();
  console.log('Extra credits field count after enabling higher reward:', await extraCreditsField);
  const comesOutText = page.locator('text=Comes out of this server\'s credits.').count();
  console.log('Help text "Comes out of this server\'s credits." count:', await comesOutText);

  await browser.close();
}

main().catch(console.error);
