import React, { useState, useEffect } from 'react';
import { Bug, Megaphone, X, ExternalLink } from 'lucide-react';
import { currentTheme } from '@/lib/theme';

export interface Announcement {
  id: string;
  text: string;
  level?: string;
  active?: boolean;
  link?: string | null;
  endDate?: string | null;
}

export function TopBanner() {
  const [theme, setTheme] = useState(() => currentTheme());
  // Point 3: Closing banner with X only dismisses it for the current session/page view; refreshing brings it back
  const [bugClosed, setBugClosed] = useState(false);
  const [defaultText, setDefaultText] = useState('Found a bug? Report it with /bugreport and earn 50 credits');

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleTheme = () => setTheme(currentTheme());
    window.addEventListener('erlc-theme-change', handleTheme);
    return () => window.removeEventListener('erlc-theme-change', handleTheme);
  }, []);

  // Fetch customizable default banner text from Admin Portal (Point 6)
  useEffect(() => {
    fetch('/api/public/default-banner')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.text && typeof data.text === 'string' && data.text.trim()) {
          setDefaultText(data.text.trim());
        }
      })
      .catch(() => {});
  }, []);

  const fetchAnnouncements = () => {
    fetch('/api/public/announcements')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 8000);
    return () => clearInterval(interval);
  }, []);

  // Find first active, non-expired, non-dismissed announcement
  const activeAnnouncement = announcements.find((a) => {
    if (a.active === false) return false;
    if (dismissedAnnouncements[a.id]) return false;
    if (a.endDate && new Date(a.endDate).getTime() < Date.now()) return false;
    return Boolean(a.text && a.text.trim());
  });

  const isVisible = Boolean(activeAnnouncement || !bugClosed);

  // Sync CSS variables so the whole app moves down with rounded corners and back up square with no gap
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--top-banner-height', isVisible ? '40px' : '0px');
      document.documentElement.style.setProperty('--app-corner-radius', isVisible ? '24px' : '0px');
      document.documentElement.style.setProperty('--top-banner-bg', isVisible ? 'var(--accent)' : 'var(--background)');
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--top-banner-height', '0px');
        document.documentElement.style.setProperty('--app-corner-radius', '0px');
        document.documentElement.style.setProperty('--top-banner-bg', 'var(--background)');
      }
    };
  }, [isVisible]);

  // Point 3: Dismissing an announcement hides it until page refresh
  const handleDismissAnnouncement = (id: string) => {
    setDismissedAnnouncements((prev) => ({ ...prev, [id]: true }));
    fetch(`/api/public/announcements/${id}/dismiss`, { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  // Point 3: Dismissing bug banner hides it until page refresh
  const handleDismissBugBanner = () => {
    setBugClosed(true);
  };

  if (!isVisible) return null;

  // 1. If active announcement exists: show it
  if (activeAnnouncement) {
    return (
      <aside
        role="banner"
        aria-label="Announcement"
        className="fixed top-0 left-0 right-0 h-[40px] px-3 sm:px-6 bg-[var(--accent)] text-white flex items-center justify-between gap-2.5 text-[14px] font-bold font-sans select-none z-50 border-0"
      >
        <div className="flex-1 flex items-center justify-center gap-2 text-center min-w-0 overflow-hidden">
          <Megaphone className="size-4 shrink-0" />
          <span className="truncate whitespace-nowrap text-[14px] font-bold font-sans">
            {activeAnnouncement.text}
          </span>
          {activeAnnouncement.link && (
            <a
              href={activeAnnouncement.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-90 font-bold ml-1 shrink-0"
            >
              <span>Learn more</span>
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        {/* Right side: Close button */}
        <div className="flex items-center gap-2 shrink-0 ml-1">
          <button
            type="button"
            onClick={() => handleDismissAnnouncement(activeAnnouncement.id)}
            aria-label="Close"
            title="Close"
            className="p-1 rounded hover:bg-black/20 text-white/90 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      </aside>
    );
  }

  // 2. Otherwise: show Bug Report Banner
  return (
    <aside
      role="banner"
      aria-label="Bug report notice"
      className="fixed top-0 left-0 right-0 h-[40px] px-3 sm:px-6 bg-[var(--accent)] text-white flex items-center justify-between gap-2.5 text-[14px] font-bold font-sans select-none z-50 border-0"
    >
      <div className="flex-1 flex items-center justify-center gap-2 text-center min-w-0 overflow-hidden">
        <Bug className="size-4 shrink-0" />
        <span className="truncate whitespace-nowrap text-[14px] font-bold font-sans">
          {defaultText.includes('/bugreport') ? (
            <>
              {defaultText.split('/bugreport')[0]}
              <code className="px-1.5 py-0.5 rounded bg-black/20 font-mono text-[13px] text-white">/bugreport</code>
              {defaultText.split('/bugreport')[1]}
            </>
          ) : (
            defaultText
          )}
        </span>
      </div>

      {/* Right side: Close button */}
      <div className="flex items-center gap-2 shrink-0 ml-1">
        <button
          type="button"
          onClick={handleDismissBugBanner}
          aria-label="Close"
          title="Close"
          className="p-1 rounded hover:bg-black/20 text-white/90 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
}
