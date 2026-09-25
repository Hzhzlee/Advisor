import React, { useState } from 'react';
import { Search, Sliders, RefreshCw } from 'lucide-react';

interface ControlsProps {
  ticker: string;
  onTickerChange: (ticker: string) => void;
  years: number;
  onYearsChange: (years: number) => void;
  initialAmount: number;
  onInitialAmountChange: (amount: number) => void;
  monthlyContribution: number;
  onMonthlyContributionChange: (contrib: number) => void;
  cagrAdjustment: number;
  onCagrAdjustmentChange: (adj: number) => void;
  isLoading: boolean;
  onRunMcpPipeline: () => void;
  currency: 'SGD' | 'USD';
}

const POPULAR_TICKERS = [
  { symbol: 'ES3.SI', label: 'ES3.SI', name: 'STI ETF (Singapore)' },
  { symbol: 'SPY', label: 'SPY', name: 'S&P 500 (US Large Cap)' },
  { symbol: 'VT', label: 'VT', name: 'VT (Vanguard Total World)' },
  { symbol: 'QQQ', label: 'QQQ', name: 'Invesco Nasdaq 100' },
];

export const Controls: React.FC<ControlsProps> = ({
  ticker,
  onTickerChange,
  years,
  onYearsChange,
  initialAmount,
  onInitialAmountChange,
  monthlyContribution,
  onMonthlyContributionChange,
  cagrAdjustment,
  onCagrAdjustmentChange,
  isLoading,
  onRunMcpPipeline,
  currency,
}) => {
  const [customInput, setCustomInput] = useState('');
  const currencySymbol = currency === 'SGD' ? 'S$' : '$';

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onTickerChange(customInput.trim().toUpperCase());
      setCustomInput('');
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        {/* Ticker Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Target ETF:
          </span>
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
            {POPULAR_TICKERS.map((t) => {
              const isActive = ticker.toUpperCase() === t.symbol;
              return (
                <button
                  key={t.symbol}
                  type="button"
                  onClick={() => onTickerChange(t.symbol)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={t.name}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Custom ticker search form */}
          <form onSubmit={handleCustomSubmit} className="flex items-center">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Custom ticker..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value.toUpperCase())}
                className="w-32 sm:w-36 h-8 pl-7 pr-2.5 text-xs font-mono font-medium text-slate-200 bg-slate-950/90 border border-slate-800 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <Search className="absolute left-2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
            </div>
            {customInput.trim() && (
              <button
                type="submit"
                className="ml-1.5 h-8 px-2.5 text-xs font-medium text-blue-400 hover:text-white bg-blue-950/60 border border-blue-800/60 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Apply
              </button>
            )}
          </form>

          {/* Currently selected indicator if custom */}
          {!POPULAR_TICKERS.some((t) => t.symbol === ticker.toUpperCase()) && (
            <span className="text-xs font-mono px-2 py-1 bg-blue-950/70 border border-blue-800/80 text-blue-300 rounded-md">
              Active: {ticker.toUpperCase()}
            </span>
          )}
        </div>

        {/* History Lookback Length */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            History Horizon:
          </span>
          <div className="flex items-center p-1 bg-slate-950/80 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => onYearsChange(5)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                years === 5
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              5 Years
            </button>
            <button
              type="button"
              onClick={() => onYearsChange(10)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                years === 10
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              10 Years
            </button>
          </div>

          <button
            type="button"
            onClick={onRunMcpPipeline}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm shadow-blue-600/40 disabled:opacity-50 transition-all whitespace-nowrap"
            title="Execute full MCP tool pipeline on current parameters"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Re-compute</span>
          </button>
        </div>
      </div>

      {/* Projection Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
        {/* Initial Principal Capital */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="initial-amount" className="font-semibold text-slate-300">
              Initial Capital ({currencySymbol})
            </label>
            <span className="font-mono text-slate-400 tabular-nums">
              {currencySymbol}{initialAmount.toLocaleString()}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs font-mono text-slate-500">
              {currencySymbol}
            </span>
            <input
              id="initial-amount"
              type="number"
              min="0"
              step="1000"
              value={initialAmount}
              onChange={(e) => onInitialAmountChange(Math.max(0, Number(e.target.value) || 0))}
              className="w-full h-9 pl-9 pr-3 text-sm font-mono tabular-nums text-slate-100 bg-slate-950/80 border border-slate-800 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <p className="text-[11px] text-slate-500">Starting portfolio value deployed at Year 0</p>
        </div>

        {/* Monthly Contribution */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="monthly-contribution" className="font-semibold text-slate-300">
              Monthly Contribution ({currencySymbol})
            </label>
            <span className="font-mono text-slate-400 tabular-nums">
              {currencySymbol}{monthlyContribution.toLocaleString()}/mo
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs font-mono text-slate-500">
              {currencySymbol}
            </span>
            <input
              id="monthly-contribution"
              type="number"
              min="0"
              step="100"
              value={monthlyContribution}
              onChange={(e) => onMonthlyContributionChange(Math.max(0, Number(e.target.value) || 0))}
              className="w-full h-9 pl-9 pr-3 text-sm font-mono tabular-nums text-slate-100 bg-slate-950/80 border border-slate-800 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <p className="text-[11px] text-slate-500">Dollar-cost averaged every month (compounded)</p>
        </div>

        {/* Relative CAGR Adjustment Slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Sliders className="h-3 w-3 text-blue-400" />
              <label htmlFor="cagr-adjustment" className="font-semibold text-slate-300">
                Base CAGR Sensitivity
              </label>
            </div>
            <span
              className={`font-mono text-xs tabular-nums font-semibold ${
                cagrAdjustment > 0
                  ? 'text-emerald-400'
                  : cagrAdjustment < 0
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {cagrAdjustment > 0 ? `+${(cagrAdjustment * 100).toFixed(0)}%` : `${(cagrAdjustment * 100).toFixed(0)}%`}
            </span>
          </div>
          <div className="h-9 flex items-center px-1">
            <input
              id="cagr-adjustment"
              type="range"
              min="-0.5"
              max="0.5"
              step="0.05"
              value={cagrAdjustment}
              onChange={(e) => onCagrAdjustmentChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>-50% Bearish</span>
            <button
              type="button"
              onClick={() => onCagrAdjustmentChange(0)}
              className="text-slate-400 hover:text-blue-400 underline decoration-dotted"
            >
              Reset 0%
            </button>
            <span>+50% Bullish</span>
          </div>
        </div>
      </div>
    </section>
  );
};
