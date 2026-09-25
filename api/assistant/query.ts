import { generateAssistantReply } from '../../src/services/geminiServer.ts';

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(200).json({ reply: "Please send a POST request with your query." });
  }

  try {
    const { message, context, conversationHistory } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(200).json({ reply: "Please provide a question or topic to discuss." });
    }

    const reply = await generateAssistantReply(message, context, conversationHistory);
    return res.status(200).json({ reply });
  } catch (err: any) {
    console.error("Vercel /api/assistant/query handler error:", err);
    return res.status(200).json({
      reply: "The assistant is analyzing portfolio trajectories. Please submit your question again in a moment."
    });
  }
}
