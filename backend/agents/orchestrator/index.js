/**
 * Orchestrator Agent
 * Central controller for managing agent collaboration and intent detection
 */

const { logAgentActivity, createTrace } = require('../../services/langchain/langfuse');
const { OrchestratorChains } = require('../../services/langchain/chains');
const Agent = require('../../models/Agent');
const Task = require('../../models/Task');
const Memory = require('../../models/Memory');
const Approval = require('../../models/Approval');

// Actions that require human confirmation before execution (irreversible)
const IRREVERSIBLE_ACTIONS = new Set([
  'send_application',
  'send_follow_up',
  'apply',
  'send_email',
]);

// Agent emoji map for plan display
const AGENT_ICONS = {
  orchestrator: '🎯',
  jobSearch: '🔍',
  resumeBuilder: '📄',
  apply: '📧',
  prep: '🎓',
};

// Agent configuration
const AGENTS = {
  orchestrator: {
    id: 'orchestrator',
    name: 'Orchestrator',
    description: 'Main controller and intent classifier',
  },
  jobSearch: {
    id: 'jobSearch',
    name: 'Job Search Agent',
    description: 'Finds and matches job opportunities',
  },
  resumeBuilder: {
    id: 'resumeBuilder',
    name: 'Resume Builder Agent',
    description: 'Builds and optimizes resumes',
  },
  apply: {
    id: 'apply',
    name: 'Apply Agent',
    description: 'Sends applications and tracks them',
  },
  prep: {
    id: 'prep',
    name: 'Preparation Agent',
    description: 'Interview preparation and practice',
  },
};

class OrchestratorAgent {
  constructor(userId) {
    this.userId = userId;
    this.sessionId = null;
    this.currentTasks = [];
    this.agentStatuses = {};
    this.trace = null;
  }

  /**
   * Initialize orchestrator for a user session
   */
  async initialize(sessionId) {
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.trace = createTrace('orchestrator_session', this.userId);
    
    logAgentActivity('orchestrator', 'initialized', { 
      userId: this.userId, 
      sessionId: this.sessionId 
    });

    // Initialize agent statuses
    for (const [id, agent] of Object.entries(AGENTS)) {
      this.agentStatuses[id] = {
        ...agent,
        status: 'idle',
        currentTask: null,
        progress: { current: 0, total: 100, message: '' },
      };
    }

    // Ensure agents exist in database
    await this.syncAgentsToDb();
    
    return this;
  }

  /**
   * Sync agent states to database
   */
  async syncAgentsToDb() {
    for (const [id, agent] of Object.entries(AGENTS)) {
      await Agent.findOneAndUpdate(
        { userId: this.userId, agentId: id },
        {
          userId: this.userId,
          agentId: id,
          agentName: agent.name,
          status: 'idle',
        },
        { upsert: true, new: true }
      );
    }
  }

  /**
   * Check if any task in the plan is irreversible (requires confirmation)
   */
  hasIrreversibleTasks(tasks) {
    return tasks.some(task => IRREVERSIBLE_ACTIONS.has(task.action));
  }

  /**
   * Build a structured plan summary for the frontend to display
   */
  buildPlanSummary(tasks, intentResult) {
    const steps = tasks.map((task, index) => {
      const isIrreversible = IRREVERSIBLE_ACTIONS.has(task.action);
      return {
        step: index + 1,
        agent: task.agent,
        agentIcon: AGENT_ICONS[task.agent] || '🤖',
        action: task.action,
        description: task.description || `${task.action} using ${task.agent}`,
        type: isIrreversible ? 'write' : 'read',
        warning: isIrreversible ? 'This action cannot be undone and will interact with external services.' : null,
      };
    });

    return {
      intent: intentResult.intent,
      summary: `Here's my plan for: "${intentResult.intent}"`,
      steps,
      irreversibleSteps: steps.filter(s => s.type === 'write').map(s => s.step),
      hasIrreversible: steps.some(s => s.type === 'write'),
      sessionId: this.sessionId,
    };
  }

