import React, { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Navigate,
  Route,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ServersPage } from './pages/ServersPage';
import { DashboardPage } from './pages/DashboardPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { DocsPage } from './pages/DocsPage';
import { PricingPage } from './pages/PricingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { BannedPage } from './pages/BannedPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { UnderConstructionPage } from './pages/UnderConstructionPage';
import { AdminPortalPage } from './pages/AdminPortalPage';
import { PublicServerListingPage } from './pages/PublicServerListingPage';
import { PublicApplicationPage } from './pages/PublicApplicationPage';
import { DiscoveryInvitePage } from './pages/DiscoveryInvitePage';
import { DirectoryPage } from './pages/DirectoryPage';
import { ChangelogPage } from './pages/ChangelogPage';
import { PublicIconRail } from './components/ui/PublicIconRail';
import { RecruitHubPage } from './pages/RecruitHubPage';
import { UptimeTab } from './pages/dashboard/UptimeTab';
import ImportPage from './app/import/page';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { TabErrorBoundary } from './components/TabErrorBoundary';
import { ThemeProvider } from './components/library/theme-provider';
import { Button } from './components/ui/button';
import { AlertTriangle } from 'lucide-react';
import './index.css';
import { initTheme } from './lib/theme';
import { Snow } from './components/Snow';

initTheme();

// Apply performance mode if enabled
try {
  if (localStorage.getItem('erlcus_perf_mode') === 'true') {
    document.body.classList.add('reduce-motion');
  }
} catch {}

function CallbackPage() {
  useEffect(() => {
    async function processAuth() {
      const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
      const hashParams = new URLSearchParams(hash);
      const token = hashParams.get('access_token');

      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      const guildId = searchParams.get('guild_id');

      if (token) {
        try {
          const res = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const user = await res.json();
            localStorage.setItem(
              'erlcus_user',
              JSON.stringify({
                id: user.id,
                username: user.username,
                globalName: user.global_name || user.username,
                avatar: user.avatar,
              })
            );

            try {
              const gRes = await fetch('https://discord.com/api/v10/users/@me/guilds?with_counts=true', {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (gRes.ok) {
                const guilds = await gRes.json();
                localStorage.setItem('erlcus_known_guilds', JSON.stringify(guilds));
              }
            } catch {}

            window.location.assign('/servers');
            return;
          }
        } catch {}
      }

      if (guildId) {
        window.location.assign(`/dashboard/${guildId}?bot_installed=true`);
        return;
      }

      if (code) {
        try {
          const res = await fetch(`/api/auth/discord/callback${window.location.search}`, {
            headers: { Accept: 'application/json' },
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data?.user) {
              localStorage.setItem('connectingerlc_user', JSON.stringify(data.user));
              localStorage.setItem('erlcus_user', JSON.stringify(data.user));
              window.location.assign(data.redirectUrl || '/servers');
              return;
            }
          }
        } catch {}
        window.location.assign('/login?auth_error=authentication_failed');
        return;
      }

      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json().catch(() => null);
          if (meData?.user) {
            localStorage.setItem('connectingerlc_user', JSON.stringify(meData.user));
            localStorage.setItem('erlcus_user', JSON.stringify(meData.user));
            window.location.assign('/servers');
            return;
          }
        }
      } catch {}

      window.location.assign('/login');
    }

    processAuth();
  }, []);

  return (
    <div className="min-h-svh bg-[#09090B] flex flex-col items-center justify-center gap-3 text-sm text-[#A1A1AA] font-sans">
      <div className="size-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      <span>Signing you in with Discord…</span>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorId?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    const errorId = 'ERR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    return { hasError: true, error, errorId };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`[ErrorBoundary] ${this.state.errorId || 'ERR'}:`, error, errorInfo);
    try {
      fetch('/api/telemetry/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId: this.state.errorId,
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        }),
      }).catch(() => {});
    } catch {}
  }
  render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env?.DEV || window.location.hostname === 'localhost');
      return (
        <div className="min-h-svh bg-[#09090B] flex flex-col items-center justify-center p-6 text-center text-[#F4F4F5] font-sans">
          <div className="w-full max-w-[480px] p-6 rounded-[16px] bg-[#0E0E11] border border-[var(--border,#27272A)] space-y-4">
            <h1 className="text-[20px] font-semibold text-[#F4F4F5]">
              This page didn't load
            </h1>
            <p className="text-[14px] leading-relaxed text-[#A1A1AA]">
              An unexpected error occurred while loading this page.
            </p>

            {this.state.error && (
              <div className="text-left p-3 rounded-[8px] bg-[#141417] border border-[var(--border,#27272A)] text-[12px] font-mono text-[#F87171] max-h-48 overflow-auto">
                <p className="font-semibold mb-1">{this.state.error.name}: {this.state.error.message}</p>
                {isDev && this.state.error.stack && (
                  <pre className="text-[#71717A] text-[11px] whitespace-pre-wrap">{this.state.error.stack}</pre>
                )}
              </div>
            )}

            <div className="text-[12px] font-mono text-[#52525B]">
              Error ID: {this.state.errorId || 'ERR-UNKNOWN'}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch {}
                  window.location.href = '/';
                }}
              >
                Reset cache
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
              >
                Back to overview
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function BotRedirect() {
  let targetId: string | null = null;
  try {
    const raw = localStorage.getItem('erlcus_known_guilds');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed[0]?.id) targetId = parsed[0].id;
    }
  } catch {}
  if (targetId) {
    return <Navigate to={`/dashboard/${targetId}/bot`} replace />;
  }
  return <Navigate to="/servers" replace />;
}

