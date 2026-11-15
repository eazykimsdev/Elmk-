import React, { useState, useEffect, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Shield, ChevronDown, Check, X, Search, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DiscordRoleOption {
  id: string;
  name: string;
  color?: string | null;
  position?: number;
  mentionable?: boolean;
  managed?: boolean;
  belowBot?: boolean;
}

export interface RolePickerProps {
  serverId?: string;
  value?: string;
  onChange: (roleId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  roles?: DiscordRoleOption[];
}

export function RolePicker({
  serverId,
  value,
  onChange,
  placeholder = 'Select a role...',
  disabled = false,
  className = '',
  roles: propRoles
}: RolePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchedRoles, setFetchedRoles] = useState<DiscordRoleOption[]>([]);
  const [botInGuild, setBotInGuild] = useState<boolean>(true);
  const [botHighestPosition, setBotHighestPosition] = useState<number>(0);

  const loadRoles = async (force = false) => {
    if (!serverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/discord/roles${force ? '?force=true' : ''}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setFetchedRoles(Array.isArray(data.roles) ? data.roles : []);
        setBotInGuild(data.botInGuild !== false);
        setBotHighestPosition(Number(data.botHighestPosition) || 0);
      }
    } catch (err) {
      console.warn('[RolePicker] Could not fetch roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverId && !propRoles) {
      loadRoles();
    }
  }, [serverId, propRoles]);

  const roleList = propRoles || fetchedRoles;

  const selectedRole = useMemo(() => {
    return roleList.find((r) => String(r.id) === String(value));
  }, [roleList, value]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roleList;
    return roleList.filter((r) => r.name.toLowerCase().includes(q));
  }, [roleList, search]);

  const isSelectedRoleAboveBot = selectedRole && selectedRole.belowBot === false;

  return (
    <div className="space-y-1">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              'w-full h-10 px-3 rounded-xl border border-white/[0.08] bg-[#0E0E11] text-xs font-sans text-left flex items-center justify-between gap-2 transition-all',
              'hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
              disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              {selectedRole?.color ? (
                <span
                  className="size-3 rounded-full shrink-0 border border-white/20"
                  style={{ backgroundColor: selectedRole.color }}
                />
              ) : (
                <Shield className="size-3.5 text-zinc-400 shrink-0" />
              )}
              {selectedRole ? (
                <span className="text-white truncate font-medium">
                  {selectedRole.name}
                </span>
              ) : (
                <span className="text-zinc-500 truncate">{placeholder}</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                  }}
                  className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-white/[0.06] transition-colors"
                  title="Clear selection"
                >
                  <X className="size-3" />
                </span>
              )}
              <ChevronDown className="size-3.5 text-zinc-500 transition-transform duration-150" />
            </div>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 w-[280px] sm:w-[320px] rounded-xl border border-white/[0.08] bg-[#121215] p-2 shadow-2xl space-y-2 animate-in fade-in-50 zoom-in-95 duration-150"
          >
            {/* Search Header */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0A0A0C] border border-white/[0.06]">
              <Search className="size-3.5 text-zinc-500 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles..."
                className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                autoFocus
              />
              {serverId && (
                <button
                  type="button"
                  onClick={() => loadRoles(true)}
                  disabled={loading}
                  title="Force refresh from Discord"
                  className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
                >
                  <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
                </button>
              )}
            </div>

            {/* Roles List */}
            <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
              {!botInGuild && (
                <div className="p-2 mb-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                  <span>The bot is not yet in this Discord server. Invite the bot to inspect live role hierarchy.</span>
                </div>
              )}

              {filteredRoles.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  {loading ? 'Loading Discord roles...' : 'No roles found.'}
                </div>
              ) : (
                filteredRoles.map((r) => {
                  const isSelected = String(r.id) === String(value);
                  const isBelowBot = r.belowBot !== false;

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        onChange(r.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-sans transition-colors text-left',
                        isSelected
                          ? 'bg-[var(--accent-soft)] text-white font-medium'
                          : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {r.color ? (
                          <span
                            className="size-2.5 rounded-full shrink-0 border border-white/20"
                            style={{ backgroundColor: r.color }}
                          />
                        ) : (
                          <Shield className="size-3 text-zinc-500 shrink-0" />
                        )}
                        <span className="truncate">{r.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {!isBelowBot && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium"
                            title="Role sits above the bot in Discord hierarchy and cannot be managed by the bot"
                          >
                            Above bot
                          </span>
                        )}
                        {r.mentionable && (
                          <span className="text-[10px] text-zinc-500">@mention</span>
                        )}
                        {isSelected && <Check className="size-3.5 text-[var(--accent)] stroke-[2.5]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {isSelectedRoleAboveBot && (
        <p className="text-[11px] text-amber-400 flex items-center gap-1 pt-1 font-sans">
          <AlertTriangle className="size-3 shrink-0" />
          <span>Warning: This role is higher than the bot's highest role. Move the bot's role higher in Discord Server Settings.</span>
        </p>
      )}
    </div>
  );
}

