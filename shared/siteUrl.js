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

  // Strictly reject any tunnel, ngrok, localhost, or trycloudflare URLs
  if (
    !envUrl ||
    envUrl.includes('trycloudflare') ||
    envUrl.includes('ngrok') ||
    envUrl.includes('loca.lt') ||
    envUrl.includes('localhost') ||
    envUrl.includes('127.0.0.1') ||
    !envUrl.startsWith('https://')
  ) {
    return 'https://connectingerlc.xyz';
  }

  return envUrl;
}

export function siteUrl(path = '') {
  const base = getBaseSiteUrl().replace(/\/+$/, '');
  if (!path) return base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export default siteUrl;

