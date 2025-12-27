import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthSync } from '@/hooks/useDataSync';

interface LocationContextType {
  selectedLocationType: 'college' | 'organization' | 'restaurant' | null;
  selectedLocationId: string | null;
  selectedLocationName: string | null;
  setLocation: (type: 'college' | 'organization' | 'restaurant', id: string, name: string) => Promise<void>;
  clearLocation: () => void;
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider = React.memo(function LocationProvider({ children }: LocationProviderProps) {
  const { user } = useAuthSync();
  const [selectedLocationType, setSelectedLocationType] = useState<'college' | 'organization' | 'restaurant' | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLocationName, setSelectedLocationName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLocation = async () => {
      try {
        // First, check if user has a stored location in the database
        if (user?.selectedLocationType && user?.selectedLocationId) {
          console.log('📍 Loading location from user data:', user.selectedLocationType, user.selectedLocationId);
          
          // Fetch the location name from the API
          try {
            const response = await fetch(`/api/locations/${user.selectedLocationType}`);
            if (response.ok) {
              const data = await response.json();
              const location = data.locations?.find((loc: any) => loc.id === user.selectedLocationId);
              if (location) {
                const locationData = {
                  type: user.selectedLocationType,
                  id: user.selectedLocationId,
                  name: location.name
                };
                
                setSelectedLocationType(user.selectedLocationType as 'college' | 'organization' | 'restaurant');
                setSelectedLocationId(user.selectedLocationId);
                setSelectedLocationName(location.name);
                
                // Save to localStorage for offline access
                localStorage.setItem('selectedLocation', JSON.stringify(locationData));
                console.log('✅ Location loaded from user data:', location.name);
                setIsLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error('Error fetching location details:', error);
          }
        }
        
        // Fallback to localStorage if no user location or fetch failed
        const stored = localStorage.getItem('selectedLocation');
        if (stored) {
          const location = JSON.parse(stored);
          setSelectedLocationType(location.type);
          setSelectedLocationId(location.id);
          setSelectedLocationName(location.name);
          console.log('📍 Location loaded from localStorage:', location.name);
        }
      } catch (error) {
        console.error('Error loading selected location:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLocation();
  }, [user?.selectedLocationType, user?.selectedLocationId]);

  const setLocation = async (type: 'college' | 'organization' | 'restaurant', id: string, name: string) => {
    try {
      const location = { type, id, name };
      localStorage.setItem('selectedLocation', JSON.stringify(location));
      
      setSelectedLocationType(type);
      setSelectedLocationId(id);
      setSelectedLocationName(name);

      if (user?.id) {
        await fetch(`/api/users/${user.id}/location`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationType: type, locationId: id }),
        });
      }

      window.dispatchEvent(new CustomEvent('locationChanged'));
    } catch (error) {
      console.error('Error saving location:', error);
      throw error;
    }
  };

  const clearLocation = () => {
    localStorage.removeItem('selectedLocation');
    setSelectedLocationType(null);
    setSelectedLocationId(null);
    setSelectedLocationName(null);
    window.dispatchEvent(new CustomEvent('locationChanged'));
  };

  const contextValue: LocationContextType = React.useMemo(() => ({
    selectedLocationType,
    selectedLocationId,
    selectedLocationName,
    setLocation,
    clearLocation,
    isLoading,
  }), [selectedLocationType, selectedLocationId, selectedLocationName, isLoading]);

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
});

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
