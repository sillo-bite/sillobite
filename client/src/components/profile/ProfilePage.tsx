import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthSync } from "@/hooks/useDataSync";
import { useAuth } from "@/hooks/useAuth";
import { signOutGoogle } from "@/lib/googleAuth";
import { CacheManager } from "@/utils/cacheManager";
import { clearPWAAuth } from "@/utils/pwaAuth";
import { useQuery } from "@tanstack/react-query";
import { isTempUser, getTempUserData } from "@/utils/tempUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Clock,
  LogOut,
  ChevronRight,
  User,
  Leaf,
  Palette,
  Star,
  Bookmark,
  Receipt,
  MessageCircle,
  HelpCircle,
  Settings,
  Info,
  Edit,
  Power,
  MapPin,
  Bell,
  Heart,
  FileText,
  Shield,
  Building2,
  GraduationCap,
  UtensilsCrossed,
  ShoppingCart,
  Trophy,
  Flame,
  CreditCard
} from "lucide-react";
import UserProfileDisplay from "./UserProfileDisplay";
import AppUpdateButton from "@/components/common/AppUpdateButton";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import { useTheme } from '@/contexts/ThemeContext';
import { useLocation as useLocationContext } from '@/contexts/LocationContext';
import AddressManagement from "./AddressManagement";
import LocationSelector from "./LocationSelector";
import ConnectionCodeCard from "./ConnectionCodeCard";
import WalletCard from "./WalletCard";

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { goToHome } = usePWANavigation();
  const { isAuthenticated, user } = useAuthSync();

  const { logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { selectedLocationType, selectedLocationName } = useLocationContext();
  const [showAddresses, setShowAddresses] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);

  // Check if this is a temporary user
  const isTemporary = isTempUser(user);
  const tempUserData = isTemporary ? getTempUserData() : null;

  // Enhanced security check for authenticated users or temporary users
  useEffect(() => {
    if (!isAuthenticated && !isTemporary) {
      setLocation("/login");
      return;
    }
  }, [isAuthenticated, isTemporary, setLocation]);
  const [userInfo, setUserInfo] = useState<any>(null);

  // User preferences state
  const [userPreferences, setUserPreferences] = useState({
    vegMode: true,
    appearance: 'light',
    notifications: true,
    language: 'English'
  });

  // Get user data from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserInfo(user);
    }
  }, []);

  // Fetch user's orders to calculate stats
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/orders'],
    enabled: !!userInfo?.email, // Only fetch when we have user email
  });

  // Calculate user statistics from orders - filter by current user
  const userOrders = (orders as any[]).filter((order: any) => {
    if (!userInfo) return false;
    const currentUserId = userInfo.id;
    return order.customerId === currentUserId ||
      order.customerName === userInfo?.name ||
      order.customerName?.toLowerCase().includes(userInfo?.name?.toLowerCase() || '');
  });

  const userStats = {
    totalOrders: userOrders.length,
    totalSpent: userOrders.reduce((total: number, order: any) => total + (order.amount || 0), 0),
  };

  // Get user preferences from localStorage
  useEffect(() => {
    const savedPreferences = localStorage.getItem('userPreferences');
    if (savedPreferences) {
      setUserPreferences(JSON.parse(savedPreferences));
    }
  }, []);

  // Listen for changes in localStorage to sync with other pages
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userPreferences' && e.newValue) {
        try {
          setUserPreferences(JSON.parse(e.newValue));
        } catch (error) {
          console.error('Error parsing user preferences from storage:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save preferences to localStorage when they change
  const updatePreferences = (newPreferences: any) => {
    setUserPreferences(newPreferences);
    localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
  };


  const handleLogout = async () => {
    console.log("🚀 Profile page logout initiated...");
    await logout();
  };

  // Navigation handlers for profile features
  const handleOrderHelp = () => {
    // Store that we're navigating from Profile so we can go back correctly
    sessionStorage.setItem('navigationFrom', 'profile');
    window.dispatchEvent(new CustomEvent('appEnsureProfileInHistory', {}));
    setLocation("/help-support");
  };


  const handleAbout = () => {
    // Store that we're navigating from Profile so we can go back correctly
    sessionStorage.setItem('navigationFrom', 'profile');
    window.dispatchEvent(new CustomEvent('appEnsureProfileInHistory', {}));
    setLocation("/about");
  };

  const handleSendFeedback = () => {
    // Store that we're navigating from Profile so we can go back correctly
    sessionStorage.setItem('navigationFrom', 'profile');
    window.dispatchEvent(new CustomEvent('appEnsureProfileInHistory', {}));
    setLocation("/feedback");
  };

  const handleTermsConditions = () => {
    // Store that we're navigating from Profile so we can go back correctly
    sessionStorage.setItem('navigationFrom', 'profile');
    sessionStorage.setItem('termsPrivacyReferrer', '/app');
    window.dispatchEvent(new CustomEvent('appEnsureProfileInHistory', {}));
    setLocation("/terms-conditions");
  };

  const handlePrivacyPolicy = () => {
    // Store that we're navigating from Profile so we can go back correctly
    sessionStorage.setItem('navigationFrom', 'profile');
    sessionStorage.setItem('termsPrivacyReferrer', '/app');
    window.dispatchEvent(new CustomEvent('appEnsureProfileInHistory', {}));
    setLocation("/privacy-policy");
  };

  const handleNotifications = () => {
    // Store that we're navigating from Profile so we can go back correctly
    sessionStorage.setItem('navigationFrom', 'profile');
    // Also ensure Profile is in navigation history before leaving
    // This ensures we can properly navigate back
    window.dispatchEvent(new CustomEvent('appEnsureProfileInHistory', {}));
    setLocation("/notifications");
  };


  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    let completed = 0;
    let total = 4;

    if (userInfo?.name) completed++;
    if (userInfo?.email) completed++;
    if (userInfo?.phoneNumber) completed++;
    if (userInfo?.college) completed++;

    return Math.round((completed / total) * 100);
  };

  const profileCompletion = calculateProfileCompletion();

  // Show address management if requested
  if (showAddresses && userInfo?.id) {
    return (
      <AddressManagement
        userId={userInfo.id}
        onBack={() => setShowAddresses(false)}
      />
    );
  }

  return (
    <>
      {showLocationSelector && <LocationSelector onClose={() => setShowLocationSelector(false)} />}
      <div className={`min-h-screen overflow-x-hidden ${'bg-background'
        }`}>
        {/* Header */}
        <div className="relative bg-[#724491] px-4 pt-12 pb-6 rounded-b-2xl">
          {/* Subtle Pattern Overlay */}
          {/* Header Navigation */}
          <div className="relative z-10 flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 transition-all duration-200 rounded-full"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('appNavigateToSelector', {}));
              }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-white tracking-tight">My Profile</h1>
            {!isTemporary && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 transition-all duration-200 rounded-full"
                onClick={() => {
                  sessionStorage.setItem('navigationFrom', 'profile');
                  window.dispatchEvent(new CustomEvent('appEnsureProfileInHistory', {}));
                  setLocation("/profile/edit");
                }}
              >
                <Edit className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Profile Card */}
          <div className="relative bg-[#724491] rounded-3xl p-6 border border-[#B37ED7] overflow-hidden">

            <div className="relative z-10 flex items-center">
              <div className="relative">
                <Avatar className="w-16 h-16 border-2 border-gray-300">
                  <AvatarFallback className="bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white text-xl font-bold shadow-xl ring-1 ring-white/15 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:via-transparent before:to-transparent before:rounded-full">
                    {userInfo?.name ? userInfo.name.split(' ').map((n: string) => n[0]).join('') : 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 ml-4">
                <h2 className="text-xl font-bold text-white mb-1 tracking-tight">
                  {isTemporary ? `Guest at Table ${tempUserData?.tableNumber}` : (userInfo?.name || "User")}
                </h2>
                <p className="text-white/90 text-sm mb-2">
                  {isTemporary ? tempUserData?.restaurantName : (userInfo?.email || "Email not provided")}
                </p>

                {isTemporary && (
                  <div className="flex items-center space-x-2 text-white/80 text-xs mb-2">
                    <div className="flex items-center">
                      <MapPin className="w-3 h-3 mr-1" />
                      <span>Table {tempUserData?.tableNumber}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      <span>Session started {new Date(tempUserData?.createdAt || '').toLocaleTimeString()}</span>
                    </div>
                  </div>
                )}

                {/* Profile Stats - only show for regular users */}
                {!isTemporary && (
                  <div className="flex items-center space-x-4 text-white/80 text-xs">
                    <div className="flex items-center">
                      <Bookmark className="w-3 h-3 mr-1" />
                      <span>
                        {ordersLoading ? '...' : (userStats?.totalOrders || 0)} orders
                      </span>
                    </div>
                  </div>
                )}

                {!isTemporary && (
                  <button
                    className="text-white/90 text-sm mt-2 flex items-center hover:text-white transition-colors group"
                    onClick={() => {
                      sessionStorage.setItem('navigationFrom', 'profile');
                      window.dispatchEvent(new CustomEvent('appEnsureProfileInHistory', {}));
                      setLocation("/reviews");
                    }}
                  >
                    My Reviews
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

        <div className="px-4 py-6 space-y-6 overflow-x-hidden">
          {/* Account & Orders */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Account & Orders</h3>

            <Card className={`${resolvedTheme === 'dark'
              ? 'bg-card border border-gray-800 shadow-sm'
              : 'bg-white border border-gray-200 shadow-sm'
              }`}>
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                  onClick={() => setShowLocationSelector(true)}
                >
                  <div className="flex items-center flex-1">
                    {selectedLocationType === 'college' && <GraduationCap className="w-5 h-5 text-muted-foreground mr-3" />}
                    {selectedLocationType === 'organization' && <Building2 className="w-5 h-5 text-muted-foreground mr-3" />}
                    {selectedLocationType === 'restaurant' && <UtensilsCrossed className="w-5 h-5 text-muted-foreground mr-3" />}
                    {!selectedLocationType && <MapPin className="w-5 h-5 text-muted-foreground mr-3" />}
                    <div className="flex-1 text-left">
                      <span className={`block ${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                        }`}>
                        Current Location
                      </span>
                      {selectedLocationName ? (
                        <span className="text-sm text-muted-foreground block">
                          {selectedLocationName}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground block">
                          Tap to select location
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                <button
                  className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                  onClick={() => {
                    // Dispatch custom event to switch to orders view in AppPage
                    window.dispatchEvent(new CustomEvent('appNavigateToOrders', {}));
                    setLocation("/app");
                  }}
                >
                  <div className="flex items-center">
                    <Receipt className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>My Orders</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                <button
                  className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('appNavigateToMyPayments', {}));
                    setLocation("/app");
                  }}
                >
                  <div className="flex items-center">
                    <CreditCard className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>My Payments</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>



                <button
                  className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                  onClick={() => {
                    // Dispatch custom event to switch to favorites view in AppPage
                    window.dispatchEvent(new CustomEvent('appNavigateToFavorites', {}));
                    setLocation("/app");
                  }}
                >
                  <div className="flex items-center">
                    <Heart className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>My Favorites</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                <button
                  className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('appNavigateToChallenges', {}));
                    setLocation("/app");
                  }}
                >
                  <div className="flex items-center">
                    <Trophy className="w-5 h-5 text-yellow-500 mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>Coding Challenges</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-semibold text-foreground">7</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium text-foreground">1,250</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </button>

                <button
                  className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                  onClick={handleNotifications}
                >
                  <div className="flex items-center">
                    <Bell className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>Notifications</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                {!isTemporary && (
                  <button
                    className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                    onClick={() => setShowAddresses(true)}
                  >
                    <div className="flex items-center">
                      <MapPin className="w-5 h-5 text-muted-foreground mr-3" />
                      <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                        }`}>Addresses</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                )}

                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-accent transition-colors"
                  onClick={handleOrderHelp}
                >
                  <div className="flex items-center">
                    <MessageCircle className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>Help & Support</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Connection Code - only for authenticated users */}
          {!isTemporary && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">External Apps</h3>
              <ConnectionCodeCard />
            </div>
          )}

          {/* Wallet - only for authenticated users */}
          {!isTemporary && userInfo?.id && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Wallet</h3>
              <WalletCard userId={userInfo.id} />
            </div>
          )}

          {/* Preferences */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Preferences</h3>

            <Card className={`${resolvedTheme === 'dark'
              ? 'bg-card border border-gray-800 shadow-sm'
              : 'bg-white border border-gray-200 shadow-sm'
              }`}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center">
                    <Leaf className="w-5 h-5 text-green-600 mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>Veg Mode</span>
                  </div>
                  <Switch
                    variant="green"
                    checked={userPreferences.vegMode}
                    onCheckedChange={(checked) => updatePreferences({ ...userPreferences, vegMode: checked })}
                  />
                </div>

                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-accent transition-colors"
                  onClick={() => {
                    // Cycle through themes: light -> dark -> system -> light
                    const themes = ['light', 'dark', 'system'];
                    const currentIndex = themes.indexOf(theme);
                    const nextIndex = (currentIndex + 1) % themes.length;
                    setTheme(themes[nextIndex] as 'light' | 'dark' | 'system');
                  }}
                >
                  <div className="flex items-center">
                    <Palette className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>Theme</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-muted-foreground text-sm mr-2">
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Help & Support */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Help & Support</h3>

            <Card className={`${resolvedTheme === 'dark'
              ? 'bg-card border border-gray-800 shadow-sm'
              : 'bg-white border border-gray-200 shadow-sm'
              }`}>
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                  onClick={handleAbout}
                >
                  <div className="flex items-center">
                    <Info className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>About Us</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                <button
                  className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                  onClick={handleTermsConditions}
                >
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>Terms & Conditions</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                <button
                  className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-accent transition-colors"
                  onClick={handlePrivacyPolicy}
                >
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>Privacy Policy</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-accent transition-colors"
                  onClick={handleSendFeedback}
                >
                  <div className="flex items-center">
                    <Edit className="w-5 h-5 text-muted-foreground mr-3" />
                    <span className={`${resolvedTheme === 'dark' ? 'text-card-foreground' : 'text-gray-800'
                      }`}>Feedback</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Account Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Account</h3>

            <Card className={`${resolvedTheme === 'dark'
              ? 'bg-card border border-gray-800 shadow-sm'
              : 'bg-white border border-gray-200 shadow-sm'
              }`}>
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-accent transition-colors"
                  onClick={handleLogout}
                >
                  <div className="flex items-center">
                    <Power className="w-5 h-5 text-red-600 mr-3" />
                    <span className="text-red-600">Log out</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          </div>

          {/* App Update Button */}
          <AppUpdateButton />
        </div>
      </div>
    </>
  );
}