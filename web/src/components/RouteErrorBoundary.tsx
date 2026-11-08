import React, { useEffect, useState } from 'react';
import { useRouteError, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

export function RouteErrorBoundary() {
  const error: any = useRouteError();
  const navigate = useNavigate();
  const [errorId] = useState(() => 'err_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));

  useEffect(() => {
    try {
      fetch('/api/telemetry/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId,
          name: error?.name || 'RouteError',
          message: error?.message || String(error),
          stack: error?.stack,
          url: window.location.href,
        }),
      }).catch(() => {});
    } catch {}
    console.error(`[RouteErrorBoundary ${errorId}]`, error);
  }, [error, errorId]);

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

        {isDev && error && (
          <div className="text-left p-3 rounded-[8px] bg-[#141417] border border-[var(--border,#27272A)] text-[12px] font-mono text-[#F87171] max-h-48 overflow-auto">
            <p className="font-semibold mb-1">{error.name || 'Error'}: {error.message || String(error)}</p>
            {error.stack && <pre className="text-[#71717A] text-[11px] whitespace-pre-wrap">{error.stack}</pre>}
          </div>
        )}

        <div className="text-[12px] font-mono text-[#52525B]">
          Error ID: {errorId}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
          >
            Back to overview
          </Button>
        </div>
      </div>
    </div>
  );
}

