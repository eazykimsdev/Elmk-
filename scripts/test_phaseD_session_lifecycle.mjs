import fs from 'fs';

async function main() {
  console.log('--- Phase D Step 2: Testing Session Lifecycle Across Restarts ---');

  // 1. Get session cookie
  const sessions = JSON.parse(fs.readFileSync('data/web_sessions.json', 'utf8'));
  const sessionToken = Object.keys(sessions)[0];
  if (!sessionToken) {
    throw new Error('No active session found in data/web_sessions.json');
  }
  const session = sessions[sessionToken];
  console.log('Using session token:', sessionToken.slice(0, 8) + '... for user:', session.user?.username);

  const cookieHeader = `connectingerlc_session=${sessionToken}`;

  // 2. Check auth debug
  console.log('\n[1] Calling GET /api/auth/debug...');
  const debugRes = await fetch('http://localhost:3001/api/auth/debug', {
    headers: { Cookie: cookieHeader }
  });
  const debugData = await debugRes.json();
  console.log('Debug result:', debugData);
  if (debugData.sessionFoundInStore !== 'yes' || !debugData.valid) throw new Error('Session not found in debug route!');

  // 3. Post a review (verify auth recognizes the user, preventing 401 unauthenticated)
  console.log('\n[2] Attempting to post review as signed-in user...');
  const revRes = await fetch('http://localhost:3001/api/servers/1320109891175845988/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      rating: 5,
      text: 'Phase D automated session persistence verification review.'
    })
  });
  console.log('Post review HTTP status:', revRes.status);
  const revBody = await revRes.json();
  console.log('Post review response body:', revBody);
  // It must NOT be 401 unauthenticated
  if (revRes.status === 401) {
    throw new Error('Received 401 Unauthenticated: "Please sign in" error reproduced!');
  }
  console.log('User was authenticated! Result:', revBody.error || revBody.success);

  // 4. Save server settings for a server that HAS the bot (1530147023754367006)
  console.log('\n[3] Saving server settings to /api/servers/1530147023754367006/listing...');
  const setRes = await fetch('http://localhost:3001/api/servers/1530147023754367006/listing', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      description: 'Dedicated ER:LC roleplay community with realistic patrol operations.'
    })
  });
  console.log('Save settings status:', setRes.status);
  const setBody = await setRes.json();
  console.log('Save settings response:', setBody);
  if (setRes.status !== 200) {
    throw new Error(`Save settings failed with status ${setRes.status}: ${JSON.stringify(setBody)}`);
  }

  console.log('\nAll pre-restart operations succeeded without "Please sign in" errors!');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
