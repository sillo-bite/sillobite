/**
 * Utility functions for managing status bar (notch) color
 * Ensures the status bar color matches the visible UI behind it
 */

/**
 * Converts a CSS color value to hex format
 * Supports: hex, rgb, rgba, hsl, hsla, and named colors
 */
function colorToHex(color: string): string {
  if (!color) return '#D63D31'; // Default fallback
  
  // If already hex, return it
  if (color.startsWith('#')) {
    return color.length === 4 
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  }
  
  // Create a temporary element to compute the color
  const tempDiv = document.createElement('div');
  tempDiv.style.color = color;
  tempDiv.style.position = 'absolute';
  tempDiv.style.visibility = 'hidden';
  document.body.appendChild(tempDiv);
  
  const computedColor = window.getComputedStyle(tempDiv).color;
  document.body.removeChild(tempDiv);
  
  // Parse rgb/rgba
  const rgbMatch = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  
  return '#D63D31'; // Fallback
}

/**
 * Gets the computed background color of an element
 */
function getElementBackgroundColor(element: HTMLElement | null): string {
  if (!element) return '#D63D31'; // Default fallback
  
  const computed = window.getComputedStyle(element);
  let bgColor = computed.backgroundColor;
  
  // If background is transparent, check parent
  if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
    const parent = element.parentElement;
    if (parent) {
      return getElementBackgroundColor(parent);
    }
    // Fallback to body background
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    return bodyBg || '#D63D31';
  }
  
  return bgColor;
}

/**
 * Updates the status bar (notch) color
 * @param color - CSS color value (hex, rgb, hsl, or Tailwind class name)
 * @param selector - Optional CSS selector to get color from element (e.g., '.header', '#header')
 */
export function updateStatusBarColor(color?: string, selector?: string): void {
  let finalColor: string;
  
  if (selector) {
    // Get color from element
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      finalColor = getElementBackgroundColor(element);
    } else {
      // Fallback to provided color or default
      finalColor = color || '#D63D31';
    }
  } else if (color) {
    finalColor = color;
  } else {
    // Default to primary color
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const primaryHsl = computed.getPropertyValue('--primary').trim();
    if (primaryHsl) {
      // Convert HSL to hex
      const tempDiv = document.createElement('div');
      tempDiv.style.color = `hsl(${primaryHsl})`;
      document.body.appendChild(tempDiv);
      const computedColor = window.getComputedStyle(tempDiv).color;
      document.body.removeChild(tempDiv);
      finalColor = computedColor;
    } else {
      finalColor = '#D63D31';
    }
  }
  
  // Convert to hex
  const hexColor = colorToHex(finalColor);
  
  // Update or create theme-color meta tag
  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.setAttribute('name', 'theme-color');
    document.head.insertBefore(metaThemeColor, document.head.firstChild);
  }
  metaThemeColor.setAttribute('content', hexColor);
  
  // Update iOS status bar style
  let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (!appleStatusBar) {
    appleStatusBar = document.createElement('meta');
    appleStatusBar.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
    document.head.appendChild(appleStatusBar);
  }
  
  // Determine if we should use light or dark content based on color brightness
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Use 'black-translucent' for light colors (dark text), 'default' for dark colors (light text)
  appleStatusBar.setAttribute('content', brightness > 128 ? 'black-translucent' : 'default');
}

/**
 * React hook to update status bar color
 * Automatically updates when color or selector changes
 */
export function useStatusBarColor(color?: string, selector?: string) {
  if (typeof window === 'undefined') return;
  
  // Use useEffect-like behavior
  const update = () => {
    updateStatusBarColor(color, selector);
  };
  
  // Update immediately
  update();
  
  // Update when selector element appears/changes
  if (selector) {
    const observer = new MutationObserver(() => {
      update();
    });
    
    const element = document.querySelector(selector);
    if (element) {
      observer.observe(element, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        childList: false,
        subtree: false
      });
    }
    
    // Also observe for element creation
    const checkInterval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el && !observer.takeRecords().length) {
        update();
      }
    }, 100);
    
    return () => {
      observer.disconnect();
      clearInterval(checkInterval);
    };
  }
}

/**
 * Maps Tailwind color classes to hex values
 * This is a helper for common Tailwind colors used in headers
 */
const tailwindColorMap: Record<string, string> = {
  'bg-red-600': '#DC2626',
  'bg-red-700': '#B91C1C',
  'bg-green-600': '#16A34A',
  'bg-green-700': '#15803D',
  'bg-amber-600': '#D97706',
  'bg-amber-700': '#B45309',
  'bg-yellow-600': '#CA8A04',
  'bg-yellow-700': '#A16207',
  'bg-orange-600': '#EA580C',
  'bg-orange-700': '#C2410C',
  'bg-slate-600': '#475569',
  'bg-slate-700': '#334155',
};

/**
 * Gets hex color from Tailwind class name
 */
export function getColorFromTailwindClass(className: string): string {
  // Extract bg-{color}-{shade} pattern
  const match = className.match(/bg-(\w+)-(\d+)/);
  if (match) {
    const fullClass = `bg-${match[1]}-${match[2]}`;
    if (tailwindColorMap[fullClass]) {
      return tailwindColorMap[fullClass];
    }
  }
  
  // Fallback: try to get from element with that class
  const tempDiv = document.createElement('div');
  tempDiv.className = className;
  tempDiv.style.position = 'absolute';
  tempDiv.style.visibility = 'hidden';
  document.body.appendChild(tempDiv);
  const computed = window.getComputedStyle(tempDiv);
  const bgColor = computed.backgroundColor;
  document.body.removeChild(tempDiv);
  
  return colorToHex(bgColor);
}

