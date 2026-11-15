export type ThemeName = 'default' | 'christmas';

// Code-level switch: set VITE_THEME=default or VITE_THEME=christmas at build time.
// The admin portal setting (served by /api/theme) overrides this at runtime.
export const CODE_THEME: ThemeName =
  (import.meta as any).env?.VITE_THEME === 'default' ? 'default' : 'christmas';

const KEY = 'erlc_theme';

export function applyTheme(theme: ThemeName) {
  const t: ThemeName = theme === 'default' ? 'default' : 'christmas';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(KEY, t); } catch {}
  window.dispatchEvent(new CustomEvent('erlc-theme-change', { detail: t }));
}

export function currentTheme(): ThemeName {
  return document.documentElement.getAttribute('data-theme') === 'default' ? 'default' : 'christmas';
}

export function initTheme() {
  let cached: string | null = null;
  try { cached = localStorage.getItem(KEY); } catch {}
  applyTheme(cached === 'default' ? 'default' : 'christmas');
  fetch('/api/theme', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && (d.theme === 'christmas' || d.theme === 'default')) applyTheme(d.theme); })
    .catch(() => {});
}
