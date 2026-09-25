export interface PricePoint {
  date: string;
  close: number;
}

export interface MetricResults {
  cagr: number;
  annualized_volatility: number;
  max_drawdown: number;
  best_rolling_10yr_cagr?: number | null;
  worst_rolling_10yr_cagr?: number | null;
  start_date: string;
  end_date: string;
  total_months: number;
  start_price: number;
  end_price: number;
  ten_yr_rolling_note?: string;
}

export interface ScenarioResult {
  id: string;
  name: string;
  adjustment: number;
  cagr: number;
  final_value: number;
  total_contributed: number;
  total_gain: number;
  multiple: number;
  trajectory: Array<{
    year: number;
    value: number;
    totalContributed: number;
  }>;
}

export interface MonteCarloResult {
  p10_final: number;
  p50_final: number;
  p90_final: number;
  trajectories: Array<{
    year: number;
    p10: number;
    p50: number;
    p90: number;
  }>;
}

export interface TickerHistoryState {
  ticker: string;
  prices: PricePoint[];
  metrics: MetricResults | null;
  scenarios: ScenarioResult[];
  monteCarlo: MonteCarloResult | null;
  isLoading: boolean;
  error: string | null;
  dataSource: 'api' | 'csv' | 'benchmark';
}
