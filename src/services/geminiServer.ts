import { GoogleGenAI } from '@google/genai';

// Initialize Gemini client server-side using standard @google/genai SDK
const apiKey = process.env.GEMINI_API_KEY;

export const geminiClient = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const MODELS_PRIORITY = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

export async function generateAssistantReply(
  message: string,
  context: any = {},
  conversationHistory: any[] = []
): Promise<string> {
  // If GEMINI_API_KEY is not configured, return an informative contextual response
  if (!process.env.GEMINI_API_KEY) {
    return generateFallbackAnalyticsResponse(message, context);
  }

  // Format contents for Gemini
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  if (Array.isArray(conversationHistory)) {
    for (const item of conversationHistory.slice(-8)) {
      if (item && item.role && item.text) {
        contents.push({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.text }],
        });
      }
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  const sym = context?.currency === 'SGD' ? 'S$' : '$';
  const systemPrompt = `You are the executive ETF Horizon Quantitative Assistant. You help users analyze exchange-traded funds, compound returns, risk metrics, and 10-year forward horizons.

CURRENT DASHBOARD CONTEXT:
- Primary Active Ticker: ${context?.primaryTicker || 'ES3.SI'}
- Currency: ${context?.currency || 'SGD'} (${sym})
- Initial Investment Capital: ${sym}${context?.initialAmount?.toLocaleString() || '10,000'}
- Monthly Contribution: ${sym}${context?.monthlyContribution?.toLocaleString() || '500'}/month
- Lookback Horizon: ${context?.years || 10} Years
- Compared Tickers: ${Array.isArray(context?.comparedTickers) ? context.comparedTickers.join(', ') : 'ES3.SI, SPY, VT, QQQ'}
${context?.primaryMetrics ? `- Historical CAGR: ${(context.primaryMetrics.cagr * 100).toFixed(2)}%, Annualized Volatility: ${(context.primaryMetrics.annualized_volatility * 100).toFixed(2)}%, Max Drawdown: ${(context.primaryMetrics.max_drawdown * 100).toFixed(2)}%` : ''}

KEY GUIDELINES:
1. Provide concise, clear, and mathematically sound investment insights.
2. Note that price history uses dividend-adjusted prices (Total Return series) where dividends are reinvested.
3. Keep answers scannable with bullet points and bold highlights.
4. Remind users that projections are illustrative and not financial advice.`;

  // Try available models in order of speed and stability
  for (const model of MODELS_PRIORITY) {
    try {
      const response = await geminiClient.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        },
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`[Gemini Assistant] Model ${model} failed:`, err?.status || err?.message || err);
      // Continue to next model in priority
    }
  }

  // If all models encountered errors (e.g. rate limit, temporary network), return contextual fallback
  return generateFallbackAnalyticsResponse(message, context);
}

function generateFallbackAnalyticsResponse(message: string, context: any = {}): string {
  const sym = context?.currency === 'SGD' ? 'S$' : '$';
  const ticker = context?.primaryTicker || 'ES3.SI';
  const init = context?.initialAmount || 10000;
  const monthly = context?.monthlyContribution || 500;
  const years = context?.years || 10;
  const metrics = context?.primaryMetrics;
  const cagrStr = metrics ? `${(metrics.cagr * 100).toFixed(2)}%` : 'historical rates';
  const volStr = metrics ? `${(metrics.annualized_volatility * 100).toFixed(2)}%` : 'standard volatility';
  const totalContributed = init + years * 12 * monthly;

  const lower = message.toLowerCase();

  if (lower.includes('dividend') || lower.includes('adjclose') || lower.includes('close')) {
    return `### Total Return & Dividend Reinvestment Analysis\n\n` +
      `• **Adjusted Close vs Regular Close:** In ETF Horizon, price series use **Adjusted Close (\`adjclose\`)**, which accounts for all cash distributions, stock splits, and dividend reinvestments.\n` +
      `• **Impact on ${ticker}:** For income-generating ETFs like STI (\`ES3.SI\`) with an annual dividend yield typically between 3.5%–4.5%, looking at standard close price alone significantly underestimates historical total returns. Total return accounting compounds every dividend payout into additional fractional shares.\n` +
      `• **U.S. vs SG:** While \`SPY\` has historically higher capital appreciation, \`ES3.SI\` provides substantial local currency dividend yield with no U.S. withholding tax for Singapore-based investors.`;
  }

  if (lower.includes('monte carlo') || lower.includes('percentile') || lower.includes('10th') || lower.includes('90th')) {
    return `### Monte Carlo Simulation Spread (${ticker})\n\n` +
      `• **10th Percentile (P10 - Bear Market):** Reflects adverse path outcomes where negative market shocks occur early in the 10-year horizon. It highlights down-side resilience when dollar-cost averaging.\n` +
      `• **50th Percentile (P50 - Median):** The median trajectory of 1,000 simulated Geometric Brownian Motion paths with monthly volatility of **${volStr}**.\n` +
      `• **90th Percentile (P90 - Bull Market):** Represents strong market expansion where compounding and low drawdown allow contributions to maximize growth.\n` +
      `• **Key Takeaway:** Even in conservative paths, continuous monthly contributions of **${sym}${monthly.toLocaleString()}/mo** build a disciplined principal floor of **${sym}${totalContributed.toLocaleString()}**.`;
  }

  if (lower.includes('monthly') || lower.includes('contribution') || lower.includes('impact') || lower.includes('savings')) {
    return `### Monthly Contribution Compounding Impact\n\n` +
      `• **Disciplined DCA Accumulation:** Over ${years} years, contributing **${sym}${monthly.toLocaleString()}/mo** accumulates **${sym}${(years * 12 * monthly).toLocaleString()}** in pure principal savings.\n` +
      `• **Combined with Initial Capital:** Starting with **${sym}${init.toLocaleString()}**, your total invested capital reaches **${sym}${totalContributed.toLocaleString()}**.\n` +
      `• **At ${cagrStr} CAGR:** Regular monthly deposits mitigate sequence-of-returns risk by acquiring more ETF shares when prices dip and fewer when prices peak, accelerating 10-year terminal compounding.`;
  }

  return `### Quantitative Overview for ${ticker}\n\n` +
    `• **Portfolio Parameters:** Starting with **${sym}${init.toLocaleString()}** initial capital and **${sym}${monthly.toLocaleString()}/mo** regular savings over a **${years}-year** horizon.\n` +
    `• **Total Capital Invested:** **${sym}${totalContributed.toLocaleString()}**.\n` +
    `• **Benchmark Performance:** Historical annualized CAGR is **${cagrStr}** with annualized volatility of **${volStr}**.\n` +
    `• **Recommendation:** Review the multi-ticker comparison table above to compare ${ticker} against SPY, VT, and QQQ under matching contribution dynamics.`;
}
