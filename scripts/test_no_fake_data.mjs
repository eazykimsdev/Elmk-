import fs from 'fs';
import path from 'path';

console.log('=== VERIFYING NO FAKE DATA & VALID DISCORD IDS ===');

const FORBIDDEN_REGEX = [
  /\bSulman\b/i,
  /Sulman Officer/i,
  /\bofficer_dan\b/i,
  /\bSarah RP\b/i,
  /\bsarah_rp\b/i,
  /Community Founder/i,
  /rec-sulm99/i,
  /Mobile QR code/i,
  /2,480/
];

// Check application source and data files (excluding tests/backups)
const SOURCE_DIRS = ['src', 'web/src', 'data', 'web/data'];
let forbiddenFound = false;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'dist' || f === 'web/dist' || f === 'backups' || f.includes('audit_results')) continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.json')) {
      const content = fs.readFileSync(full, 'utf8');
      for (const regex of FORBIDDEN_REGEX) {
        if (regex.test(content)) {
          console.error(`[FAIL] Forbidden string ${regex} found in ${full}`);
          forbiddenFound = true;
          break;
        }
      }
    }
  }
}

for (const dir of SOURCE_DIRS) {
  scanDir(dir);
}

if (forbiddenFound) {
  console.error('[FAIL] Forbidden fake strings found in codebase!');
  process.exit(1);
} else {
  console.log('[PASS] Zero instances of forbidden fake names or demo strings in source/data.');
}

// Check real Discord snowflake IDs in database files
function isDiscordSnowflake(id) {
  return typeof id === 'string' && /^\d{17,20}$/.test(id);
}

// 1. Promoted Servers
const PROMOTED_FILES = ['data/promoted_servers.json', 'web/data/promoted_servers.json'];
for (const pFile of PROMOTED_FILES) {
  if (fs.existsSync(pFile)) {
    const raw = JSON.parse(fs.readFileSync(pFile, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.servers || []);
    for (const s of list) {
      if (!isDiscordSnowflake(s.id)) {
        console.error(`[FAIL] Server listing ${s.name || s.id} lacks valid Discord Snowflake ID: ${s.id}`);
        process.exit(1);
      }
      if (s.ownerId && !isDiscordSnowflake(s.ownerId)) {
        console.error(`[FAIL] Server ${s.id} ownerId is not a Discord Snowflake: ${s.ownerId}`);
        process.exit(1);
      }
    }
    console.log(`[PASS] ${pFile}: All ${list.length} servers have valid Discord IDs.`);
  }
}

// 2. Reviews
const REVIEWS_FILE = 'data/reviews.json';
if (fs.existsSync(REVIEWS_FILE)) {
  const reviews = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
  for (const r of reviews) {
    if (!isDiscordSnowflake(r.user_id)) {
      console.error(`[FAIL] Review ${r.id} lacks valid Discord Snowflake user_id: ${r.user_id}`);
      process.exit(1);
    }
  }
  console.log(`[PASS] Reviews: All ${reviews.length} reviews have valid Discord user IDs.`);
}

// 3. Recruits
const RECRUITS_FILES = ['data/recruits.json', 'web/data/recruits.json'];
for (const rFile of RECRUITS_FILES) {
  if (fs.existsSync(rFile)) {
    const data = JSON.parse(fs.readFileSync(rFile, 'utf8'));
    for (const r of data.recruits || []) {
      if (!isDiscordSnowflake(r.recruiter_user_id) || !isDiscordSnowflake(r.joined_user_id)) {
        console.error(`[FAIL] Recruit ${r.id} has invalid Discord ID:`, r);
        process.exit(1);
      }
    }
    console.log(`[PASS] ${rFile}: All recruits have valid Discord IDs.`);
  }
}

console.log('=== ALL SECTION 0 CHECKS PASSED ===');
