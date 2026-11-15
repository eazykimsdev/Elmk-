import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDirectoryData, saveDirectoryData } from './directoryManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const VERIFICATIONS_FILE = path.join(DATA_DIR, 'verification_applications.json');

function ensureVerificationsFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(VERIFICATIONS_FILE)) {
    fs.writeFileSync(VERIFICATIONS_FILE, JSON.stringify({ applications: [] }, null, 2), 'utf8');
  }
}

export function loadVerificationApplications() {
  ensureVerificationsFile();
  try {
    const raw = fs.readFileSync(VERIFICATIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.applications) ? parsed.applications : [];
  } catch {
    return [];
  }
}

export function saveVerificationApplications(apps) {
  ensureVerificationsFile();
  try {
    const tmp = `${VERIFICATIONS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ applications: apps }, null, 2), 'utf8');
    fs.renameSync(tmp, VERIFICATIONS_FILE);
    return true;
  } catch {
    return false;
  }
}

export function getVerificationStatus(serverId) {
  const sid = String(serverId);
  const dirData = loadDirectoryData();
  const server = dirData.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  const apps = loadVerificationApplications().filter(a => String(a.serverId) === sid);
  apps.sort((a, b) => b.submittedAt - a.submittedAt);
  const latestApp = apps[0] || null;

  return {
    verified: Boolean(server?.verified),
    status: server?.verified ? 'approved' : (latestApp ? latestApp.status : 'not_applied'),
    application: latestApp,
    history: apps
  };
}

export function submitVerificationApplication({
  serverId,
  serverName,
  userId,
  username,
  why,
  offerings,
  links
}) {
  if (!serverId) throw new Error('Server ID is required.');
  const sid = String(serverId);
  const uid = String(userId);

  const cleanWhy = String(why || '').trim();
  const cleanOfferings = String(offerings || '').trim();
  const cleanLinks = String(links || '').trim();

  if (cleanWhy.length < 10) {
    throw new Error('Please describe why your community qualifies for verification (at least 10 characters).');
  }
  if (cleanOfferings.length < 10) {
    throw new Error('Please describe what your community offers to players and the platform (at least 10 characters).');
  }

  const apps = loadVerificationApplications();
  const existingPending = apps.find(a => String(a.serverId) === sid && a.status === 'pending');
  if (existingPending) {
    throw new Error('A verification application is already pending review for this server.');
  }

  const newApp = {
    id: `vapp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    serverId: sid,
    serverName: serverName || 'Community Server',
    userId: uid,
    username: username || 'Server Manager',
    why: cleanWhy.slice(0, 1000),
    offerings: cleanOfferings.slice(0, 1000),
    links: cleanLinks.slice(0, 500),
    status: 'pending',
    submittedAt: Date.now(),
    processedAt: null,
    processedBy: null,
    processedByRole: null,
    reason: null
  };

  apps.unshift(newApp);
  saveVerificationApplications(apps);
  return newApp;
}

export function reviewVerificationApplication({
  applicationId,
  action, // 'approve' | 'reject'
  reason,
  adminUser
}) {
  const apps = loadVerificationApplications();
  const app = apps.find(a => a.id === applicationId);
  if (!app) {
    throw new Error('Verification application not found.');
  }

  const cleanReason = String(reason || '').trim();
  if (action === 'reject' && !cleanReason) {
    throw new Error('A rejection reason is required.');
  }

  const now = Date.now();
  app.status = action === 'approve' ? 'approved' : 'rejected';
  app.reason = cleanReason || (action === 'approve' ? 'Approved by reviewer' : 'Rejected');
  app.processedAt = now;
  app.processedBy = adminUser?.username || 'Staff';
  app.processedByRole = adminUser?.role || 'Reviewer';

  // Update directory server verified badge
  const dirData = loadDirectoryData();
  let server = dirData.servers.find(s => String(s.id) === String(app.serverId) || String(s.guildId) === String(app.serverId));
  if (!server) {
    server = {
      id: String(app.serverId),
      name: app.serverName || 'Server',
      verified: action === 'approve'
    };
    dirData.servers.push(server);
  } else {
    server.verified = action === 'approve';
  }
  saveDirectoryData(dirData);

  saveVerificationApplications(apps);
  return app;
}

export function revokeVerification({
  serverId,
  reason,
  revokedBy
}) {
  const sid = String(serverId);
  const dirData = loadDirectoryData();
  const server = dirData.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (server) {
    server.verified = false;
    saveDirectoryData(dirData);
  }

  const apps = loadVerificationApplications();
  const app = apps.find(a => String(a.serverId) === sid && a.status === 'approved');
  if (app) {
    app.status = 'revoked';
    app.reason = reason || 'Revoked';
    app.processedAt = Date.now();
    app.processedBy = revokedBy || 'System';
    saveVerificationApplications(apps);
  }

  return { success: true, serverId: sid, verified: false };
}
