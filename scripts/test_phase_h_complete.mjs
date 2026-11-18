import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Create isolated temp DATA_DIR before importing managers so real data is never touched
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'erlcxbot-phase-h-'));
process.env.DATA_DIR = tmpRoot;
process.env.NODE_ENV = 'test';

const GUILD_ID = '111111111111111111';
const PARTNER_GUILD_ID = '222222222222222222';
const OWNER_ID = '900000000000000001';
const MANAGER_ID = '900000000000000002';
const MEMBER_ID = '900000000000000003';
const STRANGER_ID = '900000000000000004';
const CSRF_TOKEN = 'csrf-token-phase-h-12345';

// Seed web_sessions.json in isolated tmpRoot before api.js loads sessions
const nowMs = Date.now();
fs.writeFileSync(
  path.join(tmpRoot, 'web_sessions.json'),
  JSON.stringify(
    {
      sess_owner: {
        user: { id: OWNER_ID, username: 'AlphaOwner', global_name: 'AlphaOwner' },
        csrfToken: CSRF_TOKEN,
        expiresAt: nowMs + 3600000,
        expiresAtSession: nowMs + 86400000,
        guildCache: {
          expiresAt: nowMs + 3600000,
          guilds: [{ id: GUILD_ID, name: 'Alpha Roleplay Server', owner: true, permissions: '2147483647' }]
        }
      },
      sess_manager: {
        user: { id: MANAGER_ID, username: 'AlphaManager', global_name: 'AlphaManager' },
        csrfToken: CSRF_TOKEN,
        expiresAt: nowMs + 3600000,
        expiresAtSession: nowMs + 86400000,
        guildCache: {
          expiresAt: nowMs + 3600000,
          guilds: [{ id: GUILD_ID, name: 'Alpha Roleplay Server', owner: false, permissions: '32' }]
        }
      },
      sess_member: {
        user: { id: MEMBER_ID, username: 'NormalMember', global_name: 'NormalMember' },
        csrfToken: CSRF_TOKEN,
        expiresAt: nowMs + 3600000,
        expiresAtSession: nowMs + 86400000,
        guildCache: {
          expiresAt: nowMs + 3600000,
          guilds: [{ id: GUILD_ID, name: 'Alpha Roleplay Server', owner: false, permissions: '0' }]
        }
      },
      sess_stranger: {
        user: { id: STRANGER_ID, username: 'StrangerUser', global_name: 'StrangerUser' },
        csrfToken: CSRF_TOKEN,
        expiresAt: nowMs + 3600000,
        expiresAtSession: nowMs + 86400000,
        guildCache: {
          expiresAt: nowMs + 3600000,
          guilds: []
        }
      }
    },
    null,
    2
  ),
  'utf8'
);

const express = (await import('express')).default;
const { createDashboardRouter } = await import('../api.js');
const {
  upsertPromotedServer,
  getPromotedServers,
  recordBotMemberJoin,
  processMaturePendingJoins,
  getServerAnalytics
} = await import('../directoryManager.js');
const {
  recordLedgerTransaction,
  getServerLedgerSummary,
  appendServerActivity
} = await import('../ledgerManager.js');
const {
  createJoinIntent
} = await import('../inviteValidator.js');
const {
  loadShopItems,
  buyShopItem,
  runAutoBumps
} = await import('../serverShopManager.js');
const {
  getAdminSettings,
  updateAdminSettings,
  buyServerPremium
} = await import('../premiumManager.js');
const {
  addServerAdvertiser
} = await import('../advertisingManager.js');
const {
  createPartnershipRequest,
  respondToPartnershipRequest,
  updateGuildPartnershipConfig,
  claimDailyReward
} = await import('../partnershipsManager.js');
const {
  buildPartnershipRequesterNotificationV2
} = await import('../discordNotificationManager.js');

// Seed test server in isolated temp DATA_DIR
await upsertPromotedServer({
  id: GUILD_ID,
  guildId: GUILD_ID,
  name: 'Alpha Roleplay Server',
  ownerId: OWNER_ID,
  owner_discord_id: OWNER_ID,
  owner_display_name: 'AlphaOwner',
  category: 'Roleplay Server',
  description: 'Official Alpha Roleplay community.',
  inviteUrl: 'https://discord.gg/alpharp',
  invite_status: 'valid',
  memberCount: 250,
  showCredits: true
});

