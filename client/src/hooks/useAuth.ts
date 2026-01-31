import { useState, useEffect } from 'react';
import { getPWAAuthState, setPWAAuth, clearPWAAuth, isPWAInstalled } from '@/utils/pwaAuth';
import { signOutGoogle } from '@/lib/googleAuth';
import { CacheManager } from '@/utils/cacheManager';
import { isTempUser, clearTempUserData, getServerTempUserSession, validateServerSession, clearServerTempUserSession } from '@/utils/tempUser';
import { UserRole } from '@shared/schema';

interface User {
  id: string | number;
  name: string;
  email: string;
  role: UserRole | string;
  phoneNumber?: string;
  registerNumber?: string;
  department?: string;
  college?: string;
  organization?: string; // Organization ID for filtering canteens
  organizationId?: string; // Client-side organization ID
  currentStudyYear?: string;
  isPassed?: boolean;
  staffId?: string;
  [key: string]: any; // Allow additional fields
}

// Global validation cache to prevent repeated API calls
const validationCache = new Map<string, { user: User | null; timestamp: number }>();
const VALIDATION_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (much more aggressive caching)

// Global validation lock to prevent concurrent validations for the same user
const validationLocks = new Map<string, Promise<User | null>>();

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    // Use PWA authentication utilities for consistent handling
    const loadUserFromStorage = async () => {
      if (isValidating) {
        console.log("Already validating, skipping...");
        return;
      }

      setIsValidating(true);
      const authState = getPWAAuthState();

      console.log("useAuth loadUserFromStorage - PWA State:", authState);

      // Check for server-managed temp user session first
      const serverTempUser = getServerTempUserSession();
      if (serverTempUser && serverTempUser.sessionId) {
        console.log("🔄 Found server temp user session, validating...");
        const isValid = await validateServerSession();
        if (isValid) {
          console.log("✅ Server session is valid");
          setUser(serverTempUser);
          // Dispatch custom event to notify other components
          window.dispatchEvent(new CustomEvent('userAuthChange'));
          setIsLoading(false);
          setIsValidating(false);
          return;
        } else {
          console.log("❌ Server session expired or invalid, clearing...");
          clearServerTempUserSession();
          setUser(null);
          // Dispatch custom event to notify other components
          window.dispatchEvent(new CustomEvent('userAuthChange'));
          setIsLoading(false);
          setIsValidating(false);
          return;
        }
      }

      if (authState.isAuthenticated && authState.user) {
        console.log("Valid PWA session found, checking validation cache:", authState.user);

        // Skip database validation for temporary/guest users
        // IMPORTANT: Preserve all fields from localStorage including organization
        // IMPORTANT: Preserve all fields from localStorage including organization
        if (authState.user.isTemporary || authState.user.role === UserRole.GUEST) {
          console.log("✅ Guest/temporary user detected, skipping database validation");
          console.log("✅ Guest user data from localStorage:", authState.user);
          console.log("✅ Guest user organization field:", authState.user.organization);
          // Preserve all fields from localStorage, especially organization
          setUser(authState.user);
          setIsLoading(false);
          setIsValidating(false);
          return;
        }

        // Check cache first for regular users
        const cacheKey = authState.user.id.toString();
        const cached = validationCache.get(cacheKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < VALIDATION_CACHE_DURATION) {
          console.log("✅ Using cached validation result");
          setUser(cached.user);
          setIsLoading(false);
          setIsValidating(false);
          return;
        }

        // Check if there's already a validation in progress for this user
        const existingValidation = validationLocks.get(cacheKey);
        if (existingValidation) {
          console.log("⏳ Validation already in progress, waiting for result...");
          try {
            const validatedUser = await existingValidation;
            setUser(validatedUser);
            setIsLoading(false);
            setIsValidating(false);
            return;
          } catch (error) {
            console.warn("⚠️ Error waiting for existing validation:", error);
            // Fall through to start new validation
          }
        }

        // Validate user still exists in database and is not blocked
        const validationPromise = (async () => {
          try {
            console.log("🔍 Validating user against database...");
            const response = await fetch(`/api/users/${authState.user.id}/validate`, {
              cache: 'default', // Use browser cache if available
              headers: {
                'Cache-Control': 'max-age=60' // Cache for 60 seconds
              }
            });

            if (response.ok) {
              const data = await response.json();
              if (data.userExists) {
                // Check if user is blocked
                if (data.user.role && data.user.role.startsWith('blocked_')) {
                  console.log("❌ User is blocked, clearing session");
                  clearPWAAuth();
                  validationCache.set(cacheKey, { user: null, timestamp: now });
                  validationLocks.delete(cacheKey);
                  // Redirect to login so blocked screen can be shown
                  window.location.href = '/login';
                  return null;
                }
                console.log("✅ User validated against database:", data.user);
                validationCache.set(cacheKey, { user: data.user, timestamp: now });
                validationLocks.delete(cacheKey);
                return data.user;
              } else {
                console.log("❌ User no longer exists in database, clearing session");
                clearPWAAuth();
                validationCache.set(cacheKey, { user: null, timestamp: now });
                validationLocks.delete(cacheKey);
                return null;
              }
            } else if (response.status === 404) {
              // User definitely doesn't exist, clear session
              console.log("❌ User not found (404), clearing session");
              clearPWAAuth();
              validationCache.set(cacheKey, { user: null, timestamp: now });
              validationLocks.delete(cacheKey);
              return null;
            } else {
              // For other errors (500, network issues, etc.), keep the session
              console.warn(`⚠️ User validation failed with status ${response.status}, keeping PWA session`);
              validationCache.set(cacheKey, { user: authState.user, timestamp: now });
              validationLocks.delete(cacheKey);
              return authState.user;
            }
          } catch (error) {
            console.warn("⚠️ Database validation failed, keeping localStorage session:", error);
            // In case of network error, keep the session but user will be re-validated on next API call
            validationCache.set(cacheKey, { user: authState.user, timestamp: now });
            validationLocks.delete(cacheKey);
            return authState.user;
          }
        })();

        // Store the promise so other components can wait for it
        validationLocks.set(cacheKey, validationPromise);

        try {
          const validatedUser = await validationPromise;
          setUser(validatedUser);
        } catch (error) {
          console.warn("⚠️ Validation promise error:", error);
          setUser(authState.user);
        }
      } else {
        console.log("No valid PWA session, clearing user state");
        setUser(null);
      }
      setIsLoading(false);
      setIsValidating(false);
    };

    // Cross-tab synchronization for mobile PWA - sync login/logout across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if ((e.key === 'user' || e.key === 'temp_user_session') && !isValidating) {
        console.log("Storage change detected for PWA user:", e.key);
        loadUserFromStorage();
      }
      // Removed 'session_timestamp' to prevent infinite loops
    };

    // Initial load with database validation
    loadUserFromStorage();

    // Listen for storage changes to sync across tabs/windows
    window.addEventListener('storage', handleStorageChange);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = (userData: User) => {
    console.log("useAuth login called with:", userData);

    // Clear any temporary user session to prevent conflicts
    localStorage.removeItem('temp_user_session');

    setUser(userData);
    setPWAAuth(userData);
    // Mark onboarding as completed when user successfully logs in
    localStorage.setItem('onboarding_completed', 'true');
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('userAuthChange'));
  };

  const logout = async () => {
    console.log("🚀 Complete logout initiated...");

    // Check if this is a temporary user
    const isTemporary = isTempUser(user);

    if (isTemporary) {
      console.log("🍽️ Logging out temporary user...");

      // Check if this is a server-managed temp user
      const serverTempUser = getServerTempUserSession();
      if (serverTempUser && serverTempUser.sessionId) {
        console.log("🔄 Ending server session...");
        try {
          await fetch(`/api/temp-session/${serverTempUser.sessionId}/end`, {
            method: 'POST'
          });
        } catch (error) {
          console.warn("⚠️ Failed to end server session:", error);
        }
        clearServerTempUserSession();
      } else {
        // Clear legacy temporary user data
        clearTempUserData();
      }
    } else {
      // Sign out from Google OAuth to clear cached Google accounts
      try {
        signOutGoogle();
        console.log("✅ Google OAuth session cleared");
      } catch (error) {
        console.warn("⚠️ Google OAuth signOut failed:", error);
      }

      // Complete cache clearing for logout
      try {
        await CacheManager.clearLogoutCaches();
        console.log("✅ Complete logout cache clearing finished");
      } catch (error) {
        console.warn("⚠️ Cache clearing failed:", error);
      }
    }

    // Clear local app session
    setUser(null);
    clearPWAAuth();
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('userAuthChange'));

    // Force reload to ensure clean state
    setTimeout(() => {
      window.location.href = isTemporary ? '/' : '/login';
    }, 100);
  };

  // Update activity timestamp for mobile PWA users
  const updateActivity = () => {
    if (user) {
      const currentTime = Date.now();
      localStorage.setItem('last_activity', currentTime.toString());
      // Extend session if user is active
      localStorage.setItem('session_timestamp', currentTime.toString());
    }
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const isAdmin = () => {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  };

  const isSuperAdmin = () => {
    return user?.role === UserRole.SUPER_ADMIN;
  };

  const isCanteenOwner = () => {
    return user?.role === UserRole.CANTEEN_OWNER;
  };

  const isStudent = () => {
    return user?.role === UserRole.STUDENT;
  };

  const isStaff = () => {
    return user?.role === UserRole.STAFF;
  };

  const isEmployee = () => {
    return user?.role === UserRole.EMPLOYEE;
  };

  const isGuest = () => {
    return user?.role === UserRole.GUEST;
  };

  const isContractor = () => {
    return user?.role === UserRole.CONTRACTOR;
  };

  const isVisitor = () => {
    return user?.role === UserRole.VISITOR;
  };

  const isTemporaryUser = () => {
    return isTempUser(user);
  };

  const hasRole = (role: string) => {
    return user?.role === role;
  };

  return {
    user,
    isLoading,
    login,
    logout,
    updateUser,
    updateActivity,
    isAdmin,
    isSuperAdmin,
    isCanteenOwner,
    isStudent,
    isStaff,
    isEmployee,
    isGuest,
    isContractor,
    isVisitor,
    isTemporaryUser,
    hasRole,
    isAuthenticated: !!user
  };
}