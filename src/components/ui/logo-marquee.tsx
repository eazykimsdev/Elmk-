'use client';

import React, { memo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useMotionValue, animate, motion } from 'motion/react';
import useMeasure from 'react-use-measure';
import { ServerIcon } from '@/components/ServerIcon';

export type MarqueeServer = {
  id?: string;
  name: string;
  icon?: string | null;
  iconUrl?: string | null;
  memberCount?: number;
  slug?: string;
  description?: string;
};

type InfiniteSliderProps = {
  children: React.ReactNode;
  gap?: number;
  duration?: number;
  durationOnHover?: number;
  direction?: 'horizontal' | 'vertical';
  reverse?: boolean;
  className?: string;
};

export const InfiniteSlider = memo(function InfiniteSlider({
  children,
  gap = 32,
  duration = 40,
  durationOnHover,
  direction = 'horizontal',
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const [currentDuration, setCurrentDuration] = useState(duration);
  const [ref, { width, height }] = useMeasure();
  const translation = useMotionValue(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const size = direction === 'horizontal' ? width : height;
    if (!size || size <= 0) return;
    const contentSize = size + gap;
    const from = reverse ? -contentSize / 2 : 0;
    const to = reverse ? 0 : -contentSize / 2;

    let controls: { stop: () => void } | undefined;

    if (isTransitioning) {
      controls = animate(translation, [translation.get(), to], {
        ease: 'linear',
        duration: currentDuration * Math.abs((translation.get() - to) / contentSize),
        onComplete: () => {
          setIsTransitioning(false);
          setKey((prev) => prev + 1);
        },
      });
    } else {
      controls = animate(translation, [from, to], {
        ease: 'linear',
        duration: currentDuration,
        repeat: Infinity,
        repeatType: 'loop',
        repeatDelay: 0,
        onRepeat: () => translation.set(from),
      });
    }

    return () => controls?.stop();
  }, [key, translation, currentDuration, width, height, gap, isTransitioning, direction, reverse]);

  const hoverProps = durationOnHover
    ? {
        onHoverStart: () => {
          setIsTransitioning(true);
          setCurrentDuration(durationOnHover);
        },
        onHoverEnd: () => {
          setIsTransitioning(true);
          setCurrentDuration(duration);
        },
      }
    : {};

  return (
    <div className={cn('overflow-hidden', className)}>
      <motion.div
        ref={ref}
        className="flex w-max"
        style={{
          ...(direction === 'horizontal' ? { x: translation } : { y: translation }),
          gap: `${gap}px`,
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
        }}
        {...hoverProps}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
});

function truncateName(name: string, maxLength = 22): string {
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength).trim()}...`;
}

export const ServerPill = memo(function ServerPill({
  server,
}: {
  server: MarqueeServer;
  onClick?: () => void;
}) {
  const icon = server.iconUrl || server.icon;
  return (
    <div
      className="flex items-center gap-2.5 py-1 px-1 text-left cursor-default shrink-0 select-none pointer-events-none"
    >
      <ServerIcon
        name={server.name}
        iconUrl={icon}
        size="sm"
        className="size-6 rounded-lg shrink-0 object-cover"
      />
      <span className="text-xs sm:text-sm font-medium text-zinc-300 truncate font-sans">
        {truncateName(server.name)}
      </span>
    </div>
  );
});

export const ServerMarquee = memo(function ServerMarquee({
  servers,
  className,
}: {
  servers: MarqueeServer[];
  onSelectServer?: (server: MarqueeServer) => void;
  className?: string;
}) {
  // Sort servers by highest member count first
  const sorted = React.useMemo(() => {
    return [...servers].sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
  }, [servers]);

  if (sorted.length === 0) return null;

  return (
    <div
      className={cn(
        'w-full max-w-6xl mx-auto overflow-hidden py-2 mask-[linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]',
        className
      )}
    >
      <InfiniteSlider gap={32} reverse duration={45} durationOnHover={90}>
        {sorted.map((server, i) => (
          <ServerPill
            key={`${server.id || server.name}-${i}`}
            server={server}
          />
        ))}
      </InfiniteSlider>
    </div>
  );
});

ServerMarquee.displayName = 'ServerMarquee';
export default ServerMarquee;
