/**
 * ETF Horizon - Executive Web Application
 * Single-page institutional ETF performance analytics & 10-year forward horizon.
 * Front-end operates strictly as an MCP client communicating with /api/mcp.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Controls } from './components/Controls';
import { KpiCards } from './components/KpiCards';
import { BenchmarkComparisonChart } from './components/BenchmarkComparisonChart';
import { SummaryTable } from './components/SummaryTable';
import { McpActivityPanel } from './components/McpActivityPanel';
import { CsvUploadModal } from './components/CsvUploadModal';
import { Footer } from './components/Footer';
import { mcpClient } from './services/mcpClient';
import { BENCHMARKS, parseCSVToPrices } from './data/benchmarks';
import { PricePoint, MetricResults, ScenarioResult, MonteCarloResult } from './types';
import { AlertTriangle, UploadCloud, CheckCircle, Database } from 'lucide-react';

export default function App() {
  const [ticker, setTicker] = useState('ES3.SI');
  const [years, setYears] = useState(10);
  const [initialAmount, setInitialAmount] = useState(10000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [cagrAdjustment, setCagrAdjustment] = useState(0);
  const [currency, setCurrency] = useState<'SGD' | 'USD'>('SGD');

  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [metrics, setMetrics] = useState<MetricResults | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mcpStatus, setMcpStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [dataSource, setDataSource] = useState<'api' | 'csv' | 'benchmark'>('api');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  const mcpConsoleRef = useRef<HTMLDivElement>(null);

  // Initialize MCP connection and list tools on initial load
  useEffect(() => {
    async function initMcp() {
      try {
        await mcpClient.initialize();
        await mcpClient.listTools();
        setMcpStatus('connected');
      } catch (err) {
        console.error('Failed to initialize MCP client:', err);
        setMcpStatus('error');
      }
    }
    initMcp();
  }, []);

  /**
   * Run downstream analytical MCP tools on current price series
   */
  const runAnalyticsPipeline = useCallback(
    async (priceSeries: PricePoint[], baseTicker: string) => {
      try {
        setIsLoading(true);

        // 1. Compute institutional metrics via MCP compute_metrics
        const metricsRes = await mcpClient.computeMetrics(priceSeries);
        setMetrics(metricsRes);

        // Base CAGR adjusted by slider sensitivity
        const effectiveBaseCagr = metricsRes.cagr * (1 + cagrAdjustment);

        // 2. Compute 10-year deterministic scenarios via MCP project_scenarios
        const scenariosRes = await mcpClient.projectScenarios(
          initialAmount,
          effectiveBaseCagr,
          10,
          monthlyContribution
        );
        setScenarios(scenariosRes);

        // 3. Compute stochastic Monte Carlo percentiles via MCP monte_carlo
        const mcRes = await mcpClient.monteCarlo(
          priceSeries,
          initialAmount,
          10,
          monthlyContribution,
          1000
        );
        setMonteCarlo(mcRes);

        setErrorMessage(null);
      } catch (err: any) {
        console.error('Error executing analytics toolchain:', err);
        setErrorMessage(err?.message || 'Analytics pipeline encountered an error.');
      } finally {
        setIsLoading(false);
      }
    },
    [initialAmount, monthlyContribution, cagrAdjustment]
  );

  /**
   * Fetch price series for ticker via MCP get_price_history
   */
  const fetchTickerData = useCallback(
    async (targetTicker: string, historyYears: number) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        // Front-end calls MCP get_price_history tool
        const result = await mcpClient.getPriceHistory(targetTicker, historyYears);
        if (result && Array.isArray(result.prices) && result.prices.length > 0) {
          setPrices(result.prices);
          setDataSource('api');
          if (result.currency?.toUpperCase() === 'SGD' || targetTicker.toUpperCase().endsWith('.SI')) {
            setCurrency('SGD');
          } else {
            setCurrency('USD');
          }
          await runAnalyticsPipeline(result.prices, targetTicker);
          return;
        }
        throw new Error(`Empty price dataset returned for ${targetTicker}.`);
      } catch (err: any) {
        const errorText = err?.message || String(err);
        console.warn('MCP get_price_history returned notice:', errorText);

        // Check if verified benchmark exists for this ticker
        const benchmark = BENCHMARKS[targetTicker.toUpperCase()];
        if (benchmark) {
          const parsed = parseCSVToPrices(benchmark.csvData);
          const targetMonths = historyYears * 12;
          const sliced = parsed.slice(-targetMonths);
          setPrices(sliced);
          setDataSource('benchmark');
          if (benchmark.currency === 'SGD' || targetTicker.toUpperCase().endsWith('.SI')) {
            setCurrency('SGD');
          } else {
            setCurrency('USD');
          }
          setErrorMessage(
            `Yahoo Finance notice: ${errorText}. Using verified historical series for ${targetTicker}.`
          );
          await runAnalyticsPipeline(sliced, targetTicker);
        } else {
          setErrorMessage(
            `Unable to retrieve market series for "${targetTicker}": ${errorText}. Please try another ticker or upload a CSV.`
          );
          setIsLoading(false);
        }
      }
    },
    [runAnalyticsPipeline]
  );

  // Trigger data load when ticker or history length changes
  useEffect(() => {
    fetchTickerData(ticker, years);
  }, [ticker, years, fetchTickerData]);

  // Re-run projection calculations when capital, contributions, or sensitivity change
  useEffect(() => {
    if (prices.length >= 2 && !isLoading) {
      runAnalyticsPipeline(prices, ticker);
    }
  }, [initialAmount, monthlyContribution, cagrAdjustment]);

  const handleDataLoadedFromCsv = (
    loadedPrices: PricePoint[],
    seriesName: string,
    source: 'csv' | 'benchmark'
  ) => {
    setTicker(seriesName);
    setPrices(loadedPrices);
    setDataSource(source);
    setErrorMessage(null);
    runAnalyticsPipeline(loadedPrices, seriesName);
  };

  const scrollToMcp = () => {
    mcpConsoleRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleCurrency = () => {
    setCurrency((prev) => (prev === 'SGD' ? 'USD' : 'SGD'));
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col antialiased">
      {/* Top Bar Contract Navigation */}
      <Header
        onOpenCsvUpload={() => setIsCsvModalOpen(true)}
        onScrollToMcp={scrollToMcp}
        mcpStatus={mcpStatus}
        currency={currency}
        onToggleCurrency={toggleCurrency}
      />

      {/* Main Workspace Canvas */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Title Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-display">
              ETF Horizon Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Historical performance analytics and 10-year forward projection model.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-blue-600" />
              <span>Data Source:</span>
              <span className="text-slate-900 font-semibold">
                {dataSource === 'api'
                  ? 'Yahoo Finance Public API (Zero Key)'
                  : dataSource === 'benchmark'
                  ? 'Verified Exchange Benchmark'
                  : 'User CSV Upload'}
              </span>
            </span>
          </div>
        </div>

        {/* API Error / Fallback Notification Banner */}
        {errorMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-amber-800">Data Connectivity Notice: </span>
                {errorMessage}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-medium text-xs transition-colors"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Upload CSV / Fallback</span>
              </button>
            </div>
          </div>
        )}

        {/* 1. Global Controls */}
        <Controls
          ticker={ticker}
          onTickerChange={(t) => setTicker(t)}
          years={years}
          onYearsChange={(y) => setYears(y)}
          initialAmount={initialAmount}
          onInitialAmountChange={(a) => setInitialAmount(a)}
          monthlyContribution={monthlyContribution}
          onMonthlyContributionChange={(c) => setMonthlyContribution(c)}
          cagrAdjustment={cagrAdjustment}
          onCagrAdjustmentChange={(adj) => setCagrAdjustment(adj)}
          isLoading={isLoading}
          onRunMcpPipeline={() => fetchTickerData(ticker, years)}
          currency={currency}
        />

        {/* 2. Key Performance Indicators (KPI Cards) */}
        <KpiCards
          ticker={ticker}
          metrics={metrics}
          scenarios={scenarios}
          currency={currency}
          years={years}
        />

        {/* 3. Multi-Ticker 10-Year Horizon Comparison Chart & Projections Table */}
        <BenchmarkComparisonChart
          years={years}
          initialAmount={initialAmount}
          monthlyContribution={monthlyContribution}
          currency={currency}
          activePrimaryTicker={ticker}
          onSelectPrimaryTicker={(t) => setTicker(t)}
        />

        {/* 4. Single-Ticker Detailed Scenario Breakdown & Monte Carlo Ledger */}
        <SummaryTable
          scenarios={scenarios}
          monteCarlo={monteCarlo}
          currency={currency}
          initialAmount={initialAmount}
          monthlyContribution={monthlyContribution}
          years={years}
        />

        {/* 6. MCP Activity Panel (Core Showcase) */}
        <div ref={mcpConsoleRef}>
          <McpActivityPanel />
        </div>
      </main>

      {/* CSV Fallback & Benchmark Modal */}
      <CsvUploadModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onDataLoaded={handleDataLoadedFromCsv}
      />

      {/* Regulatory Footer */}
      <Footer />
    </div>
  );
}
