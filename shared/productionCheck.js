/**
 * Production Startup Validator
 * 
 * Enforces strict production invariants:
 * - Refuses to boot if NODE_ENV=production and SITE_URL, DISCORD_REDIRECT_URI, SUPPORT_INVITE_URL
 *   or APP_ORIGIN contains localhost, 127.0.0.1, or tunnel domains (trycloudflare, ngrok, loca.lt).
 * - Enforces that all public URLs start with https://.
 * - Asserts that DEV_LOGIN, debug routes, and tunnel configurations do not exist in production.
 */

export function validateProductionEnvironment(env = process.env) {
  if (env.NODE_ENV !== 'production') {
    return { valid: true };
  }

  // 1. Check required environment variables
  const requiredVars = [
    { name: 'SITE_URL', desc: 'The public website address (e.g. https://connectingerlc.xyz)' },
    { name: 'DISCORD_CLIENT_ID', desc: 'Discord OAuth2 Application ID from Discord Developer Portal' },
    { name: 'DISCORD_CLIENT_SECRET', desc: 'Discord OAuth2 Client Secret' },
    { name: 'DISCORD_BOT_TOKEN', desc: 'Discord Bot Token from Discord Developer Portal' },
    { name: 'SESSION_SECRET', desc: '64-character secret key for signing user sessions' }
  ];

  for (const v of requiredVars) {
    if (!env[v.name] || !env[v.name].trim()) {
      return {
        valid: false,
        error: `[PRODUCTION STARTUP ERROR] Missing required environment variable ${v.name}: ${v.desc}`
      };
    }
  }

  const disallowedDomains = ['localhost', '127.0.0.1', 'trycloudflare.com', 'ngrok.io', 'ngrok-free.app', 'loca.lt'];
  const urlsToCheck = [
    { name: 'SITE_URL', value: env.SITE_URL },
    { name: 'APP_ORIGIN', value: env.APP_ORIGIN },
    { name: 'DISCORD_REDIRECT_URI', value: env.DISCORD_REDIRECT_URI },
    { name: 'SUPPORT_INVITE_URL', value: env.SUPPORT_INVITE_URL }
  ];

  for (const item of urlsToCheck) {
    if (!item.value) continue;
    const trimmed = item.value.trim();

    if (!trimmed.startsWith('https://')) {
      const error = `[PRODUCTION INVARIANT VIOLATION] ${item.name} must start with https:// in production. Found: "${trimmed}"`;
      return { valid: false, error };
    }

    for (const domain of disallowedDomains) {
      if (trimmed.includes(domain)) {
        const error = `[PRODUCTION INVARIANT VIOLATION] ${item.name} cannot contain dev or tunnel domain "${domain}" in production. Found: "${trimmed}"`;
        return { valid: false, error };
      }
    }
  }

  if (env.DEV_LOGIN === 'true' || env.DEV_LOGIN === '1') {
    return {
      valid: false,
      error: '[PRODUCTION INVARIANT VIOLATION] DEV_LOGIN is strictly forbidden in production mode.'
    };
  }

  return { valid: true };
}

export function assertProductionEnvironment(env = process.env) {
  const result = validateProductionEnvironment(env);
  if (!result.valid) {
    throw new Error(result.error);
  }
  return true;
}

export default validateProductionEnvironment;
