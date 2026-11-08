/**
 * Cleanup script to drop legacy_* tables after the 30-day post-migration retention period.
 * 
 * Usage:
 *   node scripts/db/cleanup_legacy_tables.mjs [--force]
 */

import pg from 'pg';
import { config } from 'dotenv';

config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('[INFO] No DATABASE_URL set. Nothing to drop.');
  process.exit(0);
}

const force = process.argv.includes('--force');

async function cleanup() {
  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'legacy_%';
    `);

    const legacyTables = res.rows.map(r => r.table_name);
    console.log(`Found ${legacyTables.length} legacy tables:`, legacyTables);

    if (!force) {
      console.log('\n[DRY RUN] Pass --force to execute DROP TABLE on these legacy tables.');
      return;
    }

    for (const tbl of legacyTables) {
      await client.query(`DROP TABLE IF EXISTS "${tbl}" CASCADE;`);
      console.log(`  • Dropped: ${tbl}`);
    }
    console.log('\n[SUCCESS] Legacy tables cleaned up.');
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup().catch(console.error);

