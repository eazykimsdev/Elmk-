const { chromium } = require('playwright-core');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function capture() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // Set logged in user & workspace state
  await page.addInitScript(() => {
    const mockUser = {
      id: '123456789012345678',
      username: 'eazykims',
      globalName: 'Eazykims',
      avatar: 'b8134a63'
    };
    localStorage.setItem('mavely_user', JSON.stringify(mockUser));
    localStorage.setItem('erlcus_user', JSON.stringify(mockUser));
    
    const mockGuilds = [
      {
        id: '1530147023754367006',
        name: 'Liberty County Roleplay',
        icon: null,
        owner: true,
        permissions: '8',
        features: [],
        approximateMemberCount: 1420
      }
    ];
    localStorage.setItem('erlcus_known_guilds', JSON.stringify(mockGuilds));
    
    // Config for Liberty County RP
    const mockConfig = {
      serverName: 'Liberty County Roleplay',
      serverCategory: 'Roleplay server',
      serverDescription: 'Official ER:LC roleplay community with daily supervised shifts, department sub-divisions, custom liveries and active civilian roleplay.',
      serverTags: 'roleplay, police, active, erlc',
      inviteUrl: 'https://discord.gg/liberty-county',
      joinCode: 'PRLC-102',
      bountiesClaimed: 14,
      lastBumpedAt: Date.now() - (3600 * 1000 * 2) // 2h ago
    };
    localStorage.setItem('erlcus_customizations_1530147023754367006', JSON.stringify(mockConfig));
    
    // Directory listings for Earn credits
    const mockDirectory = [
      {
        id: '1530147023754367006',
        name: 'Liberty County Roleplay',
        icon: null,
        category: 'Roleplay server',
        description: 'Official ER:LC roleplay community with daily supervised shifts, department sub-divisions and active civilian roleplay.',
        tags: ['roleplay', 'police', 'erlc'],
        rewardCoins: 2,
        inviteUrl: 'https://discord.gg/liberty-county',
        memberCount: 1420,
        lastBumpedAt: Date.now() - 3600000,
        verified: true
      },
      {
        id: '223456789012345679',
        name: 'Riverdale Police Department',
        icon: null,
        category: 'Departments',
        description: 'Specialized state police and sheriff patrol operations. Regular trainings, certifications, and realistic dispatch.',
        tags: ['departments', 'law-enforcement', 'patrol'],
        rewardCoins: 2,
        inviteUrl: 'https://discord.gg/riverdale-pd',
        memberCount: 890,
        lastBumpedAt: Date.now() - 7200000,
        verified: false
      },
      {
        id: '323456789012345680',
        name: 'Aero Livery Design Studio',
        icon: null,
        category: 'Design server',
        description: 'High-fidelity vehicle liveries, uniform templates, and custom UI design for ER:LC roleplay communities.',
        tags: ['design', 'liveries', 'assets'],
        rewardCoins: 2,
        inviteUrl: 'https://discord.gg/aero-design',
        memberCount: 650,
        lastBumpedAt: Date.now() - 14400000,
        verified: false
      }
    ];
    localStorage.setItem('erlcus_promoted_servers', JSON.stringify(mockDirectory));
  });

  // 1. Server Details page
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/details', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase2_server_details_desktop.png'), fullPage: false });

  // 2. Promote Server page
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/promote', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase2_promote_desktop.png'), fullPage: false });

  // 3. Earn Credits page
  await page.goto('http://localhost:3000/dashboard/1530147023754367006/earn', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase2_earn_desktop.png'), fullPage: false });

  // 4. Public Server page (/s/1530147023754367006)
  await page.goto('http://localhost:3000/s/1530147023754367006', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase2_public_slug_desktop.png'), fullPage: false });

  await browser.close();
  console.log('Phase 2 screenshots captured successfully.');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
