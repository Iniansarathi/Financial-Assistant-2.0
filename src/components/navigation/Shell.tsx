import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth/authProvider';
import { useTheme } from '../../app/providers';
import { FeedbackModal } from '../ui/FeedbackModal';
import { fetchUnreadNotifications, markNotificationAsRead } from '../../services/feedbackService';
import {
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  PieChart,
  Calendar,
  Settings as SettingsIcon,
  BrainCircuit,
  LogOut,
  Cloud,
  Zap,
  Sparkles,
  Users,
  ShoppingBag,
  MessageSquare,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';

interface ShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/expenses', label: 'Expenses', icon: TrendingDown },
  { path: '/income', label: 'Income', icon: TrendingUp },
  { path: '/budgets', label: 'Budgets & Bills', icon: PieChart },
  { path: '/wishlist', label: 'Wishlist Guard', icon: ShoppingBag },
  { path: '/calendar', label: 'Cashflow Calendar', icon: Calendar },
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
  const isAdmin = user?.email?.toLowerCase() === 'iniansarathi2003@gmail.com';
  const navigate = useNavigate();

  // PWA Update State
  const [showUpdate, setShowUpdate] = useState(false);
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  // Theme support
  const { theme, toggleTheme } = useTheme();

  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Support Responses state
  const [activeNotification, setActiveNotification] = useState<any>(null);

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallOverlay, setShowInstallOverlay] = useState(false);

  // Listen to PWA install event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Verify if they skipped in localStorage or run standalone
      const isSkipped = localStorage.getItem('mp_pwa_prompt_skipped') === 'true';
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

      if (!isSkipped && !isStandalone && user && !isAdmin) {
        setShowInstallOverlay(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [user, isAdmin]);

  // Initial mount PWA overlay trigger for browsers that do not support beforeinstallprompt (e.g. iOS Safari)
  useEffect(() => {
    const isSkipped = localStorage.getItem('mp_pwa_prompt_skipped') === 'true';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

    if (!isSkipped && !isStandalone && user && !isAdmin) {
      setShowInstallOverlay(true);
    }
  }, [user, isAdmin]);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallOverlay(false);
      }
      setDeferredPrompt(null);
    } else {
      // Direct instruction fallback for iOS Safari and other browsers
      alert("To add MoneyPilot OS to your Home Screen: \n\n• On iOS Safari: Tap the Share button (square with arrow pointing up) at the bottom or top of your screen, scroll down, and select 'Add to Home Screen'.\n\n• On Chrome / Android: Tap the three-dot menu icon in the upper-right corner of your browser and select 'Install app' or 'Add to Home screen'.");
    }
  };

  const handleSkipInstall = () => {
    localStorage.setItem('mp_pwa_prompt_skipped', 'true');
    setShowInstallOverlay(false);
  };

  // Support responses startup checker
  const checkSupportReplies = async () => {
    if (!user?.email || isAdmin) return;
    try {
      const list = await fetchUnreadNotifications(user.email);
      if (list && list.length > 0) {
        setActiveNotification(list[0]);
      }
    } catch (e) {
      console.error('Error fetching support responses:', e);
    }
  };

  useEffect(() => {
    if (user && !isAdmin) {
      checkSupportReplies();
      // Check every 5 minutes
      const interval = setInterval(checkSupportReplies, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin]);

  const handleDismissNotification = async () => {
    if (!user?.email || !activeNotification) return;
    try {
      await markNotificationAsRead(user.email, activeNotification.timestamp);
      setActiveNotification(null);
      checkSupportReplies();
    } catch (e) {
      console.error('Failed to dismiss support response:', e);
      setActiveNotification(null);
    }
  };

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ServiceWorkerRegistration>;
      setSwReg(customEvent.detail);
      setShowUpdate(true);
    };
    window.addEventListener('sw-update-available', handleUpdate);
    return () => window.removeEventListener('sw-update-available', handleUpdate);
  }, []);

  // Dynamically update PWA manifest, Apple touch icon, meta tags, and page title for admin
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const appleIconLink = document.querySelector('link[rel="apple-touch-icon"]');
    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');

    if (manifestLink) {
      manifestLink.setAttribute('href', isAdmin ? '/admin_manifest.json' : '/manifest.json');
    }
    if (appleIconLink) {
      appleIconLink.setAttribute('href', isAdmin ? '/admin_logo.jpg' : '/apple-touch-icon.png');
    }
    if (appleTitleMeta) {
      appleTitleMeta.setAttribute('content', isAdmin ? 'Admin Portal' : 'MoneyPilot');
    }
    document.title = isAdmin ? "Admin Portal - MoneyPilot" : "MoneyPilot - Finance OS";
  }, [isAdmin]);

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
        <div className="flex items-center gap-3 mb-8 px-2 cursor-pointer" onClick={() => navigate(isAdmin ? '/admin' : '/')}>
          <img src={isAdmin ? "/admin_logo.jpg" : "/moneypilot_logo.jpg"} alt="Logo" className="w-9 h-9 rounded-xl border border-white/10 object-cover" />
          <div>
            <h2 className="text-body font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
              {isAdmin ? "Admin Portal" : "MoneyPilot"}
            </h2>
            <span className="text-micro text-gray-500 tracking-wider font-semibold uppercase">
              {isAdmin ? "Control Center" : "Finance OS"}
            </span>
          </div>
        </div>

        {/* Sync Indicator */}
        {!isAdmin && (
          <button
            onClick={triggerSync}
            className="flex items-center justify-between mb-6 px-4 py-2.5 rounded-2xl glass-card text-micro cursor-pointer border-white/5 active:scale-98"
          >
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px] ${getSyncColor()}`} />
              <span className="font-medium text-slate-700 dark:text-gray-300">{getSyncLabel()}</span>
            </div>
            <Cloud className={`w-4 h-4 ${
              syncState === 'syncing' 
                ? 'animate-bounce text-blue-500' 
                : syncState === 'synced' 
                ? 'text-emerald-500' 
                : syncState === 'pending' 
                ? 'text-amber-500' 
                : 'text-red-500'
            }`} />
          </button>
        )}

        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {!isAdmin ? (
            NAV_ITEMS.map((item) => (
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
            ))
          ) : (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3 rounded-2xl text-body font-medium transition-all duration-200 border border-transparent hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-white/5 text-blue-400 hover:text-blue-300 ${
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
        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5 space-y-4">
          {user && (
            <div className="space-y-3">
              {/* User Profile Card */}
              <div className="flex items-center gap-3 px-2">
                <img
                  src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 bg-white/5 object-cover"
                />
                <div className="text-left overflow-hidden">
                  <p className="text-caption font-bold text-slate-900 dark:text-white truncate max-w-[140px]">{user.displayName}</p>
                  <p className="text-micro text-gray-500 truncate max-w-[140px]">{user.email}</p>
                </div>
              </div>

              {/* Sidebar Action Buttons Grid */}
              {!isAdmin ? (
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <button
                    onClick={() => navigate('/settings')}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                    title="Settings"
                  >
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                    title="Toggle Theme"
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                  </button>
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                    title="Submit Feedback"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-red-500/10 border border-red-500/10 text-red-500 hover:bg-red-500/20 transition-all cursor-pointer active:scale-95"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                    title="Toggle Theme"
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-red-500/10 border border-red-500/10 text-red-500 hover:bg-red-500/20 transition-all cursor-pointer active:scale-95"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 2. Mobile Floating Bottom Navigation & Header */}
      <div className="md:hidden flex flex-row w-full h-[60px] glass-panel border-b border-slate-200 dark:border-white/5 px-4 items-center justify-between shrink-0 sticky top-0 z-40 bg-white dark:bg-[#0b0b0c]/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          {/* Hamburger Menu Toggle */}
          <button
            onClick={() => setShowMobileDrawer(true)}
            className="p-1 rounded-lg text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white cursor-pointer active:scale-95 transition-transform"
            aria-label="Open navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate(isAdmin ? '/admin' : '/')}>
            <img src={isAdmin ? "/admin_logo.jpg" : "/moneypilot_logo.jpg"} alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-white/10" />
            <h2 className="text-caption font-extrabold tracking-tight text-slate-900 dark:text-white">
              {isAdmin ? "Admin" : "MoneyPilot"}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isAdmin && (
            /* Mobile Sync Indicator */
            <button onClick={triggerSync} className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-gray-400 hover:text-white" aria-label="Sync Database">
              <Cloud className={`w-4 h-4 ${
                syncState === 'syncing' 
                  ? 'animate-bounce text-blue-500' 
                  : syncState === 'synced' 
                  ? 'text-emerald-500' 
                  : 'text-amber-500'
              }`} />
            </button>
          )}
          
          {/* User Profile avatar opens the menu drawer */}
          {user && (
            <button
              onClick={() => setShowMobileDrawer(true)}
              className="w-8 h-8 rounded-full border border-slate-200 dark:border-white/15 overflow-hidden flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
              aria-label="Open user profile drawer"
            >
              <img
                src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Pane */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-full pb-28 md:pb-10">
        {children}
      </main>

      {/* Floating Bottom Navigation Bar (Mobile only) */}
      {!isAdmin && (
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
      )}

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

      {/* 2.5 Collapsible Mobile Navigation Drawer Drawer */}
      {showMobileDrawer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setShowMobileDrawer(false)}
          />

          {/* Drawer Sidebar Menu */}
          <aside className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-[#0b0b0c] p-6 border-r border-slate-200 dark:border-white/5 z-50 flex flex-col md:hidden text-left shadow-2xl">
            {/* Header Brand Info */}
            <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setShowMobileDrawer(false); navigate(isAdmin ? '/admin' : '/'); }}>
                <img src={isAdmin ? "/admin_logo.jpg" : "/moneypilot_logo.jpg"} alt="Logo" className="w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 object-cover" />
                <div>
                  <h2 className="text-body font-bold tracking-tight text-slate-900 dark:text-white">
                    {isAdmin ? "Admin Portal" : "MoneyPilot"}
                  </h2>
                  <span className="text-micro text-gray-500 tracking-wider font-semibold uppercase">
                    {isAdmin ? "Control Center" : "Finance OS"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMobileDrawer(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-gray-500 hover:text-slate-800 dark:hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sync Indicator (Drawer version) */}
            {!isAdmin && (
              <button
                onClick={() => { triggerSync(); setShowMobileDrawer(false); }}
                className="flex items-center justify-between mb-6 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-micro cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px] ${getSyncColor()}`} />
                  <span className="font-medium text-slate-700 dark:text-gray-300">{getSyncLabel()}</span>
                </div>
                <Cloud className={`w-4 h-4 ${
                  syncState === 'syncing' 
                    ? 'animate-bounce text-blue-500' 
                    : syncState === 'synced' 
                    ? 'text-emerald-500' 
                    : 'text-amber-500'
                }`} />
              </button>
            )}

            {/* Navigation Options list */}
            <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {!isAdmin ? (
                <>
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setShowMobileDrawer(false)}
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
                  {/* Additional mobile links from dropdown */}
                  <NavLink
                    to="/wishlist"
                    onClick={() => setShowMobileDrawer(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3.5 px-4 py-3 rounded-2xl text-body font-medium transition-all duration-200 border border-transparent hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-white/5 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white ${
                        isActive ? 'nav-active' : ''
                      }`
                    }
                  >
                    <ShoppingBag className="w-5 h-5" />
                    Wishlist Guard
                  </NavLink>
                  <NavLink
                    to="/calendar"
                    onClick={() => setShowMobileDrawer(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3.5 px-4 py-3 rounded-2xl text-body font-medium transition-all duration-200 border border-transparent hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-white/5 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white ${
                        isActive ? 'nav-active' : ''
                      }`
                    }
                  >
                    <Calendar className="w-5 h-5" />
                    Cashflow Calendar
                  </NavLink>
                </>
              ) : (
                <NavLink
                  to="/admin"
                  onClick={() => setShowMobileDrawer(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-3 rounded-2xl text-body font-medium transition-all duration-200 border border-transparent hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-white/5 text-blue-400 hover:text-blue-300 ${
                      isActive ? 'nav-active' : ''
                    }`
                  }
                >
                  <Users className="w-5 h-5" />
                  Admin Portal
                </NavLink>
              )}
            </nav>

            {/* Sidebar Action Buttons Footer */}
            <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5 space-y-4">
              {user && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-2">
                    <img
                      src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 bg-white/5 object-cover"
                    />
                    <div className="text-left overflow-hidden">
                      <p className="text-caption font-bold text-slate-900 dark:text-white truncate max-w-[140px]">{user.displayName}</p>
                      <p className="text-micro text-gray-500 truncate max-w-[140px]">{user.email}</p>
                    </div>
                  </div>

                  {!isAdmin ? (
                    <div className="grid grid-cols-4 gap-2 pt-2">
                      <button
                        onClick={() => { setShowMobileDrawer(false); navigate('/settings'); }}
                        className="flex items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                        title="Settings"
                      >
                        <SettingsIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { toggleTheme(); setShowMobileDrawer(false); }}
                        className="flex items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                        title="Toggle Theme"
                      >
                        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                      </button>
                      <button
                        onClick={() => { setShowFeedbackModal(true); setShowMobileDrawer(false); }}
                        className="flex items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                        title="Submit Feedback"
                      >
                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                      </button>
                      <button
                        onClick={() => { handleLogout(); setShowMobileDrawer(false); }}
                        className="flex items-center justify-center p-2.5 rounded-xl bg-red-500/10 border border-red-500/10 text-red-500 hover:bg-red-500/20 transition-all cursor-pointer active:scale-95"
                        title="Logout"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => { toggleTheme(); setShowMobileDrawer(false); }}
                        className="flex items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                        title="Toggle Theme"
                      >
                        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                      </button>
                      <button
                        onClick={() => { handleLogout(); setShowMobileDrawer(false); }}
                        className="flex items-center justify-center p-2.5 rounded-xl bg-red-500/10 border border-red-500/10 text-red-500 hover:bg-red-500/20 transition-all cursor-pointer active:scale-95"
                        title="Logout"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* 4. Feedback Logger Modal Backdrop */}
      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}

      {/* 5. Support Response Alerts Notification Dialog */}
      {activeNotification && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 rounded-3xl space-y-5 text-left shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-caption font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Support Response</h3>
                <span className="text-[9px] text-gray-500">From MoneyPilot Admin Team</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-caption text-slate-800 dark:text-gray-200 font-semibold leading-relaxed">
                {activeNotification.message}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/5 space-y-2">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Original Feedback</p>
                <p className="text-micro text-slate-600 dark:text-gray-400 italic">
                  "{activeNotification.originalFeedback}"
                </p>
                {activeNotification.originalScreenshot && activeNotification.originalScreenshot.startsWith('http') && (
                  <div className="mt-2 text-micro">
                    <a
                      href={activeNotification.originalScreenshot}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline inline-flex items-center gap-1 font-bold"
                    >
                      View attached screenshot
                    </a>
                  </div>
                )}
                <span className="block text-[9px] text-gray-500 mt-1">
                  Sent: {new Date(activeNotification.originalTimestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={handleDismissNotification}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-caption rounded-2xl cursor-pointer active:scale-95 transition-all shadow-md"
            >
              Mark as Read & Close
            </button>
          </div>
        </div>
      )}

      {/* 6. PWA Full-page Installation Prompt Overlay */}
      {showInstallOverlay && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-blue-500/10 blur-[100px] animate-gel pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-500/10 blur-[100px] animate-gel pointer-events-none" />

          <div className="max-w-md space-y-6 relative z-10">
            <img
              src="/moneypilot_logo.jpg"
              alt="MoneyPilot Logo"
              className="w-24 h-24 rounded-3xl mx-auto border-2 border-white/10 shadow-2xl animate-bounce"
            />
            <div className="space-y-2">
              <h2 className="text-heading font-black tracking-tight text-white">Install MoneyPilot OS</h2>
              <p className="text-body text-gray-400 max-w-sm mx-auto leading-relaxed">
                Add MoneyPilot to your Home Screen to unlock clean full-screen mode, native offline cache, and premium visual interfaces.
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <button
                onClick={handleInstallApp}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-caption active:scale-98 transition-all shadow-xl shadow-blue-600/30 cursor-pointer"
              >
                Add to Home Screen
              </button>
              <button
                onClick={handleSkipInstall}
                className="text-caption font-bold text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
            </div>
          </div>

          <div className="absolute bottom-6 right-6 z-20">
            <button
              onClick={handleSkipInstall}
              className="px-4 py-2.5 text-micro font-bold text-gray-500 hover:text-white bg-white/5 border border-white/5 rounded-xl cursor-pointer transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
