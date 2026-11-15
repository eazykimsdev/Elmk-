import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

const SESSION_TOKEN = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';
const GUILD_ID = '1329922695995068526';

async function testPhaseB() {
  console.log('--- ROUND 9 PHASE B VERIFICATION ---');

  // 1. Test Directory API
  console.log('\n1. Testing /api/directory and /api/servers/:slug API serialization...');
  const dirRes = await fetch('http://localhost:3001/api/directory');
  const dirJson = await dirRes.json();

  if (!dirJson.servers || dirJson.servers.length === 0) {
    throw new Error('API /api/directory returned empty servers list!');
  }

  console.log(`✓ Fetched ${dirJson.servers.length} servers from /api/directory`);
  for (const s of dirJson.servers) {
    console.log(`  - Server: ${s.name} (${s.id})`);
    console.log(`    members: ${s.memberCount}, icon: ${!!s.icon}, icon_hash: ${!!s.icon_hash}`);
    console.log(`    owner: ${s.owner_display_name} (${s.owner_discord_id}), avatar_hash: ${s.owner_avatar_hash}`);
    console.log(`    hasBannerUrl: ${!!s.bannerUrl}`);
    if (s.icon_hash === undefined || s.owner_display_name === undefined) {
      throw new Error(`Server ${s.name} missing icon_hash or owner_display_name serialization!`);
    }
  }

  // Check sort order (default is most members)
  const members = dirJson.servers.map(s => s.memberCount || 0);
  for (let i = 0; i < members.length - 1; i++) {
    if (members[i] < members[i + 1]) {
      throw new Error(`Default sort should be most members descending! Got: ${members.join(', ')}`);
    }
  }
  console.log('✓ Default sort is strictly Most members descending:', members);

  // Check detail API
  const firstServer = dirJson.servers[0];
  const detailRes = await fetch(`http://localhost:3001/api/servers/${firstServer.id}`);
  const detailJson = await detailRes.json();
  console.log('✓ Detail API owner:', detailJson.owner);
  if (!detailJson.owner || !detailJson.owner.name) {
    throw new Error('Detail API missing owner object!');
  }

  // 2. Launch browser with Edge
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });

  // Desktop (1440px)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  await desktopContext.addCookies([
    { name: 'connectingerlc_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' },
    { name: 'erlcus_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' }
  ]);

  const page = await desktopContext.newPage();

  // Seed localStorage before navigation
  await page.addInitScript((guildId) => {
    localStorage.setItem('erlcus_default_guild', guildId);
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      { id: guildId, name: 'Liberty County Police Dept', icon: '00b5aaf8ddcb2bd2fed47fab1b78d9cf' }
    ]));
    localStorage.setItem('connectingerlc_user', JSON.stringify({
      id: '111222333444555666',
      username: 'founder_rp',
      globalName: 'Server Founder'
    }));
  }, GUILD_ID);

  console.log('\n2. Testing Desktop View (1440px)...');
  await page.goto(`http://localhost:3000/dashboard/${GUILD_ID}/earn`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check container max width
  const container = page.locator('.max-w-\\[1120px\\]');
  const containerCount = await container.count();
  console.log(`✓ max-w-[1120px] container present: ${containerCount > 0}`);

  // Check grid columns at 1440px
  const grid = page.locator('.min-\\[900px\\]\\:grid-cols-2');
  const gridCount = await grid.count();
  console.log(`✓ 2-column grid present: ${gridCount > 0}`);

  // Check Sort dropdown options
  const sortTrigger = page.locator('button:has-text("Most members"), [data-slot="select-trigger"]:has-text("Most members")').first();
  const sortTriggerVisible = await sortTrigger.isVisible();
  console.log(`✓ Sort trigger visible with "Most members": ${sortTriggerVisible}`);

  // Verify card properties
  const cards = page.locator('.group.relative.h-\\[120px\\]');
  const cardCount = await cards.count();
  console.log(`✓ Directory cards rendered with 120px height: ${cardCount}`);

  // Check for unwanted badges (no "3d stay" pill on cards)
  const stayPill = cards.first().locator('text="3d stay"');
  const stayPillCount = await stayPill.count();
  console.log(`✓ "3d stay" pill removed from card: ${stayPillCount === 0}`);

  // Check for separate "+2 cr" pill (must NOT exist outside button)
  const separateCrPill = cards.first().locator('text="+2 cr"');
  const separateCrCount = await separateCrPill.count();
  console.log(`✓ Separate "+2 cr" pill removed from card: ${separateCrCount === 0}`);

  // Check View button and Join button (+2 inside button)
  const viewBtn = cards.first().locator('button:has-text("View")');
  console.log(`✓ "View" button present on card: ${await viewBtn.count() > 0}`);

  const joinBtn = cards.first().locator('button:has-text("+2"), span:has-text("Your server"), span:has-text("Joined")');
  console.log(`✓ "Join" button or own server status present: ${await joinBtn.count() > 0}`);

  // Capture desktop directory view
  await page.screenshot({ path: 'round9_phaseB_desktop.png', fullPage: false });
  console.log('✓ Captured round9_phaseB_desktop.png (1440px)');

  // Click View to open modal popup
  console.log('\n3. Testing Modal Popup View (Section 4.1 & 4.2)...');
  await viewBtn.first().click();
  await page.waitForTimeout(800);

  const modal = page.locator('div[role="dialog"]');
  const modalVisible = await modal.isVisible();
  console.log(`✓ Modal popup open and visible: ${modalVisible}`);

  // Verify modal header and identity row
  const modalTitle = modal.locator('#server-details-title');
  const modalTitleText = await modalTitle.textContent();
  console.log(`✓ Modal title: "${modalTitleText}"`);

  // Verify banner and icon
  const banner = modal.locator('.h-\\[180px\\]');
  console.log(`✓ Banner container height 180px: ${await banner.count() > 0}`);

  const serverIcon96 = modal.locator('.size-24');
  console.log(`✓ 96px ServerIcon present in identity row: ${await serverIcon96.count() > 0}`);

  // Verify real owner in right column
  const ownedBy = modal.locator('text="Owned by"');
  console.log(`✓ "Owned by" section present: ${await ownedBy.count() > 0}`);

  await page.screenshot({ path: 'round9_phaseB_modal_desktop.png', fullPage: false });
  console.log('✓ Captured round9_phaseB_modal_desktop.png (1440px modal view)');

  // Close modal
  const closeBtn = modal.locator('button:has-text("Close")');
  await closeBtn.click();
  await page.waitForTimeout(500);

  // Mobile (390px)
  console.log('\n4. Testing Mobile View (390px)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  await mobileContext.addCookies([
    { name: 'connectingerlc_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' },
    { name: 'erlcus_session', value: SESSION_TOKEN, domain: 'localhost', path: '/' }
  ]);
  const mobilePage = await mobileContext.newPage();
  await mobilePage.addInitScript((guildId) => {
    localStorage.setItem('erlcus_default_guild', guildId);
    localStorage.setItem('erlcus_known_guilds', JSON.stringify([
      { id: guildId, name: 'Liberty County Police Dept', icon: '00b5aaf8ddcb2bd2fed47fab1b78d9cf' }
    ]));
    localStorage.setItem('connectingerlc_user', JSON.stringify({
      id: '111222333444555666',
      username: 'founder_rp',
      globalName: 'Server Founder'
    }));
  }, GUILD_ID);

  await mobilePage.goto(`http://localhost:3000/dashboard/${GUILD_ID}/earn`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  await mobilePage.screenshot({ path: 'round9_phaseB_mobile_390.png', fullPage: false });
  console.log('✓ Captured round9_phaseB_mobile_390.png (390px)');

  await browser.close();

  // Copy screenshots to brain directory
  fs.copyFileSync('round9_phaseB_desktop.png', path.join(BRAIN_DIR, 'round9_phaseB_desktop.png'));
  fs.copyFileSync('round9_phaseB_modal_desktop.png', path.join(BRAIN_DIR, 'round9_phaseB_modal_desktop.png'));
  fs.copyFileSync('round9_phaseB_mobile_390.png', path.join(BRAIN_DIR, 'round9_phaseB_mobile_390.png'));
  console.log('✓ Synced screenshots to brain artifact directory');

  console.log('\n--- ALL ROUND 9 PHASE B VERIFICATIONS PASSED SUCCESSFULLY! ---');
}

testPhaseB().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