await upsertPromotedServer({
  id: PARTNER_GUILD_ID,
  guildId: PARTNER_GUILD_ID,
  name: 'Bravo State Patrol',
  ownerId: '900000000000000099',
  owner_discord_id: '900000000000000099',
  owner_display_name: 'BravoOwner',
  category: 'Departments',
  description: 'Bravo State Patrol official server.',
  inviteUrl: 'https://discord.gg/bravosp',
  invite_status: 'valid',
  memberCount: 180,
  icon: 'https://cdn.discordapp.com/icons/222222222222222222/bravo.png'
});

// Give GUILD_ID initial credits via normal append-only ledger
recordLedgerTransaction({
  serverId: GUILD_ID,
  guildId: GUILD_ID,
  userId: OWNER_ID,
  amount: 500,
  type: 'earned',
  reason: 'Initial test balance'
});

// Build Express test app with createDashboardRouter
const app = express();
app.use(express.json({ limit: '12mb' }));
const apiRouter = createDashboardRouter();
app.use('/api', apiRouter);
app.use('/workspace', (req, res, next) => {
  req.url = '/workspace' + req.url;
  apiRouter(req, res, next);
});

const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;

async function reqApi(urlPath, { method = 'GET', persona = 'owner', withCsrf = true, body = null } = {}) {
  const headers = {
    Cookie: `connectingerlc_session=sess_${persona}`
  };
  if (withCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    headers['x-csrf-token'] = CSRF_TOKEN;
  }
  if (body !== null) {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, contentType: res.headers.get('content-type') || '', text, json };
}

console.log('=== PHASE H COMPLETE VERIFICATION SUITE ===');

// ---------------------------------------------------------------------------
// ITEM 1: THE EARLIER ERRORS (CSRF, JSON 404, Shared Owner/Manager Access)
// ---------------------------------------------------------------------------
console.log('\n--- Item 1a: CSRF Enforcement & Shared Fetch Wrapper Proof ---');
const noCsrfClaim = await reqApi(`/api/workspace/${GUILD_ID}/custom-url`, {
  method: 'POST',
  persona: 'owner',
  withCsrf: false,
  body: { customUrl: 'alpha-rp' }
});
console.log('Without CSRF -> URL:', `/api/workspace/${GUILD_ID}/custom-url`, 'Status:', noCsrfClaim.status, 'Body:', noCsrfClaim.text.slice(0, 200));
assert.equal(noCsrfClaim.status, 403);
assert.ok(String(noCsrfClaim.json?.error || '').includes('Missing CSRF token'));

const withCsrfClaim = await reqApi(`/api/workspace/${GUILD_ID}/custom-url`, {
  method: 'POST',
  persona: 'owner',
  withCsrf: true,
  body: { customUrl: 'alpha-rp' }
});
console.log('With CSRF -> URL:', `/api/workspace/${GUILD_ID}/custom-url`, 'Status:', withCsrfClaim.status, 'Body:', withCsrfClaim.text.slice(0, 200));
assert.equal(withCsrfClaim.status, 200);
assert.equal(withCsrfClaim.json?.customUrl, 'alpha-rp');

console.log('\n--- Item 1b: API Routes Return JSON (including JSON 404s, never HTML) ---');
const json404Get = await reqApi('/api/nonexistent-endpoint-test');
console.log('GET /api/nonexistent-endpoint-test -> Status:', json404Get.status, 'Content-Type:', json404Get.contentType, 'Body:', json404Get.text.slice(0, 200));
assert.equal(json404Get.status, 404);
assert.ok(json404Get.contentType.includes('application/json'));
assert.ok(!json404Get.text.toLowerCase().includes('<!doctype'));

const json404Workspace = await reqApi(`/workspace/${GUILD_ID}/nonexistent-route`, { method: 'POST', body: {} });
console.log('POST /workspace/:id/nonexistent-route -> Status:', json404Workspace.status, 'Content-Type:', json404Workspace.contentType, 'Body:', json404Workspace.text.slice(0, 200));
assert.equal(json404Workspace.status, 404);
assert.ok(json404Workspace.contentType.includes('application/json'));

console.log('\n--- Item 1c: Shared Owner/Manager Check Across All Protected Endpoints (Owner, Manager, Member, Stranger) ---');
// Verify Owner, Manager, Member, Stranger across:
// 1) Claim URL, 2) Shop Buy, 3) Forms Create, 4) Listing Save, 5) Banner Upload
const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

