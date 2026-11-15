import {
  createPartnershipRequest,
  respondToPartnershipRequest,
  getGuildPartnershipsDashboard,
  updateGuildPartnershipConfig
} from '../partnershipsManager.js';

async function testTwoServers() {
  console.log('--- TWO-SERVER PARTNERSHIP VERIFICATION ---');

  const serverA_id = '1999111222333444555'; // Community Alpha
  const serverB_id = '1999222333444555666'; // Community Beta

  // 1. Configure Server B to Selective mode with specific terms
  updateGuildPartnershipConfig(serverB_id, {
    partnershipMode: 'selective',
    partnershipMinMembers: 10,
    partnershipPrice: 0,
    allowPartnerMentions: true,
    partnershipHerePrice: 15,
  });

  // 2. Server A sends partnership request to Server B
  console.log('1. Server A sending proposal to Server B...');
  const req = await createPartnershipRequest({
    fromGuildId: serverA_id,
    fromGuildName: 'Mavely (SOON)',
    toGuildId: serverB_id,
    includeMention: true,
    mentionType: 'here',
    customAdText: 'Alliance proposal from Server A to Server B',
  });
  console.log('   Request created:', req.id, 'status:', req.status);

  // 3. Check Server B dashboard incoming tab
  console.log('2. Verifying Server B dashboard incoming requests...');
  const dashB = getGuildPartnershipsDashboard(serverB_id);
  const foundReq = dashB.incomingRequests.find(r => r.id === req.id);
  if (!foundReq) {
    throw new Error('Server B did not receive incoming request from Server A');
  }
  console.log('   Found incoming request on Server B:');
  console.log('   Sender name:', foundReq.senderName);
  console.log('   Sender icon:', foundReq.senderIcon ? 'Present' : 'Default');
  console.log('   Sender members:', foundReq.senderMemberCount);
  console.log('   Terms minMembers:', foundReq.terms?.minMembers);

  // 4. Server B accepts the request
  console.log('3. Server B accepting proposal...');
  const acceptResult = await respondToPartnershipRequest({
    requestId: req.id,
    action: 'accept',
    guildId: serverB_id,
    responderUserId: '523693281541095424',
  });
  console.log('   Accept result:', acceptResult.success, 'Partnership ID:', acceptResult.partnership?.id);

  // 5. Verify Active Partnerships on Server B
  console.log('4. Verifying established active partnership...');
  const dashBAfter = getGuildPartnershipsDashboard(serverB_id);
  const activePart = dashBAfter.activePartnerships.find(p => p.id === acceptResult.partnership.id);
  if (!activePart) {
    throw new Error('Partnership was not found in active partnerships list');
  }
  console.log('   Active partner established:', activePart.partnerGuildName, 'Status:', activePart.status);

  console.log('--- ALL TWO-SERVER VERIFICATIONS PASSED ---');
}

testTwoServers().catch(err => {
  console.error('Two-server test failed:', err);
  process.exit(1);
});
