import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-slate-850 bg-slate-950/90 py-8 mt-12 text-xs text-slate-500">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Mandatory Regulatory Disclaimer */}
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-850 flex items-start gap-3 text-slate-400">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-300">Notice:</strong> Projections are illustrative, based on past prices, exclude dividends and fees, and are not financial advice.
          </p>
        </div>

        {/* System & Architecture Info */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 font-mono text-[11px] pt-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>ETF Horizon · MCP Serverless Architecture (JSON-RPC 2.0)</span>
          </div>

          <div className="flex items-center gap-4">
            <span>Serverless Endpoint: /api/mcp</span>
            <span>Yahoo Finance Public Chart Service (Zero Key)</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
