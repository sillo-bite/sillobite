import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useCanteens, useCanteensByCollege, useCanteensByOrganization, useCanteensByRestaurant, type Canteen } from '@/hooks/useCanteens';
import { useCanteensByInstitution } from '@/hooks/useCanteensByInstitution';
import { useCanteensLazyLoad } from '@/hooks/useCanteensLazyLoad';
import { useColleges, type College } from '@/hooks/useColleges';
import { useCart } from './CartContext';
import { useAuthSync } from '@/hooks/useDataSync';
import { useUserFromCache } from '@/hooks/useUserFromCache';
import { isTempUser, getTempUserData, getServerTempUserSession } from '@/utils/tempUser';
import { useLocation as useLocationContext } from './LocationContext';

interface CanteenContextType {
  selectedCanteen: Canteen | null;
  setSelectedCanteen: (canteen: Canteen | null) => void;
  availableCanteens: Canteen[];
  isLoading: boolean;
  error: string | null;
  userCollege?: string;
  isFiltered: boolean;
  // Lazy loading functions
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  totalCanteens: number;
}

const CanteenContext = createContext<CanteenContextType | undefined>(undefined);

interface CanteenProviderProps {
  children: ReactNode;
}

export const CanteenProvider = React.memo(function CanteenProvider({ children }: CanteenProviderProps) {
  const [selectedCanteen, setSelectedCanteen] = useState<Canteen | null>(null);
  const hasManuallySelected = React.useRef(false); // Track if user manually selected a canteen
  const { user, isAuthenticated } = useAuthSync();
  const { initializeCartForCanteen } = useCart();
  const { selectedLocationType, selectedLocationId, isLoading: locationLoading } = useLocationContext();

  // Sequential flow: Fetch user from cache first, then use that to fetch canteens
  const { data: cachedUser, isLoading: userLoading } = useUserFromCache();
  
  // Repair mechanism: If user is missing organization field, try to restore it from database
  useEffect(() => {
    const userToCheck = cachedUser || user;
    if (userToCheck && userToCheck.role === 'guest' && !userToCheck.organization && userToCheck.id) {
      // Fetch user from database to get organizationId
      (async () => {
        try {
          console.log('🔍 Fetching user from database to get organizationId:', userToCheck.id);
          const userResponse = await fetch(`/api/users/${userToCheck.id}`);
          if (userResponse.ok) {
            const dbUser = await userResponse.json();
            if (dbUser.organizationId) {
              console.log('✅ Found organizationId in database:', dbUser.organizationId);
              
              // Update user data in localStorage with organization field
              const updatedUser = {
                ...userToCheck,
                organization: dbUser.organizationId,
                organizationId: dbUser.organizationId,
              };
              
              localStorage.setItem('user', JSON.stringify(updatedUser));
              window.dispatchEvent(new CustomEvent('userAuthChange'));
              console.log('✅ Organization field restored from database:', updatedUser);
            } else {
              console.log('⚠️ No organizationId found in database for user:', userToCheck.id);
            }
          }
        } catch (e) {
          console.error('Error fetching user from database:', e);
        }
      })();
    }
  }, [cachedUser, user]);

  // Use cached user if available, otherwise fall back to auth user
  const effectiveUser = cachedUser || user;
  const effectiveIsAuthenticated = isAuthenticated || !!cachedUser;

  // Check if this is a temporary user
  const isTemporaryUser = isTempUser(effectiveUser);
  const tempUserData = isTemporaryUser ? getTempUserData() : null;
  const serverTempUser = isTemporaryUser ? getServerTempUserSession() : null;

  // Determine which query to use based on user role, college, organization, or restaurant
  const isAdmin = effectiveUser?.role === 'admin' || effectiveUser?.role === 'super_admin';
  
  // Check for restaurant context in user data (for authenticated users)
  const hasRestaurantContext = effectiveUser?.restaurantId && effectiveUser?.restaurantName && effectiveUser?.tableNumber;
  
  // Prioritize restaurant context over college/organization if present
  const shouldUseRestaurantFilter = (isTemporaryUser && !!(serverTempUser?.restaurantId || tempUserData?.restaurantId)) || 
                                   (effectiveIsAuthenticated && hasRestaurantContext);
  
  // Only use college/organization filters if no restaurant context exists
  // Detect if college/organization ID is actually an organization based on prefix
  // Note: For organization users, the 'college' field may contain the organization ID (prefixed with 'org-')
  // Normalize institution fields: prefer canonical fields but fall back to *Id variants
  // Some users only have collegeId/organizationId populated, so ensure we pick them up
  const userCollege = effectiveUser?.college || (effectiveUser as any)?.collegeId;
  const userOrganization = effectiveUser?.organization || (effectiveUser as any)?.organizationId;
  
  // Debug logging for organization detection
  useEffect(() => {
    console.log('🏢 ===== CANTEEN CONTEXT - ORGANIZATION DETECTION =====');
    console.log('🏢 Effective User:', effectiveUser);
    console.log('🏢 User College:', userCollege);
    console.log('🏢 User Organization:', userOrganization);
    console.log('🏢 Is Authenticated:', effectiveIsAuthenticated);
    console.log('🏢 Is Admin:', isAdmin);
    console.log('🏢 Is Temporary User:', isTemporaryUser);
    console.log('🏢 Has Restaurant Context:', hasRestaurantContext);
    console.log('🏢 Should Use Restaurant Filter:', shouldUseRestaurantFilter);
  }, [effectiveUser, userCollege, userOrganization, effectiveIsAuthenticated, isAdmin, isTemporaryUser, hasRestaurantContext, shouldUseRestaurantFilter]);
  
  // Check if the college field actually contains an organization ID
  const collegeIsOrganization = userCollege && userCollege.startsWith('org-');
  const hasRealCollege = userCollege && !collegeIsOrganization;
  const hasRealOrganization = userOrganization || collegeIsOrganization;
  
  // IMPORTANT: Prioritize organization filter over college filter
  // If user has an organization, use organization filter (even if they also have a college)
  // Only use college filter if there's no organization
  const shouldUseOrganizationFilter = effectiveIsAuthenticated && !isAdmin && !shouldUseRestaurantFilter && hasRealOrganization;
  const shouldUseCollegeFilter = effectiveIsAuthenticated && !isAdmin && !shouldUseRestaurantFilter && !isTemporaryUser && hasRealCollege && !hasRealOrganization; // Only use college if no organization
  
  // Check if we're on an admin page - disable API calls for admin pages
  const isAdminPage = window.location.pathname.startsWith('/admin');
  
  // Sequential flow: Only fetch canteens after user data is available
  const shouldFetchCanteens = (effectiveIsAuthenticated || isTemporaryUser) && !isAdminPage && !userLoading && !locationLoading;

  // Determine institution type and ID for the new unified hook
  // PRIORITY: Use selectedLocation if available, otherwise fall back to user's college/organization
  const institutionType = selectedLocationType ? selectedLocationType : 
                         (shouldUseCollegeFilter ? 'college' : 
                         shouldUseOrganizationFilter ? 'organization' : 
                         shouldUseRestaurantFilter ? 'restaurant' :
                         null);
  const institutionId = selectedLocationId ? selectedLocationId :
                        (shouldUseCollegeFilter ? userCollege : 
                        shouldUseOrganizationFilter ? (userOrganization || (collegeIsOrganization ? userCollege : null)) : 
                        shouldUseRestaurantFilter ? (
                          // For authenticated users with restaurant context, use their restaurantId
                          hasRestaurantContext ? effectiveUser?.restaurantId :
                          // For temporary users, use the restaurant ID from temp session
                          serverTempUser?.restaurantId || tempUserData?.restaurantId
                        ) :
                        null);
  
  // Debug logging for organization detection and filter decisions (after variables are defined)
  useEffect(() => {
    console.log('🏢 ===== CANTEEN CONTEXT - ORGANIZATION DETECTION =====');
    console.log('🏢 Selected Location Type:', selectedLocationType);
    console.log('🏢 Selected Location ID:', selectedLocationId);
    console.log('🏢 Effective User:', effectiveUser);
    console.log('🏢 User College:', userCollege);
    console.log('🏢 User Organization:', userOrganization);
    console.log('🏢 Is Authenticated:', effectiveIsAuthenticated);
    console.log('🏢 Is Admin:', isAdmin);
    console.log('🏢 Is Temporary User:', isTemporaryUser);
    console.log('🏢 Has Restaurant Context:', hasRestaurantContext);
    console.log('🏢 Should Use Restaurant Filter:', shouldUseRestaurantFilter);
    console.log('🏢 College Is Organization:', collegeIsOrganization);
    console.log('🏢 Has Real College:', hasRealCollege);
    console.log('🏢 Has Real Organization:', hasRealOrganization);
    console.log('🏢 Should Use College Filter:', shouldUseCollegeFilter);
    console.log('🏢 Should Use Organization Filter:', shouldUseOrganizationFilter);
    console.log('🏢 Institution Type:', institutionType);
    console.log('🏢 Institution ID:', institutionId);
    console.log('🏢 Should Fetch Canteens:', shouldFetchCanteens);
    if (shouldUseOrganizationFilter) {
      console.log('🏢 Organization Filter Details:');
      console.log('🏢   - Effective User Organization:', effectiveUser?.organization);
      console.log('🏢   - College Is Organization:', collegeIsOrganization);
      console.log('🏢   - User College (if org):', collegeIsOrganization ? userCollege : null);
      console.log('🏢   - Final Institution ID:', institutionId);
    }
    console.log('🏢 ===== END CANTEEN CONTEXT =====');
  }, [selectedLocationType, selectedLocationId, effectiveUser, userCollege, userOrganization, effectiveIsAuthenticated, isAdmin, isTemporaryUser, hasRestaurantContext, shouldUseRestaurantFilter, collegeIsOrganization, hasRealCollege, hasRealOrganization, shouldUseCollegeFilter, shouldUseOrganizationFilter, institutionType, institutionId, shouldFetchCanteens]);
  
  // Listen for location changes and reset selected canteen
  useEffect(() => {
    const handleLocationChange = () => {
      setSelectedCanteen(null);
      hasManuallySelected.current = false;
    };
    
    window.addEventListener('locationChanged', handleLocationChange);
    return () => window.removeEventListener('locationChanged', handleLocationChange);
  }, []);

  // Use lazy loading for institution-specific canteens
  const { 
    data: canteensLazyData, 
    isLoading: canteensLoading, 
    error: canteensError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  } = useCanteensLazyLoad(
    institutionType,
    institutionId,
    5, // limit - load 5 canteens per page
    shouldFetchCanteens && !!institutionType && !!institutionId // Enable only when user is authenticated and has institution data
  );

  // Restaurant-specific canteens query for both authenticated users with restaurant context and temporary users
  const { data: restaurantCanteensData, isLoading: restaurantLoading, error: restaurantError } = useCanteensByRestaurant(
    shouldUseRestaurantFilter ? (
      // For authenticated users with restaurant context, use their restaurantId
      hasRestaurantContext ? effectiveUser?.restaurantId : 
      // For temporary users, use the restaurant ID from temp session
      serverTempUser?.restaurantId || tempUserData?.restaurantId
    ) : undefined,
    shouldUseRestaurantFilter && shouldFetchCanteens
  );

  // Fallback to old hooks for admins or when new hook doesn't apply
  const { data: allCanteensData, isLoading: allLoading, error: allError } = useCanteens(
    !institutionType && shouldFetchCanteens // Only enable if we should NOT use any filter AND should fetch canteens
  );

  // Choose the appropriate data source - use lazy loaded, restaurant, or all canteens
  const isLoading = shouldUseRestaurantFilter ? restaurantLoading : 
                   institutionType ? canteensLoading : allLoading;
  const error = shouldUseRestaurantFilter ? restaurantError : 
               institutionType ? canteensError : allError;
  
  // Flatten all pages of lazy loaded canteens
  const lazyLoadedCanteens = canteensLazyData?.pages?.flatMap(page => (page as any).canteens) || [];
  const restaurantCanteens = restaurantCanteensData?.canteens || [];
  const allCanteens = allCanteensData?.canteens || [];
  const unsortedCanteens: Canteen[] = shouldUseRestaurantFilter ? restaurantCanteens :
                             institutionType ? lazyLoadedCanteens : allCanteens;
  
  // Sort canteens by priority (lower number = higher priority), then by name
  const canteens: Canteen[] = [...unsortedCanteens].sort((a, b) => {
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
  
  // Get total count from the first page
  const totalCanteens = institutionType ? ((canteensLazyData?.pages?.[0] as any)?.total || 0) : ((allCanteensData as any)?.total || 0);

  // Debug logging removed for production
  React.useEffect(() => {
    // Context state tracking (debug logging removed)
  }, [user, cachedUser, effectiveUser, isAuthenticated, effectiveIsAuthenticated, userLoading, isAdmin, shouldFetchCanteens, institutionType, institutionId, canteens, isLoading]);

  // Set default canteen when canteens are loaded - only on initial load or if selected canteen is no longer available
  useEffect(() => {
    if (canteens && canteens.length > 0) {
      // If user has manually selected a canteen, respect that selection
      if (hasManuallySelected.current && selectedCanteen) {
        // Check if the selected canteen is still in the available list
        const isStillAvailable = canteens.some((c: Canteen) => c.id === selectedCanteen.id && c.isActive);
        if (isStillAvailable) {
          // Keep the manually selected canteen
          return;
        }
        // If manually selected canteen is no longer available, reset the flag and select highest priority
        hasManuallySelected.current = false;
      }
      
      // Only auto-select highest priority canteen if:
      // 1. No canteen is currently selected, OR
      // 2. The selected canteen is not in the available list
      if (!selectedCanteen || !canteens.some((c: Canteen) => c.id === selectedCanteen.id)) {
        const highestPriorityCanteen = canteens.find((c: Canteen) => c.isActive) || canteens[0];
        setSelectedCanteen(highestPriorityCanteen);
        hasManuallySelected.current = false; // Reset flag on auto-selection
      }
    } else if (canteens.length === 0 && selectedCanteen) {
      // If no canteens available after filtering, clear selection
      setSelectedCanteen(null);
      hasManuallySelected.current = false;
    }
  }, [canteens, selectedCanteen]);

  // Initialize cart for the selected canteen (don't save to localStorage to allow priority-based selection on refresh)
  useEffect(() => {
    if (selectedCanteen) {
      // Don't save to localStorage - we want to always select highest priority canteen on refresh
      // localStorage.setItem('selectedCanteenId', selectedCanteen.id);
      // Initialize cart for the selected canteen
      initializeCartForCanteen(selectedCanteen.id);
    }
  }, [selectedCanteen, initializeCartForCanteen]);

  // Wrapper for setSelectedCanteen that tracks manual selection
  const handleSetSelectedCanteen = React.useCallback((canteen: Canteen | null) => {
    if (canteen) {
      hasManuallySelected.current = true; // Mark as manually selected
    }
    setSelectedCanteen(canteen);
  }, []);

  const contextValue: CanteenContextType = React.useMemo(() => ({
    selectedCanteen,
    setSelectedCanteen: handleSetSelectedCanteen,
    availableCanteens: canteens,
    isLoading,
    error: error?.message || null,
    userCollege: effectiveUser?.college || (effectiveUser as any)?.collegeId,
    isFiltered: effectiveIsAuthenticated && (userCollege || userOrganization) && effectiveUser?.role !== 'admin' && effectiveUser?.role !== 'super_admin',
    // Lazy loading functions
    hasNextPage: institutionType ? hasNextPage : false,
    isFetchingNextPage: institutionType ? isFetchingNextPage : false,
    fetchNextPage: institutionType ? fetchNextPage : () => {},
    totalCanteens,
  }), [
    selectedCanteen,
    canteens,
    isLoading,
    error,
    userCollege,
    effectiveIsAuthenticated,
    userOrganization,
    effectiveUser?.role,
    institutionType,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalCanteens
  ]);

  return (
    <CanteenContext.Provider value={contextValue}>
      {children}
    </CanteenContext.Provider>
  );
});

export function useCanteenContext() {
  const context = useContext(CanteenContext);
  if (context === undefined) {
    throw new Error('useCanteenContext must be used within a CanteenProvider');
  }
  return context;
}
