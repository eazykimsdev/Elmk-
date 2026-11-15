const fs = require('fs');

let content = fs.readFileSync('directoryManager.js', 'utf8').replace(/\r\n/g, '\n');

const target = `/** Bump a server to #1 position (enforces 1-hour cooldown) */
export function bumpPromotedServer(guildId, userId) {
  const data = loadDirectoryData();
  const targetId = String(guildId);
  const server = data.servers.find(s => s.id === targetId);
  if (!server) {
    throw new Error('Server not found in directory');
  }

  const COOLDOWN_MS = 60 * 60 * 1000;
  const now = Date.now();
  const lastBump = Number(data.bumpCooldowns[targetId] || server.lastBumpedAt || 0);

  if (lastBump && (now - lastBump < COOLDOWN_MS)) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastBump)) / 1000);
    const minutes = Math.ceil(remainingSeconds / 60);
    const cooldownErr = new Error(\`⚠️ Cooldown Active: This server was bumped recently. You can run /bump again in \${minutes} minute\${minutes === 1 ? '' : 's'}. (Limit: 1 bump per hour)\`);
    cooldownErr.status = 429;
    cooldownErr.cooldownSeconds = remainingSeconds;
    throw cooldownErr;
  }

  data.bumpCooldowns[targetId] = now;
  server.lastBumpedAt = now;
  server.bumps = (Number(server.bumps) || 0) + 1;
  server.updatedAt = now;

  saveDirectoryData(data);
  return { success: true, server, lastBumpedAt: now };
}`;

const replacement = `export const BUMP_COOLDOWN_HOURS = 2;
export const BUMP_COST_CREDITS = 0;

/** Get bump status and live cooldown for a server */
export function getBumpStatus(guildId) {
  const data = loadDirectoryData();
  const targetId = String(guildId);
  const server = data.servers.find(s => s.id === targetId);

  const COOLDOWN_MS = BUMP_COOLDOWN_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const lastBump = Number(data.bumpCooldowns[targetId] || server?.lastBumpedAt || 0);

  if (lastBump && (now - lastBump < COOLDOWN_MS)) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastBump)) / 1000);
    return {
      canBump: false,
      cooldownSeconds: remainingSeconds,
      nextBumpAt: lastBump + COOLDOWN_MS,
      lastBumpedAt: lastBump,
      cooldownHours: BUMP_COOLDOWN_HOURS,
      costCredits: BUMP_COST_CREDITS,
    };
  }

  return {
    canBump: true,
    cooldownSeconds: 0,
    nextBumpAt: null,
    lastBumpedAt: lastBump || null,
    cooldownHours: BUMP_COOLDOWN_HOURS,
    costCredits: BUMP_COST_CREDITS,
  };
}

/** Bump a server to #1 position (enforces BUMP_COOLDOWN_HOURS cooldown) */
export function bumpPromotedServer(guildId, userId) {
  const data = loadDirectoryData();
  const targetId = String(guildId);
  const server = data.servers.find(s => s.id === targetId);
  if (!server) {
    throw new Error('Server not found in directory');
  }

  const COOLDOWN_MS = BUMP_COOLDOWN_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const lastBump = Number(data.bumpCooldowns[targetId] || server.lastBumpedAt || 0);

  if (lastBump && (now - lastBump < COOLDOWN_MS)) {
    const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastBump)) / 1000);
    const minutes = Math.ceil(remainingSeconds / 60);
    const cooldownErr = new Error(\`You can't bump yet. Try again in \${minutes} minute\${minutes === 1 ? '' : 's'}.\`);
    cooldownErr.status = 429;
    cooldownErr.cooldownSeconds = remainingSeconds;
    cooldownErr.nextBumpAt = lastBump + COOLDOWN_MS;
    throw cooldownErr;
  }

  data.bumpCooldowns[targetId] = now;
  server.lastBumpedAt = now;
  server.nextBumpAt = now + COOLDOWN_MS;
  server.bumps = (Number(server.bumps) || 0) + 1;
  server.updatedAt = now;

  saveDirectoryData(data);
  return {
    success: true,
    server,
    lastBumpedAt: now,
    nextBumpAt: now + COOLDOWN_MS,
    cooldownHours: BUMP_COOLDOWN_HOURS,
    message: 'Bumped. Your server is now #1.',
  };
}`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('directoryManager.js', content, 'utf8');
  console.log('Successfully updated directoryManager.js');
} else {
  console.log('Target not found in directoryManager.js');
}

