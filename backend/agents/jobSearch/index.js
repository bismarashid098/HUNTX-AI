/**
 * Job Search Agent
 * Finds and matches job opportunities from multiple sources
 */

const { logAgentActivity, createTrace } = require('../../services/langchain/langfuse');
const { JobSearchChains } = require('../../services/langchain/chains');
const Job = require('../../models/Job');
const Agent = require('../../models/Agent');

class JobSearchAgent {
  constructor() {
    this.sources = ['linkedin', 'indeed', 'glassdoor', 'company_website'];
  }

  /**
   * Execute a job search task
   */
  async execute(userId, task, sessionId) {
    const trace = createTrace('job_search', userId);
    const span = trace?.span({ name: 'job_search_execution' });

    try {
      logAgentActivity('jobSearch', 'task_started', { task, userId });

      // Update agent status
      await this.updateAgentStatus(userId, 'working', 'Searching for jobs');

      const { action, tools, ...params } = task;

      switch (action) {
        case 'search_jobs':
          return await this.searchJobs(userId, params, trace);
        case 'scrape_jobs':
          return await this.scrapeJobs(userId, params, trace);
        case 'deduplicate':
          return await this.deduplicateJobs(userId, params, trace);
        case 'match_jobs':
          return await this.matchJobs(userId, params, trace);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      logAgentActivity('jobSearch', 'error', { error: error.message, userId });
      await this.updateAgentStatus(userId, 'error', error.message);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Search for jobs using SerpAPI Google Jobs (single direct call, no site: filters)
   */
  async searchJobs(userId, params, trace) {
    const { keywords, location, filters = {} } = params;

    await this.updateAgentStatus(userId, 'working', `Searching: ${keywords}`);

    // Single SerpAPI call — no source loop, no site: filters that break google_jobs engine
    let allJobs = [];
    try {
      allJobs = await this.scrapeWithSerpAPI(keywords, location, filters, userId);
    } catch (error) {
      logAgentActivity('jobSearch', 'scraping_failed', { error: error.message });
      throw error;
    }

    // Deduplication
    const { uniqueJobs, duplicates } = await this.deduplicate(allJobs);

    // Save to database
    const savedJobs = await this.saveJobs(userId, uniqueJobs);

    // Calculate match scores
    const candidateProfile = await this.getCandidateProfile(userId);
    const matchedJobs = await this.calculateMatchScores(savedJobs, candidateProfile);

    logAgentActivity('jobSearch', 'search_completed', {
      totalFound: allJobs.length,
      uniqueCount: uniqueJobs.length,
      savedCount: savedJobs.length,
    });

    await this.updateAgentStatus(userId, 'completed', `Found ${matchedJobs.length} jobs`);

    return {
      jobs: matchedJobs,
      stats: {
        totalFound: allJobs.length,
        duplicatesFound: duplicates.length,
        uniqueCount: uniqueJobs.length,
        savedCount: savedJobs.length,
      },
    };
  }

  /**
   * Use LLM to resolve any location string → { normalizedLocation, gl }
   * Works for any city/country in the world — no hardcoding
   */
  async resolveLocation(location, userId) {
    if (!location) return { normalizedLocation: null, gl: null };
    const lower = location.toLowerCase().trim();
    // Remote / anywhere → no location filter
    if (['remote', 'anywhere', 'worldwide', 'online'].includes(lower)) {
      return { normalizedLocation: 'Remote', gl: null };
    }
    try {
      const { FTEChains } = require('../../services/langchain/chains');
      const result = await FTEChains.extractLocation(location, userId);
      const city        = (result.city        || location).trim();
      const country     = (result.country     || '').trim();
      const countryCode = (result.countryCode || '').toLowerCase().trim();
      const normalizedLocation = country ? `${city}, ${country}` : city;
      const gl = countryCode || null;
      logAgentActivity('jobSearch', 'location_resolved', { input: location, normalizedLocation, gl });
      return { normalizedLocation, gl };
    } catch (err) {
      // LLM failed — pass location as-is, SerpAPI will try its best
      logAgentActivity('jobSearch', 'location_resolve_failed', { error: err.message });
      return { normalizedLocation: location, gl: null };
    }
  }

  /**
   * Scrape jobs using SerpAPI Google Jobs
   * Location resolved via LLM — works for any city worldwide, no hardcoding
   */
  async scrapeWithSerpAPI(keywords, location, filters, userId) {
    if (!process.env.SERPAPI_KEY) {
      throw new Error('SERPAPI_KEY not set in environment variables');
    }

    const { getJson } = require('serpapi');

    // LLM resolves "Karachi" → "Karachi, Pakistan" + gl: "pk"
    const { normalizedLocation, gl } = await this.resolveLocation(location, userId);

    const primaryParams = {
      engine: 'google_jobs',
      api_key: process.env.SERPAPI_KEY,
      q: keywords,
      hl: 'en',
      num: '20',
    };
    if (normalizedLocation) primaryParams.location = normalizedLocation;
    if (gl) primaryParams.gl = gl;

    logAgentActivity('jobSearch', 'serpapi_search', { q: keywords, location: normalizedLocation, gl });

    let jobResults = [];

    // Page 1
    try {
      const response = await getJson(primaryParams);
      jobResults = response.jobs_results || [];
      logAgentActivity('jobSearch', 'serpapi_raw_results', { count: jobResults.length, method: 'page1' });
    } catch (err) {
      logAgentActivity('jobSearch', 'serpapi_primary_failed', { error: err.message });
    }

    // Page 2 — fetch only if page 1 returned results (avoids wasting API credits)
    if (jobResults.length > 0) {
      try {
        const page2Params = { ...primaryParams, start: 10 };
        const page2Response = await getJson(page2Params);
        const page2Jobs = page2Response.jobs_results || [];
        jobResults = [...jobResults, ...page2Jobs];
        logAgentActivity('jobSearch', 'serpapi_raw_results', { count: page2Jobs.length, method: 'page2', total: jobResults.length });
      } catch (err) {
        // Page 2 failure is non-critical — continue with page 1 results
        logAgentActivity('jobSearch', 'serpapi_page2_failed', { error: err.message });
      }
    }

    // Fallback: embed location in query string (broader, works for any city)
    if (jobResults.length === 0 && normalizedLocation) {
      logAgentActivity('jobSearch', 'serpapi_fallback', { q: `${keywords} ${normalizedLocation}` });
      try {
        const fallbackParams = {
          engine: 'google_jobs',
          api_key: process.env.SERPAPI_KEY,
          q: `${keywords} ${normalizedLocation}`,
          hl: 'en',
          num: '20',
        };
        if (gl) fallbackParams.gl = gl;
        const fallbackResponse = await getJson(fallbackParams);
        jobResults = fallbackResponse.jobs_results || [];
        logAgentActivity('jobSearch', 'serpapi_raw_results', { count: jobResults.length, method: 'query_fallback' });

        // Page 2 of fallback
        if (jobResults.length > 0) {
          try {
            const fallbackPage2 = await getJson({ ...fallbackParams, start: 10 });
            jobResults = [...jobResults, ...(fallbackPage2.jobs_results || [])];
          } catch { /* non-critical */ }
        }
      } catch (err) {
        logAgentActivity('jobSearch', 'serpapi_fallback_failed', { error: err.message });
      }
    }

    // Job boards to skip when looking for the company's own URL
    const JOB_BOARD_DOMAINS = [
      'linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com',
      'ziprecruiter.com', 'rozee.pk', 'bayt.com', 'google.com',
      'careerjet.com', 'simplyhired.com', 'jobstreet.com',
    ];

    return jobResults.map(job => {
      const rawPostedAt = job.detected_extensions?.posted_at;
      let postedDate = null;
      if (rawPostedAt) {
        const now = new Date();
        const match = rawPostedAt.match(/(\d+)\s+(hour|day|week|month)/i);
        if (match) {
          const num = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          if (unit === 'hour') postedDate = new Date(now - num * 3600000);
          else if (unit === 'day') postedDate = new Date(now - num * 86400000);
          else if (unit === 'week') postedDate = new Date(now - num * 7 * 86400000);
          else if (unit === 'month') postedDate = new Date(now - num * 30 * 86400000);
        }
      }

      // Find company's own careers page (first apply_option not from a job board)
      const companyApplyUrl = (job.apply_options || []).find(opt => {
        const link = opt.link || '';
        return link.startsWith('http') && !JOB_BOARD_DOMAINS.some(d => link.includes(d));
      })?.link || null;

      // sourceUrl: prefer company's own page → related_links → any apply link → google search
      const sourceUrl = companyApplyUrl
        || job.related_links?.[0]?.link
        || job.apply_options?.[0]?.link
        || `https://www.google.com/search?q=${encodeURIComponent((job.title || '') + ' ' + (job.company_name || ''))}`;

      return {
        title: job.title || '',
        company: job.company_name || '',
        location: job.location || location || '',
        description: job.description || '',
        source: 'api',
        sourceUrl,
        companyApplyUrl,   // Company's own careers page — used for HR email domain
        postedDate,
        salary: job.detected_extensions?.salary || null,
        thumbnail: job.thumbnail || null,
        requirements: [],
        benefits: [],
      };
    });
  }

  /**
   * Scrape jobs task handler (routes to searchJobs)
   */
  async scrapeJobs(userId, params, trace) {
    return await this.searchJobs(userId, params, trace);
  }

  /**
   * Deduplicate jobs task handler (routes to deduplicate)
   */
  async deduplicateJobs(userId, params, trace) {
    const jobs = params.jobs || [];
    const result = await this.deduplicate(jobs);
    return {
      uniqueJobs: result.uniqueJobs,
      duplicates: result.duplicates,
      stats: {
        total: jobs.length,
        unique: result.uniqueJobs.length,
        duplicatesFound: result.duplicates.length,
      },
    };
  }

  /**
   * Scrape using Apify API
   */
  async scrapeWithApify(source, keywords, location, filters) {
    let ApifyClient;
    try {
      ApifyClient = require('apify-client').ApifyClient;
    } catch (e) {
      throw new Error('apify-client package not installed. Run: npm install apify-client');
    }
    const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

    const actorMap = {
      linkedin: 'linkedin/job-search',
      indeed: 'indeed/jobs',
      glassdoor: 'glassdoor/jobs',
    };

    const actorId = actorMap[source];
    if (!actorId) {
      throw new Error(`Unknown source: ${source}`);
    }

    const input = {
      keywords,
      location,
      ...filters,
    };

    // Run actor
    const { id: runId } = await apifyClient.actor(actorId).start({ input });
    
    // Wait for completion
    const run = await apifyClient.run(runId).waitForFinish();
    
    // Get results
    const dataset = await apifyClient.dataset(run.defaultDatasetId).list();
    
    return dataset.items.map(item => ({
      title: item.title || item.position,
      company: item.company || item.employer,
      location: item.location,
      salary: item.salary,
      description: item.description || item.summary,
      source: source,
      sourceUrl: item.url || item.link,
      postedDate: item.postedDate || item.date,
      requirements: item.requirements || [],
      benefits: item.benefits || [],
    }));
  }

  /**
   * Deduplicate jobs
   */
  async deduplicate(jobs) {
    const uniqueJobs = [];
    const duplicates = [];
    const seen = new Set();

    for (const job of jobs) {
      // Create a signature for the job
      const signature = this.createJobSignature(job);
      
      if (seen.has(signature)) {
        duplicates.push({
          job,
          reason: 'Exact match found',
          signature,
        });
        continue;
      }

      // Check for similar jobs
      let isSimilar = false;
      for (const uniqueJob of uniqueJobs) {
        if (this.jobsAreSimilar(job, uniqueJob)) {
          duplicates.push({
            job,
            originalJob: uniqueJob,
            reason: 'Similar job found',
            similarity: this.calculateSimilarity(job, uniqueJob),
          });
          isSimilar = true;
          break;
        }
      }

      if (!isSimilar) {
        uniqueJobs.push(job);
        seen.add(signature);
      }
    }

    return { uniqueJobs, duplicates };
  }

  /**
   * Create a unique signature for a job
   */
  createJobSignature(job) {
    const normalizedTitle = (job.title || '').toLowerCase().trim();
    const normalizedCompany = (job.company || '').toLowerCase().trim();
    const normalizedLocation = (job.location || '').toLowerCase().trim();
    return `${normalizedTitle}|${normalizedCompany}|${normalizedLocation}`;
  }

  /**
   * Check if two jobs are similar
   */
  jobsAreSimilar(job1, job2) {
    const sig1 = this.createJobSignature(job1);
    const sig2 = this.createJobSignature(job2);
    
    // Exact match
    if (sig1 === sig2) return true;

    // Calculate similarity
    const similarity = this.calculateSimilarity(job1, job2);
    return similarity > 0.85; // 85% similarity threshold
  }

  /**
   * Calculate similarity between two jobs
   */
  calculateSimilarity(job1, job2) {
    const title1 = (job1.title || '').toLowerCase();
    const title2 = (job2.title || '').toLowerCase();
    
    const company1 = (job1.company || '').toLowerCase();
    const company2 = (job2.company || '').toLowerCase();
    
    const location1 = (job1.location || '').toLowerCase();
    const location2 = (job2.location || '').toLowerCase();

    // Title similarity (most important)
    const titleSim = this.stringSimilarity(title1, title2);
    
    // Company similarity
    const companySim = this.stringSimilarity(company1, company2);
    
    // Location similarity
    const locationSim = this.stringSimilarity(location1, location2);

    // Weighted average
    return (titleSim * 0.5) + (companySim * 0.3) + (locationSim * 0.2);
  }

  /**
   * Simple string similarity (Jaccard-like)
   */
  stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate match scores for jobs
   * Uses toObject() to convert Mongoose documents to plain objects before spreading
   */
  async calculateMatchScores(jobs, candidateProfile) {
    if (!candidateProfile || !candidateProfile.skills) {
      return jobs.map(job => ({
        ...(job.toObject ? job.toObject() : job),
        matchScore: 0.5,
      }));
    }

    const candidateSkills = new Set(
      (candidateProfile.skills.technical || []).map(s => s.toLowerCase())
    );

    return jobs.map(job => {
      // Convert Mongoose document to plain object to avoid spread issues
      const jobObj = job.toObject ? job.toObject() : job;

      const jobSkills = new Set(
        [...(jobObj.requirements || []), ...(jobObj.niceToHave || [])].map(s => s.toLowerCase())
      );

      let matchedSkills = 0;
      const totalRequired = jobSkills.size;

      candidateSkills.forEach(skill => {
        if (jobSkills.has(skill)) matchedSkills++;
      });

      const matchScore = totalRequired > 0
        ? matchedSkills / Math.min(totalRequired, candidateSkills.size)
        : 0.5;

      return {
        ...jobObj,
        matchScore: Math.min(1, matchScore),
        matchedSkills: [...candidateSkills].filter(s => jobSkills.has(s)),
        missingSkills: [...jobSkills].filter(s => !candidateSkills.has(s)),
      };
    });
  }

  /**
   * Get candidate profile from memory
   */
  async getCandidateProfile(userId) {
    const Memory = require('../../models/Memory');
    const profile = await Memory.findOne({
      userId,
      memoryType: 'long_term',
      category: 'preferences',
      key: 'candidate_profile',
    });
    
    return profile?.value || null;
  }

  /**
   * Save jobs to database
   */
  async saveJobs(userId, jobs) {
    const savedJobs = [];

    for (const job of jobs) {
      const existingJob = await Job.findOne({
        userId,
        sourceUrl: job.sourceUrl,
      });

      if (!existingJob) {
        const newJob = await Job.create({
          userId,
          ...job,
          matchScore: job.matchScore || 0.5,
        });
        // Convert to plain object so spread works correctly downstream
        savedJobs.push(newJob.toObject());
      } else {
        savedJobs.push(existingJob.toObject());
      }
    }

    return savedJobs;
  }

  /**
   * Match jobs to candidate
   */
  async matchJobs(userId, params, trace) {
    const { jobIds, candidateProfile } = params;

    const jobs = await Job.find({
      _id: { $in: jobIds },
      userId,
    });

    const matchedJobs = await this.calculateMatchScores(jobs, candidateProfile);

    // Sort by match score
    matchedJobs.sort((a, b) => b.matchScore - a.matchScore);

    return {
      matchedJobs,
      totalMatches: matchedJobs.length,
      topMatches: matchedJobs.slice(0, 10),
    };
  }

  /**
   * Update agent status in database
   */
  async updateAgentStatus(userId, status, currentTask) {
    await Agent.findOneAndUpdate(
      { userId, agentId: 'jobSearch' },
      {
        status,
        currentTask,
        lastActive: new Date(),
        $push: {
          activityLog: {
            timestamp: new Date(),
            action: `status_changed_to_${status}`,
            details: { currentTask },
          },
        },
      }
    );
  }
}

// Export singleton instance
module.exports = new JobSearchAgent();
