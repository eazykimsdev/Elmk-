#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { grantVerifiedJoin, getPromotedServers } from '../directoryManager.js';

if (process.env.NODE_ENV === 'production') {
  console.error('[DEV ONLY] grant_dev_join is strictly forbidden in production mode.');
  process.exit(1);
}

const args = process.argv.slice(2);
let serverId = null;
let targetUserId = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--user' && args[i + 1]) {
    targetUserId = args[i + 1];
    i++;
  } else if (!args[i].startsWith('--')) {
    serverId = args[i];
  }
}

if (!serverId) {
  const servers = getPromotedServers(true);
  if (servers.length > 0) {
    serverId = servers[0].id;
    console.log(`[DEV] No serverId specified. Using first active server: ${serverId} (${servers[0].name})`);
  } else {
    console.error('Usage: npm run dev:grant-join -- <serverId> [--user <userId>]');
    process.exit(1);
  }
}

// Find user ID from active web session if not passed
if (!targetUserId) {
  try {
    const sessionFile = path.join(process.cwd(), 'data', 'web_sessions.json');
    if (fs.existsSync(sessionFile)) {
      const sessions = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      const activeSessions = Object.values(sessions).filter(s => s && s.user && s.user.id);
      if (activeSessions.length > 0) {
        // pick newest
        const newest = activeSessions[activeSessions.length - 1];
        targetUserId = newest.user.id;
        console.log(`[DEV] Found active signed-in dev account: ${targetUserId} (${newest.user.username || newest.user.globalName})`);
      }
    }
  } catch {}
}

if (!targetUserId) {
  targetUserId = '523693281541095424';
  console.log(`[DEV] Defaulting to dev admin user ID: ${targetUserId}`);
}

try {
  const record = grantVerifiedJoin(targetUserId, serverId);
  console.log(`[DEV SUCCESS] Granted verified join to user ${targetUserId} for server ${serverId}.`);
  console.log(`[DEV] Stay marked as completed (${record.stayCompleted}). User is now eligible to leave a review.`);
} catch (err) {
  console.error(`[DEV ERROR] Failed to grant verified join:`, err.message);
  process.exit(1);
}