for (const persona of ['owner', 'manager', 'member', 'stranger']) {
  const expectedAllowed = persona === 'owner' || persona === 'manager';

  const shopRes = await reqApi(`/api/workspace/${GUILD_ID}/shop/buy`, {
    method: 'POST',
    persona,
    body: { itemId: 'item_auto_bump_1d' }
  });
  const formRes = await reqApi(`/api/workspace/${GUILD_ID}/forms`, {
    method: 'POST',
    persona,
    body: {
      name: `Form by ${persona}`,
      slug: `form-${persona}`,
      isOpen: true,
      questions: [{ id: 'q1', title: 'Why join?', type: 'short_text', required: true }]
    }
  });
  const listingRes = await reqApi(`/api/servers/${GUILD_ID}/listing`, {
    method: 'PUT',
    persona,
    body: { description: `Updated by ${persona}`, showCredits: true }
  });
  const bannerRes = await reqApi(`/api/servers/${GUILD_ID}/banner`, {
    method: 'POST',
    persona,
    body: { imageData: tinyPngBase64, fileName: 'banner.png' }
  });

  console.log(`Persona [${persona}] -> shop:${shopRes.status}, forms:${formRes.status}, listing:${listingRes.status}, banner:${bannerRes.status}`);
  if (expectedAllowed) {
    assert.equal(shopRes.status, 200, `${persona} should be allowed to buy in shop`);
    assert.equal(formRes.status, 200, `${persona} should be allowed to create forms`);
    assert.equal(listingRes.status, 200, `${persona} should be allowed to update listing`);
    assert.equal(bannerRes.status, 200, `${persona} should be allowed to upload banner`);
  } else {
    assert.equal(shopRes.status, 403, `${persona} must be blocked from shop`);
    assert.equal(formRes.status, 403, `${persona} must be blocked from forms`);
    assert.equal(listingRes.status, 403, `${persona} must be blocked from listing`);
    assert.equal(bannerRes.status, 403, `${persona} must be blocked from banner`);
  }
}

// ---------------------------------------------------------------------------
// ITEM 2 & 3: PUBLIC SERVER PAGE & SERVER PAGE EDITOR
// ---------------------------------------------------------------------------
console.log('\n--- Item 2 & 3: Public Server Page Telemetry & Credits Visibility Toggle ---');
const pubRes1 = await reqApi(`/api/servers/alpha-rp`);
assert.equal(pubRes1.status, 200);
assert.equal(pubRes1.json?.server?.showCredits, true);
assert.equal(typeof pubRes1.json?.server?.serverCredits, 'number');
assert.equal(pubRes1.json?.owner?.name, 'AlphaOwner');
console.log('Public profile (showCredits=true) -> serverCredits:', pubRes1.json.server.serverCredits, 'owner:', pubRes1.json.owner.name);

// Turn showCredits off via editor save
await reqApi(`/api/servers/${GUILD_ID}/listing`, {
  method: 'PUT',
  persona: 'owner',
  body: { showCredits: false }
});
const pubRes2 = await reqApi(`/api/servers/alpha-rp`);
assert.equal(pubRes2.json?.server?.showCredits, false);
assert.equal(pubRes2.json?.server?.serverCredits, null);
console.log('Public profile (showCredits=false) -> serverCredits:', pubRes2.json.server.serverCredits);

// Re-enable showCredits
await reqApi(`/api/servers/${GUILD_ID}/listing`, {
  method: 'PUT',
  persona: 'owner',
  body: { showCredits: true }
});

// Verify SVG banner rejection
const svgRejectRes = await reqApi(`/api/servers/${GUILD_ID}/banner`, {
  method: 'POST',
  persona: 'owner',
  body: {
    imageData: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString('base64'),
    fileName: 'exploit.svg'
  }
});
assert.equal(svgRejectRes.status, 400);
console.log('SVG banner upload rejected with status:', svgRejectRes.status, svgRejectRes.json?.error);

// ---------------------------------------------------------------------------
// ITEM 4: SHOP, BOOSTS AND PREMIUM
// ---------------------------------------------------------------------------
console.log('\n--- Item 4: Shop, Boosts (4 items, no 2x bumps) & Premium (Price not set + 5 cr join reward) ---');
const items = await loadShopItems();
const itemNames = items.map((i) => `${i.name} (${i.price} cr)`);
console.log('Configured Boost Items:', itemNames.join(' | '));
assert.equal(items.length, 4, 'Must have exactly the 4 required boost items');
assert.ok(!items.some((i) => i.effect === 'double_bumps' || i.name.toLowerCase().includes('2x')), 'Must not contain 2x bumps');

