import fs from 'fs';
import path from 'path';

const dirsToScan = ['src', 'web/src'];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Exact hex replacements
  const replacements = [
    // theme greens
    [/#3DDC97\/12/g, 'var(--accent-soft)'],
    [/#3DDC97\/15/g, 'var(--accent-soft)'],
    [/#3DDC97\/20/g, 'var(--accent-soft)'],
    [/#3DDC97\/25/g, 'var(--accent-border)'],
    [/#3DDC97\/40/g, 'var(--accent-border)'],
    [/#3DDC97/gi, 'var(--accent)'],
    [/#34D399/gi, 'var(--accent)'],
    [/#34c988/gi, 'var(--accent-hover)'],
    [/#10B981/gi, 'var(--accent)'],
    [/#22C55E/gi, 'var(--accent)'],
    [/#052E1A/gi, 'var(--accent-foreground)'],
    [/rgba\(61,\s*220,\s*151,\s*0\.12\)/gi, 'var(--accent-soft)'],
    [/rgba\(61,\s*220,\s*151,\s*0\.15\)/gi, 'var(--accent-soft)'],
    [/rgba\(61,\s*220,\s*151,\s*0\.2\)/gi, 'var(--accent-soft)'],
    [/rgba\(61,\s*220,\s*151,\s*0\.35\)/gi, 'var(--accent-border)'],
    [/rgba\(61,\s*220,\s*151,\s*0\.4\)/gi, 'var(--accent-border)'],
    [/rgba\(61,\s*220,\s*151[^\)]*\)/gi, 'var(--accent)'],
    [/rgba\(52,\s*211,\s*153[^\)]*\)/gi, 'var(--accent)'],
    [/rgba\(16,\s*185,\s*129[^\)]*\)/gi, 'var(--accent)'],
    // emerald tailwind classes to accent
    [/text-emerald-400/g, 'text-[var(--accent)]'],
    [/text-emerald-500/g, 'text-[var(--accent)]'],
    [/bg-emerald-500\/10/g, 'bg-[var(--accent-soft)]'],
    [/bg-emerald-500\/15/g, 'bg-[var(--accent-soft)]'],
    [/bg-emerald-500\/20/g, 'bg-[var(--accent-soft)]'],
    [/bg-emerald-500\/30/g, 'bg-[var(--accent-soft)]'],
    [/bg-emerald-500\/50/g, 'bg-[var(--accent-soft)]'],
    [/bg-emerald-400/g, 'bg-[var(--accent)]'],
    [/bg-emerald-500/g, 'bg-[var(--accent)]'],
    [/border-emerald-500\/20/g, 'border-[var(--accent-border)]'],
    [/border-emerald-500\/30/g, 'border-[var(--accent-border)]'],
    [/border-emerald-500\/50/g, 'border-[var(--accent-border)]'],
    [/border-emerald-500/g, 'border-[var(--accent)]'],
    [/border-emerald-400/g, 'border-[var(--accent)]'],
    [/ring-emerald-500/g, 'ring-[var(--accent)]'],
    [/focus-within:border-emerald-500\/50/g, 'focus-within:border-[var(--accent-border)]'],
    // green tailwind classes
    [/text-green-400/g, 'text-[var(--accent)]'],
    [/text-green-500/g, 'text-[var(--accent)]'],
    [/bg-green-500\/10/g, 'bg-[var(--accent-soft)]'],
    [/bg-green-500\/15/g, 'bg-[var(--accent-soft)]'],
    [/bg-green-500\/20/g, 'bg-[var(--accent-soft)]'],
    [/bg-green-500/g, 'bg-[var(--accent)]'],
    [/border-green-500\/20/g, 'border-[var(--accent-border)]'],
    [/border-green-500\/30/g, 'border-[var(--accent-border)]'],
    [/border-green-500/g, 'border-[var(--accent)]'],
  ];

  for (const [regex, rep] of replacements) {
    if (regex.test(content)) {
      content = content.replace(regex, rep);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Replaced green in:', filePath);
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(entry.name)) {
      replaceInFile(full);
    }
  }
}

for (const d of dirsToScan) {
  if (fs.existsSync(d)) walk(d);
}

console.log('Finished green replacement scan.');

