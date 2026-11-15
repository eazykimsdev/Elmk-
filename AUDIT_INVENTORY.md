# ConnectingERLC Architecture & Route Inventory Audit

**Document Version:** 1.0.0  
**Target Environment:** Railway (`https://connectingerlc.xyz`)  
**Source Database:** Cloudflare D1 (`connectingerlc-db`) — READ-ONLY  
**Target Database:** PostgreSQL 16 on Railway  

---

## 1. Web Page & Public Routing Inventory

| Route | Component | Access Control | Purpose |
| :--- | :--- | :--- | :--- |
| `/` | `LandingPage.tsx` | Public | Hero landing, feature showcase, directory stats counter, live status pill |
| `/login` | `LoginPage.tsx` | Public | Discord OAuth sign-in entry with live skeleton carousel preview (Directory, Credits, Partnerships, Recruit Hub) |
| `/dashboard` | `DashboardPage.tsx` | Authenticated | Server selector & global growth telemetry |
| `/dashboard/:guildId` | `DashboardPage.tsx` (`OverviewTab`) | Authenticated (Guild Owner/Admin) | Setup checklist, bump trigger, credits telemetry, activity timeline |
| `/dashboard/:guildId/details` | `DashboardPage.tsx` (`ServerDetailsTab`) | Authenticated | Public server listing preview, owner numbers, reviews & ratings |
| `/dashboard/:guildId/promote` | `DashboardPage.tsx` (`PromoteTab`) | Authenticated (Guild Owner/Admin) | Edit server listing, tags, summary, Markdown description, anti-raid threshold |
| `/dashboard/:guildId/earn` | `DashboardPage.tsx` (`EarnCoinsTab`) | Authenticated | Browse join bounties, earn credits, claim join rewards |
| `/dashboard/:guildId/rewards` | `DashboardPage.tsx` (`RewardsTab`) | Authenticated | Daily check-in countdown & milestone reward staging |
| `/dashboard/:guildId/leaderboard` | `DashboardPage.tsx` (`LeaderboardTab`) | Authenticated | Community directory rankings by bump recency, join volume, and credits |
| `/dashboard/:guildId/joins` | `DashboardPage.tsx` (`MyJoinsTab`) | Authenticated | User's joined servers, verified retention timer, leave decrements |
| `/dashboard/:guildId/recruits` | `DashboardPage.tsx` (`RecruitsTab`) | Authenticated (Guild Owner/Admin) | Community invite links, recruitment analytics, conversion rates |
| `/dashboard/:guildId/partnerships` | `DashboardPage.tsx` (`PartnershipsTab`) | Authenticated (Guild Owner/Admin) | Cross-community alliance proposals, pending incoming requests, syndication logs |
| `/dashboard/:guildId/uptime` | `DashboardPage.tsx` (`UptimeTab`) | Authenticated | Real-time system health, API endpoint latency, PRC checks |
| `/dashboard/:guildId/bot` | `DashboardPage.tsx` (`BotManagementTab`) | Authenticated (Guild Owner/Admin) | Bot presence check, missing permissions fixer, ER:LC status |
| `/dashboard/:guildId/changelog` | `DashboardPage.tsx` (`ChangelogTab`) | Authenticated | Platform version history and release notes |
| `/dashboard/:guildId/settings` | `DashboardPage.tsx` (`SettingsTab`) | Authenticated (Guild Owner/Admin) | Server notification webhooks, sync frequency |
| `/auth/discord` | `CallbackPage.tsx` | Public | Discord OAuth callback consumer and session setter |
| `/admin-portal` | `AdminPortalPage.tsx` | Role-Guarded (`ADMIN_DISCORD_IDS`) | Moderation portal: users, blacklists, listings, credits treasury, reports queue, system flags |
| `/status`, `/uptime` | `UptimeTab.tsx` | Public | Standalone platform status & maintenance banner |
| `/terms`, `/tos` | `TermsPage.tsx` | Public | Terms of service |
| `/privacy` | `PrivacyPage.tsx` | Public | Privacy and data policy |
| `*` | `NotFoundPage.tsx` | Public | Centered minimalist 404 page |

---

## 2. REST API Endpoint Inventory

### Authentication & Sessions
- `GET /api/auth/user`: Returns currently logged in Discord user profile from session cookie (`connectingerlc_session`).
- `GET /api/auth/debug`: (Dev-only) Returns cookie presence, session resolution, user ID.
- `POST /api/auth/logout`: Revokes session, clears cookies (`connectingerlc_session`, `mavely_session`).
- `GET /auth/discord`: Initiates OAuth authorization flow with Discord.
- `GET /auth/discord/callback`: Handles Discord OAuth code exchange, creates session, sets persistent cookie.

