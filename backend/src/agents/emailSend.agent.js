import { sendSSEProgress, sendSSEMessage, sendSSEComplete } from '../utils/sse.utils.js';
import { sendApplicationEmail } from '../services/mailer.service.js';
import JobApplication from '../models/JobApplication.model.js';
import User from '../models/User.model.js';

const MAX_EMAILS_PER_SESSION = 20;

/**
 * EMAIL_SEND Agent
 * Sends approved job application emails via Nodemailer.
 * Updates application status to SENT or FAILED.
 * Transitions to COMPLETE state.
 */
export const run = async (session) => {
  const sessionId = session._id.toString();

  // Get user email for BCC
  const user = await User.findById(session.userId).select('email');

  const applications = await JobApplication.find({
    sessionId: session._id,
    status: 'APPROVED',
  }).limit(MAX_EMAILS_PER_SESSION);

  if (applications.length === 0) {
    session.state = 'APPROVAL';
    sendSSEMessage(sessionId, 'No approved applications found. Please approve applications first.', 'emailSend');
    return { nextState: 'APPROVAL' };
  }

  let sentCount = 0;
  let failedCount = 0;
  const total = applications.length;

  for (let i = 0; i < total; i++) {
    const app = applications[i];
    const percent = Math.round(((i + 1) / total) * 100);

    // Use user edits if available
    const subject = app.userEdits?.emailSubject || app.emailDraft.subject;
    const body = app.userEdits?.emailBody || app.emailDraft.body;
    const hrEmail = app.emailDraft.hrEmail;

    if (!hrEmail) {
      app.status = 'FAILED';
      app.errorMessage = 'No HR email address available';
      await app.save();
      failedCount++;
      sendSSEProgress(sessionId, `Skipped **${app.job.company}** — no HR email (${i + 1}/${total})`, percent);
      continue;
    }

    sendSSEProgress(sessionId, `Sending to **${hrEmail}** for ${app.job.company} (${i + 1}/${total})...`, percent);

    try {
      await sendApplicationEmail({
        to: hrEmail,
        subject,
        body,
        senderEmail: user?.email,
        attachmentText: app.tailoredCV,
      });

      app.status = 'SENT';
      app.sentAt = new Date();
      await app.save();
      sentCount++;
    } catch (error) {
      app.status = 'FAILED';
      app.errorMessage = error.message;
      await app.save();
      failedCount++;
      console.error(`[EMAIL_SEND] Failed for ${app.job.company}:`, error.message);
    }
  }

  session.context.totalEmailsSent = (session.context.totalEmailsSent || 0) + sentCount;
  session.state = 'COMPLETE';

  const summaryMsg = `All done! Here's your summary:

- **Emails Sent:** ${sentCount}/${total}
- **Failed:** ${failedCount}
- **You've been BCC'd** on all sent emails

${failedCount > 0 ? '\n> Some emails failed. Check the applications panel for error details.' : '\nGood luck with your applications! You can start a new job hunt anytime.'}`;

  sendSSEComplete(sessionId, summaryMsg);

  return { nextState: 'COMPLETE', sentCount, failedCount };
};
