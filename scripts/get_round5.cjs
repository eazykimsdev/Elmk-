const fs = require('fs');
const readline = require('readline');

const fileStream = fs.createReadStream('C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/.system_generated/logs/transcript_full.jsonl');
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

let found = null;
rl.on('line', (line) => {
  if (line.includes('ROUND 5:')) {
    try {
      const obj = JSON.parse(line);
      if (obj.content && obj.content.includes('ROUND 5:')) {
        found = obj.content;
      }
    } catch(e) {}
  }
});

rl.on('close', () => {
  if (found) {
    if (!fs.existsSync('C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/scratch')) {
      fs.mkdirSync('C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/scratch', { recursive: true });
    }
    fs.writeFileSync('C:/Users/sulma/.gemini/antigravity/brain/f5be3cd0-71c4-424c-95bf-57432296e4fb/scratch/round5_prompt.txt', found);
    console.log('Saved round5_prompt.txt, length:', found.length);
  } else {
    console.log('Not found');
  }
});
