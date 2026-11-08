import fs from 'fs';
import path from 'path';

const DATA_DIRS = ['data', 'web/data'];

const REPLACEMENTS = [
  { from: /523693281541095424/g, to: '111222333444555666' },
  { from: /eazykims/g, to: 'server_founder' },
  { from: /Eazykims/g, to: 'Server Founder' },
  { from: /kims3166/g, to: 'founder_rp' },
  { from: /Test Bot \[Project 53\]/g, to: 'Liberty County Police Dept' },
  { from: /Project 53/g, to: 'Liberty County' },
  { from: /Discord bot V\.2/g, to: 'ConnectingERLC Community' },
  { from: /"name":\s*"SOLD"/g, to: '"name": "San Andreas State Troopers"' },
  { from: /Mavely \(SOON\)/g, to: 'ConnectingERLC Community' },
  { from: /Mavely/g, to: 'ConnectingERLC' },
  { from: /Eazy kims testing!!/g, to: 'Dedicated Emergency Response: Liberty County roleplay community.' }
];

for (const dir of DATA_DIRS) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const full = path.join(dir, f);
    try {
      let text = fs.readFileSync(full, 'utf8');
      let original = text;

      if (f === 'session_votes.json') {
        text = JSON.stringify({ votes: {} }, null, 2);
      } else {
        for (const rep of REPLACEMENTS) {
          text = text.replace(rep.from, rep.to);
        }
      }

      if (text !== original) {
        fs.writeFileSync(full, text, 'utf8');
        console.log(`Cleaned database file: ${full}`);
      }
    } catch (err) {
      console.warn(`Could not sanitize ${full}:`, err.message);
    }
  }
}

console.log('Database sanitization complete.');

