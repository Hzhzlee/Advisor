import React from 'react';
import { TrendingUp, ArrowDownRight, Compass, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import { MetricResults, ScenarioResult } from '../types';

interface KpiCardsProps {
  ticker: string;
  metrics: MetricResults | null;
  scenarios: ScenarioResult[];
  currency: 'SGD' | 'USD';
  years: number;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  ticker,
  metrics,
  scenarios,
  currency,
  years,
}) => {
  const sym = currency === 'SGD' ? 'S$' : '$';

  const formatCurrency = (val: number) => {
    return `${sym}${Math.round(val).toLocaleString()}`;
  };

  const formatPct = (val: number, sign: boolean = false) => {
    const formatted = (val * 100).toFixed(2) + '%';
    return sign && val > 0 ? `+${formatted}` : formatted;
  };

  const scenarioColorMap: Record<string, { border: string; bg: string; text: string; badgeBg: string; badgeBorder: string; badgeText: string; badge: string }> = {
    'scen_m20': { border: 'border-rose-200', bg: 'bg-rose-50/70', text: 'text-rose-700', badgeBg: 'bg-rose-100', badgeBorder: 'border-rose-200', badgeText: 'text-rose-800', badge: '-20% rel' },
    'scen_m10': { border: 'border-amber-200', bg: 'bg-amber-50/70', text: 'text-amber-800', badgeBg: 'bg-amber-100', badgeBorder: 'border-amber-200', badgeText: 'text-amber-800', badge: '-10% rel' },
    'scen_0':   { border: 'border-blue-300', bg: 'bg-blue-50/90', text: 'text-blue-900', badgeBg: 'bg-blue-100', badgeBorder: 'border-blue-300', badgeText: 'text-blue-800', badge: 'Base (0%)' },
    'scen_p10': { border: 'border-sky-200',  bg: 'bg-sky-50/70',  text: 'text-sky-800',  badgeBg: 'bg-sky-100',  badgeBorder: 'border-sky-200',  badgeText: 'text-sky-800',  badge: '+10% rel' },
    'scen_p20': { border: 'border-emerald-200', bg: 'bg-emerald-50/70', text: 'text-emerald-800', badgeBg: 'bg-emerald-100', badgeBorder: 'border-emerald-200', badgeText: 'text-emerald-800', badge: '+20% rel' },
  };

  return (
    <div className="space-y-3">
      {/* 3 Core Historical Risk & Return Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Historical CAGR */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-wider">Historical CAGR</span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {metrics ? formatPct(metrics.cagr, true) : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1 font-mono">
              <span>{years}Y lookback ({ticker})</span>
              <span aria-hidden="true">·</span>
              <span>Annualised rate</span>
            </div>
          </div>
        </div>

        {/* Annualised Volatility */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-wider">Annualised Volatility</span>
            <Compass className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {metrics ? formatPct(metrics.annualized_volatility) : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1 font-mono">
              <span>Monthly σ × √12</span>
              <span aria-hidden="true">·</span>
              <span>Dispersion</span>
            </div>
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-wider">Max Drawdown</span>
            <ArrowDownRight className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono tabular-nums text-rose-600">
              {metrics ? formatPct(metrics.max_drawdown) : '—'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1 font-mono">
              <span>Peak-to-trough decline</span>
              <span aria-hidden="true">·</span>
              <span>Period downside</span>
            </div>
          </div>
        </div>
      </div>

      {/* 10-Year Projected Value per Scenario (All 5 Scenarios) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {scenarios.map((s) => {
          const style = scenarioColorMap[s.id] || {
            border: 'border-slate-200',
            bg: 'bg-white',
            text: 'text-slate-900',
            badgeBg: 'bg-slate-100',
            badgeBorder: 'border-slate-200',
            badgeText: 'text-slate-700',
            badge: `${(s.adjustment * 100).toFixed(0)}%`
          };
          const isBase = s.adjustment === 0;

          return (
            <div
              key={s.id}
              className={`rounded-xl border ${style.border} ${style.bg} p-3.5 flex flex-col justify-between shadow-xs hover:shadow-sm transition-all ${
                isBase ? 'ring-2 ring-blue-500/50 shadow-blue-500/10' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-slate-800 truncate">
                  {s.name}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${style.badgeBorder} ${style.badgeBg} ${style.badgeText} font-semibold shrink-0`}>
                  {style.badge}
                </span>
              </div>

              <div className="mt-2">
                <div className={`text-lg sm:text-xl font-bold font-mono tabular-nums ${style.text}`}>
                  {formatCurrency(s.final_value)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                  <span>CAGR: {(s.cagr * 100).toFixed(1)}%</span>
                  <span className="text-slate-500 font-medium">{s.multiple}x MoIC</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
