import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface UserAvatarProps {
  userId?: string;
  avatarHash?: string | null;
  avatarUrl?: string | null;
  name?: string;
  displayName?: string;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP: Record<string, { sizePx: number; textClass: string }> = {
  sm: { sizePx: 24, textClass: 'text-[10px]' },
  md: { sizePx: 32, textClass: 'text-xs' },
  lg: { sizePx: 44, textClass: 'text-sm font-semibold' },
  xl: { sizePx: 64, textClass: 'text-base font-bold' },
};

function getDefaultDiscordAvatar(userId?: string): string {
  try {
    if (userId && /^\d+$/.test(userId)) {
      const idx = Number((BigInt(userId) >> 22n) % 6n);
      return `https://cdn.discordapp.com/embed/avatars/${Math.abs(idx)}.png`;
    }
  } catch {}
  return 'https://cdn.discordapp.com/embed/avatars/0.png';
}

export function UserAvatar({
  userId,
  avatarHash,
  avatarUrl,
  name,
  displayName,
  size = 'md',
  className
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);

  let sizePx = 32;
  let textClass = 'text-xs';

  if (typeof size === 'number') {
    sizePx = size;
    textClass = size >= 48 ? 'text-sm font-semibold' : size >= 32 ? 'text-xs' : 'text-[10px]';
  } else if (SIZE_MAP[size]) {
    sizePx = SIZE_MAP[size].sizePx;
    textClass = SIZE_MAP[size].textClass;
  }

  // Resolve Discord avatar URL
  let resolvedUrl: string | null = null;
  if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim().length > 0) {
    resolvedUrl = avatarUrl.trim();
  } else if (avatarHash && (avatarHash.startsWith('http://') || avatarHash.startsWith('https://') || avatarHash.startsWith('data:') || avatarHash.startsWith('/'))) {
    resolvedUrl = avatarHash.trim();
  } else if (userId && avatarHash) {
    const isAnimated = avatarHash.startsWith('a_');
    const ext = isAnimated ? 'gif' : 'webp';
    resolvedUrl = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=128`;
  } else if (userId) {
    resolvedUrl = getDefaultDiscordAvatar(userId);
  }

  const effectiveName = displayName || name || 'User';
  const initial = effectiveName.trim().charAt(0).toUpperCase();

  if (!resolvedUrl || hasError) {
    return (
      <div
        className={cn(
          'rounded-full flex items-center justify-center shrink-0 select-none bg-[#18181B] border border-white/[0.08] text-zinc-300 font-semibold',
          textClass,
          className
        )}
        style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
        title={effectiveName}
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
      className={cn('rounded-full shrink-0 object-cover border border-white/[0.06]', className)}
    />
  );
}

export default UserAvatar;

