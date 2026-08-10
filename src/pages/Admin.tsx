import React, { useEffect, useState } from 'react';
import { useAuth } from '../services/auth/authProvider';
import { fetchFeedbackList, sendFeedbackReply, updateFeedbackStatus } from '../services/feedbackService';
import {
  RefreshCw,
  AlertCircle,
  MessageSquare,
  Send,
  ExternalLink,
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
  status: string;
}

export const AdminPortal: React.FC = () => {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<RegisteredUser[]>([]);
  const [feedbackList, setFeedbackList] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'users' | 'feedback'
  const [activeTab, setActiveTab] = useState<'users' | 'feedback'>('users');

  // Unified Support Composing Modal States
  const [replyFeedbacks, setReplyFeedbacks] = useState<UserFeedback[]>([]);
  const [selectedTimestamps, setSelectedTimestamps] = useState<string[]>([]);
  const [selectedFeedbackActions, setSelectedFeedbackActions] = useState<Record<string, 'rectified' | 'rectifying_shortly'>>({});
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
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'approve_delete', email: targetEmail })
      });
      if (response.ok) {
        alert(`Deletion request approved for ${targetEmail}.`);
        fetchUsers();
      } else {
        alert('Failed to approve deletion request.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(APPS_SCRIPT_URL || '');
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const data = await response.json();
      setUsersList(data.users || []);
    } catch (err: any) {
      console.error('Failed to fetch registered users list:', err);
      setError('Failed to download user metrics from Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchFeedbackList();
      setFeedbackList(list);
    } catch (err) {
      console.error('Failed to fetch feedback logs:', err);
      setError('Failed to download user feedback database.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (replyFeedbacks.length === 0 || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      const targetEmail = replyFeedbacks[0].email;
      const originalFeedbackMsg = replyFeedbacks.map(f => f.message).join(' | ');
      const originalScreenshot = replyFeedbacks.map(f => f.screenshot).filter(Boolean).join(', ');
      const originalTimestamp = replyFeedbacks[0].timestamp;

      const success = await sendFeedbackReply(
        targetEmail,
        replyMessage,
        originalFeedbackMsg,
        originalScreenshot,
        originalTimestamp
      );

      if (success) {
        // Update Sheets resolution statuses for all items in the batch
        for (const fb of replyFeedbacks) {
          const action = selectedFeedbackActions[fb.timestamp] || 'rectified';
          const targetStatus = action === 'rectified' ? 'Resolved' : 'Unresolved';
          await updateFeedbackStatus(fb.email, fb.timestamp, targetStatus);
        }

        alert(`Support response dispatched to ${targetEmail}!`);
        setReplyFeedbacks([]);
        setSelectedTimestamps([]);
        setSelectedFeedbackActions({});
        setReplyMessage('');
        fetchFeedback(); // Refresh
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

  const handleToggleStatus = async (fb: UserFeedback) => {
    const nextStatus = fb.status === 'Resolved' ? 'Unresolved' : 'Resolved';
    try {
      setLoading(true);
      const success = await updateFeedbackStatus(fb.email, fb.timestamp, nextStatus);
      if (success) {
        // Refresh local list
        const refreshedList = await fetchFeedbackList();
        setFeedbackList(refreshedList);
      } else {
        alert("Failed to update resolution status.");
      }
    } catch (err: any) {
      console.error("Failed to toggle status:", err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
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

  // Generate templated response when selecting feedbacks / resolution status inside reply modal
  useEffect(() => {
    if (replyFeedbacks.length === 0) return;
    const targetEmail = replyFeedbacks[0].email;
    const matchingUser = usersList.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
    const userName = matchingUser ? matchingUser.name : 'User';

    let composed = `Thank you for sending a feed ${userName},\n\n`;
    if (replyFeedbacks.length === 1) {
      const fb = replyFeedbacks[0];
      const action = selectedFeedbackActions[fb.timestamp] || 'rectified';
      if (action === 'rectified') {
        composed += `Feedback ["${fb.message}"] was resolved successfully.`;
      } else {
        composed += `Feedback ["${fb.message}"] will be resolved shortly.`;
      }
    } else {
      replyFeedbacks.forEach((fb, idx) => {
        const num = idx + 1;
        const action = selectedFeedbackActions[fb.timestamp] || 'rectified';
        const shortMessage = fb.message.length > 55 ? fb.message.substring(0, 55) + '...' : fb.message;
        
        if (action === 'rectified') {
          composed += `Feedback ${num} ["${shortMessage}"] was rectified successfully,\n`;
        } else {
          composed += `Feedback ${num} ["${shortMessage}"] will be rectified shortly,\n`;
        }
      });
      // Trim trailing comma/newline and format end
      if (composed.endsWith(',\n')) {
        composed = composed.substring(0, composed.length - 2) + '.';
      }
    }
    composed += `\n\nThank you for helping us improve MoneyPilot!`;
    setReplyMessage(composed);
  }, [replyFeedbacks, selectedFeedbackActions, usersList]);

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

  // Group feedbacks by email
  const groupedFeedback: Record<string, UserFeedback[]> = {};
  feedbackList.forEach(fb => {
    if (!groupedFeedback[fb.email]) {
      groupedFeedback[fb.email] = [];
    }
    groupedFeedback[fb.email].push(fb);
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-heading font-extrabold tracking-tight text-slate-900 dark:text-white">Admin Control Portal</h1>
          <p className="text-body text-gray-500">Manage user logs and support feedback from Google Sheets database.</p>
        </div>
        <button
          onClick={activeTab === 'users' ? fetchUsers : fetchFeedback}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-caption active:scale-95 transition-all shadow-lg cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Database
        </button>
      </div>

      {/* Tabs bar */}
      <div className="flex border-b border-slate-200 dark:border-white/5">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-bold text-caption tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Registered Users ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-6 py-3 font-bold text-caption tracking-wide border-b-2 transition-all cursor-pointer ${
            activeTab === 'feedback'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-500 hover:text-slate-900 dark:hover:text-white'
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
        /* Grouped Feedback logs Tab */
        <div className="space-y-8">
          {Object.keys(groupedFeedback).length === 0 ? (
            <div className="glass-card p-12 text-center text-gray-400 rounded-3xl">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
              <p className="text-caption font-medium">No user feedbacks received yet.</p>
              <p className="text-micro text-gray-500">Bug reports and feedback forms will populate this registry.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedFeedback).map(([email, feedbacks]) => {
                const matchingUser = usersList.find(u => u.email?.toLowerCase() === email.toLowerCase());
                const userName = matchingUser ? matchingUser.name : 'Registered User';
                
                const userSelectedTimestamps = feedbacks
                  .filter(fb => selectedTimestamps.includes(fb.timestamp))
                  .map(fb => fb.timestamp);

                const isAllSelected = userSelectedTimestamps.length === feedbacks.length;

                const handleSelectAllForUser = () => {
                  if (isAllSelected) {
                    // Deselect all
                    setSelectedTimestamps(prev => prev.filter(t => !feedbacks.map(f => f.timestamp).includes(t)));
                  } else {
                    // Select all
                    const newTimestamps = feedbacks.map(f => f.timestamp);
                    setSelectedTimestamps(prev => [...prev, ...newTimestamps]);
                  }
                };

                return (
                  <div key={email} className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-white/5 space-y-4 bg-slate-50/50 dark:bg-white/1 text-left">
                    {/* User Header Block */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-white/5">
                      <div>
                        <span className="text-[9px] font-extrabold text-blue-500 uppercase tracking-widest block">Bug Reports from</span>
                        <h3 className="text-caption font-black text-slate-900 dark:text-white flex items-center gap-2">
                          {userName} 
                          <span className="text-micro font-medium text-gray-400 font-mono">({email})</span>
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSelectAllForUser}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-caption font-semibold text-gray-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                        >
                          {isAllSelected ? 'Deselect All' : 'Select All'}
                        </button>
                        <button
                          type="button"
                          disabled={userSelectedTimestamps.length === 0}
                          onClick={() => {
                            const selectedFbs = feedbacks.filter(fb => selectedTimestamps.includes(fb.timestamp));
                            setReplyFeedbacks(selectedFbs);
                            
                            // Initialize selected actions
                            const initialActions: Record<string, 'rectified' | 'rectifying_shortly'> = {};
                            selectedFbs.forEach(fb => {
                              initialActions[fb.timestamp] = 'rectified';
                            });
                            setSelectedFeedbackActions(initialActions);
                          }}
                          className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-caption cursor-pointer disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all shadow-md shadow-blue-600/10"
                        >
                          <Send className="w-3.5 h-3.5" /> Compose Reply ({userSelectedTimestamps.length})
                        </button>
                      </div>
                    </div>

                    {/* Feedbacks Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {feedbacks.map((fb, idx) => {
                        const isChecked = selectedTimestamps.includes(fb.timestamp);
                        const isResolved = fb.status === 'Resolved';

                        return (
                          <div key={fb.timestamp} className={`glass-card p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between gap-4 ${
                            isChecked ? 'border-blue-500 bg-blue-500/5' : 'border-white/5'
                          }`}>
                            <div className="space-y-3">
                              {/* Selection header */}
                              <div className="flex justify-between items-start gap-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedTimestamps(prev => prev.filter(t => t !== fb.timestamp));
                                      } else {
                                        setSelectedTimestamps(prev => [...prev, fb.timestamp]);
                                      }
                                    }}
                                    className="rounded border-slate-300 dark:border-white/10 text-blue-600 focus:ring-blue-500 bg-white/5 w-4 h-4"
                                  />
                                  <span className="text-[10px] text-gray-500 font-bold uppercase">Feedback #{idx + 1}</span>
                                </label>
                                
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide ${
                                  isResolved 
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse'
                                }`}>
                                  {fb.status}
                                </span>
                              </div>

                              {/* Message */}
                              <div className="p-3 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/5 rounded-xl">
                                <p className="text-caption text-slate-700 dark:text-gray-300 font-medium whitespace-pre-line leading-relaxed">
                                  "{fb.message}"
                                </p>
                              </div>

                              {/* Screenshot Link */}
                              {fb.screenshot && fb.screenshot.startsWith('http') && (
                                <div className="w-full h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 relative bg-slate-100 dark:bg-black/20 group">
                                  <img
                                    src={fb.screenshot}
                                    alt="bug report capture"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <a
                                    href={fb.screenshot}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 text-white text-micro font-bold transition-all cursor-pointer"
                                  >
                                    <ExternalLink className="w-3 h-3" /> View Full
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Details & toggle actions */}
                            <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                              <span className="text-micro text-gray-500">
                                {new Date(fb.timestamp).toLocaleDateString()}
                              </span>
                              
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(fb)}
                                className={`px-3 py-1 rounded-lg text-micro font-bold transition-all cursor-pointer active:scale-95 border ${
                                  isResolved 
                                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/10'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/10'
                                }`}
                              >
                                Mark {isResolved ? 'Unresolved' : 'Resolved'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Support Response Reply Dialog Modal */}
      {replyFeedbacks.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleSendReply} className="w-full max-w-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 rounded-3xl space-y-4 text-left shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-title font-extrabold text-slate-900 dark:text-white">Send support reply</h3>
              <button
                type="button"
                onClick={() => setReplyFeedbacks([])}
                className="text-gray-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">
                Composing Unified Reply for: {replyFeedbacks[0].email}
              </span>
              
              {/* Selected feedbacks lists with togglers */}
              {replyFeedbacks.map((fb, idx) => (
                <div key={fb.timestamp} className="p-3 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-950 dark:text-white">Feedback #{idx + 1}:</span>
                    
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFeedbackActions(prev => ({ ...prev, [fb.timestamp]: 'rectified' }));
                        }}
                        className={`px-2 py-1 rounded text-micro font-bold transition-all cursor-pointer ${
                          (selectedFeedbackActions[fb.timestamp] || 'rectified') === 'rectified'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        Rectified
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFeedbackActions(prev => ({ ...prev, [fb.timestamp]: 'rectifying_shortly' }));
                        }}
                        className={`px-2 py-1 rounded text-micro font-bold transition-all cursor-pointer ${
                          (selectedFeedbackActions[fb.timestamp] || 'rectified') === 'rectifying_shortly'
                            ? 'bg-amber-500 text-white'
                            : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        Fixing Shortly
                      </button>
                    </div>
                  </div>
                  <p className="text-micro text-slate-700 dark:text-gray-400 italic">
                    "{fb.message.length > 100 ? fb.message.substring(0, 100) + '...' : fb.message}"
                  </p>
                </div>
              ))}
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
                onClick={() => setReplyFeedbacks([])}
                className="flex-1 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-700 dark:text-gray-300 font-semibold text-caption cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingReply}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-caption rounded-xl cursor-pointer disabled:opacity-40"
              >
                {sendingReply ? 'Sending...' : 'Send Reply & Update'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
