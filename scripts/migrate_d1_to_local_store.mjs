import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join('data', 'backups', `migration_${Date.now()}`);
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Backup existing files first
for (const f of ['promoted_servers.json', 'server_configs.json', 'ledger.json', 'reviews.json']) {
  const p = path.join('data', f);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(BACKUP_DIR, f));
  }
}
console.log(`[BACKUP] Backed up current data to ${BACKUP_DIR}`);

const sqlContent = fs.readFileSync(path.join('migration', 'connectingerlc-db.sql'), 'utf8');

// Parse network inserts
function parseInserts(tableName) {
  const lines = sqlContent.split('\n');
  const results = [];
  const prefix = `INSERT INTO "${tableName}" `;
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      const valuesIdx = line.indexOf('VALUES(');
      if (valuesIdx !== -1) {
        const raw = line.slice(valuesIdx + 7, line.lastIndexOf(');'));
        results.push(raw);
      }
    }
  }
  return results;
}

// Parse guild_stats data JSON
const statsMap = new Map();
const statsLines = parseInserts('guild_stats');
for (const s of statsLines) {
  // Pattern: ('id',members,'{data}',updated_at)
  const idMatch = s.match(/^\'(\d+)\'/);
  if (idMatch) {
    const id = idMatch[1];
    const jsonMatch = s.match(/'(\{[^']+\})'/);
    if (jsonMatch) {
      try {
        statsMap.set(id, JSON.parse(jsonMatch[1]));
      } catch {}
    }
  }
}
console.log(`[PARSER] Found ${statsMap.size} guild stats records`);

// Parse network servers
const networkServers = [];
const networkLines = parseInserts('network');

