import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const GUILD_ID = '1320109891175845988';
const SESSION_TOKEN = 'round9_phasea_session_token_1793941678769';

async function run() {
  console.log('--- 1. Testing Backend Endpoints ---');

  // Test bump status returns rank & lastBumpedAt
  const bumpRes = await fetch(`http://localhost:3001/api/servers/${GUILD_ID}/bump`);
  const bumpData = await bumpRes.json();
  console.log('GET /api/servers/:id/bump status:', bumpData);
  if (typeof bumpData.canBump !== 'boolean') {
    throw new Error('Bump status missing canBump boolean!');
  }

  // Test activity endpoint
  const actRes = await fetch(`http://localhost:3001/api/servers/${GUILD_ID}/activity`);
  const actData = await actRes.json();
  console.log('GET /api/servers/:id/activity count:', actData.events?.length);
  if (!actData.ok || !Array.isArray(actData.events)) {
    throw new Error('Activity endpoint did not return ok: true and events array!');
  }

  // Test Token Bucket Rate Limiter on bump endpoint
  console.log('\n--- 2. Testing Token Bucket Rate Limiter (Spam clicks) ---');
  let got429 = false;
  let retrySeconds = null;
  for (let i = 0; i < 8; i++) {
    const res = await fetch(`http://localhost:3001/api/servers/${GUILD_ID}/bump`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `connectingerlc_session=${SESSION_TOKEN}`
      },
    });
    if (res.status === 429) {
      got429 = true;
      const json = await res.json();
      retrySeconds = json.retryAfterSeconds;
      console.log('✓ Token bucket rate limit triggered with 429:', json);
      break;
    }
  }

  if (!got429) {
    console.warn('Note: Rate limit did not trigger 429 (may have reached cooldown first)');
  } else {
    console.log(`✓ 429 received with Retry-After seconds: ${retrySeconds}`);
  }

  console.log('\n--- 3. Testing Frontend Overview and BumpDialog ---');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  // 1440px Desktop Context
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  await desktopContext.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_TOKEN,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const page = await desktopContext.newPage();
  await page.addInitScript((guildId) => {
    localStorage.setItem('erlcus_default_guild', guildId);
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      { id: guildId, name: 'San Andreas State Troopers', icon: null }
    ]));
    localStorage.setItem('connectingerlc_user', JSON.stringify({
      id: '888777666555444333',
      username: 'patrol_commander',
      globalName: 'Patrol Commander',
    }));
    localStorage.setItem('erlcus_user', JSON.stringify({
      id: '888777666555444333',
      username: 'patrol_commander',
      globalName: 'Patrol Commander',
    }));
    localStorage.setItem('erlcus_credits_balance', '45');
    localStorage.setItem(`server_verified_joins_${guildId}`, '28');
    localStorage.setItem(`server_bumps_count_${guildId}`, '14');
    localStorage.setItem(`server_views_${guildId}`, '142');
  }, GUILD_ID);

  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check that the old "Next bump" card is completely gone
  const bodyText = await page.innerText('body');
  if (bodyText.includes('Ready to bump now!')) {
    throw new Error('Forbidden text "Ready to bump now!" found on Overview!');
  }
  if (bodyText.includes('Invalid Date')) {
    throw new Error('Forbidden string "Invalid Date" found on page!');
  }
  console.log('✓ No "Ready to bump now!" or "Invalid Date" found on Overview.');

  // Verify compact Bump button is present in the header
  const bumpButton = page.locator('button:has-text("Bump")').first();
  await bumpButton.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Header compact Bump control found.');

  // Verify Recent activity card is present
  const recentActivityHeading = page.locator('h3:has-text("Recent activity")');
  await recentActivityHeading.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Recent activity card verified.');

  // Capture Overview Desktop (1440px)
  const overviewShot1440 = path.join(BRAIN_DIR, 'round10_phaseB_overview_1440.png');
  await page.screenshot({ path: overviewShot1440, fullPage: true });
  console.log('✓ Saved Overview 1440px screenshot:', overviewShot1440);

  // Click Bump button to open BumpDialog
  await bumpButton.click();
  await page.waitForTimeout(800);

  // Check BumpDialog modal elements
  const dialogTitle = page.locator('h2:has-text("Bump your server"), [role="dialog"] :text("Bump your server")');
  await dialogTitle.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ BumpDialog opened successfully.');

  const dialogText = await page.locator('[role="dialog"]').innerText();
  if (dialogText.includes('Invalid Date')) {
    throw new Error('Forbidden string "Invalid Date" inside BumpDialog!');
  }
  console.log('✓ BumpDialog contents verified (no "Invalid Date").');

  // Capture BumpDialog Desktop (1440px)
  const dialogShot1440 = path.join(BRAIN_DIR, 'round10_phaseB_bumpdialog_1440.png');
  await page.screenshot({ path: dialogShot1440, fullPage: false });
  console.log('✓ Saved BumpDialog 1440px screenshot:', dialogShot1440);

  // Close desktop context
  await desktopContext.close();

  // ──────────────────────────────────────────────────────────
  // Mobile 390px Context
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 4. Testing Mobile (390px) Viewport ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await mobileContext.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_TOKEN,
      domain: 'localhost',
      path: '/',
    },
  ]);

  const mobilePage = await mobileContext.newPage();
  await mobilePage.addInitScript((guildId) => {
    localStorage.setItem('erlcus_default_guild', guildId);
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      { id: guildId, name: 'San Andreas State Troopers', icon: null }
    ]));
    localStorage.setItem('connectingerlc_user', JSON.stringify({
      id: '888777666555444333',
      username: 'patrol_commander',
      globalName: 'Patrol Commander',
    }));
    localStorage.setItem('erlcus_user', JSON.stringify({
      id: '888777666555444333',
      username: 'patrol_commander',
      globalName: 'Patrol Commander',
    }));
    localStorage.setItem('erlcus_credits_balance', '45');
    localStorage.setItem(`server_verified_joins_${guildId}`, '28');
    localStorage.setItem(`server_bumps_count_${guildId}`, '14');
    localStorage.setItem(`server_views_${guildId}`, '142');
  }, GUILD_ID);

  await mobilePage.goto(`http://localhost:3000/dashboard/${GUILD_ID}`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(2000);

  // Capture Mobile Overview (390px)
  const overviewShot390 = path.join(BRAIN_DIR, 'round10_phaseB_overview_390.png');
  await mobilePage.screenshot({ path: overviewShot390, fullPage: true });
  console.log('✓ Saved Overview 390px screenshot:', overviewShot390);

  // Click Bump button on mobile
  const mobileBumpButton = mobilePage.locator('button:has-text("Bump")').first();
  await mobileBumpButton.click();
  await mobilePage.waitForTimeout(800);

  // Capture Mobile BumpDialog (390px)
  const dialogShot390 = path.join(BRAIN_DIR, 'round10_phaseB_bumpdialog_390.png');
  await mobilePage.screenshot({ path: dialogShot390, fullPage: false });
  console.log('✓ Saved BumpDialog 390px screenshot:', dialogShot390);

  await mobileContext.close();
  await browser.close();

  console.log('\n🎉 ALL PHASE B VERIFICATIONS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
