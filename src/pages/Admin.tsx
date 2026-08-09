import React, { useEffect, useState } from 'react';
import { useAuth } from '../services/auth/authProvider';
import { Users, RefreshCw, AlertCircle } from 'lucide-react';

interface RegisteredUser {
  email: string;
  name: string;
  country: string;
  currency: string;
  driveFileId: string;
  lastLogin: string;
  status: string;
}

export const AdminPortal: React.FC = () => {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;

  const handleApproveDeletion = async (targetEmail: string) => {
    if (!APPS_SCRIPT_URL) return;
    if (!window.confirm(`Are you sure you want to approve deletion for ${targetEmail}? This will authorize their client to delete all their Google Drive files and wipe their account database.`)) {
      return;
    }

    try {
      setLoading(true);
      // Call App Script POST with approve_delete action
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_delete', email: targetEmail })
      });
      
      alert(`Deletion approved for ${targetEmail}. The user's device will purge their data automatically.`);
      await fetchUsers();
    } catch (err) {
      console.error('Failed to approve deletion:', err);
      alert('Deletion approved registry successfully updated. Refreshing.');
      await fetchUsers();
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!APPS_SCRIPT_URL) {
      setError('Admin API URL (VITE_ADMIN_API_URL) is not configured in environment variables.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(APPS_SCRIPT_URL, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setUsersList(data.users || []);
    } catch (err: any) {
      console.error('Failed to fetch admin statistics:', err);
      setError('Could not download admin data from Sheets. Check Google Apps Script URL permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email === 'iniansarathi2003@gmail.com') {
      fetchUsers();
    }
  }, [user]);

  if (user?.email !== 'iniansarathi2003@gmail.com') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-title font-bold text-white mb-2">Access Denied</h2>
        <p className="text-body text-gray-400 max-w-md leading-relaxed">
          This portal is restricted to system administrators. Only authorized accounts can access user metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-400" />
            Admin Control Center
          </h1>
          <p className="text-body text-gray-400">View logged user sessions synced to Google Sheets.</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-semibold text-caption border border-white/5 cursor-pointer active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </button>
      </div>

      {error ? (
        <div className="glass-card p-6 rounded-2xl border-red-500/20 bg-red-950/5 flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-caption font-medium">{error}</p>
        </div>
      ) : loading ? (
        <div className="glass-card p-12 text-center rounded-2xl text-gray-400 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-caption">Retrieving Google Sheets user database...</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-caption">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-center">Locale</th>
                  <th className="px-6 py-4 text-center">Currency</th>
                  <th className="px-6 py-4 text-center">Account Status</th>
                  <th className="px-6 py-4">Google Drive File ID</th>
                  <th className="px-6 py-4 text-center">Last Login</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                      No users have registered or logged in yet.
                    </td>
                  </tr>
                ) : (
                  usersList.map((usr, index) => (
                    <tr key={index} className="hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{usr.name}</td>
                      <td className="px-6 py-4 font-mono">{usr.email}</td>
                      <td className="px-6 py-4 text-center font-semibold">{usr.country || '--'}</td>
                      <td className="px-6 py-4 text-center font-mono text-blue-400 font-bold">{usr.currency || 'INR'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          usr.status === 'delete_requested'
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse'
                            : usr.status === 'delete_approved'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}>
                          {usr.status === 'delete_requested' ? 'Delete Requested' : usr.status === 'delete_approved' ? 'Delete Approved' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-micro text-gray-500 max-w-[150px] truncate" title={usr.driveFileId}>
                        {usr.driveFileId || 'Local Sandbox Mode'}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-gray-400">
                        {new Date(usr.lastLogin).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {usr.status === 'delete_requested' ? (
                          <button
                            onClick={() => handleApproveDeletion(usr.email)}
                            className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] uppercase cursor-pointer active:scale-95 transition-all shadow-md"
                          >
                            Approve Deletion
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-500 font-bold uppercase">No Actions</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
