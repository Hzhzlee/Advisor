import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { mcpClient } from '../services/mcpClient';
import { BENCHMARKS } from '../data/benchmarks';
import { PricePoint } from '../types';
import { Plus, X, BarChart3, Info } from 'lucide-react';

interface BenchmarkComparisonChartProps {
  years: number;
}

interface TickerSeriesData {
  ticker: string;
  name: string;
  prices: PricePoint[];
  color: string;
}

const DEFAULT_COMPARISON_TICKERS = ['ES3.SI', 'SPY', 'VT'];
const TICKER_COLORS: Record<string, string> = {
  'ES3.SI': '#38bdf8', // Light sky blue
  'SPY': '#3b82f6',    // Blue
  'VT': '#10b981',     // Emerald
  'QQQ': '#a855f7',    // Purple
  'VTI': '#f59e0b',    // Amber
};

export const BenchmarkComparisonChart: React.FC<BenchmarkComparisonChartProps> = ({ years }) => {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(DEFAULT_COMPARISON_TICKERS);
  const [newTickerInput, setNewTickerInput] = useState('');
  const [seriesList, setSeriesList] = useState<TickerSeriesData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Fetch prices for selected tickers via MCP
  useEffect(() => {
    let isCancelled = false;

    async function loadAllTickers() {
      setIsLoading(true);
      setErrorNotice(null);
      const loaded: TickerSeriesData[] = [];

      for (const t of selectedTickers) {
        try {
          // 1. Attempt MCP tool call
          const result = await mcpClient.getPriceHistory(t, years);
          if (result && Array.isArray(result.prices) && result.prices.length > 0) {
            loaded.push({
              ticker: t,
              name: BENCHMARKS[t]?.name || t,
              prices: result.prices,
              color: TICKER_COLORS[t] || '#60a5fa',
            });
            continue;
          }
        } catch {
          // If MCP get_price_history failed (e.g. no Twelve Data key), fallback to verified benchmarks if available
          if (BENCHMARKS[t]) {
            const { parseCSVToPrices } = await import('../data/benchmarks');
            const benchmarkPrices = parseCSVToPrices(BENCHMARKS[t].csvData);
            const targetMonths = years * 12;
            const sliced = benchmarkPrices.slice(-targetMonths);
            loaded.push({
              ticker: t,
              name: BENCHMARKS[t].name,
              prices: sliced,
              color: TICKER_COLORS[t] || '#60a5fa',
            });
            continue;
          }
        }
      }

      if (!isCancelled) {
        setSeriesList(loaded);
        setIsLoading(false);
      }
    }

    loadAllTickers();

    return () => {
      isCancelled = true;
    };
  }, [selectedTickers, years]);

  const handleAddTicker = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTickerInput.trim().toUpperCase();
    if (!clean) return;
    if (selectedTickers.includes(clean)) {
      setNewTickerInput('');
      return;
    }
    if (selectedTickers.length >= 3) {
      setErrorNotice('You can compare up to 3 tickers simultaneously.');
      return;
    }
    setSelectedTickers([...selectedTickers, clean]);
    setNewTickerInput('');
  };

  const handleRemoveTicker = (tickerToRemove: string) => {
    if (selectedTickers.length <= 1) {
      setErrorNotice('At least one ticker must remain active.');
      return;
    }
    setSelectedTickers(selectedTickers.filter((t) => t !== tickerToRemove));
    setErrorNotice(null);
  };

  // Re-index all series to 100 at the earliest shared starting point
  const { chartData, totalReturns } = React.useMemo(() => {
    if (seriesList.length === 0) return { chartData: [], totalReturns: {} };

    // Find all distinct dates across all series
    const dateSet = new Set<string>();
    seriesList.forEach((s) => s.prices.forEach((p) => dateSet.add(p.date)));
    const sortedDates = Array.from(dateSet).sort();

    // Map prices by date for fast lookup
    const seriesMaps = seriesList.map((s) => ({
      ticker: s.ticker,
      name: s.name,
      map: new Map(s.prices.map((p) => [p.date, p.close])),
      firstPrice: s.prices[0]?.close || 1,
      lastPrice: s.prices[s.prices.length - 1]?.close || 1,
    }));

    // Calculate total return for each ticker
    const returns: Record<string, number> = {};
    seriesMaps.forEach((s) => {
      returns[s.ticker] = (s.lastPrice - s.firstPrice) / s.firstPrice;
    });

    // Sample roughly 1 point per quarter or 1 per month for clean rendering
    const rows = sortedDates.map((d) => {
      const row: any = {
        date: d,
        formattedDate: d.slice(0, 7), // YYYY-MM
      };

      seriesMaps.forEach((s) => {
        const p = s.map.get(d);
        if (p !== undefined) {
          // Indexed to 100 at each ticker's first available point
          row[s.ticker] = Math.round((p / s.firstPrice) * 10000) / 100;
        }
      });

      return row;
    });

    return { chartData: rows, totalReturns: returns };
  }, [seriesList]);

  return (
    <section id="comparative" className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Chart 2: Comparative Horizon (Indexed to 100)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Normalized historical benchmark comparison indexed to base 100 at the start of the lookback window.
          </p>
        </div>

        {/* Ticker Selector Chips & Add Input */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedTickers.map((t) => {
            const color = TICKER_COLORS[t] || '#60a5fa';
            return (
              <span
                key={t}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-slate-950 border border-slate-800 text-slate-200"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span>{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTicker(t)}
                  className="text-slate-500 hover:text-slate-300 ml-1"
                  title={`Remove ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}

          {selectedTickers.length < 3 && (
            <form onSubmit={handleAddTicker} className="flex items-center">
              <input
                type="text"
                placeholder="+ Add (e.g. QQQ)"
                value={newTickerInput}
                onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())}
                className="w-28 h-7 px-2 text-xs font-mono text-slate-200 bg-slate-950 border border-slate-800 rounded-md focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="ml-1 h-7 px-2 text-xs font-medium text-blue-400 bg-slate-950 border border-slate-800 rounded-md hover:bg-blue-900/40"
              >
                <Plus className="h-3 w-3" />
              </button>
            </form>
          )}
        </div>
      </div>

      {errorNotice && (
        <div className="mb-3 text-xs text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded px-3 py-1.5">
          {errorNotice}
        </div>
      )}

      {/* Chart Canvas */}
      <div className="h-[340px] sm:h-[380px] w-full">
        {isLoading && seriesList.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm font-mono">
            Fetching comparative price series via MCP...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm font-mono">
            No price records available for comparison.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

              <XAxis
                dataKey="formattedDate"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickMargin={8}
                minTickGap={40}
              />

              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                domain={['auto', 'auto']}
                tickMargin={8}
                tickFormatter={(v) => `${v}`}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs shadow-2xl backdrop-blur-md min-w-[200px]">
                      <div className="font-mono text-slate-400 pb-1.5 mb-1.5 border-b border-slate-800">
                        Date: <span className="text-white font-semibold">{label}</span>
                      </div>
                      <div className="space-y-1 font-mono">
                        {payload.map((item: any) => {
                          const val = item.value;
                          const growth = val ? (val - 100).toFixed(1) : '0';
                          return (
                            <div key={item.dataKey} className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5" style={{ color: item.color }}>
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                                {item.name}:
                              </span>
                              <span className="font-semibold tabular-nums text-white">
                                {val} <span className="text-[11px] text-slate-400">({Number(growth) >= 0 ? `+${growth}%` : `${growth}%`})</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />

              {seriesList.map((s) => (
                <Line
                  key={s.ticker}
                  type="monotone"
                  dataKey={s.ticker}
                  name={s.ticker}
                  stroke={s.color}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  connectNulls={true}
                />
              ))}

              <Legend
                verticalAlign="bottom"
                height={32}
                wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                formatter={(val) => <span className="text-slate-300 font-medium mr-4">{val}</span>}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Cumulative Return Highlights Row */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-800/80 pt-4">
        {seriesList.map((s) => {
          const ret = totalReturns[s.ticker];
          const isPos = (ret ?? 0) >= 0;
          return (
            <div
              key={s.ticker}
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs font-mono font-bold text-slate-200">{s.ticker}</span>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-mono font-bold tabular-nums ${
                    isPos ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {ret !== undefined ? (isPos ? `+${(ret * 100).toFixed(1)}%` : `${(ret * 100).toFixed(1)}%`) : '—'}
                </span>
                <span className="block text-[10px] text-slate-500">{years}Y Cumulative</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
