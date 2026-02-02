import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { setPWAAuth } from '@/utils/pwaAuth';
import { UserRole } from '@shared/schema';

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔄 OAuthCallback component mounted');
        console.log('📍 Current URL:', window.location.href);

        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');

        if (errorParam) {
          setError(`Authentication failed: ${errorParam}`);
          setIsLoading(false);
          setTimeout(() => setLocation('/login'), 3000);
          return;
        }

        console.log('Fetching authenticated user from session...');
        const response = await fetch('/api/auth/google/me', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to get authenticated user');
        }

        const googleUser = await response.json();
        console.log('Google user authenticated:', googleUser.email);

        setIsSuccess(true);
        await handleUserAuthentication(googleUser);
      } catch (error) {
        console.error('OAuth callback error:', error);
        setError(error instanceof Error ? error.message : 'Authentication failed');
        setIsLoading(false);
        setTimeout(() => setLocation('/login'), 3000);
      }
    };

    handleCallback();
  }, [login]);

  const handleUserAuthentication = async (user: any) => {
    try {
      console.log('Starting user authentication for:', user.email);

      // Check if this is from organization QR code
      const pendingOrgQRData = sessionStorage.getItem('pendingOrgQRData');
      let orgQRData: { organizationId: string; address: string; hash: string; timestamp: number } | null = null;

      if (pendingOrgQRData) {
        try {
          orgQRData = JSON.parse(pendingOrgQRData);
        } catch (error) {
          console.error('Error parsing org QR data:', error);
        }
      }

      // Check if user exists in database
      // Use cache: 'force-cache' to prevent duplicate calls if data was recently fetched
      const userResponse = await fetch(`/api/users/by-email/${user.email}`, {
        cache: 'default', // Use browser cache if available
        headers: {
          'Cache-Control': 'max-age=60' // Cache for 60 seconds
        }
      });
      console.log('User response status:', userResponse.status);

      if (userResponse.ok) {
        // User exists, check if they are blocked
        const userData = await userResponse.json();
        console.log('User data received:', userData);

        // Check if user is blocked (role starts with 'blocked_')
        if (userData.role && userData.role.startsWith('blocked_')) {
          setIsLoading(false);
          setLocation('/login?blocked=true');
          return;
        }

        // Debug logs removed


        // Check if user came from organization QR; apply context but do not force profile setup
        if (orgQRData && (userData.role === UserRole.GUEST || !userData.organizationId)) {
          // Validate QR code first
          const validateResponse = await fetch(
            `/api/system-settings/qr-codes/validate/${orgQRData.organizationId}/${orgQRData.hash}?address=${encodeURIComponent(orgQRData.address)}`
          );

          if (validateResponse.ok) {
            const validationData = await validateResponse.json();
            const { organization, fullAddress } = validationData;

            // Store organization context (including full address)
            sessionStorage.setItem('orgContext', JSON.stringify({
              organizationId: organization.id,
              organizationName: organization.name,
              fullAddress: fullAddress,
            }));

            // Remove pending QR data
            sessionStorage.removeItem('pendingOrgQRData');
            // Do not require phone number; continue to login flow
          }
        }

        // Get organizationId from database (now stored in user record)
        // For guest users, organizationId is stored in the database
        const organizationId = userData.organizationId || null;
        console.log('🔧 Organization ID from database:', organizationId);

        // Login user directly without profile completion check
        const userDisplayData = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          phoneNumber: userData.phoneNumber || '',
          college: userData.college || '', // Include college field
          // Use organizationId from database
          ...(organizationId && {
            organization: organizationId,
            organizationId: organizationId,
          }),
          ...((userData.role === UserRole.STUDENT || userData.role === UserRole.EMPLOYEE || userData.role === UserRole.CONTRACTOR || userData.role === UserRole.VISITOR || userData.role === UserRole.GUEST) && {
            registerNumber: userData.registerNumber || '',
            department: userData.department || '',
            currentStudyYear: userData.currentStudyYear?.toString() || '1',
            isPassed: userData.isPassed || false,
          }),
          ...(userData.role === UserRole.STAFF && {
            staffId: userData.staffId || '',
          }),
          // Include location preferences
          selectedLocationType: userData.selectedLocationType,
          selectedLocationId: userData.selectedLocationId,
          // Include restaurant context if present
          restaurantId: userData.restaurantId,
          restaurantName: userData.restaurantName,
          tableNumber: userData.tableNumber
        };

        console.log('Logging in user with data:', userDisplayData);
        console.log('🔧 Organization ID from database:', userDisplayData.organization);

        // Use the proper login function to maintain authentication state
        login(userDisplayData);

        // Keep loading state true until redirect completes
        // Redirect based on role
        if (userData.role === UserRole.SUPER_ADMIN || userData.role === UserRole.ADMIN) {
          setLocation('/admin');
        } else if (userData.role === UserRole.CANTEEN_OWNER) {
          // For canteen owners, we need to get their canteen ID first
          try {
            console.log('Fetching canteen for owner:', userData.email);
            const canteenResponse = await fetch(`/api/system-settings/canteens/by-owner/${userData.email}`);
            console.log('Canteen response status:', canteenResponse.status);

            if (canteenResponse.ok) {
              const canteenData = await canteenResponse.json();
              console.log('Canteen data received:', canteenData);
              console.log('Redirecting canteen owner to:', `/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
              setLocation(`/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
            } else {
              // If canteen not found, redirect to login with error
              const errorText = await canteenResponse.text();
              console.error('Canteen not found for owner:', userData.email, 'Response:', errorText);
              setLocation('/login?error=no_canteen');
            }
          } catch (error) {
            console.error('Error fetching canteen for owner:', error);
            setLocation('/login?error=canteen_fetch_failed');
          }
        } else if (userData.role === UserRole.DELIVERY_PERSON) {
          console.log('✅ Login successful, redirecting delivery person to portal');
          setTimeout(() => {
            setLocation('/delivery-portal');
          }, 100);
        } else {
          // Always redirect to /app after successful login to avoid splash screen
          console.log('✅ Login successful, redirecting to app');
          // Add a small delay to ensure login state is persisted
          setTimeout(() => {
            setLocation('/app');
          }, 100);
        }
      } else {
        console.log('User not found, checking for organization QR context');

        // User doesn't exist - check if from organization QR
        if (orgQRData) {
          // Validate QR code first
          const validateResponse = await fetch(
            `/api/system-settings/qr-codes/validate/${orgQRData.organizationId}/${orgQRData.hash}?address=${encodeURIComponent(orgQRData.address)}`
          );

          if (!validateResponse.ok) {
            alert('Invalid QR code. Please scan again.');
            setIsLoading(false);
            setLocation('/login');
            return;
          }

          const validationData = await validateResponse.json();
          const { organization, fullAddress } = validationData;

          // Create guest user - no registerNumber, department, or joiningYear needed
          const guestUser = {
            email: user.email,
            name: user.name || '',
            phoneNumber: '', // Will be collected in profile setup
            role: UserRole.GUEST,
            college: organization.name, // Store organization name in college field
            isProfileComplete: false, // Need to collect phone number
          };

          const createResponse = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guestUser)
          });

          if (createResponse.ok) {
            const newUser = await createResponse.json();

            // Store organization context for profile setup (including full address)
            sessionStorage.setItem('orgContext', JSON.stringify({
              organizationId: organization.id,
              organizationName: organization.name,
              fullAddress: fullAddress, // Store full address to auto-add to user addresses
            }));

            // Remove pending QR data
            sessionStorage.removeItem('pendingOrgQRData');

            console.log('✅ Guest user created with organization context, redirecting to profile setup');
            setIsLoading(false);
            setLocation(`/profile-setup?email=${encodeURIComponent(newUser.email)}&name=${encodeURIComponent(newUser.name)}`);
          } else if (createResponse.status === 409) {
            // User already exists (race condition - Google OAuth created user first)
            // Fetch the existing user and continue with the flow
            console.log('⚠️ User already exists (race condition), fetching existing user...');
            const existingUserResponse = await fetch(`/api/users/by-email/${user.email}`);
            if (existingUserResponse.ok) {
              const existingUser = await existingUserResponse.json();

              // Store organization context for profile setup (including full address)
              sessionStorage.setItem('orgContext', JSON.stringify({
                organizationId: organization.id,
                organizationName: organization.name,
                fullAddress: fullAddress, // Store full address to auto-add to user addresses
              }));

              // Remove pending QR data
              sessionStorage.removeItem('pendingOrgQRData');

              // Check if user needs profile completion
              if (!existingUser.phoneNumber || !existingUser.organizationId) {
                // Update user with organizationId if missing
                if (!existingUser.organizationId) {
                  try {
                    await fetch(`/api/users/${existingUser.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        organizationId: organization.id,
                      })
                    });
                  } catch (e) {
                    console.error('Error updating user with organizationId:', e);
                  }
                }

                console.log('✅ Existing user needs profile completion, redirecting to profile setup');
                setIsLoading(false);
                setLocation(`/profile-setup?email=${encodeURIComponent(existingUser.email)}&name=${encodeURIComponent(existingUser.name)}`);
              } else {
                // User is complete, log them in
                const organizationId = existingUser.organizationId || organization.id;
                const userDisplayData = {
                  id: existingUser.id,
                  name: existingUser.name,
                  email: existingUser.email,
                  role: existingUser.role || UserRole.GUEST,
                  phoneNumber: existingUser.phoneNumber || '',
                  ...(organizationId && {
                    organization: organizationId,
                    organizationId: organizationId,
                  }),
                };
                login(userDisplayData);
                setIsLoading(false);
                setTimeout(() => {
                  setLocation('/app');
                }, 100);
              }
            } else {
              const errorData = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
              alert(`Failed to create account: ${errorData.message || 'Unknown error'}`);
              setIsLoading(false);
              setLocation('/login');
            }
          } else {
            const errorData = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
            alert(`Failed to create account: ${errorData.message || 'Unknown error'}`);
            setIsLoading(false);
            setLocation('/login');
          }
        } else {
          // Regular new Google user - create minimal account and login
          const minimalUser = {
            email: user.email,
            name: user.name || '',
            role: UserRole.GUEST,
            isProfileComplete: false,
          };
          const createResponse = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(minimalUser)
          });
          if (createResponse.ok) {
            const created = await createResponse.json();
            const userDisplayData = {
              id: created.id,
              name: created.name,
              email: created.email,
              role: created.role || UserRole.GUEST,
              phoneNumber: created.phoneNumber || '',
            };
            login(userDisplayData);
            setIsLoading(false);
            setTimeout(() => {
              setLocation('/app');
            }, 100);
          } else if (createResponse.status === 409) {
            const existingUserResponse = await fetch(`/api/users/by-email/${user.email}`);
            if (existingUserResponse.ok) {
              const existingUser = await existingUserResponse.json();
              const userDisplayData = {
                id: existingUser.id,
                name: existingUser.name,
                email: existingUser.email,
                role: existingUser.role || 'guest',
                phoneNumber: existingUser.phoneNumber || '',
              };
              login(userDisplayData);
              setIsLoading(false);
              setTimeout(() => {
                setLocation('/app');
              }, 100);
            } else {
              const errData = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
              alert(`Failed to create account: ${errData.message || 'Unknown error'}`);
              setIsLoading(false);
              setLocation('/login');
            }
          } else {
            const errData = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
            alert(`Failed to create account: ${errData.message || 'Unknown error'}`);
            setIsLoading(false);
            setLocation('/login');
          }
        }
      }
    } catch (error) {
      console.error('User authentication error:', error);
      setError('Failed to authenticate user');
      setIsLoading(false);
    }
  };

  if (isLoading || isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {isSuccess ? 'Sign-in successful!' : 'Completing sign-in...'}
          </h2>
          <p className="text-muted-foreground">
            {isSuccess ? 'Redirecting you now...' : 'Please wait while we authenticate your account.'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Authentication Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => setLocation('/login')}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}
