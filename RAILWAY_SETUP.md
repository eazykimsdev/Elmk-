# Railway Deployment & Production Infrastructure Guide

This guide details the exact steps and configuration required to deploy **ConnectingERLC** to Railway at `https://connectingerlc.xyz`.

---

## 1. Required Environment Variables

Configure these variables in your Railway Project Settings under **Variables**:

| Variable Name | Required | Default / Staging Value | Production Target | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | `production` | Enables production caching, HSTS, and strict security headers |
| `PORT` | **Yes** | `3001` | Injected by Railway (`${{PORT}}`) | Application automatically binds to `process.env.PORT` |
| `DATABASE_URL` | **Yes** | Auto-injected | Auto-injected | Connection string from Railway PostgreSQL add-on |
| `CONNECTINGERLC_BOT_TOKEN` | **Yes** | DEV Bot Token | Production Discord Bot Token | Kept strictly outside git repository |
| `DISCORD_CLIENT_ID` | **Yes** | `1552165138017165372` | `1552165138017165372` | ConnectingERLC Application ID |
| `DISCORD_CLIENT_SECRET` | **Yes** | Secret | Secret | OAuth2 Client Secret from Discord Developer Portal |
| `DISCORD_REDIRECT_URI` | **Yes** | `https://staging.../auth/discord/callback` | `https://connectingerlc.xyz/auth/discord/callback` | Configured in Discord OAuth Redirects |
| `SESSION_SECRET` | **Yes** | 64-char hex random | 64-char hex random | Cryptographic signing key for session cookies |
| `ADMIN_DISCORD_IDS` | **Yes** | `523693281541095424` | `523693281541095424` | Discord snowflake IDs permitted to access `/admin-portal` |

---

## 2. Start Command & Build Configuration

- **Build Command**: `npm run build` (builds frontend Vite assets into `dist/` and runs `scripts/sync-dist.js`)
- **Start Command**: `node server.js`
- **Procfile** (Optional):
  ```procfile
  web: node server.js
  ```

---

## 3. Reverse Proxy & Trust Proxy

Railway deploys services behind an edge reverse proxy.
`server.js` is already configured with:
```js
app.set('trust proxy', 1);
```
This ensures:
- Secure cookies (`secure: true`, `sameSite: 'lax'`) are properly issued behind the proxy.
- Express accurately derives client IPs from `X-Forwarded-For` for the sliding-window in-memory rate limiters (`authLimiter`, `bumpLimiter`, `generalLimiter`).
- Health checks return status 200 at `/healthz`.

---

## 4. Health Check Endpoint

- **Path**: `/healthz`
- **Expected Status**: `200 OK`
- **Response Format**:
  ```json
  {
    "status": "healthy",
    "service": "connectingerlc",
    "uptime": 12.4,
    "timestamp": "2026-11-06T19:08:39.374Z"
  }
  ```
- Configure Railway **Health Check Path** to `/healthz` with a timeout of 10s.

---

## 5. Custom Domain Configuration (`connectingerlc.xyz`)

1. In Railway: Go to **Settings** → **Networking** → **Custom Domains** → Add `connectingerlc.xyz` and `www.connectingerlc.xyz`.
2. In Cloudflare DNS (`Tacdrift22@gmail.com` account):
   - Add CNAME record: `@` pointing to `<railway-provided-target>.up.railway.app` (Proxy: Enabled / Orange Cloud).
   - Add CNAME record: `www` pointing to `<railway-provided-target>.up.railway.app` (Proxy: Enabled / Orange Cloud).
3. In Cloudflare SSL/TLS Settings:
   - Select **Full (strict)** encryption mode.
   - Enable **Always Use HTTPS**.

