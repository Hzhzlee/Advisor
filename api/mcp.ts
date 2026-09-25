/**
 * ETF Horizon - MCP Serverless Handler
 * Implements stateless JSON-RPC 2.0 over HTTP POST for Model Context Protocol (MCP).
 * Public data provider: Yahoo Finance public chart endpoint (NO API keys or env vars needed).
 * Exposes 4 tools: get_price_history, compute_metrics, project_scenarios, monte_carlo.
 */

export interface PricePoint {
  date: string;
  close: number;
}

export interface MetricResults {
  cagr: number;
  annualized_volatility: number;
  max_drawdown: number;
  start_date: string;
  end_date: string;
  total_months: number;
  start_price: number;
  end_price: number;
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

// MCP Tool Definitions with JSON Schemas
const TOOLS = [
  {
    name: "get_price_history",
    description: "Fetch monthly closing prices and currency from Yahoo Finance public chart endpoint without any API keys. Returns chronologically ordered date/close records and currency.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: "ETF or stock symbol (e.g. 'ES3.SI', 'SPY', 'VT', 'QQQ')"
        },
        years: {
          type: "number",
          description: "Lookback duration in years (5 or 10)",
          default: 10
        }
      },
      required: ["ticker"]
    }
  },
  {
    name: "compute_metrics",
    description: "Calculate historical performance metrics: Compound Annual Growth Rate (CAGR), annualized volatility (monthly standard deviation * sqrt(12)), and maximum peak-to-trough drawdown.",
    inputSchema: {
      type: "object",
      properties: {
        prices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "ISO date YYYY-MM-DD" },
              close: { type: "number", description: "Closing price" }
            },
            required: ["date", "close"]
          },
          description: "Chronological monthly price series"
        }
      },
      required: ["prices"]
    }
  },
  {
    name: "project_scenarios",
    description: "Compute 10-year forward deterministic wealth projections for five scenarios with CAGR adjusted relative to base (-20%, -10%, base, +10%, +20%) with monthly contributions and compounding.",
    inputSchema: {
      type: "object",
      properties: {
        start_value: {
          type: "number",
          description: "Initial investment capital (e.g. 10000)"
        },
        base_cagr: {
          type: "number",
          description: "Base annual growth rate decimal (e.g. 0.06 for 6.0%)"
        },
        years: {
          type: "number",
          description: "Forward projection horizon in years (default 10)",
          default: 10
        },
        monthly_contribution: {
          type: "number",
          description: "Fixed monthly savings contribution (default 500)",
          default: 500
        }
      },
      required: ["start_value", "base_cagr"]
    }
  },
  {
    name: "monte_carlo",
    description: "Simulate forward portfolio paths from historical monthly returns using Monte Carlo Geometric Brownian Motion and extract 10th, 50th (median), and 90th percentile trajectories.",
    inputSchema: {
      type: "object",
      properties: {
        prices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              close: { type: "number" }
            },
            required: ["date", "close"]
          },
          description: "Historical price series used to derive historical monthly drift and volatility"
        },
        start_value: {
          type: "number",
          description: "Starting portfolio capital (default 10000)",
          default: 10000
        },
        years: {
          type: "number",
          description: "Forward simulation horizon in years (default 10)",
          default: 10
        },
        monthly_contribution: {
          type: "number",
          description: "Monthly contribution amount (default 500)",
          default: 500
        },
        n_paths: {
          type: "number",
          description: "Number of simulated paths (default 1000)",
          default: 1000
        }
      },
      required: ["prices"]
    }
  }
];

