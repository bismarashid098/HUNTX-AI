import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, MessageSquare, Trash2, LogOut, Briefcase } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useChatStore from '../../store/chat.store.js';
import useAuthStore from '../../store/auth.store.js';
import clsx from 'clsx';

export default function Sidebar() {
  const navigate = useNavigate();
  const { sessions, activeSessionId, loadSessions, createSession, deleteSession } = useChatStore();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    loadSessions();
  }, []);
 
  const uniqueSessions = (() => {
    const seen = new Set();
    const out = [];
    for (const s of sessions) {
      const sid = s.id || s._id;
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      out.push(s);
    }
    return out;
  })();

  const handleNewChat = async () => {
    try {
      const session = await createSession();
      navigate(`/chat/${session.id || session._id}`);
    } catch {
      toast.error('Failed to create new session');
    }
  };

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await deleteSession(sessionId);
      if (activeSessionId === sessionId) {
        navigate('/chat');
      }
    } catch {
      toast.error('Failed to delete session');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Briefcase className="text-emerald-500" size={22} />
          <span className="font-bold text-white text-lg">HuntX AI</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Smart Job Hunting Agent</p>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          <PlusCircle size={16} />
          New Job Hunt
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {uniqueSessions.length === 0 ? (
          <p className="text-xs text-gray-600 text-center mt-4 px-2">
            Start a new job hunt to see your sessions here
          </p>
        ) : (
          uniqueSessions.map((session) => {
            const id = session.id || session._id;
            const isActive = activeSessionId === id;
            const when = new Date(session.updatedAt || session.createdAt).toLocaleString([], {
              year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            return (
              <div
                key={id}
                onClick={() => navigate(`/chat/${id}`)}
                className={clsx(
                  'group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors my-0.5',
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                )}
              >
                <MessageSquare size={14} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{session.title}</div>
                  <div className="text-xs text-gray-500 truncate">{when}</div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, id)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* User Info + Logout */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-200 font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
