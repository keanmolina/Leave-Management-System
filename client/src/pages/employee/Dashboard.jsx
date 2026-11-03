import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function EmployeeDashboard() {
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [leaveTypeId, setLeaveTypeId] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [collisions, setCollisions] = useState([]);

  const fetchData = async () => {
    try {
      const res = await api.get('/leaves/my-leaves');
      setBalances(res.data.balances || []);
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const checkCollisions = async () => {
      if (!startDate || !endDate) {
        setCollisions([]);
        return;
      }
      try {
        const res = await api.get(`/leaves/check-overlap?start_date=${startDate}&end_date=${endDate}`);
        setCollisions(res.data.overlappingLeaves || []);
      } catch (err) {
        console.error(err);
      }
    };

    checkCollisions();
  }, [startDate, endDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.append('leave_type_id', leaveTypeId);
    formData.append('start_date', startDate);
    formData.append('end_date', endDate);
    formData.append('reason', reason);
    if (file) {
      formData.append('attachment', file);
    }

    try {
      const res = await api.post('/leaves/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMsg({
        type: 'success',
        text: `Application filed! Deductible days: ${res.data.computedWorkingDays}. ${
          res.data.departmentCollisionDetected ? '⚠️ Colleague leave collision detected.' : ''
        }`,
      });

      setReason('');
      setStartDate('');
      setEndDate('');
      setFile(null);
      setCollisions([]);
      document.getElementById('file-input').value = '';
      fetchData();
    } catch (err) {
      setMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to submit leave.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this leave application? Blocked credits will be restored.')) {
      return;
    }

    setCancellingId(id);
    setMsg(null);

    try {
      const res = await api.put(`/leaves/cancel/${id}`);
      setMsg({ type: 'success', text: res.data.message });
      fetchData();
    } catch (err) {
      setMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to cancel leave request.',
      });
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return <div className="text-slate-500">Loading leave records...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map((b) => {
          const available = parseFloat(b.total_credits) - (parseFloat(b.used_credits) + parseFloat(b.pending_credits));
          return (
            <div key={b.id} className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs border-t-4 border-t-[#800000]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{b.leave_type_name}</h3>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">
                {available} <span className="text-xs text-slate-400 font-normal">days left</span>
              </p>
              <div className="mt-3 text-xs text-slate-500 flex justify-between border-t border-slate-100 pt-2 font-medium">
                <span>Used: {b.used_credits}</span>
                <span>Pending: {b.pending_credits}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-slate-900 mb-4">File a Leave Request</h2>

        {msg && (
          <div
            className={`p-3 rounded-lg text-sm mb-4 border ${
              msg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Leave Category
              </label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              >
                {balances.map((b) => (
                  <option key={b.leave_type_id} value={b.leave_type_id}>
                    {b.leave_type_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                End Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              />
            </div>
          </div>

          {collisions.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              <p className="font-bold">⚠️ Department Overlap Notice:</p>
              {collisions.map((c) => (
                <p key={c.id}>
                  • {c.first_name} {c.last_name} is scheduled off from {c.start_date.split('T')[0]} to {c.end_date.split('T')[0]} ({c.leave_type}).
                </p>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Reason
            </label>
            <textarea
              rows="3"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a brief explanation for your leave..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-[#800000] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Supporting Document (Optional: Medical Certificate / Memo)
            </label>
            <input
              id="file-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="py-2.5 px-5 bg-[#800000] hover:bg-[#660000] text-white font-semibold text-sm rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Submitting Leave...' : 'Submit Leave Request'}
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Request History</h2>
        {requests.length === 0 ? (
          <p className="text-slate-400 text-sm">No leave requests submitted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="text-xs uppercase bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Dates</th>
                  <th className="p-3">Days</th>
                  <th className="p-3">Attachment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => {
                  const isPending = r.status === 'pending_supervisor' || r.status === 'pending_hr';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-semibold text-slate-900">{r.leave_type_name}</td>
                      <td className="p-3 text-slate-600">{r.start_date.split('T')[0]} to {r.end_date.split('T')[0]}</td>
                      <td className="p-3 font-medium">{r.total_days}</td>
                      <td className="p-3">
                        {r.attachment_url ? (
                          <a
                            href={`http://localhost:5000${r.attachment_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#800000] underline font-medium hover:text-[#660000]"
                          >
                            View File
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            r.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : r.status === 'cancelled'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {isPending ? (
                          <button
                            onClick={() => handleCancelLeave(r.id)}
                            disabled={cancellingId === r.id}
                            className="px-2.5 py-1 text-xs text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded font-semibold transition disabled:opacity-50 cursor-pointer"
                          >
                            {cancellingId === r.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}