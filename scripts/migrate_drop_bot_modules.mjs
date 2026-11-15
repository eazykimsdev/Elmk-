import fs from 'fs';
import path from 'path';

console.log('=== MIGRATION: Drop Obsolete Bot Modules ===');
const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups', 'pre_round10_modules');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

const FILES_TO_DROP = [
  'tickets.json',
  'ticket_desk.json',
  'ticket_panels.json',
  'applications.json',
  'department_panels.json'
];

console.log('Files identified to drop:');
for (const file of FILES_TO_DROP) {
  const filePath = path.join(DATA_DIR, file);
  if (fs.existsSync(filePath)) {
    // Backup first
    fs.copyFileSync(filePath, path.join(BACKUPS_DIR, file));
    // Remove obsolete file
    fs.unlinkSync(filePath);
    console.log(`✓ Backed up and dropped: data/${file}`);
  } else {
    console.log(`- File data/${file} already absent.`);
  }
}

console.log('Migration completed successfully.');

