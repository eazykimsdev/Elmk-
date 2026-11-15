import fs from 'fs';

export function cleanSqlReplace(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str.trim();
  
  if (s.startsWith('replace(') && s.endsWith(')')) {
    s = s.slice(8, -1).trim();
    // remove trailing ,\n,char(10) or ,char(10) or ,\r\n,char(10)
    s = s.replace(/,?\s*(?:['"]?\\n['"]?|['"]?\\r\\n['"]?)?\s*,?\s*char\(10\)\s*$/i, '').trim();
    // if wrapped in quotes, unwrap
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      s = s.slice(1, -1);
    }
  }
  
  // Also handle any stray trailing ,\n,char(10)) or char(10)
  s = s.replace(/,?\s*\\n\s*,?\s*char\(10\)\s*\)?$/i, '');
  
  // replace literal escaped \n with actual newlines
  s = s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  return s.trim();
}

const data = JSON.parse(fs.readFileSync('data/promoted_servers.json', 'utf8'));
for (const s of data.servers) {
  console.log('=== BEFORE ===', s.name);
  console.log(s.description.substring(0, 80));
  const cleaned = cleanSqlReplace(s.description);
  console.log('=== AFTER ===');
  console.log(cleaned.substring(0, 80));
  console.log('Ends with:', cleaned.slice(-40));
}

