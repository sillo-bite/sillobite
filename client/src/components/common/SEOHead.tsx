import React from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
  structuredData?: object;
}

const SEOHead: React.FC<SEOHeadProps> = ({
  title = "Sillobyte - Order Food Online from College Canteens | Fast & Convenient",
  description = "Order delicious food from your college canteen with Sillobyte. Fast, convenient, and secure online food ordering platform for students. Browse menus, place orders, and enjoy quick delivery.",
  keywords = "college canteen, food ordering, online food delivery, student meals, campus dining, food app, canteen management, college food, student dining, food ordering app",
  canonicalUrl = "https://sillobyte.onrender.com",
  ogImage = "https://sillobyte.onrender.com/api/icon.png?size=512",
  ogType = "website",
  noIndex = false,
  structuredData
}) => {
  React.useEffect(() => {
    // Update document title
    document.title = title;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property?: boolean) => {
      const attribute = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Update basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    // Update Open Graph tags
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:url', canonicalUrl, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:type', ogType, true);

    // Update Twitter Card tags
    updateMetaTag('twitter:title', title, true);
    updateMetaTag('twitter:description', description, true);
    updateMetaTag('twitter:image', ogImage, true);

    // Add structured data if provided
    if (structuredData) {
      // Remove existing structured data for this page
      const existingScript = document.querySelector('script[type="application/ld+json"][data-page-specific]');
      if (existingScript) {
        existingScript.remove();
      }

      // Add new structured data
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-page-specific', 'true');
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    // Cleanup function
    return () => {
      // Remove page-specific structured data on unmount
      const pageSpecificScript = document.querySelector('script[type="application/ld+json"][data-page-specific]');
      if (pageSpecificScript) {
        pageSpecificScript.remove();
      }
    };
  }, [title, description, keywords, canonicalUrl, ogImage, ogType, noIndex, structuredData]);

  return null; // This component doesn't render anything
};

export default SEOHead;
