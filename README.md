# ConnectingERLC (ConnectingERLC)

ConnectingERLC is the community management platform and web dashboard for Discord communities. Sign in with Discord, pick a server you manage, and configure growth campaigns, directory listings, partner exchanges, and server telemetry.

---

## Design System & Branding Tokens (ROUND 12)

- **Fixed Brand Accent**: Fixed single accent `--accent: #F97316` (Orange 500).
  - `--accent-hover: #FB8A3C`
  - `--accent-foreground: #1C0A00` (high-contrast dark text on orange)
  - `--accent-soft: rgba(249, 115, 22, 0.12)`
  - `--accent-border: rgba(249, 115, 22, 0.35)`
  - `--ring: #F97316`
- **Theme Color Picker**: Completely removed. The user menu row, appearance swatches, `theme_accent` preferences, and pre-paint scripts have been deprecated.
- **Zero Green Policy**: Green hues (`#3DDC97`, `#10B981`, `emerald-*`, `green-*`) are forbidden across all components, SVGs, toggles, badges, and charts. All active and success states use the fixed orange design tokens. Pending and warning states use `#FACC15` (Yellow), while destructive actions use `#F87171` (Red).

---

## Features

1. **Discord OAuth2 Login**
   - Secure server-side OAuth2 authentication. Discord tokens stay protected on the server.
   - Automatic discovery of servers where you have Manage Server or Administrator permissions.

2. **Dashboard (`/dashboard`)**
   - Clean, modern community workspace switcher with real Discord server icons.
   - Manage community directory listings, custom descriptions, and verified invite links.
   - Unified single-normalizer dirty form detection preventing false "You have unsaved changes" bars.
   - Inline chips tags input with comma/Enter addition and inline counter.

3. **Community Discovery & Directory (`/directory`)**
   - Browse published communities with real category ordering and live server telemetry.
   - Single-bump cooldown engine to elevate active communities.
   - Earn credits, verified joins tracking, and automated rewards.
   - Server details modal with real owner verification, community feedback sort, and report modal.

4. **Partnerships Exchange**
   - 2-column directory cards with blurred banner headers, 2-line clamped summaries, and mutual exchange terms.
   - Responsive partnership management rows replacing mobile-truncated tables.

5. **Recruiting & Representatives**
   - Owner-anchored view in team management protecting community founders.
   - Plain-text base reward with optional higher reward and representative recruitment switches.

6. **Admin Portal (`/admin-portal`)**
   - Restricted to authenticated staff with `requireAdminRole()` server enforcement and 404 gates for non-admins.
   - 13-item sidebar navigation: Overview, Users, Servers, Reports, Flags, Credits, Blacklist, Announcements, Maintenance, Changelog, Audit log, System, Admins.
   - Real counts only in Overview with direct "Needs attention" queue links.
   - Users management with "Members" and "Known accounts" sub-tabs, plus full profile sheet drawer.
   - Live System Diagnostics table tracking database latency, Discord bot guild shards, PRC API reachability, background jobs, rate limits, and data snapshots.
   - Staff roster with real-time heartbeat presence dots (`isOnline`).

7. **Anchor-Style Public Pages & Home Page (`/`)**
   - Slim 64px desktop icon rail (`PublicIconRail`) and sticky bottom mobile bar across all public routes (`/`, `/directory`, `/changelog`, `/status`, `/docs`, `/s/:slug`).
   - Hero with blurred composite of real server banners, fixed copy, and countdown strip to November 21 launch.
   - Dual sliding marquee tracks (`animate-slide-track-left` / `animate-slide-track-right`) with edge fade masks showcasing active communities.
   - Framed live showcase window displaying real community listings from `/api/public/showcase`.
   - Feature columns for Discovery, Directory Bumps, Partnerships, Representatives, and Community Trust.
   - Universal server details modal callable from all entry points (`/directory`, `/dashboard`, `/s/:slug`, `?server=slug`, home cards).

---

## Production Publication & Target Domain