  /**
   * Process user message and determine actions
   * Digital FTE: irreversible actions require confirmation before executing
   */
  async processMessage(message, context = {}) {
    const span = this.trace?.span({ name: 'process_message' });

    try {
      // Save user message to conversation memory
      await this.saveToMemory('conversation', 'last_message', {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });

      // Detect intent
      logAgentActivity('orchestrator', 'detecting_intent', { message });
      const intentResult = await OrchestratorChains.detectIntent(message, this.userId);

      logAgentActivity('orchestrator', 'intent_detected', intentResult);

      // Save intent to memory
      await this.saveToMemory('conversation', 'last_intent', intentResult);

      // Get relevant context from memory
      const userPreferences = await this.getFromMemory('preferences');
      const recentJobs = await this.getFromMemory('recent_jobs');

      // Plan tasks based on intent
      const planResult = await OrchestratorChains.planTasks(
        intentResult.intent,
        message,
        { ...intentResult.entities, preferences: userPreferences, recentJobs },
        this.userId
      );

      logAgentActivity('orchestrator', 'tasks_planned', planResult);

      const tasks = planResult.tasks || [];

      // Inject entity context into tasks
      const enrichedTasks = this.enrichTasksWithEntities(tasks, intentResult.entities);
      const enrichedTasksForPlan = enrichedTasks;

      // DIGITAL FTE: If plan contains irreversible actions, pause and ask for confirmation
      if (this.hasIrreversibleTasks(enrichedTasksForPlan)) {
        const planSummary = this.buildPlanSummary(tasks, intentResult);

        // Store the pending plan in memory so we can execute it after confirmation
        await this.saveToMemory('pending_plan', this.sessionId, {
          tasks: enrichedTasksForPlan,
          intentResult,
          originalMessage: message,
          createdAt: new Date().toISOString(),
        });

        logAgentActivity('orchestrator', 'plan_preview_returned', {
          sessionId: this.sessionId,
          taskCount: tasks.length,
          irreversibleCount: planSummary.irreversibleSteps.length,
        });

        const response = `I've analyzed your request and built a plan. Please review the steps below — especially the ones marked ⚠️ that will interact with external services. Click **"Go Ahead"** to proceed or **"Cancel"** to stop.`;

        return {
          success: true,
          intent: intentResult,
          tasks,
          results: {},
          response,
          agentStatuses: this.agentStatuses,
          requiresConfirmation: true,
          planSummary,
        };
      }

      // All tasks are reversible — execute immediately (enrichedTasks already declared above)
      const results = await this.executeTasks(enrichedTasks, context);

      // Generate response
      const response = await this.generateResponse(message, results);

      // Save assistant response to memory
      await this.saveToMemory('conversation', 'last_response', {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      });

      span?.end({ input: message, output: response, intent: intentResult });

      return {
        success: true,
        intent: intentResult,
        tasks,
        results,
        response,
        agentStatuses: this.agentStatuses,
        requiresApproval: planResult.requiresHumanApproval || false,
        approvalPoints: planResult.approvalPoints || [],
        requiresConfirmation: false,
      };
    } catch (error) {
      logAgentActivity('orchestrator', 'error', { error: error.message, message });
      span?.end({ error: error.message });

      return {
        success: false,
        error: error.message,
        response: `I encountered an error: ${error.message}. Please try again or rephrase your request.`,
      };
    }
  }

  /**
   * Execute confirmed plan (called after user clicks "Go Ahead")
   * Digital FTE: retrieves stored plan and executes it
   */
  async confirmAndExecute(sessionId) {
    const span = this.trace?.span({ name: 'confirm_and_execute' });

    try {
      // Retrieve stored plan
      const pendingPlanMemory = await this.getFromMemory('pending_plan', sessionId);

      if (!pendingPlanMemory) {
        throw new Error('No pending plan found for this session. Please send your request again.');
      }

      const { tasks, intentResult, originalMessage } = pendingPlanMemory;

      logAgentActivity('orchestrator', 'executing_confirmed_plan', {
        sessionId,
        taskCount: tasks.length
      });

      // Execute the stored tasks
      const results = await this.executeTasks(tasks, { sessionId });

      // Generate response
      const response = await this.generateResponse(originalMessage, results);

      // Clear the pending plan
      await Memory.findOneAndDelete({
        userId: this.userId,
        memoryType: 'short_term',
        category: 'pending_plan',
        key: sessionId,
      });

      // Save assistant response
      await this.saveToMemory('conversation', 'last_response', {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      });

      span?.end({ sessionId, taskCount: tasks.length });

      return {
        success: true,
        intent: intentResult,
        tasks,
        results,
        response,
        agentStatuses: this.agentStatuses,
        requiresConfirmation: false,
      };
    } catch (error) {
      logAgentActivity('orchestrator', 'confirm_execute_error', { error: error.message });
      span?.end({ error: error.message });

      return {
        success: false,
        error: error.message,
        response: `Error executing plan: ${error.message}`,
      };
    }
  }