// Helper: Yahoo Finance public fetcher (no API keys required)
async function fetchYahooPriceHistory(
  ticker: string,
  years: number = 10
): Promise<{ currency: string; prices: PricePoint[] }> {
  const cleanTicker = ticker.trim().toUpperCase();
  if (!cleanTicker) {
    throw new Error("Ticker symbol cannot be empty.");
  }

  const range = years <= 5 ? "5y" : "10y";
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanTicker)}?range=${range}&interval=1mo`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanTicker)}?range=${range}&interval=1mo`
  ];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9"
  };

  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        lastError = new Error(`Yahoo Finance HTTP ${response.status}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const chartResult = data?.chart?.result?.[0];

      if (!chartResult) {
        const errorInfo = data?.chart?.error?.description || "Ticker not found or no historical chart data available.";
        lastError = new Error(`Yahoo Finance: ${errorInfo}`);
        continue;
      }

      const meta = chartResult.meta || {};
      const currency = meta.currency || (cleanTicker.endsWith(".SI") ? "SGD" : "USD");

      const timestamps: number[] = chartResult.timestamp || [];
      const quoteCloses: (number | null)[] = chartResult.indicators?.quote?.[0]?.close || [];
      const adjCloses: (number | null)[] = chartResult.indicators?.adjclose?.[0]?.adjclose || [];

      if (!timestamps.length || (!quoteCloses.length && !adjCloses.length)) {
        lastError = new Error(`No price data points returned for ${cleanTicker}.`);
        continue;
      }

      const points: PricePoint[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const t = timestamps[i];
        // Prefer adjusted close (adjclose) so returns include dividends, falling back to close
        const rawClose = adjCloses[i] !== null && adjCloses[i] !== undefined
          ? adjCloses[i]
          : quoteCloses[i];

        if (typeof rawClose === "number" && !isNaN(rawClose) && rawClose > 0) {
          const dateStr = new Date(t * 1000).toISOString().slice(0, 10);
          points.push({
            date: dateStr,
            close: Math.round(rawClose * 10000) / 10000
          });
        }
      }

      // Sort chronologically ascending
      points.sort((a, b) => a.date.localeCompare(b.date));

      const targetPoints = years * 12 + 1;
      const finalPoints = points.length > targetPoints ? points.slice(-targetPoints) : points;

      if (finalPoints.length < 2) {
        throw new Error(`Insufficient monthly price observations (${finalPoints.length}) found for ${cleanTicker}.`);
      }

      return {
        currency,
        prices: finalPoints
      };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error(`Unable to retrieve historical chart data for ${cleanTicker} from Yahoo Finance.`);
}

// Helper: Compute financial metrics (CAGR, annualised volatility, max drawdown)
function calculateMetrics(rawPrices: PricePoint[]): MetricResults {
  const prices = rawPrices
    .filter(p => p && typeof p.close === "number" && !isNaN(p.close) && p.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (prices.length < 2) {
    throw new Error("At least 2 chronological price points required to calculate metrics.");
  }

  const startPrice = prices[0].close;
  const endPrice = prices[prices.length - 1].close;
  const totalMonths = prices.length - 1;

  // Calendar elapsed years
  const startDate = new Date(prices[0].date);
  const endDate = new Date(prices[prices.length - 1].date);
  let elapsedYears = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (isNaN(elapsedYears) || elapsedYears <= 0) {
    elapsedYears = totalMonths / 12;
  }

  // Compound Annual Growth Rate (CAGR)
  const cagr = Math.pow(endPrice / startPrice, 1 / elapsedYears) - 1;

  // Monthly returns for annualised volatility
  const monthlyReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1].close;
    const curr = prices[i].close;
    monthlyReturns.push((curr - prev) / prev);
  }

  const meanReturn = monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length;
  const variance = monthlyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (monthlyReturns.length - 1 || 1);
  const monthlyVol = Math.sqrt(variance);
  const annualizedVolatility = monthlyVol * Math.sqrt(12);

  // Maximum Drawdown: peak-to-trough decline
  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const p of prices) {
    if (p.close > peak) {
      peak = p.close;
    }
    const dd = (p.close - peak) / peak;
    if (dd < maxDrawdown) {
      maxDrawdown = dd;
    }
  }

  return {
    cagr,
    annualized_volatility: annualizedVolatility,
    max_drawdown: maxDrawdown,
    start_date: prices[0].date,
    end_date: prices[prices.length - 1].date,
    total_months: prices.length,
    start_price: startPrice,
    end_price: endPrice
  };
}

// Helper: Deterministic scenario projections compounding monthly
function calculateScenarios(
  startValue: number,
  baseCagr: number,
  years: number = 10,
  monthlyContribution: number = 500
): ScenarioResult[] {
  // Five scenarios adjusted RELATIVE to base: -20%, -10%, base, +10%, +20%
  const adjustments = [
    { adj: -0.20, id: "scen_m20", name: "Severe Bear (-20% rel)" },
    { adj: -0.10, id: "scen_m10", name: "Conservative (-10% rel)" },
    { adj: 0, id: "scen_0", name: "Base Horizon (0% rel)" },
    { adj: 0.10, id: "scen_p10", name: "Optimistic (+10% rel)" },
    { adj: 0.20, id: "scen_p20", name: "Strong Bull (+20% rel)" }
  ];

  const results: ScenarioResult[] = [];

  for (const item of adjustments) {
    // Relative adjustment: e.g. 6% * (1 - 0.20) = 4.8%
    const scenarioCagr = baseCagr * (1 + item.adj);

    // Monthly effective compounding rate: (1 + r)^(1/12) - 1
    const monthlyRate = scenarioCagr > -1 ? Math.pow(1 + scenarioCagr, 1 / 12) - 1 : scenarioCagr / 12;

    const trajectory: Array<{ year: number; value: number; totalContributed: number }> = [];

    let currentValue = startValue;
    let totalContributed = startValue;

    trajectory.push({
      year: 0,
      value: Math.round(currentValue * 100) / 100,
      totalContributed: Math.round(totalContributed * 100) / 100
    });

    const totalMonths = years * 12;
    for (let m = 1; m <= totalMonths; m++) {
      currentValue = currentValue * (1 + monthlyRate) + monthlyContribution;
      totalContributed += monthlyContribution;

      if (m % 12 === 0) {
        trajectory.push({
          year: m / 12,
          value: Math.round(currentValue * 100) / 100,
          totalContributed: Math.round(totalContributed * 100) / 100
        });
      }
    }

    const finalValue = Math.round(currentValue * 100) / 100;
    const finalContributed = Math.round(totalContributed * 100) / 100;
    const totalGain = Math.round((finalValue - finalContributed) * 100) / 100;
    const multiple = finalContributed > 0 ? Math.round((finalValue / finalContributed) * 100) / 100 : 1;

    results.push({
      id: item.id,
      name: item.name,
      adjustment: item.adj,
      cagr: scenarioCagr,
      final_value: finalValue,
      total_contributed: finalContributed,
      total_gain: totalGain,
      multiple,
      trajectory
    });
  }

  return results;
}

// Helper: Monte Carlo Geometric Brownian Motion simulation
function calculateMonteCarlo(
  prices: PricePoint[],
  startValue: number = 10000,
  years: number = 10,
  monthlyContribution: number = 500,
  nPaths: number = 1000
): MonteCarloResult {
  if (!prices || prices.length < 2) {
    throw new Error("At least 2 price observations required to compute Monte Carlo simulation.");
  }

  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1].close;
    const curr = prices[i].close;
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  if (logReturns.length === 0) {
    throw new Error("Unable to derive returns from provided price series.");
  }

  const n = logReturns.length;
  const meanLog = logReturns.reduce((sum, r) => sum + r, 0) / n;
  const varLog = logReturns.reduce((sum, r) => sum + Math.pow(r - meanLog, 2), 0) / (n - 1 || 1);
  const stdLog = Math.sqrt(varLog);

  const totalMonths = years * 12;
  const numPaths = Math.max(100, Math.min(2000, nPaths));
  const yearlyBuckets: number[][] = Array.from({ length: years + 1 }, () => []);

  // Standard Box-Muller normal generator
  function randomNormal(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  for (let p = 0; p < numPaths; p++) {
    let val = startValue;
    yearlyBuckets[0].push(val);

    for (let m = 1; m <= totalMonths; m++) {
      const z = randomNormal();
      const monthlyReturn = Math.exp(meanLog + stdLog * z) - 1;
      val = Math.max(0, val * (1 + monthlyReturn) + monthlyContribution);

      if (m % 12 === 0) {
        yearlyBuckets[m / 12].push(val);
      }
    }
  }

  const trajectories: Array<{ year: number; p10: number; p50: number; p90: number }> = [];

  for (let y = 0; y <= years; y++) {
    const bucket = yearlyBuckets[y].sort((a, b) => a - b);
    const idx10 = Math.floor(0.10 * bucket.length);
    const idx50 = Math.floor(0.50 * bucket.length);
    const idx90 = Math.floor(0.90 * bucket.length);

    trajectories.push({
      year: y,
      p10: Math.round(bucket[idx10] * 100) / 100,
      p50: Math.round(bucket[idx50] * 100) / 100,
      p90: Math.round(bucket[idx90] * 100) / 100
    });
  }

  const finalTraj = trajectories[trajectories.length - 1];

  return {
    p10_final: finalTraj.p10,
    p50_final: finalTraj.p50,
    p90_final: finalTraj.p90,
    trajectories
  };
}

/**
 * Core JSON-RPC 2.0 Dispatcher
 */
export async function handleMcpPayload(body: any): Promise<any> {
  if (!body || typeof body !== "object") {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error: Invalid JSON payload." }
    };
  }

  const { jsonrpc, id, method, params } = body;

  if (jsonrpc !== "2.0") {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32600, message: "Invalid Request: jsonrpc version must be '2.0'." }
    };
  }

  switch (method) {
    case "initialize": {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: {
            name: "etf-horizon-mcp-server",
            version: "1.0.0",
            description: "Institutional ETF horizon analytics & forward projection Model Context Protocol service"
          }
        }
      };
    }

    case "tools/list": {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS
        }
      };
    }

    case "tools/call": {
      if (!params || typeof params !== "object" || !params.name) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Invalid params: 'name' is required for tools/call." }
        };
      }

      const toolName = params.name;
      const args = params.arguments || {};

      try {
        let toolOutput: any;

        switch (toolName) {
          case "get_price_history": {
            if (!args.ticker) {
              throw new Error("Missing required argument 'ticker'.");
            }
            const years = typeof args.years === "number" ? args.years : 10;
            const history = await fetchYahooPriceHistory(args.ticker, years);
            toolOutput = {
              ticker: args.ticker.toUpperCase(),
              currency: history.currency,
              years,
              dataPoints: history.prices.length,
              prices: history.prices
            };
            break;
          }

          case "compute_metrics": {
            if (!Array.isArray(args.prices)) {
              throw new Error("Missing required array argument 'prices'.");
            }
            toolOutput = calculateMetrics(args.prices);
            break;
          }

          case "project_scenarios": {
            if (typeof args.start_value !== "number" || typeof args.base_cagr !== "number") {
              throw new Error("Arguments 'start_value' and 'base_cagr' must be valid numbers.");
            }
            const years = typeof args.years === "number" ? args.years : 10;
            const contribution = typeof args.monthly_contribution === "number" ? args.monthly_contribution : 500;
            toolOutput = calculateScenarios(args.start_value, args.base_cagr, years, contribution);
            break;
          }

          case "monte_carlo": {
            if (!Array.isArray(args.prices)) {
              throw new Error("Missing required array argument 'prices'.");
            }
            const startVal = typeof args.start_value === "number" ? args.start_value : 10000;
            const years = typeof args.years === "number" ? args.years : 10;
            const contribution = typeof args.monthly_contribution === "number" ? args.monthly_contribution : 500;
            const paths = typeof args.n_paths === "number" ? args.n_paths : 1000;
            toolOutput = calculateMonteCarlo(args.prices, startVal, years, contribution, paths);
            break;
          }

          default:
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32601, message: `Tool '${toolName}' not found.` }
            };
        }

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(toolOutput, null, 2)
              }
            ],
            isError: false
          }
        };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: err?.message || String(err)
              }
            ],
            isError: true
          }
        };
      }
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method '${method}' not found.` }
      };
  }
}

/**
 * Standard Vercel Serverless Function entry point
 */
export default async function handler(req: any, res: any) {
  // CORS configuration for flexibility & remote MCP client connectivity
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      service: "ETF Horizon MCP Server",
      protocol: "Model Context Protocol (JSON-RPC 2.0)",
      endpoint: "/api/mcp",
      tools: TOOLS.map(t => t.name)
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Method Not Allowed. Use HTTP POST for MCP JSON-RPC 2.0." }
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Invalid JSON format in request body." }
      });
    }
  }

  const responsePayload = await handleMcpPayload(body);
  return res.status(200).json(responsePayload);
}
