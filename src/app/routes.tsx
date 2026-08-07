import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
  const { user, loginState } = useAuth();

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
