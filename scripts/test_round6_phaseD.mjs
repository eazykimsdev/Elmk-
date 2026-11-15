import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';
const BASE_URL = 'http://localhost:3000';
const GUILD_ID = '1530147023754367006';
const VALID_TOKEN = 'ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function run() {
  console.log('=== RUNNING ROUND 6 PHASE D INTEGRATION TESTS ===\n');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
  });

  const setupMockSession = async (context) => {
    await context.addCookies([
      {
        name: 'erlcus_session',
        value: VALID_TOKEN,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  };

  const setupInitScript = async (page) => {
    await page.addInitScript(() => {
      const mockUser = {
        id: '523693281541095424',
        username: 'eazykims',
        globalName: 'Eazykims',
        avatar: null,
      };
      localStorage.setItem('erlcus_user', JSON.stringify(mockUser));
      localStorage.setItem('erlcus_credits_balance', '150');
      localStorage.setItem(
        'erlcus_known_guilds',
        JSON.stringify([
          {
            id: '1530147023754367006',
            name: 'Discord bot V.2',
            owner: true,
            permissions: '8',
          },
        ])
      );
    });
  };

  // 1440px desktop context
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await setupMockSession(context);
  const page = await context.newPage();
  await setupInitScript(page);

  // ── 1. LEADERBOARD (7.1) ───────────────────────────────────────────
  console.log('--- 1. Testing Leaderboard (7.1) ---');
  await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/leaderboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Check header text & subtitle
  const lbHeader = await page.locator('h1:has-text("Leaderboard")').first().isVisible();
  const lbSubtitle = await page.locator('text=Servers ranked by verified joins in the last 30 days.').first().isVisible();
  console.log('Leaderboard header sentence case:', lbHeader);
  console.log('Leaderboard subtitle verified:', lbSubtitle);

  // Check Category chips (7 categories)
  const categoryChips = ['All', 'Design server', 'Roleplay server', 'Misc', 'COTS', 'Departments', 'Events'];
  for (const cat of categoryChips) {
    const chipVisible = await page.locator(`button:has-text("${cat}")`).first().isVisible();
    console.log(`Category chip "${cat}":`, chipVisible);
  }

  // Check Rank 1 styling (gold text #FBBF24)
  const rank1Cell = page.locator('td.text-\\[\\#FBBF24\\]').first();
  console.log('Rank 1 gold color cell visible:', await rank1Cell.isVisible());

  // Screenshot 1440px Leaderboard
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseD_leaderboard_desktop.png'),
  });
  console.log('Captured round6_phaseD_leaderboard_desktop.png');

  // ── 2. MY JOINS (7.2) ──────────────────────────────────────────────
  console.log('\n--- 2. Testing My joins (7.2) ---');
  await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/joins`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Check slim summary line
  const summaryLine = await page.locator('text=verified').first().isVisible();
  console.log('Slim summary line verified joins button visible:', summaryLine);

  // Check retention explainer button
  const explainerBtn = page.locator('button:has-text("How verified joins work")').first();
  console.log('Retention explainer button visible:', await explainerBtn.isVisible());
  if (await explainerBtn.isVisible()) {
    await explainerBtn.click();
    await page.waitForTimeout(400);
    const explainerCard = await page.locator('text=When you join a server through Mavely').isVisible();
    console.log('Retention explainer card toggled visible:', explainerCard);
  }

  // Test three-dot actions menu
  const actionMenuTrigger = page.locator('button[aria-label="Server actions"]').first();
  if (await actionMenuTrigger.isVisible()) {
    console.log('Clicking three-dot actions menu...');
    await actionMenuTrigger.click();
    await page.waitForTimeout(400);

    const openServerItem = await page.locator('text=Open server').isVisible();
    const leaveServerItem = await page.locator('text=Leave server').isVisible();
    console.log('Action menu "Open server" visible:', openServerItem);
    console.log('Action menu "Leave server" visible:', leaveServerItem);

    // Click Leave server to verify dialog
    if (leaveServerItem) {
      await page.locator('text=Leave server').click();
      await page.waitForTimeout(500);

      const confirmDialog = page.locator('[role="dialog"]');
      console.log('Confirm leave dialog open:', await confirmDialog.isVisible());
      const dialogText = await page.locator('text=Confirming will deduct the').isVisible();
      console.log('Dialog mentions credit deduction:', dialogText);

      // Screenshot leave confirm dialog
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'round6_phaseD_leave_dialog_desktop.png'),
      });
      console.log('Captured round6_phaseD_leave_dialog_desktop.png');

      // Cancel dialog
      await page.locator('button:has-text("Cancel")').first().click();
      await page.waitForTimeout(400);
    }
  }

  // Screenshot 1440px My joins
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseD_my_joins_desktop.png'),
  });
  console.log('Captured round6_phaseD_my_joins_desktop.png');

  // ── 3. PARTNERSHIPS (7.3) ──────────────────────────────────────────
  console.log('\n--- 3. Testing Partnerships (7.3) ---');
  await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/partnerships`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Check Mode Switch in header
  const manualModeBtn = page.locator('button:has-text("Manual approval")').first();
  const autoModeBtn = page.locator('button:has-text("Auto-accept matching")').first();
  console.log('Manual approval button visible:', await manualModeBtn.isVisible());
  console.log('Auto-accept matching button visible:', await autoModeBtn.isVisible());

  // Click Auto-accept to verify subtext
  await autoModeBtn.click();
  await page.waitForTimeout(400);
  const autoSubtext = await page.locator('text=Incoming requests from servers that meet your requirements will be accepted automatically.').isVisible();
  console.log('Auto-accept subtext displayed:', autoSubtext);

  // Check slim summary line with "broadcasts sent this week"
  const broadcastText = await page.locator('text=broadcasts sent this week').first().isVisible();
  console.log('Summary line mentions "broadcasts sent this week":', broadcastText);

  // Check Browse table headers
  const serverCol = await page.locator('th:has-text("Server")').first().isVisible();
  const membersCol = await page.locator('th:has-text("Members")').first().isVisible();
  const mentionsCol = await page.locator('th:has-text("Allowed mentions")').first().isVisible();
  const termsCol = await page.locator('th:has-text("Terms")').first().isVisible();
  console.log('Table columns: Server, Members, Allowed mentions, Terms:', serverCol && membersCol && mentionsCol && termsCol);

  // Screenshot 1440px Partnerships with auto-accept mode active
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseD_partnerships_desktop.png'),
  });
  console.log('Captured round6_phaseD_partnerships_desktop.png');

  // ── 4. CREDIT HISTORY (7.4) ────────────────────────────────────────
  console.log('\n--- 4. Testing Credit history (7.4) ---');
  await page.goto(`${BASE_URL}/dashboard/${GUILD_ID}/history`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Check top 3 stat tiles: Balance (with Store link), Earned, Spent
  const storeLink = await page.locator('button:has-text("Store")').first().isVisible();
  const earnedTile = await page.locator('text=Earned').first().isVisible();
  const spentTile = await page.locator('text=Spent').first().isVisible();
  console.log('Balance tile "Store" link visible:', storeLink);
  console.log('Earned & Spent stat tiles visible:', earnedTile && spentTile);

  // Check Export CSV button
  const csvBtn = page.locator('button:has-text("Export CSV")').first();
  console.log('Export CSV button visible:', await csvBtn.isVisible());

  // Check table columns: Date, Description, Type, Amount, Balance after, Details
  const typeHeader = await page.locator('th:has-text("Type")').first().isVisible();
  const amountHeader = await page.locator('th:has-text("Amount")').first().isVisible();
  const balanceAfterHeader = await page.locator('th:has-text("Balance after")').first().isVisible();
  console.log('Table columns: Type, Amount, Balance after:', typeHeader && amountHeader && balanceAfterHeader);

  // Click first transaction row to open details sheet
  const firstTxRow = page.locator('table tbody tr').first();
  if (await firstTxRow.isVisible()) {
    console.log('Clicking transaction row...');
    await firstTxRow.click();
    await page.waitForTimeout(600);

    const sheet = page.locator('[role="dialog"]').first();
    console.log('Transaction details sheet open:', await sheet.isVisible());
    const txIdText = await page.locator('text=Transaction ID').first().isVisible();
    const ledgerHashText = await page.locator('text=Ledger hash').first().isVisible();
    const timestampText = await page.locator('text=Timestamp').first().isVisible();
    console.log('Sheet contains Transaction ID, Ledger hash, Timestamp:', txIdText && ledgerHashText && timestampText);

    // Screenshot 1440px Credit History with Details sheet
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'round6_phaseD_history_sheet_desktop.png'),
    });
    console.log('Captured round6_phaseD_history_sheet_desktop.png');

    // Close sheet
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Screenshot 1440px Credit History main view
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseD_history_desktop.png'),
  });
  console.log('Captured round6_phaseD_history_desktop.png');

  // ── 5. MOBILE 390px VIEWPORT TESTS ─────────────────────────────────
  console.log('\n--- 5. Mobile 390px Viewport Tests ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  await setupMockSession(mobileContext);
  const mobilePage = await mobileContext.newPage();
  await setupInitScript(mobilePage);

  // Mobile Leaderboard
  await mobilePage.goto(`${BASE_URL}/dashboard/${GUILD_ID}/leaderboard`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(800);
  await mobilePage.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseD_leaderboard_mobile_390.png'),
  });
  console.log('Captured round6_phaseD_leaderboard_mobile_390.png');

  // Mobile My joins
  await mobilePage.goto(`${BASE_URL}/dashboard/${GUILD_ID}/joins`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(800);
  await mobilePage.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseD_my_joins_mobile_390.png'),
  });
  console.log('Captured round6_phaseD_my_joins_mobile_390.png');

  // Mobile Partnerships
  await mobilePage.goto(`${BASE_URL}/dashboard/${GUILD_ID}/partnerships`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(800);
  await mobilePage.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseD_partnerships_mobile_390.png'),
  });
  console.log('Captured round6_phaseD_partnerships_mobile_390.png');

  // Mobile History
  await mobilePage.goto(`${BASE_URL}/dashboard/${GUILD_ID}/history`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(800);
  await mobilePage.screenshot({
    path: path.join(ARTIFACT_DIR, 'round6_phaseD_history_mobile_390.png'),
  });
  console.log('Captured round6_phaseD_history_mobile_390.png');

  await browser.close();
  console.log('\nAll Phase D tests completed successfully!');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
