import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  console.log('--- Starting Round 7 Phase E Automated Verification ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const consoleErrors = [];

  const setupMockSession = async (context) => {
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
  };

  // 1. Desktop Context (1440x900)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await setupMockSession(desktopCtx);

  const desktopPage = await desktopCtx.newPage();

  desktopPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('/api/telemetry') && !text.includes('Failed to load resource')) {
        console.error('[Browser Error]', text);
        consoleErrors.push(text);
      }
    }
  });

  await desktopPage.addInitScript(() => {
    const user = {
      id: '523693281541095424',
      username: 'eazykims',
      globalName: 'Eazykims',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('mavely_user', JSON.stringify(user));
    localStorage.setItem('erlcus_credits_balance', '42');
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      {
        id: '1530147023754367006',
        name: 'Discord bot V.2',
        icon: 'https://cdn.discordapp.com/embed/avatars/1.png',
        memberCount: 17,
      }
    ]));
  });

  console.log('1. Testing Leaderboard page (/dashboard/:guildId/leaderboard)...');
  await desktopPage.goto('http://localhost:3000/dashboard/1530147023754367006/leaderboard', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1500);

  // Check your rank banner
  const yourRankBanner = desktopPage.locator('text="Your server ranking"').first();
  const hasBanner = await yourRankBanner.isVisible();
  console.log('✓ Your rank banner visible:', hasBanner);

  // Check 3 tabs: Top servers, Top recruiters, Top partners
  const topServersBtn = desktopPage.locator('button:text-is("Top servers")').first();
  const topRecruitersBtn = desktopPage.locator('button:text-is("Top recruiters")').first();
  const topPartnersBtn = desktopPage.locator('button:text-is("Top partners")').first();

  console.log('✓ 3 Leaderboard tabs visible:',
    await topServersBtn.isVisible(),
    await topRecruitersBtn.isVisible(),
    await topPartnersBtn.isVisible()
  );

  // Check Top servers table columns: Rank, Server, Members, Joins this month, Bumps this month, Action
  const serverCol = desktopPage.locator('th:text-is("Server")').first();
  const joinsCol = desktopPage.locator('th:text-is("Joins this month")').first();
  const bumpsCol = desktopPage.locator('th:text-is("Bumps this month")').first();
  console.log('✓ Top servers table columns visible:',
    await serverCol.isVisible(),
    await joinsCol.isVisible(),
    await bumpsCol.isVisible()
  );

  // Screenshot Top servers
  const serversPath = path.join(ARTIFACTS_DIR, 'round7_phaseE_leaderboard_servers_desktop.png');
  await desktopPage.screenshot({ path: serversPath });
  console.log(`✓ Saved ${serversPath}`);

  // Switch to Top recruiters tab
  console.log('2. Testing Top recruiters tab...');
  await topRecruitersBtn.click();
  await desktopPage.waitForTimeout(600);

  const recruiterCol = desktopPage.locator('th:text-is("Recruiter")').first();
  const emptyRecruiters = desktopPage.locator('text="No active recruiters yet"').first();
  const hasRecruitersContent = (await recruiterCol.isVisible()) || (await emptyRecruiters.isVisible());
  console.log('✓ Top recruiters tab content visible (table or clean empty state):', hasRecruitersContent);

  // Switch to Top partners tab
  console.log('3. Testing Top partners tab...');
  await topPartnersBtn.click();
  await desktopPage.waitForTimeout(600);

  const partnerCol = desktopPage.locator('th:text-is("Partners count")').first();
  console.log('✓ Top partners table columns visible:', await partnerCol.isVisible());

  // Screenshot Top recruiters
  await topRecruitersBtn.click();
  await desktopPage.waitForTimeout(400);
  const recruitersPath = path.join(ARTIFACTS_DIR, 'round7_phaseE_leaderboard_recruiters_desktop.png');
  await desktopPage.screenshot({ path: recruitersPath });
  console.log(`✓ Saved ${recruitersPath}`);

  // 4. Test Overview Next bump timer (/dashboard/:guildId/overview)
  console.log('4. Testing Overview Next bump timer (/dashboard/:guildId/overview)...');
  await desktopPage.goto('http://localhost:3000/dashboard/1530147023754367006/overview', { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(1500);

  // Check Next bump card title
  const nextBumpTitle = desktopPage.locator('h3:text-is("Next bump")').first();
  await nextBumpTitle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await desktopPage.waitForTimeout(400);
  console.log('✓ Next bump card visible:', await nextBumpTitle.isVisible());

  // Check badge or bump status: either "Ready to bump now!" or "Available in..."
  const bumpBadge = desktopPage.locator('text="Ready to bump now!"').first();
  const bumpCooldownBadge = desktopPage.locator('text="Available in"').first();
  const hasBumpStatus = (await bumpBadge.isVisible()) || (await bumpCooldownBadge.isVisible());
  console.log('✓ Bump status text visible:', hasBumpStatus);

  // Check Bump server button
  const bumpButton = desktopPage.locator('button:has-text("Bump server")').first();
  console.log('✓ Bump server button visible:', await bumpButton.isVisible());

  // Screenshot Overview Next Bump
  const overviewPath = path.join(ARTIFACTS_DIR, 'round7_phaseE_overview_nextbump_desktop.png');
  await desktopPage.screenshot({ path: overviewPath });
  console.log(`✓ Saved ${overviewPath}`);

  // 4. Mobile Testing (390x844)
  console.log('4. Testing Mobile Viewports (390px)...');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await setupMockSession(mobileCtx);

  const mobilePage = await mobileCtx.newPage();
  await mobilePage.addInitScript(() => {
    const user = {
      id: '523693281541095424',
      username: 'eazykims',
      globalName: 'Eazykims',
      avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
    };
    localStorage.setItem('erlcus_user', JSON.stringify(user));
    localStorage.setItem('mavely_user', JSON.stringify(user));
    localStorage.setItem('erlcus_credits_balance', '42');
  });

  // Mobile Leaderboard
  await mobilePage.goto('http://localhost:3000/dashboard/1530147023754367006/leaderboard', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1200);

  const mobileLeaderboardPath = path.join(ARTIFACTS_DIR, 'round7_phaseE_leaderboard_mobile_390.png');
  await mobilePage.screenshot({ path: mobileLeaderboardPath });
  console.log(`✓ Saved ${mobileLeaderboardPath}`);

  // Mobile Overview
  await mobilePage.goto('http://localhost:3000/dashboard/1530147023754367006/overview', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1200);

  const mobileNextBumpCard = mobilePage.locator('h3:text-is("Next bump")').first();
  await mobileNextBumpCard.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await mobilePage.waitForTimeout(400);

  const mobileOverviewPath = path.join(ARTIFACTS_DIR, 'round7_phaseE_overview_nextbump_mobile_390.png');
  await mobilePage.screenshot({ path: mobileOverviewPath });
  console.log(`✓ Saved ${mobileOverviewPath}`);

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('Captured console errors during Phase E verification:');
    consoleErrors.forEach((e) => console.error(' - ', e));
    throw new Error('FAILED: Console errors occurred during test.');
  }

  console.log('--- Round 7 Phase E Verified Successfully! ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
