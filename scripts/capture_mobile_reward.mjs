import { chromium } from 'playwright-core';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await mobileCtx.addCookies([
    {
      name: 'erlcus_session',
      value: 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await mobileCtx.newPage();
  await page.addInitScript(() => {
    const user = { id: '523693281541095424', username: 'eazykims', globalName: 'Eazykims' };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('mavely_user', JSON.stringify(user));
    localStorage.setItem('erlcus_credits_balance', '42');
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([{ id: '1530147023754367006', name: 'Testing Server' }]));
  });

  await page.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const rewardsTab = page.locator('button:has-text("Invite and rewards")').first();
  if (await rewardsTab.isVisible()) {
    await rewardsTab.click();
    await page.waitForTimeout(500);
  }

  const higherRewardSwitch = page.locator('button[role="switch"]').nth(1);
  if (await higherRewardSwitch.isVisible()) {
    await higherRewardSwitch.scrollIntoViewIfNeeded();
    await higherRewardSwitch.click();
    await page.waitForTimeout(600);
  }

  const mobileRewardPath = path.join(ARTIFACTS_DIR, 'round7_phaseA_reward_dialog_mobile_390.png');
  await page.screenshot({ path: mobileRewardPath });
  console.log('Saved mobile reward screenshot:', mobileRewardPath);

  await browser.close();
}

main();

