# ConnectingERLC System Monitoring & Uptime Guide

This guide explains how ConnectingERLC monitors its platform health, how automatic Discord DM alerts work, and how to set up a free external monitor so you are notified even if Railway or the host server experiences an outage.

---

## 1. The Four Core Component Checks

ConnectingERLC runs health checks every 60 seconds across four critical components:

### 1. Core API
- **What it checks:** Requests `{SITE_URL}/healthz` from the public internet and measures HTTP response time.
- **Healthy:** HTTP 200 in under 2.0 seconds.
- **What an outage means:** The web frontend, user login, directory browsing, and API cannot respond to members.
- **Common causes:** Web process crash, port binding failure, memory exhaustion, or Railway deploy crash loop.

### 2. Database
- **What it checks:** Executes a database query against PostgreSQL (or checks persistent disk storage health) and measures latency.
- **Healthy:** Query responds in under 500ms without connection pool errors.
- **What an outage means:** User balances, directory listings, sessions, and logs cannot be read or saved.
- **Common causes:** Wrong `DATABASE_URL`, PostgreSQL instance stopped, or exhausted connection pool limits.

### 3. Discord Bot
- **What it checks:** Verifies Discord Gateway WebSocket heartbeat connection (sent every 30 seconds) and makes a REST test call to `https://discord.com/api/v10/users/@me`.
- **Healthy:** Gateway connected and REST API responds in under 2.0 seconds.
- **What an outage means:** Server bumping (`/bump`), real-time invite verification, join detection, and partnership broadcasts stop working.
- **Common causes:** Discord API 401 (invalid or reset `DISCORD_BOT_TOKEN`), Discord API 429 rate limit, or network disconnection.

### 4. ER:LC API
- **What it checks:** Verifies reachability of the Police Roleplay Community API (`https://api.policeroleplay.community/v1/server`) using connected community keys.
- **Healthy:** Success rate above 90% across sync requests.
- **Status "Not in use":** If no servers have configured an ER:LC server key yet, this displays "Not in use" instead of false alarms.
- **Status "Degraded":** If ER:LC returns HTTP 5xx or times out, it is marked as an external ER:LC outage rather than a ConnectingERLC bug.

---

## 2. Automatic Discord Direct Message Alerts

When a service check fails twice in a row (approximately 2 minutes), ConnectingERLC automatically dispatches a **Discord Components V2** alert panel directly to your Discord account.

### How Alert Dispatch Works:
1. **Target Recipients:** Configured in `.env` as `ALERT_DISCORD_IDS` (comma-separated Discord snowflake user IDs, e.g. `523693281541095424`).
2. **Delivery Mechanism:** The bot creates a direct message channel via Discord REST API. Because it uses REST, it can send alerts even when the WebSocket gateway is disconnected.
3. **Flap Protection:** Once an alert is sent, the system enforces a 5-minute cooldown before another "Down" alert can be sent for that component, preventing alert spam.
4. **Reminders:** If an outage persists, a reminder is sent at 30 minutes, 60 minutes, and 90 minutes, then every 2 hours until resolved.
5. **Recovery Notification:** When the component recovers, a grey "Operational" panel is sent showing the exact duration of the downtime.
6. **Fallback Webhook:** If your Discord DMs are closed or delivery fails, alerts fall back to `ALERT_WEBHOOK_URL` and a red banner appears in the Admin Portal (`/admin-portal`).

### How to Read an Alert Panel:
Each alert panel contains clear, non-technical instructions:
- **Heading:** Identifies which component is down and the exact detection time in UTC.
- **What this means:** Plain language explanation of which platform features are affected.
- **What I found:** The raw status code or error message returned by the service.
- **Most likely cause & What to do:** Step-by-step instructions showing where to click in Railway or the Discord Developer Portal to fix the issue.
- **Paste this to your AI helper:** A clean code snippet with timestamps, error codes, and environment details ready to paste to an AI assistant for instant debugging.
- **Buttons:** Direct link to your Admin System page (`{SITE_URL}/admin/system`) and Railway dashboard.

---

## 3. Testing Alerts

You can test alert delivery at any time using:

```bash
npm run alerts:test
```

This sends a clearly marked `[TEST ALERT]` panel to your Discord DM without altering your production status history.

---

## 4. Free External Uptime Monitor Setup (Recommended)

If Railway itself goes down, the internal monitor cannot send alerts. To protect against infrastructure failures, configure a free external monitor using **Better Stack** or **UptimeRobot**.

### Step-by-Step with Better Stack (Free):
1. Create a free account at [betterstack.com](https://betterstack.com).
2. Go to **Uptime** > **Monitors** > **Create Monitor**.
3. Set **URL to monitor** to:
   ```
   https://connectingerlc.xyz/healthz
   ```
4. Set **Check frequency** to `1 minute`.
5. Under **Alerting**, select **Integrations** > **Discord Webhook**.
6. Create a private Discord channel in your staff server (e.g. `#platform-alerts`), go to **Edit Channel** > **Integrations** > **Webhooks** > **New Webhook**, and copy the webhook URL into Better Stack.
7. Click **Save Monitor**.

### Step-by-Step with UptimeRobot (Free Alternative):
1. Sign up at [uptimerobot.com](https://uptimerobot.com).
2. Click **Add New Monitor**.
3. Choose **Monitor Type:** `HTTP(s)`.
4. Set **Friendly Name:** `ConnectingERLC Web & API`.
5. Set **URL:** `https://connectingerlc.xyz/healthz`.
6. Set **Monitoring Interval:** `5 minutes` (free tier).
7. Under **Alert Contacts**, add your Discord webhook or email.
8. Click **Create Monitor**.

Now you will be alerted instantly whether an individual component fails or the entire hosting platform is unreachable.

