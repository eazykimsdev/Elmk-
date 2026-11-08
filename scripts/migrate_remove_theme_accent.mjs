import fs from 'fs';
import path from 'path';

function migrateSettingsFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    let changed = false;

    for (const key of Object.keys(data)) {
      if (data[key] && typeof data[key] === 'object') {
        if ('theme_accent' in data[key]) {
          delete data[key].theme_accent;
          changed = true;
        }
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[MIGRATION] Stripped theme_accent from ${filePath}`);
    } else {
      console.log(`[MIGRATION] No theme_accent found in ${filePath}`);
    }
  } catch (err) {
    console.error(`[MIGRATION] Failed to migrate ${filePath}:`, err);
  }
}

migrateSettingsFile('data/user_settings.json');
migrateSettingsFile('web/data/user_settings.json');