  /**
   * Normalize LLM-generated agent name to valid enum value
   */
  normalizeAgentId(agentId) {
    const VALID_AGENTS = ['orchestrator', 'jobSearch', 'resumeBuilder', 'apply', 'prep'];
    if (VALID_AGENTS.includes(agentId)) return agentId;

    // Map common LLM hallucinations to correct agent IDs
    const lower = (agentId || '').toLowerCase();
    if (lower.includes('job') || lower.includes('search') || lower.includes('scrape') || lower.includes('filter') || lower.includes('rank') || lower.includes('match')) return 'jobSearch';
    if (lower.includes('resume') || lower.includes('cv') || lower.includes('cover') || lower.includes('ats')) return 'resumeBuilder';
    if (lower.includes('apply') || lower.includes('email') || lower.includes('send') || lower.includes('application')) return 'apply';
    if (lower.includes('prep') || lower.includes('interview') || lower.includes('skill') || lower.includes('mock')) return 'prep';
    return 'orchestrator'; // fallback
  }

  /**
   * Normalize LLM-generated action to valid action for the agent
   */
  normalizeAction(agentId, action) {
    const VALID_ACTIONS = {
      jobSearch: ['search_jobs', 'scrape_jobs', 'deduplicate', 'match_jobs'],
      resumeBuilder: ['parse_cv', 'generate_cv', 'generate_cover_letter'],
      apply: ['find_emails', 'draft_email', 'send_application'],
      prep: ['generate_questions', 'analyze_skill_gap', 'evaluate_answer'],
      orchestrator: [],
    };
    const valid = VALID_ACTIONS[agentId] || [];
    if (valid.includes(action)) return action;
    // Return first valid action as default
    return valid[0] || action;
  }

  /**
   * Inject entity data (keywords, location, skills) into each task
   * so agents receive the correct search parameters
   */
  enrichTasksWithEntities(tasks, entities = {}) {
    const keywords = (entities.keywords || []).join(' ');
    const location = (entities.locations || [])[0] || '';
    const skills = entities.skills || [];
    const companies = entities.companies || [];

    return tasks.map(task => ({
      ...task,
      keywords: task.keywords || keywords,
      location: task.location || location,
      skills: task.skills || skills,
      companies: task.companies || companies,
      filters: {
        ...(task.filters || {}),
        skills,
        companies,
      },
    }));
  }

