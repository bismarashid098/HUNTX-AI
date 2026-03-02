/**
 * Resume Builder Agent
 * Builds and optimizes resumes with ATS scoring
 */

const { logAgentActivity, createTrace } = require('../../services/langchain/langfuse');
const { ResumeBuilderChains } = require('../../services/langchain/chains');
const Agent = require('../../models/Agent');
const Memory = require('../../models/Memory');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

class ResumeBuilderAgent {
  constructor() {
    this.atsKeywords = [
      'leadership', 'team', 'project', 'manage', 'developed', 'created', 'implemented',
      'achieved', 'increased', 'reduced', 'optimized', 'designed', 'built', 'delivered',
      'collaborated', 'analyzed', 'increased', 'decreased', 'transformed',
    ];
  }

  /**
   * Execute a resume building task
   */
  async execute(userId, task, sessionId) {
    const trace = createTrace('resume_builder', userId);
    const span = trace?.span({ name: 'resume_builder_execution' });

    try {
      logAgentActivity('resumeBuilder', 'task_started', { task, userId });

      await this.updateAgentStatus(userId, 'working', 'Building resume');

      const { action, tools, ...params } = task;

      switch (action) {
        case 'parse_cv':
          return await this.parseCV(userId, params, trace);
        case 'generate_cv':
          return await this.generateCV(userId, params, trace);
        case 'optimize_cv':
          return await this.optimizeCV(userId, params, trace);
        case 'generate_cover_letter':
          return await this.generateCoverLetter(userId, params, trace);
        case 'ats_score':
          return await this.calculateATSScore(userId, params, trace);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      logAgentActivity('resumeBuilder', 'error', { error: error.message, userId });
      await this.updateAgentStatus(userId, 'error', error.message);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Parse an uploaded CV
   */
  async parseCV(userId, params, trace) {
    const { filePath, fileContent } = params;

    await this.updateAgentStatus(userId, 'working', 'Parsing CV');

    let resumeText;

    if (filePath) {
      // Read from file
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      resumeText = data.text;
    } else if (fileContent) {
      resumeText = fileContent;
    } else {
      throw new Error('No file provided');
    }

    // Use LLM to parse
    const parsed = await ResumeBuilderChains.parseCV(resumeText, userId);

    // Save parsed profile to memory
    await Memory.findOneAndUpdate(
      { userId, memoryType: 'long_term', category: 'preferences', key: 'candidate_profile' },
      {
        userId,
        memoryType: 'long_term',
        category: 'preferences',
        key: 'candidate_profile',
        value: parsed,
      },
      { upsert: true, new: true }
    );

    logAgentActivity('resumeBuilder', 'cv_parsed', { 
      success: true,
      sections: Object.keys(parsed)
    });

    await this.updateAgentStatus(userId, 'completed', 'CV parsed successfully');

    return {
      parsed,
      sectionCount: Object.keys(parsed).length,
    };
  }

  /**
   * Generate an ATS-optimized CV for a specific job
   */
  async generateCV(userId, params, trace) {
    const { originalCV, targetJob } = params;

    await this.updateAgentStatus(userId, 'working', 'Generating optimized CV');

    // Use LLM to generate optimized CV
    const generated = await ResumeBuilderChains.generateCV(originalCV, targetJob, userId);

    // Calculate ATS score
    const atsScore = this.calculateLocalATSScore(generated, targetJob);

    // Save to memory
    await Memory.findOneAndUpdate(
      { userId, memoryType: 'short_term', category: 'resume', key: 'latest_generated' },
      {
        userId,
        memoryType: 'short_term',
        category: 'resume',
        key: 'latest_generated',
        value: { cv: generated, atsScore, targetJob },
      },
      { upsert: true, new: true }
    );

    logAgentActivity('resumeBuilder', 'cv_generated', { 
      atsScore: atsScore.overall,
      matchedKeywords: generated.matchedKeywords?.length || 0
    });

    await this.updateAgentStatus(userId, 'completed', 'CV generated successfully');

    return {
      cv: generated,
      atsScore,
      recommendations: generated.suggestions,
    };
  }

  /**
   * Optimize existing CV for ATS
   */
  async optimizeCV(userId, params, trace) {
    const { cvId, targetJobId } = params;

    // Get CV and job from database/memory
    const cv = await this.getCV(userId, cvId);
    const targetJob = await this.getJob(userId, targetJobId);

    return await this.generateCV(userId, { originalCV: cv, targetJob }, trace);
  }

  /**
   * Generate cover letter
   */
  async generateCoverLetter(userId, params, trace) {
    const { candidateProfile, targetJob } = params;

    await this.updateAgentStatus(userId, 'working', 'Writing cover letter');

    const result = await ResumeBuilderChains.generateCoverLetter(candidateProfile, targetJob, userId);

    // Save to memory
    await Memory.findOneAndUpdate(
      { userId, memoryType: 'short_term', category: 'resume', key: 'latest_cover_letter' },
      {
        userId,
        memoryType: 'short_term',
        category: 'resume',
        key: 'latest_cover_letter',
        value: { coverLetter: result, targetJob },
      },
      { upsert: true, new: true }
    );

    logAgentActivity('resumeBuilder', 'cover_letter_generated', { 
      wordCount: result.wordCount 
    });

    await this.updateAgentStatus(userId, 'completed', 'Cover letter generated');

    return result;
  }

  /**
   * Calculate ATS score for a CV
   */
  async calculateATSScore(userId, params, trace) {
    const { cv, targetJob } = params;

    // Use LLM for detailed analysis
    const generated = await ResumeBuilderChains.generateCV(cv, targetJob, userId);

    // Also calculate local score
    const localScore = this.calculateLocalATSScore(generated, targetJob);

    return {
      llmScore: generated.atsScore,
      localScore,
      overall: Math.round((generated.atsScore.overall + localScore.overall) / 2),
      recommendations: generated.suggestions,
    };
  }

  /**
   * Calculate local ATS score
   */
  calculateLocalATSScore(cv, targetJob) {
    const sections = cv.sections || cv;
    let formatScore = 0;
    let keywordScore = 0;
    let contentScore = 0;

    // Format score
    const hasContact = !!sections.contactInfo?.name && !!sections.contactInfo?.email;
    const hasSummary = !!sections.summary;
    const hasExperience = !!(sections.experience && sections.experience.length > 0);
    const hasEducation = !!(sections.education && sections.education.length > 0);
    const hasSkills = !!(sections.skills && Object.keys(sections.skills).length > 0);

    formatScore = (
      (hasContact ? 20 : 0) +
      (hasSummary ? 15 : 0) +
      (hasExperience ? 25 : 0) +
      (hasEducation ? 15 : 0) +
      (hasSkills ? 25 : 0)
    );

    // Keyword score
    const cvText = JSON.stringify(sections).toLowerCase();
    const jobRequirements = targetJob?.requirements || [];
    let matchedKeywords = 0;

    this.atsKeywords.forEach(keyword => {
      if (cvText.includes(keyword)) {
        matchedKeywords++;
      }
    });

    keywordScore = Math.min(100, (matchedKeywords / this.atsKeywords.length) * 100);

    // Content score
    const expLength = (sections.experience || []).reduce((acc, exp) => {
      return acc + (exp.description?.length || 0);
    }, 0);

    contentScore = Math.min(100, (expLength / 500) * 50 + 50); // More detail = higher score

    return {
      format: Math.round(formatScore),
      keywords: Math.round(keywordScore),
      content: Math.round(contentScore),
      overall: Math.round((formatScore * 0.3 + keywordScore * 0.4 + contentScore * 0.3)),
    };
  }

  /**
   * Get CV from memory/database
   */
  async getCV(userId, cvId) {
    if (cvId) {
      const Memory = require('../../models/Memory');
      return await Memory.findOne({ _id: cvId, userId });
    }
    
    // Get latest CV
    const Memory = require('../../models/Memory');
    return await Memory.findOne({
      userId,
      memoryType: 'long_term',
      category: 'preferences',
      key: 'candidate_profile',
    });
  }

  /**
   * Get job from database
   */
  async getJob(userId, jobId) {
    const Job = require('../../models/Job');
    return await Job.findOne({ _id: jobId, userId });
  }

  /**
   * Update agent status in database
   */
  async updateAgentStatus(userId, status, currentTask) {
    await Agent.findOneAndUpdate(
      { userId, agentId: 'resumeBuilder' },
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
module.exports = new ResumeBuilderAgent();
