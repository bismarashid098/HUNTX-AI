import { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import { Briefcase } from 'lucide-react';

export default function ChatWindow({ messages, isStreaming, progressMessage }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, progressMessage]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-700">
          <Briefcase className="text-emerald-500" size={28} />
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Ready to Hunt Jobs?</h3>
        <p className="text-gray-400 text-sm max-w-sm leading-relaxed">
          Start by uploading your CV using the <span className="text-emerald-400">📎 paperclip icon</span> below,
          then I'll help you find and apply to matching jobs automatically.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-gray-500 max-w-sm">
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-emerald-400 font-medium mb-1">1. Upload CV</div>
            <div>PDF or paste text</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-blue-400 font-medium mb-1">2. Confirm</div>
            <div>Job title & city</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-purple-400 font-medium mb-1">3. Apply</div>
            <div>Review & send emails</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto py-4">
        {messages.map((msg, i) => (
          <ChatBubble key={msg._id || i} message={msg} />
        ))}

        {isStreaming && (
          <TypingIndicator message={progressMessage} />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
