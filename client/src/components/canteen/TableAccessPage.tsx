import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Utensils, MapPin, Users, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { createTempUser } from '@/utils/tempUser';
import { useUserFromCache } from '@/hooks/useUserFromCache';
import { 
  resolveUserSessionConflict, 
  securelyUpdateUserData, 
  cleanupTemporaryUserData,
  logConflictResolutionEvent 
} from '@/utils/sessionConflictResolver';

interface TableAccessData {
  restaurant: {
    id: string;
    name: string;
    address: string;
    contactNumber: string;
    operatingHours: {
      open: string;
      close: string;
    };
  };
  table: {
    id: string;
    tableNumber: string;
    floor: number;
    location: string;
    seatingCapacity: number;
    tableType: string;
    status: string;
    specialFeatures: string[];
  };
  isValid: boolean;
}

export default function TableAccessPage() {
  const [, params] = useRoute('/table/:restaurantId/:tableNumber/:hash');
  const [, setLocation] = useLocation();
  const [tableData, setTableData] = useState<TableAccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: existingUser, isLoading: isUserLoading } = useUserFromCache();

  useEffect(() => {
    if (params?.restaurantId && params?.tableNumber && params?.hash) {
      fetchTableData(params.restaurantId, params.tableNumber, params.hash);
    } else {
      setError('Invalid QR code URL structure');
      setLoading(false);
    }
  }, [params?.restaurantId, params?.tableNumber, params?.hash]);

  // Handle redirect based on user authentication status - runs after table data is loaded
  useEffect(() => {
    if (tableData && !loading && !error && !isUserLoading) {
      const restaurantContext = {
        restaurantId: tableData.restaurant.id,
        restaurantName: tableData.restaurant.name,
        tableNumber: tableData.table.tableNumber
      };

      // Check if user is already authenticated (not temporary)
      if (existingUser && !existingUser.isTemporary) {
        console.log('✅ Existing authenticated user detected, applying restaurant context and redirecting to home');
        
        // Apply restaurant context to existing user
        const updatedUserData = resolveUserSessionConflict(existingUser, restaurantContext);
        
        // Securely update user data with restaurant context
        securelyUpdateUserData(updatedUserData, false);
        
        // Dispatch event to notify auth state change
        window.dispatchEvent(new CustomEvent('userAuthChange'));
        
        // Small delay to ensure localStorage is written before redirect
        setTimeout(() => {
          // Redirect directly to home page with full reload to ensure state sync
          window.location.href = '/app';
        }, 100);
        return;
      }

      // No existing user - redirect to login page with QR table data stored
      console.log('🔐 No authenticated user found, redirecting to login page for QR code access...');
      
      // Store table data in sessionStorage for use on login page
      const qrTableData = {
        restaurantId: tableData.restaurant.id,
        restaurantName: tableData.restaurant.name,
        tableNumber: tableData.table.tableNumber,
        hash: params?.hash,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem('pendingQRTableData', JSON.stringify(qrTableData));
      
      // Redirect to login page
      setLocation('/login?fromQR=true');
    }
  }, [tableData, loading, error, params?.hash, setLocation, existingUser, isUserLoading]);
  
  // Ensure restaurant context is preserved when navigating away
  useEffect(() => {
    // Clean up function to ensure context is preserved when component unmounts
    return () => {
      if (tableData && existingUser && !existingUser.isTemporary) {
        console.log('🔒 Preserving restaurant context on navigation');
        const restaurantContext = {
          restaurantId: tableData.restaurant.id,
          restaurantName: tableData.restaurant.name,
          tableNumber: tableData.table.tableNumber
        };
        
        // Ensure user data has restaurant context before navigating away
        const currentUserData = localStorage.getItem('user');
        if (currentUserData) {
          try {
            const userData = JSON.parse(currentUserData);
            const updatedUserData = {
              ...userData,
              restaurantId: restaurantContext.restaurantId,
              restaurantName: restaurantContext.restaurantName,
              tableNumber: restaurantContext.tableNumber
            };
            localStorage.setItem('user', JSON.stringify(updatedUserData));
          } catch (error) {
            console.error('Error preserving restaurant context:', error);
          }
        }
      }
    };
  }, [tableData, existingUser]);

  const fetchTableData = async (restaurantId: string, tableNumber: string, hash: string) => {
    try {
      setLoading(true);
      setError(null);

      // TODO: Replace with actual API call
      // For now, we'll simulate the API call
      const response = await fetch(`/api/table-access/${restaurantId}/${tableNumber}/${hash}`);
      
      if (!response.ok) {
        throw new Error('Invalid QR code or table not found');
      }

      const data = await response.json();
      setTableData(data);
    } catch (err) {
      console.error('Error fetching table data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load table information');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrder = async () => {
    if (!tableData) return;
    
    try {
      setLoading(true);
      setStatusMessage({ type: 'info', message: 'Preparing your session...' });
      console.log('🍽️ Preparing session for table access:', tableData.table.tableNumber);
      
      const restaurantContext = {
        restaurantId: tableData.restaurant.id,
        restaurantName: tableData.restaurant.name,
        tableNumber: tableData.table.tableNumber
      };
      
      // Check for existing authenticated user first
      if (existingUser && !existingUser.isTemporary) {
        logConflictResolutionEvent({
          type: 'conflict_detected',
          userId: existingUser.id,
          restaurantId: tableData.restaurant.id,
          tableNumber: tableData.table.tableNumber
        });
        
        console.log('🔍 Existing authenticated user detected:', existingUser);
        console.log('✅ Prioritizing existing user over temporary session');
        setStatusMessage({ 
          type: 'success', 
          message: 'Using your existing account for this session' 
        });
        
        // Resolve the conflict using our utility
        const updatedUserData = resolveUserSessionConflict(existingUser, restaurantContext);
        
        // Securely update user data and clean up temporary artifacts
        securelyUpdateUserData(updatedUserData, false);
        
        // Log the successful conflict resolution
        logConflictResolutionEvent({
          type: 'existing_user_prioritized',
          userId: existingUser.id,
          restaurantId: tableData.restaurant.id,
          tableNumber: tableData.table.tableNumber
        });
        
        // Add a small delay to show the success message before redirecting
        setTimeout(() => {
          // Force a refresh when redirecting to ensure context is applied
          window.location.href = '/';
        }, 1000);
        return;
      }
      
      setStatusMessage({ type: 'info', message: 'Creating temporary session...' });
      
      // Prepare request data with existing user information for conflict resolution
      const requestData = {
        restaurantId: restaurantContext.restaurantId,
        tableNumber: restaurantContext.tableNumber,
        restaurantName: restaurantContext.restaurantName,
        existingUserId: existingUser?.id,
        existingUserData: existingUser ? { 
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role
        } : null
      };
      
      console.log('📊 Request data:', requestData);
      
      // Create server session with conflict resolution
      const response = await fetch('/api/temp-session/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        
        // Log the error for debugging purposes
        logConflictResolutionEvent({
          type: 'error',
          userId: existingUser?.id,
          restaurantId: restaurantContext.restaurantId,
          tableNumber: restaurantContext.tableNumber,
          error: {
            status: response.status,
            statusText: response.statusText,
            errorText
          }
        });
        
        throw new Error(`Failed to create session: ${response.status} ${errorText}`);
      }

      const sessionData = await response.json();
      console.log('✅ Session created:', sessionData);
      

      if (sessionData.existingUserPrioritized) {
        console.log('🔄 Server prioritized existing user:', sessionData.userData);
        setStatusMessage({ 
          type: 'success', 
          message: 'Using your existing account for this session' 
        });
        
        
        securelyUpdateUserData(sessionData.userData, false);
        
        // Log the successful conflict resolution
        logConflictResolutionEvent({
          type: 'existing_user_prioritized',
          userId: sessionData.userData.id,
          restaurantId: restaurantContext.restaurantId,
          tableNumber: restaurantContext.tableNumber
        });
      } else {
        // Securely store temporary session data
        securelyUpdateUserData(sessionData.tempUser, true);
        
        console.log('💾 Temporary session data stored in localStorage');
        setStatusMessage({ 
          type: 'success', 
          message: 'Temporary session created successfully' 
        });
        
        // Log temporary user creation
        logConflictResolutionEvent({
          type: 'temp_user_created',
          userId: sessionData.tempUser.id,
          restaurantId: restaurantContext.restaurantId,
          tableNumber: restaurantContext.tableNumber
        });
      }
      
      console.log('🏠 Redirecting to home page...');
      // Add a small delay to show the success message before redirecting
      setTimeout(() => {
        // Force a refresh when redirecting to ensure context is applied
        window.location.href = '/';
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error creating session:', error);
      setStatusMessage({ 
        type: 'error', 
        message: 'Failed to create session' 
      });
      setError(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const [statusMessage, setStatusMessage] = useState<{
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // Update handleStartOrder to include status messages
  useEffect(() => {
    if (existingUser && !existingUser.isTemporary && tableData) {
      setStatusMessage({
        type: 'info',
        message: 'Using your existing account for this session'
      });
    }
  }, [existingUser, tableData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">
            {tableData ? 'Redirecting to sign in...' : 'Loading table information...'}
          </p>
          {tableData && (
            <p className="text-sm text-muted-foreground mt-2">
              Please sign in or continue as guest to access the menu
            </p>
          )}
          {statusMessage && (
            <div className={`mt-4 text-sm ${
              statusMessage.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
              statusMessage.type === 'error' ? 'text-destructive' :
              statusMessage.type === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-primary'
            }`}>
              {statusMessage.message}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Session Error</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Alert className="mb-4 bg-amber-50 dark:bg-amber-950/20">
                <AlertDescription>
                  {error.includes('conflict') 
                    ? 'We detected a conflict between your existing account and this session. Please try again or contact support if the issue persists.'
                    : 'There was a problem setting up your session. Please try scanning the QR code again.'}
                </AlertDescription>
              </Alert>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
              >
                Go to Homepage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground">No table data available</p>
        </div>
      </div>
    );
  }

  const { restaurant, table } = tableData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
              <p className="text-muted-foreground">Table {table.tableNumber}</p>
            </div>
            <Badge 
              variant={table.status === 'available' ? 'default' : 'secondary'}
              className="text-sm"
            >
              {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Utensils className="h-5 w-5" />
                  <span>Table Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Table Number</label>
                    <p className="text-lg font-semibold">{table.tableNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Floor</label>
                    <p className="text-lg font-semibold">Floor {table.floor}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Seating Capacity</label>
                    <p className="text-lg font-semibold">{table.seatingCapacity} people</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Table Type</label>
                    <p className="text-lg font-semibold capitalize">{table.tableType}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <p className="text-lg font-semibold">{table.location}</p>
                </div>

                {table.specialFeatures && table.specialFeatures.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Special Features</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {table.specialFeatures.map((feature, index) => (
                        <Badge key={index} variant="secondary">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Menu Access */}
            <Card>
              <CardHeader>
                <CardTitle>Menu & Ordering</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-800 mb-2">Ready to Order!</h3>
                    <p className="text-green-600 mb-4">
                      You're now connected to Table {table.tableNumber}. Browse our menu and place your order.
                    </p>
                    <Button 
                      onClick={handleStartOrder}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Continue to Menu
                    </Button>
                    <p className="text-xs text-green-500 mt-2">
                      You should be redirected automatically...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Restaurant Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Restaurant Info</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="text-sm">{restaurant.address}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contact</label>
                  <p className="text-sm">{restaurant.contactNumber}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Operating Hours</label>
                  <p className="text-sm flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{restaurant.operatingHours.open} - {restaurant.operatingHours.close}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Status Alert */}
            {table.status !== 'available' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This table is currently {table.status}. Please check with staff for assistance.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
