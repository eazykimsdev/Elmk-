import fs from 'fs';

async function resolveAllInvites() {
  const d = JSON.parse(fs.readFileSync('data/promoted_servers.json', 'utf8'));
  for (const s of d.servers) {
    console.log('Resolving server:', s.id, s.name);
    let code = null;
    if (s.inviteUrl) {
      const match = s.inviteUrl.match(/discord\.gg\/([a-zA-Z0-9_-]+)/);
      if (match) code = match[1];
    }
    if (code) {
      try {
        const res = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`);
        if (res.ok) {
          const inv = await res.json();
          console.log('  Guild:', inv.guild?.name, 'Icon:', inv.guild?.icon);
          console.log('  Inviter:', inv.inviter?.username, inv.inviter?.global_name, 'ID:', inv.inviter?.id);
          if (inv.guild?.icon) {
            s.icon = `https://cdn.discordapp.com/icons/${inv.guild.id}/${inv.guild.icon}.webp?size=256`;
            s.icon_hash = inv.guild.icon;
            s.iconHash = inv.guild.icon;
            s.iconUrl = s.icon;
          }
          if (inv.guild?.banner) {
            s.bannerUrl = `https://cdn.discordapp.com/banners/${inv.guild.id}/${inv.guild.banner}.webp?size=1024`;
          }
          if (inv.approximate_member_count) {
            s.memberCount = inv.approximate_member_count;
          }
          if (inv.inviter) {
            const ownerName = inv.inviter.global_name || inv.inviter.username;
            s.ownerName = ownerName;
            s.owner_display_name = ownerName;
            s.ownerUsername = inv.inviter.username;
            s.ownerId = inv.inviter.id;
            s.owner_discord_id = inv.inviter.id;
            s.owner_avatar_hash = inv.inviter.avatar || null;
            s.ownerAvatar = inv.inviter.avatar ? `https://cdn.discordapp.com/avatars/${inv.inviter.id}/${inv.inviter.avatar}.webp?size=128` : null;
          }
        } else {
          console.log('  Invite fetch status:', res.status);
        }
      } catch (e) {
        console.error('  Error:', e.message);
      }
    }
  }

  // Also clean the descriptions using cleanSqlReplace
  for (const s of d.servers) {
    if (s.description) {
      let desc = s.description.trim();
      if (desc.startsWith('replace(') && desc.endsWith(')')) {
        desc = desc.slice(8, -1).trim();
        desc = desc.replace(/,?\s*(?:['"]?\\n['"]?|['"]?\\r\\n['"]?)?\s*,?\s*char\(10\)\s*$/i, '').trim();
        if ((desc.startsWith("'") && desc.endsWith("'")) || (desc.startsWith('"') && desc.endsWith('"'))) {
          desc = desc.slice(1, -1);
        }
      }
      desc = desc.replace(/,?\s*\\n\s*,?\s*char\(10\)\s*\)?$/i, '');
      desc = desc.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
      s.description = desc.trim();
      s.summary = s.description;
    }
  }

  fs.writeFileSync('data/promoted_servers.json', JSON.stringify(d, null, 2), 'utf8');
  fs.writeFileSync('web/data/promoted_servers.json', JSON.stringify(d, null, 2), 'utf8');
  console.log('Successfully updated promoted_servers.json in both data/ and web/data/!');
}

resolveAllInvites();

