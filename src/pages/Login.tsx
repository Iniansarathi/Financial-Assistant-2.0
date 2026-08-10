import React, { useEffect, useState } from 'react';
import { useAuth, type LoginState } from '../services/auth/authProvider';
import { useTheme } from '../app/providers';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  RefreshCw,
  LogIn,
  Lock,
  ShieldCheck,
  Database,
  FileText,
  Sun,
  Moon,
} from 'lucide-react';

const APP_VERSION = "v1.2.0";

const STATE_MESSAGES: Record<LoginState, { title: string; subtitle: string; icon: any }> = {
  idle: {
    title: 'Welcome to MoneyPilot',
    subtitle: 'Your Personal Financial Operating System. Secure, private, and owned entirely by you.',
    icon: LogIn,
  },
  checking_session: {
    title: 'Restoring Session',
    subtitle: 'Checking for active local authorization key...',
    icon: RefreshCw,
  },
  authenticating: {
    title: 'Connecting Google',
    subtitle: 'Authenticating credentials with Google Identity Services...',
    icon: Lock,
  },
  waiting_for_permission: {
    title: 'Authorizing Storage',
    subtitle: 'Requesting permission to access your private application drive...',
    icon: ShieldCheck,
  },
  searching_database: {
    title: 'Finding Cloud File',
    subtitle: 'Locating MoneyPilotData.json inside your Google Drive...',
    icon: Database,
  },
  downloading: {
    title: 'Downloading Database',
    subtitle: 'Downloading cloud financial records securely...',
    icon: RefreshCw,
  },
  merging: {
    title: 'Reconciling Ledger',
    subtitle: 'Merging cloud transactions with local device database...',
    icon: Database,
  },
  syncing: {
    title: 'Pushing Initial State',
    subtitle: 'Updating Google Drive database version...',
    icon: RefreshCw,
  },
  permission_denied: {
    title: 'Drive Permission Required',
    subtitle: 'MoneyPilot stores your database inside your own Google Drive. Without this permission, sync is disabled.',
    icon: ShieldAlert,
  },
  terms_pending: {
    title: 'Terms of Service',
    subtitle: 'Please agree to the terms to complete your account registration.',
    icon: FileText,
  },
  complete: {
    title: 'Synchronized',
    subtitle: 'Opening your dashboard...',
    icon: ShieldCheck,
  },
};

