import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getMaintenanceStatus, setMaintenanceStatus } from '../adminManager.js';
import { loadSiteState, saveSiteState } from '../siteStateManager.js';

async function run() {
  console.log('--- Testing Admin Tabs & Maintenance Invariants ---');

  // Test 1: getMaintenanceStatus returns safe non-null object with all required properties
  console.log('Test 1: getMaintenanceStatus default structure verification...');
  const status = getMaintenanceStatus();
  assert.ok(status && typeof status === 'object', 'Status must be an object');
  assert.strictEqual(typeof status.mode, 'string', 'mode must be string');
  assert.strictEqual(typeof status.maintenance, 'boolean', 'maintenance must be boolean');
  assert.strictEqual(typeof status.maintenance_on, 'boolean', 'maintenance_on must be boolean');
  assert.strictEqual(typeof status.title, 'string', 'title must be string');
  assert.strictEqual(typeof status.message, 'string', 'message must be string');
  assert.ok(Array.isArray(status.affectedServices), 'affectedServices must be array');
  assert.ok(Array.isArray(status.allowedUserIds), 'allowedUserIds must be array');
  console.log('  ✓ getMaintenanceStatus returns fully compliant schema.');

  // Test 2: setMaintenanceStatus updates unified data/site_state.json
  console.log('Test 2: setMaintenanceStatus persistence & schema verification...');
  const updated = setMaintenanceStatus({
    mode: 'maintenance',
    title: 'Test Maintenance',
    message: 'Testing maintenance mode persistence.',
    affectedServices: ['directory', 'webhooks'],
    actor: { username: 'AdminTester' }
  });
  assert.strictEqual(updated.mode, 'maintenance');
  assert.strictEqual(updated.maintenance, true);
  assert.strictEqual(updated.title, 'Test Maintenance');

  // Verify siteStateManager reads the same site_state.json
  const siteState = loadSiteState();
  assert.strictEqual(siteState.maintenance_on, true, 'siteStateManager reflects maintenance_on = true');
  console.log('  ✓ adminManager and siteStateManager unified on single site_state.json.');

  // Reset back to operational
  setMaintenanceStatus({
    mode: 'operational',
    title: '',
    message: '',
    actor: { username: 'AdminTester' }
  });
  assert.strictEqual(getMaintenanceStatus().mode, 'operational');
  console.log('  ✓ Restored to operational mode.');

  // Test 3: Test admin endpoints / data managers with empty state
  console.log('Test 3: Testing admin endpoints against empty state...');
  const { loadBannedUsers, loadReports, loadFlags, loadAuditLog } = await import('../adminManager.js');
  const { getAllPromoCodes } = await import('../promoCodeManager.js');

  assert.ok(Array.isArray(loadBannedUsers()), 'Banned users safe array');
  assert.ok(Array.isArray(loadReports()), 'Reports safe array');
  assert.ok(Array.isArray(loadFlags()), 'Flags safe array');
  assert.ok(Array.isArray(loadAuditLog()), 'Audit log safe array');
  assert.ok(Array.isArray(getAllPromoCodes()), 'Promo codes safe array');
  console.log('  ✓ All admin manager domains return safe fallbacks.');

  console.log('✓ All Admin Tab & Maintenance tests passed successfully!\n');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
