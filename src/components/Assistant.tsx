import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, User, RefreshCw, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { MetricResults } from '../types';
import { mcpClient } from '../services/mcpClient';

interface AssistantProps {
  primaryTicker: string;
  currency: 'SGD' | 'USD';
  initialAmount: number;
  monthlyContribution: number;
  years: number;
  primaryMetrics: MetricResults | null;
  comparedTickers?: string[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  'How does ES3.SI dividend yield compare to SPY total returns?',
  'What is the difference between regular close and dividend-adjusted close?',
  'Explain the Monte Carlo 10th vs 90th percentile spread.',
  'How does a $500 monthly contribution impact my 10-year terminal wealth?',
];

export const Assistant: React.FC<AssistantProps> = ({
  primaryTicker,
  currency,
  initialAmount,
  monthlyContribution,
  years,
  primaryMetrics,
  comparedTickers = ['ES3.SI', 'SPY', 'VT', 'QQQ'],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello! I am your **ETF Horizon AI Assistant** powered by Gemini. Ask me anything about ${primaryTicker}, benchmark risk comparisons, compounding mechanics, or your 10-year projections.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (userText?: string) => {
    const textToSend = (userText || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await mcpClient.assistantQuery(
        textToSend,
        {
          primaryTicker,
          currency,
          initialAmount,
          monthlyContribution,
          years,
          primaryMetrics,
          comparedTickers,
        },
        messages.map((m) => ({
          role: m.role,
          text: m.text,
        }))
      );

      const assistantText = data?.reply || 'Unable to retrieve answer.';

      const assistantMessage: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: assistantText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `The assistant is momentarily busy analyzing market dynamics. Please ask again in a few seconds.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sym = currency === 'SGD' ? 'S$' : '$';

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-full shadow-2xl shadow-blue-500/30 border border-blue-400/30 transition-all hover:scale-105 active:scale-95"
        >
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span>Ask Gemini Agent</span>
        </button>
      )}

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div className="flex flex-col w-[360px] sm:w-[420px] h-[520px] max-h-[85vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Gemini Horizon Assistant</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950 border border-blue-800 text-blue-300 font-mono">
                    AI Agent
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Grounded on {primaryTicker} · {sym}{initialAmount.toLocaleString()} + {sym}{monthlyContribution}/mo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center shrink-0 text-blue-300 mt-0.5">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-900/90 border border-slate-800/80 text-slate-200'
                  }`}
                >
                  {msg.text}
                  <div
                    className={`text-[9px] mt-1 text-right ${
                      msg.role === 'user' ? 'text-blue-200' : 'text-slate-500 font-mono'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300 mt-0.5">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 items-center text-slate-400 text-xs">
                <div className="h-6 w-6 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center shrink-0 text-blue-300 animate-spin">
                  <RefreshCw className="h-3.5 w-3.5" />
                </div>
                <span>Gemini is analyzing portfolio dynamics...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-slate-900/40 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                className="shrink-0 px-2.5 py-1 text-[10px] rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={`Ask Gemini about ${primaryTicker}, CAGR, or horizon...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 h-9 px-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-9 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
