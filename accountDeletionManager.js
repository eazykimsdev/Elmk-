import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getPromotedServers, saveDirectoryData, loadDirectoryData } from './directoryManager.js';
import { loadLedgerData, saveLedgerData } from './ledgerManager.js';
import { loadReviewsData, saveReviewsData } from './reviewsManager.js';
import { loadBumpReminders, saveBumpReminders } from './bumpReminderManager.js';
import { loadCheckinReminders, saveCheckinReminders } from './checkinReminderManager.js';
import { recordAuditAction } from './adminManager.js';
import { siteUrl } from './shared/siteUrl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const PERSISTENT_BANS_FILE = path.join(DATA_DIR, 'persistent_bans.json');

function loadPersistentBans() {
  try {
    if (fs.existsSync(PERSISTENT_BANS_FILE)) {
      return JSON.parse(fs.readFileSync(PERSISTENT_BANS_FILE, 'utf8') || '[]');
    }
  } catch {}
  return [];
}

function savePersistentBans(data) {
  try {
    fs.writeFileSync(PERSISTENT_BANS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[ACCOUNT DELETION] Persistent bans save failed:', err.message);
  }
}

/**
 * Hard delete a server and all its dependent records
 */
export async function deleteServerHard(serverId, callerUserId, { isAccountDeletion = false, actor = null } = {}) {
  const sid = String(serverId).trim();
  const uid = String(callerUserId).trim();

  const dirData = loadDirectoryData();
  const serverIndex = dirData.servers.findIndex((s) => String(s.id) === sid || String(s.guildId) === sid);
  if (serverIndex === -1) {
    throw new Error('Server not found.');
  }

  const server = dirData.servers[serverIndex];

  // Only Owner can delete a server
  if (String(server.ownerId) !== uid && !actor?.isAdmin) {
    throw new Error('Only the server owner can delete this server. Co-owners and managers cannot delete servers.');
  }

  // 1. Remove from directory
  dirData.servers.splice(serverIndex, 1);
  if (dirData.bumpCooldowns) delete dirData.bumpCooldowns[sid];
  saveDirectoryData(dirData);

  // 2. Remove banner files if local
  if (server.bannerUrl && server.bannerUrl.startsWith('/uploads/')) {
    const bannerPath = path.join(process.cwd(), server.bannerUrl);
    try {
      if (fs.existsSync(bannerPath)) fs.unlinkSync(bannerPath);
    } catch {}
  }

  // 3. Remove reviews for this server
  try {
    const revData = loadReviewsData();
    if (Array.isArray(revData)) {
      const filteredReviews = revData.filter((r) => String(r.server_id || r.serverId) !== sid);
      saveReviewsData(filteredReviews);
    } else if (Array.isArray(revData?.reviews)) {
      revData.reviews = revData.reviews.filter((r) => String(r.server_id || r.serverId) !== sid);
      saveReviewsData(revData);
    }
  } catch {}

  // 4. Remove bump reminders for this server
  try {
    const bumpRems = loadBumpReminders();
    const filteredBump = bumpRems.filter((r) => r.guild_id !== sid);
    saveBumpReminders(filteredBump);
  } catch {}

  // 5. Remove check-in reminders for this server
  try {
    const checkinRems = loadCheckinReminders();
    for (const u of Object.keys(checkinRems)) {
      if (checkinRems[u]?.[sid]) delete checkinRems[u][sid];
    }
    saveCheckinReminders(checkinRems);
  } catch {}

  // 6. Delete bot instance file if exists
  const botInstanceFile = path.join(DATA_DIR, `bot_instance_${sid}.json`);
  try {
    if (fs.existsSync(botInstanceFile)) fs.unlinkSync(botInstanceFile);
  } catch {}

  // Audit record (without personal data)
  recordAuditAction({
    actor: actor || { username: 'Owner', id: uid },
    action: 'server_hard_delete',
    target: sid,
    targetType: 'server',
    reason: `Server ${server.name} was permanently deleted`,
    before: server.name,
    after: null
  });

  return { success: true, serverId: sid, serverName: server.name };
}

/**
 * Delete a user account, all owned servers, and anonymize user footprint
 */
export async function deleteUserAccountAndServers({ userId, username, botToken, sessionCreatedAt }) {
  const uid = String(userId).trim();
  const uname = String(username).trim();

  // 1. Session age check: re-authenticate if older than 10 minutes
  if (sessionCreatedAt) {
    const sessionAge = Date.now() - Number(sessionCreatedAt);
    if (sessionAge > 10 * 60 * 1000) {
      throw new Error('Your session is older than 10 minutes. Please re-authenticate with Discord before deleting your account.');
    }
  }

  // 2. Check if Discord ID is currently blacklisted: if so, persist hashed ban so deletion cannot evade ban
  try {
    const { checkBlacklist } = await import('./blacklistManager.js');
    const blCheck = checkBlacklist({ userId: uid });
    if (blCheck.blocked) {
      const pBans = loadPersistentBans();
      const idHash = crypto.createHash('sha256').update(uid).digest('hex');
      if (!pBans.some((b) => b.id_hash === idHash)) {
        pBans.push({
          id_hash: idHash,
          reason: blCheck.reason || 'Banned account evasion prevention',
          banned_at: new Date().toISOString()
        });
        savePersistentBans(pBans);
      }
    }
  } catch {}

  // 3. Find and hard delete all servers owned by this user
  const allServers = getPromotedServers(true);
  const ownedServers = allServers.filter((s) => String(s.ownerId) === uid);
  for (const s of ownedServers) {
    await deleteServerHard(s.id, uid, { isAccountDeletion: true });
  }

  // 4. Remove user from any team memberships, co-owners, and representatives
  const dirData = loadDirectoryData();
  for (const s of dirData.servers) {
    if (Array.isArray(s.coOwners)) {
      s.coOwners = s.coOwners.filter((id) => String(id) !== uid);
    }
    if (Array.isArray(s.representatives)) {
      s.representatives = s.representatives.filter((id) => String(id) !== uid);
    }
    if (Array.isArray(s.team)) {
      s.team = s.team.filter((m) => String(m.id || m.userId) !== uid);
    }
  }
  saveDirectoryData(dirData);

  // 5. Anonymize reviews written by this user as "Deleted user"
  try {
    const revData = loadReviewsData();
    const list = Array.isArray(revData) ? revData : (Array.isArray(revData?.reviews) ? revData.reviews : null);
    if (list) {
      let modified = false;
      for (const r of list) {
        if (String(r.user_id || r.userId || r.authorId) === uid) {
          r.user_name = 'Deleted user';
          r.author_name = 'Deleted user';
          r.display_name = 'Deleted user';
          r.authorName = 'Deleted user';
          r.authorId = 'deleted_user';
          r.userId = 'deleted_user';
          r.user_id = 'deleted_user';
          r.user_avatar = null;
          r.avatar_url = null;
          r.user_avatar_hash = null;
          r.avatar_hash = null;
          r.authorAvatar = null;
          r.avatar = null;
          r.has_verified_join = false;
          r.verifiedJoin = false;
          modified = true;
        }
      }
      if (modified) saveReviewsData(revData);
    }
  } catch {}

  // 6. Anonymize ledger rows where user identity is recorded, keeping history intact
  try {
    const lData = loadLedgerData();
    if (Array.isArray(lData.transactions)) {
      let modified = false;
      for (const tx of lData.transactions) {
        if (String(tx.userId) === uid) {
          tx.userId = 'deleted_user';
          tx.triggeredBy = 'Deleted user';
          modified = true;
        }
      }
      if (modified) saveLedgerData(lData);
    }
  } catch {}

  // 7. Clear bump reminders and check-in reminders for this user
  try {
    const bumpRems = loadBumpReminders();
    saveBumpReminders(bumpRems.filter((r) => r.user_id !== uid));
    const checkinRems = loadCheckinReminders();
    delete checkinRems[uid];
    saveCheckinReminders(checkinRems);
  } catch {}

  // 8. Send final confirmation DM panel before destroying sessions
  if (botToken) {
    const cleanToken = botToken.trim().replace(/^Bot\s+/i, '');
    try {
      const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          Authorization: `Bot ${cleanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipient_id: uid })
      });
      if (dmRes.ok) {
        const dmChannel = await dmRes.json();
        const payload = {
          flags: 32768, // MessageFlags.IsComponentsV2
          components: [
            {
              type: 17, // Container (No accent_color = no color on the side)
              components: [
                {
                  type: 10,
                  content: '# Account deleted\n\nYour ConnectingERLC account and all owned server listings have been permanently deleted.'
                },
                {
                  type: 14,
                  divider: true
                },
                {
                  type: 1,
                  components: [
                    {
                      type: 2,
                      style: 5,
                      label: 'ConnectingERLC Home',
                      url: siteUrl('/')
                    }
                  ]
                }
              ]
            }
          ]
        };
        await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${cleanToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }
    } catch {}
  }

  // 9. Destroy all user sessions
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
      for (const [sId, sess] of Object.entries(raw)) {
        if (sess?.user?.id === uid || sess?.userId === uid) {
          delete raw[sId];
        }
      }
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(raw, null, 2), 'utf8');
    }
  } catch {}

  recordAuditAction({
    actor: { username: uname, id: uid },
    action: 'account_delete',
    target: uid,
    targetType: 'user',
    reason: `User account ${uname} and all associated servers deleted`,
    before: uname,
    after: null
  });

  return { success: true };
}

