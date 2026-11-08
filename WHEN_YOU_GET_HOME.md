# ConnectingERLC: When You Get Home Deployment Guide

Welcome back! The platform has been fully hardened, refactored, tested, and prepped for production publication. Follow these beginner-friendly, step-by-step instructions to take ConnectingERLC live at **`https://connectingerlc.xyz`**.

---

## Prerequisites Checklist
Before starting, make sure you have:
1. Access to your [Railway.app](https://railway.app) account.
2. Access to your domain registrar (Namecheap, Cloudflare, GoDaddy, or Porkbun) managing `connectingerlc.xyz`.
3. Access to the [Discord Developer Portal](https://discord.com/developers/applications).
4. Your Discord User ID: `523693281541095424`.

---

## Step 1: Deploy on Railway (Two Services)

We recommend deploying ConnectingERLC as two services within a single Railway project:
- **Service 1: Web App (`connectingerlc-web`)** — Serves the Express API and React dashboard.
- **Service 2: Discord Bot (`connectingerlc-bot`)** — Runs the continuous Discord gateway bot.

### A. Create the Railway Project
1. Log in to [Railway](https://railway.app).
2. Click **New Project** &rarr; **Deploy from GitHub repo**.
3. Select the `erlcxbot` / `connectingerlc` repository.

### B. Configure Service 1: Web App
1. In the Railway dashboard, select the deployed service and rename it to `connectingerlc-web`.
2. Go to **Settings** &rarr; **Deploy**:
   - **Build Command**: `npm run build`
   - **Start Command**: `node server.js`
3. Go to **Variables** and add the following environment variables:
   ```env
   NODE_ENV=production
   PORT=3000
   SITE_URL=https://connectingerlc.xyz
   APP_ORIGIN=https://connectingerlc.xyz
   DISCORD_CLIENT_ID=YOUR_DISCORD_CLIENT_ID
   DISCORD_CLIENT_SECRET=YOUR_DISCORD_CLIENT_SECRET
   DISCORD_BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN
   DISCORD_REDIRECT_URI=https://connectingerlc.xyz/auth/discord/callback
   SUPPORT_INVITE_URL=https://discord.gg/connectingerlc
   ADMIN_DISCORD_IDS=523693281541095424
   ALERT_DISCORD_IDS=523693281541095424
   SESSION_SECRET=GENERATE_RANDOM_64_CHAR_HEX_STRING
   DEV_LOGIN=false
   ```
   *(To generate a 64-char `SESSION_SECRET`, run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` in your terminal).*

4. **Database (Neon or Railway Postgres)**:
   - If using Neon Postgres: add your `DATABASE_URL=postgresql://user:pass@host/neondb?sslmode=require`.
   - If using local SQLite on Railway: go to **Settings** &rarr; **Volumes** and attach a volume mounted at `/app/data` so your data persists across deployments.

### C. Configure Service 2: Discord Bot
1. In the same Railway project, click **New** &rarr; **GitHub Repo** &rarr; select the same repository again.
2. Rename this service to `connectingerlc-bot`.
3. Go to **Settings** &rarr; **Deploy**:
   - **Build Command**: `npm run build` (or leave empty)
   - **Start Command**: `node botGateway.js`
4. Go to **Variables** and paste the same variables:
   ```env
   NODE_ENV=production
   SITE_URL=https://connectingerlc.xyz
   DISCORD_CLIENT_ID=YOUR_DISCORD_CLIENT_ID
   DISCORD_BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN
   DATABASE_URL=YOUR_DATABASE_URL
   ```

---

## Step 2: Configure Custom Domain (`connectingerlc.xyz`)

1. In Railway, click on the `connectingerlc-web` service.
2. Go to **Settings** &rarr; **Networking** &rarr; **Custom Domain**.
3. Enter `connectingerlc.xyz` (and optionally `www.connectingerlc.xyz`).
4. Railway will provide DNS instructions, typically:
   - **Type**: `CNAME`
   - **Name**: `@` (or `www`)
   - **Target**: `something.up.railway.app`
5. Go to your domain registrar's DNS management panel:
   - Add the CNAME record provided by Railway.
   - If your registrar does not support CNAME on apex (`@`), use ALIAS/ANAME, or use Cloudflare DNS with CNAME Flattening.
6. Wait 5-10 minutes for SSL generation. Once active, Railway will show a green checkmark next to your domain.

---

## Step 3: Discord Developer Portal Configuration

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and select your Application.
2. Go to **OAuth2** &rarr; **General**:
   - Under **Redirects**, click **Add Redirect**.
   - Add: `https://connectingerlc.xyz/auth/discord/callback`
   - Click **Save Changes**.
3. Go to **Bot**:
   - Verify **Privileged Gateway Intents**:
     - Enable **Server Members Intent** (required to check member stays and verify joins).
     - Enable **Message Content Intent** (optional, recommended).
   - Under **Bot Permissions**, ensure the bot has:
     - Manage Guild
     - Create Instant Invite
     - Send Messages & Embed Links
     - Use Application Commands

---

## Step 4: Register Bot Slash Commands for Production

To make `/bump`, `/stats`, `/info`, and `/status` available globally in all Discord servers:
Run the slash command registration script once using your production bot token:
```bash
node scripts/register_bot_commands.mjs
```
*(Discord updates global slash commands across all servers within a few minutes).*

---

## Step 5: External Uptime Monitoring (UptimeRobot / Better Stack)

We configured a dedicated public health endpoint at `https://connectingerlc.xyz/api/status` that outputs live probe data without leaking secrets.

1. Sign up for a free account at [UptimeRobot](https://uptimerobot.com) or [Better Stack](https://betterstack.com).
2. Click **Add New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `ConnectingERLC Web & API`
   - **URL / IP**: `https://connectingerlc.xyz/api/status`
   - **Monitoring Interval**: 1 minute or 5 minutes
3. Save the monitor. If the site ever goes down, UptimeRobot will notify you immediately via email or Discord webhook.

---

## Step 6: Testing Discord Components V2 Alerts

Once your bot token is set in Railway:
1. Log in to the Admin Portal at `https://connectingerlc.xyz/admin-portal`.
2. Navigate to the **System** tab in the sidebar.
3. Review the live 4-component status table (Core API, Database, Discord bot, ER:LC API).
4. Click the **Send Test Alert** button.
5. Check your Discord DMs: you will receive a Discord Components V2 alert card confirming alert delivery!

---

## Troubleshooting Common Issues

- **Site refuses to boot on Railway with error `[STARTUP VALIDATION FAILED]`**:
  Check your environment variables in Railway. Ensure `NODE_ENV=production` has `SITE_URL=https://connectingerlc.xyz` and does not contain `localhost` or dev tunnels.
- **Discord OAuth redirect error (`Invalid OAuth2 redirect_uri`)**:
  Ensure `https://connectingerlc.xyz/auth/discord/callback` is added in Discord Developer Portal under OAuth2 &rarr; Redirects.
- **Reviews say "24h retention hold"**:
  New members must remain in the community for 24 hours before their review eligibility unlocks. For testing on your local machine, use `npm run dev:grant-join`.

You are completely ready to go live!

