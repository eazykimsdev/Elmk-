// One-time cleanup of test artifacts that leaked into local data files.
// Backs up every touched file to data/backups/cleanup_<ts>/ before writing.
import fs from 'fs';
import path from 'path';

const ts = Date.now();
const backupDir = path.join('data', 'backups', `cleanup_${ts}`);
fs.mkdirSync(backupDir, { recursive: true });

const FAKE_USER_IDS = new Set(['888777666555444333', '111222333444555666']);
const FAKE_GUILD_IDS = new Set(['1394180844100386866', '1999111222333444555', '1999222333444555666', '112233445566778899']);
const FAKE_TEXT = [
  'Great active patrol server',
  'Join the most active patrol community',
  'Verified community patrol in Liberty County',
  'Dedicated ER:LC roleplay community with realistic patrol operations',
  'Phase D automated',
  'Join Storage RP',
  'Alliance proposal from Server A',
];
const isFakeText = (s) => typeof s === 'string' && FAKE_TEXT.some((t) => s.includes(t));

function load(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function save(p, data) {
  fs.copyFileSync(p, path.join(backupDir, p.replace(/[\\/]/g, '__')));
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

for (const dir of ['data', 'web/data']) {
  // Reviews
  const rp = path.join(dir, 'reviews.json');
  if (fs.existsSync(rp)) {
    const r = load(rp);
    const list = Array.isArray(r) ? r : r.reviews || [];
    const kept = list.filter((x) => !FAKE_USER_IDS.has(String(x.user_id)) && !isFakeText(x.text) && !FAKE_GUILD_IDS.has(String(x.server_id)));
    console.log(rp, 'reviews', list.length, '->', kept.length);
    save(rp, Array.isArray(r) ? kept : { ...r, reviews: kept });
  }

  // Partnerships
  const pp = path.join(dir, 'partnerships.json');
  if (fs.existsSync(pp)) {
    const p = load(pp);
    for (const key of ['requests', 'partnerships', 'transactions']) {
      if (!Array.isArray(p[key])) continue;
      const before = p[key].length;
      p[key] = p[key].filter((x) =>
        !FAKE_GUILD_IDS.has(String(x.fromGuildId)) && !FAKE_GUILD_IDS.has(String(x.toGuildId)) &&
        !FAKE_GUILD_IDS.has(String(x.guildId)) && !FAKE_USER_IDS.has(String(x.fromOwnerId)) && !isFakeText(x.adText));
      console.log(pp, key, before, '->', p[key].length);
    }
    save(pp, p);
  }

  // Listings: clear test-written descriptions so owners write their own text
  const lp = path.join(dir, 'promoted_servers.json');
  if (fs.existsSync(lp)) {
    const l = load(lp);
    for (const s of l.servers || []) {
      if (isFakeText(s.description)) { s.description = ''; console.log(lp, s.id, 'description cleared'); }
      if (isFakeText(s.summary)) { s.summary = ''; console.log(lp, s.id, 'summary cleared'); }
      if (s.name === 'Alabama State Roleplay' && s.id === '1530147023754367006') { s.name = 'Discord bot V.2'; }
    }
    save(lp, l);
  }

  // Sessions belonging to fake test users
  const sp = path.join(dir, 'web_sessions.json');
  if (fs.existsSync(sp)) {
    const s = load(sp);
    let removed = 0;
    for (const k of Object.keys(s)) {
      if (FAKE_USER_IDS.has(String(s[k]?.user?.id)) || s[k]?.user?.username === 'Generic Owner' || s[k]?.user?.globalName === 'Generic Owner') { delete s[k]; removed++; }
    }
    console.log(sp, 'sessions removed', removed);
    save(sp, s);
  }

  // Recruits from fake users
  const rcp = path.join(dir, 'recruits.json');
  if (fs.existsSync(rcp)) {
    const rc = load(rcp);
    const txt = JSON.stringify(rc);
    if (txt.includes('Generic Owner')) {
      for (const key of Object.keys(rc)) {
        if (Array.isArray(rc[key])) {
          const before = rc[key].length;
          rc[key] = rc[key].filter((x) => !JSON.stringify(x).includes('Generic Owner') && !FAKE_USER_IDS.has(String(x.userId || x.recruiterId || x.recruitUserId)));
          if (before !== rc[key].length) console.log(rcp, key, before, '->', rc[key].length);
        }
      }
      save(rcp, rc);
    }
  }
}
console.log('Backup written to', backupDir);

