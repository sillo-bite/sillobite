import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import TableAccessPage from '../components/canteen/TableAccessPage';
import { useUserFromCache } from '../hooks/useUserFromCache';
import { useRoute, useLocation } from 'wouter';

// Mock the hooks
jest.mock('../hooks/useUserFromCache');
jest.mock('wouter', () => ({
  useRoute: jest.fn(),
  useLocation: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

describe('TableAccessPage Integration Tests', () => {
  // Setup localStorage mock
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

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    localStorageMock.clear();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock route params
    (useRoute as jest.Mock).mockReturnValue([
      true, 
      { restaurantId: 'rest123', tableNumber: 'T1', hash: 'validhash' }
    ]);
    
    // Mock location setter
    const setLocationMock = jest.fn();
    (useLocation as jest.Mock).mockReturnValue(['/table/rest123/T1/validhash', setLocationMock]);
    
    // Mock successful fetch for table data
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        restaurant: {
          id: 'rest123',
          name: 'Test Restaurant',
          address: '123 Test St',
          contactNumber: '123-456-7890',
          operatingHours: { open: '9:00', close: '22:00' }
        },
        table: {
          id: 'table123',
          tableNumber: 'T1',
          floor: 1,
          location: 'Main Hall',
          seatingCapacity: 4,
          tableType: 'standard',
          status: 'available',
          specialFeatures: []
        },
        isValid: true
      })
    });
  });

  test('should prioritize existing user when detected', async () => {
    // Mock existing authenticated user
    (useUserFromCache as jest.Mock).mockReturnValue({
      data: {
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer',
        isTemporary: false
      },
      isLoading: false
    });
    
    // Render component
    render(<TableAccessPage />);
    
    // Wait for loading state to complete and redirection to occur
    await waitFor(() => {
      expect(screen.getByText(/using your existing account/i)).toBeInTheDocument();
    });
    
    // Verify localStorage was updated correctly
    const userDataString = localStorageMock.getItem('user');
    expect(userDataString).not.toBeNull();
    
    const userData = JSON.parse(userDataString!);
    expect(userData).toMatchObject({
      id: 'user123',
      name: 'Test User',
      restaurantId: 'rest123',
      restaurantName: 'Test Restaurant',
      tableNumber: 'T1'
    });
    
    // Verify temporary user data was cleaned up
    expect(localStorageMock.getItem('temp_user_session')).toBeNull();
    expect(localStorageMock.getItem('temp_user_flag')).toBeNull();
  });

  test('should create temporary user when no existing user is detected', async () => {
    // Mock no existing user
    (useUserFromCache as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false
    });
    
    // Mock successful temp session creation
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        tempUser: {
          id: 'temp123',
          name: 'Guest User',
          role: 'guest',
          isTemporary: true,
          restaurantId: 'rest123',
          restaurantName: 'Test Restaurant',
          tableNumber: 'T1'
        },
        existingUserPrioritized: false
      })
    });
    
    // Render component
    render(<TableAccessPage />);
    
    // Wait for loading state to complete
    await waitFor(() => {
      expect(screen.getByText(/creating temporary session/i)).toBeInTheDocument();
    });
    
    // Verify localStorage was updated correctly
    const tempUserDataString = localStorageMock.getItem('temp_user_session');
    expect(tempUserDataString).not.toBeNull();
    
    const tempUserData = JSON.parse(tempUserDataString!);
    expect(tempUserData).toMatchObject({
      id: 'temp123',
      name: 'Guest User',
      role: 'guest',
      isTemporary: true
    });
    
    expect(localStorageMock.getItem('temp_user_flag')).toBe('true');
  });

  test('should handle server-side conflict resolution', async () => {
    // Mock temporary user in cache but server prioritizes existing user
    (useUserFromCache as jest.Mock).mockReturnValue({
      data: {
        id: 'temp456',
        name: 'Temporary User',
        role: 'guest',
        isTemporary: true
      },
      isLoading: false
    });
    
    // Mock server response that prioritizes an existing user
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        userData: {
          id: 'user789',
          name: 'Database User',
          email: 'db@example.com',
          role: 'customer',
          restaurantId: 'rest123',
          restaurantName: 'Test Restaurant',
          tableNumber: 'T1'
        },
        existingUserPrioritized: true
      })
    });
    
    // Render component
    render(<TableAccessPage />);
    
    // Wait for loading state to complete
    await waitFor(() => {
      expect(screen.getByText(/using your existing account/i)).toBeInTheDocument();
    });
    
    // Verify localStorage was updated correctly with the server-prioritized user
    const userDataString = localStorageMock.getItem('user');
    expect(userDataString).not.toBeNull();
    
    const userData = JSON.parse(userDataString!);
    expect(userData).toMatchObject({
      id: 'user789',
      name: 'Database User',
      role: 'customer'
    });
    
    // Verify temporary user data was cleaned up
    expect(localStorageMock.getItem('temp_user_session')).toBeNull();
    expect(localStorageMock.getItem('temp_user_flag')).toBeNull();
  });

  test('should handle errors gracefully', async () => {
    // Mock no existing user
    (useUserFromCache as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false
    });
    
    // Mock fetch error
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error')
    });
    
    // Render component
    render(<TableAccessPage />);
    
    // Wait for error state to appear
    await waitFor(() => {
      expect(screen.getByText(/session error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to create session/i)).toBeInTheDocument();
    });
    
    // Verify the error message is displayed
    expect(screen.getByText(/there was a problem setting up your session/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to homepage/i })).toBeInTheDocument();
  });
});