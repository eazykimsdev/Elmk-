import fs from 'fs';

const OWNER_TOKEN = 'd23a1d852fe70e9eaa4a1fbee6610dc64109726897785345e73b080ff8b8ff2f';
const MEMBER_TOKEN = 'round9_phasea_session_token_1793941678769';
const GUILD_ID = '1530147023754367006';

export async function testSaveAndReview(label) {
  console.log(`\n--- [${label}] Testing Save Settings (Owner) ---`);
  const saveRes = await fetch(`http://localhost:3000/api/servers/${GUILD_ID}/listing`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `connectingerlc_session=${OWNER_TOKEN}`
    },
    body: JSON.stringify({
      name: 'Alabama State Roleplay',
      category: 'Roleplay server',
      summary: 'Verified community patrol in Liberty County.',
      description: 'Join the most active patrol community with daily shifts and custom liveries.'
    })
  });
  const saveData = await saveRes.json();
  console.log(`Save status: ${saveRes.status}`);
  if (!saveRes.ok) {
    throw new Error(`Save failed: ${JSON.stringify(saveData)}`);
  }
  console.log('✓ Successfully saved listing with status 200!');

  console.log(`\n--- [${label}] Testing Post Review (Member) ---`);
  const reviewRes = await fetch(`http://localhost:3000/api/servers/${GUILD_ID}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `connectingerlc_session=${MEMBER_TOKEN}`
    },
    body: JSON.stringify({
      rating: 5,
      text: 'Great active patrol server with excellent staff and regular shifts!'
    })
  });
  const reviewData = await reviewRes.json();
  console.log(`Review status: ${reviewRes.status}`);
  if (!reviewRes.ok) {
    throw new Error(`Review failed: ${JSON.stringify(reviewData)}`);
  }
  console.log('✓ Successfully posted review with status 200!');
}

async function run() {
  await testSaveAndReview('TEST');
}

run().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
