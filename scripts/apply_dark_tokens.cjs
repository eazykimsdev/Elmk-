const fs = require('fs');
const path = require('path');

const replacements = [
  // Old palette to Round 4 near-black tokens
  [/#131418/gi, '#09090B'],
  [/#16171C/gi, '#09090B'],
  [/#1A1C22/gi, '#0E0E11'],
  [/#21232B/gi, '#141417'],
  [/#272A33/gi, '#19191D'],
  [/#B4B4BD/gi, '#A1A1AA'],
  [/#85858F/gi, '#71717A'],
  [/rgba\(255,\s*255,\s*255,\s*0\.08\)/gi, 'rgba(255, 255, 255, 0.07)'],
  [/rgba\(255,\s*255,\s*255,\s*0\.14\)/gi, 'rgba(255, 255, 255, 0.13)'],
  // Card radius 14px -> 16px
  [/rounded-\[14px\]/g, 'rounded-[16px]'],
];

let changedCount = 0;

function walk(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.git' && item !== 'dist') {
        walk(full);
      }
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(item)) {
      let code = fs.readFileSync(full, 'utf8');
      let modified = code;
      for (const [from, to] of replacements) {
        modified = modified.replace(from, to);
      }
      if (modified !== code) {
        fs.writeFileSync(full, modified, 'utf8');
        changedCount++;
        console.log(`Updated tokens in: ${full}`);
      }
    }
  }
}

walk('src');
console.log(`Finished updating tokens. Total files modified: ${changedCount}`);

