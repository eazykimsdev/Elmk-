# ConnectingERLC Data Migration & Database Switch Plan

**Source:** Cloudflare D1 (`connectingerlc-db`) — READ-ONLY  
**Target:** PostgreSQL 16 on Railway (`https://connectingerlc.xyz`)  
**Status:** Phase 1 Design & Schema Mapping  

---

## 1. Safety & Data Integrity Principles

1. **Zero Write Access to Live D1**:
   - Production Cloudflare D1 database `connectingerlc-db` is strictly treated as READ-ONLY.
   - All migrations will be executed solely from exported `.sql` dump files placed in `/migration/`.
2. **Idempotency & Rollback**:
   - Migration scripts are written with `IF NOT EXISTS`, `ON CONFLICT DO UPDATE`, and atomic transactions (`BEGIN ... COMMIT / ROLLBACK`).
   - Every run supports a `--dry-run` parameter that validates foreign keys, primary keys, and data row counts without writing to disk.
3. **No Secrets in Repositories**:
   - Database credentials, `DATABASE_URL`, bot tokens, and session secrets are managed solely via Railway environment variables.

---

## 2. Table-by-Table Schema Mapping (Verified from Live Cloudflare D1)

The live database `connectingerlc-db` contains the following 20 tables:

| D1 Source Table | Target PostgreSQL Table | Purpose & Migration Strategy |
| :--- | :--- | :--- |
| `listing` | `promoted_servers` | Community directory listings: guild ID, name, icon, banner, category, description, summary, invite link, member count, bumps. |
| `reviews` | `reviews` | User reviews and 1-5 star ratings for communities. |
| `partnerships` | `partnerships` | Mutual cross-community alliance proposals, active links, settings. |
| `credit_ledger` | `credit_ledger` | Credit transaction history, bounties, joins, transfers. |
| `guild_config` | `server_configs` | Per-guild configuration, webhook settings, mention settings. |
| `guild_stats` | `guild_stats` | Live telemetry counts: member count, joins, bump recency. |
| `sessions` | `web_sessions` | Web user sessions and authentication tokens. |
| `checkins` | `daily_checkins` | Daily streak history and check-in claims. |
| `promotions` | `promotions` | Premium tier / boosted growth campaigns. |
| `join_clicks` | `user_joins` | Tracked join bounty claims and verification telemetry. |
| `page_views` | `page_views` | Public directory analytics and visitor telemetry. |
| `notifications` | `notifications` | In-app user notifications and alerts. |
| `network` | `network` | Cross-network syndication channels. |
| `affiliates` | `affiliates` | Referral tracking and representative links. |
| `applications` | `applications` | Legacy / staff application archives. |
| `config_changes` | `audit_log` | Administrative change logs. |
| `meta` | `meta` | Database schema versioning & maintenance state. |
| `login_attempts` | `login_attempts` | Security telemetry and rate limit logs. |
| `_cf_KV`, `sqlite_sequence` | *(Excluded)* | Cloudflare internal tables. |

---

## 3. Migration Pipeline Strategy

1. **Schema Initialization**:
   - Create schema migration script `scripts/db/init_postgres_schema.sql` with full table definitions, constraints, and indexes.
2. **Data Transformation & Import**:
   - Python/Node.js migration engine (`scripts/db/migrate_d1_to_postgres.mjs`) reads the `/migration/` SQL dump file.
   - Cleanses any invalid dates or malformed UTF-8.
   - Executes upserts in transactional order to respect foreign key hierarchies (Users -> Servers -> Reviews -> Reports -> Ledger).
3. **Verification Matrix**:
   - Count verification: `SELECT COUNT(*) FROM table` comparisons between source dump and target database.
   - Integrity checks: orphan review checks, balance tally verification.

---

## 4. Phase Gate Checkpoint

- Awaiting user placement of exported Cloudflare D1 SQL dump in `/migration/`.
- Once verified, Phase 2 (Railway Setup & PostgreSQL Adapter) and Phase 3 (Data Migration with `--dry-run`) will proceed.

