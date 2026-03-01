import { searchJobs } from '../services/serp.service.js';
import { sendSSEMessage, sendSSEProgress } from '../utils/sse.utils.js';

/**
 * JOB_SEARCH Agent
 * Uses SERP API to find jobs, stores results in session context.
 * Auto-transitions to CV_TAILOR state.
 */
export const run = async (session) => {
  const sessionId = session._id.toString();
  const { confirmedJobTitle, confirmedLocation } = session.context;

  sendSSEProgress(sessionId, `Searching Google Jobs for "${confirmedJobTitle}" in ${confirmedLocation}...`, 10);

  let jobs;
  try {
    jobs = await searchJobs(confirmedJobTitle, confirmedLocation, 10);
  } catch (error) {
    throw new Error(`Job search failed: ${error.message}`);
  }

  if (!jobs || jobs.length === 0) {
    throw new Error(`No jobs found for "${confirmedJobTitle}" in ${confirmedLocation}. Try a different title or location.`);
  }

  session.context.jobResults = jobs;
  session.context.searchHistory = Array.isArray(session.context.searchHistory)
    ? [...session.context.searchHistory, { jobTitle: confirmedJobTitle, location: confirmedLocation, timestamp: new Date() }]
    : [{ jobTitle: confirmedJobTitle, location: confirmedLocation, timestamp: new Date() }];
 
  const topList = jobs.slice(0, 5).map((j, i) => `${i + 1}. **${j.title}** — ${j.company} (${j.location})`).join('\n');
  const hasCV = !!session.context.cvText;
  session.state = hasCV ? 'CV_TAILOR' : 'CONFIRMATION';

  sendSSEMessage(
    sessionId,
    `Found **${jobs.length} jobs** for ${confirmedJobTitle} in ${confirmedLocation}!\n\n${topList}\n\n${hasCV ? 'Now tailoring your CV and drafting emails for each position. This will take a couple of minutes...' : 'Upload your CV to tailor and apply automatically. You can also adjust the title/location and I will re-search instantly.'}`,
    'jobSearch'
  );

  return { nextState: hasCV ? 'CV_TAILOR' : 'CONFIRMATION', jobsFound: jobs.length };
};
