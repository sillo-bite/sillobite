import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { X, Smartphone, AlertCircle, PlusSquare } from 'lucide-react';
import {
  isPWAAlreadyInstalled,
  markPWAAsInstalled,
  shouldPreventInstallation,
  isMobileDevice
} from '@/utils/pwaInstallTracker';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function InstallPWA() {
  const [location] = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [preventInstallation, setPreventInstallation] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let iosTimer: NodeJS.Timeout | null = null;
    let generalTimer: NodeJS.Timeout | null = null;
    let handleBeforeInstallPrompt: ((e: BeforeInstallPromptEvent) => void) | null = null;
    let handleAppInstalled: (() => void) | null = null;

    const setupInstallPrompts = async () => {
      setIsChecking(true);

      // Check if app is already installed using comprehensive detection
      const alreadyInstalled = await isPWAAlreadyInstalled();

      if (alreadyInstalled) {
        if (isMounted) {
          setIsInstalled(true);
          setIsChecking(false);
        }
        return;
      }

      // For mobile devices, check if we should prevent installation
      const shouldPrevent = await shouldPreventInstallation();
      if (shouldPrevent) {
        if (isMounted) {
          setPreventInstallation(true);
          setIsInstalled(true);
          setIsChecking(false);
        }
        return;
      }

      if (!isMounted) return;

      setIsChecking(false);

      // Only set up install prompts if not already installed and not prevented
      if (isInstalled || preventInstallation) {
        return;
      }

      // Detect device type and browser
      const iosDetected = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const androidDetected = /Android/.test(navigator.userAgent);
      const isSafariBrowser = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

      if (isMounted) {
        setIsIOS(iosDetected);
        setIsAndroid(androidDetected);
        setIsSafari(isSafariBrowser);
      }

      const isInStandaloneMode = (window.navigator as any).standalone;

      // For iOS: Only show install banner if we're sure it's not already installed
      // Double-check installation status before showing banner
      if (iosDetected) {
        // Re-check installation status specifically for iOS
        const recheckInstalled = await isPWAAlreadyInstalled();
        if (recheckInstalled) {
          if (isMounted) {
            setPreventInstallation(true);
            setIsInstalled(true);
          }
          return;
        }

        // Only show banner if not in standalone mode and not already installed
        if (!isInStandaloneMode && isSafariBrowser) {
          iosTimer = setTimeout(() => {
            if (isMounted && !isInstalled && !preventInstallation) {
              setShowInstallBanner(true);
            }
          }, 2000);
        } else if (!isInStandaloneMode && !isSafariBrowser) {
          iosTimer = setTimeout(() => {
            if (isMounted && !isInstalled && !preventInstallation) {
              setShowInstallBanner(true);
            }
          }, 3000);
        }
      }

      // Listen for the beforeinstallprompt event
      handleBeforeInstallPrompt = async (e: BeforeInstallPromptEvent) => {
        // Double-check if installation should be prevented (mobile devices)
        const shouldPrevent = await shouldPreventInstallation();
        if (shouldPrevent) {
          e.preventDefault();
          if (isMounted) {
            setPreventInstallation(true);
            setIsInstalled(true);
          }
          return;
        }

        e.preventDefault();
        if (isMounted) {
          setDeferredPrompt(e);
          setShowInstallBanner(true);
          // Store deferredPrompt on window for landing page to access
          (window as any).deferredPrompt = e;
        }
      };

      // Listen for app installed event
      handleAppInstalled = () => {
        markPWAAsInstalled(); // Mark as installed in storage
        if (isMounted) {
          setIsInstalled(true);
          setShowInstallBanner(false);
          setDeferredPrompt(null);
          // Clear from window
          delete (window as any).deferredPrompt;
        }
      };

      if (handleBeforeInstallPrompt) {
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      }
      if (handleAppInstalled) {
        window.addEventListener('appinstalled', handleAppInstalled);
      }

      // Show install banner after a delay if no install prompt is available
      generalTimer = setTimeout(() => {
        if (isMounted && !deferredPrompt && !isInstalled && !preventInstallation) {
          setShowInstallBanner(true);
        }
      }, 3000);
    };

    setupInstallPrompts();

    return () => {
      isMounted = false;
      if (iosTimer) clearTimeout(iosTimer);
      if (generalTimer) clearTimeout(generalTimer);
      if (handleBeforeInstallPrompt) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      }
      if (handleAppInstalled) {
        window.removeEventListener('appinstalled', handleAppInstalled);
      }
    };
  }, [deferredPrompt, isInstalled, preventInstallation]);

  const handleInstallClick = async () => {
    // Final check before allowing installation
    if (isMobileDevice()) {
      const shouldPrevent = await shouldPreventInstallation();
      if (shouldPrevent) {
        setPreventInstallation(true);
        setIsInstalled(true);
        return;
      }
    }

    if (deferredPrompt) {
      // Show the install prompt
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
          // Mark as installed immediately (appinstalled event will also fire)
          markPWAAsInstalled();
          setDeferredPrompt(null);
          setShowInstallBanner(false);
          // Clear from window
          delete (window as any).deferredPrompt;
        }
      } catch (error) {
        console.error('Error showing install prompt:', error);
      }
    } else {
      // Show manual installation instructions
      setShowInstructions(true);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    // Remember dismissal for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show install banner on landing page (root route) or home page
  if (location === '/' || location === '/landing' || location === '/app' || location.startsWith('/app/')) {
    return null;
  }

  // Don't show banner if checking, already installed, prevented, or previously dismissed
  if (isChecking || isInstalled || preventInstallation || sessionStorage.getItem('pwa-install-dismissed')) {
    // Show a message if installation is prevented on mobile
    if (preventInstallation && isMobileDevice()) {
      return (
        <div className="fixed top-4 left-4 right-4 z-50 bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm mx-auto">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-card-foreground text-sm">
                Already Installed
              </h3>
              <p className="text-xs text-muted-foreground">
                This app is already installed on your device. Use the app icon on your home screen.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  if (showInstructions) {
    return (
      <div className="fixed top-4 left-4 right-4 z-50 bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm mx-auto">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Install App</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInstructions(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
          {isIOS ? (
            isSafari ? (
              <>
                <p className="font-medium">iPhone/iPad Installation (Safari):</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Tap the share button <span className="bg-gray-200 dark:bg-gray-700 px-1 rounded">□↗</span> at the bottom</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Edit the name if desired, then tap "Add"</li>
                  <li>The app icon will appear on your home screen</li>
                </ol>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  ✅ Perfect! You're using Safari - installation will work great
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">iPhone/iPad Installation:</p>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-2">
                    ⚠️ To install on iPhone, you need to use Safari browser
                  </p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                    <li>Copy this website's URL</li>
                    <li>Open Safari browser</li>
                    <li>Paste the URL and visit the site</li>
                    <li>Then tap share <span className="bg-gray-200 dark:bg-gray-700 px-1 rounded">□↗</span> and "Add to Home Screen"</li>
                  </ol>
                </div>
              </>
            )
          ) : isAndroid ? (
            <>
              <p className="font-medium">Android Installation:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Tap the menu (⋮) in Chrome</li>
                <li>Look for "Install app" or "Add to Home screen"</li>
                <li>Tap "Install" when prompted</li>
                <li>The app will be installed like a native app</li>
              </ol>
            </>
          ) : (
            <>
              <p className="font-medium">Desktop Installation:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Look for the install icon in your browser's address bar</li>
                <li>Click "Install" when prompted</li>
                <li>The app will open in its own window</li>
              </ol>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!showInstallBanner) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 px-3 sm:px-4 animate-[dropdown-enter_0.22s_ease-out]">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-border/80 bg-card/95 px-3 py-3 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.4)] backdrop-blur supports-[backdrop-filter]:backdrop-blur-md ring-1 ring-white/5 dark:border-white/8 dark:bg-[#1a0a2e]/95 dark:ring-white/10 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.03),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(114,68,145,0.06),transparent_55%)]">
        <img
          src="/logo.png"
          alt="SilloBite logo"
          className="h-12 w-12 rounded-xl object-contain shadow bg-white p-1"
          loading="lazy"
        />

        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground">
            Add SilloBite to your home screen
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="h-9 rounded-full px-4 text-xs font-semibold shadow-lg hover:shadow-xl"
            data-testid="button-install-pwa"
            title="Adds SilloBite to your home screen for quick access."
            aria-label="Add SilloBite shortcut to home screen"
          >
            <PlusSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Add shortcut</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-card-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}