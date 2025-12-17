/**
 * Utility functions for getting user data from localStorage
 * Centralizes user data retrieval logic
 */

export interface User {
  id: string | number;
  name?: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

/**
 * Get user data from localStorage
 * @returns User object or null if not found
 */
export function getUserFromStorage(): User | null {
  try {
    const userData = localStorage.getItem('user');
    if (!userData) return null;
    return JSON.parse(userData);
  } catch (error) {
    console.error('Error parsing user data from storage:', error);
    return null;
  }
}

/**
 * Get user ID from localStorage
 * @returns User ID or null if not found
 */
export function getUserIdFromStorage(): string | number | null {
  const user = getUserFromStorage();
  return user?.id || null;
}

/**
 * Check if user is authenticated (has user data in storage)
 * @returns boolean
 */
export function isUserAuthenticated(): boolean {
  return getUserFromStorage() !== null;
}

