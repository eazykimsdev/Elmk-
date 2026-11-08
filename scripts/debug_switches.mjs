import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'erlcus_session', value: 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb', domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const user = { id: '523693281541095424', username: 'eazykims', globalName: 'Eazykims' };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('mavely_user', JSON.stringify(user));
    localStorage.setItem('erlcus_credits_balance', '42');
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([{ id: '1530147023754367006', name: 'Testing Server' }]));
  });
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("Invite and rewards")').first().click();
  await page.waitForTimeout(600);
  const switches = await page.locator('button[role="switch"]').all();
  console.log('Switches count:', switches.length);
  console.log('Clicking Switch 1...');
  await switches[1].click();
  await page.waitForTimeout(1000);
  const dialogCount = await page.locator('[role="dialog"], [data-slot="dialog-content"]').count();
  console.log('Dialogs found:', dialogCount);
  if (dialogCount > 0) {
    const text = await page.locator('[role="dialog"], [data-slot="dialog-content"]').first().innerText();
    console.log('Dialog content:\n', text);
  } else {
    console.log('No dialog appeared. Page HTML around switch:');
    const html = await page.locator('body').innerHTML();
    console.log(html.includes('This reward comes out of your credits') ? 'HTML contains text!' : 'Text not in HTML');
  }
  await browser.close();
}
main();
