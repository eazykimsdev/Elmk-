import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const DIRECTORY_FILE = path.join(root, 'web', 'data', 'promoted_servers.json');
const LEDGER_FILE = path.join(root, 'web', 'data', 'ledger.json');

console.log('[MIGRATION] Running clean_fake_servers.js...');

if (fs.existsSync(DIRECTORY_FILE)) {
  try {
    const raw = fs.readFileSync(DIRECTORY_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data.servers)) {
      const beforeCount = data.servers.length;
      data.servers = data.servers.filter((s) => {
        if (!s || typeof s.id !== 'string') return false;
        // Discord snowflakes must be 17-20 digits
        if (!/^\d{17,20}$/.test(s.id)) return false;
        if (s.id === '112233445566778899') return false;
        if (typeof s.name === 'string' && s.name.toLowerCase().includes('southland')) return false;
        if (typeof s.summary === 'string' && s.summary.includes('Southland')) return false;
        return true;
      });
      console.log(`[MIGRATION] Cleaned promoted servers: ${beforeCount} -> ${data.servers.length}`);
      fs.writeFileSync(DIRECTORY_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('[MIGRATION] Error cleaning promoted_servers.json:', err);
  }
}

if (fs.existsSync(LEDGER_FILE)) {
  try {
    const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data.transactions)) {
      data.transactions = data.transactions.filter((t) => {
        if (!t) return false;
        if (t.guildId === '112233445566778899') return false;
        if (typeof t.description === 'string' && t.description.toLowerCase().includes('southland')) return false;
        if (typeof t.guildName === 'string' && t.guildName.toLowerCase().includes('southland')) return false;
        return true;
      });
    }
    if (Array.isArray(data.pending)) {
      data.pending = data.pending.filter((p) => {
        if (!p) return false;
        if (p.guildId === '112233445566778899') return false;
        if (typeof p.guildName === 'string' && (p.guildName.includes('Southland') || p.guildName.includes('San Andreas'))) return false;
        return true;
      });
    }
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('[MIGRATION] Cleaned ledger.json successfully.');
  } catch (err) {
    console.error('[MIGRATION] Error cleaning ledger.json:', err);
  }
}

console.log('[MIGRATION] Fake server purge completed.');

