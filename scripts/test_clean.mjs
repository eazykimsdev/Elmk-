export function robustCleanSqlReplace(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str.trim();

  let iterations = 0;
  while (iterations < 5 && /^\s*replace\s*\(/i.test(s)) {
    iterations++;
    s = s.replace(/^\s*replace\s*\(\s*/i, '');
    
    // Look for matching or trailing ,'\n',char(10)) or ,\n,char(10)) or ,char(10)) or )
    s = s.replace(/,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*\)*\s*$/i, '');
    s = s.replace(/,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*\)*\s*$/i, '');
    if (s.endsWith(')')) {
      s = s.slice(0, -1);
    }
    s = s.trim();
    // Unwrap quotes if string was wrapped in single or double quotes
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
      s = s.slice(1, -1);
    }
  }

  // Also clean any stray trailing SQL artifacts
  s = s.replace(/,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*,\s*(?:'[^']*'|"[^"]*"|char\(\d+\)|\\[rn]|\r?\n)\s*\)*\s*$/gi, '');
  s = s.replace(/,\s*(?:char\(\d+\)|\\[rn]|\r?\n)\s*\)*\s*$/gi, '');
  s = s.replace(/['"]?\s*,\s*char\(\d+\)\s*\)*\s*$/gi, '');
  
  // Unwrap unescaped quotes if left
  if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1);
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);

  // Replace literal string "\n" or "\r\n" with real newlines
  s = s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  return s.trim();
}

const test1 = "replace('✈️ 🇶🇦 QATAR AIRWAYS PROJECT FLIGHT IS RECRUITING!!! 🇶🇦 ✈️\\n\\nLooking for a realistic', '\\n', char(10))";
const test2 = "replace(# MOTION DESIGNS | PROFESSIONAL CREATIVE SERVICES\\n\\nLooking for high-quality designs,\\n,char(10))";
const test3 = "replace(PromotingERLC \\n\\n\\n• A Server where you're guaranteed to Grow,\\n,char(10))";

console.log('--- TEST 1 ---');
console.log(robustCleanSqlReplace(test1));
console.log('--- TEST 2 ---');
console.log(robustCleanSqlReplace(test2));
console.log('--- TEST 3 ---');
console.log(robustCleanSqlReplace(test3));