for (const line of networkLines) {
  // Extract id
  const idMatch = line.match(/^\'(\d+)\'/);
  if (!idMatch) continue;
  const id = idMatch[1];

  // Extract name
  const nameMatch = line.match(/^\'\d+\'\s*,\s*\'([^\']+)\'/);
  const name = nameMatch ? nameMatch[1] : `Server ${id}`;

  // Extract icon
  const iconMatch = line.match(/'(https:\/\/cdn\.discordapp\.com\/icons\/[^\']+)'/);
  const icon = iconMatch ? iconMatch[1] : null;

  // Extract banner
  const bannerMatch = line.match(/'(https:\/\/cdn\.discordapp\.com\/(?:banners|splashes)\/[^\']+)'/);
  const banner = bannerMatch ? bannerMatch[1] : '';

  // Extract invite
  const inviteMatch = line.match(/'(https:\/\/discord\.gg\/[^\']+)'/);
  const invite = inviteMatch ? inviteMatch[1] : '';

  // Extract members
  const memberMatch = line.match(/,\s*(\d+)\s*,\s*replace\(/) || line.match(/,\s*(\d+)\s*,\s*NULL/) || line.match(/,\s*(\d+)\s*,\s*'/);
  const members = memberMatch ? parseInt(memberMatch[1], 10) : 0;

  // Extract ad / description
  let description = '';
  if (line.includes("replace('")) {
    const startIdx = line.indexOf("replace('") + 9;
    const endIdx = line.indexOf("','\\n',char(10))");
    if (endIdx > startIdx) {
      description = line.slice(startIdx, endIdx).replace(/''/g, "'");
    }
  } else {
    const adMatch = line.match(/,\s*'([^']+)'\s*,\s*'https:\/\/discord\.gg/);
    if (adMatch) description = adMatch[1].replace(/''/g, "'");
  }

  // Stats from guild_stats
  const stats = statsMap.get(id) || {};
  const bumps = Number(stats.bumps) || 0;
  const lastBumpedAt = stats.lastBump || Date.now();
  const ownerName = stats.ownerName || 'Community Founder';
  const ownerAvatar = stats.ownerAvatar || null;

  // Category determination
  let category = 'Roleplay Server';
  const lowerName = name.toLowerCase();
  const lowerDesc = description.toLowerCase();
  if (lowerName.includes('design') || lowerName.includes('creative') || lowerDesc.includes('livery design') || lowerDesc.includes('clothing design')) {
    category = 'Design Server';
  } else if (lowerName.includes('airways') || lowerName.includes('flight') || lowerName.includes('aviation')) {
    category = 'Misc';
  }

  // Summary (clean 1-2 sentence preview)
  let summary = '';
  if (category === 'Design Server') {
    summary = 'Professional livery design, custom graphics, and creative services.';
  } else if (category === 'Misc') {
    summary = 'Friendly aviation, airline operations, and Project Flight community.';
  } else {
    summary = `Active roleplay sessions, custom departments, and dedicated community in ${name}.`;
  }

  networkServers.push({
    id,
    name,
    icon: icon || `https://cdn.discordapp.com/icons/${id}/default.png`,
    iconUrl: icon || `https://cdn.discordapp.com/icons/${id}/default.png`,
    category,
    categories: [category],
    language: 'English',
    summary,
    description: description || `Welcome to ${name}! Join our Discord for sessions, events, and community discussions.`,
    tags: [category.toLowerCase().replace(/\s+/g, '-'), 'erlc', 'community'],
    rewardCoins: 2,
    inviteUrl: invite,
    bannerUrl: banner || '',
    memberCount: members || stats.members || 0,
    bumps: bumps,
    lastBumpedAt,
    ownerUsername: ownerName,
    owner_display_name: ownerName,
    ownerAvatar,
    createdAt: stats.joinedAt || Date.now() - 86400000 * 7,
    updatedAt: Date.now(),
    reviews: []
  });
}

console.log(`[PARSER] Successfully extracted ${networkServers.length} network servers from D1 dump`);

// Load current promoted servers
const currentPromotedFile = path.join('data', 'promoted_servers.json');
let promotedData = { servers: [], userBalances: {}, userJoins: {}, bumpCooldowns: {} };
if (fs.existsSync(currentPromotedFile)) {
  promotedData = JSON.parse(fs.readFileSync(currentPromotedFile, 'utf8'));
}

// Preserve existing user's server (1530147023754367006) and (1320109891175845988)
const preserved = promotedData.servers.filter(s => s.id === '1530147023754367006' || s.id === '1320109891175845988');
const preservedIds = new Set(preserved.map(s => s.id));

// Combine
const mergedServers = [...preserved];
for (const ns of networkServers) {
  if (!preservedIds.has(ns.id)) {
    mergedServers.push(ns);
    preservedIds.add(ns.id);
  }
}

promotedData.servers = mergedServers;

// Save to data/ and web/data/
fs.writeFileSync(currentPromotedFile, JSON.stringify(promotedData, null, 2), 'utf8');
const webPromotedFile = path.join('web', 'data', 'promoted_servers.json');
fs.writeFileSync(webPromotedFile, JSON.stringify(promotedData, null, 2), 'utf8');
console.log(`[SAVE] Updated promoted_servers.json with ${mergedServers.length} active communities!`);

// Ingest credit ledger entries
const ledgerLines = parseInserts('credit_ledger');
const ledgerFile = path.join('data', 'ledger.json');
let ledger = { transactions: [], pending: [] };
if (fs.existsSync(ledgerFile)) {
  try {
    const raw = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
    if (Array.isArray(raw)) {
      ledger.transactions = raw;
    } else if (raw && Array.isArray(raw.transactions)) {
      ledger = raw;
    }
  } catch {}
}
for (const ll of ledgerLines) {
  const parts = ll.split(',');
  if (parts.length >= 7) {
    const id = parts[0].trim();
    const guildId = parts[1].replace(/'/g, '').trim();
    const amount = parseInt(parts[2].trim(), 10) || 5;
    const reason = parts[3].replace(/'/g, '').trim();
    const note = parts[4].replace(/'/g, '').trim();
    const userId = parts[5].replace(/'/g, '').trim() || null;
    const createdAt = parseInt(parts[6].trim(), 10) || Date.now();

    if (!ledger.transactions.some(t => String(t.id) === String(id))) {
      ledger.transactions.unshift({
        id: `d1_${id}`,
        guildId,
        amount,
        type: reason === 'checkin' ? 'checkin' : 'bump',
        description: note || `D1 ${reason}`,
        userId,
        timestamp: new Date(createdAt).toISOString()
      });
    }
  }
}
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2), 'utf8');
const webLedgerFile = path.join('web', 'data', 'ledger.json');
fs.writeFileSync(webLedgerFile, JSON.stringify(ledger, null, 2), 'utf8');
console.log(`[SAVE] Updated ledger.json with ${ledger.transactions.length} transactions`);

console.log('MIGRATION COMPLETE!');
