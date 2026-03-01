import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';
import { Briefcase, User } from 'lucide-react';

export default function ChatBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={clsx('flex gap-3 py-3 px-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
          isUser ? 'bg-blue-600' : 'bg-gray-600'
        )}
      >
        {isUser ? <User size={14} className="text-white" /> : <Briefcase size={14} className="text-emerald-400" />}
      </div>

      {/* Content */}
      <div className={clsx('max-w-[75%]', isUser ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
        <div
          className={clsx(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-gray-700 text-gray-100 rounded-tl-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <span className="text-xs text-gray-600 px-1">
          {new Date(message.timestamp || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
