import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    // Enable source maps for better debugging in native apps
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['wouter'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': ['lucide-react'],
          
          // Feature chunks
          'home-features': [
            './client/src/components/pages/HomeScreen.tsx',
            './client/src/components/menu/MenuItemCard.tsx',
            './client/src/components/menu/CategoryCarousel.tsx'
          ],
          'menu-features': [
            './client/src/components/menu/MenuListingPage.tsx',
            './client/src/components/navigation/SearchDropdown.tsx'
          ],
          // Note: cart-features removed - let Vite handle CartPage chunking automatically
          // This avoids initialization order issues with CartContext
          
          // Context chunks
          'contexts': [
            './client/src/contexts/CartContext.tsx',
            './client/src/contexts/FavoritesContext.tsx',
            './client/src/contexts/CanteenContext.tsx',
            './client/src/contexts/ThemeContext.tsx'
          ],
          
          // Hooks chunks
          'hooks': [
            './client/src/hooks/useHomeData.ts',
            './client/src/hooks/useCategoriesLazyLoad.ts',
            './client/src/hooks/useDataSync.ts'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      port: 5000,
      host: 'localhost',
      clientPort: 5000,
    },
  },
});
