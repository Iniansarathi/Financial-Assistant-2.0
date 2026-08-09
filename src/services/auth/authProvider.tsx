import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, type UserSession, seedDatabase } from '../../storage/indexeddb';
import { driveService } from '../drive/driveService';
import { mergeCloudDatabase, exportLocalDatabase } from '../../storage/mergeEngine';

export type LoginState =
  | 'idle'
  | 'checking_session'
  | 'authenticating'
  | 'waiting_for_permission'
  | 'searching_database'
  | 'downloading'
  | 'merging'
  | 'syncing'
  | 'permission_denied'
  | 'terms_pending'
  | 'complete';

interface AuthContextType {
  user: UserSession | null;
  loginState: LoginState;
  login: () => void;
  logout: () => Promise<void>;
  grantDrivePermission: () => void;
  syncState: 'synced' | 'syncing' | 'pending' | 'error';
  triggerSync: () => Promise<void>;
  localOnlyMode: boolean;
  setLocalOnlyMode: (val: boolean) => void;
  sandboxLogin: () => void;
  accountStatus: 'active' | 'delete_requested' | 'delete_approved' | 'checking';
  requestAccountDeletion: () => Promise<void>;
  cancelAccountDeletion: () => Promise<void>;
  acceptTermsAndRegister: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Read Client ID from env or fallback to a developer dummy client ID.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const reportUserLoginToAdminSheet = async (session: any) => {
  const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;
  if (!APPS_SCRIPT_URL) return;

  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: session.email,
        name: session.displayName,
        country: session.country,
        currency: session.currency,
        driveFileId: session.googleDriveFileId || 'local-sandbox',
        lastLogin: new Date().toISOString(),
        status: 'active',
      }),
    });
  } catch (err) {
    console.error('Failed to report login to sheet:', err);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loginState, setLoginState] = useState<LoginState>('checking_session');
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'pending' | 'error'>('pending');
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [localOnlyMode, setLocalOnlyMode] = useState<boolean>(false);
  const [accountStatus, setAccountStatus] = useState<'active' | 'delete_requested' | 'delete_approved' | 'checking'>('checking');
  const shouldAutoLoginRef = useRef<boolean>(false);
  const tempProfileRef = useRef<any>(null);

  // Trigger sync on internet connection restore
  useEffect(() => {
    const handleOnline = () => {
      db.users.toArray().then(users => {
        if (users.length > 0 && !users[0].email.endsWith('.local')) {
          triggerSync();
        }
      }).catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

  // Polling check for deletion status
  useEffect(() => {
    if (accountStatus !== 'delete_requested' || !user) return;

    const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;
    if (!APPS_SCRIPT_URL) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(APPS_SCRIPT_URL, { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json();
        const users = data.users || [];
        const matchingUser = users.find((u: any) => u.email === user.email);
        
        if (matchingUser && isSubscribed) {
          if (matchingUser.status === 'delete_approved') {
            clearInterval(interval);
            await wipeAndWipeAccount(user.email, user.googleDriveFileId);
          } else if (matchingUser.status === 'active') {
            setAccountStatus('active');
          }
        }
      } catch (err) {
        console.error('Polling check failed:', err);
      }
    }, 8000); // Check status every 8 seconds

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [accountStatus, user]);

  // Initialize GIS and restore session from IndexedDB
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Seed default categories
        await seedDatabase();

        // 1. Try to restore user profile from IndexedDB
        const users = await db.users.toArray();
        if (users.length > 0) {
          const restoredUser = users[0];
          setUser(restoredUser);
          
          // Attempt session recovery using localStorage
          const savedToken = localStorage.getItem('mp_access_token');
          const savedExpiry = localStorage.getItem('mp_token_expiry');
          const isTokenValid = savedToken && savedExpiry && Date.now() < parseInt(savedExpiry);

          if (isTokenValid) {
            driveService.setToken(savedToken);
            setLoginState('complete');
            setSyncState('synced');
            
            // Check status against admin sheets
            const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;
            if (APPS_SCRIPT_URL) {
              fetch(APPS_SCRIPT_URL)
                .then(res => res.json())
                .then(data => {
                  const usersList = data.users || [];
                  const matching = usersList.find((u: any) => u.email === restoredUser.email);
                  if (matching) {
                    if (matching.status === 'delete_approved') {
                      wipeAndWipeAccount(restoredUser.email, matching.driveFileId);
                    } else {
                      setAccountStatus(matching.status || 'active');
                    }
                  } else {
                    setAccountStatus('active');
                  }
                })
                .catch(() => setAccountStatus('active'));
            } else {
              setAccountStatus('active');
            }

            // Background sync
            triggerSyncBackground();
          } else {
            // Token expired or missing. If online, trigger auto-refresh!
            if (navigator.onLine && restoredUser && !restoredUser.email.endsWith('.local')) {
              shouldAutoLoginRef.current = true;
              setLoginState('authenticating');
              setSyncState('syncing');
            } else {
              // User exists in IndexedDB, allow using app offline
              setLocalOnlyMode(true);
              setLoginState('complete');
              setSyncState('pending');
              setAccountStatus('active');
            }
          }
        } else {
          setLoginState('idle');
          setAccountStatus('active');
        }
      } catch (err) {
        console.error('Failed to initialize local session:', err);
        setLoginState('idle');
        setAccountStatus('active');
      }

      // 2. Load Google Identity Services SDK token client
      const loadGis = () => {
        const google = (window as any).google;
        if (google?.accounts?.oauth2) {
          const client = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file email profile openid',
            callback: async (tokenResponse: any) => {
              if (tokenResponse.error) {
                console.error('GIS Error:', tokenResponse.error);
                setLoginState('idle');
                return;
              }

              // Verify drive.file scope was granted
              const hasDriveScope = google.accounts.oauth2.hasGrantedAllScopes(
                tokenResponse,
                'https://www.googleapis.com/auth/drive.file'
              );

              if (!hasDriveScope) {
                setLoginState('permission_denied');
                return;
              }

              setLoginState('waiting_for_permission');
              
              // Store token and calculate absolute expiry time
              localStorage.setItem('mp_access_token', tokenResponse.access_token);
              const expiry = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
              localStorage.setItem('mp_token_expiry', expiry.toString());

              driveService.setToken(tokenResponse.access_token);
              
              // Load user info and sync
              await fetchUserProfileAndSync(tokenResponse.access_token);
            },
          });
          setTokenClient(client);

          // Silent background auto-login trigger on app load if online
          if (shouldAutoLoginRef.current) {
            db.users.toArray().then(users => {
              if (users.length > 0 && !users[0].email.endsWith('.local')) {
                client.requestAccessToken({ login_hint: users[0].email });
              }
            }).catch(() => {});
            shouldAutoLoginRef.current = false;
          }
        } else {
          // Retry loading GIS SDK
          setTimeout(loadGis, 500);
        }
      };
      loadGis();
    };

    initializeAuth();
  }, []);

  const login = () => {
    if (!tokenClient) {
      alert('Google Auth SDK is still loading. Please try again in a few seconds.');
      return;
    }
    setLoginState('authenticating');
    
    // Provide a login hint to bypass account selection for returning users
    if (user && user.email && !user.email.endsWith('.local')) {
      tokenClient.requestAccessToken({ login_hint: user.email });
    } else {
      tokenClient.requestAccessToken();
    }
  };

  const grantDrivePermission = () => {
    if (tokenClient) {
      setLoginState('authenticating');
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  };

  const sandboxLogin = async () => {
    try {
      setLoginState('authenticating');
      
      const sandboxUser: UserSession = {
        id: 'sandbox-user',
        email: 'sandbox@moneypilot.local',
        displayName: 'Sandbox Investor',
        photoURL: '',
        currency: 'INR',
        country: 'IN',
        salaryDate: 1,
        theme: 'dark',
        language: 'en',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.users.put(sandboxUser);
      setUser(sandboxUser);
      setLocalOnlyMode(true);
      setLoginState('complete');
      setSyncState('pending');
      setAccountStatus('active');
      reportUserLoginToAdminSheet(sandboxUser);
    } catch (err) {
      console.error('Failed sandbox login:', err);
      setLoginState('idle');
    }
  };

  const logout = async () => {
    // Clear local storage and auth state
    localStorage.removeItem('mp_access_token');
    localStorage.removeItem('mp_token_expiry');
    setUser(null);
    setLoginState('idle');
    setSyncState('pending');
    setAccountStatus('active');

    // Remove user profile locally but keep financial transactions (as requested)
    await db.users.clear();
  };

  const fetchUserProfileAndSync = async (accessToken: string) => {
    let profile: any = null;
    try {
      setLoginState('searching_database');
      
      // Fetch user profile info using UserInfo API
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      profile = await userRes.json();

      // Immediately save profile locally so user is never left in a null state!
      const now = Date.now();
      const updatedUser: UserSession = {
        id: profile.sub,
        email: profile.email,
        displayName: profile.name,
        photoURL: profile.picture,
        currency: 'INR', // Default to INR (Rupees)
        country: 'IN',
        salaryDate: 1,
        theme: 'dark',
        language: 'en',
        createdAt: now,
        updatedAt: now,
      };

      await db.users.put(updatedUser);
      setUser(updatedUser);

      // Check status against Google Sheet first
      const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;
      if (APPS_SCRIPT_URL) {
        try {
          const res = await fetch(APPS_SCRIPT_URL);
          if (res.ok) {
            const data = await res.json();
            const usersList = data.users || [];
            const matching = usersList.find((u: any) => u.email?.toLowerCase() === profile.email?.toLowerCase());
            
            if (matching) {
              if (matching.status === 'delete_approved') {
                await wipeAndWipeAccount(profile.email, matching.driveFileId);
                return;
              } else {
                setAccountStatus(matching.status || 'active');
                if (matching.status === 'delete_requested') {
                  setLoginState('complete');
                  setLocalOnlyMode(false);
                  return;
                }
              }
            } else {
              // New user detected! Save details to prompt T&C acceptance
              tempProfileRef.current = { profile, updatedUser };
              setLoginState('terms_pending');
              return;
            }
          }
        } catch (err) {
          console.warn('Could not verify status on login:', err);
          setAccountStatus('active');
        }
      } else {
        setAccountStatus('active');
      }

      // Search Google Drive file
      let fileId = await driveService.findDatabaseFile();
      let dbContent = null;

      if (fileId) {
        setLoginState('downloading');
        dbContent = await driveService.downloadFile(fileId);
      }

      setLoginState('merging');

      updatedUser.googleDriveFileId = fileId || undefined;
      await db.users.put(updatedUser);

      if (dbContent) {
        // Bi-directional merge
        const mergedContent = await mergeCloudDatabase(dbContent);
        mergedContent.user = updatedUser;
        
        setLoginState('syncing');
        await driveService.updateDatabaseFile(fileId!, mergedContent);
      } else {
        // Create initial file
        const initialContent = await exportLocalDatabase();
        initialContent.user = updatedUser;
        
        setLoginState('syncing');
        fileId = await driveService.createDatabaseFile(initialContent);
        
        updatedUser.googleDriveFileId = fileId;
        await db.users.put(updatedUser);
        setUser(updatedUser);
      }

      setLoginState('complete');
      setSyncState('synced');
      setLocalOnlyMode(false);
      reportUserLoginToAdminSheet(updatedUser);
    } catch (err: any) {
      console.error('Sync login error:', err);
      if (err.message === 'UNAUTHORIZED') {
        setLoginState('idle');
      } else {
        // Fallback: If we fetched the profile, save it locally even if Drive fails
        if (profile) {
          const now = Date.now();
          const fallbackUser: UserSession = {
            id: profile.sub,
            email: profile.email,
            displayName: profile.name,
            photoURL: profile.picture,
            currency: 'INR', // Default to Rupees
            country: 'IN',
            salaryDate: 1,
            theme: 'dark',
            language: 'en',
            createdAt: now,
            updatedAt: now
          };
          await db.users.put(fallbackUser);
          setUser(fallbackUser);
          reportUserLoginToAdminSheet(fallbackUser);
        }
        setLocalOnlyMode(true);
        setLoginState('complete');
        setSyncState('error');
      }
    }
  };

  const wipeAndWipeAccount = async (email: string, fileId?: string) => {
    setSyncState('syncing');
    try {
      const targetFileId = fileId || user?.googleDriveFileId || await driveService.findDatabaseFile();
      if (targetFileId) {
        await driveService.deleteDatabaseFile(targetFileId);
      }
      
      await db.wallets.clear();
      await db.expenses.clear();
      await db.income.clear();
      await db.budgets.clear();
      await db.goals.clear();
      await db.subscriptions.clear();
      await db.bills.clear();
      await db.users.clear();

      const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;
      if (APPS_SCRIPT_URL) {
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'confirm_delete', email: email })
        });
      }

      localStorage.removeItem('mp_access_token');
      localStorage.removeItem('mp_token_expiry');
      setUser(null);
      setLoginState('idle');
      setSyncState('pending');
      setLocalOnlyMode(false);
      setAccountStatus('active');
      
      alert('Your account and Google Drive data have been permanently deleted.');
      window.location.reload();
    } catch (err) {
      console.error('Failed during account purge:', err);
      alert('Error purging data from Google Drive. Please verify internet and try again.');
    }
  };

  const requestAccountDeletion = async () => {
    if (!user) return;
    const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;
    if (!APPS_SCRIPT_URL) {
      alert('Admin registry API is not configured.');
      return;
    }

    try {
      setSyncState('syncing');
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_delete', email: user.email })
      });
      setAccountStatus('delete_requested');
    } catch (err) {
      console.error('Deletion request error:', err);
      alert('Failed to submit deletion request.');
    }
  };

  const acceptTermsAndRegister = async () => {
    if (!tempProfileRef.current) return;
    const { profile, updatedUser } = tempProfileRef.current;
    
    try {
      setLoginState('searching_database');
      
      // Search Google Drive file
      let fileId = await driveService.findDatabaseFile();
      let dbContent = null;

      if (fileId) {
        setLoginState('downloading');
        dbContent = await driveService.downloadFile(fileId);
      }

      setLoginState('merging');

      updatedUser.googleDriveFileId = fileId || undefined;
      await db.users.put(updatedUser);

      if (dbContent) {
        // Bi-directional merge
        const mergedContent = await mergeCloudDatabase(dbContent);
        mergedContent.user = updatedUser;
        
        setLoginState('syncing');
        await driveService.updateDatabaseFile(fileId!, mergedContent);
      } else {
        // Create initial file
        const initialContent = await exportLocalDatabase();
        initialContent.user = updatedUser;
        
        setLoginState('syncing');
        fileId = await driveService.createDatabaseFile(initialContent);
        
        updatedUser.googleDriveFileId = fileId;
        await db.users.put(updatedUser);
        setUser(updatedUser);
      }

      setLoginState('complete');
      setSyncState('synced');
      setLocalOnlyMode(false);
      reportUserLoginToAdminSheet(updatedUser);
      tempProfileRef.current = null;
    } catch (err: any) {
      console.error('Accept terms registration error:', err);
      // Fallback
      if (profile) {
        const now = Date.now();
        const fallbackUser: UserSession = {
          id: profile.sub,
          email: profile.email,
          displayName: profile.name,
          photoURL: profile.picture,
          currency: 'INR',
          country: 'IN',
          salaryDate: 1,
          theme: 'dark',
          language: 'en',
          createdAt: now,
          updatedAt: now
        };
        await db.users.put(fallbackUser);
        setUser(fallbackUser);
        reportUserLoginToAdminSheet(fallbackUser);
      }
      setLocalOnlyMode(true);
      setLoginState('complete');
      setSyncState('error');
      tempProfileRef.current = null;
    }
  };

  const cancelAccountDeletion = async () => {
    if (!user) return;
    const APPS_SCRIPT_URL = import.meta.env.VITE_ADMIN_API_URL;
    if (!APPS_SCRIPT_URL) return;

    try {
      setSyncState('syncing');
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: user.email, name: user.displayName })
      });
      setAccountStatus('active');
      setSyncState('synced');
    } catch (err) {
      console.error('Cancellation error:', err);
      alert('Failed to cancel deletion request.');
    }
  };

  const triggerSync = async () => {
    if (!driveService.hasToken()) {
      if (user && user.email && !user.email.endsWith('.local')) {
        login();
      } else {
        setSyncState('error');
      }
      return;
    }

    setSyncState('syncing');
    try {
      let fileId = user?.googleDriveFileId || await driveService.findDatabaseFile();
      
      if (!fileId) {
        // File got deleted or never created. Let's create it.
        const content = await exportLocalDatabase();
        fileId = await driveService.createDatabaseFile(content);
        if (user) {
          const updated = { ...user, googleDriveFileId: fileId, updatedAt: Date.now() };
          await db.users.put(updated);
          setUser(updated);
        }
      } else {
        const cloudData = await driveService.downloadFile(fileId);
        const mergedContent = await mergeCloudDatabase(cloudData);
        await driveService.updateDatabaseFile(fileId, mergedContent);
      }

      setSyncState('synced');
      setLocalOnlyMode(false);
    } catch (err) {
      console.error('Trigger sync error:', err);
      setSyncState('error');
    }
  };

  const triggerSyncBackground = () => {
    triggerSync().catch(console.error);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginState,
        login,
        logout,
        grantDrivePermission,
        syncState,
        triggerSync,
        localOnlyMode,
        setLocalOnlyMode,
        sandboxLogin,
        accountStatus,
        requestAccountDeletion,
        cancelAccountDeletion,
        acceptTermsAndRegister,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
