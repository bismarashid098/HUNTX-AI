import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import Sidebar from '../components/layout/Sidebar.jsx';
import ChatWindow from '../components/chat/ChatWindow.jsx';
import ChatInput from '../components/chat/ChatInput.jsx';
import CVUpload from '../components/cv/CVUpload.jsx';
import ApprovalPanel from '../components/approval/ApprovalPanel.jsx';

import useChatStore from '../store/chat.store.js';
import useApplicationStore from '../store/application.store.js';

import { sendMessage } from '../services/chat.service.js';
import { SSEClient } from '../services/sse.service.js';

export default function ChatPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const {
    messages,
    isStreaming,
    progressMessage,
    activeSessionId,
    loadSession,
    loadSessions,
    createSession,
    addUserMessage,
    addAgentMessage,
    setStreaming,
    setProgressMessage,
    updateSessionTitle,
  } = useChatStore();

  const { setApprovalIds, loadApplications } = useApplicationStore();

  const [showCVUpload, setShowCVUpload] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [approvalIds, setApprovalIdsLocal] = useState([]);
  const [cvText, setCvText] = useState(null);
  const sseRef = useRef(null);

  // Initialize session
  useEffect(() => {
    const init = async () => {
      if (sessionId) {
        await loadSession(sessionId);
        connectSSE(sessionId);
      } else {
        // Create new session and redirect
        try {
          const session = await createSession();
          const id = session.id || session._id;
          navigate(`/chat/${id}`, { replace: true });
        } catch {
          toast.error('Failed to create session');
        }
      }
    };
    init();

    return () => {
      sseRef.current?.disconnect();
    };
  }, [sessionId]);

  const connectSSE = useCallback((sid) => {
    sseRef.current?.disconnect();

    const client = new SSEClient(sid, {
      onMessage: (data) => {
        setStreaming(false);
        setProgressMessage(null);
        addAgentMessage(data.content, data.agentName, { type: 'text' });
        loadSessions().catch(() => {});
      },
      onProgress: (data) => {
        setStreaming(true);
        setProgressMessage(data.message);
      },
      onApprovalRequest: (data) => {
        setStreaming(false);
        setProgressMessage(null);
        setApprovalIdsLocal(data.applicationIds);
        setApprovalIds(data.applicationIds);
        setShowApproval(true);
        addAgentMessage(data.message, 'approval', { type: 'approval_request', applicationIds: data.applicationIds });
        // Load applications
        loadApplications(sid);
      },
      onComplete: (data) => {
        setStreaming(false);
        setProgressMessage(null);
        setShowApproval(false);
        addAgentMessage(data.message, 'complete', { type: 'complete' });
      },
      onError: (data) => {
        setStreaming(false);
        setProgressMessage(null);
        toast.error(data.message || 'An error occurred');
        addAgentMessage(data.message || 'An error occurred. Please try again.', 'error');
      },
      onConnectionError: () => {
        // SSE connection dropped — will auto-reconnect via EventSource
      },
    });

    client.connect();
    sseRef.current = client;
  }, []);

  const handleSend = async (message) => {
    if (!sessionId) return;

    addUserMessage(message);
    setStreaming(true);

    try {
      await sendMessage({
        sessionId,
        message,
        cvText: cvText || undefined,
      });
      // Clear CV text after first use
      if (cvText) setCvText(null);
    } catch (error) {
      setStreaming(false);
      toast.error(error.response?.data?.message || 'Failed to send message');
    }
  };

  const handleCVReady = (text) => {
    setCvText(text);
    toast.success('CV ready! Send a message to start the job hunt.');

    // Auto-trigger with CV
    if (sessionId) {
      addUserMessage('[CV Uploaded — Ready to analyze]');
      setStreaming(true);
      sendMessage({ sessionId, message: 'Please analyze my CV', cvText: text }).catch(() => {
        setStreaming(false);
      });
    }
  };

  const handleSendAll = async () => {
    if (!sessionId) return;
    addUserMessage('Send all approved applications');
    setStreaming(true);
    setShowApproval(false);
    try {
      await sendMessage({ sessionId, message: 'send approved' });
    } catch {
      setStreaming(false);
      toast.error('Failed to trigger email sending');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 bg-gray-800">
        {/* Chat Window */}
        <ChatWindow
          messages={messages}
          isStreaming={isStreaming}
          progressMessage={progressMessage}
        />

        {/* Approval Panel - shown above input when in approval state */}
        {showApproval && (
          <div className="max-h-[50vh] overflow-y-auto border-t border-gray-700">
            <ApprovalPanel
              sessionId={sessionId}
              applicationIds={approvalIds}
              onSendAll={handleSendAll}
            />
          </div>
        )}

        {/* Chat Input */}
        <ChatInput
          onSend={handleSend}
          onCVUpload={() => setShowCVUpload(true)}
          disabled={isStreaming}
        />
      </div>

      {/* CV Upload Modal */}
      {showCVUpload && (
        <CVUpload
          onCVReady={handleCVReady}
          onClose={() => setShowCVUpload(false)}
        />
      )}
    </div>
  );
}
