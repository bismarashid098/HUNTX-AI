/**
 * Apply Agent
 * Handles job applications, HR email finding, and Gmail integration
 */

const { logAgentActivity, createTrace } = require('../../services/langchain/langfuse');
const { ApplyChains } = require('../../services/langchain/chains');
const Agent = require('../../models/Agent');
const Application = require('../../models/Application');
const Job = require('../../models/Job');
const Memory = require('../../models/Memory');
const Approval = require('../../models/Approval');
const { emailService } = require('../../services/emailService');

class ApplyAgent {

  /**
   * Execute an apply task
   */
  async execute(userId, task, sessionId) {
    const trace = createTrace('apply', userId);
    const span = trace?.span({ name: 'apply_execution' });

    try {
      logAgentActivity('apply', 'task_started', { task, userId });

      await this.updateAgentStatus(userId, 'working', 'Processing application');

      const { action, tools, ...params } = task;

      switch (action) {
        case 'find_emails':
          return await this.findHREmails(userId, params, trace);
        case 'draft_email':
          return await this.draftEmail(userId, params, trace);
        case 'send_application':
          return await this.sendApplication(userId, params, trace);
        case 'track_applications':
          return await this.trackApplications(userId, params, trace);
        case 'send_follow_up':
          return await this.sendFollowUp(userId, params, trace);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      logAgentActivity('apply', 'error', { error: error.message, userId });
      await this.updateAgentStatus(userId, 'error', error.message);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Find HR/recruiter email addresses for a company — fully LLM-driven
   */
  async findHREmails(userId, params, trace) {
    const { companyName, website, linkedin } = params;

    await this.updateAgentStatus(userId, 'working', `Finding HR emails for ${companyName}`);

    // LLM researches and suggests best email candidates for this company
    const result = await ApplyChains.findEmails(companyName, website, linkedin, userId);

    const emails = result.emails || [];

    logAgentActivity('apply', 'emails_found', {
      company: companyName,
      count: emails.length
    });

    await this.updateAgentStatus(userId, 'completed', `Found ${emails.length} email addresses`);

    return {
      emails,
      research: result.research,
    };
  }

  /**
   * Draft an application email
   */
  async draftEmail(userId, params, trace) {
    const { targetJob, candidateInfo, hrEmail } = params;

    await this.updateAgentStatus(userId, 'working', 'Drafting application email');

    // Get candidate profile
    const candidateProfile = await this.getCandidateProfile(userId);

    // LLM drafts a tailored, professional application email
    const result = await ApplyChains.draftEmail(
      candidateProfile || candidateInfo,
      targetJob,
      targetJob.company,
      hrEmail,
      userId
    );

    logAgentActivity('apply', 'email_drafted', {
      subject: result.subject,
      company: targetJob.company
    });

    await this.updateAgentStatus(userId, 'completed', 'Email drafted');

    return result;
  }

  /**
   * Send application (requires HITL approval)
   */
  async sendApplication(userId, params, trace) {
    const { targetJob, hrEmail, emailContent, cvAttachment } = params;

    await this.updateAgentStatus(userId, 'waiting_approval', 'Awaiting approval to send');

    // Get Gmail credentials from user
    const gmailCredentials = await this.getGmailCredentials(userId);

    if (!gmailCredentials) {
      throw new Error('Gmail not connected. Please connect your Gmail account first.');
    }

    // Create approval request
    const approval = await Approval.createPending({
      userId,
      approvalType: 'email_send',
      taskId: `apply_${Date.now()}`,
      agentId: 'apply',
      title: `Send application to ${targetJob.company}`,
      description: `Application for ${targetJob.title}`,
      content: {
        modified: {
          to: hrEmail,
          subject: emailContent.subject,
          body: emailContent.body,
          attachments: cvAttachment ? ['resume.pdf'] : [],
        },
      },
      metadata: {
        urgency: 'medium',
        autoExpire: true,
        expireAfter: 30,
      },
      traceUrl: trace ? `https://langfuse.cloud/traces/${trace.traceId}` : null,
    });

    logAgentActivity('apply', 'approval_requested', { 
      approvalId: approval.approvalId,
      company: targetJob.company 
    });

    // Update agent status
    await this.updateAgentStatus(userId, 'waiting_approval', 'Waiting for your approval');

    return {
      requiresApproval: true,
      approvalId: approval.approvalId,
      preview: {
        to: hrEmail,
        subject: emailContent.subject,
        body: emailContent.body,
      },
      message: 'Please review and approve this application before sending.',
    };
  }

  /**
   * Actually send the application (called after approval)
   */
  async sendApplicationConfirmed(userId, params, trace) {
    const { targetJob, hrEmail, emailContent, cvPath } = params;

    // Send email using email service
    const emailResult = await emailService.sendApplicationEmail({
      to: hrEmail,
      subject: emailContent.subject,
      body: emailContent.body,
      cvPath: cvPath || null,
      userName: null,
      companyName: targetJob.company,
    });

    // Create application record
    const application = await Application.create({
      userId,
      jobId: targetJob._id,
      company: targetJob.company,
      position: targetJob.title,
      hrEmail,
      emailContent: {
        subject: emailContent.subject,
        body: emailContent.body,
      },
      status: 'applied',
      appliedAt: new Date(),
      emailMessageId: emailResult.messageId,
    });

    // Update job status
    await Job.findByIdAndUpdate(targetJob._id, {
      status: 'applied',
      appliedAt: new Date(),
    });

    logAgentActivity('apply', 'application_sent', { 
      applicationId: application._id,
      company: targetJob.company 
    });

    await this.updateAgentStatus(userId, 'completed', 'Application sent');

    return {
      success: true,
      applicationId: application._id,
      message: `Application sent to ${hrEmail}`,
    };
  }

  /**
   * Track applications
   */
  async trackApplications(userId, params, trace) {
    const { status, dateRange } = params;

    const query = { userId };
    if (status) query.status = status;
    if (dateRange) {
      query.appliedAt = {
        $gte: dateRange.start,
        $lte: dateRange.end,
      };
    }

    const applications = await Application.find(query).sort({ appliedAt: -1 });

    // Calculate statistics
    const stats = {
      total: applications.length,
      applied: applications.filter(a => a.status === 'applied').length,
      viewed: applications.filter(a => a.status === 'viewed').length,
      interview: applications.filter(a => a.status === 'interview').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      accepted: applications.filter(a => a.status === 'accepted').length,
    };

    // Calculate response rate
    const responded = stats.viewed + stats.interview + stats.rejected + stats.accepted;
    stats.responseRate = stats.total > 0 ? (responded / stats.total) * 100 : 0;

    logAgentActivity('apply', 'applications_tracked', stats);

    return {
      applications,
      stats,
    };
  }

  /**
   * Send follow-up email — LLM generates the content
   */
  async sendFollowUp(userId, params, trace) {
    const { applicationId } = params;

    const application = await Application.findOne({ _id: applicationId, userId });

    if (!application) {
      throw new Error('Application not found');
    }

    // LLM drafts a personalised follow-up email
    const candidateName = application.candidateName || 'Candidate';
    const applicationDate = application.appliedAt?.toLocaleDateString() || 'recently';
    const emailContent = await ApplyChains.draftFollowUp(
      candidateName,
      application.position,
      application.company,
      applicationDate,
      userId
    );

    // Create approval request
    const approval = await Approval.createPending({
      userId,
      approvalType: 'follow_up',
      taskId: `followup_${Date.now()}`,
      agentId: 'apply',
      title: `Send follow-up to ${application.company}`,
      description: `Follow-up for ${application.position} application`,
      content: { modified: emailContent },
      metadata: { urgency: 'low', autoExpire: true, expireAfter: 60 },
    });

    return {
      requiresApproval: true,
      approvalId: approval.approvalId,
      preview: emailContent,
    };
  }

  /**
   * Get candidate profile from memory
   */
  async getCandidateProfile(userId) {
    const profile = await Memory.findOne({
      userId,
      memoryType: 'long_term',
      category: 'preferences',
      key: 'candidate_profile',
    });
    return profile?.value || null;
  }

  /**
   * Get Gmail credentials from user
   */
  async getGmailCredentials(userId) {
    const User = require('../../models/User');
    const user = await User.findById(userId);
    return user?.gmailCredentials || null;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(userId, status, currentTask) {
    await Agent.findOneAndUpdate(
      { userId, agentId: 'apply' },
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
module.exports = new ApplyAgent();
