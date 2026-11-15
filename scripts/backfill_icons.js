import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(process.cwd(), 'data');
const PROMOTED_FILE = path.join(DATA_DIR, 'promoted_servers.json');

async function backfill() {
  if (!fs.existsSync(PROMOTED_FILE)) {
    console.log('No promoted servers file found at', PROMOTED_FILE);
    return;
  }

  const raw = fs.readFileSync(PROMOTED_FILE, 'utf8');
  const data = JSON.parse(raw);
  const servers = Array.isArray(data.servers) ? data.servers : [];

  const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  console.log(`Starting backfill for ${servers.length} servers... (Discord token present: ${Boolean(token)})`);

  for (const s of servers) {
    console.log(`Processing server ${s.id} (${s.name})...`);

    // Extract icon hash if not set
    let iconHash = s.icon_hash || s.iconHash || null;
    if (!iconHash && s.icon) {
      const match = String(s.icon).match(/\/icons\/\d+\/([a-zA-Z0-9_]+)/);
      if (match) iconHash = match[1];
      else if (!s.icon.startsWith('http') && !s.icon.startsWith('data:') && s.icon.length > 5) iconHash = s.icon;
    }

    if (iconHash) {
      s.icon_hash = iconHash;
      s.iconHash = iconHash;
      s.icon = `https://cdn.discordapp.com/icons/${s.id}/${iconHash}.${iconHash.startsWith('a_') ? 'gif' : 'webp'}?size=128`;
      s.iconUrl = s.icon;
    }

    // If Discord bot token is available, try fetching guild info
    if (token) {
      try {
        const gRes = await fetch(`https://discord.com/api/v10/guilds/${s.id}?with_counts=true`, {
          headers: { Authorization: `Bot ${token}` }
        });
        if (gRes.ok) {
          const g = await gRes.json();
          if (g.name) s.name = g.name;
          if (g.icon) {
            s.icon_hash = g.icon;
            s.iconHash = g.icon;
            s.icon = `https://cdn.discordapp.com/icons/${s.id}/${g.icon}.${g.icon.startsWith('a_') ? 'gif' : 'webp'}?size=128`;
            s.iconUrl = s.icon;
          }
          if (g.approximate_member_count) {
            s.memberCount = g.approximate_member_count;
          }
          if (g.owner_id) {
            s.ownerId = g.owner_id;
          }
          console.log(`  Fetched from Discord API: name="${g.name}", icon="${g.icon}", owner="${g.owner_id}"`);
        } else {
          console.log(`  Discord API guild fetch status: ${gRes.status}`);
        }
      } catch (err) {
        console.warn(`  Failed to fetch guild ${s.id}:`, err.message);
      }

      // Fetch owner info if ownerId is known
      const ownerId = s.ownerId || s.owner_discord_id;
      if (ownerId && /^\d{17,20}$/.test(ownerId)) {
        try {
          const uRes = await fetch(`https://discord.com/api/v10/users/${ownerId}`, {
            headers: { Authorization: `Bot ${token}` }
          });
          if (uRes.ok) {
            const u = await uRes.json();
            s.ownerId = u.id;
            s.ownerUsername = u.username;
            s.owner_display_name = u.global_name || u.username;
            s.owner_avatar_hash = u.avatar;
            s.ownerAvatar = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=64` : null;
            console.log(`  Fetched owner from Discord API: "${s.owner_display_name}" (${u.username})`);
          }
        } catch (err) {
          console.warn(`  Failed to fetch owner ${ownerId}:`, err.message);
        }
      }
    }

    // Default fallbacks if still empty
    if (!s.owner_display_name) {
      s.owner_display_name = s.ownerUsername || `${s.name} Founder`;
    }
  }

  data.servers = servers;
  fs.writeFileSync(PROMOTED_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log('Saved backfilled promoted servers to', PROMOTED_FILE);

  const webFile = path.join(process.cwd(), 'web', 'data', 'promoted_servers.json');
  if (fs.existsSync(path.dirname(webFile))) {
    fs.writeFileSync(webFile, JSON.stringify(data, null, 2), 'utf8');
    console.log('Synced to', webFile);
  }
}

backfill().catch(console.error);

