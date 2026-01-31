import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@shared/schema";
import { isPWAInstalled, getPWAAuthState } from "@/utils/pwaAuth";
import { serverRestartDetector } from "@/utils/devUpdateDetector";
import { AppUpdater } from "@/utils/appUpdater";
import NotificationPermissionDialog from "@/components/modals/NotificationPermissionDialog";
import MaintenanceScreen from "@/components/layout/MaintenanceScreen";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { apiRequest } from "@/lib/queryClient";
import { updateStatusBarColor } from "@/utils/statusBar";
import splashLogo from "./splash_logo.svg";

export default function SplashScreen() {
  console.log('🎬 SplashScreen component mounting/rendering');

  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { resolvedTheme } = useTheme();
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showMaintenanceScreen, setShowMaintenanceScreen] = useState(false);

  // PWA users go directly to splashscreen (no landing page check needed)
  // Browser users can access splashscreen directly if they navigate to /splashscreen
  // Landing page is always accessible at root (/)
  const [svgLoaded, setSvgLoaded] = useState(false);
  const [svgError, setSvgError] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [apiResponseReceived, setApiResponseReceived] = useState(false);
  const animationStartTime = useRef<number | null>(null);
  const hasRedirectedRef = useRef(false);
  const imageLoadAttemptedRef = useRef(false); // Track if we've already attempted to load
  const hasProcessedSettingsRef = useRef(false); // Track if we've already processed system settings
  const animationDuration = 4000; // Animation duration in milliseconds (increased for slower splash)
  const [logoAnimDone, setLogoAnimDone] = useState(false); // SVG fade-in complete
  const [beginLogoFadeOut, setBeginLogoFadeOut] = useState(false); // trigger final fade-out
  const [logoFadedOut, setLogoFadedOut] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const sequenceTimeoutRef = useRef<number | null>(null);
  const stillPhaseStartTimeRef = useRef<number | null>(null);
  const MIN_STILL_MS = 1500;
  const MIN_DISPLAY_TIME = 2000; // Minimum time to show splash screen (2 seconds)
  const MAX_SPLASH_TIME = 12000; // Maximum time before forcing redirect (12 seconds safety net)
  const componentMountTime = useRef<number>(Date.now());
  const hasRenderedRef = useRef(false);

  // Mark that component has rendered
  useEffect(() => {
    hasRenderedRef.current = true;
    console.log('✅ SplashScreen has rendered');
  }, []);
  const [maintenanceData, setMaintenanceData] = useState<{
    title: string;
    message: string;
    estimatedTime?: string;
    contactInfo?: string;
  } | null>(null);

  // Get primary color from CSS variables (reactive to theme changes)
  const [primaryColor, setPrimaryColor] = useState('4 68% 52%');

  useEffect(() => {
    const updatePrimaryColor = () => {
      if (typeof window !== 'undefined') {
        const root = document.documentElement;
        const computed = getComputedStyle(root);
        const color = computed.getPropertyValue('--primary').trim() || '4 68% 52%';
        setPrimaryColor(color);
      }
    };

    updatePrimaryColor();

    // Listen for theme changes
    const observer = new MutationObserver(updatePrimaryColor);
    if (typeof window !== 'undefined') {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    return () => observer.disconnect();
  }, []);

  // Handle SVG loading and start animation timing
  useEffect(() => {
    // Prevent multiple load attempts - this effect should only run once
    if (imageLoadAttemptedRef.current) {
      return;
    }
    imageLoadAttemptedRef.current = true;

    // Start tracking animation time
    animationStartTime.current = Date.now();

    // Since we're using inline SVG in the render, mark as loaded immediately
    // The inline SVG doesn't need to be preloaded
    setSvgLoaded(true);

    // Deprecated fixed timer: we now complete animation on SVG fade-out completion
    const animationTimer = setTimeout(() => {
      // Timer completed - no action needed
    }, animationDuration);

    return () => {
      clearTimeout(animationTimer);
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
        sequenceTimeoutRef.current = null;
      }
    };
  }, []); // Empty deps - only run once on mount

  // Function to check if both conditions are met for redirect
  // Note: The actual redirect is handled by the useEffect hook below
  const checkRedirectConditions = () => {
    if (animationComplete && apiResponseReceived) {
      proceedWithRedirect();
    }
    console.log('Checking redirect conditions:', { animationComplete, apiResponseReceived, isLoading, hasRedirected: hasRedirectedRef.current });
    // Don't call proceedWithRedirect directly - let the useEffect handle it
    // This prevents multiple redirects and ensures proper timing
  };

  // Ensure redirect happens when both flags become true AND auth loading is complete
  // Also ensure minimum display time has passed AND component has rendered
  useEffect(() => {
    // Don't redirect until component has rendered at least once
    if (!hasRenderedRef.current) {
      console.log('⏳ Waiting for component to render first...');
      return;
    }

    // Safety timeout: force redirect after MAX_SPLASH_TIME to prevent infinite hang
    const safetyTimeout = setTimeout(() => {
      if (!hasRedirectedRef.current) {
        console.warn('⚠️ Safety timeout reached - forcing redirect after', MAX_SPLASH_TIME, 'ms');
        hasRedirectedRef.current = true;
        proceedWithRedirect();
      }
    }, MAX_SPLASH_TIME);

    if (animationComplete && apiResponseReceived && !isLoading && !hasRedirectedRef.current) {
      const elapsed = Date.now() - componentMountTime.current;
      const remainingTime = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      if (remainingTime > 0) {
        console.log(`⏳ Minimum display time not met. Waiting ${remainingTime}ms more...`);
        setTimeout(() => {
          if (!hasRedirectedRef.current && hasRenderedRef.current) {
            console.log('✅ All conditions met for redirect - proceeding');
            hasRedirectedRef.current = true;
            clearTimeout(safetyTimeout);
            proceedWithRedirect();
          }
        }, remainingTime);
      } else {
        console.log('✅ All conditions met for redirect - proceeding');
        hasRedirectedRef.current = true;
        clearTimeout(safetyTimeout);
        proceedWithRedirect();
      }
    } else {
      console.log('⏳ Waiting for redirect conditions:', {
        animationComplete,
        apiResponseReceived,
        isLoading,
        hasRedirected: hasRedirectedRef.current,
        hasRendered: hasRenderedRef.current,
        elapsed: Date.now() - componentMountTime.current
      });
    }

    return () => clearTimeout(safetyTimeout);
  }, [animationComplete, apiResponseReceived, isLoading]);

  // When APIs are ready during STILL phase, trigger SVG fade-out (respect minimum still time)
  useEffect(() => {
    if (logoAnimDone && apiResponseReceived && !beginLogoFadeOut) {
      const now = Date.now();
      const startedAt = stillPhaseStartTimeRef.current || now;
      const elapsed = now - startedAt;
      const remaining = Math.max(0, MIN_STILL_MS - elapsed);

      const startFadeOut = () => {
        setTaglineVisible(false);
        setBeginLogoFadeOut(true);
      };

      if (remaining <= 0) {
        startFadeOut();
      } else {
        if (sequenceTimeoutRef.current) {
          clearTimeout(sequenceTimeoutRef.current);
        }
        sequenceTimeoutRef.current = window.setTimeout(startFadeOut, remaining);
      }
    }
  }, [logoAnimDone, apiResponseReceived, beginLogoFadeOut]);

  // Helper function to ensure URL is correctly formatted
  const formatRedirectUrl = (url: string): string => {
    // Ensure URL starts with a slash
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    return url;
  };

  // Query for all system settings in a single API call - optimized for splash screen
  const { data: systemSettings, isError: settingsError, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/system-settings/all-settings'],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      try {
        const result = await apiRequest('/api/system-settings/all-settings');
        clearTimeout(timeout);
        return result;
      } catch (error) {
        clearTimeout(timeout);
        // Return default settings on error to prevent splash screen hang
        console.error('Failed to fetch system settings, using defaults:', error);
        return {
          maintenance: { isActive: false },
          notifications: { isEnabled: true },
          appVersion: { version: '2.0.0' }
        };
      }
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - aggressive caching for all settings
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: 2, // Retry twice on failure
    retryDelay: 1000, // Wait 1 second between retries
  });

  // Extract individual settings from the batched response - memoized to prevent unnecessary re-renders
  const maintenanceStatus = useMemo(() => systemSettings?.maintenance, [systemSettings?.maintenance]);
  const notificationSettings = useMemo(() => systemSettings?.notifications, [systemSettings?.notifications]);
  const appVersionInfo = useMemo(() => systemSettings?.appVersion, [systemSettings?.appVersion]);


  const checkNotificationPermission = () => {
    // Check if browser supports notifications
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }

    // Check current permission status
    return Notification.permission === 'granted';
  };

  const handleNotificationDialogClose = () => {
    setShowNotificationDialog(false);
    // Mark API response as received
    setApiResponseReceived(true);
    // Check if we can proceed with redirect
    checkRedirectConditions();
  };

  const proceedWithRedirect = () => {
    // Wait for auth loading to complete if still loading
    if (isLoading) {
      // Check again after a short delay
      setTimeout(() => {
        if (!isLoading) {
          proceedWithRedirect();
        }
      }, 100);
      return;
    }

    // Implement 300ms delay for animation cleanup before redirect
    setTimeout(() => {
      try {
        const isPWALaunch = isPWAInstalled();
        const pwaAuthState = getPWAAuthState();

        // CRITICAL: First check localStorage directly to detect old users
        // This must happen BEFORE checking useAuth to prioritize cached users
        const cachedUserStr = localStorage.getItem('user');
        let hasCachedUser = false;
        let cachedUserData = null;
        try {
          if (cachedUserStr) {
            const parsed = JSON.parse(cachedUserStr);
            // Check if it's a valid user object
            if (parsed && typeof parsed === 'object' && (parsed.id || parsed.email)) {
              hasCachedUser = true;
              cachedUserData = parsed;
            }
          }
        } catch (e) {
          console.error('Error parsing cached user:', e);
          // Invalid JSON, treat as no user
        }

        // PRIORITY 1: If cached user exists, treat as old user and go to home (skip onboarding)
        if (hasCachedUser) {
          // Use cached user for role-based redirect
          const userForRedirect = user || cachedUserData || pwaAuthState.user;

          if (userForRedirect) {
            if (userForRedirect.role === UserRole.SUPER_ADMIN) {
              const redirectUrl = isPWALaunch ? formatRedirectUrl("/admin") : "/admin";
              setLocation(redirectUrl);
              return;
            } else if (userForRedirect.role === UserRole.CANTEEN_OWNER || userForRedirect.role === 'canteen-owner') {
              // Handle canteen owner redirect - fetch canteen ID and redirect to counter selection
              const redirectCanteenOwner = async () => {
                try {
                  // Check if canteen data is already in user object (from validation endpoint)
                  if ((userForRedirect as any).canteen?.id) {
                    const canteenId = (userForRedirect as any).canteen.id;
                    console.log('Using canteen ID from user object:', canteenId);
                    setLocation(`/canteen-owner-dashboard/${canteenId}/counters`);
                    return;
                  }

                  // Otherwise, fetch canteen ID from API
                  console.log('Fetching canteen for owner:', userForRedirect.email);
                  const canteenResponse = await fetch(`/api/system-settings/canteens/by-owner/${userForRedirect.email}`);
                  console.log('Canteen response status:', canteenResponse.status);

                  if (canteenResponse.ok) {
                    const canteenData = await canteenResponse.json();
                    console.log('Canteen data received:', canteenData);
                    console.log('Redirecting canteen owner to:', `/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
                    setLocation(`/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
                  } else {
                    // If canteen not found, redirect to login with error
                    const errorText = await canteenResponse.text();
                    console.error('Canteen not found for owner:', userForRedirect.email, 'Response:', errorText);
                    setLocation('/login?error=no_canteen');
                  }
                } catch (error) {
                  console.error('Error fetching canteen for owner:', error);
                  setLocation('/login?error=canteen_fetch_failed');
                }
              };

              redirectCanteenOwner();
              return;
            } else if (userForRedirect.role === UserRole.DELIVERY_PERSON) {
              // Handle delivery person redirect
              const redirectUrl = isPWALaunch ? formatRedirectUrl("/delivery-portal") : "/delivery-portal";
              setLocation(redirectUrl);
              return;
            }
          }

          // Default: old user goes to home
          setLocation("/app");
          return;
        }

        // PRIORITY 2: If we reach here, there's NO cached user in localStorage
        // This means it's a NEW USER who must see onboarding first (Splash → Onboarding → Login)
        // Even if useAuth has a user, without localStorage cache, they're new to this device/session
        // The onboarding screen will redirect to login, and login will handle authentication

        setLocation("/onboarding");
        return;
      } catch (error) {
        // Error handling for failed redirects
        console.error('Redirect failed:', error);
        // Fallback behavior - redirect based on authentication state
        setTimeout(() => {
          const isPWALaunch = isPWAInstalled();
          const pwaAuthState = getPWAAuthState();
          const hasUser = user || (isPWALaunch && pwaAuthState.isAuthenticated && pwaAuthState.user);

          if (hasUser) {
            setLocation('/login?error=redirect_failed');
          } else {
            // Check if user exists in cache
            const cachedUserStr = localStorage.getItem('user');
            let hasCachedUser = false;
            try {
              if (cachedUserStr) {
                const parsed = JSON.parse(cachedUserStr);
                hasCachedUser = parsed && (parsed.id || parsed.email);
              }
            } catch (e) {
              // Invalid JSON, treat as no user
            }

            if (hasCachedUser) {
              setLocation('/app');
            } else {
              setLocation('/onboarding');
            }
          }
        }, 500);
      }
    }, 300); // 300ms delay for animation cleanup
  };

  useEffect(() => {
    // Prevent multiple executions - only run once when settings are first loaded
    // Also proceed if settings are still loading after 10 seconds (prevent infinite hang)
    const settingsTimeout = !systemSettings && !settingsLoading && !settingsError;

    if (hasProcessedSettingsRef.current) {
      return;
    }

    // If settings haven't loaded after reasonable time, proceed anyway with defaults
    if (!systemSettings && !settingsLoading && !settingsError) {
      console.warn('⚠️ System settings not loaded, proceeding with defaults after timeout');
      // Use default settings
      const defaultSettings = {
        maintenance: { isActive: false },
        notifications: { isEnabled: true },
        appVersion: { version: '2.0.0' }
      };
    }

    // Wait for settings to be available (or timeout/error)
    if (!systemSettings && settingsLoading) {
      return;
    }

    // Mark as processed to prevent re-execution
    hasProcessedSettingsRef.current = true;

    const isPWALaunch = isPWAInstalled();

    const handleRedirect = async () => {
      // STEP 1: Check for app updates (server start timestamp)
      serverRestartDetector.startMonitoring();

      // STEP 2: Check notification enable/disable status
      const isNotificationEnabled = (notificationSettings as any)?.isEnabled !== false; // Default to true if undefined

      // Only proceed if animation is complete and we're not showing maintenance screen
      if (!isLoading && !(maintenanceStatus as any)?.isActive) {
        // Mark API response as received
        setApiResponseReceived(true);
        // Check if we can proceed with redirect
        checkRedirectConditions();
      }

      // Get comprehensive PWA authentication state first
      const pwaAuthState = getPWAAuthState();

      // STEP 3: Check for maintenance notice (only for unauthenticated users with 'all' targeting)
      const isMaintenanceActive = (maintenanceStatus as any)?.isActive;
      const targetingType = (maintenanceStatus as any)?.targetingType || 'all';

      // Only show maintenance on splash screen if:
      // 1. Maintenance is active AND
      // 2. User is not authenticated (PWA or regular) AND 
      // 3. Targeting is set to 'all' (specific targeting will be handled by MaintenanceWrapper after auth)
      const shouldShowMaintenanceOnSplash = isMaintenanceActive &&
        targetingType === 'all' &&
        !user &&
        !(isPWALaunch && pwaAuthState.isAuthenticated);

      if (shouldShowMaintenanceOnSplash) {
        setMaintenanceData({
          title: (maintenanceStatus as any)?.title || 'System Maintenance',
          message: (maintenanceStatus as any)?.message || 'We are currently performing system maintenance. Please check back later.',
          estimatedTime: (maintenanceStatus as any)?.estimatedTime,
          contactInfo: (maintenanceStatus as any)?.contactInfo
        });
        setShowMaintenanceScreen(true);
        return; // Stop here - don't proceed to app
      }

      // Check notification permissions for authenticated users (only if notifications are enabled)
      const shouldCheckNotificationPermission = isNotificationEnabled && ((isPWALaunch && pwaAuthState.isAuthenticated) || user);

      // For PWA launches, prioritize PWA authentication state but also check regular auth as fallback
      if (isPWALaunch) {
        // Check PWA auth state first, then fallback to regular user state
        const authUser = pwaAuthState.isAuthenticated && pwaAuthState.user ? pwaAuthState.user : user;

        if (authUser) {
          // Check notifications before redirecting (only if notifications are enabled system-wide)
          if (shouldCheckNotificationPermission && !checkNotificationPermission()) {
            setShowNotificationDialog(true);
            return; // Don't mark ready yet
          }

          // Mark readiness; actual redirect will occur after animation in proceedWithRedirect
          setApiResponseReceived(true);
          checkRedirectConditions();
          return;
        } else {
          // No valid session for PWA - go to login only if we're sure auth is complete
          if (!isLoading) {
            setApiResponseReceived(true);
            checkRedirectConditions();
          }
          return;
        }
      }

      // Regular web app flow - check if user is already authenticated
      if (user) {
        // Check notifications before redirecting (only if notifications are enabled system-wide)
        if (shouldCheckNotificationPermission && !checkNotificationPermission()) {
          setShowNotificationDialog(true);
          return; // Don't mark ready yet
        }

        // Mark readiness; actual redirect will occur after animation in proceedWithRedirect
        setApiResponseReceived(true);
        checkRedirectConditions();
      } else {
        // Only redirect to login if auth loading is complete
        if (!isLoading) {
          setApiResponseReceived(true);
          checkRedirectConditions();
        }
      }
    };

    // Call handleRedirect directly to process authentication and system settings
    // The handleRedirect function will handle the synchronization with animation
    handleRedirect();

    return () => {
      // Reset the processed flag if component unmounts before redirect
      // This allows the effect to run again if component remounts
      if (!hasRedirectedRef.current) {
        hasProcessedSettingsRef.current = false;
      }
    };
  }, [setLocation, isLoading, systemSettings]); // Only depend on systemSettings being defined, not its contents


  // If maintenance mode is active, show maintenance screen
  if (showMaintenanceScreen && maintenanceData) {
    return (
      <MaintenanceScreen
        title={maintenanceData.title}
        message={maintenanceData.message}
        estimatedTime={maintenanceData.estimatedTime}
        contactInfo={maintenanceData.contactInfo}
        showAuthOptions={true}
        isAuthenticated={!!user}
        onAnimationComplete={() => {
          setAnimationComplete(true);
          checkRedirectConditions();
        }}
      />
    );
  }

  // Enhanced SVG animation variants with more sophisticated animations
  const svgVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      filter: "blur(10px)"
    },
    visible: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1], // Custom easing for smooth animation
      }
    }
  };


  // Prevent scrolling on body when splash screen is mounted
  useEffect(() => {
    // Prevent scrolling
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      // Restore scrolling when component unmounts
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <>
      <div className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden bg-background transition-opacity duration-1000 ease-in-out fixed inset-0">
        {/* Animated gradient background overlay using theme colors */}
        <motion.div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 20% 50%, hsl(${primaryColor} / 0.15) 0%, transparent 50%)`
          }}
          animate={{
            background: [
              `radial-gradient(circle at 20% 50%, hsl(${primaryColor} / 0.15) 0%, transparent 50%)`,
              `radial-gradient(circle at 80% 50%, hsl(${primaryColor} / 0.20) 0%, transparent 50%)`,
              `radial-gradient(circle at 50% 80%, hsl(${primaryColor} / 0.15) 0%, transparent 50%)`,
              `radial-gradient(circle at 20% 50%, hsl(${primaryColor} / 0.15) 0%, transparent 50%)`
            ]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Main content */}
        <div className="flex flex-col items-center justify-center relative z-10 gap-4">
          {/* Animated SVG Logo with error handling + fade-out */}
          <AnimatePresence>
            {svgError ? (
              !logoFadedOut && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={beginLogoFadeOut ? { opacity: 0, scale: 0.6 } : { opacity: 1, scale: 1 }}
                  transition={{ duration: beginLogoFadeOut ? 0.6 : 0.8, ease: [0.16, 1, 0.3, 1] }}
                  onAnimationComplete={() => {
                    if (beginLogoFadeOut) {
                      setLogoFadedOut(true);
                      // Fade-out finished → mark animation complete and attempt redirect
                      setAnimationComplete(true);
                      checkRedirectConditions();
                    }
                  }}
                  className="w-[500px] max-w-[90vw] h-auto mb-4 flex items-center justify-center relative"
                >
                  {/* Glow effect for error fallback */}
                  {logoAnimDone && !beginLogoFadeOut && (
                    <motion.div
                      className="absolute -inset-8 -z-10 pointer-events-none"
                      animate={{
                        opacity: [0.4, 0.7, 0.4],
                        scale: [1, 1.15, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      style={{
                        background: `radial-gradient(circle at center, hsl(${primaryColor} / 0.4) 0%, hsl(${primaryColor} / 0.2) 40%, transparent 70%)`,
                        filter: "blur(24px)",
                      }}
                    />
                  )}
                  <motion.h1
                    className="text-5xl font-bold text-primary"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      filter: logoAnimDone && !beginLogoFadeOut ? `drop-shadow(0 0 30px hsl(${primaryColor} / 0.5))` : "none",
                      color: `hsl(${primaryColor})`
                    }}
                  >
                    SilloBite
                  </motion.h1>
                </motion.div>
              )
            ) : (
              !logoFadedOut && (
                <motion.div
                  initial={{ opacity: 1, scale: 1 }}
                  animate={beginLogoFadeOut ? { opacity: 0, scale: 0.6 } : { opacity: 1, scale: 1 }}
                  transition={{ duration: beginLogoFadeOut ? 0.6 : 0.8, ease: "easeInOut" }}
                  onAnimationComplete={() => {
                    if (beginLogoFadeOut) {
                      setLogoFadedOut(true);
                      // Fade-out finished → mark animation complete and attempt redirect
                      setAnimationComplete(true);
                      checkRedirectConditions();
                    }
                  }}
                  className="w-[500px] max-w-[90vw] relative flex flex-col items-center -mt-48"
                >
                  {/* Glow effect behind logo */}
                  {logoAnimDone && !beginLogoFadeOut && (
                    <motion.div
                      className="absolute -inset-8 -z-10 pointer-events-none"
                      animate={{
                        opacity: [0.4, 0.7, 0.4],
                        scale: [1, 1.15, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      style={{
                        background: `radial-gradient(circle at center, hsl(${primaryColor} / 0.4) 0%, hsl(${primaryColor} / 0.2) 40%, transparent 70%)`,
                        filter: "blur(24px)",
                      }}
                    />
                  )}

                  {/* SVG Container - Fixed position */}
                  <div className="relative overflow-hidden w-full" style={{ minHeight: 'auto' }}>
                    {/* Loading indicator while SVG is loading */}
                    {!svgLoaded && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                          <motion.div
                            className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-primary/50 rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Imported SVG Logo */}
                    <motion.img
                      src={splashLogo}
                      alt="SilloBite Logo"
                      initial="hidden"
                      animate="visible"
                      variants={svgVariants}
                      style={{
                        willChange: "opacity, transform",
                        visibility: "visible",
                        transformOrigin: "50% 50%",
                        filter: logoAnimDone && !beginLogoFadeOut ? `drop-shadow(0 0 20px hsl(${primaryColor} / 0.3))` : "none",
                        width: "100%",
                        height: "100%",
                        objectFit: "contain"
                      }}
                      onAnimationComplete={() => {
                        if (!logoAnimDone) {
                          // Fade-in finished → enter STILL phase and show tagline
                          setLogoAnimDone(true);
                          setTaglineVisible(true);
                          stillPhaseStartTimeRef.current = Date.now();
                        }
                      }}
                    />
                  </div>

                  {/* Tagline right below the SVG - Reserved space to prevent SVG movement */}
                  <div className="flex items-center justify-center -mt-20 h-10 w-full">
                    <AnimatePresence>
                      {taglineVisible && (
                        <motion.div
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 12, transition: { duration: 0.3, ease: "easeInOut" } }}
                          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          className="relative"
                        >
                          <motion.p
                            className="text-muted-foreground text-lg font-semibold tracking-wide"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                          >
                            Bite your Fav..!
                          </motion.p>
                          {/* Underline accent */}
                          <motion.div
                            className="absolute -bottom-1 left-0 right-0 h-1"
                            style={{
                              background: `linear-gradient(to right, transparent, hsl(${primaryColor}), transparent)`
                            }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Notification Permission Dialog */}
      <NotificationPermissionDialog
        isOpen={showNotificationDialog}
        onClose={handleNotificationDialogClose}
        userId={user?.id?.toString()}
        userRole={user?.role}
      />
    </>
  );
}