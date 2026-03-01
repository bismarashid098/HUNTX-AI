import { useEffect, useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import JobCard from './JobCard.jsx';
import useApplicationStore from '../../store/application.store.js';
import * as appService from '../../services/application.service.js';

export default function ApprovalPanel({ sessionId, applicationIds, onSendAll }) {
  const { applications, loadApplications, approve, reject, isLoading } = useApplicationStore();
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadApplications(sessionId);
    }
  }, [sessionId, applicationIds]);

  const approvedCount = applications.filter((a) => a.status === 'APPROVED').length;
  const pendingCount = applications.filter((a) => a.status === 'PENDING_REVIEW').length;

  const handleApprove = async (id, edits) => {
    try {
      await approve(id, edits);
      toast.success('Application approved!');
    } catch {
      toast.error('Failed to approve application');
    }
  };

  const handleReject = async (id) => {
    try {
      await reject(id);
      toast.success('Application rejected');
    } catch {
      toast.error('Failed to reject application');
    }
  };

  const handleSendAll = async () => {
    if (approvedCount === 0) {
      toast.error('Please approve at least one application first');
      return;
    }
    setIsSending(true);
    try {
      await onSendAll();
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading && applications.length === 0) {
    return (
      <div className="mx-4 my-3 p-4 bg-gray-800 rounded-xl border border-gray-700 text-center text-gray-400 text-sm">
        Loading applications...
      </div>
    );
  }

  return (
    <div className="mx-4 my-3 space-y-3">
      {/* Header */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <CheckCircle2 className="text-emerald-400" size={18} />
              Review Your Applications
            </h3>
            <p className="text-gray-400 text-xs mt-0.5">
              {applications.length} total · {approvedCount} approved · {pendingCount} pending review
            </p>
          </div>
          <button
            onClick={handleSendAll}
            disabled={approvedCount === 0 || isSending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Send size={14} />
            {isSending ? 'Sending...' : `Send ${approvedCount > 0 ? `${approvedCount} ` : ''}Approved`}
          </button>
        </div>
      </div>

      {/* Job Cards */}
      {applications.map((app) => (
        <JobCard
          key={app._id}
          application={app}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      ))}
    </div>
  );
}
