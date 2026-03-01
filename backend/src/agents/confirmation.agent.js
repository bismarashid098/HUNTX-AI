import { jsonCompletion, chatCompletion } from '../services/groq.service.js';
import { extractJobPreferencePrompt } from '../utils/prompt.templates.js';
import { sendSSEMessage } from '../utils/sse.utils.js';

/**
 * CONFIRMATION Agent
 * Extracts job title + location from user message.
 * Asks for confirmation, then transitions to JOB_SEARCH.
 */
export const run = async (session, userMessage, sseEmitter) => {
  const sessionId = session._id.toString();

  // If we have pending data awaiting confirmation, check if user confirmed
  if (session.context.pendingJobTitle && session.context.pendingLocation) {
    return handleConfirmationResponse(session, userMessage, sessionId);
  }

  // Extract job title and location from user message
  let extracted;
  try {
    extracted = await jsonCompletion(extractJobPreferencePrompt(userMessage));
  } catch (error) {
    sendSSEMessage(sessionId, "I couldn't quite understand that. Could you tell me the job title and city you're targeting? For example: *\"Software Engineer in Karachi\"*", 'confirmation');
    return { nextState: 'CONFIRMATION' };
  }

  const { jobTitle, location, confidence } = extracted;

  if (!jobTitle || !location || confidence === 'low') {
    sendSSEMessage(
      sessionId,
      "I need both a **job title** and a **location** to search for jobs. Could you please specify both?\n\nExample: *\"Frontend Developer in Lahore\"* or *\"Marketing Manager, Dubai\"*",
      'confirmation'
    );
    return { nextState: 'CONFIRMATION' };
  }

  session.context.confirmedJobTitle = jobTitle;
  session.context.confirmedLocation = location;
  session.context.pendingJobTitle = undefined;
  session.context.pendingLocation = undefined;
  session.title = `${jobTitle} in ${location}`;
  session.state = 'JOB_SEARCH';
 
  sendSSEMessage(
    sessionId,
    `Searching for **${jobTitle}** jobs in **${location}**... This may take a moment.`,
    'confirmation'
  );
 
  return { nextState: 'JOB_SEARCH' };
};

const handleConfirmationResponse = async (session, userMessage, sessionId) => {
  const lowerMsg = userMessage.toLowerCase().trim();
  const isConfirmed = ['yes', 'yeah', 'yep', 'confirm', 'ok', 'okay', 'sure', 'go ahead', 'proceed', 'correct', 'right', 'haan', 'ji'].some(
    (word) => lowerMsg.includes(word)
  );

  if (isConfirmed) {
    const jobTitle = session.context.pendingJobTitle;
    const location = session.context.pendingLocation;

    // Confirm and move forward
    session.context.confirmedJobTitle = jobTitle;
    session.context.confirmedLocation = location;
    session.context.pendingJobTitle = undefined;
    session.context.pendingLocation = undefined;
    session.title = `${jobTitle} in ${location}`;
    session.state = 'JOB_SEARCH';

    sendSSEMessage(
      sessionId,
      `Searching for **${jobTitle}** jobs in **${location}**... This may take a moment.`,
      'confirmation'
    );

    return { nextState: 'JOB_SEARCH' };
  } else {
    // User wants to correct - clear pending and re-extract
    session.context.pendingJobTitle = undefined;
    session.context.pendingLocation = undefined;

    // Try to extract from the correction message
    let extracted;
    try {
      extracted = await jsonCompletion(extractJobPreferencePrompt(userMessage));
    } catch {
      sendSSEMessage(sessionId, "Please tell me the job title and city you want to target.", 'confirmation');
      return { nextState: 'CONFIRMATION' };
    }

    const { jobTitle, location } = extracted;
    if (jobTitle && location) {
      session.context.pendingJobTitle = jobTitle;
      session.context.pendingLocation = location;
      const confirmMsg = `Updated! Let me confirm:\n\n- **Job Title:** ${jobTitle}\n- **Location:** ${location}\n\nShall I proceed? (Reply **yes** to confirm)`;
      sendSSEMessage(sessionId, confirmMsg, 'confirmation');
    } else {
      sendSSEMessage(sessionId, "Please provide both a job title and a city/location. Example: *\"Data Scientist in London\"*", 'confirmation');
    }

    return { nextState: 'CONFIRMATION' };
  }
};
