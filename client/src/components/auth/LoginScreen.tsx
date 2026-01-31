import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithGoogle } from "@/lib/googleAuth";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { ProfileSetupScreen } from "@/components/auth/ProfileSetupScreen";
import ForgotEmailScreen from "@/components/auth/ForgotEmailScreen";
import LoginIssuesScreen from "@/components/auth/LoginIssuesScreen";
import BlockedUserScreen from "@/components/auth/BlockedUserScreen";
import {
  resolveUserSessionConflict,
  securelyUpdateUserData
} from '@/utils/sessionConflictResolver';
import { useUserFromCache } from '@/hooks/useUserFromCache';
import { Mail, Lock, Eye, EyeOff, XCircle, User } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { setPWAAuth } from "@/utils/pwaAuth";
import { updateStatusBarColor } from "@/utils/statusBar";
import { UserRole } from "@shared/schema";

interface QRTableData {
  restaurantId: string;
  restaurantName: string;
  tableNumber: string;
  hash?: string;
  timestamp: number;
}

interface OrganizationQRData {
  organizationId: string;
  address: string;
  hash: string;
  timestamp: number;
}

export default function LoginScreen() {
  const [, setLocation] = useLocation();
  const { login, user, isLoading: authLoading } = useAuth();
  const { resolvedTheme } = useTheme();
  const { data: existingUser } = useUserFromCache();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleSignInLoading, setIsGoogleSignInLoading] = useState(false);
  const [isEmailPasswordLoading, setIsEmailPasswordLoading] = useState(false);
  const [showForgotEmail, setShowForgotEmail] = useState(false);
  const [showLoginIssues, setShowLoginIssues] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState<{
    email: string;
    name: string;
  } | null>(null);
  const [blockedUser, setBlockedUser] = useState<{
    id: string | number;
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [qrTableData, setQrTableData] = useState<QRTableData | null>(null);
  const [orgQRData, setOrgQRData] = useState<OrganizationQRData | null>(null);
  const [isGuestSignInLoading, setIsGuestSignInLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [emailPasswordForm, setEmailPasswordForm] = useState({
    identifier: "", // email or mobile for login; email for registration
    password: "",
    name: "", // Add name field for registration
  });
  const [showPassword, setShowPassword] = useState(false);
  const [emailPasswordError, setEmailPasswordError] = useState<string | null>(null);

  // Update status bar to match background color
  useEffect(() => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const bgColor = computed.getPropertyValue('--background').trim();
    if (bgColor) {
      // Convert HSL to RGB/hex
      const tempDiv = document.createElement('div');
      tempDiv.style.backgroundColor = `hsl(${bgColor})`;
      document.body.appendChild(tempDiv);
      const computedColor = window.getComputedStyle(tempDiv).backgroundColor;
      document.body.removeChild(tempDiv);
      updateStatusBarColor(computedColor);
    } else {
      // Fallback to light/dark based on theme
      const isDark = resolvedTheme === 'dark';
      updateStatusBarColor(isDark ? '#1a0a2e' : '#f5ecfa');
    }
  }, [resolvedTheme]);

  // Redirect to onboarding if user directly visits login page without being authenticated
  // (They should go through Splash → Onboarding → Login flow)
  useEffect(() => {
    // Only redirect if:
    // 1. Auth loading is complete
    // 2. No user is authenticated
    // 3. Not coming from onboarding (using sessionStorage flag to prevent redirect loop)
    // 4. No QR code data (QR codes should go directly to login)
    if (!authLoading && !user) {
      const urlParams = new URLSearchParams(window.location.search);
      const fromQR = urlParams.get('fromQR') === 'true';
      const skipOnboarding = urlParams.get('skipOnboarding') === 'true';
      const pendingQRData = sessionStorage.getItem('pendingQRTableData');
      const fromOnboarding = sessionStorage.getItem('fromOnboarding') === 'true';

      // Clear the onboarding flag after checking
      if (fromOnboarding) {
        sessionStorage.removeItem('fromOnboarding');
      }

      // If user directly accessed login without onboarding and no QR data, redirect to onboarding
      if (!fromQR && !skipOnboarding && !pendingQRData && !fromOnboarding) {
        // This ensures users go through the proper flow: Splash → Onboarding → Login
        console.log('🔄 Redirecting to onboarding - user accessed login directly');
        setLocation('/onboarding');
        return;
      }
    }
  }, [authLoading, user, setLocation]);

  // Check for pending QR table data on mount
  useEffect(() => {
    const pendingQRData = sessionStorage.getItem('pendingQRTableData');
    if (pendingQRData) {
      try {
        const data = JSON.parse(pendingQRData) as QRTableData;
        // Check if data is not too old (e.g., less than 10 minutes)
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        if (data.timestamp > tenMinutesAgo) {
          setQrTableData(data);
        } else {
          // Data is too old, remove it
          sessionStorage.removeItem('pendingQRTableData');
        }
      } catch (error) {
        console.error('Error parsing QR table data:', error);
        sessionStorage.removeItem('pendingQRTableData');
      }
    }
  }, []);

  // Check for organization QR data from URL params and validate cached user
  useEffect(() => {
    const handleOrgQRWithCache = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const orgQRParam = urlParams.get('orgQR');
      let qrData: OrganizationQRData | null = null;

      if (orgQRParam) {
        try {
          const data = JSON.parse(decodeURIComponent(orgQRParam)) as OrganizationQRData;
          const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
          if (data.timestamp > tenMinutesAgo) {
            qrData = data;
            sessionStorage.setItem('pendingOrgQRData', JSON.stringify(data));
          } else {
            urlParams.delete('orgQR');
            window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
          }
        } catch (error) {
          console.error('Error parsing organization QR data:', error);
        }
      } else {
        const pendingOrgQRData = sessionStorage.getItem('pendingOrgQRData');
        if (pendingOrgQRData) {
          try {
            const data = JSON.parse(pendingOrgQRData) as OrganizationQRData;
            const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
            if (data.timestamp > tenMinutesAgo) {
              qrData = data;
            } else {
              sessionStorage.removeItem('pendingOrgQRData');
            }
          } catch (error) {
            console.error('Error parsing organization QR data from storage:', error);
            sessionStorage.removeItem('pendingOrgQRData');
          }
        }
      }

      // If QR data exists, check for cached authenticated user FIRST
      if (qrData && existingUser && !authLoading) {
        console.log('🔍 Organization QR detected with cached user, validating...');

        try {
          // Validate QR code first
          const validateResponse = await fetch(
            `/api/system-settings/qr-codes/validate/${qrData.organizationId}/${qrData.hash}?address=${encodeURIComponent(qrData.address)}`
          );

          if (validateResponse.ok) {
            const validationData = await validateResponse.json();
            const { organization, fullAddress } = validationData;

            console.log('✅ QR code validated, organization:', organization.name);

            // Apply organization context; do not force profile setup
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

            sessionStorage.setItem('orgContext', JSON.stringify({
              organizationId: organization.id,
              organizationName: organization.name,
              fullAddress: fullAddress,
            }));

            // User is fully authenticated and profile is complete, log them in directly
            console.log('✅ Cached user is complete, logging in directly');

            const userDisplayData = {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
              role: existingUser.role || UserRole.GUEST,
              phoneNumber: existingUser.phoneNumber || '',
              ...(existingUser.organizationId && {
                organization: existingUser.organizationId,
                organizationId: existingUser.organizationId,
              }),
            };

            login(userDisplayData as any);

            // Remove pending QR data
            sessionStorage.removeItem('pendingOrgQRData');

            // Redirect to app
            setTimeout(() => {
              setLocation('/app');
            }, 100);
            return;
          } else {
            console.warn('⚠️ QR code validation failed');
          }
        } catch (error) {
          console.error('Error validating QR with cached user:', error);
        }
      }

      // If no cached user or validation failed, set QR data to show sign-in
      if (qrData) {
        setOrgQRData(qrData);
      }
    };

    handleOrgQRWithCache();
  }, [existingUser, authLoading, login, setLocation]);

  const handleUserAuthentication = async (user: any) => {
    try {
      // Check if this is from organization QR code
      const pendingOrgQRData = sessionStorage.getItem('pendingOrgQRData');
      let orgQRData: OrganizationQRData | null = null;

      if (pendingOrgQRData) {
        try {
          orgQRData = JSON.parse(pendingOrgQRData) as OrganizationQRData;
        } catch (error) {
          console.error('Error parsing org QR data:', error);
        }
      }

      // Check if user exists in database
      // Use cache to prevent duplicate calls
      const userResponse = await fetch(`/api/users/by-email/${user.email}`, {
        cache: 'default', // Use browser cache if available
        headers: {
          'Cache-Control': 'max-age=60' // Cache for 60 seconds
        }
      });

      if (userResponse.ok) {
        // User exists, check if they are blocked
        const userData = await userResponse.json();

        // Check if user is blocked (role starts with 'blocked_')
        if (userData.role && userData.role.startsWith('blocked_')) {
          setBlockedUser({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role,
          });
          return;
        }

        // Check if user came from organization QR and needs profile completion
        if (orgQRData && (userData.role === UserRole.GUEST || !userData.phoneNumber || !userData.organizationId)) {
          // Validate QR code first
          const validateResponse = await fetch(
            `/api/system-settings/qr-codes/validate/${orgQRData.organizationId}/${orgQRData.hash}?address=${encodeURIComponent(orgQRData.address)}`
          );

          if (validateResponse.ok) {
            const validationData = await validateResponse.json();
            const { organization, fullAddress } = validationData;

            // Store organization context for profile setup (including full address)
            sessionStorage.setItem('orgContext', JSON.stringify({
              organizationId: organization.id,
              organizationName: organization.name,
              fullAddress: fullAddress, // Store full address to auto-add to user addresses
            }));

            // Remove pending QR data
            sessionStorage.removeItem('pendingOrgQRData');
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
          role: userData.role || UserRole.STUDENT, // Ensure role is always set
          phoneNumber: userData.phoneNumber || '',
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
        };

        // Log role for debugging
        console.log('🔐 Login - User role:', userData.role, 'User data:', userDisplayData);
        console.log('🔧 Organization ID from database:', userDisplayData.organization);

        // Check for pending QR table data and apply restaurant context if available
        const pendingQRData = sessionStorage.getItem('pendingQRTableData');
        if (pendingQRData) {
          try {
            const qrData = JSON.parse(pendingQRData) as QRTableData;
            const restaurantContext = {
              restaurantId: qrData.restaurantId,
              restaurantName: qrData.restaurantName,
              tableNumber: qrData.tableNumber
            };

            // Apply restaurant context to user data
            const updatedUserData = resolveUserSessionConflict(userDisplayData, restaurantContext);

            // Store updated user data with restaurant context
            if (updatedUserData) {
              securelyUpdateUserData(updatedUserData, false);

              // Also call login to ensure auth context is updated
              login(updatedUserData as any);
            } else {
              login(userDisplayData as any);
            }

            // Remove pending QR data
            sessionStorage.removeItem('pendingQRTableData');

            console.log('✅ Restaurant context applied to authenticated user from QR code');
          } catch (error) {
            console.error('Error applying QR context:', error);
            // Continue with normal login if QR context application fails
            login(userDisplayData);
          }
        } else {
          // Use the proper login function to maintain authentication state
          login(userDisplayData as any);
        }

        // Add a small delay to ensure login state is persisted before redirect
        setTimeout(async () => {
          // Redirect based on role (handle both naming conventions)
          if (userData.role === UserRole.SUPER_ADMIN || userData.role === UserRole.ADMIN) {
            setLocation("/admin");
          } else if (userData.role === UserRole.CANTEEN_OWNER || userData.role === 'canteen-owner') {
            // For canteen owners, fetch canteen ID first
            try {
              const canteenResponse = await fetch(`/api/system-settings/canteens/by-owner/${userData.email}`);
              if (canteenResponse.ok) {
                const canteenData = await canteenResponse.json();
                setLocation(`/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
              } else {
                setLocation('/login?error=no_canteen');
              }
            } catch (error) {
              console.error('Error fetching canteen:', error);
              setLocation('/login?error=canteen_fetch_failed');
            }
          } else if (userData.role === UserRole.DELIVERY_PERSON) {
            setLocation("/delivery-portal");
          } else {
            setLocation("/app");
          }
        }, 100);
      } else if (userResponse.status === 404) {
        // User doesn't exist - check for special admin accounts
        if (user.email === 'admin@canteen.local') {
          // Create super admin
          const adminUser = {
            email: user.email,
            name: user.displayName || 'Super Admin',
            phoneNumber: '',
            role: UserRole.SUPER_ADMIN,
            isProfileComplete: true,
          };

          const createResponse = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adminUser)
          });

          if (createResponse.ok) {
            const newUser = await createResponse.json();
            login({
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
            });
            setLocation("/admin");
          }
        } else if (user.email === 'owner@canteen.local') {
          // Create canteen owner
          const ownerUser = {
            email: user.email,
            name: user.displayName || 'Canteen Owner',
            phoneNumber: '',
            role: UserRole.CANTEEN_OWNER,
            isProfileComplete: true,
          };

          const createResponse = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ownerUser)
          });

          if (createResponse.ok) {
            const newUser = await createResponse.json();
            login({
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
            });
            // For canteen owners, fetch canteen ID first
            try {
              const canteenResponse = await fetch(`/api/system-settings/canteens/by-owner/${newUser.email}`);
              if (canteenResponse.ok) {
                const canteenData = await canteenResponse.json();
                setLocation(`/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
              } else {
                setLocation('/login?error=no_canteen');
              }
            } catch (error) {
              console.error('Error fetching canteen:', error);
              setLocation('/login?error=canteen_fetch_failed');
            }
          }
        } else {
          // New user - check if from organization QR
          if (orgQRData) {
            // Validate QR code first
            const validateResponse = await fetch(
              `/api/system-settings/qr-codes/validate/${orgQRData.organizationId}/${orgQRData.hash}?address=${encodeURIComponent(orgQRData.address)}`
            );

            if (!validateResponse.ok) {
              alert('Invalid QR code. Please scan again.');
              return;
            }

            const validationData = await validateResponse.json();
            const { organization, fullAddress } = validationData;

            // Create guest user - no registerNumber, department, or joiningYear needed
            const guestUser = {
              email: user.email,
              name: user.displayName || user.name || '',
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

              // Store organization context (including full address)
              sessionStorage.setItem('orgContext', JSON.stringify({
                organizationId: organization.id,
                organizationName: organization.name,
                fullAddress: fullAddress,
              }));

              // Remove pending QR data
              sessionStorage.removeItem('pendingOrgQRData');

              // Login directly with minimal user data
              const userDisplayData = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role || UserRole.GUEST,
                phoneNumber: newUser.phoneNumber || '',
                organization: organization.id,
                organizationId: organization.id,
              };
              login(userDisplayData as any);
              setTimeout(() => {
                setLocation("/app");
              }, 100);
            } else if (createResponse.status === 409) {
              // User already exists (race condition - Google OAuth created user first)
              // Fetch the existing user and continue with the flow
              console.log('⚠️ User already exists (race condition), fetching existing user...');
              const existingUserResponse = await fetch(`/api/users/by-email/${user.email}`);
              if (existingUserResponse.ok) {
                const existingUser = await existingUserResponse.json();

                // Store organization context (including full address)
                sessionStorage.setItem('orgContext', JSON.stringify({
                  organizationId: organization.id,
                  organizationName: organization.name,
                  fullAddress: fullAddress, // Store full address to auto-add to user addresses
                }));

                // Remove pending QR data
                sessionStorage.removeItem('pendingOrgQRData');

                // If missing organizationId, update it; phone number is optional
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

                // Log in regardless of phone number
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
                login(userDisplayData as any);
                setTimeout(() => {
                  setLocation("/app");
                }, 100);
              } else {
                const errorData = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
                alert(`Failed to create account: ${errorData.message || 'Unknown error'}`);
              }
            } else {
              const errorData = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
              alert(`Failed to create account: ${errorData.message || 'Unknown error'}`);
            }
          } else {
            // New regular Google user - create minimal account and login
            const minimalUser = {
              email: user.email,
              name: user.displayName || user.name || '',
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
              login(userDisplayData as any);
              setTimeout(() => {
                setLocation("/app");
              }, 100);
            } else if (createResponse.status === 409) {
              const existingUserResponse = await fetch(`/api/users/by-email/${user.email}`);
              if (existingUserResponse.ok) {
                const existingUser = await existingUserResponse.json();
                const userDisplayData = {
                  id: existingUser.id,
                  name: existingUser.name,
                  email: existingUser.email,
                  role: existingUser.role || UserRole.GUEST,
                  phoneNumber: existingUser.phoneNumber || '',
                };
                login(userDisplayData as any);
                setTimeout(() => {
                  setLocation("/app");
                }, 100);
              } else {
                const err = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
                alert(`Failed to create account: ${err.message || 'Unknown error'}`);
              }
            } else {
              const err = await createResponse.json().catch(() => ({ message: 'Unknown error' }));
              alert(`Failed to create account: ${err.message || 'Unknown error'}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
    }
  };

  const handleDevModeSkipLogin = async () => {
    setIsLoading(true);
    try {
      // First, check if dev user exists in database
      const devEmail = 'dev.test@canteen.local';
      let userResponse = await fetch(`/api/users/by-email/${devEmail}`);

      let devUserData;
      if (userResponse.ok) {
        // Dev user exists, use existing data
        devUserData = await userResponse.json();
      } else {
        // Create dev user in database with unique register number
        const timestamp = Date.now();
        const createDevUser = {
          email: devEmail,
          name: 'Dev Test User',
          phoneNumber: '+91-9876543210',
          role: UserRole.STUDENT,
          registerNumber: `DEV${timestamp}`,
          department: 'Computer Science',
          joiningYear: 2022,
          passingOutYear: 2026,
          currentStudyYear: 3,
          isPassed: false,
          isProfileComplete: true
        };

        const createResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createDevUser)
        });

        if (createResponse.ok) {
          devUserData = await createResponse.json();
        } else {
          // If creation fails, try to find existing dev user with different register number
          const errorData = await createResponse.json();
          if (errorData.message?.includes('Register number is already registered')) {
            // Try to find any existing dev user
            const searchResponse = await fetch('/api/users?search=dev.test@canteen.local');
            if (searchResponse.ok) {
              const users = await searchResponse.json();
              const devUser = users.find((user: any) => user.email === devEmail);
              if (devUser) {
                devUserData = devUser;
              } else {
                throw new Error('Dev user exists but could not be found');
              }
            } else {
              throw new Error('Failed to create dev user and could not find existing one');
            }
          } else {
            throw new Error('Failed to create dev user');
          }
        }
      }

      // Create the user object for login
      const devUser = {
        id: devUserData.id,
        name: devUserData.name,
        email: devUserData.email,
        role: devUserData.role,
        phoneNumber: devUserData.phoneNumber || '+91-9876543210',
        registerNumber: devUserData.registerNumber || `DEV${Date.now()}`,
        department: devUserData.department || 'Computer Science',
        currentStudyYear: devUserData.currentStudyYear?.toString() || '3',
        isPassed: devUserData.isPassed || false
      };

      // Log in the dev user
      login(devUser);
      setLocation("/home");
    } catch (error) {
      console.error('Dev login error:', error);
      alert(`Dev mode login failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleSignInLoading(true);
    try {
      // signInWithGoogle() redirects the page, so we don't need to handle the result here
      signInWithGoogle();
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      setIsGoogleSignInLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailPasswordError(null);
    setIsEmailPasswordLoading(true);
    const trimmedIdentifier = emailPasswordForm.identifier.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = trimmedIdentifier.replace(/\D/g, '');
    const isEmail = emailRegex.test(trimmedIdentifier);
    const isPhone = phoneDigits.length >= 8;

    try {
      if (isLogin) {
        // Login
        if (!trimmedIdentifier || !emailPasswordForm.password) {
          setEmailPasswordError("Please enter email/phone and password");
          setIsEmailPasswordLoading(false);
          return;
        }

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Support legacy email field on the backend while introducing identifier
            identifier: trimmedIdentifier,
            email: trimmedIdentifier,
            password: emailPasswordForm.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setEmailPasswordError(data.error || 'Login failed');
          setIsEmailPasswordLoading(false);
          return;
        }

        // Login successful
        const userDisplayData = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          phoneNumber: data.user.phoneNumber || '',
          college: data.user.college || '',
          ...((data.user.role === UserRole.STUDENT || data.user.role === UserRole.EMPLOYEE || data.user.role === UserRole.CONTRACTOR || data.user.role === UserRole.VISITOR || data.user.role === UserRole.GUEST) && {
            registerNumber: data.user.registerNumber || '',
            department: data.user.department || '',
            currentStudyYear: data.user.currentStudyYear?.toString() || '1',
            isPassed: data.user.isPassed || false,
          }),
          ...(data.user.role === "staff" && {
            staffId: data.user.staffId || '',
          }),
        };

        // Check for pending QR table data and apply restaurant context if available
        const pendingQRData = sessionStorage.getItem('pendingQRTableData');
        if (pendingQRData) {
          try {
            const qrData = JSON.parse(pendingQRData) as QRTableData;
            const restaurantContext = {
              restaurantId: qrData.restaurantId,
              restaurantName: qrData.restaurantName,
              tableNumber: qrData.tableNumber
            };

            const updatedUserData = resolveUserSessionConflict(userDisplayData, restaurantContext);
            if (updatedUserData) {
              securelyUpdateUserData(updatedUserData, false);
              login(updatedUserData as any);
            } else {
              login(userDisplayData as any);
            }
            sessionStorage.removeItem('pendingQRTableData');
          } catch (error) {
            console.error('Error applying QR context:', error);
            login(userDisplayData);
          }
        } else {
          login(userDisplayData);
        }

        // Redirect based on role
        if (data.user.role === 'super_admin' || data.user.role === 'admin') {
          setLocation("/admin");
        } else if (data.user.role === 'canteen_owner' || data.user.role === 'canteen-owner') {
          // For canteen owners, fetch canteen ID first
          try {
            const canteenResponse = await fetch(`/api/system-settings/canteens/by-owner/${data.user.email}`);
            if (canteenResponse.ok) {
              const canteenData = await canteenResponse.json();
              setLocation(`/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
            } else {
              setLocation('/login?error=no_canteen');
            }
          } catch (error) {
            console.error('Error fetching canteen:', error);
            setLocation('/login?error=canteen_fetch_failed');
          }
        } else {
          setLocation("/app");
        }
      } else {
        // Register
        if (!trimmedIdentifier || !emailPasswordForm.password) {
          setEmailPasswordError("Please enter email/phone and password");
          setIsEmailPasswordLoading(false);
          return;
        }

        if (!isEmail && !isPhone) {
          setEmailPasswordError("Please enter a valid email or phone number");
          setIsEmailPasswordLoading(false);
          return;
        }

        if (!isLogin && !emailPasswordForm.name?.trim()) {
          setEmailPasswordError("Please enter your full name");
          setIsEmailPasswordLoading(false);
          return;
        }

        if (emailPasswordForm.password.length < 6) {
          setEmailPasswordError("Password must be at least 6 characters long");
          setIsEmailPasswordLoading(false);
          return;
        }

        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier: trimmedIdentifier,
            email: isEmail ? trimmedIdentifier : undefined,
            phoneNumber: isPhone ? phoneDigits : undefined,
            password: emailPasswordForm.password,
            name: emailPasswordForm.name?.trim(),
            // Name is optional in API but we'll pass it if provided
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setEmailPasswordError(data.error || 'Registration failed');
          setIsEmailPasswordLoading(false);
          return;
        }

        // Registration successful - log in directly with minimal data
        const userDisplayData = {
          id: data.user.id,
          name: emailPasswordForm.name?.trim() || data.user.name || (isEmail ? trimmedIdentifier.split('@')[0] : trimmedIdentifier),
          email: data.user.email,
          role: data.user.role || 'student',
          phoneNumber: data.user.phoneNumber || '',
          college: data.user.college || '',
        };
        login(userDisplayData as any);
        setIsEmailPasswordLoading(false);
        setTimeout(() => {
          setLocation("/app");
        }, 100);
      }
    } catch (error: any) {
      console.error("Email/password auth error:", error);
      setEmailPasswordError(error.message || 'An error occurred. Please try again.');
      setIsEmailPasswordLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    if (!qrTableData) {
      console.error('No QR table data available');
      return;
    }

    setIsGuestSignInLoading(true);
    try {
      console.log('🍽️ Creating guest session for QR code access:', qrTableData);

      const restaurantContext = {
        restaurantId: qrTableData.restaurantId,
        restaurantName: qrTableData.restaurantName,
        tableNumber: qrTableData.tableNumber
      };

      // Check for existing authenticated user first
      if (existingUser && !(existingUser as any).isTemporary) {
        console.log('🔍 Existing authenticated user detected:', existingUser);
        console.log('✅ Prioritizing existing user over temporary session');

        // Resolve the conflict using our utility
        const userData = existingUser as any;
        const updatedUserData = resolveUserSessionConflict({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
        }, restaurantContext);

        // Securely update user data and clean up temporary artifacts
        if (updatedUserData) {
          securelyUpdateUserData(updatedUserData, false);
        }

        // Remove pending QR data
        sessionStorage.removeItem('pendingQRTableData');

        // Redirect to home
        window.location.href = '/';
        return;
      }

      // Prepare request data with existing user information for conflict resolution
      const requestData = {
        restaurantId: restaurantContext.restaurantId,
        tableNumber: restaurantContext.tableNumber,
        restaurantName: restaurantContext.restaurantName,
        existingUserId: (existingUser as any)?.id,
        existingUserData: existingUser ? {
          id: (existingUser as any).id,
          name: (existingUser as any).name,
          email: (existingUser as any).email,
          role: (existingUser as any).role
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
        throw new Error(`Failed to create session: ${response.status} ${errorText}`);
      }

      const sessionData = await response.json();
      console.log('✅ Session created:', sessionData);

      // Check if server prioritized an existing user
      if (sessionData.existingUserPrioritized) {
        console.log('🔄 Server prioritized existing user:', sessionData.userData);
        // Securely update user data with the prioritized user data
        securelyUpdateUserData(sessionData.userData, false);
      } else {
        // Securely store temporary session data
        securelyUpdateUserData(sessionData.tempUser, true);
        console.log('💾 Temporary session data stored in localStorage');
      }

      // Remove pending QR data
      sessionStorage.removeItem('pendingQRTableData');

      console.log('🏠 Redirecting to home page...');
      // Redirect to home
      window.location.href = '/';

    } catch (error) {
      console.error('❌ Error creating guest session:', error);
      alert(`Failed to create guest session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsGuestSignInLoading(false);
    }
  };


  // Show blocked user screen
  if (blockedUser) {
    return (
      <BlockedUserScreen
        user={blockedUser}
        onRetryLogin={() => {
          setBlockedUser(null);
          // Allow user to try logging in again
        }}
      />
    );
  }

  // Show forgot email screen if requested
  if (showForgotEmail) {
    return (
      <ForgotEmailScreen
        onBackToLogin={() => setShowForgotEmail(false)}
      />
    );
  }

  // Show login issues screen if requested
  if (showLoginIssues) {
    return (
      <LoginIssuesScreen
        onBackToLogin={() => setShowLoginIssues(false)}
      />
    );
  }

  // Show profile setup screen if needed
  if (needsProfileSetup) {
    return (
      <ProfileSetupScreen
        userEmail={needsProfileSetup.email}
        userName={needsProfileSetup.name}
        onComplete={(userData) => {
          setNeedsProfileSetup(null);
          // User will be redirected by ProfileSetupScreen
        }}
        onBackToLogin={() => setNeedsProfileSetup(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[380px] space-y-4">
        {/* Logo Section - Compact */}
        <div className="text-center">
          <img src="/splash_logo.svg" alt="SilloBite Logo" className="w-48 h-48 object-contain mx-auto mb-0" />
          <div className="space-y-0.5 -mt-12">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {isLogin ? "Welcome to SilloBite" : "Join SilloBite"}
            </h1>
            <p className="text-muted-foreground text-xs">
              {isLogin ? "Log in to continue your food journey" : "Create your account to get started"}
            </p>
          </div>
        </div>

        {/* Main Login Card - Compact */}
        <Card className="bg-card shadow-2xl border border-border rounded-2xl overflow-hidden">
          <CardContent className="p-5 space-y-3">
            {/* Google Sign In - Primary Method */}
            <Button
              onClick={handleGoogleSignIn}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={isGoogleSignInLoading || isEmailPasswordLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {isGoogleSignInLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                "Continue with Google"
              )}
            </Button>

            {/* Show email/password form only if NOT from organization QR */}
            {!orgQRData && (
              <>
                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className={`px-3 ${resolvedTheme === 'dark' ? 'bg-card text-muted-foreground' : 'bg-background text-muted-foreground'}`}>Or continue with email</span>
                  </div>
                </div>

                {/* Email/Password Form - Compact */}
                <form onSubmit={handleEmailPasswordSubmit} className="space-y-3">
                  {/* Name field - Only shown for registration */}
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-medium text-foreground">Full Name</Label>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary w-4 h-4 transition-colors" />
                        <Input
                          id="name"
                          type="text"
                          placeholder="Enter your full name"
                          value={emailPasswordForm.name}
                          onChange={(e) => setEmailPasswordForm(prev => ({ ...prev, name: e.target.value }))}
                          className="pl-10 pr-4 h-11 bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg text-sm transition-all"
                          disabled={isEmailPasswordLoading || isGoogleSignInLoading || !!orgQRData}
                          required={!isLogin}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-foreground">
                      Email or mobile number
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary w-4 h-4 transition-colors" />
                      <Input
                        id="email"
                        type="text"
                        placeholder="you@example.com or 9876543210"
                        value={emailPasswordForm.identifier}
                        onChange={(e) => setEmailPasswordForm(prev => ({ ...prev, identifier: e.target.value }))}
                        className="pl-10 pr-4 h-11 bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg text-sm transition-all"
                        disabled={isEmailPasswordLoading || isGoogleSignInLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-medium text-foreground">Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-primary w-4 h-4 transition-colors" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={isLogin ? "Enter your password" : "Create a password (min. 6 characters)"}
                        value={emailPasswordForm.password}
                        onChange={(e) => setEmailPasswordForm(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 pr-10 h-11 bg-input border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg text-sm transition-all"
                        disabled={isEmailPasswordLoading || isGoogleSignInLoading || !!orgQRData}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none rounded p-1"
                        disabled={isEmailPasswordLoading || isGoogleSignInLoading || !!orgQRData}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {!isLogin && (
                      <p className="text-[10px] text-muted-foreground px-1">
                        Password must be at least 6 characters long
                      </p>
                    )}
                  </div>

                  {emailPasswordError && (
                    <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 p-3 rounded-lg flex items-start space-x-2">
                      <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <p>{emailPasswordError}</p>
                    </div>
                  )}

                  <div className="space-y-3 pt-1">
                    <Button
                      type="submit"
                      className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                      disabled={isEmailPasswordLoading || isGoogleSignInLoading || !!orgQRData}
                    >
                      {isEmailPasswordLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        isLogin ? "Log in" : "Create Account"
                      )}
                    </Button>

                    <div className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIsLogin(!isLogin);
                          setEmailPasswordError(null);
                          // Clear form when switching modes
                          setEmailPasswordForm({
                            identifier: "",
                            password: "",
                            name: "",
                          });
                        }}
                        className="text-xs text-muted-foreground hover:text-primary h-auto py-1 px-2"
                        disabled={isEmailPasswordLoading || isGoogleSignInLoading || !!orgQRData}
                      >
                        {isLogin ? (
                          <>
                            Don't have an account? <span className="text-primary font-semibold">Sign up</span>
                          </>
                        ) : (
                          <>
                            Already have an account? <span className="text-primary font-semibold">Log in</span>
                          </>
                        )}
                      </Button>
                      {!isLogin && (
                        <p className="text-[10px] text-muted-foreground text-center mt-1 px-2">
                          After registration, you'll complete your profile setup
                        </p>
                      )}
                    </div>
                  </div>
                </form>
              </>
            )}

            {/* Organization QR Info - Show when QR is scanned */}
            {orgQRData && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mt-3">
                <p className="text-xs text-foreground text-center">
                  📱 <strong className="text-primary">Organization QR Code Detected</strong>
                </p>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Please sign in with Google to continue
                </p>
              </div>
            )}

            {/* Guest Sign In - Only shown for QR code access */}
            {qrTableData && (
              <>
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className={`px-2 ${resolvedTheme === 'dark' ? 'bg-card text-muted-foreground' : 'bg-background text-muted-foreground'}`}>Or</span>
                  </div>
                </div>
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-foreground text-center">
                    📱 <strong className="text-primary">{qrTableData.restaurantName}</strong> - Table {qrTableData.tableNumber}
                  </p>
                </div>
                <Button
                  onClick={handleGuestSignIn}
                  variant="outline"
                  className="w-full h-11 border-2 border-primary text-primary hover:bg-primary hover:text-white font-medium rounded-xl transition-all duration-200"
                  disabled={isGoogleSignInLoading || isEmailPasswordLoading || isGuestSignInLoading}
                >
                  {isGuestSignInLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    "Continue as Guest"
                  )}
                </Button>
              </>
            )}

            {/* Development Mode Skip Login */}
            {import.meta.env.DEV && (
              <>
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className={`px-2 font-medium ${resolvedTheme === 'dark' ? 'bg-card text-muted-foreground' : 'bg-background text-muted-foreground'}`}>Development</span>
                  </div>
                </div>
                <Button
                  onClick={handleDevModeSkipLogin}
                  variant="outline"
                  className="w-full h-10 border border-border bg-input/50 text-muted-foreground hover:text-foreground hover:bg-input rounded-lg text-xs transition-all"
                  disabled={isGoogleSignInLoading || isEmailPasswordLoading || isLoading}
                  data-testid="button-skip-login-dev"
                >
                  🚀 Skip Login (Dev Mode)
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Help Links & Footer - Compact single row */}
        <div className="space-y-2">
          <div className="flex flex-wrap justify-center items-center gap-3 text-xs">
            <Button
              variant="ghost"
              onClick={() => setShowForgotEmail(true)}
              className="text-muted-foreground hover:text-primary h-auto px-2 py-1 text-xs"
            >
              Forgot email?
            </Button>
            <span className="text-muted-foreground/50">•</span>
            <Button
              variant="ghost"
              onClick={() => setShowLoginIssues(true)}
              className="text-muted-foreground hover:text-primary h-auto px-2 py-1 text-xs"
            >
              Login issues?
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center leading-tight">
            By continuing, you agree to our{" "}
            <span
              className="text-primary underline cursor-pointer hover:no-underline"
              onClick={() => {
                sessionStorage.setItem('termsPrivacyReferrer', '/login');
                setLocation("/terms-conditions");
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  sessionStorage.setItem('termsPrivacyReferrer', '/login');
                  setLocation("/terms-conditions");
                }
              }}
              role="button"
              tabIndex={0}
            >
              Terms
            </span>{" "}
            and{" "}
            <span
              className="text-primary underline cursor-pointer hover:no-underline"
              onClick={() => {
                sessionStorage.setItem('termsPrivacyReferrer', '/login');
                setLocation("/privacy-policy");
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  sessionStorage.setItem('termsPrivacyReferrer', '/login');
                  setLocation("/privacy-policy");
                }
              }}
              role="button"
              tabIndex={0}
            >
              Privacy Policy
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
