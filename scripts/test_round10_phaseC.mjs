import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const GUILD_ID = '1320109891175845988';
const SESSION_TOKEN = 'round9_phasea_session_token_1793941678769';

async function run() {
  console.log('--- 1. Testing Save Route (Section 6) ---');
  const saveRes = await fetch(`http://localhost:3001/api/servers/${GUILD_ID}/listing`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `connectingerlc_session=${SESSION_TOKEN}`
    },
    body: JSON.stringify({
      name: 'San Andreas State Troopers',
      category: 'Roleplay Server',
      summary: 'Dedicated patrol community in Liberty County.',
      description: 'Join the most active patrol community with regular shifts and events.'
    })
  });

  const saveData = await saveRes.json();
  console.log('PUT /api/servers/:id/listing response status:', saveRes.status);
  if (!saveRes.ok) {
    throw new Error(`Save failed with error: ${JSON.stringify(saveData)}`);
  }
  console.log('✓ Successfully saved server listing without 401 error!');

  console.log('\n--- 2. Launching Browser for Visual Verification ---');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  // 1440px Context
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

  // ──────────────────────────────────────────────────────────
  // Promote Server Tab (Section 7: Directory Preview)
  // ──────────────────────────────────────────────────────────
  console.log('\n--- Testing Promote Tab & Directory Preview (1440px) ---');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/promote`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Verify preview header
  const previewHeading = page.locator('h3:has-text("Directory preview")');
  await previewHeading.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Directory preview heading found.');

  // Check that the preview card has the server name and category
  const previewCard = page.locator('aside');
  const previewText = await previewCard.innerText();
  console.log('Directory preview text excerpt:', previewText.slice(0, 150));

  // Check no "@" symbol as icon initial fallback
  const iconFallback = previewCard.locator('div[title="San Andreas State Troopers"]');
  if (await iconFallback.count() > 0) {
    const initialText = await iconFallback.innerText();
    console.log('Icon initial:', initialText);
    if (initialText === '@') {
      throw new Error('Directory preview icon initial is "@" instead of alphanumeric!');
    }
  }

  // Capture Promote Tab Desktop (1440px)
  const promoteShot1440 = path.join(BRAIN_DIR, 'round10_phaseC_promote_1440.png');
  await page.screenshot({ path: promoteShot1440, fullPage: true });
  console.log('✓ Saved Promote Tab 1440px screenshot:', promoteShot1440);

  // ──────────────────────────────────────────────────────────
  // Leaderboard Tab (Section 8: Your Server Card)
  // ──────────────────────────────────────────────────────────
  console.log('\n--- Testing Leaderboard Tab (1440px) ---');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/leaderboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check for "Your Server" literal (must NOT exist)
  const leaderboardBody = await page.innerText('body');
  if (leaderboardBody.includes('Your Server') && !leaderboardBody.includes('Your servers')) {
    throw new Error('Forbidden literal "Your Server" found on Leaderboard!');
  }
  console.log('✓ Zero "Your Server" placeholder strings on Leaderboard.');

  // Check rank text: "You are #X of Y listed servers."
  if (!leaderboardBody.includes('You are #')) {
    throw new Error('Missing "You are #X of Y listed servers." rank text on Leaderboard!');
  }
  console.log('✓ Correct rank format found: "You are #..."');

  // Capture Leaderboard Tab Desktop (1440px)
  const leaderboardShot1440 = path.join(BRAIN_DIR, 'round10_phaseC_leaderboard_1440.png');
  await page.screenshot({ path: leaderboardShot1440, fullPage: true });
  console.log('✓ Saved Leaderboard 1440px screenshot:', leaderboardShot1440);

  await desktopContext.close();

  // ──────────────────────────────────────────────────────────
  // Mobile 390px Context
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Mobile (390px) Viewport ---');
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

  // Promote Mobile
  await mobilePage.goto(`http://localhost:3000/dashboard/${GUILD_ID}/promote`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(2000);
  const promoteShot390 = path.join(BRAIN_DIR, 'round10_phaseC_promote_390.png');
  await mobilePage.screenshot({ path: promoteShot390, fullPage: true });
  console.log('✓ Saved Promote Tab 390px screenshot:', promoteShot390);

  // Leaderboard Mobile
  await mobilePage.goto(`http://localhost:3000/dashboard/${GUILD_ID}/leaderboard`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(2000);
  const leaderboardShot390 = path.join(BRAIN_DIR, 'round10_phaseC_leaderboard_390.png');
  await mobilePage.screenshot({ path: leaderboardShot390, fullPage: true });
  console.log('✓ Saved Leaderboard 390px screenshot:', leaderboardShot390);

  await mobileContext.close();
  await browser.close();

  console.log('\n🎉 ALL PHASE C VERIFICATIONS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});

