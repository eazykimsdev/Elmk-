/**
 * scripts/test_maintenance_lifecycle.mjs
 *
 * Comprehensive Maintenance Lifecycle Verification:
 * 1. Default migration leaves maintenance OFF
 * 2. Switch ON blocks normal users and allows admins
 * 3. Switch OFF recovers immediately without a server restart
 * 4. A scheduled window with no end date does not block forever
 * 5. EMERGENCY KILL SWITCH (MAINTENANCE_FORCE_OFF=true) overrides database state
 * 6. /healthz and /status always return 200 during maintenance
 * 7. Discord login and /admin-portal routes never return 503 during maintenance
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(process.cwd(), 'data');
const SITE_STATE_FILE = path.join(DATA_DIR, 'site_state.json');

import {
  isMaintenanceActive,
  loadSiteState,
  saveSiteState,
  invalidateSiteStateCache
} from '../siteStateManager.js';
import {
  getMaintenanceStatus,
  setMaintenanceStatus
} from '../adminManager.js';
import { runLegacyKeysMigration } from './migrate_strip_legacy_keys.mjs';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log('--- Testing Maintenance Lifecycle & Invariants ---');

  // Backup existing site_state.json if present
  let originalState = null;
  if (fs.existsSync(SITE_STATE_FILE)) {
    try {
      originalState = fs.readFileSync(SITE_STATE_FILE, 'utf8');
    } catch {}
  }

  try {
    // ── Test 1: Default migration leaves maintenance OFF ────────────────────────
    console.log('\n[Test 1] Default migration leaves maintenance OFF:');
    // Ensure clean state
    if (fs.existsSync(SITE_STATE_FILE)) {
      fs.unlinkSync(SITE_STATE_FILE);
    }
    invalidateSiteStateCache();
    runLegacyKeysMigration();

    assert(fs.existsSync(SITE_STATE_FILE), 'site_state.json created by migration');
    const migratedState = loadSiteState();
    assert(migratedState.maintenance_on === false, 'migratedState.maintenance_on is false');
    assert(migratedState.mode === 'operational', 'migratedState.mode is operational');
    const activeCheck = isMaintenanceActive();
    assert(activeCheck.active === false, 'isMaintenanceActive().active is false by default');

    // ── Test 2: Scheduled window with NO end date does not block forever ────────
    console.log('\n[Test 2] Scheduled window with no end date does not block forever:');
    saveSiteState({
      maintenance_on: false,
      starts_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      ends_at: null // No end date
    }, { username: 'TestAdmin' });
    invalidateSiteStateCache();

    const noEndCheck = isMaintenanceActive();
    assert(noEndCheck.active === false, 'Scheduled window without ends_at does NOT trigger maintenance');

    // Scheduled window with expired end date does not block
    saveSiteState({
      maintenance_on: false,
      starts_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      ends_at: new Date(Date.now() - 3600000).toISOString()    // 1 hour ago (expired)
    }, { username: 'TestAdmin' });
    invalidateSiteStateCache();

    const expiredCheck = isMaintenanceActive();
    assert(expiredCheck.active === false, 'Expired scheduled window does NOT trigger maintenance');

    // Scheduled window within valid range DOES trigger maintenance
    saveSiteState({
      maintenance_on: false,
      starts_at: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
      ends_at: new Date(Date.now() + 1800000).toISOString()    // 30 mins in future
    }, { username: 'TestAdmin' });
    invalidateSiteStateCache();

    const validWindowCheck = isMaintenanceActive();
    assert(validWindowCheck.active === true, 'Valid scheduled window between start and end triggers maintenance');
    assert(validWindowCheck.scheduled === true, 'Flagged as scheduled maintenance');

    // ── Test 3: Emergency kill switch (MAINTENANCE_FORCE_OFF) ───────────────────
    console.log('\n[Test 3] Emergency Kill Switch (MAINTENANCE_FORCE_OFF=true):');
    // Set manual maintenance ON in database
    saveSiteState({
      maintenance_on: true,
      mode: 'maintenance',
      starts_at: null,
      ends_at: null
    }, { username: 'TestAdmin' });
    invalidateSiteStateCache();

    assert(isMaintenanceActive().active === true, 'Maintenance is active before force kill');

    // Enable emergency kill switch
    process.env.MAINTENANCE_FORCE_OFF = 'true';
    invalidateSiteStateCache();

    const forceOffCheck = isMaintenanceActive();
    assert(forceOffCheck.active === false, 'isMaintenanceActive is FALSE with MAINTENANCE_FORCE_OFF=true');
    assert(forceOffCheck.forced_off === true, 'forced_off flag is set');

    const statusCheck = getMaintenanceStatus();
    assert(statusCheck.maintenance === false, 'getMaintenanceStatus().maintenance is false with kill switch');
    assert(statusCheck.mode === 'operational', 'getMaintenanceStatus().mode is operational with kill switch');

    // Disable emergency kill switch
    delete process.env.MAINTENANCE_FORCE_OFF;
    invalidateSiteStateCache();

    // ── Test 4: Switch ON blocks normal users and allows admins ─────────────────
    console.log('\n[Test 4] Switch ON blocks normal users & allows admins via Express app:');
    // Set maintenance ON
    setMaintenanceStatus({
      mode: 'maintenance',
      title: 'Scheduled Upgrade',
      message: 'ConnectingERLC is currently undergoing scheduled platform upgrades.',
      actor: { username: 'TestAdmin' }
    });
    invalidateSiteStateCache();

    assert(isMaintenanceActive().active === true, 'Maintenance confirmed ON via setMaintenanceStatus');

    // Start a test Express instance to test actual HTTP requests
    const appModule = await import('../server.js');
    const app = appModule.default;

    const testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(0, resolve));
    const port = testServer.address().port;

    try {
      // 4A: Normal visitor hitting public /api/directory receives 503 during maintenance
      const visitorRes = await fetch(`http://127.0.0.1:${port}/api/directory`);
      assert(visitorRes.status === 503, `Normal visitor API returns 503 (got ${visitorRes.status})`);
      const visitorBody = await visitorRes.json();
      assert(visitorBody.code === 'MAINTENANCE', '503 response has code: MAINTENANCE');
      assert(visitorBody.maintenance?.active === true, '503 payload includes maintenance details');

      // 4B: Health check /healthz returns 200 during maintenance
      const healthzRes = await fetch(`http://127.0.0.1:${port}/healthz`);
      assert(healthzRes.status === 200, `Health check /healthz returns 200 during maintenance (got ${healthzRes.status})`);

      // 4C: Public status /api/status returns 200 during maintenance
      const statusRes = await fetch(`http://127.0.0.1:${port}/api/status`);
      assert(statusRes.status === 200, `/api/status returns 200 during maintenance (got ${statusRes.status})`);

      // 4D: Public site state /api/public/site-state returns 200 during maintenance
      const publicStateRes = await fetch(`http://127.0.0.1:${port}/api/public/site-state`);
      assert(publicStateRes.status === 200, `/api/public/site-state returns 200 during maintenance (got ${publicStateRes.status})`);

      // 4E: Discord login routes do NOT return 503 during maintenance
      const authMeRes = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
      assert(authMeRes.status !== 503, `/api/auth/me does not return 503 (got ${authMeRes.status})`);

      // 4F: Admin check route /api/admin/check does NOT return 503 during maintenance
      const adminCheckRes = await fetch(`http://127.0.0.1:${port}/api/admin/check`);
      assert(adminCheckRes.status !== 503, `/api/admin/check does not return 503 (got ${adminCheckRes.status})`);

      // 4G: Authenticated admin can access APIs during maintenance
      // Inject admin session into web_sessions.json
      const SESSIONS_FILE = path.join(DATA_DIR, 'web_sessions.json');
      const testSessionId = 'test_maint_admin_' + Date.now();
      let currentSessions = {};
      try {
        if (fs.existsSync(SESSIONS_FILE)) {
          currentSessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
        }
      } catch {}
      currentSessions[testSessionId] = {
        sessionId: testSessionId,
        user: {
          id: '523693281541095424',
          username: 'MainAdmin',
          globalName: 'MainAdmin'
        },
        expiresAtSession: Date.now() + 86400000
      };
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(currentSessions, null, 2), 'utf8');

      const adminRes = await fetch(`http://127.0.0.1:${port}/api/admin/maintenance`, {
        headers: {
          'Cookie': `connectingerlc_session=${testSessionId}`
        }
      });
      assert(adminRes.status === 200, `Admin session accesses /api/admin/maintenance during maintenance (got ${adminRes.status})`);

      // ── Test 5: Switch OFF recovers immediately without restart ─────────────────
      console.log('\n[Test 5] Switch OFF recovers immediately without restart:');
      const toggleOffRes = await fetch(`http://127.0.0.1:${port}/api/admin/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `connectingerlc_session=${testSessionId}`
        },
        body: JSON.stringify({ mode: 'operational' })
      });
      assert(toggleOffRes.status === 200, `Admin toggles maintenance OFF via API (got ${toggleOffRes.status})`);

      assert(isMaintenanceActive().active === false, 'isMaintenanceActive().active is false immediately');

      // Normal visitor can now access public directory with 200 OK
      const recoveredRes = await fetch(`http://127.0.0.1:${port}/api/directory`);
      assert(recoveredRes.status === 200, `Normal visitor API returns 200 after recovery (got ${recoveredRes.status})`);

    } finally {
      testServer.close();
    }

    console.log('\n✅ ALL 6 MAINTENANCE LIFECYCLE TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } finally {
    // Restore or reset site_state.json to operational
    setMaintenanceStatus({
      mode: 'operational',
      title: '',
      message: '',
      actor: { username: 'SystemCleanup' }
    });
    delete process.env.MAINTENANCE_FORCE_OFF;
    invalidateSiteStateCache();
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
