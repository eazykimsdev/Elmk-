import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';

export type AccentPreset = {
  id: string;
  name: string;
  accent: string;
  textOnAccent: string;
};

export const FIXED_ORANGE_PRESET: AccentPreset = {
  id: 'orange',
  name: 'ConnectingERLC Orange',
  accent: '#F97316',
  textOnAccent: '#1C0A00',
};

export const ACCENT_PRESETS: AccentPreset[] = [FIXED_ORANGE_PRESET];

export function applyAccentToDom() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('dark');
  root.classList.remove('light');

  root.style.setProperty('--accent', '#F97316');
  root.style.setProperty('--accent-hover', '#FB8A3C');
  root.style.setProperty('--accent-foreground', '#1C0A00');
  root.style.setProperty('--accent-soft', 'rgba(249, 115, 22, 0.12)');
  root.style.setProperty('--accent-border', 'rgba(249, 115, 22, 0.35)');
  root.style.setProperty('--brand', '#F97316');
  root.style.setProperty('--brand-foreground', '#1C0A00');
  root.style.setProperty('--brand-muted', 'rgba(249, 115, 22, 0.12)');
  root.style.setProperty('--success', '#F97316');
  root.style.setProperty('--success-foreground', '#1C0A00');
  root.style.setProperty('--success-muted', 'rgba(249, 115, 22, 0.12)');
  root.style.setProperty('--ring', '#F97316');
  root.style.setProperty('--sidebar-primary', '#F97316');
  root.style.setProperty('--sidebar-primary-foreground', '#1C0A00');
  root.style.setProperty('--sidebar-ring', '#F97316');
  root.style.setProperty('--chart-1', '#F97316');
  root.style.setProperty('--chart-positive', '#F97316');
}

export type ThemeProviderState = {
  theme: 'dark';
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
  accent: string;
  currentPreset: AccentPreset;
  presets: AccentPreset[];
  setAccent: (accentId: string) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | null>(null);

export function ThemeProvider({
  children,
  defaultTheme,
  storageKey,
}: {
  children: ReactNode;
  defaultTheme?: string;
  storageKey?: string;
}) {
  useEffect(() => {
    applyAccentToDom();
    try {
      localStorage.removeItem('erlcus_theme_accent');
    } catch {}
  }, []);

  const value: ThemeProviderState = {
    theme: 'dark',
    setTheme: () => {},
    toggleTheme: () => {},
    accent: '#F97316',
    currentPreset: FIXED_ORANGE_PRESET,
    presets: ACCENT_PRESETS,
    setAccent: () => {},
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeProviderContext);
  if (!ctx) {
    return {
      theme: 'dark' as const,
      setTheme: () => {},
      toggleTheme: () => {},
      accent: '#F97316',
      currentPreset: FIXED_ORANGE_PRESET,
      presets: ACCENT_PRESETS,
      setAccent: () => {},
    };
  }
  return ctx;
}
