import React, { useEffect } from 'react';
import { useAuth, type LoginState } from '../services/auth/authProvider';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, RefreshCw, LogIn, Lock, ShieldCheck, Database, FileText } from 'lucide-react';

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
  complete: {
    title: 'Synchronized',
    subtitle: 'Opening your dashboard...',
    icon: ShieldCheck,
  },
};

export const Login: React.FC = () => {
  const { loginState, login, grantDrivePermission, sandboxLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loginState === 'complete') {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 1200); // 1.2s delay to show the synchronized status checkmark
      return () => clearTimeout(timer);
    }
  }, [loginState, navigate]);

  const stateInfo = STATE_MESSAGES[loginState] || STATE_MESSAGES.idle;
  const CurrentIcon = stateInfo.icon;

  const isProgressState =
    loginState !== 'idle' &&
    loginState !== 'permission_denied' &&
    loginState !== 'complete';

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0b0b0c] px-4">
      {/* Dynamic Background Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/10 blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-600/10 blur-[120px] animate-pulse-slow" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md glass-panel p-8 rounded-3xl"
      >
        <div className="flex flex-col items-center text-center">
          {/* Logo container */}
          <div className="w-20 h-20 mb-6 rounded-2xl overflow-hidden glass-card flex items-center justify-center p-1 border-white/10 shadow-2xl">
            <img src="/moneypilot_logo.jpg" alt="MoneyPilot Logo" className="w-full h-full object-cover rounded-xl" />
          </div>

          <h1 className="text-display font-bold tracking-tight text-white mb-2">
            MoneyPilot
          </h1>
          <p className="text-caption text-gray-400 uppercase tracking-widest font-semibold mb-8">
            Financial Operating System
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={loginState}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center w-full min-h-[160px] justify-center"
            >
              <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4">
                <CurrentIcon className={`w-8 h-8 text-blue-400 ${isProgressState ? 'animate-spin' : ''}`} />
              </div>
              <h2 className="text-title font-semibold text-white mb-2">{stateInfo.title}</h2>
              <p className="text-body text-gray-400 max-w-sm mb-6 leading-relaxed">{stateInfo.subtitle}</p>
            </motion.div>
          </AnimatePresence>

          {/* Action buttons based on login state */}
          <div className="w-full mt-4">
            {loginState === 'idle' && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={login}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black hover:bg-white/90 active:scale-95 font-medium px-6 py-4 rounded-2xl shadow-xl transition-all duration-300 cursor-pointer"
                >
                  <LogIn className="w-5 h-5" />
                  Sign in with Google
                </button>
                <button
                  onClick={sandboxLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/20 active:scale-95 font-medium px-6 py-4 rounded-2xl text-gray-300 hover:text-white transition-all duration-300 cursor-pointer"
                >
                  Continue in Sandbox Mode
                </button>
              </div>
            )}

            {loginState === 'permission_denied' && (
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={grantDrivePermission}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-500 active:scale-95 font-medium px-6 py-4 rounded-2xl shadow-lg transition-all duration-300 cursor-pointer"
                >
                  <Lock className="w-5 h-5" />
                  Grant Permission
                </button>
                <button
                  onClick={login}
                  className="w-full text-caption text-gray-400 hover:text-white transition-colors duration-200 cursor-pointer"
                >
                  Try Different Account
                </button>
                <div className="mt-4 p-4 rounded-2xl bg-white/5 text-left border border-white/5">
                  <div className="flex gap-2 items-start mb-2">
                    <FileText className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-micro font-semibold text-white uppercase">Least Privilege policy</p>
                  </div>
                  <p className="text-micro text-gray-400 leading-normal">
                    We only access the file created by this app. Your personal files, photos, and emails remain 100% private.
                  </p>
                </div>
              </div>
            )}

            {isProgressState && (
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
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
    </div>
  );
};
