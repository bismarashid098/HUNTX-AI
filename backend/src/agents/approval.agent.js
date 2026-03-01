import { sendSSEApprovalRequest, sendSSEMessage } from '../utils/sse.utils.js';
import JobApplication from '../models/JobApplication.model.js';

/**
 * APPROVAL Agent
 * Fetches all pending applications for the session, sends approval_request SSE event.
 * Waits for user to approve/reject via API calls.
 * Transitions to EMAIL_SEND when user triggers "send approved".
 */
export const run = async (session) => {
  const sessionId = session._id.toString();

  const applications = await JobApplication.find({
    sessionId: session._id,
    status: 'PENDING_REVIEW',
  }).select('_id job.title job.company job.location emailDraft.hrEmail emailDraft.hrEmailConfidence');

  const applicationIds = applications.map((a) => a._id.toString());

  const warningCount = applications.filter(
    (a) => a.emailDraft.hrEmailConfidence === 'inferred'
  ).length;

  let message = `Your **${applicationIds.length} tailored applications** are ready for review!\n\nPlease review each CV and email draft below. You can **approve**, **reject**, or **edit** each one before sending.`;

  if (warningCount > 0) {
    message += `\n\n> **Note:** ${warningCount} application(s) have inferred HR emails (highlighted in amber). Please verify before sending.`;
  }

  sendSSEApprovalRequest(sessionId, applicationIds, message);

  return { nextState: 'APPROVAL', applicationIds };
};

/**
 * Handle user triggering "Send approved applications"
 * Checks if any applications are approved, then transitions to EMAIL_SEND
 */
export const handleSendTrigger = async (session) => {
  const sessionId = session._id.toString();

  const approvedCount = await JobApplication.countDocuments({
    sessionId: session._id,
    status: 'APPROVED',
  });

  if (approvedCount === 0) {
    sendSSEMessage(
      sessionId,
      'No applications have been approved yet. Please approve at least one application to send emails.',
      'approval'
    );
    return { nextState: 'APPROVAL' };
  }

  session.state = 'EMAIL_SEND';
  sendSSEMessage(
    sessionId,
    `Sending emails for **${approvedCount} approved application(s)**...`,
    'approval'
  );

  return { nextState: 'EMAIL_SEND', approvedCount };
};
