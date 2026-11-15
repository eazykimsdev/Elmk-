import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Hash, ChevronDown, Check, X, Search, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DiscordChannelOption {
  id: string;
  name: string;
  type?: number;
  position?: number;
  parentName?: string | null;
  canSend?: boolean;
  missingReason?: string;
}

export interface ChannelPickerProps {
  serverId?: string;
  value?: string;
  onChange: (channelId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  channels?: DiscordChannelOption[];
}

export function ChannelPicker({
  serverId,
  value,
  onChange,
  placeholder = 'Select a channel...',
  disabled = false,
  className = '',
  channels: propChannels
}: ChannelPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchedChannels, setFetchedChannels] = useState<DiscordChannelOption[]>([]);
  const [botInGuild, setBotInGuild] = useState<boolean>(true);

  const loadChannels = async (force = false) => {
    if (!serverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/discord/channels${force ? '?force=true' : ''}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setFetchedChannels(Array.isArray(data.channels) ? data.channels : []);
        setBotInGuild(data.botInGuild !== false);
      }
    } catch (err) {
      console.warn('[ChannelPicker] Could not fetch channels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serverId && !propChannels) {
      loadChannels();
    }
  }, [serverId, propChannels]);

  const channelList = propChannels || fetchedChannels;

  const selectedChannel = useMemo(() => {
    return channelList.find((c) => String(c.id) === String(value));
  }, [channelList, value]);

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channelList;
    return channelList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.parentName && c.parentName.toLowerCase().includes(q))
    );
  }, [channelList, search]);

  return (
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
            <Hash className="size-3.5 text-zinc-400 shrink-0" />
            {selectedChannel ? (
              <span className="text-white truncate font-medium">
                {selectedChannel.name}
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
              placeholder="Search channels..."
              className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
              autoFocus
            />
            {serverId && (
              <button
                type="button"
                onClick={() => loadChannels(true)}
                disabled={loading}
                title="Force refresh from Discord"
                className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
              >
                <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
              </button>
            )}
          </div>

          {/* Channels List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
            {!botInGuild && (
              <div className="p-2 mb-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>The bot is not yet in this Discord server. Invite the bot to load live channels.</span>
              </div>
            )}

            {filteredChannels.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                {loading ? 'Loading Discord channels...' : 'No channels found.'}
              </div>
            ) : (
              filteredChannels.map((ch) => {
                const isSelected = String(ch.id) === String(value);
                const canSend = ch.canSend !== false;

                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      onChange(ch.id);
                      setOpen(false);
                    }}
                    title={!canSend ? (ch.missingReason || 'Bot missing Send Messages in this channel') : undefined}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-sans transition-colors text-left',
                      isSelected
                        ? 'bg-[var(--accent-soft)] text-white font-medium'
                        : canSend
                        ? 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                        : 'text-zinc-500 hover:text-zinc-400 hover:bg-white/[0.02] opacity-75'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Hash className={cn('size-3.5 shrink-0', canSend ? 'text-zinc-400' : 'text-zinc-600')} />
                      <div className="truncate">
                        <span className="truncate">{ch.name}</span>
                        {ch.parentName && (
                          <span className="text-[10px] text-zinc-500 ml-1.5 font-normal">
                            ({ch.parentName})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {!canSend && (
                        <span
                          className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium"
                          title={ch.missingReason || 'Bot missing Send Messages in this channel'}
                        >
                          No send perm
                        </span>
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
  );
}
