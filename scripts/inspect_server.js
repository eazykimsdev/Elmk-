import fs from 'fs';
const d = JSON.parse(fs.readFileSync('data/promoted_servers.json', 'utf8'));
const s = d.servers[0];
console.log('Server id:', s.id);
console.log('Server name:', s.name);
console.log('Owner fields:', {
  ownerId: s.ownerId,
  ownerUsername: s.ownerUsername,
  owner_display_name: s.owner_display_name,
  owner_avatar_hash: s.owner_avatar_hash
});

