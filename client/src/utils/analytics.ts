// Google Analytics and Search Console Integration for SilloBite

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Google Analytics 4 Configuration
export const GA_TRACKING_ID = 'G-XXXXXXXXXX'; // Replace with your actual GA4 tracking ID

// Initialize Google Analytics
export const initGoogleAnalytics = () => {
  if (typeof window !== 'undefined' && GA_TRACKING_ID) {
    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    const gtag = function (...args: any[]) {
      window.dataLayer.push(args);
    };
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_TRACKING_ID, {
      page_title: document.title,
      page_location: window.location.href,
    });

    // Make gtag available globally
    (window as any).gtag = gtag;
  }
};

// Track page views
export const trackPageView = (url: string, title?: string) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', GA_TRACKING_ID, {
      page_path: url,
      page_title: title || document.title,
    });
  }
};

// Track custom events
export const trackEvent = (action: string, category: string, label?: string, value?: number, additionalParams?: Record<string, unknown>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      ...additionalParams,
    });
  }
};

// Payment-specific analytics tracking
export const trackPaymentEvent = (
  eventName: 'callback.started' | 'callback.success' | 'callback.failed' | 'callback.pending' | 'verification.failed' | 'status.check' | 'callback.timeout',
  params?: {
    transactionId?: string;
    orderNumber?: string;
    duration?: number;
    error?: string;
    retryCount?: number;
  }
) => {
  trackEvent(
    `payment.${eventName}`,
    'payment',
    params?.transactionId,
    params?.duration,
    {
      transaction_id: params?.transactionId,
      order_number: params?.orderNumber,
      duration_ms: params?.duration,
      error: params?.error,
      retry_count: params?.retryCount,
    }
  );
};

// Track food ordering events
export const trackFoodOrderEvent = (eventType: 'view_menu' | 'add_to_cart' | 'checkout' | 'purchase', itemName?: string, value?: number) => {
  trackEvent(eventType, 'food_ordering', itemName, value);
};

// Track user engagement
export const trackUserEngagement = (action: string, details?: any) => {
  trackEvent(action, 'user_engagement', JSON.stringify(details));
};

// Track search queries
export const trackSearch = (searchTerm: string, resultsCount?: number) => {
  trackEvent('search', 'site_search', searchTerm, resultsCount);
};

// Track PWA events
export const trackPWAEvent = (eventType: 'install' | 'launch' | 'update') => {
  trackEvent(eventType, 'pwa', undefined, undefined);
};

// Track performance metrics
export const trackPerformance = (metric: string, value: number) => {
  trackEvent('performance', 'core_web_vitals', metric, value);
};

// Enhanced ecommerce tracking for food orders
export const trackPurchase = (orderData: {
  transactionId: string;
  value: number;
  currency: string;
  items: Array<{
    itemId: string;
    itemName: string;
    category: string;
    quantity: number;
    price: number;
  }>;
}) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'purchase', {
      transaction_id: orderData.transactionId,
      value: orderData.value,
      currency: orderData.currency,
      items: orderData.items,
    });
  }
};

// Track user demographics (if available)
export const trackUserDemographics = (college?: string, department?: string) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', GA_TRACKING_ID, {
      custom_map: {
        'college': college,
        'department': department,
      },
    });
  }
};

// Google Search Console integration
export const submitSitemapToSearchConsole = () => {
  // This would typically be done through Google Search Console web interface
  // But we can provide the sitemap URL for manual submission
  const sitemapUrl = 'https://sillobite.onrender.com/sitemap.xml';
  console.log('Submit this sitemap URL to Google Search Console:', sitemapUrl);

  // You can also use the Search Console API if you have the proper credentials
  // fetch('https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fsillobite.onrender.com%2F/sitemaps', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${ACCESS_TOKEN}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     path: '/sitemap.xml',
  //     type: 'WEB'
  //   })
  // });
};

// SEO performance monitoring
export const trackSEOMetrics = () => {
  // Track Core Web Vitals
  if ('web-vital' in window) {
    import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
      onCLS((metric) => trackPerformance(metric.name, metric.value));
      onINP((metric) => trackPerformance(metric.name, metric.value));
      onFCP((metric) => trackPerformance(metric.name, metric.value));
      onLCP((metric) => trackPerformance(metric.name, metric.value));
      onTTFB((metric) => trackPerformance(metric.name, metric.value));
    });
  }
};

// Initialize all analytics
export const initAnalytics = () => {
  initGoogleAnalytics();
  trackSEOMetrics();

  // Track initial page view
  trackPageView(window.location.pathname, document.title);

  // Track PWA launch if applicable
  if (window.matchMedia('(display-mode: standalone)').matches) {
    trackPWAEvent('launch');
  }
};

// Export for use in components
export default {
  initAnalytics,
  trackPageView,
  trackEvent,
  trackFoodOrderEvent,
  trackUserEngagement,
  trackSearch,
  trackPWAEvent,
  trackPurchase,
  trackUserDemographics,
  submitSitemapToSearchConsole,
};
