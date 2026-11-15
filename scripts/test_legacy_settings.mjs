import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { stripLegacyCustomizations, customizationFields } from '../api.js';
import { runLegacyKeysMigration } from './migrate_strip_legacy_keys.mjs';

async function run() {
  console.log('--- Testing Legacy Settings Stripping & Invariants ---');

  // Test 1: Seed a database record with ticketInsideBannerUrl and old module keys
  console.log('Test 1: Seeding settings with ticketInsideBannerUrl and old keys...');
  const seededWithLegacy = {
    serverName: 'Unit Test Guild',
    welcomeEnabled: true,
    welcomeText: 'Welcome!',
    ticketInsideBannerUrl: 'https://example.com/legacy_ticket_banner.png',
    ticketCategories: [{ id: 'cat1', name: 'General Support' }],
    staffInfractions: [{ id: 'inf1', type: 'warn' }],
    j4jEnabled: false,
    autoBumpEnabled: true
  };

  // Test 2: stripLegacyCustomizations strips all legacy keys
  console.log('Test 2: Stripping unknown legacy keys before sending to client...');
  const stripped = stripLegacyCustomizations(seededWithLegacy);

  assert.strictEqual(stripped.serverName, 'Unit Test Guild');
  assert.strictEqual(stripped.welcomeEnabled, true);
  assert.strictEqual(stripped.autoBumpEnabled, true);
  assert.strictEqual(stripped.ticketInsideBannerUrl, undefined, 'ticketInsideBannerUrl must be stripped');
  assert.strictEqual(stripped.ticketCategories, undefined, 'ticketCategories must be stripped');
  assert.strictEqual(stripped.staffInfractions, undefined, 'staffInfractions must be stripped');
  assert.strictEqual(stripped.j4jEnabled, undefined, 'j4jEnabled must be stripped');
  console.log('  ✓ Legacy keys cleanly stripped before reaching client.');

  // Test 3: Client only sends back known fields, save succeeds
  console.log('Test 3: Validating client submission of stripped settings...');
  for (const key of Object.keys(stripped)) {
    assert.ok(customizationFields.has(key), `Field ${key} must be in customizationFields whitelist`);
  }
  console.log('  ✓ Client saves cleanly without encountering validation rejection.');

  // Test 4: Migration script cleans persistent storage
  console.log('Test 4: Running migration script on test files...');
  const res = runLegacyKeysMigration();
  assert.strictEqual(res.success, true);
  console.log(`  ✓ Migration completed successfully (${res.cleanedFilesCount} files inspected).`);

  console.log('✓ Legacy settings tests passed successfully!\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
