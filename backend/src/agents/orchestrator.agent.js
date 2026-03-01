import ChatSession from '../models/ChatSession.model.js';
import { sendSSEError, sendSSEMessage } from '../utils/sse.utils.js';
import { chatCompletion } from '../services/groq.service.js';
import { offTopicResponsePrompt } from '../utils/prompt.templates.js';

import * as intakeAgent from './intake.agent.js';
import * as confirmationAgent from './confirmation.agent.js';
import * as jobSearchAgent from './jobSearch.agent.js';
import * as cvTailorAgent from './cvTailor.agent.js';
import * as approvalAgent from './approval.agent.js';
import * as emailSendAgent from './emailSend.agent.js';

// Job-related keywords to detect off-topic messages
const JOB_KEYWORDS = [
  'job', 'cv', 'resume', 'career', 'work', 'hire', 'hiring', 'apply', 'application',
  'company', 'salary', 'position', 'role', 'title', 'location', 'city', 'email',
  'interview', 'experience', 'skill', 'linkedin', 'yes', 'no', 'confirm', 'ok',
  'send', 'approve', 'reject', 'correct', 'right', 'haan', 'ji', 'nahi',
];

const isJobRelated = (message) => {
  const lower = message.toLowerCase();
  return JOB_KEYWORDS.some((kw) => lower.includes(kw));
};

/**
 * Main Orchestrator
 * Routes messages to the correct agent based on session state.
 */
export const handleMessage = async (sessionId, userMessage, cvText = null) => {
  const session = await ChatSession.findById(sessionId);
  if (!session) throw new Error('Session not found');

  const sessionIdStr = session._id.toString();

  // Persist user message
  session.messages.push({
    role: 'user',
    content: userMessage || (cvText ? '[CV Uploaded]' : ''),
  });

  try {
    let result;

    switch (session.state) {
      case 'INTAKE': {
        if (!cvText && !session.context?.cvText) {
          if (isJobRelated(userMessage)) {
            result = await confirmationAgent.run(session, userMessage);
            session.messages.push({
              role: 'assistant',
              content: result.response || '',
              metadata: { agentName: 'confirmation' },
            });
            if (result.nextState === 'JOB_SEARCH') {
              await session.save();
              await runJobPipeline(session);
              return;
            }
            await session.save();
            return;
          }
          sendSSEMessage(sessionIdStr, 'Please upload your CV (PDF or paste text) to get started!', 'orchestrator');
          await session.save();
          return;
        }

        const textToProcess = cvText || session.context.cvText;
        result = await intakeAgent.run(session, textToProcess);

        // After intake completes, save and return — wait for user to respond with preferences
        session.messages.push({
          role: 'assistant',
          content: result.response || '',
          metadata: { agentName: 'intake' },
        });
        await session.save();
        return;
      }

      case 'CONFIRMATION': {
        // Check if off-topic
        if (!isJobRelated(userMessage)) {
          const offTopicReply = await chatCompletion([
            { role: 'user', content: offTopicResponsePrompt(userMessage) },
          ]);
          sendSSEMessage(sessionIdStr, offTopicReply, 'orchestrator');
          await session.save();
          return;
        }

        result = await confirmationAgent.run(session, userMessage);

        session.messages.push({
          role: 'assistant',
          content: result.response || '',
          metadata: { agentName: 'confirmation' },
        });

        // If confirmed, auto-chain JOB_SEARCH → CV_TAILOR → APPROVAL
        if (result.nextState === 'JOB_SEARCH') {
          await session.save();
          await runJobPipeline(session);
          return;
        }

        await session.save();
        return;
      }

      case 'APPROVAL': {
        // Check for "send" trigger words
        const lower = userMessage.toLowerCase();
        const isSendTrigger = ['send', 'go', 'proceed', 'yes', 'approved', 'submit', 'bhej', 'haan'].some(
          (w) => lower.includes(w)
        );

        if (isSendTrigger) {
          result = await approvalAgent.handleSendTrigger(session);
          if (result.nextState === 'EMAIL_SEND') {
            await session.save();
            await emailSendAgent.run(session);
          }
        } else {
          sendSSEMessage(
            sessionIdStr,
            'Please review and approve/reject your applications above. When ready, click **"Send Approved Emails"** or type **"send"**.',
            'approval'
          );
        }

        await session.save();
        return;
      }

      case 'COMPLETE': {
        sendSSEMessage(
          sessionIdStr,
          'This job hunt session is complete! Start a **New Chat** to begin a fresh job search.',
          'orchestrator'
        );
        await session.save();
        return;
      }

      case 'ERROR': {
        sendSSEError(sessionIdStr, session.context?.lastError || 'An error occurred. Please start a new session.');
        return;
      }

      default:
        sendSSEMessage(sessionIdStr, 'Processing your request...', 'orchestrator');
        await session.save();
    }
  } catch (error) {
    console.error(`[Orchestrator Error] Session ${sessionIdStr}:`, error.message);
    session.state = 'ERROR';
    session.context.lastError = error.message;
    await session.save();
    sendSSEError(sessionIdStr, `Something went wrong: ${error.message}`);
  }
};

/**
 * Auto-pipeline: JOB_SEARCH → CV_TAILOR → APPROVAL
 * Runs sequentially after confirmation
 */
const runJobPipeline = async (session) => {
  try {
    // JOB_SEARCH
    await jobSearchAgent.run(session);
    await session.save();

    if (!session.context.cvText) {
      sendSSEMessage(
        session._id.toString(),
        'Upload your CV to tailor and apply automatically. Meanwhile, you can refine the job title or location and I will re-search instantly.',
        'orchestrator'
      );
      return;
    }
 
    // CV_TAILOR
    const tailorResult = await cvTailorAgent.run(session);
    await session.save();

    // APPROVAL
    await approvalAgent.run(session);
    await session.save();
  } catch (error) {
    session.state = 'ERROR';
    session.context.lastError = error.message;
    await session.save();
    sendSSEError(session._id.toString(), `Pipeline error: ${error.message}`);
  }
};
