const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src');

const replacements = [
  // Dark surfaces & backgrounds -> Cool graphite
  { from: /#0A0A0B/gi, to: '#131418' },
  { from: /#101012/gi, to: '#1A1C22' },
  { from: /#17171A/gi, to: '#21232B' },
  { from: /#1C1C20/gi, to: '#272A33' },

  // Typography tokens
  { from: /#FAFAFA/gi, to: '#F4F4F5' },
  { from: /#A1A1AA/gi, to: '#B4B4BD' },
  { from: /#71717A/gi, to: '#85858F' },

  // Borders
  { from: /rgba\(255,\s*255,\s*255,\s*0\.07\)/gi, to: 'rgba(255, 255, 255, 0.08)' },
  { from: /rgba\(255,\s*255,\s*255,\s*0\.12\)/gi, to: 'rgba(255, 255, 255, 0.14)' },
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (/\.(tsx|ts|css)$/.test(file)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      for (const r of replacements) {
        if (r.from.test(content)) {
          content = content.replace(r.from, r.to);
          modified = true;
        }
      }
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated palette in: ${file}`);
      }
    }
  }
}

processDir(srcDir);
console.log('Palette tokens replacement complete.');

