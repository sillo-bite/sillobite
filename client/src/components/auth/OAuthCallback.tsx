import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@shared/schema';

/**
 * OAuth Callback Handler
 *
 * SECURITY: This component does NOT read user identity from URL params.
 * The server sets the session after cryptographically verifying the Google
 * ID token, then redirects here with only ?status=success.
 * We call GET /api/auth/session to get the verified user from the server
 * session cookie — the only trusted source of identity.
 */
export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (processedRef.current) return;
      processedRef.current = true;

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');

        if (errorParam) {
          setError(`Authentication failed: ${errorParam}`);
          setIsLoading(false);
          setTimeout(() => setLocation('/login'), 3000);
          return;
        }

        // Only proceed if server signalled success
        const status = urlParams.get('status');
        if (status !== 'success') {
          setError('OAuth callback received without a success status.');
          setIsLoading(false);
          setTimeout(() => setLocation('/login'), 3000);
          return;
        }

        // ── SECURITY FIX: Fetch identity from server session, not URL params ──
        // The server set req.session.user after verifying the Google ID token.
        // We ask the server "who am I?" — this is the only trusted path.
        const sessionResponse = await fetch('/api/auth/session', {
          credentials: 'include', // send the session cookie
        });

        if (!sessionResponse.ok) {
          throw new Error('Session not found after OAuth. Please try signing in again.');
        }

        const sessionData = await sessionResponse.json();
        const serverUser = sessionData.user;

        if (!serverUser || !serverUser.email) {
          throw new Error('No user in session after OAuth.');
        }

        console.log('✅ Identity verified from server session:', serverUser.email);

        // Check if user is blocked
        if (serverUser.role && serverUser.role.startsWith('blocked_')) {
          setIsLoading(false);
          setLocation('/login?blocked=true');
          return;
        }

        await handleUserAuthentication(serverUser);
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsLoading(false);
        setTimeout(() => setLocation('/login'), 3000);
      }
    };

    handleCallback();
  }, [login]);

  const handleUserAuthentication = async (serverUser: any) => {
    const getPostLoginRedirect = (): string | null => {
      const authRedirect = sessionStorage.getItem('authRedirect');
      if (authRedirect) {
        sessionStorage.removeItem('authRedirect');
        return decodeURIComponent(authRedirect);
      }
      return null;
    };

    try {
      // Check if this is from an organization QR code
      const pendingOrgQRData = sessionStorage.getItem('pendingOrgQRData');
      let orgQRData: { organizationId: string; address: string; hash: string; timestamp: number } | null = null;

      if (pendingOrgQRData) {
        try {
          orgQRData = JSON.parse(pendingOrgQRData);
        } catch {
          // ignore parse errors
        }
      }

      // Fetch full user profile (server session has the DB record already,
      // but we may need additional fields for the UI)
      const userResponse = await fetch(`/api/users/by-email/${encodeURIComponent(serverUser.email)}`, {
        credentials: 'include',
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();

        // Handle org QR context
        if (orgQRData && (userData.role === UserRole.GUEST || !userData.organizationId)) {
          const validateResponse = await fetch(
            `/api/system-settings/qr-codes/validate/${orgQRData.organizationId}/${orgQRData.hash}?address=${encodeURIComponent(orgQRData.address)}`
          );

          if (validateResponse.ok) {
            const validationData = await validateResponse.json();
            const { organization, fullAddress } = validationData;
            sessionStorage.setItem('orgContext', JSON.stringify({
              organizationId: organization.id,
              organizationName: organization.name,
              fullAddress,
            }));
            sessionStorage.removeItem('pendingOrgQRData');
          }
        }

        const organizationId = userData.organizationId || null;

        const userDisplayData = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role ? String(userData.role).toLowerCase() : UserRole.GUEST,
          phoneNumber: userData.phoneNumber || '',
          college: userData.college || '',
          ...(organizationId && { organization: organizationId, organizationId }),
          ...((userData.role === UserRole.STUDENT ||
               userData.role === UserRole.EMPLOYEE ||
               userData.role === UserRole.CONTRACTOR ||
               userData.role === UserRole.VISITOR ||
               userData.role === UserRole.GUEST) && {
            registerNumber: userData.registerNumber || '',
            department: userData.department || '',
            currentStudyYear: userData.currentStudyYear?.toString() || '1',
            isPassed: userData.isPassed || false,
          }),
          ...(userData.role === UserRole.STAFF && { staffId: userData.staffId || '' }),
          selectedLocationType: userData.selectedLocationType,
          selectedLocationId: userData.selectedLocationId,
          restaurantId: userData.restaurantId,
          restaurantName: userData.restaurantName,
          tableNumber: userData.tableNumber,
        };

        login(userDisplayData);

        const authRedirect = sessionStorage.getItem('authRedirect');
        if (authRedirect) {
          sessionStorage.removeItem('authRedirect');
          setLocation(decodeURIComponent(authRedirect));
          return;
        }

        const userRole = userData.role ? String(userData.role).toLowerCase() : '';

        if (userRole === UserRole.SUPER_ADMIN) {
          setLocation('/admin');
        } else if (userRole === UserRole.ADMIN) {
          setLocation('/college-admin');
        } else if (userRole === UserRole.CANTEEN_OWNER || userRole === 'canteen-owner') {
          try {
            const canteenResponse = await fetch(`/api/system-settings/canteens/by-owner/${userData.email}`, {
              credentials: 'include',
            });
            if (canteenResponse.ok) {
              const canteenData = await canteenResponse.json();
              setLocation(`/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
            } else {
              setLocation('/login?error=no_canteen');
            }
          } catch {
            setLocation('/login?error=canteen_fetch_failed');
          }
        } else if (userRole === UserRole.DELIVERY_PERSON) {
          setTimeout(() => setLocation('/delivery-portal'), 100);
        } else {
          setTimeout(() => setLocation('/app'), 100);
        }

      } else {
        // User does not exist in DB yet — create them
        if (orgQRData) {
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

          const guestUser = {
            email: serverUser.email,
            name: serverUser.name || '',
            phoneNumber: '',
            role: UserRole.GUEST,
            college: organization.name,
            isProfileComplete: false,
          };

          const createResponse = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guestUser),
          });

          if (createResponse.ok || createResponse.status === 409) {
            const newUser = createResponse.ok
              ? await createResponse.json()
              : await fetch(`/api/users/by-email/${encodeURIComponent(serverUser.email)}`, { credentials: 'include' }).then(r => r.json());

            sessionStorage.setItem('orgContext', JSON.stringify({
              organizationId: organization.id,
              organizationName: organization.name,
              fullAddress,
            }));
            sessionStorage.removeItem('pendingOrgQRData');

            setIsLoading(false);
            const redirect = getPostLoginRedirect();
            setLocation(redirect || `/profile-setup?email=${encodeURIComponent(newUser.email)}&name=${encodeURIComponent(newUser.name)}`);
          } else {
            const errData = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
            alert(`Failed to create account: ${errData.message}`);
            setIsLoading(false);
            setLocation('/login');
          }
        } else {
          // Regular new Google user
          const createResponse = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: serverUser.email,
              name: serverUser.name || '',
              role: UserRole.GUEST,
              isProfileComplete: false,
            }),
          });

          const createdUser = createResponse.ok
            ? await createResponse.json()
            : createResponse.status === 409
              ? await fetch(`/api/users/by-email/${encodeURIComponent(serverUser.email)}`, { credentials: 'include' }).then(r => r.json())
              : null;

          if (createdUser) {
            login({
              id: createdUser.id,
              name: createdUser.name,
              email: createdUser.email,
              role: createdUser.role || UserRole.GUEST,
              phoneNumber: createdUser.phoneNumber || '',
            });
            setIsLoading(false);
            const redirect = getPostLoginRedirect();
            setTimeout(() => setLocation(redirect || '/app'), 100);
          } else {
            const errData = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
            alert(`Failed to create account: ${errData.message}`);
            setIsLoading(false);
            setLocation('/login');
          }
        }
      }
    } catch (err) {
      console.error('User authentication error:', err);
      setError('Failed to authenticate user');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Completing sign-in...</h2>
          <p className="text-muted-foreground">Please wait while we verify your account.</p>
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
