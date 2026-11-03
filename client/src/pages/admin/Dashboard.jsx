import React, { useState, useEffect } from 'react';
import api from '../../services/api';

export default function AdminDashboard() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // New Employee Form State
  const [employeeId, setEmployeeId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [role, setRole] = useState('employee');
  const [creatingUser, setCreatingUser] = useState(false);

  // Adjustment State
  const [adjustData, setAdjustData] = useState({ userId: null, leaveTypeId: null, credits: '' });

  const fetchData = async () => {
    // 1. Fetch Queue independently so it never gets blocked by missing admin routes
    try {
      const queueRes = await api.get('/leaves/admin/queue');
      setPendingRequests(queueRes.data.pendingRequests || []);
    } catch (err) {
      console.error('Failed to load leave queue:', err);
    }

    // 2. Fetch Employee Directory data safely
    try {
      const empRes = await api.get('/admin/employees');
      setEmployees(empRes.data.employees || []);
      setDepartments(empRes.data.departments || []);
      setSupervisors(empRes.data.supervisors || []);

      if (empRes.data.departments?.length > 0 && !departmentId) {
        setDepartmentId(empRes.data.departments[0].id);
      }
    } catch (err) {
      console.warn('Employee directory route not ready yet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleHRAction = async (id, action) => {
    setMsg(null);
    try {
      const res = await api.put(`/leaves/admin/review/${id}`, { action });
      setMsg({ type: 'success', text: res.data.message });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Action failed.' });
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    setMsg(null);

    try {
      const res = await api.post('/admin/employees', {
        employee_id: employeeId,
        first_name: firstName,
        last_name: lastName,
        email,
        department_id: departmentId,
        supervisor_id: supervisorId || null,
        role,
      });

      setMsg({ type: 'success', text: res.data.message });
      setEmployeeId('');
      setFirstName('');
      setLastName('');
      setEmail('');
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Creation failed.' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleAdjustQuota = async (e) => {
    e.preventDefault();
    if (!adjustData.userId || !adjustData.leaveTypeId || !adjustData.credits) return;

    try {
      const res = await api.put('/admin/adjust-balance', {
        user_id: adjustData.userId,
        leave_type_id: adjustData.leaveTypeId,
        total_credits: parseFloat(adjustData.credits),
      });
      setMsg({ type: 'success', text: res.data.message });
      setAdjustData({ userId: null, leaveTypeId: null, credits: '' });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Quota adjustment failed.' });
    }
  };

  const handleExportCSV = () => {
    window.open('http://localhost:5000/api/admin/export-audit', '_blank');
  };

  if (loading) {
    return <div className="text-slate-500 text-sm">Loading HR Admin console...</div>;
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

      {/* Reports & Audit Bar */}
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">System Reports & Exports</h2>
          <p className="text-xs text-slate-500">Download institutional submission records and audit data.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-[#800000] hover:bg-[#660000] text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
        >
          📁 Export Audit Log (CSV)
        </button>
      </div>

      {/* HR Final Approval Queue */}
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">HR Final Approval Queue</h2>
            <p className="text-xs text-slate-500">Requests approved by supervisors awaiting final authorization.</p>
          </div>
          <span className="px-2.5 py-1 text-xs font-bold bg-red-50 text-[#800000] border border-red-200 rounded-full">
            {pendingRequests.length} pending
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <p className="text-slate-400 text-sm">No leave requests currently pending HR action.</p>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div key={req.id} className="border border-slate-200 bg-slate-50/50 rounded-xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {req.first_name} {req.last_name}{' '}
                      <span className="text-xs font-normal text-slate-500">({req.employee_id})</span>
                    </h3>
                    <p className="text-xs text-slate-600">
                      Dept: <span className="font-semibold text-slate-800">{req.department_name}</span> | Type:{' '}
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
                      className="text-xs text-[#800000] underline font-semibold hover:text-[#660000]"
                    >
                      📎 View Medical / Cert
                    </a>
                  )}
                </div>

                <div className="bg-white border border-slate-200 p-3 rounded-lg text-xs text-slate-700">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block mb-0.5">Reason:</span>
                  {req.reason}
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => handleHRAction(req.id, 'reject')}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Reject Application
                  </button>
                  <button
                    onClick={() => handleHRAction(req.id, 'approve')}
                    className="px-4 py-1.5 bg-[#800000] hover:bg-[#660000] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    Grant Approval & Deduct Credits
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Employee */}
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Add New Employee</h2>
        <p className="text-xs text-slate-500 mb-4">Initial balances will be generated automatically upon creation.</p>

        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Employee ID</label>
              <input
                type="text"
                required
                placeholder="e.g. EMP-101"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">First Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Alex"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Last Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Email</label>
              <input
                type="email"
                required
                placeholder="alex@system.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              >
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Assigned Supervisor</label>
              <select
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-[#800000] focus:bg-white"
              >
                <option value="">None (Self-supervised)</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.employee_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={creatingUser}
            className="py-2.5 px-5 bg-[#800000] hover:bg-[#660000] text-white font-semibold text-sm rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {creatingUser ? 'Enrolling...' : 'Enroll Employee & Allocate Quotas'}
          </button>
        </form>
      </div>

      {/* Staff Directory & Balance Allocation */}
      <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Staff Directory & Quota Management</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Department</th>
                <th className="p-3">Role</th>
                <th className="p-3">Leave Balances</th>
                <th className="p-3 text-right">Adjust Quota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                  <td className="p-3">
                    <p className="font-semibold text-slate-900">
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p className="text-xs text-slate-400">{emp.email}</p>
                  </td>
                  <td className="p-3 text-slate-600">{emp.department_name}</td>
                  <td className="p-3">
                    <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {emp.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {emp.balances && emp.balances.length > 0 ? (
                        emp.balances.map((b) => (
                          <span
                            key={b.id}
                            className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded"
                          >
                            {b.leave_type_name}: <strong>{b.total_credits - b.used_credits}</strong>/{b.total_credits}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">No quotas</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <select
                        onChange={(e) =>
                          setAdjustData({
                            ...adjustData,
                            userId: emp.id,
                            leaveTypeId: e.target.value,
                          })
                        }
                        className="text-xs bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-700 focus:outline-none focus:border-[#800000]"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Select Type
                        </option>
                        {emp.balances?.map((b) => (
                          <option key={b.leave_type_id} value={b.leave_type_id}>
                            {b.leave_type_name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Days"
                        onChange={(e) =>
                          setAdjustData({ ...adjustData, credits: e.target.value })
                        }
                        className="w-14 text-xs bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-700 focus:outline-none focus:border-[#800000]"
                      />
                      <button
                        onClick={handleAdjustQuota}
                        className="px-2.5 py-1 bg-[#800000] hover:bg-[#660000] text-white rounded text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}