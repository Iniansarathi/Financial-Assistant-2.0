import React, { createContext, useContext, useState, useEffect } from 'react';
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
          
          // Attempt session recovery (stay offline if token unavailable)
          const savedToken = sessionStorage.getItem('mp_access_token');
          if (savedToken) {
            driveService.setToken(savedToken);
            setLoginState('complete');
            setSyncState('synced');
            // Background sync
            triggerSyncBackground();
          } else {
            // User exists in IndexedDB, allow using app offline
            setLocalOnlyMode(true);
            setLoginState('complete');
            setSyncState('pending');
          }
        } else {
          setLoginState('idle');
        }
      } catch (err) {
        console.error('Failed to initialize local session:', err);
        setLoginState('idle');
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
              sessionStorage.setItem('mp_access_token', tokenResponse.access_token);
              driveService.setToken(tokenResponse.access_token);
              
              // Load user info and sync
              await fetchUserProfileAndSync(tokenResponse.access_token);
            },
          });
          setTokenClient(client);
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
    tokenClient.requestAccessToken();
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
      reportUserLoginToAdminSheet(sandboxUser);
    } catch (err) {
      console.error('Failed sandbox login:', err);
      setLoginState('idle');
    }
  };

  const logout = async () => {
    // Revoke token if available
    const savedToken = sessionStorage.getItem('mp_access_token');
    const google = (window as any).google;
    if (savedToken && google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(savedToken, () => {});
    }

    // Clear session storage and auth state
    sessionStorage.removeItem('mp_access_token');
    setUser(null);
    setLoginState('idle');
    setSyncState('pending');

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

  const triggerSync = async () => {
    if (localOnlyMode || !driveService.hasToken()) {
      setSyncState('error');
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
