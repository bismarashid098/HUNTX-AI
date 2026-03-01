import { env } from '../config/env.js';
import { getJson } from 'serpapi';

/**
 * Search Google Jobs via SerpApi
 * Returns normalized job results array
 */
export const searchJobs = async (jobTitle, location, numResults = 10) => {
  try {
    const data = await getJson({
      engine: 'google_jobs',
      q: `${jobTitle} ${location}`,
      location,
      hl: 'en',
      api_key: env.SERP_API_KEY,
    });
    if (data.error) {
      throw new Error(`SERP API: ${data.error}`);
    }
    const jobs = (data.jobs_results || []).slice(0, numResults);
    return jobs.map(mapSerpResult).filter(Boolean);
  } catch (error) {
    console.error('[SERP Service Error]', error.message);
    throw error;
  }
};

const mapSerpResult = (raw) => {
  if (!raw || !raw.title || !raw.company_name) return null;

  return {
    title: raw.title,
    company: raw.company_name,
    location: raw.location || 'Not specified',
    description: raw.description || '',
    applyLink: raw.related_links?.[0]?.link || raw.job_id || null,
    sourceUrl: raw.share_link || null,
  };
};
