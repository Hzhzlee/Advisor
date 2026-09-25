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
