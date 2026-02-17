
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';
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

interface PWAContextType {
    deferredPrompt: BeforeInstallPromptEvent | null;
    showInstallBanner: boolean;
    setShowInstallBanner: (show: boolean) => void;
    isInstalled: boolean;
    showInstructions: boolean;
    setShowInstructions: (show: boolean) => void;
    isIOS: boolean;
    isAndroid: boolean;
    isSafari: boolean;
    installPWA: () => Promise<void>;
    dismissBanner: () => void;
    preventInstallation: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export const PWAProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [isSafari, setIsSafari] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [preventInstallation, setPreventInstallation] = useState(false);
    const [location] = useLocation();

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
                            // Only auto-show on certain conditions, handled by consumer components or here?
                            // Let's keep the logic here for banner visibility BUT controlled via context state
                            // We'll set a flag that the banner COULD be shown
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
                    // Store deferredPrompt on window for landing page to access - legacy support
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

    const installPWA = async () => {
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

    const dismissBanner = () => {
        setShowInstallBanner(false);
        // Remember dismissal for this session
        sessionStorage.setItem('pwa-install-dismissed', 'true');
    };

    return (
        <PWAContext.Provider
            value={{
                deferredPrompt,
                showInstallBanner,
                setShowInstallBanner,
                isInstalled,
                showInstructions,
                setShowInstructions,
                isIOS,
                isAndroid,
                isSafari,
                installPWA,
                dismissBanner,
                preventInstallation
            }}
        >
            {children}
        </PWAContext.Provider>
    );
};

export const usePWA = () => {
    const context = useContext(PWAContext);
    if (context === undefined) {
        throw new Error('usePWA must be used within a PWAProvider');
    }
    return context;
};
