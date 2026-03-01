import { useState, useRef } from 'react';
import { Send, Paperclip } from 'lucide-react';
import clsx from 'clsx';

export default function ChatInput({ onSend, onCVUpload, disabled }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e) => {
    setValue(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  return (
    <div className="border-t border-gray-700 bg-gray-900 p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2 bg-gray-800 rounded-2xl border border-gray-700 px-4 py-3 focus-within:border-gray-600 transition-colors">
        {/* CV Upload Button */}
        <button
          type="button"
          onClick={onCVUpload}
          disabled={disabled}
          className="text-gray-500 hover:text-emerald-400 transition-colors flex-shrink-0 pb-0.5 disabled:opacity-30"
          title="Upload CV"
        >
          <Paperclip size={18} />
        </button>

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Processing...' : 'Type your message... (Shift+Enter for new line)'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-600 resize-none focus:outline-none leading-relaxed max-h-36 disabled:opacity-50"
          style={{ scrollbarWidth: 'none' }}
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className={clsx(
            'flex-shrink-0 p-1.5 rounded-lg transition-colors pb-0.5',
            value.trim() && !disabled
              ? 'text-emerald-400 hover:text-emerald-300'
              : 'text-gray-600 cursor-not-allowed'
          )}
        >
          <Send size={18} />
        </button>
      </form>
      <p className="text-xs text-gray-700 text-center mt-2">
        HuntX AI specializes in job hunting. Off-topic questions will be redirected.
      </p>
    </div>
  );
}
