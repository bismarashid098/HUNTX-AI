import { Briefcase } from 'lucide-react';

export default function TypingIndicator({ message }) {
  return (
    <div className="flex gap-3 py-3 px-4">
      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
        <Briefcase size={14} className="text-emerald-400" />
      </div>
      <div className="bg-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
        {message ? (
          <p className="text-sm text-gray-300 animate-pulse">{message}</p>
        ) : (
          <div className="flex gap-1.5 items-center py-0.5">
            <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
            <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
            <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
          </div>
        )}
      </div>
    </div>
  );
}
