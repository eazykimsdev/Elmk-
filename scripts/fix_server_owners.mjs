import fs from 'fs';

const dataPaths = ['data/promoted_servers.json', 'web/data/promoted_servers.json'];
const ownersMap = {
  '1347902300324368414': {
    ownerId: '1400351264415682621',
    ownerUsername: 'zyvro48',
    owner_display_name: 'Zyvro48',
    owner_discord_id: '1400351264415682621',
    ownerAvatar: 'https://cdn.discordapp.com/avatars/1400351264415682621/fd873329bec4e176733cd1335dfac71e.png',
    owner_avatar_hash: 'fd873329bec4e176733cd1335dfac71e'
  },
  '1379491118332514408': {
    ownerId: '1492251574804680778',
    ownerUsername: 'vortx_',
    owner_display_name: 'vortx_',
    owner_discord_id: '1492251574804680778',
    ownerAvatar: 'https://cdn.discordapp.com/avatars/1492251574804680778/438d43cf2336242af24beaf9118207a4.png',
    owner_avatar_hash: '438d43cf2336242af24beaf9118207a4'
  },
  '1517130661306171472': {
    ownerId: '1561439865957122066',
    ownerUsername: 'Astro',
    owner_display_name: 'Astro',
    owner_discord_id: '1561439865957122066',
    ownerAvatar: 'https://cdn.discordapp.com/avatars/1561439865957122066/86347d20567886b38a538ce64c2efbe3.png',
    owner_avatar_hash: '86347d20567886b38a538ce64c2efbe3'
  },
  '1511221805875204167': {
    ownerId: '1324885614570635264',
    ownerUsername: 'Mason',
    owner_display_name: 'Mason',
    owner_discord_id: '1324885614570635264',
    ownerAvatar: 'https://cdn.discordapp.com/avatars/1324885614570635264/6bb40e87017cfcf0f0afb964d8051da1.png',
    owner_avatar_hash: '6bb40e87017cfcf0f0afb964d8051da1'
  },
  '1552099992334901339': {
    ownerId: '1323048559624585279',
    ownerUsername: 'TikTok Rynotech',
    owner_display_name: 'TikTok Rynotech',
    owner_discord_id: '1323048559624585279',
    ownerAvatar: 'https://cdn.discordapp.com/avatars/1323048559624585279/1a6a7b4a3953b5fd7176e4ec58033c28.png',
    owner_avatar_hash: '1a6a7b4a3953b5fd7176e4ec58033c28'
  },
  '1559401689553834054': {
    ownerId: '1564982083598680132',
    ownerUsername: '! Linkyn',
    owner_display_name: '! Linkyn',
    owner_discord_id: '1564982083598680132',
    ownerAvatar: 'https://cdn.discordapp.com/avatars/1564982083598680132/9ec908b404ea270a310776e047e860c2.png',
    owner_avatar_hash: '9ec908b404ea270a310776e047e860c2'
  },
  '1554727845983551509': {
    ownerId: '1363298843999076392',
    ownerUsername: 'DamianJay',
    owner_display_name: 'DamianJay',
    owner_discord_id: '1363298843999076392',
    ownerAvatar: 'https://cdn.discordapp.com/avatars/1363298843999076392/a_ddbbfd3142ecf9d6d0a0ef4796950de7.png',
    owner_avatar_hash: 'a_ddbbfd3142ecf9d6d0a0ef4796950de7'
  }
};

function cleanSqlText(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text.trim();
  while (s.toLowerCase().startsWith('replace(')) {
    s = s.slice(8).trim();
    s = s.replace(/,\s*(?:['"]?\\r?\\n['"]?|\\r?\\n|char\(\d+\))\s*,\s*(?:char\(\d+\)|['"]?\\r?\\n['"]?|\\r?\\n)\s*\)?$/i, '');
    s = s.replace(/,\s*(?:char\(\d+\)|['"]?\\r?\\n['"]?|\\r?\\n)\s*\)?$/i, '');
    if (s.endsWith(')')) s = s.slice(0, -1);
    s = s.trim();
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      s = s.slice(1, -1);
    }
  }
  return s.trim();
}

for (const p of dataPaths) {
  if (!fs.existsSync(p)) continue;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const servers = raw.servers || [];
  for (const s of servers) {
    const o = ownersMap[s.id || s.guildId];
    if (o) {
      Object.assign(s, o);
      s.ownerName = o.owner_display_name;
    }
    s.description = cleanSqlText(s.description);
    s.summary = cleanSqlText(s.summary || s.description);
  }
  fs.writeFileSync(p, JSON.stringify(raw, null, 2), 'utf8');
  console.log('Successfully updated owners and cleaned text in', p);
}
