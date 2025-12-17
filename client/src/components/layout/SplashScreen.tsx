import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { isPWAInstalled, getPWAAuthState } from "@/utils/pwaAuth";
import { serverRestartDetector } from "@/utils/devUpdateDetector";
import { AppUpdater } from "@/utils/appUpdater";
import NotificationPermissionDialog from "@/components/modals/NotificationPermissionDialog";
import MaintenanceScreen from "@/components/layout/MaintenanceScreen";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { apiRequest } from "@/lib/queryClient";
import { updateStatusBarColor } from "@/utils/statusBar";

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
            if (userForRedirect.role === 'super_admin') {
              const redirectUrl = isPWALaunch ? formatRedirectUrl("/admin") : "/admin";
              setLocation(redirectUrl);
              return;
            } else if (userForRedirect.role === 'canteen_owner' || userForRedirect.role === 'canteen-owner') {
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
            } else if (userForRedirect.role === 'delivery_person') {
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

  // Enhanced path animation variants with stagger effect
  const pathVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      pathLength: 0
    },
    visible: {
      opacity: 1,
      scale: 1,
      pathLength: 1,
      transition: {
        opacity: { duration: 0.6, ease: "easeOut" },
        scale: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
        pathLength: { duration: 1.2, ease: "easeInOut" }
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
        <div className="flex flex-col items-center relative z-10 gap-4">
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
                  className="w-80 h-auto mb-4 flex items-center justify-center relative"
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
                    Sillobyte
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
                  className="w-80 h-auto mb-4 relative"
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
                  
                  <div className="relative overflow-hidden">

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
                  
                  {/* Optimized SVG with will-change for better performance */}
                  <motion.svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="100%"
                    height="100%"
                    viewBox="200 550 1200 400"
                    preserveAspectRatio="xMidYMid meet"
                    initial="hidden"
                    animate="visible"
                    variants={svgVariants}
                    style={{ 
                      willChange: "opacity, transform",
                      visibility: "visible",
                      transformOrigin: "50% 50%",
                      filter: logoAnimDone && !beginLogoFadeOut ? `drop-shadow(0 0 20px hsl(${primaryColor} / 0.3))` : "none"
                    }}
                    fill={`hsl(${primaryColor})`}
                    onAnimationComplete={() => {
                      if (!logoAnimDone) {
                        // Fade-in finished → enter STILL phase and show tagline
                        setLogoAnimDone(true);
                        setTaglineVisible(true);
                        stillPhaseStartTimeRef.current = Date.now();
                      }
                    }}
                  >
                    {/* SVG paths with animation - using CSS transform for better performance */}
                    <motion.path variants={pathVariants} d="M 525.949219 590.300781 C 524.621094 591.628906 523.289062 609.789062 523.289062 630.160156 C 523.289062 670.460938 529.933594 690.832031 545.433594 695.707031 C 550.304688 697.035156 554.292969 702.347656 554.292969 706.777344 C 554.292969 717.40625 564.921875 714.304688 580.421875 699.25 C 586.179688 693.492188 592.378906 689.0625 594.152344 689.0625 C 602.121094 689.0625 607.878906 661.605469 606.550781 626.617188 C 604.78125 577.457031 596.808594 580.113281 595.035156 630.160156 C 593.707031 672.675781 585.292969 689.0625 564.476562 689.0625 C 543.21875 689.0625 536.578125 675.332031 536.578125 631.929688 C 536.578125 595.171875 533.476562 582.773438 525.949219 590.300781 Z M 525.949219 590.300781" />
                    <motion.path variants={pathVariants} d="M 548.09375 590.300781 C 546.761719 591.628906 545.433594 607.574219 545.433594 624.84375 C 545.433594 650.089844 547.207031 658.0625 553.40625 663.820312 C 571.5625 680.648438 579.980469 669.574219 581.308594 627.058594 C 582.191406 605.359375 580.421875 593.84375 577.320312 592.515625 C 573.335938 591.1875 572.007812 600.929688 572.007812 624.402344 C 572.007812 651.417969 570.679688 658.0625 565.363281 658.0625 C 560.050781 658.0625 558.722656 651.417969 558.722656 625.289062 C 558.722656 594.730469 555.179688 583.214844 548.09375 590.300781 Z M 548.09375 590.300781" />
                    <motion.path variants={pathVariants} d="M 253.136719 791.367188 L 253.136719 920.242188 L 331.96875 918.027344 C 381.128906 916.699219 417 914.042969 428.074219 910.058594 C 452.429688 902.085938 493.175781 860.453125 500.261719 836.984375 C 503.363281 826.796875 505.574219 805.539062 505.574219 789.59375 C 505.574219 749.734375 486.089844 710.761719 455.089844 690.390625 C 420.988281 667.363281 397.515625 662.488281 320.898438 662.488281 L 253.136719 662.488281 Z M 424.085938 688.621094 C 466.160156 707.664062 487.859375 739.105469 490.960938 786.496094 C 492.289062 804.210938 490.960938 820.597656 487.417969 828.566406 C 484.316406 835.652344 481.660156 843.183594 481.660156 844.511719 C 480.332031 853.8125 451.988281 880.828125 432.945312 890.570312 C 412.128906 901.640625 405.484375 902.972656 343.484375 904.742188 C 297.867188 906.515625 275.28125 905.628906 273.507812 902.085938 C 271.738281 899.429688 270.410156 849.382812 270.410156 790.480469 C 270.410156 708.105469 271.738281 681.976562 276.167969 679.320312 C 279.265625 677.105469 308.9375 676.21875 342.15625 677.105469 C 391.3125 678.875 406.371094 681.089844 424.085938 688.621094 Z M 424.085938 688.621094" />
                    <motion.path variants={pathVariants} d="M 304.953125 702.347656 L 293.4375 711.207031 L 294.765625 790.921875 C 296.097656 893.226562 293.882812 890.128906 359.425781 887.46875 C 396.1875 886.140625 408.585938 883.925781 419.214844 877.285156 C 455.089844 853.8125 465.71875 832.996094 464.386719 788.710938 C 463.503906 760.363281 461.289062 753.277344 450.214844 736.894531 C 430.289062 708.105469 397.957031 693.933594 352.339844 693.492188 C 322.667969 693.492188 314.253906 695.261719 304.953125 702.347656 Z M 409.472656 717.40625 C 453.757812 739.105469 466.601562 809.082031 433.386719 847.167969 C 413.457031 869.753906 397.515625 875.070312 349.683594 875.070312 L 308.496094 875.070312 L 308.496094 705.890625 L 350.570312 707.664062 C 380.242188 708.546875 397.515625 711.648438 409.472656 717.40625 Z M 409.472656 717.40625" />
                    <motion.path variants={pathVariants} d="M 715.054688 728.921875 C 705.3125 733.351562 695.570312 739.105469 694.242188 741.765625 C 688.925781 750.179688 682.726562 747.078125 682.726562 735.5625 C 682.726562 724.933594 681.398438 724.492188 658.8125 724.492188 L 635.339844 724.492188 L 635.78125 821.925781 L 636.222656 919.355469 L 687.15625 919.355469 L 687.15625 862.226562 C 687.15625 830.78125 688.925781 799.78125 691.582031 793.582031 C 696.453125 780.292969 720.371094 764.351562 734.984375 764.351562 C 751.8125 764.351562 769.972656 776.308594 775.285156 791.367188 C 777.945312 799.339844 780.160156 831.226562 780.160156 862.226562 L 780.160156 919.355469 L 828.875 919.355469 L 828.875 850.710938 C 828.875 779.410156 825.332031 760.363281 807.617188 740.878906 C 790.34375 721.390625 744.726562 715.636719 715.054688 728.921875 Z M 686.269531 754.164062 C 689.8125 755.492188 701.328125 752.394531 712.398438 746.636719 C 728.34375 738.664062 737.640625 737.335938 758.457031 738.664062 C 804.960938 742.207031 815.144531 761.25 815.589844 846.726562 C 815.589844 884.8125 814.257812 897.214844 808.945312 901.640625 C 796.542969 911.828125 793.445312 901.640625 793.445312 851.597656 C 793.445312 791.808594 785.914062 770.109375 761.113281 758.59375 C 741.628906 749.292969 729.226562 749.292969 709.742188 759.035156 C 681.398438 773.207031 676.527344 785.167969 673.867188 845.398438 C 671.652344 897.214844 671.210938 899.429688 661.910156 900.757812 L 651.722656 902.085938 L 651.722656 825.46875 C 651.722656 742.207031 654.382812 732.019531 671.210938 744.421875 C 676.527344 747.964844 683.167969 752.394531 686.269531 754.164062 Z M 686.269531 754.164062" />
                    <motion.path variants={pathVariants} d="M 941.808594 724.050781 C 879.363281 739.992188 846.148438 806.867188 872.71875 863.996094 C 898.847656 920.6875 978.125 940.171875 1034.367188 903.414062 L 1051.199219 891.898438 L 1037.027344 877.285156 L 1022.855469 862.667969 L 1008.683594 871.082031 C 991.851562 881.269531 957.75 882.15625 939.59375 872.855469 C 928.519531 867.097656 913.019531 846.28125 913.019531 837.425781 C 913.019531 836.097656 947.121094 835.210938 988.753906 835.210938 L 1064.925781 835.210938 L 1062.269531 810.851562 C 1059.167969 778.523438 1042.339844 750.179688 1017.980469 736.007812 C 997.609375 724.050781 962.621094 718.734375 941.808594 724.050781 Z M 1003.367188 743.980469 C 1044.554688 761.25 1061.382812 835.652344 1020.640625 820.152344 C 1014.4375 817.496094 1014.4375 816.609375 1021.082031 809.082031 C 1026.839844 802.4375 1027.726562 798.453125 1023.738281 788.265625 C 1010.453125 754.164062 975.464844 739.105469 941.363281 753.277344 C 910.363281 766.121094 893.535156 798.894531 910.804688 813.066406 C 918.335938 819.265625 919.664062 830.78125 913.464844 830.78125 C 911.25 830.78125 907.707031 834.769531 906.378906 839.640625 C 901.507812 854.699219 919.222656 877.285156 944.464844 887.914062 C 967.496094 898.097656 973.25 898.097656 1013.996094 885.699219 C 1025.066406 882.597656 1027.28125 888.800781 1017.097656 897.214844 C 1007.796875 904.742188 958.636719 907.84375 937.378906 902.085938 C 917.007812 896.769531 887.777344 870.640625 883.347656 853.367188 C 881.578125 847.167969 879.804688 830.78125 879.804688 817.054688 C 879.804688 770.550781 914.792969 738.222656 965.28125 737.777344 C 978.125 737.777344 995.394531 740.4375 1003.367188 743.980469 Z M 1002.925781 777.636719 C 1009.566406 784.722656 1014.882812 794.910156 1014.882812 799.78125 C 1014.882812 808.195312 1011.78125 808.636719 963.953125 808.636719 C 906.820312 808.636719 904.164062 806.867188 924.976562 782.066406 C 940.035156 763.90625 950.664062 759.480469 972.808594 762.136719 C 985.652344 763.464844 994.066406 767.449219 1002.925781 777.636719 Z M 1002.925781 777.636719" />
                    <motion.path variants={pathVariants} d="M 1265.105469 724.492188 C 1262.449219 728.476562 1281.050781 731.578125 1291.679688 728.921875 C 1294.335938 728.035156 1308.949219 726.265625 1324.894531 724.492188 C 1353.238281 721.390625 1353.238281 721.390625 1310.722656 720.507812 C 1286.363281 720.507812 1266.878906 721.835938 1265.105469 724.492188 Z M 1265.105469 724.492188" />
                    <motion.path variants={pathVariants} d="M 552.519531 737.777344 C 539.675781 753.277344 534.363281 782.066406 538.792969 809.523438 C 540.5625 820.152344 541.890625 846.28125 541.449219 867.984375 C 541.003906 898.984375 542.335938 909.171875 548.09375 915.8125 C 557.835938 926 572.894531 926 582.636719 915.371094 C 590.164062 907.398438 590.164062 900.757812 584.851562 815.722656 C 579.980469 734.234375 578.207031 724.492188 571.5625 724.492188 C 567.578125 724.492188 558.722656 730.691406 552.519531 737.777344 Z M 572.894531 848.496094 C 574.222656 905.628906 573.777344 908.285156 565.363281 908.285156 C 556.949219 908.285156 556.507812 905.183594 556.507812 868.425781 C 556.507812 844.070312 554.292969 824.582031 550.75 818.382812 C 544.550781 807.308594 549.421875 768.335938 559.605469 749.734375 C 564.476562 740.878906 565.363281 741.765625 568.019531 764.351562 C 569.792969 777.636719 572.007812 815.722656 572.894531 848.496094 Z M 572.894531 848.496094" />
                    <motion.path variants={pathVariants} d="M 1081.3125 744.421875 L 1081.3125 763.90625 L 1131.359375 765.238281 L 1181.847656 766.566406 L 1131.359375 827.683594 C 1088.84375 879.5 1081.3125 891.011719 1081.3125 903.855469 L 1081.3125 919.355469 L 1256.25 919.355469 L 1254.921875 899.429688 L 1253.148438 879.5 L 1225.691406 879.054688 C 1211.074219 879.054688 1186.71875 879.054688 1172.546875 879.5 L 1146.414062 880.382812 L 1165.902344 856.027344 C 1176.53125 843.183594 1200.003906 814.394531 1217.71875 792.695312 C 1242.519531 761.695312 1249.605469 750.179688 1249.605469 739.105469 L 1249.605469 724.492188 L 1081.3125 724.492188 Z M 1219.933594 740.4375 C 1226.578125 741.765625 1231.890625 744.863281 1231.890625 747.078125 C 1231.890625 751.949219 1213.289062 778.082031 1199.117188 793.136719 C 1176.972656 817.054688 1143.316406 865.769531 1143.316406 874.625 C 1143.316406 887.46875 1157.488281 892.34375 1198.675781 893.226562 C 1223.476562 893.671875 1231.890625 895.441406 1231.890625 899.871094 C 1231.890625 904.742188 1219.492188 906.070312 1171.21875 906.070312 C 1137.558594 906.070312 1107.441406 904.300781 1103.898438 902.085938 C 1096.371094 897.214844 1100.355469 885.257812 1113.644531 870.640625 C 1141.542969 840.082031 1187.601562 779.410156 1187.601562 773.207031 C 1187.601562 758.59375 1173.429688 751.949219 1141.101562 750.621094 C 1107 749.734375 1095.484375 746.191406 1112.316406 742.207031 C 1127.816406 738.664062 1205.316406 737.335938 1219.933594 740.4375 Z M 1219.933594 740.4375" />
                    <motion.path variants={pathVariants} d="M 1207.53125 835.652344 C 1198.675781 837.867188 1204.433594 838.753906 1226.578125 839.195312 C 1243.847656 839.195312 1258.464844 837.867188 1258.464844 836.097656 C 1258.464844 832.109375 1225.691406 831.667969 1207.53125 835.652344 Z M 1207.53125 835.652344" />
                    <motion.path variants={pathVariants} d="M 1260.675781 879.5 C 1263.777344 884.8125 1328.4375 884.8125 1353.679688 879.941406 C 1366.96875 876.839844 1356.78125 875.957031 1314.707031 875.511719 C 1277.949219 875.070312 1258.90625 876.839844 1260.675781 879.5 Z M 1260.675781 879.5" />
                    <motion.path variants={pathVariants} d="M 1269.535156 914.929688 C 1267.761719 917.585938 1277.507812 919.355469 1296.550781 919.355469 C 1312.9375 919.355469 1325.335938 918.472656 1324.453125 917.585938 C 1320.023438 913.15625 1272.191406 910.5 1269.535156 914.929688 Z M 1269.535156 914.929688" />
                  </motion.svg>
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>

          {/* Enhanced tagline sequence with reserved space to keep SVG fixed in place */}
          <div className="h-8 flex items-center justify-center mt-0">
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
                    Elevating Culinary Experiences
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