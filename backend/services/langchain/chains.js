/**
 * LangChain LLM Chains
 * Provides chain execution utilities for agents
 */

const { getGroqClient, getOpenAIClient, getDeepSeekClient, getOpenRouterClient, getMiniMaxClient, getGeminiClient, createTrace, logAgentActivity } = require('./langfuse');
const { ORCHESTRATOR_PROMPTS, JOB_SEARCH_PROMPTS, RESUME_BUILDER_PROMPTS, APPLY_PROMPTS, PREP_PROMPTS, FTE_PROMPTS } = require('./prompts');

// ── Model fallback list (tried in order when rate-limited) ────────────────────
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',      // primary — best quality
  'llama-3.1-8b-instant',         // fallback 1 — fast
  'gemma2-9b-it',                 // fallback 2
  'llama3-8b-8192',               // fallback 3
];

// Track which model to use (rotates on rate-limit)
let currentModelIndex = 0;

function isFallbackError(error) {
  const msg = (error?.message || '').toLowerCase();
  const status = error?.status || error?.response?.status;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('decommissioned') ||
    msg.includes('no longer supported') ||
    msg.includes('model not found') ||
    msg.includes('does not exist')
  );
}

/**
 * Run a prompt through the LLM with automatic model fallback on rate limit.
 * @param {string} prompt - The prompt template
 * @param {Object} params - Parameters to fill in prompt
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Parsed LLM response
 */
