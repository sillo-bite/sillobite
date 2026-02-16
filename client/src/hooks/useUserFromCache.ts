import { useQuery } from '@tanstack/react-query';
import { UserRole } from "@shared/schema";

interface User {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  role: UserRole | string;
  college?: string;
  organization?: string;
  department?: string;
  currentStudyYear?: number;
  isPassed?: boolean;
  isTemporary?: boolean;
}

export function useUserFromCache() {
  return useQuery<User | null>({
    queryKey: ['user'],
    queryFn: async () => {
      // Check for server temp user session first
      const tempUserSession = localStorage.getItem('temp_user_session');
      if (tempUserSession) {
        try {
          const parsed = JSON.parse(tempUserSession);
          const tempUser = { ...parsed, isTemporary: true, role: UserRole.GUEST };
          console.log('💾 useUserFromCache: Found temp user session:', tempUser);
          return tempUser;
        } catch (error) {
          console.log('💾 useUserFromCache: Error parsing temp user session:', error);
        }
      }

      // Try to get user from React Query cache first
      const cachedUser = localStorage.getItem('user');
      if (cachedUser) {
        try {
          const parsedUser = JSON.parse(cachedUser);
          console.log('💾 useUserFromCache: Found user in localStorage:', parsedUser);
          return parsedUser;
        } catch (error) {
          console.log('💾 useUserFromCache: Error parsing user from localStorage:', error);
          return null;
        }
      }

      console.log('💾 useUserFromCache: No user found in localStorage');
      return null;
    },
    enabled: true, // Always enabled to check for cached user
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}
