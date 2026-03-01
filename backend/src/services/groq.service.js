import Groq from 'groq-sdk';
import { env } from '../config/env.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

const MODEL = 'llama-3.1-8b-instant';

/**
 * Standard chat completion (returns full response)
 */
export const chatCompletion = async (messages, options = {}) => {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    ...options,
  });
  return response.choices[0].message.content;
};

/**
 * JSON-safe completion — parses response as JSON, retries once if needed
 */
export const jsonCompletion = async (prompt, options = {}) => {
  const messages = [
    {
      role: 'system',
      content: 'You are a precise JSON API. Always respond with valid JSON only. No markdown, no explanation.',
    },
    { role: 'user', content: prompt },
  ];

  const raw = await chatCompletion(messages, { temperature: 0.2, ...options });

  try {
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Retry once with stricter instruction
    const retryMessages = [
      ...messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: 'Your response was not valid JSON. Please respond with ONLY the JSON object, nothing else.' },
    ];
    const retryRaw = await chatCompletion(retryMessages, { temperature: 0.1 });
    const retryCleaned = retryRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(retryCleaned);
  }
};

/**
 * Plain text completion for CV tailoring and long-form content
 */
export const textCompletion = async (prompt, options = {}) => {
  const messages = [
    { role: 'user', content: prompt },
  ];
  return chatCompletion(messages, { temperature: 0.7, maxTokens: 8192, ...options });
};

export default groq;
