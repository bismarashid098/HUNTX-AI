import { jsonCompletion } from '../services/groq.service.js';
import { cvSummaryPrompt } from '../utils/prompt.templates.js';
import { sendSSEMessage } from '../utils/sse.utils.js';

/**
 * INTAKE Agent
 * Receives CV text, summarizes it using GROQ, stores in session context.
 * Transitions session to CONFIRMATION state.
 */
export const run = async (session, cvText, sseEmitter) => {
  const sessionId = session._id.toString();

  sendSSEMessage(sessionId, 'Analyzing your CV... Please wait.', 'intake');

  let cvSummary;
  try {
    cvSummary = await jsonCompletion(cvSummaryPrompt(cvText));
  } catch (error) {
    throw new Error(`CV analysis failed: ${error.message}`);
  }

  // Store CV data in session context
  session.context.cvText = cvText;
  session.context.cvSummary = cvSummary;
  session.state = 'CONFIRMATION';

  // Build welcome message
  const name = cvSummary.fullName || 'there';
  const title = cvSummary.currentTitle || 'Professional';
  const years = cvSummary.totalYearsExperience;
  const skills = (cvSummary.topSkills || []).slice(0, 3).join(', ');

  const welcomeMsg = `CV received and analyzed!

Hi **${name}**, I can see you're a **${title}**${years ? ` with ${years} years of experience` : ''}. Your top skills include: **${skills}**.

Now, to find the perfect jobs for you — **what job title are you targeting, and which city or country are you looking in?**

For example: *"Senior React Developer in Dubai"* or *"Data Analyst, London"*`;

  sendSSEMessage(sessionId, welcomeMsg, 'intake');

  return { nextState: 'CONFIRMATION', response: welcomeMsg };
};
