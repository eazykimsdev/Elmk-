export type ThemeName = 'default' | 'christmas';

// Code-level switch: set VITE_THEME=default or VITE_THEME=christmas at build time.
// The admin portal setting (served by /api/theme) overrides this at runtime.
export const CODE_THEME: ThemeName =
  (import.meta as any).env?.VITE_THEME === 'christmas' ? 'christmas' : 'default';

const KEY = 'erlc_theme';

export function applyTheme(theme: ThemeName) {
  const t: ThemeName = theme === 'christmas' ? 'christmas' : 'default';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(KEY, t); } catch {}
  window.dispatchEvent(new CustomEvent('erlc-theme-change', { detail: t }));
}

export function currentTheme(): ThemeName {
  return document.documentElement.getAttribute('data-theme') === 'christmas' ? 'christmas' : 'default';
}

export function initTheme() {
  let cached: string | null = null;
  try { cached = localStorage.getItem(KEY); } catch {}
  applyTheme(cached === 'christmas' || cached === 'default' ? cached : CODE_THEME);
  fetch('/api/theme', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && (d.theme === 'christmas' || d.theme === 'default')) applyTheme(d.theme); })
    .catch(() => {});
}
