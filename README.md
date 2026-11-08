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
```

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

# Full production build
npm run build
```

---

## Authentication Architecture & Root Cause Fixes

1. **Session Cookie Isolation**:
   - `connectingerlc_session` cookie with sliding 30-day renewals and atomic synchronous disk persistence.
2. **CORS Credentials**:
   - Configured `cors({ origin: true, credentials: true })` globally.
3. **Debug Telemetry**:
   - `GET /api/auth/debug` available for real-time inspection of cookie parsing and session validity.
