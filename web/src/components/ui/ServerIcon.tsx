import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { getServerInitial } from '@/lib/format';

export interface ServerIconProps {
  guildId?: string;
  serverId?: string;
  icon?: string | null;
  iconHash?: string | null;
  iconUrl?: string | null;
  name?: string;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP: Record<string, { sizePx: number; textClass: string; roundedClass: string }> = {
  sm: { sizePx: 24, textClass: 'text-[10px]', roundedClass: 'rounded-md' },
  md: { sizePx: 36, textClass: 'text-xs', roundedClass: 'rounded-lg' },
  lg: { sizePx: 48, textClass: 'text-sm font-semibold', roundedClass: 'rounded-xl' },
  xl: { sizePx: 64, textClass: 'text-base font-bold', roundedClass: 'rounded-2xl' },
};

export function ServerIcon({
  guildId,
  serverId,
  icon,
  iconHash,
  iconUrl,
  name = 'Server',
  size = 'md',
  className
}: ServerIconProps) {
  const effectiveGuildId = guildId || serverId;
  const effectiveIconUrl = iconUrl || icon;
  const [hasError, setHasError] = useState(false);

  let sizePx = 36;
  let textClass = 'text-xs';
  let roundedClass = 'rounded-lg';

  if (typeof size === 'number') {
    sizePx = size;
    textClass = size >= 48 ? 'text-sm font-semibold' : size >= 32 ? 'text-xs' : 'text-[10px]';
    roundedClass = size >= 64 ? 'rounded-2xl' : size >= 40 ? 'rounded-xl' : 'rounded-lg';
  } else if (SIZE_MAP[size]) {
    sizePx = SIZE_MAP[size].sizePx;
    textClass = SIZE_MAP[size].textClass;
    roundedClass = SIZE_MAP[size].roundedClass;
  }

  // Normalize iconHash and iconUrl
  let cleanHash: string | null = iconHash ? String(iconHash).trim() : null;
  let rawUrl: string | null = iconUrl ? String(iconUrl).trim() : null;

  // If iconUrl is actually a plain hash
  if (rawUrl && !rawUrl.startsWith('http') && !rawUrl.startsWith('data:') && !rawUrl.includes('/')) {
    if (!cleanHash) cleanHash = rawUrl;
    rawUrl = null;
  }

  // If cleanHash is a full URL, extract the hash
  if (cleanHash && (cleanHash.startsWith('http') || cleanHash.includes('/'))) {
    const match = cleanHash.match(/\/icons\/\d+\/([a-zA-Z0-9_]+)/);
    if (match) {
      cleanHash = match[1];
    } else {
      if (!rawUrl) rawUrl = cleanHash;
      cleanHash = null;
    }
  }

  // Strip file extensions and query parameters from cleanHash if present
  if (cleanHash) {
    cleanHash = cleanHash.split('.')[0].split('?')[0];
  }

  // Determine canonical image URL
  let resolvedUrl: string | null = null;
  if (effectiveGuildId && cleanHash && cleanHash.length > 5) {
    const isAnimated = cleanHash.startsWith('a_');
    const ext = isAnimated ? 'gif' : 'webp';
    resolvedUrl = `https://cdn.discordapp.com/icons/${effectiveGuildId}/${cleanHash}.${ext}?size=128`;
  } else if (rawUrl && rawUrl.length > 0) {
    resolvedUrl = rawUrl;
  } else if (effectiveIconUrl && effectiveIconUrl.length > 0) {
    resolvedUrl = effectiveIconUrl;
  }

  const initial = getServerInitial(name);

  if (!resolvedUrl || hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center shrink-0 select-none bg-[#18181B] border border-white/[0.08] text-zinc-300 font-semibold',
          roundedClass,
          textClass,
          className
        )}
        style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
        title={name}
        aria-hidden="true"
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
      className={cn('shrink-0 object-cover border border-white/[0.06]', roundedClass, className)}
    />
  );
}

export default ServerIcon;
