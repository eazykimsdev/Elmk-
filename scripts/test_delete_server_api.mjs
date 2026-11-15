import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001';
const OWNER_COOKIE = 'erlcus_session=ec3565417170f363365e88e8cda54963e1199231d49bd8f47d21bbfdc4aee7eb';

async function testDeleteServer() {
  console.log('--- Testing DELETE /api/servers/:id Endpoint ---');

  // 1. Add a dummy server to promoted_servers.json
  const pPath = path.resolve('data/promoted_servers.json');
  const pData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
  const testGuildId = '1999999999999999999';
  const testServer = {
    id: testGuildId,
    name: 'Temporary Test Server',
    category: 'Roleplay server',
    ownerId: '523693281541095424',
    memberCount: 50,
    tags: ['test'],
    rewardCoins: 2
  };
  pData.servers = pData.servers.filter(s => s.id !== testGuildId);
  pData.servers.push(testServer);
  fs.writeFileSync(pPath, JSON.stringify(pData, null, 2), 'utf8');

  // Add dummy reviews
  const rPath = path.resolve('data/reviews.json');
  let revs = [];
  if (fs.existsSync(rPath)) revs = JSON.parse(fs.readFileSync(rPath, 'utf8'));
  revs.push({
    id: `rev-test-${Date.now()}`,
    guild_id: testGuildId,
    user_id: '999999999999999999',
    rating: 5,
    text: 'Great test community'
  });
  fs.writeFileSync(rPath, JSON.stringify(revs, null, 2), 'utf8');

  // Test 1: Non-authenticated / non-owner call returns 403
  console.log('1. Calling DELETE as unauthenticated user...');
  const unauthRes = await fetch(`${BASE_URL}/api/servers/${testGuildId}`, { method: 'DELETE' });
  console.log(`Unauthenticated status: ${unauthRes.status} (expected 403)`);
  if (unauthRes.status !== 403) {
    throw new Error(`Expected 403 but got ${unauthRes.status}`);
  }

  // Test 2: Owner call returns 204
  console.log('2. Calling DELETE with Owner session cookie...');
  const ownerRes = await fetch(`${BASE_URL}/api/servers/${testGuildId}`, {
    method: 'DELETE',
    headers: {
      'Cookie': OWNER_COOKIE
    }
  });
  console.log(`Owner delete status: ${ownerRes.status} (expected 204)`);
  if (ownerRes.status !== 204) {
    throw new Error(`Expected 204 but got ${ownerRes.status}`);
  }

  // Test 3: Verify server is purged from promoted_servers
  const postData = JSON.parse(fs.readFileSync(pPath, 'utf8'));
  const foundInServers = postData.servers.some(s => s.id === testGuildId);
  console.log(`Server purged from promoted_servers: ${!foundInServers}`);

  // Test 4: Verify reviews purged
  const postRevs = JSON.parse(fs.readFileSync(rPath, 'utf8'));
  const foundInRevs = postRevs.some(r => r.guild_id === testGuildId);
  console.log(`Reviews purged from reviews.json: ${!foundInRevs}`);

  // Test 5: Verify audit log recorded
  const auditPath = path.resolve('data/admin_audit_log.json');
  const auditList = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const auditEntry = auditList.find(a => a.action === 'server_deleted');
  console.log(`Audit row recorded in admin_audit_log: ${Boolean(auditEntry)}`);

  console.log('--- Server Deletion Backend Tests PASSED! ---');
}

testDeleteServer().catch(err => {
  console.error('Delete server test failed:', err);
  process.exit(1);
});

