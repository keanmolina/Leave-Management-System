import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function SupervisorDashboard() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectReason, setRejectReason] = useState({});
  const [showRejectInput, setShowRejectInput] = useState({});
  const [msg, setMsg] = useState(null);

  const fetchQueue = async () => {
    try {
      const res = await api.get('/leaves/supervisor/queue');
      setPendingRequests(res.data.pendingRequests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleAction = async (id, action) => {
    setActionLoading(id);
    setMsg(null);

    try {
      const payload = {
        action,
        rejection_reason: action === 'reject' ? rejectReason[id] || 'Rejected by supervisor' : undefined,
      };

      const res = await api.put(`/leaves/supervisor/review/${id}`, payload);
      setMsg({ type: 'success', text: res.data.message });
      fetchQueue();
    } catch (err) {
      setMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to process request.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="text-slate-500">Loading supervisor queue...</div>;
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`p-4 rounded-xl text-sm border shadow-xs ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Pending Team Requests</h2>
            <p className="text-xs text-slate-500">Review, detect collisions, and endorse requests to HR.</p>
          </div>
          <span className="px-2.5 py-1 text-xs font-bold bg-red-50 text-[#800000] border border-red-200 rounded-full">
            {pendingRequests.length} pending
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <p className="text-slate-400 text-sm">No team leave requests pending your review.</p>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="border border-slate-200 bg-slate-50/50 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {req.first_name} {req.last_name}{' '}
                      <span className="text-xs font-normal text-slate-500">({req.employee_id})</span>
                    </h3>
                    <p className="text-xs text-slate-600">
                      Category:{' '}
                      <span className="font-semibold text-slate-800">{req.leave_type_name}</span> | Duration:{' '}
                      <span className="font-semibold text-slate-800">{req.total_days} working days</span> (
                      {req.start_date.split('T')[0]} to {req.end_date.split('T')[0]})
                    </p>
                  </div>
                  {req.attachment_url && (
                    <a
                      href={`http://localhost:5000${req.attachment_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#800000] underline font-semibold hover:text-[#660000] self-start sm:self-auto"
                    >
                      📎 View Attachment
                    </a>
                  )}
                </div>

                <div className="bg-white border border-slate-200 p-3 rounded-lg text-xs text-slate-700">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block mb-0.5">Reason:</span>
                  {req.reason}
                </div>

                {req.collisions && req.collisions.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                    <p className="font-bold">⚠️ Overlap Warning:</p>
                    {req.collisions.map((c, i) => (
                      <p key={i}>
                        • {c.first_name} {c.last_name} ({c.leave_type}) is scheduled off from{' '}
                        {c.start_date.split('T')[0]} to {c.end_date.split('T')[0]}.
                      </p>
                    ))}
                  </div>
                )}

                {showRejectInput[req.id] && (
                  <div className="pt-2">
                    <input
                      type="text"
                      placeholder="Enter reason for rejection..."
                      value={rejectReason[req.id] || ''}
                      onChange={(e) =>
                        setRejectReason({ ...rejectReason, [req.id]: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-[#800000] mb-2"
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                  {showRejectInput[req.id] ? (
                    <>
                      <button
                        onClick={() =>
                          setShowRejectInput({ ...showRejectInput, [req.id]: false })
                        }
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'reject')}
                        disabled={actionLoading === req.id}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {actionLoading === req.id ? 'Processing...' : 'Confirm Reject'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          setShowRejectInput({ ...showRejectInput, [req.id]: true })
                        }
                        disabled={actionLoading === req.id}
                        className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'approve')}
                        disabled={actionLoading === req.id}
                        className="px-4 py-1.5 bg-[#800000] hover:bg-[#660000] text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
                      >
                        {actionLoading === req.id ? 'Processing...' : 'Approve & Endorse to HR'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}