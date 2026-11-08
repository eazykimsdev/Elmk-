import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const GUILD_ID = '1320109891175845988';
const SESSION_TOKEN = 'round9_phasea_session_token_1793941678769';

async function run() {
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  // ──────────────────────────────────────────────────────────
  // 1. HOME PAGE VERIFICATION & SCREENSHOTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 1. Testing Home Page ---');
  const homeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const homePage = await homeContext.newPage();
  await homePage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await homePage.waitForTimeout(1000);

  const homeTitle = await homePage.textContent('h1');
  console.log('Home Title:', homeTitle);
  if (!homeTitle.includes('Grow your ER:LC community.')) {
    throw new Error(`Unexpected home title: ${homeTitle}`);
  }

  const homeBody = await homePage.innerText('body');
  if (!homeBody.includes('Launching on November 21')) {
    throw new Error('Home page missing "Launching on November 21" dynamic string!');
  }
  if (homeBody.includes('ConnectingERLC Systems') || homeBody.includes('exciting new features')) {
    throw new Error('Home page contains forbidden hype / monospace text!');
  }
  console.log('✓ Home copy & countdown verified.');

  // Home screenshots
  const homeShot1440 = path.join(BRAIN_DIR, 'round10_phaseA_home_1440.png');
  await homePage.screenshot({ path: homeShot1440, fullPage: true });
  console.log('✓ Saved Home 1440px screenshot');

  await homePage.setViewportSize({ width: 390, height: 844 });
  await homePage.waitForTimeout(500);
  const homeShot390 = path.join(BRAIN_DIR, 'round10_phaseA_home_390.png');
  await homePage.screenshot({ path: homeShot390, fullPage: true });
  console.log('✓ Saved Home 390px screenshot');
  await homeContext.close();

  // ──────────────────────────────────────────────────────────
  // 2. LOGIN PAGE PREVIEW VERIFICATION & SCREENSHOTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Login Page Skeleton Preview ---');
  const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const loginPage = await loginContext.newPage();
  await loginPage.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await loginPage.waitForTimeout(1000);

  const loginBody = await loginPage.innerText('body');
  const forbiddenPreviewStrings = [
    'Example RP',
    'Sample Dev Hub',
    'State Patrol Academy',
    'Liberty Event Network',
    'Preview with sample data'
  ];
  for (const s of forbiddenPreviewStrings) {
    if (loginBody.includes(s)) {
      throw new Error(`Forbidden preview string found on /login: "${s}"`);
    }
  }
  console.log('✓ Zero fake preview names or sample data captions on /login.');

  // Check that the slide title shows Directory
  const slideTitle = await loginPage.textContent('text="Directory"');
  console.log('Initial slide title found:', !!slideTitle);

  // Login screenshots
  const loginShot1440 = path.join(BRAIN_DIR, 'round10_phaseA_login_1440.png');
  await loginPage.screenshot({ path: loginShot1440, fullPage: true });
  console.log('✓ Saved Login 1440px screenshot');

  await loginPage.setViewportSize({ width: 390, height: 844 });
  await loginPage.waitForTimeout(500);
  const loginShot390 = path.join(BRAIN_DIR, 'round10_phaseA_login_390.png');
  await loginPage.screenshot({ path: loginShot390, fullPage: true });
  console.log('✓ Saved Login 390px screenshot');
  await loginContext.close();

  // ──────────────────────────────────────────────────────────
  // 3. BOT MANAGEMENT TAB VERIFICATION & SCREENSHOTS
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Bot Management Tab ---');
  const botContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await botContext.addCookies([
    {
      name: 'connectingerlc_session',
      value: SESSION_TOKEN,
      domain: 'localhost',
      path: '/'
    }
  ]);
  const botPage = await botContext.newPage();

  await botPage.addInitScript((guildId) => {
    localStorage.setItem('erlcus_default_guild', guildId);
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      { id: guildId, name: 'Alabama State Roleplay', icon: null }
    ]));
    localStorage.setItem('connectingerlc_user', JSON.stringify({
      id: '888777666555444333',
      username: 'generic_community_owner',
      globalName: 'Generic Owner'
    }));
    localStorage.setItem('erlcus_user', JSON.stringify({
      id: '888777666555444333',
      username: 'generic_community_owner',
      globalName: 'Generic Owner'
    }));
  }, GUILD_ID);

  await botPage.goto(`http://localhost:3000/dashboard/${GUILD_ID}/bot`, { waitUntil: 'domcontentloaded' });
  await botPage.waitForTimeout(2000);

  console.log('Bot page URL:', botPage.url());
  const botBody = await botPage.innerText('body');
  const forbiddenBotModules = ['Staff shifts', 'Applications', 'Departments', 'Infractions', 'Ticket system'];
  for (const mod of forbiddenBotModules) {
    if (botBody.includes(mod)) {
      throw new Error(`Forbidden bot module found in BotManagementTab: "${mod}"`);
    }
  }
  console.log('✓ All obsolete bot modules confirmed removed from Bot setup.');

  if (!botBody.includes('Required bot permissions') || !botBody.includes('ER:LC connection')) {
    throw new Error('Bot setup is missing status/permissions or ER:LC tabs!');
  }
  console.log('✓ Bot setup status, permissions checklist, and ER:LC connection verified.');

  // Bot screenshots
  const botShot1440 = path.join(BRAIN_DIR, 'round10_phaseA_bot_1440.png');
  await botPage.screenshot({ path: botShot1440, fullPage: true });
  console.log('✓ Saved Bot Setup 1440px screenshot');

  await botPage.setViewportSize({ width: 390, height: 844 });
  await botPage.waitForTimeout(500);
  const botShot390 = path.join(BRAIN_DIR, 'round10_phaseA_bot_390.png');
  await botPage.screenshot({ path: botShot390, fullPage: true });
  console.log('✓ Saved Bot Setup 390px screenshot');
  await botContext.close();

  await browser.close();
  console.log('\n=============================================');
  console.log('ALL PHASE A VERIFICATIONS PASSED 100%!');
  console.log('=============================================');
}

run().catch(err => {
  console.error('Phase A verification failed:', err);
  process.exit(1);
});
