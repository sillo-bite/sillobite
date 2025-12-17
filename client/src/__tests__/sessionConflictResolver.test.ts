import { 
  resolveUserSessionConflict, 
  securelyUpdateUserData, 
  cleanupTemporaryUserData,
  logConflictResolutionEvent 
} from '../utils/sessionConflictResolver';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    getAllItems: () => store
  };
})();

// Mock console.log for testing log events
const originalConsoleLog = console.log;
let consoleLogMock: jest.Mock;

describe('Session Conflict Resolver', () => {
  beforeEach(() => {
    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    localStorageMock.clear();
    
    // Setup console.log mock
    consoleLogMock = jest.fn();
    console.log = consoleLogMock;
  });

  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;
  });

  describe('resolveUserSessionConflict', () => {
    test('should return null when no existing user is provided', () => {
      const result = resolveUserSessionConflict(null, {
        restaurantId: 'rest123',
        restaurantName: 'Test Restaurant',
        tableNumber: 'T1'
      });
      
      expect(result).toBeNull();
    });

    test('should add restaurant context to existing user data', () => {
      const existingUser = {
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer'
      };
      
      const restaurantContext = {
        restaurantId: 'rest123',
        restaurantName: 'Test Restaurant',
        tableNumber: 'T1'
      };
      
      const result = resolveUserSessionConflict(existingUser, restaurantContext);
      
      expect(result).toEqual({
        ...existingUser,
        ...restaurantContext
      });
    });

    test('should create a deep copy to prevent mutation of original data', () => {
      const existingUser = {
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer',
        preferences: { theme: 'dark' }
      };
      
      const restaurantContext = {
        restaurantId: 'rest123',
        restaurantName: 'Test Restaurant',
        tableNumber: 'T1'
      };
      
      const result = resolveUserSessionConflict(existingUser, restaurantContext);
      
      // Modify the result
      if (result) {
        result.preferences.theme = 'light';
      }
      
      // Original should remain unchanged
      expect(existingUser.preferences.theme).toBe('dark');
    });
  });

  describe('securelyUpdateUserData', () => {
    test('should store temporary user data correctly', () => {
      const tempUser = {
        id: 'temp123',
        name: 'Temp User',
        role: 'guest',
        isTemporary: true
      };
      
      securelyUpdateUserData(tempUser, true);
      
      expect(localStorageMock.getItem('temp_user_session')).toBe(JSON.stringify(tempUser));
      expect(localStorageMock.getItem('temp_user_flag')).toBe('true');
      expect(localStorageMock.getItem('user')).toBeNull();
    });

    test('should store permanent user data and clean up temporary data', () => {
      // First set some temporary data
      localStorageMock.setItem('temp_user_session', JSON.stringify({ id: 'temp123' }));
      localStorageMock.setItem('temp_user_flag', 'true');
      
      const permanentUser = {
        id: 'user123',
        name: 'Permanent User',
        email: 'user@example.com',
        role: 'customer'
      };
      
      securelyUpdateUserData(permanentUser, false);
      
      expect(localStorageMock.getItem('user')).toBe(JSON.stringify(permanentUser));
      expect(localStorageMock.getItem('temp_user_session')).toBeNull();
      expect(localStorageMock.getItem('temp_user_flag')).toBeNull();
    });
  });

  describe('cleanupTemporaryUserData', () => {
    test('should remove all temporary user artifacts', () => {
      // Set temporary data
      localStorageMock.setItem('temp_user_session', JSON.stringify({ id: 'temp123' }));
      localStorageMock.setItem('temp_user_flag', 'true');
      localStorageMock.setItem('user', JSON.stringify({ id: 'user123' }));
      
      cleanupTemporaryUserData();
      
      expect(localStorageMock.getItem('temp_user_session')).toBeNull();
      expect(localStorageMock.getItem('temp_user_flag')).toBeNull();
      expect(localStorageMock.getItem('user')).toBe(JSON.stringify({ id: 'user123' }));
    });
  });

  describe('logConflictResolutionEvent', () => {
    test('should log conflict detection events', () => {
      logConflictResolutionEvent({
        type: 'conflict_detected',
        userId: 'user123',
        restaurantId: 'rest123',
        tableNumber: 'T1'
      });
      
      expect(consoleLogMock).toHaveBeenCalled();
      const logCall = consoleLogMock.mock.calls[0];
      expect(logCall[0]).toContain('[Conflict Resolution] conflict_detected');
      expect(logCall[1]).toMatchObject({
        type: 'conflict_detected',
        userId: 'user123',
        restaurantId: 'rest123',
        tableNumber: 'T1',
        timestamp: expect.any(String)
      });
    });

    test('should log error events with error details', () => {
      const error = new Error('Test error');
      
      logConflictResolutionEvent({
        type: 'error',
        userId: 'user123',
        restaurantId: 'rest123',
        tableNumber: 'T1',
        error
      });
      
      expect(consoleLogMock).toHaveBeenCalled();
      const logCall = consoleLogMock.mock.calls[0];
      expect(logCall[0]).toContain('[Conflict Resolution] error');
      expect(logCall[1]).toMatchObject({
        type: 'error',
        userId: 'user123',
        error,
        timestamp: expect.any(String)
      });
    });
  });
});