export const Login: React.FC = () => {
  const { loginState, login, grantDrivePermission, acceptTermsAndRegister } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // State to hold checkbox agreement
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (loginState === 'complete') {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [loginState, navigate]);

  const stateInfo = STATE_MESSAGES[loginState] || STATE_MESSAGES.idle;
  const CurrentIcon = stateInfo.icon;

  const isProgressState =
    loginState !== 'idle' &&
    loginState !== 'permission_denied' &&
    loginState !== 'terms_pending' &&
    loginState !== 'complete';

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden bg-slate-50 dark:bg-[#0b0b0c] transition-colors duration-300 py-8 px-4">
      
      {/* 1. Top Navigation Bar */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <img
            src="/moneypilot_logo.jpg"
            alt="MoneyPilot Logo"
            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-white/10 object-cover"
          />
          <h2 className="text-caption font-black text-slate-800 dark:text-white uppercase tracking-wider">
            MoneyPilot
          </h2>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95 shadow-sm"
          aria-label="Toggle visual theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>
      </header>

      {/* Dynamic Background Blurs */}
      <div className="absolute top-[15%] left-[5%] w-[40vw] h-[40vw] rounded-full bg-blue-600/5 dark:bg-blue-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[15%] right-[5%] w-[40vw] h-[40vw] rounded-full bg-cyan-600/5 dark:bg-cyan-600/10 blur-[100px] pointer-events-none" />

      {/* 2. Main Login Card Container */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-white/70 dark:bg-[#121214]/40 border border-slate-200 dark:border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-md shadow-2xl"
      >
        <div className="flex flex-col items-center text-center">
          
          {/* Logo container */}
          {loginState !== 'terms_pending' && (
            <div className="w-20 h-20 mb-6 rounded-2xl overflow-hidden bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center p-1 shadow-2xl">
              <img src="/moneypilot_logo.jpg" alt="MoneyPilot Logo" className="w-full h-full object-cover rounded-xl" />
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={loginState}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center w-full min-h-[160px] justify-center"
            >
              {loginState !== 'terms_pending' ? (
                <>
                  <div className="p-4 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 mb-4">
                    <CurrentIcon className={`w-8 h-8 text-blue-500 dark:text-blue-400 ${isProgressState ? 'animate-spin' : ''}`} />
                  </div>
                  <h2 className="text-title font-extrabold text-slate-800 dark:text-white mb-2">{stateInfo.title}</h2>
                  <p className="text-body text-gray-500 dark:text-gray-400 max-w-sm mb-6 leading-relaxed">{stateInfo.subtitle}</p>
                </>
              ) : (
                /* 3. New User Terms & Conditions View */
                <div className="flex flex-col items-center w-full justify-center text-left space-y-4">
                  <div className="p-3.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-1 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h2 className="text-title font-extrabold text-slate-900 dark:text-white text-center w-full leading-none">User Registration Agreement</h2>
                  <p className="text-micro text-gray-500 leading-relaxed text-center">
                    Welcome to MoneyPilot! Since this is your first time logging in, please review and accept our Privacy Guidelines to complete registration.
                  </p>

                  {/* Scrollable Terms Text Box */}
                  <div className="w-full h-28 p-3 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/5 rounded-2xl overflow-y-auto text-[10px] text-gray-500 dark:text-gray-400 space-y-2 leading-relaxed scrollbar-thin">
                    <p className="font-bold text-slate-900 dark:text-white">1. Self-Custody & Privacy First</p>
                    <p>All your transactions, goals, and savings items are stored directly in your local browser IndexedDB and synced to your private Google Drive file. MoneyPilot never sends your private data to external host servers.</p>
                    <p className="font-bold text-slate-900 dark:text-white">2. Storage Permissions Scoping</p>
                    <p>MoneyPilot requests access to Google Drive strictly under the limited drive.file scope. The app can only access and edit files it creates.</p>
                    <p className="font-bold text-slate-900 dark:text-white">3. Admin Telemetry Registry</p>
                    <p>Your name, email, country, and currency choice are registered inside a secure Sheets registry to monitor active logins and facilitate account deletions.</p>
                  </div>

                  {/* Agreement checkbox */}
                  <label className="flex items-start gap-2.5 cursor-pointer select-none py-1.5 w-full">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-blue-600 dark:text-blue-500 mt-0.5 cursor-pointer"
                    />
                    <span className="text-micro text-slate-600 dark:text-gray-400 font-semibold leading-normal">
                      I agree to the Terms of Service, Privacy Policy, and administrator login registration.
                    </span>
                  </label>

                  {/* Accept Trigger Button */}
                  <button
                    type="button"
                    onClick={acceptTermsAndRegister}
                    disabled={!agreedToTerms}
                    className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-caption active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-center flex items-center justify-center shadow-lg shadow-blue-600/10"
                  >
                    Agree & Proceed to OS
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Action buttons based on login state */}
          <div className="w-full mt-4">
            {loginState === 'idle' && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={login}
                  className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white hover:bg-opacity-90 active:scale-95 font-bold px-6 py-4 rounded-2xl shadow-xl transition-all duration-300 cursor-pointer"
                >
                  <LogIn className="w-5 h-5" />
                  Sign in with Google
                </button>
              </div>
            )}

            {loginState === 'permission_denied' && (
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={grantDrivePermission}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-500 active:scale-95 font-semibold px-6 py-4 rounded-2xl shadow-lg transition-all duration-300 cursor-pointer"
                >
                  <Lock className="w-5 h-5" />
                  Grant Permission
                </button>
                <button
                  onClick={login}
                  className="w-full text-caption text-gray-500 hover:text-slate-800 dark:hover:text-white transition-colors duration-200 cursor-pointer font-bold"
                >
                  Try Different Account
                </button>
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/3 text-left border border-slate-200 dark:border-white/5">
                  <div className="flex gap-2 items-start mb-2">
                    <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5" />
                    <p className="text-micro font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Least Privilege policy</p>
                  </div>
                  <p className="text-micro text-gray-500 dark:text-gray-400 leading-normal">
                    We only access the file created by this app. Your personal files, photos, and emails remain 100% private.
                  </p>
                </div>
              </div>
            )}

            {isProgressState && (
              <div className="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden border border-slate-200 dark:border-white/5">
                <motion.div
                  className="h-full bg-blue-600 dark:bg-blue-500 rounded-full animate-pulse"
                  initial={{ width: '0%' }}
                  animate={{
                    width:
                      loginState === 'checking_session'
                        ? '15%'
                        : loginState === 'authenticating'
                        ? '30%'
                        : loginState === 'waiting_for_permission'
                        ? '50%'
                        : loginState === 'searching_database'
                        ? '70%'
                        : loginState === 'downloading'
                        ? '85%'
                        : '95%',
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* 4. Version name footer */}
      <footer className="z-10 mt-6">
        <span className="text-[10px] text-gray-400 dark:text-gray-600 font-extrabold uppercase tracking-widest">
          MoneyPilot {APP_VERSION}
        </span>
      </footer>
    </div>
  );
};
