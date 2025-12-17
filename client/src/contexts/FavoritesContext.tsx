import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
interface FavoriteItem {
  id: string;
  name: string;
  price: number;
  isVegetarian: boolean;
  imageUrl?: string;
  canteenId: string;
  description?: string;
}

interface FavoritesContextType {
  favorites: FavoriteItem[];
  addToFavorites: (item: FavoriteItem) => void;
  removeFromFavorites: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
  toggleFavorite: (item: FavoriteItem) => void;
  clearFavorites: () => void;
  getFavoritesByCanteen: (canteenId: string) => FavoriteItem[];
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const FAVORITES_STORAGE_KEY = 'digital-canteen-favorites';

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (savedFavorites) {
        const parsedFavorites = JSON.parse(savedFavorites);
        if (Array.isArray(parsedFavorites)) {
          setFavorites(parsedFavorites);
        }
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  }, []);

  // Save favorites to localStorage whenever favorites change
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }, [favorites]);

  const addToFavorites = useCallback((item: FavoriteItem) => {
    setFavorites(prev => {
      // Check if item already exists
      const exists = prev.some(fav => fav.id === item.id);
      if (exists) {
        return prev;
      }
      
      const newFavorites = [...prev, item];
      return newFavorites;
    });
  }, []);

  const removeFromFavorites = useCallback((itemId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.filter(fav => fav.id !== itemId);
      return newFavorites;
    });
  }, []);

  const isFavorite = useCallback((itemId: string) => {
    return favorites.some(fav => fav.id === itemId);
  }, [favorites]);

  const toggleFavorite = useCallback((item: FavoriteItem) => {
    if (isFavorite(item.id)) {
      removeFromFavorites(item.id);
    } else {
      addToFavorites(item);
    }
  }, [isFavorite, addToFavorites, removeFromFavorites]);

  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  const getFavoritesByCanteen = useCallback((canteenId: string) => {
    return favorites.filter(item => item.canteenId === canteenId);
  }, [favorites]);

  return (
    <FavoritesContext.Provider value={{
      favorites,
      addToFavorites,
      removeFromFavorites,
      isFavorite,
      toggleFavorite,
      clearFavorites,
      getFavoritesByCanteen
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
