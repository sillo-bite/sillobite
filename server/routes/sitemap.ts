import { Router } from 'express';
import mongoose from 'mongoose';
import { Category } from '../models/mongodb-models';

const router = Router();

// Generate dynamic sitemap
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = 'https://sillobite.onrender.com';
    const currentDate = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/login', priority: '0.8', changefreq: 'monthly' },
      { url: '/privacy-policy', priority: '0.5', changefreq: 'yearly' },
      { url: '/terms-conditions', priority: '0.5', changefreq: 'yearly' },
      { url: '/help-support', priority: '0.6', changefreq: 'monthly' },
      { url: '/about', priority: '0.6', changefreq: 'monthly' },
      { url: '/home', priority: '0.9', changefreq: 'daily' },
      { url: '/search', priority: '0.7', changefreq: 'weekly' },
      { url: '/orders', priority: '0.7', changefreq: 'daily' },
      { url: '/profile', priority: '0.6', changefreq: 'weekly' },
      { url: '/cart', priority: '0.8', changefreq: 'daily' },
      { url: '/checkout', priority: '0.7', changefreq: 'weekly' },
      { url: '/favorites', priority: '0.6', changefreq: 'weekly' },
      { url: '/quick-picks', priority: '0.7', changefreq: 'daily' },
      { url: '/feedback', priority: '0.5', changefreq: 'monthly' }
    ];

    // Get dynamic content from database
    let canteens: any[] = [];
    let categories: any[] = [];

    try {
      // Get canteens (if you have a canteens collection)
      if (mongoose.connection.db) {
        const canteensCollection = mongoose.connection.db.collection('canteens');
        canteens = await canteensCollection.find({}).limit(50).toArray();
      }

      // Get categories (if you have a categories collection)
      // Get categories using Mongoose model
      categories = await Category.find({}).limit(20).lean();
    } catch (dbError) {
      console.log('Database not available for sitemap generation, using static content only');
    }

    // Generate XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">`;

    // Add static pages
    staticPages.forEach(page => {
      sitemap += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    });

    // Add dynamic canteen pages
    canteens.forEach(canteen => {
      sitemap += `
  <url>
    <loc>${baseUrl}/canteen/${canteen._id}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    // Add category pages
    categories.forEach(category => {
      sitemap += `
  <url>
    <loc>${baseUrl}/menu/${category.slug || category.name?.toLowerCase().replace(/\s+/g, '-')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    sitemap += `
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Generate robots.txt
router.get('/robots.txt', (req, res) => {
  const robotsTxt = `# Robots.txt for SilloBite Canteen - https://sillobite.onrender.com

# Allow all search engines to crawl the site
User-agent: *
Allow: /

# Specific rules for major search engines
User-agent: Googlebot
Allow: /
Crawl-delay: 1

User-agent: Bingbot
Allow: /
Crawl-delay: 1

User-agent: Slurp
Allow: /
Crawl-delay: 1

# Social media crawlers
User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: LinkedInBot
Allow: /

User-agent: WhatsApp
Allow: /

# Allow important public API endpoints
Allow: /api/icon.png
Allow: /api/icon.svg

# Block access to sensitive areas
Disallow: /admin/
Disallow: /canteen-owner/
Disallow: /api/
Disallow: /server/
Disallow: /_next/
Disallow: /node_modules/
Disallow: /*.json$
Disallow: /*.js$
Disallow: /*.css$
Disallow: /sw.js
Disallow: /manifest.json

# Allow important files
Allow: /sitemap.xml
Allow: /robots.txt
Allow: /favicon.ico
Allow: /favicon.png
Allow: /favicon.svg

# Sitemap location
Sitemap: https://sillobite.onrender.com/sitemap.xml

# Host declaration
Host: https://sillobite.onrender.com`;

  res.set('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

export default router;
