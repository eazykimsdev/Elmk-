import fs from 'fs';
const d = JSON.parse(fs.readFileSync('data/promoted_servers.json', 'utf8'));
console.log('Count:', d.servers.length);
console.log(d.servers.map(s => ({ id: s.id, name: s.name, memberCount: s.memberCount, icon_hash: s.icon_hash, category: s.category })));

