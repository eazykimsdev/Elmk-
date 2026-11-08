import React, { useState } from 'react';
import { BRAND } from '@/config/brand';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function BrandLogo({ className = '', size = 'md', showText = true }: BrandLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const iconSizes = {
    sm: 'size-6 text-xs',
    md: 'size-8 text-sm',
    lg: 'size-10 text-base',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={`flex items-center gap-2.5 font-sans ${className}`}>
      {!imgFailed ? (
        <img
          src={BRAND.logoPng}
          alt={BRAND.name}
          className={`${iconSizes[size]} object-contain`}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className={`${iconSizes[size]} rounded-lg bg-[var(--accent)] text-black font-black flex items-center justify-center shrink-0 tracking-tighter`}
        >
          C
        </div>
      )}
      {showText && (
        <span className={`font-semibold tracking-tight text-white ${textSizes[size]}`}>
          {BRAND.name}
        </span>
      )}
    </div>
  );
}

export default BrandLogo;

