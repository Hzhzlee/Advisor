import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/mcp.ts';
import { generateAssistantReply } from './src/services/geminiServer.ts';

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

  // Dedicated Assistant Query Endpoint with guaranteed JSON response
  app.post('/api/assistant/query', async (req, res) => {
    try {
      const { message, context, conversationHistory } = req.body || {};

      if (!message || typeof message !== 'string') {
        return res.status(200).json({ reply: 'Please provide a question or topic to discuss.' });
      }

      const reply = await generateAssistantReply(message, context, conversationHistory);
      return res.status(200).json({ reply });
    } catch (err: any) {
      console.error('Gemini Assistant Query error:', err);
      return res.status(200).json({
        reply: 'The assistant is currently analyzing historical ETF dynamics. Please rephrase or try again in a moment.'
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
