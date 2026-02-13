/**
 * Nexora Authentication Service
 * Handles user authentication, session management, and cloud data sync
 */
(function() {
  'use strict';

  // Prevent double initialization
  if (window.NexoraAuth && window.NexoraAuth._initialized) {
    console.log('[NexoraAuth] Already initialized, skipping');
    return;
  }

  const AUTH_API_URL = (typeof _CONFIG !== 'undefined' && _CONFIG.authApiUrl) 
    || 'https://j2ii8694xc.execute-api.us-east-2.amazonaws.com';

  const SESSION_KEY = 'nexora.auth.session';
  const SYNC_INTERVAL = 60000; // Sync every minute when logged in

  // Session state
  let currentSession = null;
  let syncTimer = null;
  let authListeners = [];

  const CREDENTIALS_KEY = 'nexora.auth.credentials';

  /**
   * Initialize auth service
   */
  function init() {
    console.log('[NexoraAuth] Initializing...');
    
    // Try to auto-login with saved credentials
    const savedCreds = getSavedCredentials();
    if (savedCreds) {
      console.log('[NexoraAuth] Found saved credentials for:', savedCreds.username);
      // Auto-login silently
      autoLogin(savedCreds.username, savedCreds.password);
    } else {
      console.log('[NexoraAuth] No saved credentials found');
      notifyListeners();
    }
    
    window.addEventListener('storage', handleStorageChange);
  }

  /**
   * Get saved credentials from localStorage
   */
  function getSavedCredentials() {
    try {
      const stored = localStorage.getItem(CREDENTIALS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('[NexoraAuth] Failed to load credentials:', e);
    }
    return null;
  }

  /**
   * Save credentials to localStorage
   */
  function saveCredentials(username, password) {
    try {
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username, password }));
      console.log('[NexoraAuth] Credentials saved for:', username);
    } catch (e) {
      console.error('[NexoraAuth] Failed to save credentials:', e);
    }
  }

  /**
   * Clear saved credentials
   */
  function clearCredentials() {
    localStorage.removeItem(CREDENTIALS_KEY);
  }

  /**
   * Auto-login with saved credentials (silent, no reload)
   */
  async function autoLogin(username, password) {
    try {
      const result = await apiRequest('/auth/login', 'POST', { username, password });
      if (result.success) {
        currentSession = {
          username: result.username,
          displayName: result.displayName,
          token: result.token
        };
        console.log('[NexoraAuth] Auto-login successful for:', username);
        notifyListeners();
        startAutoSync();
      }
    } catch (e) {
      console.error('[NexoraAuth] Auto-login failed:', e);
      // Credentials might be wrong, clear them
      clearCredentials();
      currentSession = null;
      notifyListeners();
    }
  }

  /**
   * Load session from localStorage (legacy, kept for compatibility)
   */
  function loadSession() {
    // No longer used - we use credentials-based auto-login now
  }

  /**
   * Save session to localStorage
   */
  function saveSession(session) {
    currentSession = session;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      console.log('[NexoraAuth] Session saved for user:', session?.username);
    } catch (e) {
      console.error('[NexoraAuth] Failed to save session:', e);
    }
    notifyListeners();
  }

  /**
   * Clear session and saved credentials
   */
  function clearSession() {
    currentSession = null;
    localStorage.removeItem(SESSION_KEY);
    clearCredentials(); // Also clear saved username/password
    stopAutoSync();
    notifyListeners();
  }

  /**
   * Handle storage changes from other tabs
   */
  function handleStorageChange(e) {
    if (e.key === CREDENTIALS_KEY) {
      // Credentials changed in another tab, reload to re-check
      const creds = getSavedCredentials();
      if (creds) {
        autoLogin(creds.username, creds.password);
      } else {
        currentSession = null;
        notifyListeners();
      }
    }
  }

  /**
   * Register auth state listener
   */
  function onAuthChange(callback) {
    authListeners.push(callback);
    // Call immediately with current state
    callback(currentSession);
    return () => {
      authListeners = authListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all auth listeners
   */
  function notifyListeners() {
    authListeners.forEach(cb => {
      try { cb(currentSession); } catch (e) { console.error(e); }
    });
  }

  /**
   * API request helper
   */
  async function apiRequest(endpoint, method, body = null) {
    const url = `${AUTH_API_URL}${endpoint}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  /**
   * Register new user
   * @param {boolean} reloadAfterRegister - Whether to reload after registration
   */
  async function register(username, password, reloadAfterRegister = false) {
    const result = await apiRequest('/auth/register', 'POST', { username, password });
    if (result.success) {
      // Save credentials for auto-login
      saveCredentials(username, password);
      
      currentSession = {
        username: result.username,
        displayName: result.displayName,
        token: result.token
      };
      notifyListeners();
      
      // Save current local data to cloud immediately
      await saveCloudData();
      startAutoSync();
      
      if (reloadAfterRegister) {
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    }
    return result;
  }

  /**
   * Login user
   * @param {boolean} reloadAfterLogin - Whether to reload the page after applying cloud data
   */
  async function login(username, password, reloadAfterLogin = true) {
    const result = await apiRequest('/auth/login', 'POST', { username, password });
    if (result.success) {
      // Save credentials for auto-login next time
      saveCredentials(username, password);
      
      currentSession = {
        username: result.username,
        displayName: result.displayName,
        token: result.token
      };
      notifyListeners();
      
      // Load cloud data after login
      const cloudData = await loadCloudData();
      
      // Reload page to apply all settings (theme, cloaking, etc.)
      if (reloadAfterLogin && cloudData && Object.keys(cloudData).length > 0) {
        // Small delay to show success message before reload
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        startAutoSync();
      }
    }
    return result;
  }

  /**
   * Verify current session
   */
  async function verifySession() {
    if (!currentSession) return false;
    try {
      const url = `${AUTH_API_URL}/auth/verify`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentSession.username,
          token: currentSession.token
        })
      });
      
      const result = await response.json();
      console.log('[NexoraAuth] Verify response:', result);
      
      // Check for valid: true (server returns 200 for both valid and invalid)
      return result.valid === true;
    } catch (e) {
      // Network error - don't clear session, might be temporary
      console.log('[NexoraAuth] Network error during verification, keeping session');
      return true; // Keep session on network errors
    }
  }

  /**
   * Logout user
   */
  async function logout() {
    if (currentSession) {
      try {
        await apiRequest('/auth/logout', 'POST', {
          username: currentSession.username,
          token: currentSession.token
        });
      } catch (e) {
        console.error('Logout request failed:', e);
      }
    }
    clearSession();
  }

  /**
   * Change password
   */
  async function changePassword(currentPassword, newPassword) {
    if (!currentSession) throw new Error('Not logged in');
    
    const result = await apiRequest('/auth/password', 'PUT', {
      username: currentSession.username,
      token: currentSession.token,
      currentPassword,
      newPassword
    });

    if (result.success) {
      // Update saved credentials with new password
      saveCredentials(currentSession.username, newPassword);
      
      currentSession = {
        ...currentSession,
        token: result.token
      };
      notifyListeners();
    }
    return result;
  }

  /**
   * Change username
   */
  async function changeUsername(newUsername) {
    if (!currentSession) throw new Error('Not logged in');
    
    // Get current password from saved credentials
    const savedCreds = getSavedCredentials();
    
    const result = await apiRequest('/auth/username', 'PUT', {
      username: currentSession.username,
      token: currentSession.token,
      newUsername
    });

    if (result.success) {
      // Update saved credentials with new username
      if (savedCreds) {
        saveCredentials(newUsername, savedCreds.password);
      }
      
      currentSession = {
        username: result.username,
        displayName: result.displayName,
        token: result.token
      };
      notifyListeners();
    }
    return result;
  }

  /**
   * Get current session
   */
  function getSession() {
    return currentSession;
  }

  /**
   * Check if user is logged in
   */
  function isLoggedIn() {
    return currentSession !== null;
  }

  /**
   * Get all local data to sync
   */
  function getLocalData() {
    const data = {};
    const keysToSync = [
      'settings.theme',
      'settings.colorScheme',
      'settings.aboutBlank',
      'settings.disguise',
      'settings.faviconData',
      'settings.customTitle',
      'settings.panicKey',
      'settings.panicUrl',
      'settings.particles',
      'settings.performancePreset',
      'settings.mouseTracking',
      'settings.animations',
      'settings.glow',
      'settings.blur',
      'settings.transforms',
      'proxServer',
      'firstVisit',
      'nexora_disguise',
      'nexora_favicon'
    ];

    keysToSync.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    });

    // Also get any game-related data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Exclude session key from cloud sync to prevent overwriting new session with old one
      if (key && key !== SESSION_KEY && (key.startsWith('game.') || key.startsWith('nexora.'))) {
        data[key] = localStorage.getItem(key);
      }
    }

    return data;
  }

  /**
   * Apply cloud data to local storage
   */
  function applyCloudData(data) {
    if (!data || typeof data !== 'object') return;
    
    Object.keys(data).forEach(key => {
      // Never overwrite the session from cloud data
      if (key === SESSION_KEY) return;
      localStorage.setItem(key, data[key]);
    });

    // Dispatch event to notify other components of data change
    window.dispatchEvent(new CustomEvent('nexora:datasynced', { detail: data }));
  }

  /**
   * Save data to cloud
   */
  async function saveCloudData() {
    if (!currentSession) return;

    const data = getLocalData();
    
    try {
      await apiRequest('/data/save', 'POST', {
        username: currentSession.username,
        token: currentSession.token,
        data
      });
      console.log('Data synced to cloud');
    } catch (e) {
      console.error('Failed to sync data:', e);
    }
  }

  /**
   * Load data from cloud
   */
  async function loadCloudData() {
    if (!currentSession) return null;

    try {
      const result = await apiRequest('/data/load', 'POST', {
        username: currentSession.username,
        token: currentSession.token
      });
      
      if (result.success && result.data) {
        applyCloudData(result.data);
        return result.data;
      }
    } catch (e) {
      console.error('Failed to load cloud data:', e);
    }
    return null;
  }

  /**
   * Start auto-sync timer
   */
  function startAutoSync() {
    stopAutoSync();
    syncTimer = setInterval(saveCloudData, SYNC_INTERVAL);
    // Initial sync
    saveCloudData();
  }

  /**
   * Stop auto-sync timer
   */
  function stopAutoSync() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  /**
   * Manually trigger sync
   */
  async function sync() {
    await saveCloudData();
  }

  // Debounced sync for settings changes - triggers on every localStorage change
  let debouncedSyncTimer = null;
  function debouncedSync() {
    if (!currentSession) return;
    if (debouncedSyncTimer) clearTimeout(debouncedSyncTimer);
    debouncedSyncTimer = setTimeout(() => {
      saveCloudData();
    }, 500); // Wait 500ms after last change before syncing (prevents spam)
  }

  // Listen for localStorage changes to auto-sync
  // Using a safer approach that doesn't break localStorage.setItem
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    // Trigger debounced sync for settings changes (but not the session/credentials keys)
    if (key !== SESSION_KEY && key !== CREDENTIALS_KEY && 
        (key.startsWith('settings.') || key.startsWith('nexora') || key.startsWith('game.') || key === 'proxServer' || key === 'firstVisit')) {
      console.log('[NexoraAuth] Change detected, syncing:', key);
      debouncedSync();
    }
  };

  // Also track removals
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  localStorage.removeItem = function(key) {
    originalRemoveItem(key);
    if (key !== SESSION_KEY && key !== CREDENTIALS_KEY && 
        (key.startsWith('settings.') || key.startsWith('nexora') || key.startsWith('game.') || key === 'proxServer')) {
      console.log('[NexoraAuth] Removal detected, syncing:', key);
      debouncedSync();
    }
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Save before unload
  window.addEventListener('beforeunload', () => {
    if (currentSession) {
      // Use sendBeacon for reliable last-moment sync
      const data = {
        username: currentSession.username,
        token: currentSession.token,
        data: getLocalData()
      };
      navigator.sendBeacon(`${AUTH_API_URL}/data/save`, JSON.stringify(data));
    }
  });

  // Export to window
  window.NexoraAuth = {
    _initialized: true,
    register,
    login,
    logout,
    changePassword,
    changeUsername,
    getSession,
    isLoggedIn,
    onAuthChange,
    saveCloudData,
    loadCloudData,
    sync,
    verifySession
  };

})();
