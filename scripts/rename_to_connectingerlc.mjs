import fs from 'fs';
import path from 'path';

const SRC_DIRS = ['src', 'web/src'];
const ROOT_FILES = [
  'api.js',
  'server.js',
  'directoryManager.js',
  'partnershipsManager.js',
  'reviewsManager.js',
  'erlcManager.js',
  'botManager.js',
  'adminManager.js',
  'README.md',
  'package.json',
  'web/package.json'
];

function getAllFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else if (/\.(tsx?|jsx?|html|json|md)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

let allFiles = [...ROOT_FILES];
for (const d of SRC_DIRS) {
  allFiles = allFiles.concat(getAllFiles(d));
}

// Remove duplicates
allFiles = Array.from(new Set(allFiles)).filter(f => fs.existsSync(f));

console.log(`Processing ${allFiles.length} files for ConnectingERLC rename...`);

let replacedCount = 0;

for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Specific exact replacements
  content = content.replace(/Mavely CAD/g, 'ConnectingERLC');
  content = content.replace(/Mavely US/g, 'ConnectingERLC');
  content = content.replace(/MavelyUS/g, 'ConnectingERLC');
  content = content.replace(/Connecting ERLC/g, 'ConnectingERLC');
  content = content.replace(/Connecting-ERLC/g, 'ConnectingERLC');
  content = content.replace(/Mavely/g, 'ConnectingERLC');
  content = content.replace(/mavely\.us/g, 'connectingerlc.com');
  content = content.replace(/mavely_user/g, 'connectingerlc_user');
  content = content.replace(/mavely_theme/g, 'connectingerlc_theme');
  content = content.replace(/mavely-mark\.png/g, 'brand/logo.png');
  content = content.replace(/mavely_logo\.png/g, 'brand/logo.png');

  // Support CONNECTINGERLC_* env vars with MAVELY_* fallback
  content = content.replace(/process\.env\.MAVELY_([A-Z0-9_]+)/g, '(process.env.CONNECTINGERLC_$1 || process.env.MAVELY_$1)');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    replacedCount++;
    console.log(`Updated: ${filePath}`);
  }
}

console.log(`\nSuccessfully updated ${replacedCount} files with ConnectingERLC brand identity.`);

