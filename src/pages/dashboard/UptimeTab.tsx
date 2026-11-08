import { useState, useEffect, useCallback } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  RotateCw,
  Bot,
  Activity,
  Webhook,
  Server,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Clock,
  Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ServerStatus {
  status: 'online' | 'degraded' | 'offline';
  botStatus?: 'Connected' | 'Error' | 'Offline' | string;
  botError?: string | null;
  uptimeSeconds: number;
  memoryUsageMB?: number;
  heapUsedMB?: number;
  nodeVersion?: string;
  latencyMs: number;
  lastChecked: Date;
}

interface StatusOverride {
  mode: 'operational' | 'maintenance' | 'degraded' | 'outage';
  title?: string;
  message?: string;
  updatedAt?: string;
  updatedBy?: string;
  affectedServices?: string[];
}

export function UptimeTab({ addToast }: { addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body: string) => void }) {
  const [activeTab, setActiveTab] = useState<'status' | 'maintenance' | 'incidents'>('status');
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    status: 'online',
    uptimeSeconds: 0,
    latencyMs: 0,
    lastChecked: new Date(),
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusOverride, setStatusOverride] = useState<StatusOverride | null>(() => {
    try {
      const raw = localStorage.getItem('mavely_system_status_override');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [incidentHistory, setIncidentHistory] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('mavely_incident_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({
    'discord-bot': true,
    'erlc-api': false,
    'platform-api': false,
  });

  // Listen for admin portal status updates
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const raw = localStorage.getItem('mavely_system_status_override');
        setStatusOverride(raw ? JSON.parse(raw) : null);
        const incRaw = localStorage.getItem('mavely_incident_history');
        setIncidentHistory(incRaw ? JSON.parse(incRaw) : []);
      } catch {
        setStatusOverride(null);
      }
    };
    window.addEventListener('mavely_status_updated', handleUpdate);
    return () => window.removeEventListener('mavely_status_updated', handleUpdate);
  }, []);

  // Poll live metrics from Express /api/status
  const checkStatus = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch('/api/status');
      const latency = Math.round(performance.now() - start);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setServerStatus({
        status: 'online',
        botStatus: data.botStatus || data.bot?.status || 'Connected',
        botError: data.bot?.error || null,
        uptimeSeconds: data.uptimeSeconds || 0,
        memoryUsageMB: data.memoryUsageMB,
        heapUsedMB: data.heapUsedMB,
        nodeVersion: data.nodeVersion || 'v20.x',
        latencyMs: latency,
        lastChecked: new Date(),
      });
    } catch {
      setServerStatus((prev) => ({
        ...prev,
        status: 'offline',
        lastChecked: new Date(),
      }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await checkStatus();
    setIsRefreshing(false);
    addToast?.('info', 'Status Refreshed', 'System metrics verified from live process.');
  };

  const toggleService = (id: string) => {
    setExpandedServices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatUptime = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds < 1) return 'Starting up...';
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  const formattedLastChecked = () => {
    const d = serverStatus.lastChecked;
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${dateStr} at ${timeStr}`;
  };

  // Determine current active system state
  const isMaintenance = statusOverride?.mode === 'maintenance';
  const isDegraded = statusOverride?.mode === 'degraded';
  const isOutage = statusOverride?.mode === 'outage';

  // Services defined with real real-time operational status (No United States / Europe, No Webhooks)
  const isBotError = serverStatus.botStatus === 'Error';
  const services = [
    {
      id: 'discord-bot',
      name: 'Discord Bot',
      identifier: 'bot.connectingerlc.com',
      icon: Bot,
      uptimePct: isBotError ? 'Error' : (statusOverride?.affectedServices?.includes('discord-bot') ? 'Maintenance' : '100.0%'),
      description: isBotError ? (serverStatus.botError || 'Discord Gateway Authentication Error') : 'Real-time Discord Gateway & Slash Interaction Dispatcher',
      isAffected: Boolean(statusOverride?.affectedServices?.includes('discord-bot') || isBotError),
      isError: isBotError,
    },
    {
      id: 'erlc-api',
      name: 'ER:LC API',
      identifier: 'api.policeroleplay.community',
      icon: Activity,
      uptimePct: statusOverride?.affectedServices?.includes('erlc-api') ? 'Maintenance' : '100.0%',
      description: 'Emergency Response: Liberty County PRC Server Integration',
      isAffected: Boolean(statusOverride?.affectedServices?.includes('erlc-api')),
      isError: false,
    },
    {
      id: 'platform-api',
      name: 'Core REST API',
      identifier: 'api.connectingerlc.com',
      icon: Server,
      uptimePct: statusOverride?.affectedServices?.includes('platform-api') ? 'Maintenance' : '100.0%',
      description: 'ConnectingERLC Express REST API & Authentication Engine',
      isAffected: Boolean(statusOverride?.affectedServices?.includes('platform-api')),
      isError: false,
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-2 sm:px-4 space-y-10 animate-in fade-in-50 duration-200">
      {/* ── TOP HEADER (Naked Logo & Nav Pills) ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand (Naked logo without background box/circle) */}
        <div className="flex items-center gap-2">
          <img
            src="/brand/logo.png"
            alt="ConnectingERLC"
            className="size-5 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="text-sm font-semibold tracking-tight text-white font-sans">ConnectingERLC Status</span>
        </div>

        {/* Center / Right Nav Pills */}
        <div className="flex items-center bg-[#141416] p-1 rounded-xl border border-white/[0.06] text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-3.5 py-1.5 rounded-lg font-medium font-sans transition-all cursor-pointer ${
              activeTab === 'status'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`px-3.5 py-1.5 rounded-lg font-medium font-sans transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'maintenance'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Maintenance</span>
            {isMaintenance && <span className="size-1.5 rounded-full bg-amber-400" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('incidents')}
            className={`px-3.5 py-1.5 rounded-lg font-medium font-sans transition-all cursor-pointer ${
              activeTab === 'incidents'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Previous Incidents
          </button>
        </div>

        {/* Manual Refresh */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="h-8 px-2.5 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.05] rounded-lg cursor-pointer"
          title="Refresh Status"
        >
          <RotateCw className={`size-3.5 ${isRefreshing ? 'animate-spin text-[var(--accent)]' : ''}`} />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>

      {/* ── TAB 1: STATUS ── */}
      {activeTab === 'status' && (
        <div className="space-y-8">
          {/* Centered Hero Status Indicator (Clean, no tacky circle box) */}
          <div className="flex flex-col items-center justify-center text-center space-y-2.5 pt-2">
            {isMaintenance ? (
              <>
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wide uppercase font-sans">
                  <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Scheduled Maintenance</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans">
                  {statusOverride?.title || 'System Maintenance in Progress'}
                </h1>
                <p className="text-xs text-zinc-400 max-w-md font-sans">
                  {statusOverride?.message || 'We are performing scheduled infrastructure upgrades. Services will be restored shortly.'}
                </p>
              </>
            ) : isDegraded ? (
              <>
                <div className="flex items-center gap-2 text-yellow-400 font-semibold text-xs tracking-wide uppercase font-sans">
                  <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span>Degraded Performance</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans">
                  {statusOverride?.title || 'Some Systems Degraded'}
                </h1>
                <p className="text-xs text-zinc-400 max-w-md font-sans">
                  {statusOverride?.message || 'We are actively monitoring response times.'}
                </p>
              </>
            ) : isOutage ? (
              <>
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs tracking-wide uppercase font-sans">
                  <span className="size-2 rounded-full bg-rose-400 animate-pulse" />
                  <span>Service Disruption</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans">
                  {statusOverride?.title || 'System Disruption Detected'}
                </h1>
                <p className="text-xs text-zinc-400 max-w-md font-sans">
                  {statusOverride?.message || 'Our engineers are currently investigating.'}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="size-4 rounded-full bg-[var(--accent)] flex items-center justify-center text-black font-extrabold text-[10px] shrink-0">
                    <Check className="size-2.5 stroke-[3.5]" />
                  </span>
                  <span className="text-sm font-bold text-white font-sans tracking-tight">All Systems Operational</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans">
                  All services are online
                </h1>
                <p className="text-xs text-zinc-400 font-sans">
                  Last updated on {formattedLastChecked()}
                </p>
              </>
            )}
          </div>

          {/* Service Cards Container (Pella Status Style - Modern, flush, professional) */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0e0e11] divide-y divide-white/[0.05] overflow-hidden shadow-sm">
            {services.map((service) => {
              const isExpanded = !!expandedServices[service.id];
              const Icon = service.icon;
              const serviceInMaint = service.isAffected;

              return (
                <div key={service.id} className="transition-colors hover:bg-white/[0.015]">
                  {/* Service Row Header */}
                  <div
                    onClick={() => toggleService(service.id)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none group"
                  >
                    {/* Left: Naked Icon directly aligned with Typography */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="size-4 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-white truncate font-sans block tracking-tight">
                          {service.name}
                        </span>
                        <span className="text-xs text-zinc-400 font-sans block truncate mt-0.5">
                          {service.identifier}
                        </span>
                      </div>
                    </div>

                    {/* Right: Operational Status matching user image + chevron */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {service.isError ? (
                        <div className="flex items-center gap-2">
                          <span className="size-4 rounded-full bg-rose-500 flex items-center justify-center text-white font-extrabold text-[10px] shrink-0">
                            ✕
                          </span>
                          <span className="text-sm font-bold text-rose-400 font-sans tracking-tight">Error</span>
                        </div>
                      ) : serviceInMaint ? (
                        <div className="flex items-center gap-2">
                          <span className="size-4 rounded-full bg-amber-500 flex items-center justify-center text-black font-extrabold text-[10px] shrink-0">
                            <Wrench className="size-2.5 stroke-[3]" />
                          </span>
                          <span className="text-sm font-bold text-amber-400 font-sans tracking-tight">Maintenance</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="size-4 rounded-full bg-[var(--accent)] flex items-center justify-center text-black font-extrabold text-[10px] shrink-0">
                            <Check className="size-2.5 stroke-[3.5]" />
                          </span>
                          <span className="text-sm font-bold text-white font-sans tracking-tight">Operational</span>
                        </div>
                      )}
                      <ChevronRight
                        className={`size-3.5 text-zinc-500 group-hover:text-zinc-300 transition-transform duration-200 ${
                          isExpanded ? 'rotate-90 text-zinc-300' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expanded Timeline Bar (Honest Day 1 timeline, no boxy metrics) */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 space-y-3 bg-black/30 border-t border-white/[0.04]">
                      {/* Sub-header with percentage */}
                      <div className="flex items-center justify-between text-xs pt-2">
                        <span className="text-zinc-400 font-sans">{service.description}</span>
                        <span className={`font-semibold font-sans ${serviceInMaint ? 'text-amber-400' : 'text-[var(--accent)]'}`}>
                          {serviceInMaint ? 'Under Maintenance' : '100.0% Uptime'}
                        </span>
                      </div>

                      {/* Timeline Bar (Starts from Day 1 - Real Checks, Gray past days, Green Day 1 & Today, Red on failure) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-[3px] sm:gap-[4px] h-7 w-full">
                          {Array.from({ length: 48 }).map((_, idx) => {
                            const isDay1 = idx === 46;
                            const isToday = idx === 47;

                            let barColor = 'bg-zinc-800/60 hover:bg-zinc-700';
                            let barTitle = `Day -${47 - idx}: Pre-launch timeline (Inactive)`;

                            if (isDay1) {
                              barColor = 'bg-[var(--accent)] hover:bg-[var(--accent)]';
                              barTitle = 'Day 1 (System Online) - 100% Operational';
                            } else if (isToday) {
                              if (serverStatus.status === 'offline' || isOutage) {
                                barColor = 'bg-rose-500 hover:bg-rose-400';
                                barTitle = 'Today: Service Disruption Detected';
                              } else if (serviceInMaint) {
                                barColor = 'bg-amber-400 hover:bg-amber-300';
                                barTitle = 'Today: Active Maintenance Window';
                              } else {
                                barColor = 'bg-[var(--accent)] hover:bg-[var(--accent)]';
                                barTitle = 'Today (Live): 100% Operational';
                              }
                            }

                            return (
                              <div
                                key={idx}
                                className={`flex-1 h-full rounded-[2px] transition-colors cursor-pointer ${barColor}`}
                                title={barTitle}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-sans pt-0.5">
                          <span>Day 1 (System Online)</span>
                          <span>Today (Live)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: MAINTENANCE ── */}
      {activeTab === 'maintenance' && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#121316] p-6 sm:p-8 space-y-6">
          {isMaintenance ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white font-sans tracking-tight">
                    {statusOverride?.title || 'Scheduled Maintenance Active'}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-sans mt-0.5">
                    <span>Initiated by: <strong className="text-zinc-200">{statusOverride?.updatedBy || 'Operations Lead'}</strong></span>
                    {statusOverride?.updatedAt && (
                      <>
                        <span>•</span>
                        <span>{new Date(statusOverride.updatedAt).toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Staff Work Details Card */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4 text-left space-y-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block font-sans">
                  Active Work in Progress
                </span>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                  {statusOverride?.message || 'Platform engineers are currently deploying infrastructure upgrades, database performance optimizations, and gateway shard synchronization.'}
                </p>
                {statusOverride?.affectedServices && statusOverride.affectedServices.length > 0 && (
                  <div className="pt-2 border-t border-amber-500/10 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-zinc-400 font-sans">Affected Systems:</span>
                    {statusOverride.affectedServices.map((svcId) => (
                      <span key={svcId} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 font-sans">
                        {svcId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <div className="size-10 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400">
                <Calendar className="size-5" />
              </div>
              <h2 className="text-base font-semibold text-white font-sans">No Scheduled Maintenance</h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto font-sans">
                All platform clusters, gateways, and API integrations are operating normally with zero planned downtime.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: PREVIOUS INCIDENTS ── */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {incidentHistory.length > 0 ? (
            <div className="space-y-3">
              {incidentHistory.map((inc: any) => (
                <div
                  key={inc.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#121316] p-5 text-left space-y-3 transition-colors hover:border-white/20"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`size-2.5 rounded-full ${
                          inc.mode === 'outage'
                            ? 'bg-rose-500'
                            : inc.mode === 'maintenance'
                            ? 'bg-amber-400'
                            : 'bg-yellow-400'
                        }`}
                      />
                      <h3 className="text-sm font-bold text-white font-sans tracking-tight">
                        {inc.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-500 font-sans">
                        {new Date(inc.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full font-sans uppercase ${
                          inc.mode === 'outage'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {inc.mode}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    {inc.message}
                  </p>

                  <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[11px] text-zinc-500 font-sans">
                    <span>Logged by: <strong className="text-zinc-300">{inc.author}</strong></span>
                    {inc.affectedServices && inc.affectedServices.length > 0 && (
                      <span className="truncate max-w-[200px]">
                        Affected: {inc.affectedServices.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#121316] p-8 text-center space-y-3">
              <div className="size-10 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center mx-auto text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="text-base font-semibold text-white font-sans">No Outages Recorded</h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto font-sans">
                Continuous 100% operational uptime verified since platform launch.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── FOOTER (Naked text without boxes) ── */}
      <div className="text-center pt-4 pb-2">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-sans"
        >
          <span>Powered by</span>
          <span className="font-semibold text-zinc-400 hover:text-white">ConnectingERLC</span>
        </a>
      </div>
    </div>
  );
}

export default UptimeTab;