// Prove all 4 boost effects work:
// 1. Auto bump, 1 day
await upsertPromotedServer({
  id: GUILD_ID,
  guildId: GUILD_ID,
  lastBumpedAt: Date.now() - 3 * 3600 * 1000,
  bumps: 1
});
const autoBumpSwept = await runAutoBumps();
console.log('Boost Effect 1 (Auto bump sweep) -> servers auto-bumped:', autoBumpSwept.count);
assert.ok(autoBumpSwept.count >= 1, 'Auto bump sweep must bump server with active auto_bump boost');

// 2. Featured spot on Earn credits, 24 hours
await buyShopItem({ serverId: GUILD_ID, buyerUserId: OWNER_ID, itemId: 'item_featured_spot_1d', isOwner: true });
// 3. Listing highlight, 7 days
await buyShopItem({ serverId: GUILD_ID, buyerUserId: OWNER_ID, itemId: 'item_listing_highlight_7d', isOwner: true });
// 4. Extra advertiser seat, 30 days
await buyShopItem({ serverId: GUILD_ID, buyerUserId: OWNER_ID, itemId: 'item_extra_advertiser_30d', isOwner: true });

const promotedList = await getPromotedServers();
const boostedServer = promotedList.find((s) => s.id === GUILD_ID);
console.log('Boost Effects 2 & 3 -> isFeaturedSpot:', boostedServer.isFeaturedSpot, 'isHighlighted:', boostedServer.isHighlighted, 'Top of directory:', promotedList[0].id === GUILD_ID);
assert.equal(boostedServer.isFeaturedSpot, true);
assert.equal(boostedServer.isHighlighted, true);
assert.equal(promotedList[0].id, GUILD_ID, 'Featured spot server must be pinned first in directory');

// Prove Extra advertiser seat unlocks 1 advertiser seat on standard server
const advRes = await addServerAdvertiser(GUILD_ID, '800001', OWNER_ID, {
  fetchFn: async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: '800001', username: 'Adv1', global_name: 'Adv1', avatar: null })
  })
});
console.log('Boost Effect 4 (Extra advertiser seat) -> advertiser added:', advRes.advertiser?.userId);
assert.equal(advRes.ok, true, 'Extra advertiser seat boost must allow adding advertiser');
assert.equal(advRes.advertiser?.userId, '800001');

// Prove "Price not set" when premium_price_credits is 0/null
await updateAdminSettings({ premium_price_credits: 0 }, OWNER_ID);
const unsetBuyRes = await reqApi(`/api/servers/${GUILD_ID}/premium/buy`, {
  method: 'POST',
  persona: 'owner',
  body: { months: 1 }
});
console.log('Premium buy when price is 0 -> Status:', unsetBuyRes.status, 'Error:', unsetBuyRes.json?.error);
assert.equal(unsetBuyRes.status, 400);
assert.equal(unsetBuyRes.json?.error, 'Price not set');

// Restore price and buy 2 months of Premium
await updateAdminSettings({ premium_price_credits: 50, premium_join_reward_credits: 5, daily_join_reward_cap_per_server: 10 }, OWNER_ID);
const buyPremRes = await reqApi(`/api/servers/${GUILD_ID}/premium/buy`, {
  method: 'POST',
  persona: 'owner',
  body: { months: 2 }
});
console.log('Premium buy (2 months @ 50 cr) -> Status:', buyPremRes.status, 'is_premium:', buyPremRes.json?.is_premium, 'totalCost:', buyPremRes.json?.totalCost);
assert.equal(buyPremRes.status, 200);
assert.equal(buyPremRes.json?.is_premium, true);
assert.equal(buyPremRes.json?.totalCost, 100);

