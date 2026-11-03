import React, { useContext, useState } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/auth/Login';
import EmployeeDashboard from './pages/employee/Dashboard';
import SupervisorDashboard from './pages/supervisor/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import CalendarView from './components/CalendarView';
import api from './services/api';

function MainApp() {
  const { user, login, logout, loading } = useContext(AuthContext);
  const [view, setView] = useState('dashboard');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modalMsg, setModalMsg] = useState(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setModalMsg(null);

    if (newPassword !== confirmPassword) {
      setModalMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await api.put('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setModalMsg({ type: 'success', text: res.data.message });
      setTimeout(() => {
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setModalMsg(null);
      }, 1500);
    } catch (err) {
      setModalMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update password.',
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Loading system...
      </div>
    );
  }

  if (!user) {
   return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-6 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-[#800000] inline-block"></span>
              <h1 className="text-xl font-bold text-slate-900">
                Welcome, {user.first_name || user.email}!
              </h1>
            </div>
            <p className="text-xs uppercase tracking-wider text-[#800000] mt-1 font-bold">
              Role: {user.role}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setView(view === 'dashboard' ? 'calendar' : 'dashboard')}
              className="px-4 py-2 text-xs font-semibold bg-red-50 text-[#800000] border border-red-200 hover:bg-red-100 rounded-lg transition shadow-xs cursor-pointer"
            >
              {view === 'dashboard' ? '📅 Absence Calendar' : '📋 Dashboard'}
            </button>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition cursor-pointer"
            >
              🔒 Security
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        {showPasswordModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-slate-200 shadow-2xl p-6 rounded-2xl max-w-sm w-full space-y-4">
              <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
              <p className="text-xs text-slate-500">Update your account credentials below.</p>

              {modalMsg && (
                <div
                  className={`p-2.5 rounded-lg text-xs border ${
                    modalMsg.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {modalMsg.text}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs uppercase font-semibold text-slate-600 mb-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#800000] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-semibold text-slate-600 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#800000] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-semibold text-slate-600 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-[#800000] focus:bg-white"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setModalMsg(null);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="px-4 py-1.5 bg-[#800000] hover:bg-[#660000] text-white font-medium rounded-lg text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {updatingPassword ? 'Updating...' : 'Save Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {view === 'calendar' ? (
          <CalendarView />
        ) : (
          <>
            {user.role === 'employee' && <EmployeeDashboard />}
            {user.role === 'supervisor' && <SupervisorDashboard />}
            {user.role === 'admin' && <AdminDashboard />}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}