### Server & Guild Management
- `GET /api/servers`: Lists Discord guilds where the authenticated user has `MANAGE_GUILD` or `ADMINISTRATOR`.
- `GET /api/servers/:guildId`: Returns detailed guild listing, owner profile, ratings summary, and bot status.
- `PUT /api/servers/:guildId/listing`: Updates community listing category, summary, description, tags, banner.
- `GET /api/servers/:guildId/bot-status`: Real-time Discord REST query checking bot presence and permissions.
- `GET /api/servers/:guildId/channels`: Queries channels via Bot REST for partnership/logging channel selection.
- `GET /api/servers/:guildId/roles`: Queries roles via Bot REST for permission selection.
- `POST /api/servers/:guildId/bump`: Elevates server to #1 in directory (enforces 2-hour cooldown).

### Credits & Bounty Economy
- `GET /api/credits`: Returns current user/guild credit balance.
- `POST /api/credits/transfer`: Transfers credits between treasury and accounts.
- `GET /api/credits/history`: Returns credit transactions ledger for mini-charts and statements.
- `POST /api/servers/:guildId/bounty/claim`: Verifies Discord guild membership and grants +2 credit reward (prevents self-joins).

### Reviews & Moderation
- `GET /api/servers/:guildId/reviews`: Returns public reviews with ratings breakdown and pagination.
- `POST /api/servers/:guildId/reviews`: Submits/updates member review (min 10 chars, profanity filtered).
- `DELETE /api/reviews/:id`: Deletes review (author or admin only).
- `POST /api/reviews/:id/report`: Flags review with reason, sending report to Admin Portal queue.

### Partnerships & Alliances
- `GET /api/partnerships/:guildId`: Returns partnership configuration, incoming waiting requests, sent requests.
- `PUT /api/partnerships/:guildId/config`: Configures alliance settings (min members, category filters, mentions).
- `POST /api/partnerships/request`: Submits cross-community partnership proposal.
- `POST /api/partnerships/requests/:id/accept`: Accepts proposal, broadcasts mutual announcement embed via Bot REST.
- `POST /api/partnerships/requests/:id/decline`: Declines proposal.

### Admin Portal (`/admin-portal`)
- `GET /api/admin/check`: Verifies admin authorization against `ADMIN_DISCORD_IDS`.
- `GET /api/admin/overview`: Platform-wide stats (total servers, active users, treasury pool, pending reports).
- `GET /api/admin/users`: Lists registered users with balance and ban status.
- `POST /api/admin/users/:userId/ban`: Suspends user account with reason and duration.
- `POST /api/admin/users/:userId/unban`: Restores suspended account.
- `POST /api/admin/credits/gift`: Treasury credit allocation.
- `GET /api/admin/reports`: Lists reported reviews and infractions queue.
- `POST /api/admin/reports/:reportId`: Resolves/dismisses report and optionally soft-deletes content.
- `GET /api/admin/maintenance`: Returns maintenance mode status and custom notice.
- `POST /api/admin/maintenance`: Toggles maintenance mode and updates status message.

---

## 3. Background Jobs & Scheduled Timers

1. **Session Cleanup Cron**: Purges expired web sessions every 60 minutes.
2. **Bump Cooldown Monitor**: Real-time evaluation on `/bump` endpoints calculating seconds remaining against 7200s (2h).
3. **Retention Verification Poller**: Validates user membership status before granting or revoking join credits (decrements count on leave).
4. **Discord Gateway Heartbeat**: Maintained via Discord REST status checks.

---

## 4. Environment Variables Specification

| Variable Name | Required | Purpose | Production Target Value |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | Environment flag | `production` |
| `PORT` | Yes | Server port | Provided by Railway (e.g. `8080`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string | Railway Postgres connection pooler |
| `CONNECTINGERLC_BOT_TOKEN` | Yes | Discord Bot Application Token | Bot token configured securely in Railway |
| `DISCORD_CLIENT_ID` | Yes | Application Client ID | `1552165138017165372` |
| `DISCORD_CLIENT_SECRET` | Yes | OAuth Client Secret | Client secret configured in Railway |
| `DISCORD_REDIRECT_URI` | Yes | OAuth Callback URL | `https://connectingerlc.xyz/auth/discord/callback` |
| `SESSION_SECRET` | Yes | Cookie signing key | Cryptographically secure random 64-char hex string |
| `ADMIN_DISCORD_IDS` | Yes | Comma-separated admin IDs | `523693281541095424` |
| `DATA_DIR` | Optional | Local file fallback path | `./data` |

---

## 5. Third-Party Dependencies

- `express` (v4.21): HTTP API and static SPA server
- `cors`, `cookie-parser`: Secure cross-origin requests and HTTP-only session cookies
- `react` (v18.3), `react-dom`: Frontend UI framework
- `react-router-dom` (v6.28): Client-side SPA routing
- `lucide-react`: Clean minimalist vector icons
- `recharts`: Telemetry charts (credits trend, join analytics)
- `tailwind-merge`, `clsx`: Utility class merging
- `playwright-core`: Automated end-to-end browser verification and screenshot engine

