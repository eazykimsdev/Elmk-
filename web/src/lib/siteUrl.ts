/**
 * Client-side siteUrl helper for ConnectingERLC
 */

export function getBaseSiteUrl(): string {
  if (typeof window !== 'undefined') {
    // If running in browser and on production host
    const origin = window.location.origin;
    if (origin.includes('connectingerlc.xyz')) {
      return origin;
    }
  }

  const envUrl = (import.meta.env.VITE_SITE_URL || '').trim();
  if (import.meta.env.PROD) {
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

  return envUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://connectingerlc.xyz');
}

export function siteUrl(path = ''): string {
  const base = getBaseSiteUrl().replace(/\/+$/, '');
  if (!path) return base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export default siteUrl;