const runPrompt = async (prompt, params = {}, options = {}) => {
  const { agentName = 'system', userId = 'unknown' } = options;

  // Replace template variables
  let filledPrompt = prompt;
  Object.keys(params).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    filledPrompt = filledPrompt.replace(regex, JSON.stringify(params[key], null, 2));
  });

  logAgentActivity(agentName, 'prompt_execution', {
    promptLength: filledPrompt.length,
    params: Object.keys(params)
  });

  const groq = getGroqClient();
  const trace = createTrace(`${agentName}_prompt`, userId);

  // Try each model in order, rotating on rate-limit errors
  const startIndex = currentModelIndex;
  let lastError = null;

  for (let i = 0; i < GROQ_MODELS.length; i++) {
    const modelIdx = (startIndex + i) % GROQ_MODELS.length;
    const model = GROQ_MODELS[modelIdx];

    try {
      logAgentActivity(agentName, 'trying_model', { model });

      const generation = trace.generation({ name: `${agentName}_generation`, model });

      const response = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are a strict JSON-only responder for a job hunting system. Output ONLY valid JSON. No markdown, no code blocks, no explanations, no extra text — just the raw JSON object.' },
          { role: 'user', content: filledPrompt }
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content.trim();

      // Parse JSON response
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Failed to parse LLM response as JSON: ${content.substring(0, 200)}`);
        }
      }

      generation.end({
        output: parsed,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
        }
      });
      trace.end();

      // Successful — remember this model for next call
      currentModelIndex = modelIdx;
      logAgentActivity(agentName, 'prompt_completed', { success: true, model });

      return parsed;

    } catch (error) {
      lastError = error;

      if (isFallbackError(error)) {
        // Rate-limited or decommissioned — try next model
        logAgentActivity(agentName, 'model_fallback', {
          model,
          reason: error.message?.substring(0, 80),
          nextModel: GROQ_MODELS[(modelIdx + 1) % GROQ_MODELS.length],
        });
        console.warn(`[LLM] Falling back from ${model}: ${error.message?.substring(0, 60)}`);
        continue;
      }

      // Non-rate-limit error — don't retry
      logAgentActivity(agentName, 'prompt_error', { error: error.message, model });
      throw error;
    }
  }

  // ── All Groq models exhausted → try DeepSeek as second fallback ─────────────
  if (process.env.DEEPSEEK_API_KEY) {
    const DEEPSEEK_MODELS = ['deepseek-chat'];
    logAgentActivity(agentName, 'switching_to_deepseek', { reason: 'all_groq_models_rate_limited' });
    console.warn('[LLM] All Groq models rate-limited. Trying DeepSeek fallback...');

    for (const model of DEEPSEEK_MODELS) {
      try {
        logAgentActivity(agentName, 'trying_model', { model, provider: 'deepseek' });
        const deepseek = getDeepSeekClient();
        const generation = trace.generation({ name: `${agentName}_generation`, model });

        const response = await deepseek.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a strict JSON-only responder for a job hunting system. Output ONLY valid JSON. No markdown, no code blocks, no explanations, no extra text — just the raw JSON object.' },
            { role: 'user', content: filledPrompt },
          ],
          temperature: 0.1,
          max_tokens: 8000,
        });

        const content = response.choices[0].message.content.trim();
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          else throw new Error(`DeepSeek JSON parse failed: ${content.substring(0, 200)}`);
        }

        generation.end({
          output: parsed,
          usage: { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 },
        });
        trace.end();

        logAgentActivity(agentName, 'prompt_completed', { success: true, model, provider: 'deepseek' });
        return parsed;

      } catch (err) {
        logAgentActivity(agentName, 'deepseek_model_failed', { model, error: err.message });
        console.warn(`[LLM] DeepSeek ${model} failed: ${err.message?.substring(0, 60)}`);
        if (isFallbackError(err)) continue;
        throw err;
      }
    }
  }

  // ── All Groq + DeepSeek exhausted → try OpenRouter (free models) ─────────────
  if (process.env.OPENROUTER_API_KEY) {
    const OPENROUTER_MODELS = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-2-9b-it:free',
      'mistralai/mistral-7b-instruct:free',
    ];
    logAgentActivity(agentName, 'switching_to_openrouter', { reason: 'groq_and_deepseek_exhausted' });
    console.warn('[LLM] Groq + DeepSeek exhausted. Trying OpenRouter free models...');

    for (const model of OPENROUTER_MODELS) {
      try {
        logAgentActivity(agentName, 'trying_model', { model, provider: 'openrouter' });
        const openrouter = getOpenRouterClient();
        const generation = trace.generation({ name: `${agentName}_generation`, model });

        const response = await openrouter.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a strict JSON-only responder for a job hunting system. Output ONLY valid JSON. No markdown, no code blocks, no explanations, no extra text — just the raw JSON object.' },
            { role: 'user', content: filledPrompt },
          ],
          temperature: 0.1,
          max_tokens: 8000,
        });

        const content = response.choices[0].message.content.trim();
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          else throw new Error(`OpenRouter JSON parse failed: ${content.substring(0, 200)}`);
        }

        generation.end({
          output: parsed,
          usage: { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 },
        });
        trace.end();

        logAgentActivity(agentName, 'prompt_completed', { success: true, model, provider: 'openrouter' });
        return parsed;

      } catch (err) {
        logAgentActivity(agentName, 'openrouter_model_failed', { model, error: err.message });
        console.warn(`[LLM] OpenRouter ${model} failed: ${err.message?.substring(0, 60)}`);
        if (isFallbackError(err)) continue;
        throw err;
      }
    }
  }

  // ── All Groq + DeepSeek + OpenRouter exhausted → try MiniMax ────────────────
  if (process.env.MINIMAX_API_KEY) {
    const MINIMAX_MODELS = ['MiniMax-Text-01', 'abab6.5s-chat'];
    logAgentActivity(agentName, 'switching_to_minimax', { reason: 'groq_deepseek_openrouter_exhausted' });
    console.warn('[LLM] Trying MiniMax fallback...');

    for (const model of MINIMAX_MODELS) {
      try {
        logAgentActivity(agentName, 'trying_model', { model, provider: 'minimax' });
        const minimax = getMiniMaxClient();
        const generation = trace.generation({ name: `${agentName}_generation`, model });

        const response = await minimax.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a strict JSON-only responder for a job hunting system. Output ONLY valid JSON. No markdown, no code blocks, no explanations, no extra text — just the raw JSON object.' },
            { role: 'user', content: filledPrompt },
          ],
          temperature: 0.1,
          max_tokens: 8000,
        });

        const content = response.choices[0].message.content.trim();
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          else throw new Error(`MiniMax JSON parse failed: ${content.substring(0, 200)}`);
        }

        generation.end({
          output: parsed,
          usage: { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 },
        });
        trace.end();

        logAgentActivity(agentName, 'prompt_completed', { success: true, model, provider: 'minimax' });
        return parsed;

      } catch (err) {
        logAgentActivity(agentName, 'minimax_model_failed', { model, error: err.message });
        console.warn(`[LLM] MiniMax ${model} failed: ${err.message?.substring(0, 60)}`);
        if (isFallbackError(err)) continue;
        throw err;
      }
    }
  }

  // ── All above exhausted → try Google Gemini ──────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    logAgentActivity(agentName, 'switching_to_gemini', { reason: 'groq_deepseek_openrouter_minimax_exhausted' });
    console.warn('[LLM] Trying Google Gemini fallback...');

    for (const model of GEMINI_MODELS) {
      try {
        logAgentActivity(agentName, 'trying_model', { model, provider: 'gemini' });
        const gemini = getGeminiClient();
        const generation = trace.generation({ name: `${agentName}_generation`, model });

        const response = await gemini.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a strict JSON-only responder for a job hunting system. Output ONLY valid JSON. No markdown, no code blocks, no explanations, no extra text — just the raw JSON object.' },
            { role: 'user', content: filledPrompt },
          ],
          temperature: 0.1,
          max_tokens: 8000,
        });

        const content = response.choices[0].message.content.trim();
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          else throw new Error(`Gemini JSON parse failed: ${content.substring(0, 200)}`);
        }

        generation.end({
          output: parsed,
          usage: { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 },
        });
        trace.end();

        logAgentActivity(agentName, 'prompt_completed', { success: true, model, provider: 'gemini' });
        return parsed;

      } catch (err) {
        logAgentActivity(agentName, 'gemini_model_failed', { model, error: err.message });
        console.warn(`[LLM] Gemini ${model} failed: ${err.message?.substring(0, 60)}`);
        if (isFallbackError(err)) continue;
        throw err;
      }
    }
  }

  // ── All above exhausted → try OpenAI as final fallback ───────────────────────
  if (process.env.OPENAI_API_KEY) {
    const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o'];
    logAgentActivity(agentName, 'switching_to_openai', { reason: 'all_groq_models_rate_limited' });
    console.warn('[LLM] All Groq models rate-limited. Switching to OpenAI fallback...');

    for (const model of OPENAI_MODELS) {
      try {
        logAgentActivity(agentName, 'trying_model', { model, provider: 'openai' });
        const openai = getOpenAIClient();
        const generation = trace.generation({ name: `${agentName}_generation`, model });

        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a strict JSON-only responder for a job hunting system. Output ONLY valid JSON. No markdown, no code blocks, no explanations, no extra text — just the raw JSON object.' },
            { role: 'user', content: filledPrompt },
          ],
          temperature: 0.1,
          max_tokens: 8000,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content.trim();
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          else throw new Error(`OpenAI JSON parse failed: ${content.substring(0, 200)}`);
        }

        generation.end({
          output: parsed,
          usage: { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 },
        });
        trace.end();

        logAgentActivity(agentName, 'prompt_completed', { success: true, model, provider: 'openai' });
        return parsed;

      } catch (err) {
        logAgentActivity(agentName, 'openai_model_failed', { model, error: err.message });
        console.warn(`[LLM] OpenAI ${model} failed: ${err.message?.substring(0, 60)}`);
        if (isFallbackError(err)) continue;
        throw err;
      }
    }
  }

  // All providers exhausted
  logAgentActivity(agentName, 'all_providers_exhausted', { error: lastError?.message });
  throw new Error(`All LLM providers exhausted (Groq + DeepSeek + OpenRouter + MiniMax + Gemini + OpenAI). Please wait and try again. Last error: ${lastError?.message}`);
};


/**
 * Orchestrator Chains
 */
const OrchestratorChains = {
  detectIntent: (message, userId) => 
    runPrompt(ORCHESTRATOR_PROMPTS.intentDetection, { message }, { agentName: 'orchestrator', userId }),

  planTasks: (intent, message, entities, userId) =>
    runPrompt(ORCHESTRATOR_PROMPTS.taskPlanning, { intent, message, entities }, { agentName: 'orchestrator', userId }),

  generateResponse: (agentStatuses, message, recentActions, taskResults, userId) =>
    runPrompt(ORCHESTRATOR_PROMPTS.responseGeneration, { agentStatuses, message, recentActions, taskResults }, { agentName: 'orchestrator', userId }),
};

/**
 * Job Search Chains
 */
const JobSearchChains = {
  scrapeJobs: (preferences, userId) =>
    runPrompt(JOB_SEARCH_PROMPTS.jobScraping, { ...preferences }, { agentName: 'jobSearch', userId }),

  deduplicate: (jobs, userId) =>
    runPrompt(JOB_SEARCH_PROMPTS.deduplication, { jobs }, { agentName: 'jobSearch', userId }),

  matchJobs: (candidateProfile, jobs, userId) =>
    runPrompt(JOB_SEARCH_PROMPTS.jobMatching, { candidateProfile, jobs }, { agentName: 'jobSearch', userId }),
};

/**
 * Resume Builder Chains
 */
const ResumeBuilderChains = {
  parseCV: (resumeText, userId) =>
    runPrompt(RESUME_BUILDER_PROMPTS.cvParsing, { resumeText }, { agentName: 'resumeBuilder', userId }),

  generateCV: (originalCV, targetJob, userId) =>
    runPrompt(RESUME_BUILDER_PROMPTS.cvGeneration, { originalCV, targetJob }, { agentName: 'resumeBuilder', userId }),

  generateCoverLetter: (candidateProfile, targetJob, userId) =>
    runPrompt(RESUME_BUILDER_PROMPTS.coverLetter, { candidateProfile, targetJob }, { agentName: 'resumeBuilder', userId }),
};

/**
 * Apply Agent Chains
 */
const ApplyChains = {
  findEmails: (companyName, website, linkedin, userId) =>
    runPrompt(APPLY_PROMPTS.emailFinder, { companyName, website, linkedin }, { agentName: 'apply', userId }),

  draftEmail: (candidateInfo, targetJob, companyName, hrEmail, userId) =>
    runPrompt(APPLY_PROMPTS.emailDrafting, { candidateInfo, targetJob, companyName, hrEmail }, { agentName: 'apply', userId }),

  draftFollowUp: (candidateName, position, company, applicationDate, userId) =>
    runPrompt(APPLY_PROMPTS.draftFollowUp, { candidateName, position, company, applicationDate }, { agentName: 'apply', userId }),
};

/**
 * Prep Agent Chains
 */
const PrepChains = {
  generateQuestions: (targetJob, companyName, candidateExperience, userId) =>
    runPrompt(PREP_PROMPTS.interviewQuestions, { targetJob, companyName, candidateExperience }, { agentName: 'prep', userId }),

  analyzeSkillGap: (candidateSkills, jobRequirements, userId) =>
    runPrompt(PREP_PROMPTS.skillGapAnalysis, { candidateSkills, jobRequirements }, { agentName: 'prep', userId }),

  evaluateAnswer: (question, answer, userId) =>
    runPrompt(PREP_PROMPTS.mockInterviewFeedback, { question, answer }, { agentName: 'prep', userId }),
};

/**
 * FTE Agent Chains
 */
const FTEChains = {
  extractEntity: (message, userId) =>
    runPrompt(FTE_PROMPTS.extractEntity, { message }, { agentName: 'fte', userId }),

  /**
   * Extract city, country, and ISO code from any location string
   * Returns: { city, country, countryCode }
   */
  extractLocation: (location, userId) =>
    runPrompt(FTE_PROMPTS.extractLocation, { location }, { agentName: 'jobSearch', userId }),

  /**
   * Brain: LLM reads state + history + message → decides action + reply
   * Returns: { thinking, message, action, actionParams }
   */
  think: (context, userId) =>
    runPrompt(FTE_PROMPTS.think, context, { agentName: 'fte', userId }),
};

module.exports = {
  runPrompt,
  OrchestratorChains,
  JobSearchChains,
  ResumeBuilderChains,
  ApplyChains,
  PrepChains,
  FTEChains,
};
