/**
 * Unified siteUrl(path) helper for ConnectingERLC
 * 
 * In production: strictly enforces https://connectingerlc.xyz or verified HTTPS domain.
 * In development: respects SITE_URL / APP_ORIGIN, defaulting to https://connectingerlc.xyz.
 */

export function getBaseSiteUrl() {
  const envUrl = (
    process.env.SITE_URL ||
    process.env.APP_ORIGIN ||
    process.env.PUBLIC_URL ||
    ''
  ).trim();

  if (process.env.NODE_ENV === 'production') {
    // In production, reject any tunnel or localhost address immediately
    if (
      !envUrl ||
      envUrl.includes('localhost') ||
      envUrl.includes('127.0.0.1') ||
      envUrl.includes('trycloudflare') ||
      envUrl.includes('ngrok') ||
      envUrl.includes('loca.lt') ||
      !envUrl.startsWith('https://')
    ) {
      return 'https://connectingerlc.xyz';
    }
  }

  return envUrl || 'https://connectingerlc.xyz';
}

export function siteUrl(path = '') {
  const base = getBaseSiteUrl().replace(/\/+$/, '');
  if (!path) return base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export default siteUrl;

