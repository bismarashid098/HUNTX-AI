/**
 * Prep Agent
 * Handles interview preparation, mock interviews, and skill gap analysis
 */

const { logAgentActivity, createTrace } = require('../../services/langchain/langfuse');
const { PrepChains } = require('../../services/langchain/chains');
const Agent = require('../../models/Agent');
const Memory = require('../../models/Memory');

class PrepAgent {
  constructor() {
    // Common interview questions bank
    this.commonQuestions = {
      behavioral: [
        { question: 'Tell me about yourself', topic: 'introduction', difficulty: 'easy' },
        { question: 'What is your greatest strength?', topic: 'strengths', difficulty: 'easy' },
        { question: 'What is your greatest weakness?', topic: 'weaknesses', difficulty: 'easy' },
        { question: 'Why do you want to work here?', topic: 'motivation', difficulty: 'easy' },
        { question: 'Where do you see yourself in 5 years?', topic: 'career_goals', difficulty: 'easy' },
        { question: 'Tell me about a time you faced a challenge at work', topic: 'challenges', difficulty: 'medium' },
        { question: 'Describe a time you had a conflict with a coworker', topic: 'conflict_resolution', difficulty: 'medium' },
        { question: 'Give an example of a goal you reached and how you achieved it', topic: 'achievements', difficulty: 'medium' },
        { question: 'Tell me about a time you had to meet a tight deadline', topic: 'time_management', difficulty: 'medium' },
        { question: 'Describe a time you showed leadership', topic: 'leadership', difficulty: 'hard' },
      ],
      technical: [
        { question: 'Explain [relevant technical concept]', topic: 'technical_concepts', difficulty: 'medium' },
        { question: 'How would you design [system]?', topic: 'system_design', difficulty: 'hard' },
        { question: 'What are the pros and cons of [technology]?', topic: 'technology_analysis', difficulty: 'medium' },
        { question: 'Walk me through your approach to debugging', topic: 'problem_solving', difficulty: 'medium' },
        { question: 'How would you scale this application?', topic: 'scalability', difficulty: 'hard' },
      ],
    };
  }