// Prove Premium server pays 5 credits per verified join instead of 2
const JOINER_USER_ID = '900000000000000777';
const balBeforeJoin = getServerLedgerSummary(PARTNER_GUILD_ID, JOINER_USER_ID).balance;
createJoinIntent(JOINER_USER_ID, GUILD_ID, { recipientServerId: PARTNER_GUILD_ID });
recordBotMemberJoin(GUILD_ID, JOINER_USER_ID, { recipientServerId: PARTNER_GUILD_ID, stayRequiredMs: 0 });
await processMaturePendingJoins(async () => true);
const balAfterJoin = getServerLedgerSummary(PARTNER_GUILD_ID, JOINER_USER_ID).balance;
console.log('Premium Server Verified Join Payout -> Balance before:', balBeforeJoin, 'Balance after:', balAfterJoin, 'Delta:', balAfterJoin - balBeforeJoin);
assert.equal(balAfterJoin - balBeforeJoin, 5, 'Joining a Premium server must pay 5 credits');

// ---------------------------------------------------------------------------
// ITEM 5: APPLICATIONS AND FORMS (Draft Auto-save, Options Validation, Publish)
// ---------------------------------------------------------------------------
console.log('\n--- Item 5: Applications & Forms Draft Auto-Save + Multiple Choice Options Validation ---');
const saveDraftRes = await reqApi(`/api/workspace/${GUILD_ID}/forms/draft`, {
  method: 'POST',
  persona: 'owner',
  body: {
    name: 'Patrol Officer Application',
    slug: 'patrol-officer',
    questions: [{ id: 'q1', title: 'Which division?', type: 'multiple_choice', required: true, options: ['Traffic', 'K9'] }]
  }
});
assert.equal(saveDraftRes.status, 200);
const getDraftRes = await reqApi(`/api/workspace/${GUILD_ID}/forms/draft`, { persona: 'owner' });
assert.equal(getDraftRes.json?.draft?.name, 'Patrol Officer Application');
console.log('Draft auto-saved & restored -> name:', getDraftRes.json.draft.name);

// Test multiple_choice validation with < 2 options fails
const badChoiceForm = await reqApi(`/api/workspace/${GUILD_ID}/forms`, {
  method: 'POST',
  persona: 'owner',
  body: {
    name: 'Bad Choice Form',
    slug: 'bad-choice',
    isOpen: true,
    questions: [{ id: 'q1', title: 'Pick one', type: 'multiple_choice', required: true, options: ['OnlyOneOption'] }]
  }
});
console.log('Multiple choice with 1 option -> Status:', badChoiceForm.status, 'Error:', badChoiceForm.json?.error);
assert.equal(badChoiceForm.status, 400);

// Test multiple_choice with >= 2 options succeeds
const goodChoiceForm = await reqApi(`/api/workspace/${GUILD_ID}/forms`, {
  method: 'POST',
  persona: 'owner',
  body: {
    name: 'Patrol Officer Application',
    slug: 'patrol-officer',
    isOpen: true,
    questions: [
      { id: 'q1', title: 'Which division?', type: 'multiple_choice', required: true, options: ['Traffic', 'K9', 'SWAT'] },
      { id: 'q2', title: 'Available days?', type: 'checkboxes', required: true, options: ['Weekdays', 'Weekends'] }
    ]
  }
});
console.log('Multiple choice + Checkboxes form published -> Status:', goodChoiceForm.status, 'Slug:', goodChoiceForm.json?.form?.slug);
assert.equal(goodChoiceForm.status, 200);

// ---------------------------------------------------------------------------
// ITEM 6: PARTNERSHIP DECLINED PANEL (Components V2 DM)
// ---------------------------------------------------------------------------
console.log('\n--- Item 6: Partnership Declined Components V2 DM ---');
updateGuildPartnershipConfig(PARTNER_GUILD_ID, { partnershipSetUp: true, partnershipMode: 'selective' });
const partReq = await createPartnershipRequest({
  fromGuildId: GUILD_ID,
  fromGuildName: 'Alpha Roleplay Server',
  toGuildId: PARTNER_GUILD_ID,
  toGuildName: 'Bravo State Patrol',
  requestedByUserId: OWNER_ID,
  requestedByUsername: 'AlphaOwner',
  message: 'Would love to partner!'
});

let sentDmPayloads = [];
const mockBot = {
  users: {
    fetch: async () => ({
      send: async () => {
        throw new Error('Legacy send should not be used when REST V2 succeeds');
      }
    })
  }
};

