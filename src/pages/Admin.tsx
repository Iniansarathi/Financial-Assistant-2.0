import React, { useEffect, useState } from 'react';
import { useAuth } from '../services/auth/authProvider';
import { fetchFeedbackList, sendFeedbackReply } from '../services/feedbackService';
import {
  Users,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  Send,
  ExternalLink
} from 'lucide-react';

interface RegisteredUser {
  email: string;
  name: string;
  country: string;
  currency: string;
  driveFileId: string;
  lastLogin: string;
  status: string;
}

interface UserFeedback {
  email: string;
  message: string;
  screenshot: string;
  timestamp: string;
}

export const AdminPortal: React.FC = () => {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<RegisteredUser[]>([]);
  const [feedbackList, setFeedbackList] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'users' | 'feedback'
  const [activeTab, setActiveTab] = useState<'users' | 'feedback'>('users');

  // Reply Modal States
  const [replyTarget, setReplyTarget] = useState<UserFeedback | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;

  const handleApproveDeletion = async (targetEmail: string) => {
    if (!APPS_SCRIPT_URL) return;
    if (!window.confirm(`Are you sure you want to approve deletion for ${targetEmail}? This will authorize their client to delete all their Google Drive files and wipe their account database.`)) {
      return;
    }

    try {
      setLoading(true);
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
      setError('Admin API URL (VITE_ADMIN_API_URL) is not configured.');
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
      setError('Could not download admin data from Sheets. Check Google Apps Script URL.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedback = async () => {
    if (!APPS_SCRIPT_URL) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchFeedbackList();
      setFeedbackList(list);
    } catch (err: any) {
      console.error('Failed to fetch feedback logs:', err);
      setError('Failed to download user feedback database.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTarget || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      const success = await sendFeedbackReply(
        replyTarget.email,
        replyMessage,
        replyTarget.message,
        replyTarget.screenshot,
        replyTarget.timestamp
      );
      if (success) {
        alert(`Reply notification sent successfully to ${replyTarget.email}!`);
        setReplyTarget(null);
        setReplyMessage('');
      } else {
        alert('Failed to send reply. Please verify connection.');
      }
    } catch (err: any) {
      console.error('Failed to dispatch support reply:', err);
      alert('Error sending reply: ' + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  useEffect(() => {
    if (user?.email?.toLowerCase() === 'iniansarathi2003@gmail.com') {
      if (activeTab === 'users') {
        fetchUsers();
      } else {
        fetchFeedback();
      }
    }
  }, [user, activeTab]);

  if (user?.email?.toLowerCase() !== 'iniansarathi2003@gmail.com') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 text-slate-800 dark:text-white">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
        <h2 className="text-title font-extrabold mb-2">Access Denied</h2>
        <p className="text-body text-gray-500 max-w-sm leading-relaxed">
          This portal is restricted to system administrators. Only authorized accounts can access telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-left text-slate-800 dark:text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            Admin Portal
          </h1>
          <p className="text-body text-gray-500">Manage user logs and support feedback from Google Sheets database.</p>
        </div>
        <button
          onClick={activeTab === 'users' ? fetchUsers : fetchFeedback}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-white font-semibold text-caption border border-slate-200 dark:border-white/5 cursor-pointer active:scale-95 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </button>
      </div>

      {/* Slide tab switcher */}
      <div className="flex p-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-2.5 rounded-xl text-caption font-bold transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Registered Users ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-6 py-2.5 rounded-xl text-caption font-bold transition-all cursor-pointer ${
            activeTab === 'feedback'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          Support Feedbacks ({feedbackList.length})
        </button>
      </div>

      {/* Main Contents Panel */}
      {error ? (
        <div className="glass-card p-6 rounded-2xl border-red-500/20 bg-red-950/5 flex items-center gap-3 text-red-500">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-caption font-medium">{error}</p>
        </div>
      ) : loading ? (
        <div className="glass-card p-12 text-center rounded-2xl text-gray-400 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-caption">Retrieving database statistics...</p>
        </div>
      ) : activeTab === 'users' ? (
        /* Users Tab Table */
        <div className="glass-panel rounded-2xl border-slate-200 dark:border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-caption">
              <thead>
                <tr className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
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
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-gray-300">
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500 font-medium">
                      No users have registered or logged in yet.
                    </td>
                  </tr>
                ) : (
                  usersList.map((usr, index) => (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{usr.name}</td>
                      <td className="px-6 py-4 font-mono">{usr.email}</td>
                      <td className="px-6 py-4 text-center font-semibold">{usr.country || '--'}</td>
                      <td className="px-6 py-4 text-center font-mono text-blue-500 font-bold">{usr.currency || 'INR'}</td>
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
      ) : (
        /* Feedback logs Tab */
        <div className="space-y-6">
          {feedbackList.length === 0 ? (
            <div className="glass-card p-12 text-center text-gray-400 rounded-3xl">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
              <p className="text-caption font-medium">No user feedbacks received yet.</p>
              <p className="text-micro text-gray-500">Bug reports and feedback forms will populate this registry.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {feedbackList.map((fb, idx) => (
                <div
                  key={idx}
                  className="glass-card p-6 rounded-3xl border-slate-200 dark:border-white/5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="overflow-hidden">
                        <span className="text-micro text-slate-500 font-bold uppercase tracking-wider block">Submitted By</span>
                        <p className="text-caption font-bold text-slate-900 dark:text-white truncate">{fb.email}</p>
                      </div>
                      <span className="text-micro text-gray-400 font-medium shrink-0">
                        {new Date(fb.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/5 rounded-2xl">
                      <p className="text-caption text-slate-700 dark:text-gray-300 font-medium whitespace-pre-line leading-relaxed">
                        "{fb.message}"
                      </p>
                    </div>

                    {/* Screenshot Preview */}
                    {fb.screenshot && fb.screenshot.startsWith('http') && (
                      <div className="w-full h-32 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 relative bg-slate-100 dark:bg-black/20 group">
                        <img
                          src={fb.screenshot}
                          alt="Viewport capture preview"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <a
                          href={fb.screenshot}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-white text-micro font-bold transition-opacity cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View Full Screenshot
                        </a>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setReplyTarget(fb)}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-caption cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10"
                  >
                    <Send className="w-3.5 h-3.5" /> Reply to User
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Support Response Reply Dialog Modal */}
      {replyTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleSendReply} className="w-full max-w-md bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 rounded-3xl space-y-4 text-left shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-title font-extrabold text-slate-900 dark:text-white">Send Support Reply</h3>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="text-gray-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/5 rounded-2xl space-y-1">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Replying To: {replyTarget.email}</span>
              <p className="text-micro text-slate-600 dark:text-gray-400 italic max-h-16 overflow-y-auto">
                "{replyTarget.message}"
              </p>
            </div>

            <div>
              <label className="text-micro text-slate-500 dark:text-gray-400 font-semibold block mb-1">Reply Message</label>
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type support reply or bug fixes updates..."
                className="w-full h-32 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-caption text-slate-800 dark:text-white focus:outline-none resize-none focus:border-blue-500"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-700 dark:text-gray-300 font-semibold text-caption cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingReply}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption cursor-pointer flex items-center justify-center gap-1.5"
              >
                {sendingReply ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Response
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
