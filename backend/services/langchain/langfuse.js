/**
 * LangChain LangFuse Integration
 * Provides observability and tracing for all agents
 */

const { Langfuse } = require('langfuse');
const { OpenAI } = require('openai');

let langfuse = null;
let groqClient = null;
let openaiClient = null;
let deepseekClient = null;
let openrouterClient = null;
let minimaxClient = null;
let geminiClient = null;

/**
 * Initialize LangFuse with credentials from environment
 */
const initializeLangFuse = () => {
  if (langfuse) return langfuse;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    console.warn('⚠️ LangFuse credentials not configured. Running without observability.');
    return null;
  }

  try {
    langfuse = new Langfuse({
      publicKey,
      secretKey,
      host,
    });

    console.log('✅ LangFuse initialized successfully');
    return langfuse;
  } catch (error) {
    console.error('❌ Failed to initialize LangFuse:', error.message);
    return null;
  }
};

/**
 * Get or create Groq client (OpenAI-compatible)
 */
const getGroqClient = () => {
  if (groqClient) return groqClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured in .env');
  }

  groqClient = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  return groqClient;
};

/**
 * Get or create real OpenAI client (api.openai.com)
 * Used as final fallback when all Groq models are rate-limited
 */
const getOpenAIClient = () => {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured in .env');
  }

  // No baseURL override — uses OpenAI's official API
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
};

/**
 * Get or create DeepSeek client (OpenAI-compatible)
 * Used as fallback after Groq, before OpenAI
 */
const getDeepSeekClient = () => {
  if (deepseekClient) return deepseekClient;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured in .env');
  }

  deepseekClient = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  return deepseekClient;
};

/**
 * Get or create OpenRouter client (OpenAI-compatible, 100+ models)
 * Used as fallback after DeepSeek, before OpenAI
 */
const getOpenRouterClient = () => {
  if (openrouterClient) return openrouterClient;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured in .env');
  }

  openrouterClient = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://job-hunter.local',
      'X-Title': 'Job Hunter FTE',
    },
  });

  return openrouterClient;
};

/**
 * Get or create MiniMax client (OpenAI-compatible)
 * Used as fallback after OpenRouter, before OpenAI
 */
const getMiniMaxClient = () => {
  if (minimaxClient) return minimaxClient;

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY not configured in .env');
  }

  minimaxClient = new OpenAI({
    apiKey,
    baseURL: 'https://api.minimaxi.chat/v1',
  });

  return minimaxClient;
};

/**
 * Get or create real Google Gemini client (OpenAI-compatible endpoint)
 * Uses GEMINI_API_KEY from .env
 */
const getGeminiClient = () => {
  if (geminiClient) return geminiClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured in .env');
  }

  geminiClient = new OpenAI({
    apiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });

  return geminiClient;
};

/**
 * Create a new trace for agent execution
 * @param {string} name - Trace name
 * @param {string} userId - User ID
 * @returns {Object} Trace context
 */
const createTrace = (name, userId) => {
  const lf = initializeLangFuse();
  if (!lf) {
    // Return noop trace — span must be a callable function, not null, to avoid TypeError
    return {
      generation: () => ({ end: () => {} }),
      span: (_opts) => ({ end: (_data) => {} }),
      traceId: null,
      end: () => {},
    };
  }

  const trace = lf.trace({
    name,
    userId,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });

  return {
    generation: trace.generation.bind(trace),
    span: trace.span.bind(trace),
    event: trace.event.bind(trace),
    traceId: trace.traceId,
    end: () => {
      // trace has no end() — flush the client instead
      lf.flushAsync().catch(() => {});
    },
  };
};

/**
 * Log agent activity with full visibility
 * @param {string} agentName - Name of the agent
 * @param {string} action - Action being performed
 * @param {Object} data - Data involved
 */
const logAgentActivity = (agentName, action, data) => {
  const timestamp = new Date().toISOString();
  console.log(`🤖 [${agentName}] ${action}`, {
    timestamp,
    data: JSON.stringify(data, null, 2),
  });

  // Also log to LangFuse as a trace event
  const lf = initializeLangFuse();
  if (lf) {
    try {
      const t = lf.trace({
        name: `agent_${agentName}_${action}`,
        metadata: { agent: agentName, action, data, timestamp },
      });
      t.event({ name: action, metadata: data });
    } catch (_) {}
  }
};

/**
 * Get LangSmith trace URL if configured
 * @param {string} traceId - Trace ID
 * @returns {string|null} Trace URL
 */
const getTraceUrl = (traceId) => {
  const langsmithKey = process.env.LANGSMITH_API_KEY;
  if (!langsmithKey || !traceId) return null;

  return `https://smith.langchain.com/o/${process.env.LANGSMITH_PROJECT || 'default'}/traces/${traceId}`;
};

/**
 * Create a generation for LLM calls
 * @param {Object} trace - Trace object
 * @param {string} name - Generation name
 * @param {Object} params - Model parameters
 */
const createGeneration = (trace, name, params) => {
  if (!trace || !trace.generation) return { end: () => {} };
  return trace.generation(name, params);
};

/**
 * Get LangFuse client instance
 */
const getLangFuse = () => {
  if (!langfuse) {
    return initializeLangFuse();
  }
  return langfuse;
};

module.exports = {
  initializeLangFuse,
  getOpenAIClient,
  getGeminiClient,
  getGroqClient,
  getDeepSeekClient,
  getOpenRouterClient,
  getMiniMaxClient,
  createTrace,
  logAgentActivity,
  getTraceUrl,
  createGeneration,
  getLangFuse,
};
