// ConnectingERLC Unified Brand Configuration
// Single source of truth for platform identity across client and server.

declare const process: any;

export const BRAND = {
  name: 'ConnectingERLC',
  tagline: 'The Discord growth & community management platform for ER:LC servers',
  shortName: 'ConnectingERLC',
  supportInvite: (typeof process !== 'undefined' && process.env?.SUPPORT_INVITE_URL)
    || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPPORT_INVITE_URL)
    || 'https://discord.gg/central',
  siteUrl: (typeof process !== 'undefined' && process.env?.SITE_URL)
    || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SITE_URL)
    || 'http://localhost:3000',
  launchAt: (typeof process !== 'undefined' && (process.env?.LAUNCH_AT || process.env?.CONNECTINGERLC_LAUNCH_AT))
    || (typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_LAUNCH_AT || (import.meta as any).env?.LAUNCH_AT))
    || '2026-11-21T17:45:00.000Z',
  logoPng: '/brand/logo.png',
  logoSvg: '/brand/logo.svg',
} as const;

export default BRAND;

