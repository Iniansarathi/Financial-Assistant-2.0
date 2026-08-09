import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth/authProvider';
import { Login } from '../pages/Login';
import { Shell } from '../components/navigation/Shell';

// Lazy loading is configured directly here for subpages to reduce initial footprint
import { Dashboard } from '../pages/Dashboard';
import { Expenses } from '../pages/Expenses';
import { IncomePage } from '../pages/Income';
import { Budgets } from '../pages/Budgets';
import { Goals } from '../pages/Goals';
import { Subscriptions } from '../pages/Subscriptions';
import { Bills } from '../pages/Bills';
import { Analytics } from '../pages/Analytics';
import { AICopilot } from '../pages/AI';
import { Settings } from '../pages/Settings';
import { QRScanner } from '../pages/QR';
import { AdminPortal } from '../pages/Admin';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loginState, accountStatus, cancelAccountDeletion } = useAuth();
  const location = useLocation();

  // If restoring session, show loading gate
  if (loginState === 'checking_session') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c] text-white">
        <div className="flex flex-col items-center gap-4">
          <img src="/moneypilot_logo.jpg" alt="MoneyPilot" className="w-12 h-12 rounded-xl animate-pulse" />
          <p className="text-caption text-gray-500 font-semibold uppercase tracking-wider">Loading System Database...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if user session is absent and auth process is not active
  if (!user && loginState !== 'complete') {
    return <Navigate to="/login" replace />;
  }

  // Enforce admin-only route restriction
  const isAdmin = user?.email?.toLowerCase() === 'iniansarathi2003@gmail.com';
  if (isAdmin && location.pathname !== '/admin') {
    return <Navigate to="/admin" replace />;
  }

  // Intercept routing if account deletion is requested
  if (accountStatus === 'delete_requested') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0c] p-6 text-center">
        <div className="max-w-md w-full glass-panel p-8 rounded-3xl space-y-6 border border-red-500/20 bg-gradient-to-b from-red-950/10 to-transparent">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-title font-extrabold text-white">Account Deletion Requested</h2>
            <p className="text-body text-gray-400 leading-relaxed">
              Your profile is scheduled for deletion. The system administrator must approve this request before your files are permanently purged.
            </p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-2xl text-[12px] text-gray-500 font-semibold space-y-1">
            <p className="text-blue-400">Status: Waiting for Admin Approval</p>
            <p>This page will update automatically. Do not close this browser window.</p>
          </div>

          <button
            onClick={() => cancelAccountDeletion()}
            className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-caption cursor-pointer transition-all active:scale-95"
          >
            Cancel Deletion Request
          </button>
        </div>
      </div>
    );
  }

  return <Shell>{children}</Shell>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute>
            <Expenses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/income"
        element={
          <ProtectedRoute>
            <IncomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/budgets"
        element={
          <ProtectedRoute>
            <Budgets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/goals"
        element={
          <ProtectedRoute>
            <Goals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscriptions"
        element={
          <ProtectedRoute>
            <Subscriptions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bills"
        element={
          <ProtectedRoute>
            <Bills />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai"
        element={
          <ProtectedRoute>
            <AICopilot />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/qr"
        element={
          <ProtectedRoute>
            <QRScanner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPortal />
          </ProtectedRoute>
        }
      />

      {/* Fallback routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
