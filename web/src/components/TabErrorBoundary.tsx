import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TabErrorBoundaryProps {
  children: React.ReactNode;
  tabTitle?: string;
  onReset?: () => void;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId?: string;
}

export class TabErrorBoundary extends React.Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    const errorId = 'ERR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[TabErrorBoundary] ${this.state.errorId || 'ERR'} in ${this.props.tabTitle || 'tab'}:`, error, errorInfo);
    try {
      fetch('/api/telemetry/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId: this.state.errorId,
          tabTitle: this.props.tabTitle,
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        }),
      }).catch(() => {});
    } catch {}
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env?.DEV || window.location.hostname === 'localhost');

      return (
        <div className="rounded-[16px] border border-[var(--border)] bg-[#0E0E11] p-8 max-w-lg mx-auto text-center space-y-4 my-12 font-sans">
          <div className="size-12 rounded-[12px] bg-[#141417] border border-[var(--border)] flex items-center justify-center mx-auto text-[#FBBF24]">
            <AlertTriangle className="size-6" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-[16px] font-semibold text-[#F4F4F5]">
              Couldn't load {this.props.tabTitle || 'section'}
            </h3>
            <p className="text-[13px] text-[#A1A1AA]">
              An unexpected error occurred while loading this section.
            </p>
            {!isDev && this.state.errorId && (
              <p className="text-[12px] font-mono text-[#71717A]">
                Error ID: {this.state.errorId}
              </p>
            )}
          </div>

          {isDev && this.state.error && (
            <div className="text-left p-3 rounded-[8px] bg-[#09090B] border border-[var(--border)] text-[11px] font-mono text-[#F87171] max-h-48 overflow-auto">
              <p className="font-semibold mb-1">{this.state.error.name}: {this.state.error.message}</p>
              <pre className="text-[#71717A] whitespace-pre-wrap">{this.state.error.stack}</pre>
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={this.handleReset}
              className="gap-2"
            >
              <RefreshCw className="size-3.5" />
              <span>Try again</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
