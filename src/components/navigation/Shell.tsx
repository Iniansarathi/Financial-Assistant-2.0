import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth/authProvider';
import { useTheme } from '../../app/providers';
import {
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  PieChart,
  Target,
  Clock,
  Calendar,
  Settings,
  BrainCircuit,
  LogOut,
  Moon,
  Sun,
  RefreshCw,
  Zap,
  Sparkles,
  Users,
} from 'lucide-react';

interface ShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/expenses', label: 'Expenses', icon: TrendingDown },
  { path: '/income', label: 'Income', icon: TrendingUp },
  { path: '/budgets', label: 'Budgets', icon: PieChart },
  { path: '/goals', label: 'Goals', icon: Target },
  { path: '/subscriptions', label: 'Subscriptions', icon: Clock },
  { path: '/bills', label: 'Bills', icon: Calendar },
  { path: '/analytics', label: 'Analytics', icon: Zap },
  { path: '/ai', label: 'Copilot AI', icon: BrainCircuit },
];

const MOBILE_NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/expenses', label: 'Expenses', icon: TrendingDown },
  { path: '/income', label: 'Income', icon: TrendingUp },
  { path: '/budgets', label: 'Budgets', icon: PieChart },
  { path: '/analytics', label: 'Analytics', icon: Zap },
];

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const { user, logout, syncState, triggerSync, localOnlyMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // PWA Update State
  const [showUpdate, setShowUpdate] = useState(false);
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ServiceWorkerRegistration>;
      setSwReg(customEvent.detail);
      setShowUpdate(true);
    };
    window.addEventListener('sw-update-available', handleUpdate);
    return () => window.removeEventListener('sw-update-available', handleUpdate);
  }, []);

  const handleUpdateApp = () => {
    if (swReg?.waiting) {
      swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdate(false);
    window.location.reload();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getSyncColor = () => {
    switch (syncState) {
      case 'synced':
        return 'bg-emerald-500 shadow-emerald-500/50';
      case 'syncing':
        return 'bg-blue-500 shadow-blue-500/50 animate-pulse';
      case 'pending':
        return 'bg-amber-500 shadow-amber-500/50';
      case 'error':
        return 'bg-red-500 shadow-red-500/50';
      default:
        return 'bg-gray-500';
    }
  };

  const getSyncLabel = () => {
    switch (syncState) {
      case 'synced':
        return 'Cloud Synced';
      case 'syncing':
        return 'Syncing...';
      case 'pending':
        return localOnlyMode ? 'Offline Mode' : 'Sync Pending';
      case 'error':
        return 'Sync Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white dark:bg-[#0b0b0c] text-slate-900 dark:text-white selection:bg-blue-500 selection:text-white transition-colors duration-300">
      
      {/* 1. Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 min-h-screen glass-panel p-6 border-r border-white/5 shrink-0">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 mb-8 px-2 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/moneypilot_logo.jpg" alt="Logo" className="w-9 h-9 rounded-xl border border-white/10" />
          <div>
            <h2 className="text-body font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">MoneyPilot</h2>
            <span className="text-micro text-gray-500 tracking-wider font-semibold uppercase">Finance OS</span>
          </div>
        </div>

        {/* Sync Indicator */}
        <button
          onClick={triggerSync}
          className="flex items-center justify-between mb-6 px-4 py-2.5 rounded-2xl glass-card text-micro cursor-pointer border-white/5 active:scale-98"
        >
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px] ${getSyncColor()}`} />
            <span className="font-medium text-slate-700 dark:text-gray-300">{getSyncLabel()}</span>
          </div>
          <RefreshCw className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
        </button>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3 rounded-2xl text-body font-medium transition-all duration-200 border border-transparent hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-white/5 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white ${
                  isActive ? 'nav-active' : ''
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
          {user?.email === 'iniansarathi2003@gmail.com' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3 rounded-2xl text-body font-medium transition-all duration-200 border border-transparent hover:bg-white/5 hover:border-white/5 text-blue-400 hover:text-blue-300 ${
                  isActive ? 'nav-active' : ''
                }`
              }
            >
              <Users className="w-5 h-5" />
              Admin Portal
            </NavLink>
          )}
        </nav>

        {/* Footer controls & user session */}
        <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
          <div className="flex items-center justify-between px-2">
            {/* User Profile Card */}
            {user && (
              <div className="flex items-center gap-3">
                <img
                  src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full border border-white/10 bg-white/5 object-cover"
                />
                <div className="text-left">
                  <p className="text-caption font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{user.displayName}</p>
                  <p className="text-micro text-gray-500 truncate max-w-[120px]">{user.email}</p>
                </div>
              </div>
            )}
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl glass-card border-white/5 text-gray-400 hover:text-white cursor-pointer hover:bg-white/5 active:scale-95"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-500/10 dark:bg-red-950/20 border border-red-200 dark:border-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-900/30 font-medium text-caption cursor-pointer transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Logout Session
          </button>
        </div>
      </aside>

      {/* 2. Mobile Floating Bottom Navigation & Header */}
      <div className="md:hidden flex flex-col w-full h-[60px] glass-panel border-b border-white/5 px-4 items-center justify-between flex-row shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <img src="/moneypilot_logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg" />
          <h2 className="text-caption font-bold tracking-tight">MoneyPilot</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile Sync Indicator */}
          <button onClick={triggerSync} className="p-2 rounded-lg glass-card border-white/5" aria-label="Sync Database">
            <span className={`inline-block w-2.5 h-2.5 rounded-full shadow-[0_0_8px] ${getSyncColor()}`} />
          </button>

          {/* Theme Toggle */}
          <button onClick={toggleTheme} className="p-2 rounded-lg glass-card border-white/5">
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
          </button>
          
          {/* Settings Trigger for Mobile */}
          <button onClick={() => navigate('/settings')} className="p-2 rounded-lg glass-card border-white/5 text-gray-400 hover:text-white" aria-label="Settings">
            <Settings className="w-4 h-4" />
          </button>
          
          {/* User Profile Dropdown Toggle */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="w-8 h-8 rounded-full border border-white/15 overflow-hidden flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                aria-label="User menu"
              >
                <img
                  src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              </button>
              
              {/* Mobile Dropdown Panel */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2.5 w-64 glass-panel p-4 rounded-2xl shadow-2xl border border-white/10 z-50 text-left">
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
                    <img
                      src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="overflow-hidden">
                      <p className="text-caption font-bold text-slate-900 dark:text-white truncate">{user.displayName}</p>
                      <p className="text-micro text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 dark:bg-red-950/20 border border-red-200 dark:border-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-900/30 font-medium text-caption cursor-pointer transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout Session
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Pane */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-full pb-28 md:pb-10">
        {children}
      </main>

      {/* Floating Bottom Navigation Bar (Mobile only) */}
      <nav className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md glass-panel px-4 py-2.5 rounded-2xl flex items-center justify-around shadow-2xl border-white/10">
        {MOBILE_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center p-2 rounded-xl text-micro font-medium transition-all ${
                isActive ? 'text-blue-600 dark:text-blue-400 bg-slate-100 dark:bg-white/5 scale-105' : 'text-gray-500'
              }`
            }
          >
            <item.icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* 3. PWA Update Notification Toast */}
      {showUpdate && (
        <div className="fixed bottom-24 right-5 md:bottom-10 md:right-10 z-50 w-full max-w-sm px-4 md:px-0">
          <div className="glass-panel p-5 rounded-2xl border-blue-500/20 shadow-2xl flex items-center justify-between gap-4">
            <div className="flex gap-3 items-center text-left">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-caption font-bold text-white">System Update Ready</p>
                <p className="text-micro text-gray-400">A new version of MoneyPilot is available.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUpdate(false)}
                className="px-3 py-2 rounded-xl text-micro font-bold text-gray-400 hover:text-white cursor-pointer"
              >
                Later
              </button>
              <button
                onClick={handleUpdateApp}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-micro cursor-pointer transition-all active:scale-95"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
