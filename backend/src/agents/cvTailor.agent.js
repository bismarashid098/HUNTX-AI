import { textCompletion, jsonCompletion } from '../services/groq.service.js';
import { tailorCVPrompt, emailDraftPrompt, extractHREmailPrompt } from '../utils/prompt.templates.js';
import { extractEmailsFromText, inferHREmail } from '../utils/hrEmail.utils.js';
import { sendSSEProgress, sendSSEMessage } from '../utils/sse.utils.js';
import JobApplication from '../models/JobApplication.model.js';

/**
 * CV_TAILOR Agent
 * For each job: tailors CV, drafts email, extracts HR email.
 * Creates JobApplication documents in DB.
 * Transitions to APPROVAL state.
 */
export const run = async (session) => {
  const sessionId = session._id.toString();
  const { cvText, cvSummary, jobResults } = session.context;
  const userId = session.userId;

  const totalJobs = jobResults.length;
  const applicationIds = [];

  for (let i = 0; i < totalJobs; i++) {
    const job = jobResults[i];
    const percent = Math.round(((i + 1) / totalJobs) * 80) + 10;

    sendSSEProgress(
      sessionId,
      `Tailoring CV for **${job.company}** (${i + 1}/${totalJobs})...`,
      percent
    );

    try {
      // 1. Tailor CV
      const tailoredCV = await textCompletion(
        tailorCVPrompt(cvText, cvSummary, job.title, job.description, job.company)
      );

      // 2. Draft email
      let emailDraftData;
      try {
        emailDraftData = await jsonCompletion(
          emailDraftPrompt(cvSummary, job.title, job.company, job.description)
        );
      } catch {
        emailDraftData = {
          subject: `Application for ${job.title} position at ${job.company}`,
          body: `Dear Hiring Manager,\n\nI am writing to express my interest in the ${job.title} position at ${job.company}. Please find my tailored CV attached.\n\nBest regards,\n${cvSummary?.fullName || 'Candidate'}`,
        };
      }

      // 3. Extract HR email (3-tier)
      let hrEmail = null;
      let hrEmailConfidence = 'not_found';

      // Tier 1: Regex scan
      const regexEmail = extractEmailsFromText(job.description);
      if (regexEmail) {
        hrEmail = regexEmail;
        hrEmailConfidence = 'found_in_text';
      } else {
        // Tier 2: GROQ extraction
        try {
          const extracted = await jsonCompletion(
            extractHREmailPrompt(job.description, job.company)
          );
          if (extracted.hrEmail && extracted.confidence === 'found_in_text') {
            hrEmail = extracted.hrEmail;
            hrEmailConfidence = 'found_in_text';
          }
        } catch {
          // Tier 3: Heuristic fallback
        }

        if (!hrEmail) {
          hrEmail = inferHREmail(job.company);
          hrEmailConfidence = 'inferred';
        }
      }

      // Create JobApplication document
      const application = await JobApplication.create({
        sessionId: session._id,
        userId,
        job,
        tailoredCV,
        emailDraft: {
          subject: emailDraftData.subject,
          body: emailDraftData.body,
          hrEmail,
          hrEmailConfidence,
        },
        status: 'PENDING_REVIEW',
      });

      applicationIds.push(application._id.toString());
    } catch (error) {
      console.error(`[CV_TAILOR] Error processing job ${job.company}:`, error.message);
      // Continue with other jobs even if one fails
    }
  }

  if (applicationIds.length === 0) {
    throw new Error('Failed to tailor CVs for any job. Please try again.');
  }

  session.state = 'APPROVAL';

  sendSSEProgress(sessionId, 'All CVs tailored! Preparing your applications for review...', 95);

  return { nextState: 'APPROVAL', applicationIds };
};
