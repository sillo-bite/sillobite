/**
 * Session Conflict Resolver Utility
 * 
 * This utility provides functions to handle conflicts between temporary and existing user sessions
 * when a user scans a QR code at a restaurant table.
 */

import { setPWAAuth, clearPWAAuth } from './pwaAuth';

interface UserData {
  id: string | number;
  name: string;
  email?: string;
  role: string;
  isTemporary?: boolean;
  [key: string]: any;
}

interface RestaurantContext {
  restaurantId: string;
  restaurantName: string;
  tableNumber: string;
}

/**
 * Resolves conflicts between temporary and existing user sessions
 * @param existingUser - The existing authenticated user data
 * @param restaurantContext - The restaurant context from the QR code
 * @returns The resolved user data with restaurant context
 */
export const resolveUserSessionConflict = (
  existingUser: UserData | null,
  restaurantContext: RestaurantContext
): UserData | null => {
  if (!existingUser) return null;

  // Create a deep copy of the user data to prevent mutation
  const resolvedUserData = JSON.parse(JSON.stringify(existingUser));

  // Preserve organization/college data
  const organizationData = {
    collegeId: resolvedUserData.collegeId,
    collegeName: resolvedUserData.collegeName,
    organizationId: resolvedUserData.organizationId,
    organizationName: resolvedUserData.organizationName
  };

  // Add restaurant context to the user data while preserving organization data
  const updatedUserData = {
    ...resolvedUserData,
    ...organizationData, // Ensure organization data is preserved
    restaurantId: restaurantContext.restaurantId,
    restaurantName: restaurantContext.restaurantName,
    tableNumber: restaurantContext.tableNumber,
    // Set a flag to indicate this user has restaurant context
    hasRestaurantContext: true
  };

  return updatedUserData;
};

/**
 * Securely updates the user data in localStorage and PWA auth
 * @param userData - The user data to store
 * @param isTemporary - Whether this is a temporary user
 */
export const securelyUpdateUserData = (userData: UserData, isTemporary: boolean = false): void => {
  try {
    // Clear any existing temporary user data first
    if (!isTemporary) {
      localStorage.removeItem('temp_user_session');
      localStorage.removeItem('temp_user_flag');
    }

    // Set restaurant context flag if it exists
    if (userData.restaurantId && userData.restaurantName && userData.tableNumber) {
      userData.hasRestaurantContext = true;

      // Store restaurant context in a separate item for easier access
      localStorage.setItem('restaurant_context', JSON.stringify({
        restaurantId: userData.restaurantId,
        restaurantName: userData.restaurantName,
        tableNumber: userData.tableNumber
      }));
    }

    // Store the appropriate user data
    if (isTemporary) {
      localStorage.setItem('temp_user_session', JSON.stringify(userData));
      localStorage.setItem('temp_user_flag', 'true');
    } else {
      localStorage.setItem('user', JSON.stringify(userData));

      // Update PWA auth for permanent users
      setPWAAuth(userData);

      // Dispatch event to notify React components of auth state change
      window.dispatchEvent(new CustomEvent('userAuthChange'));
    }
  } catch (error) {
    console.error('Error updating user data:', error);
    throw new Error('Failed to securely update user data');
  }
};

/**
 * Cleans up temporary user artifacts
 */
export const cleanupTemporaryUserData = (): void => {
  try {
    localStorage.removeItem('temp_user_session');
    localStorage.removeItem('temp_user_flag');
  } catch (error) {
    console.error('Error cleaning up temporary user data:', error);
  }
};

/**
 * Clears restaurant context from user data
 * @param userData - The current user data
 * @returns The user data without restaurant context
 */
export const clearRestaurantContext = (userData: UserData): UserData => {
  // Create a deep copy to prevent mutation
  const updatedUserData = JSON.parse(JSON.stringify(userData));

  // Remove restaurant context fields
  delete updatedUserData.restaurantId;
  delete updatedUserData.restaurantName;
  delete updatedUserData.tableNumber;
  delete updatedUserData.hasRestaurantContext;

  // Clear restaurant context from localStorage
  localStorage.removeItem('restaurant_context');

  // Update user data in localStorage
  localStorage.setItem('user', JSON.stringify(updatedUserData));

  // Update PWA auth
  setPWAAuth(updatedUserData);

  console.log('✅ Restaurant context cleared from user data');

  return updatedUserData;
};

/**
 * Logs conflict resolution events for debugging and auditing
 * @param event - The event details to log
 */
export const logConflictResolutionEvent = (event: {
  type: 'conflict_detected' | 'existing_user_prioritized' | 'temp_user_created' | 'error';
  userId?: string;
  restaurantId?: string;
  tableNumber?: string;
  error?: any;
}): void => {
  const logEntry = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  console.log(`[Conflict Resolution] ${event.type}:`, logEntry);

  // In a production environment, you might want to send this to a logging service
  // or analytics platform for monitoring and debugging
};