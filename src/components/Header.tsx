import React from 'react';
import { Activity, UploadCloud, Server } from 'lucide-react';

interface HeaderProps {
  onOpenCsvUpload: () => void;
  onScrollToMcp: () => void;
  mcpStatus: 'connected' | 'connecting' | 'error';
  currency: 'SGD' | 'USD';
  onToggleCurrency: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCsvUpload,
  onScrollToMcp,
  mcpStatus,
  currency,
  onToggleCurrency,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element brand wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="font-display text-xl font-extrabold tracking-tight text-white hover:text-blue-400 transition-colors"
          >
            ETF Horizon
          </a>
          <span className="hidden sm:inline-block text-xs font-mono text-slate-500 uppercase tracking-wider">
            10-Year Forward Analytics
          </span>
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <a href="#comparative" className="hover:text-white transition-colors">
            10-Year Multi-Ticker Horizon
          </a>
          <a href="#summary" className="hover:text-white transition-colors">
            Scenario Ledger
          </a>
          <a
            href="#mcp-telemetry"
            onClick={(e) => {
              e.preventDefault();
              onScrollToMcp();
            }}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Activity className="h-3.5 w-3.5 text-blue-400" />
            <span>MCP Activity</span>
          </a>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2.5">
          {/* Currency Toggle */}
          <button
            type="button"
            onClick={onToggleCurrency}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-medium rounded border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 hover:text-white transition-colors whitespace-nowrap"
            title="Toggle Base Currency Display"
          >
            <span className="text-slate-500">Base:</span>
            <span className="text-blue-400 font-semibold">{currency === 'SGD' ? 'S$ (SGD)' : '$ (USD)'}</span>
          </button>

          {/* CSV Fallback Button */}
          <button
            type="button"
            onClick={onOpenCsvUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap"
          >
            <UploadCloud className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden sm:inline">CSV Data Fallback</span>
            <span className="sm:hidden">CSV</span>
          </button>

          {/* MCP Server Status indicator */}
          <button
            type="button"
            onClick={onScrollToMcp}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded border border-slate-800/90 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-850 transition-colors whitespace-nowrap"
            title="Inspect Model Context Protocol server activity"
          >
            <span className="relative flex h-2 w-2">
              {mcpStatus === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  mcpStatus === 'connected'
                    ? 'bg-emerald-500'
                    : mcpStatus === 'connecting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
            </span>
            <Server className="h-3.5 w-3.5 text-slate-400 hidden xs:inline" />
            <span className="hidden sm:inline text-slate-300">MCP: JSON-RPC 2.0</span>
          </button>
        </div>
      </div>
    </header>
  );
};
