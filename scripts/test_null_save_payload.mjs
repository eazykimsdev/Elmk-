import fs from 'fs';

async function testNullSavePayload() {
  console.log('[TEST] Testing listing save endpoint with null optional fields...');

  const sessions = JSON.parse(fs.readFileSync('data/web_sessions.json', 'utf8'));
  const sessionToken = Object.keys(sessions)[0];

  const nullPayload = {
    name: 'Discord bot V.2',
    category: 'Roleplay Server',
    summary: null,
    description: null,
    tags: [],
    language: null,
    bannerUrl: null,
    inviteUrl: null,
    joinCode: null,
    rewardCoins: 2,
    offerHigherReward: false,
    retentionTargetHours: 72,
    representativesWanted: 4,
    openForPartnerships: true,
    partnershipMinMembers: 5,
    partnershipPrice: 0,
    partnershipAllowedMentions: null,
    partnershipHerePrice: 15,
    partnershipEveryonePrice: 30,
    partnershipBroadcastChannel: null,
    partnershipAcceptedCategories: null,
    partnershipDailyLimit: 1,
    listedInDirectory: true
  };

  const res = await fetch('http://localhost:3001/api/servers/1530147023754367006/listing', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `connectingerlc_session=${sessionToken}`
    },
    body: JSON.stringify(nullPayload)
  });

  const body = await res.json();

  if (!res.ok || !body.success) {
    console.error('[TEST FAIL] Save returned error:', res.status, body);
    process.exit(1);
  }

  console.log('[TEST PASS] Save with null fields succeeded!', body.server?.id);

  // Verify fields did not turn into the string literal "null"
  const s = body.server;
  if (s.summary === 'null' || s.description === 'null' || s.bannerUrl === 'null' || s.inviteUrl === 'null') {
    console.error('[TEST FAIL] Server saved string literal "null" instead of empty string/null:', s);
    process.exit(1);
  }

  console.log('[TEST PASS] Field values safely normalized:');
  console.log(' - summary:', JSON.stringify(s.summary));
  console.log(' - description:', JSON.stringify(s.description));
  console.log(' - bannerUrl:', JSON.stringify(s.bannerUrl));
  console.log(' - inviteUrl:', JSON.stringify(s.inviteUrl));
  console.log(' - joinCode:', JSON.stringify(s.joinCode));
  console.log(' - tags:', JSON.stringify(s.tags));

  // Also test empty payload {}
  const emptyRes = await fetch('http://localhost:3001/api/servers/1530147023754367006/listing', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `connectingerlc_session=${sessionToken}`
    },
    body: JSON.stringify({})
  });

  const emptyBody = await emptyRes.json();
  if (!emptyRes.ok || !emptyBody.success) {
    console.error('[TEST FAIL] Save with empty body {} failed:', emptyRes.status, emptyBody);
    process.exit(1);
  }

  console.log('[TEST PASS] Save with empty payload {} succeeded!');
  console.log('ALL NULL-SAFETY UNIT TESTS PASSED!');
}

testNullSavePayload().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
