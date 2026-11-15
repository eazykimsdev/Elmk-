import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function captureConnected() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: 'erlcus_session',
      value: 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();

  // Mock ER:LC connected state
  await page.route('**/api/servers/*/erlc/status*', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connected: true,
        status: 'connected',
        name: 'Liberty County State Roleplay',
        currentPlayers: 18,
        maxPlayers: 50,
        joinCode: 'STATE-99',
        maskedKey: '••••••••••••••••3a8f',
        lastCheckedAt: new Date().toISOString(),
      }),
    });
  });

  await page.addInitScript(() => {
    const mockUser = { id: '523693281541095424', username: 'eazykims', globalName: 'Eazykims', avatar: null };
    localStorage.setItem('mavely_user', JSON.stringify(mockUser));
    localStorage.setItem('erlcus_user', JSON.stringify(mockUser));
  });

  await page.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Switch to Invite and rewards
  await page.getByRole('button', { name: /Invite and rewards/i }).click();
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseB_erlc_connected_desktop.png') });
  console.log('Saved round6_phaseB_erlc_connected_desktop.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_phaseB_erlc_connected_mobile_390.png') });
  console.log('Saved round6_phaseB_erlc_connected_mobile_390.png');

  await browser.close();
}

captureConnected();

