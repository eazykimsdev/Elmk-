import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const SEEDS_DIR = path.join(process.cwd(), 'seeds');

const token = (process.env.DISCORD_BOT_TOKEN || process.env.CONNECTINGERLC_BOT_TOKEN || process.env.DISCORD_TOKEN || '').trim().replace(/^Bot\s+/i, '');

async function fetchDiscordUser(userId) {
  if (!token) return null;
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    try {
      const res = await fetch(`https://discord.com/api/v10/users/${userId}`, {
        headers: { Authorization: `Bot ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const retryAfter = Math.ceil((data.retry_after || 1.5) * 1000) + 200;
        console.log(`[RATE LIMIT] Rate limited on Discord user ${userId}, waiting ${retryAfter}ms...`);
        await new Promise(r => setTimeout(r, retryAfter));
        continue;
      }
      if (res.status === 404) {
        return null;
      }
    } catch (e) {
      console.warn(`[FETCH ERR] ${userId}:`, e.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

async function run() {
  console.log('=== SYNCING ALL REAL USERS AND SERVERS ===');
  
  const userMap = new Map();
  const serverMap = new Map();

  // Helper to register user
  function registerUser(id, partial = {}) {
    if (!id || !/^\d{17,20}$/.test(String(id))) return;
    const uid = String(id);
    const existing = userMap.get(uid) || { userId: uid, roles: ['User'], lastSeen: Date.now() };
    userMap.set(uid, {
      ...existing,
      ...partial,
      userId: uid,
      username: partial.username || existing.username || null,
      displayName: partial.displayName || partial.globalName || existing.displayName || existing.globalName || null,
      avatarUrl: partial.avatarUrl || partial.avatar || existing.avatarUrl || null,
      roles: Array.from(new Set([...(existing.roles || []), ...(partial.roles || [])]))
    });
  }

  // 1. Existing known_users.json
  try {
    const ku = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'known_users.json'), 'utf8'));
    for (const u of ku) {
      registerUser(u.userId || u.id, {
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarUrl,
        lastSeen: u.lastSeen,
        roles: u.roles
      });
    }
  } catch {}

  // 2. Existing known_accounts.json
  try {
    const ka = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'known_accounts.json'), 'utf8'));
    for (const u of ka) {
      registerUser(u.userId || u.id, {
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatar,
        lastSeen: u.firstSeen,
        roles: ['User']
      });
    }
  } catch {}

  // 3. admins.json
  try {
    const ad = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'admins.json'), 'utf8'));
    for (const u of ad) {
      registerUser(u.userId || u.id, {
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatar || u.avatarUrl,
        roles: [u.role || 'Admin']
      });
    }
  } catch {}

  // 4. promoted_servers.json (servers, launchBonus, userBalances)
  try {
    const ps = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'promoted_servers.json'), 'utf8'));
    if (ps.launchBonusGrantedUsers) {
      for (const [uid, b] of Object.entries(ps.launchBonusGrantedUsers)) {
        registerUser(uid, { roles: ['Server Owner'] });
        if (b.serverId && /^\d{17,20}$/.test(b.serverId)) {
          serverMap.set(b.serverId, {
            id: b.serverId,
            name: b.serverName || 'Community Server',
            ownerId: uid
          });
        }
      }
    }
    if (ps.userBalances) {
      for (const uid of Object.keys(ps.userBalances)) {
        registerUser(uid, { roles: ['User'] });
      }
    }
    if (ps.servers) {
      for (const [sid, srv] of Object.entries(ps.servers)) {
        if (srv.ownerId && /^\d{17,20}$/.test(String(srv.ownerId))) {
          registerUser(srv.ownerId, {
            username: srv.ownerUsername,
            displayName: srv.owner_display_name || srv.ownerUsername,
            avatarUrl: srv.ownerAvatar,
            roles: ['Server Owner']
          });
        }
        const sId = String(srv.id || srv.guildId || sid);
        if (/^\d{17,20}$/.test(sId) && !serverMap.has(sId)) {
          serverMap.set(sId, { ...srv, id: sId });
        }
      }
    }
  } catch {}

  // 5. Live bot guilds & their owners from Discord
  if (token) {
    try {
      console.log('Fetching live bot guilds from Discord API...');
      const res = await fetch('https://discord.com/api/v10/users/@me/guilds?with_counts=true', {
        headers: { Authorization: `Bot ${token}` }
      });
      if (res.ok) {
        const guilds = await res.json();
        console.log(`Bot is in ${guilds.length} live Discord guilds!`);
        for (const g of guilds) {
          const gid = String(g.id);
          try {
            const gRes = await fetch(`https://discord.com/api/v10/guilds/${gid}`, {
              headers: { Authorization: `Bot ${token}` }
            });
            if (gRes.ok) {
              const fullG = await gRes.json();
              if (fullG.owner_id) {
                registerUser(fullG.owner_id, { roles: ['Server Owner'] });
              }
              const iconUrl = fullG.icon ? `https://cdn.discordapp.com/icons/${gid}/${fullG.icon}.webp?size=128` : null;
              serverMap.set(gid, {
                id: gid,
                guildId: gid,
                name: fullG.name,
                iconUrl,
                icon: fullG.icon,
                memberCount: Number(fullG.approximate_member_count || fullG.member_count || g.approximate_member_count || 0),
                ownerId: fullG.owner_id,
                description: fullG.description || '',
                vanityUrlCode: fullG.vanity_url_code || null,
                verified: Boolean(fullG.features && fullG.features.includes('VERIFIED'))
              });
            } else if (gRes.status === 429) {
              const data = await gRes.json().catch(() => ({}));
              const retryAfter = Math.ceil((data.retry_after || 1.5) * 1000) + 200;
              console.log(`[RATE LIMIT] Rate limited on guild ${gid}, waiting ${retryAfter}ms...`);
              await new Promise(r => setTimeout(r, retryAfter));
            }
            await new Promise(r => setTimeout(r, 120));
          } catch (ge) {}
        }
      }
    } catch (e) {
      console.warn('Bot guilds fetch warning:', e.message);
    }
  }

  // 6. Bot instances
  try {
    const bi = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bot_instances.db.json'), 'utf8'));
    for (const [k, v] of Object.entries(bi)) {
      let owner = v.ownerUserId;
      let guild = v.guildId;
      if (owner && typeof owner === 'object') {
        guild = owner.guildId || guild;
        owner = owner.ownerUserId;
      }
      if (owner && /^\d{17,20}$/.test(String(owner))) {
        registerUser(owner, { roles: ['Bot Owner'] });
      }
      if (guild && /^\d{17,20}$/.test(String(guild)) && !serverMap.has(String(guild))) {
        serverMap.set(String(guild), {
          id: String(guild),
          guildId: String(guild),
          name: v.name || v.customizations?.serverName || `Server (${String(guild).slice(-6)})`,
          ownerId: owner && /^\d{17,20}$/.test(String(owner)) ? String(owner) : null
        });
      }
    }
  } catch {}

  console.log(`Identified ${userMap.size} unique user IDs and ${serverMap.size} unique server IDs.`);

  // 7. Resolve all missing usernames and avatars with Discord API
  console.log('Resolving missing user profiles from Discord...');
  let resolvedCount = 0;
  for (const [uid, u] of userMap.entries()) {
    if (!u.username || u.username === 'null' || !u.avatarUrl) {
      const dUser = await fetchDiscordUser(uid);
      if (dUser) {
        u.username = dUser.username;
        u.displayName = dUser.global_name || dUser.username;
        if (dUser.avatar) {
          u.avatarUrl = `https://cdn.discordapp.com/avatars/${uid}/${dUser.avatar}.png`;
        }
        resolvedCount++;
        console.log(`  [Resolved] ${uid} -> ${u.username} (${u.displayName})`);
      }
      await new Promise(r => setTimeout(r, 120));
    }
  }
  console.log(`Resolved ${resolvedCount} user profiles.`);

  // Clean list of known users: only real users with valid snowflake IDs
  const finalUsersList = Array.from(userMap.values()).filter(u => {
    if (!u.userId || !/^\d{17,20}$/.test(u.userId)) return false;
    if (serverMap.has(u.userId)) return false; // not a guild ID
    return true;
  }).map(u => ({
    userId: u.userId,
    username: u.username || `User_${u.userId.slice(-4)}`,
    displayName: u.displayName || u.username || `User_${u.userId.slice(-4)}`,
    avatarUrl: u.avatarUrl || null,
    lastSeen: u.lastSeen || Date.now(),
    roles: u.roles || ['User']
  }));

  console.log(`Total valid real Discord users to save: ${finalUsersList.length}`);

  // Write to data/known_users.json and seeds/known_users.json
  fs.writeFileSync(path.join(DATA_DIR, 'known_users.json'), JSON.stringify(finalUsersList, null, 2), 'utf8');
  if (fs.existsSync(SEEDS_DIR)) {
    fs.writeFileSync(path.join(SEEDS_DIR, 'known_users.json'), JSON.stringify(finalUsersList, null, 2), 'utf8');
  }

  // Also write to data/known_accounts.json and seeds/known_accounts.json
  const accountsList = finalUsersList.map(u => ({
    id: u.userId,
    userId: u.userId,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatarUrl,
    firstSeen: u.lastSeen,
    source: 'discord_verified'
  }));
  fs.writeFileSync(path.join(DATA_DIR, 'known_accounts.json'), JSON.stringify(accountsList, null, 2), 'utf8');
  if (fs.existsSync(SEEDS_DIR)) {
    fs.writeFileSync(path.join(SEEDS_DIR, 'known_accounts.json'), JSON.stringify(accountsList, null, 2), 'utf8');
  }

  // Sync servers in promoted_servers.json
  try {
    const psFile = path.join(DATA_DIR, 'promoted_servers.json');
    let psData = { servers: [], userBalances: {}, userJoins: {}, userJoinRecords: {}, bumpCooldowns: {}, launchBonusGrantedUsers: {} };
    if (fs.existsSync(psFile)) {
      psData = JSON.parse(fs.readFileSync(psFile, 'utf8'));
    }
    const existingServers = Array.isArray(psData.servers) ? psData.servers : Object.values(psData.servers || {});
    const existingServerMap = new Map();
    for (const s of existingServers) {
      const sid = String(s.id || s.guildId);
      if (/^\d{17,20}$/.test(sid)) existingServerMap.set(sid, s);
    }

    for (const [sid, srv] of serverMap.entries()) {
      if (!existingServerMap.has(sid)) {
        const ownerUser = userMap.get(srv.ownerId);
        existingServerMap.set(sid, {
          id: sid,
          guildId: sid,
          name: srv.name || `Server ${sid.slice(-6)}`,
          description: srv.description || 'ConnectingERLC Verified Community Server',
          summary: srv.description || '',
          iconUrl: srv.iconUrl || null,
          memberCount: Number(srv.memberCount) || 0,
          category: 'Roleplay Server',
          ownerId: srv.ownerId || null,
          ownerUsername: ownerUser?.username || null,
          owner_display_name: ownerUser?.displayName || ownerUser?.username || null,
          ownerAvatar: ownerUser?.avatarUrl || null,
          createdAt: Date.now(),
          lastBumpedAt: Date.now(),
          verified: Boolean(srv.verified),
          tags: ['ERLC', 'Roleplay', 'Emergency Response']
        });
      } else {
        // Update with owner info and real member count if missing
        const existing = existingServerMap.get(sid);
        if (!existing.ownerId && srv.ownerId) existing.ownerId = srv.ownerId;
        const ownerUser = userMap.get(existing.ownerId || srv.ownerId);
        if (ownerUser) {
          if (!existing.ownerUsername && ownerUser.username) existing.ownerUsername = ownerUser.username;
          if (!existing.owner_display_name && ownerUser.displayName) existing.owner_display_name = ownerUser.displayName;
          if (!existing.ownerAvatar && ownerUser.avatarUrl) existing.ownerAvatar = ownerUser.avatarUrl;
        }
        if (srv.name && (!existing.name || existing.name.startsWith('Server '))) existing.name = srv.name;
        if (srv.iconUrl && !existing.iconUrl) existing.iconUrl = srv.iconUrl;
        if (srv.memberCount && (!existing.memberCount || existing.memberCount === 0)) existing.memberCount = srv.memberCount;
      }
    }

    psData.servers = Array.from(existingServerMap.values());
    fs.writeFileSync(psFile, JSON.stringify(psData, null, 2), 'utf8');
    if (fs.existsSync(SEEDS_DIR)) {
      fs.writeFileSync(path.join(SEEDS_DIR, 'promoted_servers.json'), JSON.stringify(psData, null, 2), 'utf8');
    }
    console.log(`Saved ${psData.servers.length} real servers to promoted_servers.json!`);
  } catch (err) {
    console.error('Error updating promoted_servers.json:', err);
  }

  console.log('=== SYNC COMPLETE ===');
}

run().catch(console.error);
