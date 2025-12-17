import { setPWAAuth } from './pwaAuth';

export interface TempUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phoneNumber?: string;
  registerNumber?: string;
  department?: string;
  college?: string;
  currentStudyYear?: string;
  isPassed?: boolean;
  staffId?: string;
  isTemporary: boolean;
  restaurantId?: string;
  tableNumber?: string;
  tempSessionId?: string;
  sessionId?: string;
  expiresAt?: string;
}

/**
 * Creates a temporary user for QR code table access
 */
export function createTempUser(restaurantId: string, tableNumber: string, restaurantName: string): TempUser {
  const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const tempUser: TempUser = {
    id: tempSessionId,
    name: `Guest at Table ${tableNumber}`,
    email: `temp_${tempSessionId}@restaurant.local`,
    role: 'temp_user',
    phoneNumber: '',
    isTemporary: true,
    restaurantId,
    tableNumber,
    tempSessionId,
    college: restaurantName, // Use restaurant name as college for display purposes
  };

  // Store the temporary user in localStorage and PWA auth
  setPWAAuth(tempUser);
  
  // Store additional temp user data
  localStorage.setItem('tempUserData', JSON.stringify({
    restaurantId,
    tableNumber,
    restaurantName,
    createdAt: new Date().toISOString(),
    tempSessionId
  }));

  console.log('🍽️ Created temporary user for table access:', tempUser);
  return tempUser;
}

/**
 * Checks if the current user is a temporary user
 */
export function isTempUser(user: any): boolean {
  return user?.isTemporary === true || user?.role === 'temp_user';
}

/**
 * Gets temporary user data from localStorage
 */
export function getTempUserData(): {
  restaurantId: string;
  tableNumber: string;
  restaurantName: string;
  createdAt: string;
  tempSessionId: string;
} | null {
  try {
    const data = localStorage.getItem('tempUserData');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error parsing temp user data:', error);
    return null;
  }
}

/**
 * Gets server-managed temporary user session data
 */
export function getServerTempUserSession(): TempUser | null {
  try {
    const sessionData = localStorage.getItem('temp_user_session');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      return {
        ...parsed,
        isTemporary: true,
        role: 'guest'
      };
    }
    return null;
  } catch (error) {
    console.error('Error parsing server temp user session:', error);
    clearServerTempUserSession();
    return null;
  }
}

/**
 * Validates server session and checks if it's expired
 */
export async function validateServerSession(): Promise<boolean> {
  try {
    const sessionData = localStorage.getItem('temp_user_session');
    if (!sessionData) return false;

    const parsed = JSON.parse(sessionData);
    if (!parsed.sessionId) return false;

    // Check if session is expired locally first
    if (parsed.expiresAt && new Date() > new Date(parsed.expiresAt)) {
      clearServerTempUserSession();
      return false;
    }

    // Validate with server
    const response = await fetch(`/api/temp-session/${parsed.sessionId}`);
    if (!response.ok) {
      clearServerTempUserSession();
      return false;
    }

    const serverData = await response.json();
    // Update local session data with server response
    localStorage.setItem('temp_user_session', JSON.stringify(serverData.tempUser));
    return true;

  } catch (error) {
    console.error('Error validating server session:', error);
    clearServerTempUserSession();
    return false;
  }
}

/**
 * Clears server-managed temporary user session
 */
export function clearServerTempUserSession(): void {
  localStorage.removeItem('temp_user_session');
  localStorage.removeItem('temp_user_flag');
  console.log('🧹 Cleared server temp user session');
}

/**
 * Clears temporary user data
 */
export function clearTempUserData(): void {
  localStorage.removeItem('tempUserData');
  console.log('🧹 Cleared temporary user data');
}

/**
 * Updates temporary user with additional information
 */
export function updateTempUser(updates: Partial<TempUser>): void {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  if (isTempUser(currentUser)) {
    const updatedUser = { ...currentUser, ...updates };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setPWAAuth(updatedUser);
    console.log('🔄 Updated temporary user:', updatedUser);
  }
}