- **Target URL**: `https://connectingerlc.xyz`
- **Deployment Platform**: Railway (Web Service + Bot Service)
- **Deployment Instructions**: See [WHEN_YOU_GET_HOME.md](file:///c:/Users/sulma/OneDrive/Desktop/erlcxbot/WHEN_YOU_GET_HOME.md) for step-by-step setup.
- **Monitoring Setup**: See [MONITORING.md](file:///c:/Users/sulma/OneDrive/Desktop/erlcxbot/MONITORING.md) for UptimeRobot, Better Stack, and Discord Components V2 alert configuration.
- **Audit & Invariants Report**: See [AUDIT_REPORT.md](file:///c:/Users/sulma/OneDrive/Desktop/erlcxbot/AUDIT_REPORT.md) for full test matrix and security invariant results.

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env.example` to `.env` and fill in your Discord OAuth2 values:
```env
SITE_URL=http://localhost:3000
APP_ORIGIN=http://localhost:3000
DISCORD_CLIENT_ID=your_oauth_application_id
DISCORD_CLIENT_SECRET=your_oauth_client_secret
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback
SESSION_SECRET=your_random_64_character_hex_session_secret
ADMIN_DISCORD_IDS=523693281541095424
ALERT_DISCORD_IDS=523693281541095424
SUPPORT_INVITE_URL=https://discord.gg/connectingerlc
# Emergency kill switch: forces maintenance mode completely OFF regardless of database state
MAINTENANCE_FORCE_OFF=false
```

### Emergency Maintenance Kill Switch
If the site ever gets stuck in maintenance mode or if you need an immediate bypass on production:
- Set environment variable: `MAINTENANCE_FORCE_OFF=true` on Railway or in `.env`.
- When active, maintenance is unconditionally OFF across all endpoints, orchestrator probes, and frontend pages, regardless of database or file state.
- Health check `/healthz`, `/api/status`, `/api/public/site-state`, and Discord login routes always remain accessible even during maintenance.

### 3. Start development
```bash
# Start backend server
node server.js

# Start frontend dev server
npm run dev
```

### 4. Run tests & verification
```bash
# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# System test suite
npm test

# Test Discord Components V2 alerts
npm run alerts:test

# Test local dev join grant
npm run dev:grant-join

# Credits ledger audit & repair
npm run credits:audit
npm run credits:repair

# Reset promo code failure limits (dev only)
npm run dev:reset-limits

# Test all 4 Discord Components V2 notifications (live DM dispatch)
npm run notify:test

# Lint test for forbidden text-based dividers
node scripts/test_no_text_dividers.mjs

# Full production build
npm run build
```

---

## 7. Reviews and Authenticity Rules
- Reviews are open to any signed-in Discord user whose account is at least 2 days old.
- Server owners and team members cannot review their own community.
- Joining the server is not required to submit a review.
- Reviews from verified joiners who joined through ConnectingERLC display a Verified join badge.
- Rate limits: 5 reviews per user per day and 3 reviews per minute.
- Automatic detector flags suspicious patterns: young accounts giving 5 stars, identical review copy across servers, and mutual owner reviews.

## 8. Web App Installation Policy
- ConnectingERLC operates strictly as a web application.
- Web manifest, service workers, and install banners have been removed.
- Browsers with legacy workers receive a self-unregistering script that clears old worker registrations and caches.

## 9. Discord Bot Security and Slash Commands
- Least privilege: the bot never requests or uses Administrator permissions.
- Default invite grants Basic permissions: View Channels, Send Messages, Embed Links, and Create Instant Invite.
- Optional permission tiers can be added for Recruiting (Manage Server), Role rewards (Manage Roles), and Owner tools (Kick and Ban Members).
- Global slash commands: `/bump`, `/ad`, `/setup`, `/status`, and `/leaderboard`.
- In-Discord `/bump` overhaul: Runs directly in Discord using the same service function as the website. Responds with ephemeral Discord Components V2 panel (`ContainerBuilder`, orange accent, no emojis). Includes live leaderboard ranking, dynamic countdown timestamp, and an interactive "Remind me" / "Remove reminder" toggle button. Reminders are dispatched automatically to the configured bump channel or DM when `nextBumpAt` expires.
- Bump notices & channel picker: Per-server settings under Settings > Notifications to post notices on bumps and alerts when the cooldown expires, with permission validation and rate-limited test dispatches.
- Streak alert: One Discord DM sent 36 hours after the user's last daily check-in to preserve their streak. Legacy Raid alerts completely removed.
- Promo codes: Users can redeem codes in settings to fund their community server treasury. Admins can generate codes, view redemptions, export CSV, and toggle active states.
- Danger zone: Server owners can hard delete communities with exact name match; users can hard delete their account and owned servers with exact username match. Anonymizes reviews to "Deleted user" and preserves ban hashes.
- Security blacklist: Multi-layer blocking supporting Discord IDs, IP addresses, and CIDR subnets with AES-256-GCM encryption, HMAC-SHA256 indexing, 90-day retention, and collateral accounts detection.
- Site state & announcements: Scheduled maintenance windows with 503 API codes, command pauses, and targeted announcements with dismissals.
- Deployed via `npm run commands:deploy`. Compares existing definitions and patches changed commands without wiping existing configurations. Global commands propagate across Discord within one hour.
- Daily check-in reminders: users can turn reminders on or off in the dashboard. The bot dispatches a clean Discord Components V2 panel when credits become available.

## Themes

Set \THEME=default\ (orange) or \THEME=christmas\ (red accent + light snow) on the server, or change it in Admin Portal > System. The admin choice, when saved, overrides the env value. Optional build default: \VITE_THEME\.

