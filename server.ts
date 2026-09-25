import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/mcp.ts';
import { geminiClient } from './src/services/geminiServer.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware for JSON parsing with ample limit
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Mount MCP serverless route directly to mirror Vercel /api/mcp
  app.all('/api/mcp', async (req, res) => {
    try {
      await handler(req, res);
    } catch (err: any) {
      console.error('Error handling /api/mcp:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id ?? null,
          error: { code: -32603, message: 'Internal server error: ' + (err?.message || String(err)) }
        });
      }
    }
  });

  // Gemini Assistant Query Endpoint
  app.post('/api/assistant/query', async (req, res) => {
    try {
      const { message, context, conversationHistory } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message query is required' });
      }

      // Check if GEMINI_API_KEY is present
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Return a helpful informative response when running without an external key
        return res.json({
          reply: `I am your ETF Horizon Analytical Assistant. Currently, GEMINI_API_KEY is not configured in the environment. Based on your current portfolio parameters:\n\n` +
                 `• **Primary Ticker**: ${context?.primaryTicker || 'ES3.SI'}\n` +
                 `• **Initial Capital**: ${context?.currency === 'SGD' ? 'S$' : '$'}${context?.initialAmount?.toLocaleString() || '10,000'}\n` +
                 `• **Monthly Savings**: ${context?.currency === 'SGD' ? 'S$' : '$'}${context?.monthlyContribution?.toLocaleString() || '500'}/mo\n` +
                 `• **Lookback Horizon**: ${context?.years || 10} Years\n\n` +
                 `To enable live interactive AI analysis with Gemini, ensure GEMINI_API_KEY is added to your environment secrets.`
        });
      }

      // Format conversation history for Gemini
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      if (Array.isArray(conversationHistory)) {
        for (const item of conversationHistory.slice(-8)) {
          if (item && item.role && item.text) {
            contents.push({
              role: item.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: item.text }]
            });
          }
        }
      }

      // Append current user message
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const systemPrompt = `You are the executive ETF Horizon Quantitative Assistant. You help users analyze exchange-traded funds, compound returns, risk metrics, and 10-year forward horizons.

CURRENT DASHBOARD CONTEXT:
- Primary Active Ticker: ${context?.primaryTicker || 'ES3.SI'}
- Currency: ${context?.currency || 'SGD'}
- Initial Investment Capital: ${context?.currency === 'SGD' ? 'S$' : '$'}${context?.initialAmount?.toLocaleString() || '10,000'}
- Monthly Contribution: ${context?.currency === 'SGD' ? 'S$' : '$'}${context?.monthlyContribution?.toLocaleString() || '500'}
- Lookback Horizon: ${context?.years || 10} Years
- Compared Tickers: ${Array.isArray(context?.comparedTickers) ? context.comparedTickers.join(', ') : 'ES3.SI, SPY, VT, QQQ'}
${context?.primaryMetrics ? `- Primary Ticker CAGR: ${(context.primaryMetrics.cagr * 100).toFixed(2)}%, Annualized Volatility: ${(context.primaryMetrics.annualized_volatility * 100).toFixed(2)}%, Max Drawdown: ${(context.primaryMetrics.max_drawdown * 100).toFixed(2)}%` : ''}

KEY GUIDELINES:
1. Provide concise, clear, and mathematically sound investment insights.
2. Note that price history uses dividend-adjusted prices (Total Return series) where dividends are accounted for.
3. Keep answers scannable with bullet points and bold highlights.
4. Remind users that projections are illustrative and not financial advice.`;

      const response = await geminiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
        }
      });

      const reply = response.text || 'I analyzed the scenario data, but could not produce a response.';
      return res.json({ reply });
    } catch (err: any) {
      console.error('Gemini Assistant Query error:', err);
      return res.status(500).json({
        error: err?.message || 'Failed to process AI query',
        reply: 'The AI assistant encountered a temporary error connecting to Gemini. Please try again in a moment.'
      });
    }
  });

  // Check if running in production mode
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ETF Horizon] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[ETF Horizon] MCP endpoint active at http://0.0.0.0:${PORT}/api/mcp`);
    console.log(`[ETF Horizon] Gemini Assistant endpoint active at http://0.0.0.0:${PORT}/api/assistant/query`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
