import { useEffect, useRef, useState } from 'react';

// Animation timing constants
export const ANIMATION_TIMING = {
  ENTER_DURATION: 200,
  EXIT_DURATION: 150,
  STAGGER_DELAY: 50,
  HOVER_DURATION: 100,
  EASING: {
    EASE_OUT: 'cubic-bezier(0.16, 1, 0.3, 1)',
    EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
    EASE_IN_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
};

// CSS animation classes
export const DROPDOWN_ANIMATIONS = {
  // Enter animations
  ENTER: 'animate-dropdown-enter',
  ENTER_ACTIVE: 'animate-dropdown-enter-active',
  
  // Exit animations
  EXIT: 'animate-dropdown-exit',
  EXIT_ACTIVE: 'animate-dropdown-exit-active',
  
  // Stagger animations
  STAGGER: 'animate-dropdown-stagger',
  
  // Bounce effect
  BOUNCE: 'animate-dropdown-bounce',
  
  // Backdrop
  BACKDROP: 'animate-dropdown-backdrop',
  BACKDROP_ACTIVE: 'animate-dropdown-backdrop-active'
};

// Hook for dropdown animations
export function useDropdownAnimation(isOpen: boolean, delay: number = 0) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimating(true);
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Trigger animation after a small delay
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, ANIMATION_TIMING.ENTER_DURATION + delay);
    } else {
      setIsAnimating(true);
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Hide after exit animation
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsAnimating(false);
      }, ANIMATION_TIMING.EXIT_DURATION + delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen, delay]);

  return {
    shouldRender,
    isAnimating,
    animationClass: isOpen 
      ? `${DROPDOWN_ANIMATIONS.ENTER} ${isAnimating ? DROPDOWN_ANIMATIONS.ENTER_ACTIVE : ''}`
      : `${DROPDOWN_ANIMATIONS.EXIT} ${isAnimating ? DROPDOWN_ANIMATIONS.EXIT_ACTIVE : ''}`
  };
}

// Hook for staggered animations
export function useStaggeredAnimation(itemCount: number, isVisible: boolean) {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);

  useEffect(() => {
    if (isVisible) {
      // Show items with stagger
      const timeouts: NodeJS.Timeout[] = [];
      
      for (let i = 0; i < itemCount; i++) {
        const timeout = setTimeout(() => {
          setVisibleItems(prev => [...prev, i]);
        }, i * ANIMATION_TIMING.STAGGER_DELAY);
        
        timeouts.push(timeout);
      }

      return () => {
        timeouts.forEach(clearTimeout);
      };
    } else {
      // Hide all items immediately
      setVisibleItems([]);
    }
  }, [isVisible, itemCount]);

  return visibleItems;
}

// Utility for checking reduced motion preference
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

// Hook for mobile-specific animations
export function useMobileAnimations() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Hook for touch-friendly animations
export function useTouchAnimations() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return isTouchDevice;
}

// Accessibility hook for focus management
export function useDropdownAccessibility(isOpen: boolean) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      // Focus first focusable element in dropdown
      const firstFocusable = dropdownRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      
      if (firstFocusable) {
        firstFocusable.focus();
      }
    } else if (!isOpen && triggerRef.current) {
      // Return focus to trigger when dropdown closes
      triggerRef.current.focus();
    }
  }, [isOpen]);

  return { dropdownRef, triggerRef };
}

// Animation variants for different dropdown types
export const DROPDOWN_VARIANTS = {
  // Standard dropdown (slide down + fade)
  standard: {
    initial: { opacity: 0, y: -10, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.95 }
  },
  
  // Slide from top
  slideTop: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },
  
  // Scale + fade
  scale: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 }
  },
  
  // Height transition
  height: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 }
  }
};

// Backdrop animation variants
export const BACKDROP_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

// Stagger animation for list items
export const STAGGER_VARIANTS = {
  container: {
    animate: {
      transition: {
        staggerChildren: 0.05
      }
    }
  },
  item: {
    initial: { opacity: 0, y: -5 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -5 }
  }
};
