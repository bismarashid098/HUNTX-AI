import { useState } from 'react';
import { CheckCircle, XCircle, Eye, Mail, MapPin, Building2, ExternalLink, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

export default function JobCard({ application, onApprove, onReject }) {
  const [showCV, setShowCV] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [editEmail, setEditEmail] = useState(false);
  const [emailBody, setEmailBody] = useState('');
  const [emailSubject, setEmailSubject] = useState('');

  const { job, emailDraft, tailoredCV, status } = application;
  const isInferred = emailDraft.hrEmailConfidence === 'inferred';

  const handleApprove = () => {
    onApprove(application._id, {
      emailBody: editEmail ? emailBody : undefined,
      emailSubject: editEmail ? emailSubject : undefined,
    });
  };

  const startEdit = () => {
    setEmailBody(emailDraft.body);
    setEmailSubject(emailDraft.subject);
    setEditEmail(true);
    setShowEmail(true);
  };

  const statusColors = {
    PENDING_REVIEW: 'text-gray-400 border-gray-600',
    APPROVED: 'text-emerald-400 border-emerald-800 bg-emerald-900/20',
    REJECTED: 'text-red-400 border-red-900 bg-red-900/20',
    SENT: 'text-blue-400 border-blue-900 bg-blue-900/20',
    FAILED: 'text-orange-400 border-orange-900 bg-orange-900/20',
  };

  return (
    <div className={clsx('bg-gray-800 rounded-xl border p-4', statusColors[status] || 'border-gray-700')}>
      {/* Job Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold text-sm truncate">{job.title}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Building2 size={11} /> {job.company}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {job.location}
            </span>
            {job.applyLink && (
              <a
                href={job.applyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
              >
                <ExternalLink size={11} /> View Job
              </a>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0', statusColors[status])}>
          {status.replace('_', ' ')}
        </span>
      </div>

      {/* HR Email */}
      <div className={clsx('flex items-center gap-2 mb-3 text-xs rounded-lg px-3 py-2', isInferred ? 'bg-amber-900/30 border border-amber-800' : 'bg-gray-700')}>
        {isInferred && <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />}
        <Mail size={12} className={isInferred ? 'text-amber-400' : 'text-gray-400'} />
        <span className={isInferred ? 'text-amber-300' : 'text-gray-300'}>
          {emailDraft.hrEmail || 'No email found'}
          {isInferred && <span className="ml-1 text-amber-500">(inferred — verify)</span>}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowCV(!showCV)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
        >
          <Eye size={12} /> {showCV ? 'Hide CV' : 'View CV'}
        </button>

        <button
          onClick={() => setShowEmail(!showEmail)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
        >
          <Mail size={12} /> {showEmail ? 'Hide Email' : 'View Email'}
        </button>

        {status === 'PENDING_REVIEW' && (
          <>
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-blue-300 transition-colors"
            >
              Edit & Approve
            </button>
            <button
              onClick={handleApprove}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white transition-colors"
            >
              <CheckCircle size={12} /> Approve
            </button>
            <button
              onClick={() => onReject(application._id)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-900/50 hover:bg-red-800 rounded-lg text-red-300 transition-colors"
            >
              <XCircle size={12} /> Reject
            </button>
          </>
        )}
      </div>

      {/* CV Preview */}
      {showCV && (
        <div className="mt-3 bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto">
          <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
            {tailoredCV || application.tailoredCV || 'Loading...'}
          </pre>
        </div>
      )}

      {/* Email Preview / Edit */}
      {showEmail && (
        <div className="mt-3 bg-gray-900 rounded-lg p-3">
          {editEmail ? (
            <>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full bg-gray-800 text-gray-200 text-xs px-3 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none mb-2"
                placeholder="Subject"
              />
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
                className="w-full bg-gray-800 text-gray-200 text-xs px-3 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                placeholder="Email body"
              />
              <button
                onClick={handleApprove}
                className="mt-2 w-full text-xs bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg transition-colors"
              >
                Save & Approve
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-1">Subject: <span className="text-gray-300">{emailDraft.subject}</span></p>
              <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{emailDraft.body}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
