import fs from 'fs';
const text = fs.readFileSync('C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/.system_generated/logs/transcript_full.jsonl', 'utf8');
const idx = text.indexOf('ROUND 11:');
console.log(text.substring(idx, idx + 5000));