function PartnershipsRedirect() {
  let targetId: string | null = null;
  try {
    const raw = localStorage.getItem('erlcus_known_guilds');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed[0]?.id) targetId = parsed[0].id;
    }
  } catch {}
  if (targetId) {
    return <Navigate to={`/dashboard/${targetId}/partnerships`} replace />;
  }
  return <Navigate to="/servers" replace />;
}

function DashboardTabRedirect({ tab }: { tab: string }) {
  let targetId: string | null = null;
  try {
    const raw = localStorage.getItem('erlcus_known_guilds');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed[0]?.id) targetId = parsed[0].id;
    }
    if (!targetId) {
      targetId = localStorage.getItem('erlcus_default_guild');
    }
  } catch {}
  if (targetId) {
    return <Navigate to={`/dashboard/${targetId}/${tab}`} replace />;
  }
  return <Navigate to="/servers" replace />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-svh bg-[#09090B] flex flex-col items-center justify-center gap-3 text-sm text-[#A1A1AA] font-sans">
        <div className="size-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <span>Loading your account…</span>
      </div>
    );
  }

  if ((user as any)?.isBanned) {
    return <Navigate to="/banned" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route errorElement={<RouteErrorBoundary />}>
      <Route path="/" element={<TabErrorBoundary tabTitle="Home"><HomePage /></TabErrorBoundary>} />
      <Route path="/directory" element={<Navigate to="/dashboard?tab=earn" replace />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/servers"
        element={
          <ProtectedRoute>
            <ServersPage />
          </ProtectedRoute>
        }
      />
      <Route path="/auth/discord" element={<CallbackPage />} />
      <Route path="/auth/discord/callback" element={<CallbackPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />
      <Route path="/api/auth/discord/callback" element={<CallbackPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/tos" element={<TermsPage />} />
      <Route path="/admin-portal" element={<AdminPortalPage />} />
      <Route path="/admin-portal/:tab" element={<AdminPortalPage />} />
      <Route path="/admin-panel" element={<AdminPortalPage />} />
      <Route path="/admin-panel/:tab" element={<AdminPortalPage />} />
      <Route
        path="/status"
        element={
          <div className="min-h-svh bg-[#09090B] text-white">
            <PublicIconRail />
            <div className="md:pl-16 pb-16 md:pb-0 py-12 px-4 sm:px-6">
              <TabErrorBoundary tabTitle="System status">
                <UptimeTab />
              </TabErrorBoundary>
            </div>
          </div>
        }
      />
      <Route
        path="/uptime"
        element={
          <div className="min-h-svh bg-[#09090B] text-white">
            <PublicIconRail />
            <div className="md:pl-16 pb-16 md:pb-0 py-12 px-4 sm:px-6">
              <TabErrorBoundary tabTitle="System status">
                <UptimeTab />
              </TabErrorBoundary>
            </div>
          </div>
        }
      />
      <Route
        path="/bot"
        element={
          <ProtectedRoute>
            <BotRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/partnerships"
        element={
          <ProtectedRoute>
            <PartnershipsRedirect />
          </ProtectedRoute>
        }
      />
      <Route path="/promote" element={<ProtectedRoute><DashboardTabRedirect tab="promote" /></ProtectedRoute>} />
      <Route path="/promote-server" element={<ProtectedRoute><DashboardTabRedirect tab="promote" /></ProtectedRoute>} />
      <Route path="/earn" element={<ProtectedRoute><DashboardTabRedirect tab="earn" /></ProtectedRoute>} />
      <Route path="/earn-credits" element={<ProtectedRoute><DashboardTabRedirect tab="earn" /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><DashboardTabRedirect tab="leaderboard" /></ProtectedRoute>} />
      <Route path="/growth" element={<ProtectedRoute><DashboardTabRedirect tab="growth" /></ProtectedRoute>} />
      <Route path="/joins" element={<ProtectedRoute><DashboardTabRedirect tab="joins" /></ProtectedRoute>} />
      <Route path="/my-joins" element={<ProtectedRoute><DashboardTabRedirect tab="joins" /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><DashboardTabRedirect tab="settings" /></ProtectedRoute>} />
      <Route path="/overview" element={<ProtectedRoute><DashboardTabRedirect tab="overview" /></ProtectedRoute>} />
      <Route path="/checkin" element={<ProtectedRoute><DashboardTabRedirect tab="checkin" /></ProtectedRoute>} />
      <Route path="/check-in" element={<ProtectedRoute><DashboardTabRedirect tab="checkin" /></ProtectedRoute>} />
      <Route path="/daily-check-in" element={<ProtectedRoute><DashboardTabRedirect tab="checkin" /></ProtectedRoute>} />
      <Route path="/s/:slug" element={<PublicServerListingPage />} />
      <Route path="/servers/:slug" element={<PublicServerListingPage />} />
      <Route path="/discovery/:serverId/invite" element={<DiscoveryInvitePage />} />
      <Route path="/discovery/:serverId" element={<DiscoveryInvitePage />} />
      <Route
        path="/recruit/:serverSlug"
        element={
          <ProtectedRoute>
            <RecruitHubPage />
          </ProtectedRoute>
        }
      />
      <Route path="/banned" element={<BannedPage />} />
      <Route path="/maintenance" element={<UnderConstructionPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/:guildId"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/:guildId/:tab"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/import"
        element={
          <ProtectedRoute>
            <ImportPage />
          </ProtectedRoute>
        }
      />
      <Route path="/apply/:serverSlug/:formSlug" element={<PublicApplicationPage />} />
      <Route path="/:serverSlug/:formSlug" element={<PublicApplicationPage />} />
      <Route path="/:customSlug" element={<PublicServerListingPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  )
);

function AppContent() {
  const { user, loading } = useAuth();
  const [banDetails, setBanDetails] = React.useState<any>(() => {
    try {
      const stored = localStorage.getItem('erlcus_current_user_ban');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  React.useEffect(() => {
    if ((user as any)?.isBanned || (user as any)?.ban) {
      const b = (user as any)?.ban || { reason: 'You broke the ConnectingERLC rules.', duration: 'Permanent' };
      setBanDetails(b);
      try {
        localStorage.setItem('erlcus_current_user_ban', JSON.stringify(b));
      } catch {}
    } else if (user && !(user as any)?.isBanned && !loading) {
      try {
        localStorage.removeItem('erlcus_current_user_ban');
        setBanDetails(null);
      } catch {}
    }
  }, [user, loading]);

  const [connectionTrouble, setConnectionTrouble] = React.useState(false);
  const [maintenanceInfo, setMaintenanceInfo] = React.useState<any>(null);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const checkStatus = () => {
      fetch('/api/status')
        .then((r) => {
          // A failed status check (e.g. 500 or network error) triggers the connection banner, NOT maintenance
          if (!r.ok && r.status >= 500 && r.status !== 503) {
            setConnectionTrouble(true);
          } else {
            setConnectionTrouble(false);
          }
          return r.ok ? r.json() : null;
        })
        .then((data) => {
          if (data && data.maintenance) {
            const isMaint = Boolean(
              data.maintenance.active === true ||
              data.maintenance.mode === 'maintenance' ||
              data.maintenance.maintenance_on === true
            );
            setMaintenanceInfo(isMaint ? data.maintenance : null);
          }
        })
        .catch(() => {
          setConnectionTrouble(true);
        })
        .finally(() => {
          timer = setTimeout(checkStatus, 15000);
        });
    };
    checkStatus();
    return () => clearTimeout(timer);
  }, []);

  // Admin portal & staff routes are always accessible
  const path = window.location.pathname;
  const isAdminPath = path.startsWith('/admin-portal') || path.startsWith('/admin-panel');
  const isStatusPath = path.startsWith('/status') || path.startsWith('/uptime');
  const isPreview = window.location.search.includes('preview=true') || localStorage.getItem('erlc_preview') === 'true';

  if (window.location.search.includes('preview=true')) {
    try { localStorage.setItem('erlc_preview', 'true'); } catch {}
  }

  // Section 10: Banned user sees BannedPage, but administrators can access /admin-portal to manage bans
  if ((user as any)?.isBanned || banDetails) {
    if (isAdminPath) {
      return <RouterProvider router={router} />;
    }
    return <BannedPage banDetails={banDetails} />;
  }

  // Under Construction Gate: blocks public website ONLY when maintenance is active in Admin Portal
  if (maintenanceInfo && !isAdminPath && !isStatusPath && !isPreview) {
    return <UnderConstructionPage maintenance={maintenanceInfo} />;
  }

  // Server is the single source of truth. Router is ALWAYS mounted so all pages and navigation links work.
  return (
    <>
      {connectionTrouble && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs py-1.5 px-4 text-center font-sans select-none backdrop-blur-md">
          Having trouble connecting to server. Retrying...
        </div>
      )}
      <RouterProvider router={router} />
      <Snow />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const rootEl = document.getElementById('root')!;
const root = (rootEl as any)._reactRoot || createRoot(rootEl);
(rootEl as any)._reactRoot = root;

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
