/**
 * Lint Test: Disallow text-based divider strings in bot message payloads
 * 
 * Invariant:
 * Strictly forbidden in bot messages: "───", "━", "═", "___", "---".
 * Scans bot codebase files and fails if any Discord message payload or template
 * contains 3 or more consecutive dashes, underscores, or box-drawing characters.
 */

import fs from 'fs';
import path from 'path';

const targetFiles = [
  'botCommands.js',
  'bumpReminderManager.js',
  'discordNotificationManager.js',
  'botGateway.js',
  'checkinReminderManager.js',
  'streakAlertManager.js',
  'accountDeletionManager.js'
];

console.log('--- Scanning bot codebase for forbidden text-based dividers ---');

// Matches 3 or more consecutive box-drawing horizontal lines, dashes, or underscores in string contents
const forbiddenDividerRegex = /["'`][^"'`]*?(───+|━━━+|═══+|---|___)[^"'`]*?["'`]/g;

let violationsCount = 0;

for (const file of targetFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    // Skip comment-only lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    // Check for matches in code string literals
    const matches = line.match(forbiddenDividerRegex);
    if (matches) {
      // Exclude markdown headings like "# ---" if any
      for (const m of matches) {
        console.error(`❌ Violation in ${file}:${lineIdx + 1}: Found forbidden text divider: ${m.trim()}`);
        violationsCount++;
      }
    }
  });
}

if (violationsCount > 0) {
  console.error(`\nFAILED: Found ${violationsCount} forbidden text divider violation(s).`);
  process.exit(1);
} else {
  console.log('✓ All bot message strings clean: zero text-based dividers found!');
  process.exit(0);
}

