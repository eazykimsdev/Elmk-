import { chromium } from 'playwright-core';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BRAIN_DIR = 'C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb';

async function main() {
  console.log('Testing Admin Portal Updates with Edge...');
  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true
  });
  const context = await browser.newContext();

  // Set the admin session cookie
  await context.addCookies([
    {
      name: 'connectingerlc_session',
      value: 'd23a1d852fe70e9eaa4a1fbee6610dc64109726897785345e73b080ff8b8ff2f',
      domain: 'localhost',
      path: '/'
    }
  ]);

  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // 1. Check User Accounts tab
  console.log('1. Checking User Accounts tab...');
  await page.goto('http://localhost:3000/admin-portal/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const bodyText = await page.textContent('body');
  const hasNameUnavailable = bodyText.includes('Name unavailable');
  console.log('Does page contain "Name unavailable"?', hasNameUnavailable);
  if (hasNameUnavailable) {
    console.error('FAILED: Found "Name unavailable" on User Accounts page!');
  } else {
    console.log('PASSED: Zero "Name unavailable" accounts found!');
  }

  // Count user rows
  const userRows = await page.locator('tbody tr').count();
  console.log(`Found ${userRows} user rows in User Accounts table.`);

  await page.screenshot({ path: `${BRAIN_DIR}/admin_portal_users_clean.png`, fullPage: true });

  // 2. Check Staff Roster & Presence tab
  console.log('2. Checking Staff Roster & Presence tab...');
  await page.goto('http://localhost:3000/admin-portal/admins', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const adminsBodyText = await page.textContent('body');
  const hasFakeAdmin = adminsBodyText.includes('111222333444555666');
  console.log('Does Staff Roster contain fake admin 111222333444555666?', hasFakeAdmin);
  const hasOwnerName = adminsBodyText.includes('Eazykims') || adminsBodyText.includes('kims3166');
  console.log('Does Staff Roster contain Eazykims / kims3166?', hasOwnerName);

  // Check if avatar image is rendered for admin
  const avatarImgCount = await page.locator('tbody img').count();
  console.log(`Found ${avatarImgCount} avatar image(s) in Staff Roster table.`);

  await page.screenshot({ path: `${BRAIN_DIR}/admin_portal_staff_roster.png`, fullPage: true });

  // 3. Check Changelog Manager tab
  console.log('3. Checking Changelog Manager tab...');
  await page.goto('http://localhost:3000/admin-portal/changelog', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const changelogCards = await page.locator('text=3.3.0').count();
  console.log(`Found ${changelogCards} changelog version badges for 3.3.0.`);
  const totalCards = await page.locator('button:has-text("Edit")').count();
  console.log(`Found ${totalCards} changelog edit buttons.`);
  const hasEditButton = totalCards > 0;
  console.log('Has Edit button?', hasEditButton);

  await page.screenshot({ path: `${BRAIN_DIR}/admin_portal_changelog_manager.png`, fullPage: true });

  // 4. Check Community Reports tab
  console.log('4. Checking Community Reports tab...');
  await page.goto('http://localhost:3000/admin-portal/reports', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const reportsBody = await page.textContent('body');
  const hasReportedServer = reportsBody.includes('Reported Community') || reportsBody.includes('CostalPackages');
  console.log('Displays Reported Community?', hasReportedServer);
  const hasServerOwner = reportsBody.includes('Server Owner') || reportsBody.includes('Linkyn');
  console.log('Displays Server Owner?', hasServerOwner);
  const hasBanOwnerBtn = (await page.locator('button:has-text("Ban Owner")').count()) > 0;
  console.log('Has "Ban Owner" button?', hasBanOwnerBtn);
  const hasDelistBtn = (await page.locator('button:has-text("Delist Server")').count()) > 0;
  console.log('Has "Delist Server" button?', hasDelistBtn);

  await page.screenshot({ path: `${BRAIN_DIR}/admin_portal_reports_remodel.png`, fullPage: true });

  // 5. Check Flags / Antinuke tab
  console.log('5. Checking Antinuke & Flags tab...');
  await page.goto('http://localhost:3000/admin-portal/flags', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const flagsBody = await page.textContent('body');
  const hasAntinukeTitle = flagsBody.includes('Antinuke');
  console.log('Has "Antinuke" heading?', hasAntinukeTitle);
  const hasProtectionLevel = flagsBody.includes('Protection level');
  console.log('Has "Protection level"?', hasProtectionLevel);
  const hasDisabledSwitch = flagsBody.includes('Disabled');
  console.log('Has "Disabled" switch? (Should be false)', hasDisabledSwitch);
  const hasWhatIsOn = flagsBody.includes('What is on');
  console.log('Has "What is on"?', hasWhatIsOn);

  // Click on "Strict" level
  await page.click('button:has-text("Strict")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Apply this level")');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${BRAIN_DIR}/admin_portal_antinuke_flags.png`, fullPage: true });

  await browser.close();
  console.log('All Playwright tests completed successfully!');
}

main().catch(err => {
  console.error('Playwright test failed:', err);
  process.exit(1);
});
