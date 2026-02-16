// SEO Utility Functions for Digital Canteen

export interface SEOConfig {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
  structuredData?: object;
}

// Default SEO configuration
export const defaultSEO: SEOConfig = {
  title: "SilloBite - Order Food Online from College Canteens | Fast & Convenient",
  description: "Order delicious food from your college canteen with SilloBite. Fast, convenient, and secure online food ordering platform for students. Browse menus, place orders, and enjoy quick delivery.",
  keywords: [
    "college canteen",
    "food ordering",
    "online food delivery",
    "student meals",
    "campus dining",
    "food app",
    "canteen management",
    "college food",
    "student dining",
    "food ordering app"
  ],
  canonicalUrl: "https://sillobite.onrender.com",
  ogImage: "https://sillobite.onrender.com/api/icon.png?size=512",
  ogType: "website"
};

// Page-specific SEO configurations
export const pageSEOConfigs: Record<string, Partial<SEOConfig>> = {
  home: {
    title: "SilloBite - Order Food Online from College Canteens | Fast & Convenient",
    description: "Order delicious food from your college canteen with SilloBite. Fast, convenient, and secure online food ordering platform for students.",
    keywords: ["college canteen", "food ordering", "online food delivery", "student meals", "campus dining"]
  },
  menu: {
    title: "Browse Menu - SilloBite | College Food Ordering",
    description: "Browse our extensive menu of delicious food items available at your college canteen. Order online with SilloBite for quick and convenient delivery.",
    keywords: ["college menu", "canteen food", "food items", "college dining", "student meals"]
  },
  cart: {
    title: "Shopping Cart - SilloBite | Review Your Order",
    description: "Review your food order before checkout. Add or remove items from your cart and proceed to secure payment with SilloBite.",
    keywords: ["shopping cart", "food order", "checkout", "college canteen", "online ordering"]
  },
  checkout: {
    title: "Checkout - SilloBite | Secure Payment",
    description: "Complete your food order with secure payment options. Fast and reliable checkout process for college canteen orders.",
    keywords: ["checkout", "payment", "food order", "secure payment", "college canteen"]
  },
  orders: {
    title: "Order History - SilloBite | Track Your Orders",
    description: "View your order history and track current orders. Manage your college canteen food orders with SilloBite.",
    keywords: ["order history", "track orders", "college canteen", "food delivery", "order management"]
  },
  profile: {
    title: "Profile - SilloBite | Manage Your Account",
    description: "Manage your account, update preferences, and view your college canteen ordering history.",
    keywords: ["user profile", "account management", "college canteen", "user preferences"]
  },
  search: {
    title: "Search Food - SilloBite | Find Your Favorite Meals",
    description: "Search for your favorite food items in your college canteen. Find meals, snacks, and beverages quickly with SilloBite.",
    keywords: ["food search", "college canteen", "find food", "meal search", "canteen menu"]
  },
  about: {
    title: "About SilloBite | College Food Ordering Platform",
    description: "Learn about SilloBite, the leading college canteen food ordering platform. Discover how we're revolutionizing campus dining.",
    keywords: ["about sillobite", "college canteen platform", "campus dining", "food ordering app"]
  },
  help: {
    title: "Help & Support - SilloBite | Get Assistance",
    description: "Get help with your account, orders, and college canteen food delivery. Find answers to common questions.",
    keywords: ["help", "support", "college canteen", "food ordering help", "customer service"]
  },
  privacy: {
    title: "Privacy Policy - SilloBite | Data Protection",
    description: "Read our privacy policy to understand how we protect your personal information and data.",
    keywords: ["privacy policy", "data protection", "college canteen", "user privacy"]
  },
  terms: {
    title: "Terms & Conditions - SilloBite | Service Agreement",
    description: "Review our terms and conditions for using our college food ordering platform.",
    keywords: ["terms conditions", "service agreement", "college canteen", "user agreement"]
  }
};

// Generate structured data for different page types
export const generateStructuredData = (pageType: string, additionalData?: any) => {
  const baseData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": pageSEOConfigs[pageType]?.title || defaultSEO.title,
    "description": pageSEOConfigs[pageType]?.description || defaultSEO.description,
    "url": defaultSEO.canonicalUrl,
    "isPartOf": {
      "@type": "WebSite",
      "name": "SilloBite",
      "url": "https://sillobite.onrender.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "SilloBite",
      "url": "https://sillobite.onrender.com",
      "logo": "https://sillobite.onrender.com/api/icon.png?size=512"
    }
  };

  // Add page-specific structured data
  switch (pageType) {
    case 'home':
      return {
        ...baseData,
        "@type": "WebApplication",
        "applicationCategory": "FoodApplication",
        "operatingSystem": "Web Browser",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "INR"
        }
      };

    case 'menu':
      return {
        ...baseData,
        "@type": "Menu",
        "hasMenuSection": additionalData?.categories || []
      };

    case 'cart':
      return {
        ...baseData,
        "@type": "ShoppingCart",
        "numberOfItems": additionalData?.itemCount || 0
      };

    default:
      return baseData;
  }
};

// Generate breadcrumb structured data
export const generateBreadcrumbStructuredData = (breadcrumbs: Array<{ name: string, url: string }>) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.url
    }))
  };
};

// Generate FAQ structured data
export const generateFAQStructuredData = (faqs: Array<{ question: string, answer: string }>) => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
};

// Utility function to get SEO config for a page
export const getSEOConfig = (pageType: string, customData?: Partial<SEOConfig>): SEOConfig => {
  const pageConfig = pageSEOConfigs[pageType] || {};

  return {
    ...defaultSEO,
    ...pageConfig,
    ...customData,
    keywords: [
      ...defaultSEO.keywords,
      ...(pageConfig.keywords || []),
      ...(customData?.keywords || [])
    ]
  };
};

// Generate meta tags for social sharing
export const generateSocialMetaTags = (config: SEOConfig) => {
  return {
    'og:title': config.title,
    'og:description': config.description,
    'og:image': config.ogImage || defaultSEO.ogImage,
    'og:url': config.canonicalUrl,
    'og:type': config.ogType || 'website',
    'twitter:card': 'summary_large_image',
    'twitter:title': config.title,
    'twitter:description': config.description,
    'twitter:image': config.ogImage || defaultSEO.ogImage
  };
};