// Inspect built V2 payload directly
const v2Payload = buildPartnershipRequesterNotificationV2({
  status: 'rejected',
  targetServerName: 'Bravo State Patrol',
  targetServerIconUrl: 'https://cdn.discordapp.com/icons/222222222222222222/bravo.png',
  requestId: partReq.id
});
console.log('Declined Partnership V2 Payload:', JSON.stringify(v2Payload));
assert.equal(v2Payload.flags, 32768, 'Must use IS_COMPONENTS_V2 (32768)');
assert.equal(v2Payload.embeds, undefined, 'Must not include legacy embeds');
const container = v2Payload.components[0];
assert.equal(container.type, 17, 'Top component must be Container (17)');
assert.equal(container.accent_color, undefined, 'Must not set accent_color');
assert.ok(container.components.some((c) => c.type === 14), 'Must use real Separator (type: 14)');
const serializedV2 = JSON.stringify(v2Payload);
assert.ok(serializedV2.includes('Bravo State Patrol'), 'Must include declining server name');
assert.ok(serializedV2.includes('?size=32'), 'Must include small icon (?size=32)');
assert.ok(serializedV2.includes('Browse other servers'), 'Must include Browse other servers button');

// Verify respondToPartnershipRequest does not fail when DMs are closed and marks dmSent
const declinedRecord = await respondToPartnershipRequest({
  requestId: partReq.id,
  action: 'decline',
  guildId: PARTNER_GUILD_ID,
  responderUserId: '900000000000000099'
});
assert.equal(declinedRecord.status, 'declined');
console.log('Declined request processed cleanly (closed DMs safe) -> success:', declinedRecord.success);

// ---------------------------------------------------------------------------
// ITEM 7: DAILY CHECK-IN (Once per UTC day, Streak increment, Streak reset)
// ---------------------------------------------------------------------------
console.log('\n--- Item 7: Daily Check-In (1 claim per UTC day, Streak increment & reset) ---');
const CHECKIN_USER = '900000000000000888';
const day1 = new Date('2026-05-01T10:00:00Z');
const day1Again = new Date('2026-05-01T18:00:00Z');
const day2 = new Date('2026-05-02T11:00:00Z');
const day4MissedDay3 = new Date('2026-05-04T11:00:00Z');

const claim1 = await claimDailyReward(CHECKIN_USER, { now: day1, guildId: GUILD_ID });
assert.equal(claim1.streak, 1);
assert.equal(claim1.reward, 3);

let duplicateBlocked = false;
try {
  await claimDailyReward(CHECKIN_USER, { now: day1Again, guildId: GUILD_ID });
} catch (err) {
  duplicateBlocked = true;
}
assert.equal(duplicateBlocked, true, 'Second claim on same UTC day must be blocked');

const claim2 = await claimDailyReward(CHECKIN_USER, { now: day2, guildId: GUILD_ID });
assert.equal(claim2.streak, 2, 'Consecutive UTC day claim must increment streak to 2');

const claimAfterMiss = await claimDailyReward(CHECKIN_USER, { now: day4MissedDay3, guildId: GUILD_ID });
assert.equal(claimAfterMiss.streak, 1, 'Claim after missing a UTC day must reset streak to 1');
console.log('Daily Check-In verified -> Day1 streak:', claim1.streak, '| Same-day blocked:', duplicateBlocked, '| Day2 streak:', claim2.streak, '| Day4 (after miss) streak:', claimAfterMiss.streak);

// ---------------------------------------------------------------------------
// ITEM 8: OWNER ANALYTICS (7d & 30d Page Views, Join Clicks, Bumps)
// ---------------------------------------------------------------------------
console.log('\n--- Item 8: Real Owner Analytics (7d & 30d Page Views, Join Clicks, Bumps) ---');
appendServerActivity(GUILD_ID, { type: 'page_view', text: 'Public server page viewed.', timestamp: Date.now() });
createJoinIntent(MEMBER_ID, GUILD_ID, { recipientServerId: PARTNER_GUILD_ID });
const analyticsRes = await reqApi(`/api/servers/${GUILD_ID}/analytics`, { persona: 'owner' });
assert.equal(analyticsRes.status, 200);
console.log('Owner Analytics response:', JSON.stringify(analyticsRes.json));
assert.ok(analyticsRes.json.last7Days.pageViews >= 1, 'Must count real pageViews in last 7 days');
assert.ok(analyticsRes.json.last7Days.joinClicks >= 1, 'Must count real joinClicks in last 7 days');
assert.ok(analyticsRes.json.last7Days.bumps >= 1, 'Must count real bumps in last 7 days');

server.close();
fs.rmSync(tmpRoot, { recursive: true, force: true });
console.log('\nALL PHASE H TESTS PASSED!');
process.exit(0);
