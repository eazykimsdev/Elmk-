/**
 * App entry point. Order matters:
 *   1. restore saved data files from PostgreSQL (the managers read them as soon as they load)
 *   2. optional one-time import from Cloudflare D1
 *   3. start saving data back to PostgreSQL, then start the server
 */
import 'dotenv/config';

// One error must never kill the process. Log and keep running.
process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS] unhandledRejection:', reason instanceof Error ? reason.stack || reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[PROCESS] uncaughtException:', err && err.stack ? err.stack : err);
});
import { restoreDataDir, startDataSync } from './dataSync.js';
import { importD1IfRequested } from './importD1.js';
import { runLegacyKeysMigration } from './scripts/migrate_strip_legacy_keys.mjs';

try {
  await restoreDataDir();
} catch (err) {
  console.warn('[BOOTSTRAP] Data restore notice:', err.message);
}
try { runLegacyKeysMigration(); } catch {}
try { await importD1IfRequested(); } catch {}
try { startDataSync(); } catch {}
await import('./server.js');
