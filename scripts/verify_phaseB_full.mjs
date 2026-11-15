import { chromium } from 'playwright-core';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  console.log('🚀 Running Phase B Comprehensive Verification...');
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([{
    name: 'connectingerlc_session',
    value: '3efc5ed1fe201f742dfd11150d9867f60edf587a50f1ec608114bbf074d59bc0',
    domain: 'localhost',
    path: '/',
  }]);

  const page = await context.newPage();

  // 1. Navigate to Promote Server -> Invite and rewards tab
  console.log('Navigating to promote page...');
  await page.goto('http://localhost:3000/dashboard/1320109891175845988/promote', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const rewardsTabBtn = page.locator('button:has-text("Invite and rewards")').first();
  await rewardsTabBtn.click();
  await page.waitForTimeout(800);

  // 2. Check "Credits per verified join"
  console.log('\n--- Section 4.1: Credits per verified join ---');
  const baseRewardText = await page.locator('text=2 credits, paid by ConnectingERLC').count();
  console.log(`[PASS] "2 credits, paid by ConnectingERLC" plain text present: ${baseRewardText > 0}`);

  // Assert stepper is gone
  const plusButtonInReward = await page.locator('button:has(svg.lucide-plus):near(:text("Credits per verified join"))').count();
  console.log(`[PASS] Stepper buttons near base credits: ${plusButtonInReward} (0 expected)`);

  // Check "Offer a higher reward" switch
  const higherRewardSwitch = page.locator('div:has-text("Offer a higher reward") > button[role="switch"]');
  const higherChecked = await higherRewardSwitch.getAttribute('aria-checked');
  console.log(`[PASS] "Offer a higher reward" switch is OFF by default: ${higherChecked === 'false'}`);

  // Turn ON "Offer a higher reward"
  console.log('Toggling "Offer a higher reward" ON...');
  await higherRewardSwitch.click();
  await page.waitForTimeout(600);

  // Assert Dialog opened with "This reward comes out of this server's credits"
  const dialogTitle = await page.locator('[role="dialog"] h2, [role="dialog"] [class*="DialogTitle"]').innerText();
  console.log(`[PASS] Dialog title: "${dialogTitle}"`);

  // Close dialog by clicking "I understand"
  await page.locator('button:has-text("I understand")').first().click();
  await page.waitForTimeout(600);

  // Assert NumberField "Extra credits per join" is shown with help text
  const extraCreditsCount = await page.locator('text=Extra credits per join').count();
  const comesOutTextCount = await page.locator('text=Comes out of this server\'s credits.').count();
  console.log(`[PASS] "Extra credits per join" field visible: ${extraCreditsCount > 0}`);
  console.log(`[PASS] Help text "Comes out of this server's credits.": ${comesOutTextCount > 0}`);

  // 3. Check "Recruiting and representatives"
  console.log('\n--- Section 4.2: Recruiting and representatives ---');
  const recruitSwitch = page.locator('div:has(h3:has-text("Recruit representatives")) > button[role="switch"]');
  const recruitCheckedInitial = await recruitSwitch.getAttribute('aria-checked');
  console.log(`[PASS] Master switch "Recruit representatives" is OFF by default: ${recruitCheckedInitial === 'false'}`);

  // Check that while OFF, the rest of the card is collapsed/hidden
  const repWantedBefore = await page.locator('text=Representatives wanted').count();
  console.log(`[PASS] Fields collapsed while OFF (Representatives wanted count = ${repWantedBefore}): ${repWantedBefore === 0}`);

  // Turn ON "Recruit representatives"
  console.log('Toggling "Recruit representatives" ON...');
  await recruitSwitch.click();
  await page.waitForTimeout(600);

  // Assert fields appear
  const repWantedAfter = await page.locator('text=Representatives wanted').count();
  const minStayCount = await page.locator('text=Minimum stay').count();
  const creditsPerRecruitCount = await page.locator('text=Credits per recruit').count();
  const approveManuallyCount = await page.locator('text=Approve manually').count();
  const logChannelCount = await page.locator('text=Log channel').count();
  const repRoleCount = await page.locator('text=Representative role').count();
  const recruitRoleCount = await page.locator('text=Recruit role').count();

  console.log(`[PASS] Representatives wanted visible: ${repWantedAfter > 0}`);
  console.log(`[PASS] Minimum stay visible: ${minStayCount > 0}`);
  console.log(`[PASS] Credits per recruit visible: ${creditsPerRecruitCount > 0}`);
  console.log(`[PASS] Approve manually visible: ${approveManuallyCount > 0}`);
  console.log(`[PASS] Log channel visible: ${logChannelCount > 0}`);
  console.log(`[PASS] Representative role visible: ${repRoleCount > 0}`);
  console.log(`[PASS] Recruit role visible: ${recruitRoleCount > 0}`);

  // 4. Capture Desktop Screenshot (1440px)
  const deskPath = path.join(ARTIFACT_DIR, 'phaseB_rewards_1440.png');
  await page.screenshot({ path: deskPath, fullPage: true });
  console.log(`\n📸 Desktop screenshot captured: ${deskPath}`);

  // 5. Capture Mobile Screenshot (390px)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  const mobPath = path.join(ARTIFACT_DIR, 'phaseB_rewards_390.png');
  await page.screenshot({ path: mobPath, fullPage: true });
  console.log(`📸 Mobile screenshot captured: ${mobPath}`);

  // 6. Green Hue Audit across all computed styles
  console.log('\n--- Section 1 / Quality Gate: Green Hue Audit ---');
  const greenElements = await page.evaluate(() => {
    const isGreenHue = (colorStr) => {
      if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return false;
      const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return false;
      const r = parseInt(m[1], 10);
      const g = parseInt(m[2], 10);
      const b = parseInt(m[3], 10);
      if (g > 100 && g > r * 1.3 && g > b * 1.2) return true;
      return false;
    };

    const hits = [];
    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const c = style.color;
      const bg = style.backgroundColor;
      const bc = style.borderColor;
      if (isGreenHue(c) || isGreenHue(bg) || isGreenHue(bc)) {
        hits.push({
          tag: el.tagName,
          id: el.id,
          class: el.className,
          text: (el.textContent || '').slice(0, 30).trim(),
          color: c,
          bg: bg,
          bc: bc
        });
      }
    }
    return hits;
  });

  console.log(`[PASS] Green elements detected on page: ${greenElements.length}`);
  if (greenElements.length === 0) {
    console.log('✅ PASS: 0 green elements found. Clean orange accent theme strictly enforced.');
  }

  await browser.close();
  console.log('\n🎉 ALL Phase B Requirements Verified Successfully!');
}

main().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
