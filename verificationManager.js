import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDirectoryData, saveDirectoryData } from './directoryManager.js';
import { recordAuditAction } from './adminManager.js';
import { sendComponentV2Dm } from './discordNotificationManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const VERIFICATIONS_FILE = path.join(DATA_DIR, 'verification_applications.json');

export const VERIFICATION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

  const now = Date.now();
  let isVerified = Boolean(server?.verified);
  const verifiedUntil = Number(server?.verifiedUntil || 0);

  // Check if 30-day verification has expired
  if (isVerified && verifiedUntil > 0 && now >= verifiedUntil) {
    isVerified = false;
    server.verified = false;
    server.verifiedUntil = 0;
    saveDirectoryData(dirData);
  }

  const remainingSeconds = isVerified && verifiedUntil > now ? Math.ceil((verifiedUntil - now) / 1000) : 0;
  const remainingDays = Math.ceil(remainingSeconds / 86400);

  return {
    verified: isVerified,
    verifiedUntil: verifiedUntil || null,
    remainingSeconds,
    remainingDays,
    status: isVerified ? 'approved' : (latestApp ? latestApp.status : 'not_applied'),
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

  // 30 days duration on approval
  const verifiedUntil = action === 'approve' ? now + VERIFICATION_DURATION_MS : 0;
  app.verifiedUntil = verifiedUntil;

  // Update directory server verified badge
  const dirData = loadDirectoryData();
  let server = dirData.servers.find(s => String(s.id) === String(app.serverId) || String(s.guildId) === String(app.serverId));
  if (!server) {
    server = {
      id: String(app.serverId),
      name: app.serverName || 'Server',
      verified: action === 'approve',
      verifiedUntil,
      verification_7d_reminder_sent: false
    };
    dirData.servers.push(server);
  } else {
    server.verified = action === 'approve';
    server.verifiedUntil = verifiedUntil;
    server.verification_7d_reminder_sent = false;
  }
  saveDirectoryData(dirData);
  saveVerificationApplications(apps);

  recordAuditAction({
    action: action === 'approve' ? 'APPROVE_VERIFICATION' : 'REJECT_VERIFICATION',
    actor: adminUser?.username || 'Staff',
    actorRole: adminUser?.role || 'Reviewer',
    target: String(app.serverId),
    reason: `${action === 'approve' ? 'Approved' : 'Rejected'} verification: ${app.reason}`
  });

  return app;
}

export function revokeVerification({
  serverId,
  reason = 'Revoked by administration',
  revokedBy = 'System'
}) {
  const sid = String(serverId);
  const dirData = loadDirectoryData();
  const server = dirData.servers.find(s => String(s.id) === sid || String(s.guildId) === sid);
  if (server) {
    server.verified = false;
    server.verifiedUntil = 0;
    saveDirectoryData(dirData);
  }

  const apps = loadVerificationApplications();
  const app = apps.find(a => String(a.serverId) === sid && a.status === 'approved');
  if (app) {
    app.status = 'revoked';
    app.reason = reason;
    app.processedAt = Date.now();
    app.processedBy = revokedBy;
    saveVerificationApplications(apps);
  }

  recordAuditAction({
    action: 'REVOKE_VERIFICATION',
    actor: revokedBy,
    actorRole: 'System/Admin',
    target: sid,
    reason: `Revoked verified badge: ${reason}`
  });

  return { success: true, serverId: sid, verified: false };
}

/**
 * Check verification 7-day reminders and 30-day expiries:
 * - Sends 1 V2 DM 7 days before it ends
 * - Sends 1 V2 DM when it ends
 * - When it ends the check mark and verified features go away but nothing else changes
 */
export async function checkVerificationExpiries() {
  const dirData = loadDirectoryData();
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  let remindersSent = 0;
  let expirationsHandled = 0;

  for (const server of dirData.servers) {
    if (!server.verified || !server.verifiedUntil) continue;
    const timeLeft = Number(server.verifiedUntil) - now;

    // 1. Expired
    if (timeLeft <= 0) {
      server.verified = false;
      server.verifiedUntil = 0;
      expirationsHandled++;

      if (server.ownerId) {
        const container = {
          type: 17, // V2 Container
          components: [
            {
              type: 10,
              content: `### Verification Expired: ${server.name}\nYour community's 30-day verification period for **${server.name}** has concluded.\nThe verified blue checkmark has been removed. You can re-apply anytime from your server dashboard.`
            },
            {
              type: 14,
              divider: true,
              spacing: 1
            },
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: 'Re-Apply for Verification',
                  url: `https://connectingerlc.xyz/dashboard/${server.id}/promote`
                }
              ]
            }
          ]
        };
        await sendComponentV2Dm(server.ownerId, container).catch(() => {});
      }
      continue;
    }

    // 2. 7-day reminder
    if (timeLeft <= SEVEN_DAYS_MS && !server.verification_7d_reminder_sent) {
      server.verification_7d_reminder_sent = true;
      remindersSent++;

      if (server.ownerId) {
        const daysLeft = Math.ceil(timeLeft / 86400000);
        const container = {
          type: 17, // V2 Container
          components: [
            {
              type: 10,
              content: `### Verification Renewal Notice: ${server.name}\nYour community's verified status for **${server.name}** will expire in **${daysLeft} days**.\nSubmit a renewal application to keep your verified blue checkmark active without interruption.`
            },
            {
              type: 14,
              divider: true,
              spacing: 1
            },
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: 'Renew Verification',
                  url: `https://connectingerlc.xyz/dashboard/${server.id}/promote`
                }
              ]
            }
          ]
        };
        await sendComponentV2Dm(server.ownerId, container).catch(() => {});
      }
    }
  }

  if (remindersSent > 0 || expirationsHandled > 0) {
    saveDirectoryData(dirData);
  }

  return { remindersSent, expirationsHandled };
}