  /**
   * Execute planned tasks
   */
  async executeTasks(tasks, context) {
    const results = {};
    const taskMap = new Map();

    // Create task records
    for (const task of tasks) {
      const normalizedAgentId = this.normalizeAgentId(task.agent);
      const normalizedAction = this.normalizeAction(normalizedAgentId, task.action);
      const normalizedTask = { ...task, agent: normalizedAgentId, action: normalizedAction };

      const taskId = await Task.generateTaskId(normalizedAgentId);
      taskMap.set(task.id, { ...normalizedTask, taskId });

      // Create task in database
      await Task.create({
        userId: this.userId,
        taskId,
        agentId: normalizedAgentId,
        taskType: normalizedAction,
        title: task.description || task.action,
        description: `Task: ${normalizedAction}`,
        input: { ...normalizedTask },
        status: 'pending',
        dependsOn: task.dependsOn || [],
        context: { sessionId: this.sessionId },
      });
    }

    // Execute tasks in order respecting dependencies
    for (const task of tasks) {
      const taskData = taskMap.get(task.id);
      // Use the normalized task data (correct agentId + action)
      const normalizedTask = taskData || task;

      // Check dependencies
      if (task.dependsOn && task.dependsOn.length > 0) {
        const deps = task.dependsOn.map(depId => taskMap.get(depId));
        const allCompleted = deps.every(d => d?.status === 'completed');

        if (!allCompleted) {
          await Task.findOneAndUpdate(
            { taskId: taskData?.taskId },
            { status: 'cancelled', error: { message: 'Dependencies not met' } }
          );
          continue;
        }
      }

      // Update agent status
      await this.updateAgentStatus(normalizedTask.agent, 'working', normalizedTask.action);

      // Execute task with appropriate agent
      try {
        const result = await this.executeTaskWithAgent(normalizedTask.agent, normalizedTask, results);
        results[task.id] = { success: true, data: result };
        
        // Check if task requires approval before marking complete
        if (result && result.requiresApproval) {
          // Task needs approval - don't mark as completed yet
          await Task.findOneAndUpdate(
            { taskId: taskData.taskId },
            { status: 'waiting_approval', output: result, approvalId: result.approvalId }
          );
          await this.updateAgentStatus(task.agent, 'waiting_approval', 'Awaiting your approval');
          logAgentActivity('orchestrator', 'task_waiting_approval', { taskId: task.id, approvalId: result.approvalId });
        } else {
          // Task completed normally
          await Task.findOneAndUpdate(
            { taskId: taskData.taskId },
            { status: 'completed', output: result, completedAt: new Date() }
          );
          
          // Update agent status to idle
          await this.updateAgentStatus(normalizedTask.agent, 'completed', normalizedTask.action);

          logAgentActivity('orchestrator', `task_completed`, { taskId: task.id, agent: normalizedTask.agent });
        }
      } catch (error) {
        results[task.id] = { success: false, error: error.message };

        await Task.findOneAndUpdate(
          { taskId: taskData?.taskId },
          { status: 'failed', error: { message: error.message } }
        );

        await this.updateAgentStatus(normalizedTask.agent, 'error', error.message);
        
        logAgentActivity('orchestrator', `task_failed`, { taskId: task.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Execute a single task with the appropriate agent
   */
  async executeTaskWithAgent(agentId, task, previousResults) {
    // Import agents dynamically to avoid circular dependencies
    const agents = {
      jobSearch: require('../jobSearch'),
      resumeBuilder: require('../resumeBuilder'),
      apply: require('../apply'),
      prep: require('../prep'),
    };

    const agent = agents[agentId];
    if (!agent) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    // Execute agent task
    return await agent.execute(this.userId, task, this.sessionId);
  }

  /**
   * Generate response based on task results
   */
  async generateResponse(message, results) {
    const agentStatuses = Object.values(this.agentStatuses).map(a => ({
      name: a.name,
      status: a.status,
      currentTask: a.currentTask,
    }));

    const recentActions = Object.entries(results).map(([id, result]) => ({
      taskId: id,
      agent: result.data?.agent || id,
      success: result.success,
      summary: result.data?.summary || null,
      error: result.success ? null : result.error,
    }));

    // Pass actual task results so LLM can talk about what was actually found/done
    const taskResults = Object.entries(results).map(([id, result]) => ({
      taskId: id,
      success: result.success,
      data: result.data || null,
      error: result.success ? null : result.error,
    }));

    const result = await OrchestratorChains.generateResponse(
      agentStatuses,
      message,
      recentActions,
      taskResults,
      this.userId
    );

    // LLM returns JSON — extract message string
    if (typeof result === 'string') return result;
    return result.message || result.response || result.text || result.reply ||
      `I've completed your request. ${Object.values(result)[0] || ''}`.trim();
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId, status, currentTask = null) {
    this.agentStatuses[agentId] = {
      ...this.agentStatuses[agentId],
      status,
      currentTask,
    };

    // Update in database
    await Agent.findOneAndUpdate(
      { userId: this.userId, agentId },
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

  /**
   * Get all agent statuses
   */
  async getAgentStatuses() {
    const dbAgents = await Agent.find({ userId: this.userId });
    return dbAgents.map(a => ({
      agentId: a.agentId,
      agentName: a.agentName,
      status: a.status,
      currentTask: a.currentTask,
      progress: a.progress,
      lastActive: a.lastActive,
      stats: a.stats,
    }));
  }

  /**
   * Save to memory
   */
  async saveToMemory(category, key, value) {
    await Memory.findOneAndUpdate(
      { userId: this.userId, memoryType: 'short_term', category, key },
      {
        userId: this.userId,
        memoryType: 'short_term',
        category,
        key,
        value,
        'context.sessionId': this.sessionId,
        'metadata.expiresAt': new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Get from memory
   */
  async getFromMemory(category, key = null) {
    const query = { userId: this.userId, memoryType: 'short_term', category };
    if (key) query.key = key;
    
    const memories = await Memory.find(query).sort({ createdAt: -1 }).limit(10);
    
    if (key) {
      return memories[0]?.value || null;
    }
    
    return memories.map(m => ({ key: m.key, value: m.value }));
  }

  /**
   * Create approval request
   */
  async createApproval(type, taskId, content, title, description) {
    const traceUrl = this.trace ? `https://langfuse.cloud/traces/${this.trace.traceId}` : null;
    
    const approval = await Approval.createPending({
      userId: this.userId,
      approvalType: type,
      taskId,
      agentId: 'orchestrator',
      title,
      description,
      content: { original: content },
      metadata: {
        urgency: 'medium',
        autoExpire: true,
        expireAfter: 30, // 30 minutes
      },
      traceUrl,
    });

    // Update agent to waiting approval
    await this.updateAgentStatus('orchestrator', 'waiting_approval', `Pending approval: ${title}`);

    // Update task
    await Task.findOneAndUpdate(
      { taskId },
      { status: 'waiting_approval', approvalId: approval._id }
    );

    return approval;
  }

  /**
   * Handle approval response
   */
  async handleApproval(approvalId, action, modifiedContent = null, comment = null) {
    const approval = await Approval.findOne({ approvalId, userId: this.userId });
    
    if (!approval) {
      throw new Error('Approval not found');
    }

    const update = {
      status: action === 'modified' ? 'modified' : action,
      respondedAt: new Date(),
      userComment: comment,
    };

    if (action === 'modified') {
      update.modifiedContent = modifiedContent;
      update.status = 'modified';
    }

    await Approval.findByIdAndUpdate(approval._id, update);

    // If rejected, mark task as cancelled
    if (action === 'rejected') {
      await Task.findOneAndUpdate(
        { taskId: approval.taskId },
        { status: 'cancelled', error: { message: 'Rejected by user' } }
      );
      await this.updateAgentStatus(approval.agentId, 'idle', 'Task rejected');
      return approval;
    }

    // If approved or modified, resume task execution
    await this.updateAgentStatus('orchestrator', 'working', 'Processing approval');

    try {
      // Get the original task
      const task = await Task.findOne({ taskId: approval.taskId });
      if (!task) {
        throw new Error('Task not found');
      }

      // Build context with approved/modified content
      const context = {
        ...task.input,
        _approvalAction: action,
        _modifiedContent: modifiedContent,
      };

      // Map approval types to agent methods
      const agentActions = {
        'email_send': 'sendApplicationConfirmed',
      };

      const agentMethod = agentActions[approval.approvalType];
      
      if (agentMethod) {
        const agents = {
          apply: require('../apply'),
        };

        const agent = agents.apply;
        if (agent && typeof agent[agentMethod] === 'function') {
          const trace = require('../../services/langchain/langfuse').createTrace('approval_execution', this.userId);
          const result = await agent[agentMethod](this.userId, context, trace);
          
          await Task.findOneAndUpdate(
            { taskId: approval.taskId },
            { status: 'completed', output: result, completedAt: new Date() }
          );
          
          await this.updateAgentStatus(task.agentId, 'completed', 'Task completed after approval');
          logAgentActivity('orchestrator', 'approval_executed', { taskId: task.taskId, approvalId });
          
          return { ...approval, executionResult: result };
        }
      }

      // Fallback: mark task as in_progress
      await Task.findOneAndUpdate(
        { taskId: approval.taskId },
        { status: 'in_progress' }
      );

    } catch (error) {
      logAgentActivity('orchestrator', 'approval_execution_error', { error: error.message });
      await this.updateAgentStatus('orchestrator', 'error', error.message);
      throw error;
    }

    return approval;
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals() {
    return Approval.getPending(this.userId);
  }

  /**
   * End session and cleanup
   */
  async endSession() {
    if (this.trace) {
      this.trace.end();
    }
    
    logAgentActivity('orchestrator', 'session_ended', { 
      userId: this.userId, 
      sessionId: this.sessionId 
    });
  }
}

module.exports = OrchestratorAgent;
module.exports.AGENTS = AGENTS;
