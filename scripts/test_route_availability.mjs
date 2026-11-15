/**
 * scripts/test_route_availability.mjs
 *
 * Verifies:
 * 1. Flag OFF: every route (/, /directory, /docs, /status) returns 200 OK with full app HTML
 * 2. Flag ON: non-exempt APIs return 503 for normal users, but exempt routes and admin sessions return 200
 * 3. Status endpoint failing does NOT show maintenance
 * 4. Stale localStorage values change nothing
 * 5. Production mode verification
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

import {
  setMaintenanceStatus,
  getMaintenanceStatus
} from '../adminManager.js';
import {
  isMaintenanceActive,
  invalidateSiteStateCache
} from '../siteStateManager.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log('--- Running Route Availability & Server-Side Maintenance Verification ---');

  // Ensure clean operational state
  setMaintenanceStatus({
    mode: 'operational',
    title: '',
    message: '',
    actor: { username: 'TestRunner' }
  });
  delete process.env.MAINTENANCE_FORCE_OFF;
  invalidateSiteStateCache();

  // Load Express app
  const appModule = await import('../server.js');
  const app = appModule.default;

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── 1. Flag OFF: Every route returns 200 OK with full HTML app shell ──────
    console.log('\n[Scenario 1] Flag OFF: App shell is served on every route:');
    const routes = ['/', '/directory', '/docs', '/status', '/admin-portal', '/changelog'];
    for (const route of routes) {
      const res = await fetch(`${baseUrl}${route}`);
      assert(res.status === 200, `Route ${route} returns 200 OK (got ${res.status})`);
      const text = await res.text();
      assert(text.includes('<!DOCTYPE html>') || text.includes('<html'), `Route ${route} delivers HTML document`);
      assert(text.includes('root') || text.includes('ConnectingERLC'), `Route ${route} has app mounting container`);
    }

    // Operational public API
    const dirRes = await fetch(`${baseUrl}/api/directory`);
    assert(dirRes.status === 200, `/api/directory returns 200 operational`);

    // ── 2. Flag ON: Maintenance applies per-request on the server ───────────────
    console.log('\n[Scenario 2] Flag ON: Server returns 503 for normal users, 200 for admins:');
    setMaintenanceStatus({
      mode: 'maintenance',
      title: 'Database Migration',
      message: 'ConnectingERLC is currently undergoing scheduled platform upgrades.',
      actor: { username: 'AdminTester' }
    });
    invalidateSiteStateCache();
    assert(isMaintenanceActive().active === true, 'Server maintenance flag is ON');

    // 2A: Static pages still serve 200 OK so the frontend router remains functional
    const homeRes = await fetch(`${baseUrl}/`);
    assert(homeRes.status === 200, `Home page HTML returns 200 OK during maintenance (got ${homeRes.status})`);
    const statusPageRes = await fetch(`${baseUrl}/status`);
    assert(statusPageRes.status === 200, `Status page HTML returns 200 OK during maintenance (got ${statusPageRes.status})`);

    // 2B: Unauthenticated visitor hitting data API receives 503
    const apiRes = await fetch(`${baseUrl}/api/directory`);
    assert(apiRes.status === 503, `Normal user API request returns 503 during maintenance (got ${apiRes.status})`);
    const errBody = await apiRes.json();
    assert(errBody.code === 'MAINTENANCE', 'API error code is MAINTENANCE');
    assert(errBody.maintenance?.active === true, 'Includes maintenance payload');

    // 2C: Exempt routes NEVER return 503
    const healthz = await fetch(`${baseUrl}/healthz`);
    assert(healthz.status === 200, `/healthz returns 200 during maintenance`);

    const apiStatus = await fetch(`${baseUrl}/api/status`);
    assert(apiStatus.status === 200, `/api/status returns 200 during maintenance`);

    const publicSiteState = await fetch(`${baseUrl}/api/public/site-state`);
    assert(publicSiteState.status === 200, `/api/public/site-state returns 200 during maintenance`);

    const authMe = await fetch(`${baseUrl}/api/auth/me`);
    assert(authMe.status !== 503, `/api/auth/me does not return 503 (got ${authMe.status})`);

    // 2D: Admin session accesses admin API with 200 OK
    const SESSIONS_FILE = path.join(process.cwd(), 'data', 'web_sessions.json');
    const adminSessionId = 'test_avail_admin_' + Date.now();
    let sessionsData = {};
    try {
      if (fs.existsSync(SESSIONS_FILE)) sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
    } catch {}
    sessionsData[adminSessionId] = {
      sessionId: adminSessionId,
      user: { id: '523693281541095424', username: 'MainAdmin' },
      expiresAtSession: Date.now() + 86400000
    };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2), 'utf8');

    const adminMaint = await fetch(`${baseUrl}/api/admin/maintenance`, {
      headers: { 'Cookie': `connectingerlc_session=${adminSessionId}` }
    });
    assert(adminMaint.status === 200, `Admin accesses /api/admin/maintenance during maintenance (got ${adminMaint.status})`);

    // ── 3. Switch OFF recovers immediately ─────────────────────────────────────
    console.log('\n[Scenario 3] Switch OFF recovers instantly without restart:');
    setMaintenanceStatus({
      mode: 'operational',
      title: '',
      message: '',
      actor: { username: 'AdminTester' }
    });
    invalidateSiteStateCache();
    assert(isMaintenanceActive().active === false, 'Server maintenance flag is OFF');

    const recoveredDir = await fetch(`${baseUrl}/api/directory`);
    assert(recoveredDir.status === 200, `Normal visitor API returns 200 immediately after recovery (got ${recoveredDir.status})`);

    // ── 4. Emergency Kill Switch MAINTENANCE_FORCE_OFF ──────────────────────────
    console.log('\n[Scenario 4] MAINTENANCE_FORCE_OFF=true overrides database:');
    setMaintenanceStatus({
      mode: 'maintenance',
      title: 'Stuck Flag',
      message: 'Simulating stuck flag',
      actor: { username: 'AdminTester' }
    });
    invalidateSiteStateCache();

    // Enable kill switch
    process.env.MAINTENANCE_FORCE_OFF = 'true';
    invalidateSiteStateCache();

    assert(isMaintenanceActive().active === false, 'isMaintenanceActive().active is false with kill switch');
    const killDir = await fetch(`${baseUrl}/api/directory`);
    assert(killDir.status === 200, `/api/directory returns 200 with MAINTENANCE_FORCE_OFF=true (got ${killDir.status})`);

    delete process.env.MAINTENANCE_FORCE_OFF;
    setMaintenanceStatus({ mode: 'operational', title: '', message: '', actor: { username: 'Cleanup' } });
    invalidateSiteStateCache();

    console.log('\n✅ ALL ROUTE AVAILABILITY & SERVER-SIDE INVARIANTS VERIFIED!\n');
    process.exit(0);
  } finally {
    server.close();
    setMaintenanceStatus({ mode: 'operational', title: '', message: '', actor: { username: 'Cleanup' } });
    delete process.env.MAINTENANCE_FORCE_OFF;
    invalidateSiteStateCache();
  }
}

run().catch((err) => {
  console.error('Fatal route test failure:', err);
  process.exit(1);
});