  /**
   * Execute a prep task
   */
  async execute(userId, task, sessionId) {
    const trace = createTrace('prep', userId);
    const span = trace?.span({ name: 'prep_execution' });

    try {
      logAgentActivity('prep', 'task_started', { task, userId });

      await this.updateAgentStatus(userId, 'working', 'Preparing interview');

      const { action, tools, ...params } = task;

      switch (action) {
        case 'generate_questions':
          return await this.generateQuestions(userId, params, trace);
        case 'mock_interview':
          return await this.startMockInterview(userId, params, trace);
        case 'skill_gap':
          return await this.analyzeSkillGap(userId, params, trace);
        case 'evaluate_answer':
          return await this.evaluateAnswer(userId, params, trace);
        case 'practice_session':
          return await this.practiceSession(userId, params, trace);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      logAgentActivity('prep', 'error', { error: error.message, userId });
      await this.updateAgentStatus(userId, 'error', error.message);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Generate interview questions for a specific role
   */
  async generateQuestions(userId, params, trace) {
    const { targetJob, companyName, count = 10 } = params;

    await this.updateAgentStatus(userId, 'working', 'Generating interview questions');

    // Get candidate experience
    const candidateProfile = await this.getCandidateProfile(userId);

    // Use LLM to generate questions
    let questions;
    try {
      questions = await PrepChains.generateQuestions(
        targetJob,
        companyName,
        candidateProfile,
        userId
      );
    } catch (error) {
      // Fallback to common questions
      questions = this.getCommonQuestions(targetJob, count);
    }

    // Save questions to memory
    const sessionData = {
      questions,
      targetJob,
      companyName,
      createdAt: new Date().toISOString(),
    };

    await Memory.findOneAndUpdate(
      { userId, memoryType: 'session', category: 'prep', key: 'current_questions' },
      {
        userId,
        memoryType: 'session',
        category: 'prep',
        key: 'current_questions',
        value: sessionData,
      },
      { upsert: true, new: true }
    );

    logAgentActivity('prep', 'questions_generated', { 
      company: companyName,
      count: questions.technical?.length + questions.behavioral?.length || count 
    });

    await this.updateAgentStatus(userId, 'completed', 'Questions generated');

    return {
      questions,
      totalQuestions: (questions.technical?.length || 0) + (questions.behavioral?.length || 0),
    };
  }

  /**
   * Get common questions based on job
   */
  getCommonQuestions(targetJob, count) {
    const jobType = targetJob?.title?.toLowerCase() || '';
    
    let technicalQuestions = [...this.commonQuestions.technical];
    
    // Add role-specific questions
    if (jobType.includes('software') || jobType.includes('developer') || jobType.includes('engineer')) {
      technicalQuestions = [
        ...technicalQuestions,
        ...[
          { question: 'Explain the difference between REST and GraphQL', topic: 'api_design', difficulty: 'medium' },
          { question: 'What is your approach to code review?', topic: 'code_quality', difficulty: 'medium' },
          { question: 'How do you handle technical debt?', topic: 'technical_debt', difficulty: 'hard' },
        ],
      ];
    }

    return {
      behavioral: this.commonQuestions.behavioral.slice(0, Math.ceil(count / 2)),
      technical: technicalQuestions.slice(0, Math.floor(count / 2)),
      situational: [],
    };
  }

  /**
   * Start a mock interview session
   */
  async startMockInterview(userId, params, trace) {
    const { mode = 'standard', questionCount = 5 } = params;

    await this.updateAgentStatus(userId, 'working', 'Starting mock interview');

    // Get questions from memory or generate new
    let session = await Memory.findOne({
      userId,
      memoryType: 'session',
      category: 'prep',
      key: 'current_questions',
    });

    if (!session) {
      // Generate new questions
      const questions = this.getCommonQuestions({}, questionCount);
      session = { value: { questions } };
    }

    // Create interview session
    const interviewSession = {
      sessionId: `interview_${Date.now()}`,
      questions: this.selectQuestions(session.value.questions, questionCount),
      currentIndex: 0,
      answers: [],
      mode,
      startedAt: new Date().toISOString(),
    };

    // Save session
    await Memory.findOneAndUpdate(
      { userId, memoryType: 'session', category: 'prep', key: 'interview_session' },
      {
        userId,
        memoryType: 'session',
        category: 'prep',
        key: 'interview_session',
        value: interviewSession,
      },
      { upsert: true, new: true }
    );

    // Get first question
    const firstQuestion = interviewSession.questions[0];

    logAgentActivity('prep', 'mock_interview_started', { 
      sessionId: interviewSession.sessionId,
      questionCount 
    });

    await this.updateAgentStatus(userId, 'working', 'In mock interview');

    return {
      sessionId: interviewSession.sessionId,
      currentQuestion: firstQuestion,
      questionNumber: 1,
      totalQuestions: questionCount,
      mode,
      instructions: this.getInterviewInstructions(mode),
    };
  }

  /**
   * Select questions for interview
   */
  selectQuestions(questions, count) {
    const allQuestions = [
      ...(questions.behavioral || []),
      ...(questions.technical || []),
      ...(questions.situational || []),
    ];

    // Shuffle and select
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Get interview instructions based on mode
   */
  getInterviewInstructions(mode) {
    const instructions = {
      standard: 'Answer the question as if in a real interview. Use the STAR method for behavioral questions.',
      pressure: 'Answer quickly and concisely. This simulates a fast-paced interview.',
      technical: 'Focus on technical accuracy and provide code examples where applicable.',
      behavioral: 'Focus on storytelling and real-world examples from your experience.',
    };
    return instructions[mode] || instructions.standard;
  }

  /**
   * Evaluate an answer
   */
  async evaluateAnswer(userId, params, trace) {
    const { question, answer, sessionId } = params;

    await this.updateAgentStatus(userId, 'working', 'Evaluating answer');

    // Use LLM to evaluate
    let feedback;
    try {
      feedback = await PrepChains.evaluateAnswer(question, answer, userId);
    } catch (error) {
      // Fallback evaluation
      feedback = this.localEvaluateAnswer(answer);
    }

    // Save answer to session
    const session = await Memory.findOne({
      userId,
      memoryType: 'session',
      category: 'prep',
      key: 'interview_session',
    });

    if (session) {
      session.value.answers.push({
        question,
        answer,
        feedback,
        answeredAt: new Date().toISOString(),
      });
      session.value.currentIndex = (session.value.currentIndex || 0) + 1;
      await session.save();
    }

    logAgentActivity('prep', 'answer_evaluated', { 
      score: feedback.score,
      sessionId 
    });

    // Check if interview is complete
    const isComplete = session?.value?.currentIndex >= session?.value?.questions?.length;

    if (isComplete) {
      await this.updateAgentStatus(userId, 'completed', 'Mock interview complete');
    }

    return {
      feedback,
      isComplete,
      nextQuestion: isComplete ? null : session?.value?.questions[session.value.currentIndex],
      progress: {
        current: session?.value?.currentIndex || 0,
        total: session?.value?.questions?.length || 0,
      },
    };
  }

  /**
   * Local answer evaluation (fallback)
   */
  localEvaluateAnswer(answer) {
    const wordCount = answer.split(/\s+/).length;
    const hasSTAR = /situation|task|action|result/i.test(answer);
    const hasNumbers = /\d+/.test(answer);

    let score = 5; // Base score

    if (wordCount > 20) score += 1;
    if (wordCount > 50) score += 1;
    if (hasSTAR) score += 2;
    if (hasNumbers) score += 1;

    return {
      score: Math.min(10, score),
      strengths: [
        wordCount > 50 ? 'Good detail level' : null,
        hasSTAR ? 'Used STAR method' : null,
        hasNumbers ? 'Quantified results' : null,
      ].filter(Boolean),
      improvements: [
        wordCount < 30 ? 'Provide more details' : null,
        !hasSTAR ? 'Consider using STAR method' : null,
      ].filter(Boolean),
      feedback: 'Good attempt! Consider adding more specific examples.',
    };
  }

  /**
   * Analyze skill gaps
   */
  async analyzeSkillGap(userId, params, trace) {
    const { targetJob } = params;

    await this.updateAgentStatus(userId, 'working', 'Analyzing skill gaps');

    // Get candidate profile
    const candidateProfile = await this.getCandidateProfile(userId);

    if (!candidateProfile || !candidateProfile.skills) {
      throw new Error('Candidate profile not found. Please upload your CV first.');
    }

    // Get job requirements
    const jobRequirements = targetJob?.requirements || [];

    // Use LLM for analysis
    let analysis;
    try {
      analysis = await PrepChains.analyzeSkillGap(
        candidateProfile.skills,
        jobRequirements,
        userId
      );
    } catch (error) {
      // Local analysis
      analysis = this.localSkillGapAnalysis(candidateProfile.skills, jobRequirements);
    }

    // Save analysis
    await Memory.findOneAndUpdate(
      { userId, memoryType: 'short_term', category: 'prep', key: 'skill_gap_analysis' },
      {
        userId,
        memoryType: 'short_term',
        category: 'prep',
        key: 'skill_gap_analysis',
        value: analysis,
      },
      { upsert: true, new: true }
    );

    logAgentActivity('prep', 'skill_gap_analyzed', { 
      gapScore: analysis.overallGapScore,
      missingSkills: analysis.gaps?.length || 0
    });

    await this.updateAgentStatus(userId, 'completed', 'Skill gap analyzed');

    return analysis;
  }

  /**
   * Local skill gap analysis
   */
  localSkillGapAnalysis(candidateSkills, jobRequirements) {
    const required = new Set(jobRequirements.map(r => r.toLowerCase()));
    const candidate = new Set([
      ...(candidateSkills.technical || []),
      ...(candidateSkills.tools || []),
    ].map(s => s.toLowerCase()));

    const matched = [];
    const gaps = [];

    required.forEach(skill => {
      if (candidate.has(skill)) {
        matched.push(skill);
      } else {
        gaps.push({
          skill,
          required: true,
          gap: 'major',
          recommendations: [
            `Take a course on ${skill}`,
            `Build a project using ${skill}`,
          ],
        });
      }
    });

    return {
      matchedSkills: matched,
      gaps,
      overallGapScore: required.size > 0 ? matched.length / required.size : 1,
      learningPlan: gaps.slice(0, 5).map((gap, i) => ({
        skill: gap.skill,
        priority: i + 1,
        resources: gap.recommendations,
      })),
    };
  }

  /**
   * Practice session
   */
  async practiceSession(userId, params, trace) {
    const { focus, duration = 15 } = params;

    await this.updateAgentStatus(userId, 'working', 'Running practice session');

    // Get or generate questions based on focus
    let questions;
    if (focus === 'behavioral') {
      questions = this.commonQuestions.behavioral;
    } else if (focus === 'technical') {
      questions = this.commonQuestions.technical;
    } else {
      questions = [...this.commonQuestions.behavioral, ...this.commonQuestions.technical];
    }

    const practiceSession = {
      focus,
      questions: questions.slice(0, Math.ceil(duration / 3)), // ~3 min per question
      duration,
      startedAt: new Date().toISOString(),
    };

    logAgentActivity('prep', 'practice_started', { focus, duration });

    return {
      session: practiceSession,
      firstQuestion: practiceSession.questions[0],
      totalQuestions: practiceSession.questions.length,
    };
  }

  /**
   * Get candidate profile
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
   * Update agent status
   */
  async updateAgentStatus(userId, status, currentTask) {
    await Agent.findOneAndUpdate(
      { userId, agentId: 'prep' },
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
module.exports = new PrepAgent();
