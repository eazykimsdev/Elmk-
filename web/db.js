import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

let pool = null;
let isConnected = false;

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL || null;

if (DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: parseInt(process.env.PG_POOL_MAX || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[DATABASE] Unexpected idle client error on PostgreSQL pool:', err);
    });

    // Test initial connection asynchronously
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.warn('[DATABASE] PostgreSQL connection failed, falling back to JSON storage mode:', err.message);
        isConnected = false;
      } else {
        isConnected = true;
        console.log('[DATABASE] Connected to PostgreSQL at', res.rows[0]?.now);
      }
    });
  } catch (err) {
    console.warn('[DATABASE] Error initializing PostgreSQL pool, falling back to JSON storage mode:', err.message);
    pool = null;
  }
} else {
  console.log('[DATABASE] DATABASE_URL not set. Running in local JSON storage mode.');
}

/** Execute a parameterized SQL query with automatic client release */
export async function query(text, params = []) {
  if (!pool || !isConnected) {
    return null; // Signals caller to use JSON file fallback
  }
  return pool.query(text, params);
}

/** Check if PostgreSQL pool is active and operational */
export function isPostgresConnected() {
  return Boolean(pool && isConnected);
}

/** Get raw pool instance */
export function getPool() {
  return pool;
}

/**
 * Initialize PostgreSQL tables matching the Cloudflare D1 schema
 */
export async function initPostgresSchema() {
  if (!pool) return false;
  const sql = `
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      username VARCHAR(128) NOT NULL,
      avatar VARCHAR(128),
      guilds JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

    CREATE TABLE IF NOT EXISTS network (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(256) NOT NULL,
      icon TEXT,
      banner TEXT,
      members INT NOT NULL DEFAULT 0,
      ad TEXT,
      invite TEXT,
      tier VARCHAR(64),
      weekly INT NOT NULL DEFAULT 0,
      bumps INT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS affiliates (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(256) NOT NULL,
      icon TEXT,
      banner TEXT,
      splash TEXT,
      members INT NOT NULL DEFAULT 0,
      online INT NOT NULL DEFAULT 0,
      description TEXT,
      category VARCHAR(128),
      invite TEXT NOT NULL,
      owner_id VARCHAR(64),
      featured INT NOT NULL DEFAULT 0,
      added_by VARCHAR(64),
      added_at BIGINT NOT NULL,
      refreshed_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id BIGSERIAL PRIMARY KEY,
      guild_id VARCHAR(64) NOT NULL,
      guild_name VARCHAR(256) NOT NULL,
      guild_icon TEXT,
      invite TEXT NOT NULL,
      members INT NOT NULL DEFAULT 0,
      category VARCHAR(128),
      description TEXT NOT NULL,
      reason TEXT NOT NULL,
      applicant_id VARCHAR(64) NOT NULL,
      applicant_name VARCHAR(128) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      note TEXT,
      created_at BIGINT NOT NULL,
      reviewed_at BIGINT,
      reviewed_by VARCHAR(64)
    );

    CREATE TABLE IF NOT EXISTS guild_config (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(256),
      icon TEXT,
      network_channel VARCHAR(64),
      bump_channel VARCHAR(64),
      ad TEXT,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config_changes (
      id BIGSERIAL PRIMARY KEY,
      guild_id VARCHAR(64) NOT NULL,
      network_channel VARCHAR(64),
      bump_channel VARCHAR(64),
      ad TEXT,
      requested_by VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at BIGINT NOT NULL,
      applied_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS guild_stats (
      id VARCHAR(64) PRIMARY KEY,
      members INT NOT NULL DEFAULT 0,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_ledger (
      id BIGSERIAL PRIMARY KEY,
      guild_id VARCHAR(64) NOT NULL,
      amount INT NOT NULL,
      reason VARCHAR(64) NOT NULL,
      note TEXT,
      user_id VARCHAR(64),
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkins (
      guild_id VARCHAR(64) NOT NULL,
      day INT NOT NULL,
      streak INT NOT NULL,
      reward INT NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (guild_id, day)
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id BIGSERIAL PRIMARY KEY,
      guild_id VARCHAR(64) NOT NULL,
      plan VARCHAR(64) NOT NULL,
      starts_at BIGINT NOT NULL,
      ends_at BIGINT NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_views (
      guild_id VARCHAR(64) NOT NULL,
      day INT NOT NULL,
      visitor VARCHAR(128) NOT NULL,
      PRIMARY KEY (guild_id, day, visitor)
    );

    CREATE TABLE IF NOT EXISTS join_clicks (
      guild_id VARCHAR(64) NOT NULL,
      day INT NOT NULL,
      visitor VARCHAR(128) NOT NULL,
      PRIMARY KEY (guild_id, day, visitor)
    );

    CREATE TABLE IF NOT EXISTS partnerships (
      id BIGSERIAL PRIMARY KEY,
      from_guild VARCHAR(64) NOT NULL,
      to_guild VARCHAR(64) NOT NULL,
      message TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      requested_by VARCHAR(64) NOT NULL,
      responded_by VARCHAR(64),
      created_at BIGINT NOT NULL,
      responded_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      guild_id VARCHAR(64) NOT NULL,
      kind VARCHAR(64) NOT NULL,
      text TEXT NOT NULL,
      link TEXT,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listing (
      id VARCHAR(64) PRIMARY KEY,
      category VARCHAR(128),
      tagline VARCHAR(256),
      description TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      language VARCHAR(32) DEFAULT 'English',
      accent VARCHAR(64),
      hidden INT NOT NULL DEFAULT 0,
      partner_open INT NOT NULL DEFAULT 1,
      partner_note TEXT,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      guild_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      user_name VARCHAR(128) NOT NULL,
      user_avatar TEXT,
      rating INT NOT NULL,
      text TEXT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS meta (
      k VARCHAR(128) PRIMARY KEY,
      v TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      who VARCHAR(128) NOT NULL,
      at BIGINT NOT NULL
    );
  `;

  try {
    await pool.query(sql);
    console.log('[DATABASE] PostgreSQL schema initialized successfully.');
    return true;
  } catch (err) {
    console.error('[DATABASE] Error initializing schema:', err);
    return false;
  }
}

