import React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserRole } from "@shared/schema";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Router, Route, Switch, useRoute, useLocation } from "wouter";
import { CartProvider } from "@/contexts/CartContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { CanteenProvider } from "@/contexts/CanteenContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useDeploymentDetection } from "@/utils/deploymentHook";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useBrowserBackNavigationWithHistory } from "@/hooks/useBrowserBackNavigation";
import SplashScreen from "./components/layout/SplashScreen";
import PartnerLandingPage from "./components/marketing/partner-landing/PartnerLandingPage";
import OnboardingScreen from "./components/layout/OnboardingScreen";
import LoginScreen from "./components/auth/LoginScreen";
import HomeScreen from "./components/pages/HomeScreen";
import AppPage from "./components/pages/AppPage";
import MenuListingPage from "./components/menu/MenuListingPage";
import DishDetailPage from "./components/menu/DishDetailPage";
import CheckoutPage from "./components/pages/CheckoutPage";
import RetryPaymentPage from "./components/payment/RetryPaymentPage";
import OrderStatusPage from "./components/orders/OrderStatusPage";
import OrdersPage from "./components/orders/OrdersPage";
import ProfilePage from "./components/profile/ProfilePage";
import AdminPanel from "./components/admin/AdminPanel";
import NotificationsPage from "./components/pages/NotificationsPage";
import PaymentMethodsPage from "./components/payment/PaymentMethodsPage";
import SearchPage from "./components/pages/SearchPage";
import PrivacyPolicyPage from "./components/pages/PrivacyPolicyPage";
import TermsConditionsPage from "./components/pages/TermsConditionsPage";
import TestPage from "./components/pages/TestPage";
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminLayout from "./components/admin/AdminLayout";
import EditAdminAccessPage from "./components/admin/EditAdminAccessPage";
import AddNewAdminPage from "./components/admin/AddNewAdminPage";
import AdminAnalyticsPage from "./components/admin/AdminAnalyticsPage";
import AdminReportsPage from "./components/admin/AdminReportsPage";
import AdminUserManagementPage from "./components/admin/AdminUserManagementPage";
import AdminOrganizationManagementPage from "./components/admin/AdminOrganizationManagementPage";
import OrganizationAdminPanel from "./components/admin/OrganizationAdminPanel";
import AdminCollegeManagementPage from "./components/admin/AdminCollegeManagementPage";
import AdminSystemSettingsPage from "./components/admin/AdminSystemSettingsPage";
import CollegeAdminDashboard from "./components/college-admin/CollegeAdminDashboard";
import StudentsPage from "./components/college-admin/StudentsPage";
import StaffPage from "./components/college-admin/StaffPage";
import CollegeUsersPage from "./components/college-admin/CollegeUsersPage";
import CollegeReportsPage from "./components/college-admin/CollegeReportsPage";
import CollegeSettingsPage from "./components/college-admin/CollegeSettingsPage";
import CollegeCanteensPage from "./components/college-admin/CollegeCanteensPage";
import CollegeCanteenMonitor from "./components/college-admin/CollegeCanteenMonitor";
import CanteenManagementPage from "./components/canteen/CanteenManagementPage";
import CanteenAdminWrapper from "./components/canteen/CanteenAdminWrapper";
import CounterInterfaceWrapper from "./components/canteen/CounterInterfaceWrapper";

import AdminPaymentManagementPage from "./components/admin/AdminPaymentManagementPage";
import AdminNotificationManagementPage from "./components/admin/AdminNotificationManagementPage";
import AdminContentManagementPage from "./components/admin/AdminContentManagementPage";
import AdminCouponManagement from "./components/admin/AdminCouponManagement";
import AdminChallengeManagementPage from "./components/admin/AdminChallengeManagementPage";
import AdminFeedbackManagementPage from "./components/admin/AdminFeedbackManagementPage";
import AdminReviewManagementPage from "./components/admin/AdminReviewManagementPage";
import AdminAccessPage from "./components/admin/AdminAccessPage";
import AdminDatabasePage from "./components/admin/AdminDatabasePage";
import AdminLoginIssues from "./pages/AdminLoginIssues";
import RestaurantManagementPage from "./components/admin/RestaurantManagementPage";
import PayoutRequestManagementPage from "./components/admin/PayoutRequestManagementPage";
import CanteenOwnerDashboard from "./components/canteen/CanteenOwnerDashboard";
import CanteenOwnerCounterSelectionWrapper from "./components/canteen/CanteenOwnerCounterSelectionWrapper";
import ViewAllQuickPicksPage from "./components/menu/ViewAllQuickPicksPage";
import HelpSupportPage from "./components/pages/HelpSupportPage";
import AboutPage from "./components/pages/AboutPage";
import FavoritesPage from "./components/pages/FavoritesPage";
import FeedbackPage from "./components/pages/FeedbackPage";

import SendEmailPage from "./components/user-management/SendEmailPage";
import AddLoyaltyPointsPage from "./components/user-management/AddLoyaltyPointsPage";
import ApplyDiscountPage from "./components/user-management/ApplyDiscountPage";
import SendWarningPage from "./components/user-management/SendWarningPage";
import ExportUserDataPage from "./components/user-management/ExportUserDataPage";
import ImportUsersPage from "./components/user-management/ImportUsersPage";
import RateReviewPage from "./components/profile/RateReviewPage";
import OrderDetailPage from "./components/orders/OrderDetailPage";
import CanteenOrderDetailPage from "./components/canteen/CanteenOrderDetailPage";
import BarcodeScannerPage from "./components/canteen/BarcodeScannerPage";
import PaymentCallbackPage from "./components/payment/PaymentCallbackPage";
import TableAccessPage from "./components/canteen/TableAccessPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DeliveryPersonPortal from "./components/delivery/DeliveryPersonPortal";
import MaintenanceWrapper from "./components/layout/MaintenanceWrapper";
import { InstallPWA } from "./components/common/InstallPWA";
import OAuthCallback from "./components/auth/OAuthCallback";
import ProfileSetupScreen from "./components/auth/ProfileSetupScreen";
import ProfileEditPage from "./components/profile/ProfileEditPage";
import UserReviewsPage from "./components/profile/UserReviewsPage";
import SEOHead from "./components/common/SEOHead";
import PerformanceOptimizer from "./components/common/PerformanceOptimizer";
import { initAnalytics } from "./utils/analytics";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";






const App = () => {
  // Enable deployment detection for cache invalidation
  useDeploymentDetection();

  // Enable activity tracking for mobile PWA session persistence
  useActivityTracker();

  // Enable browser back navigation handling for PWA
  useBrowserBackNavigationWithHistory();

  // PWA installation detection and marking - mark as installed when launched in standalone mode
  React.useEffect(() => {
    const checkAndMarkInstallation = async () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

      if (isStandalone) {
        // Import and mark PWA as installed when launched in standalone mode
        const { markPWAAsInstalled } = await import('@/utils/pwaInstallTracker');
        markPWAAsInstalled();
      }
    };

    // Check immediately
    checkAndMarkInstallation();

    // Also check on visibility change (when app comes to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndMarkInstallation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // PWA installation URL normalization - ensure consistent entry point
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isPWALaunch = urlParams.get('pwa') === 'true' ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Exclude callback URLs, order status pages, and splashscreen itself
    const excludedPaths = [
      '/splashscreen',
      '/api/auth/google/callback',
      '/payment-callback',
      '/retry-payment',
      '/order-status'
    ];
    const isExcludedPath = excludedPaths.some(path =>
      window.location.pathname === path || window.location.pathname.startsWith(path + '/')
    );

    // For installed PWAs, only normalize root entry to splashscreen.
    // Allow deep links (payment callback/order status) to load directly to avoid redirect loops.
    if (isPWALaunch && !isExcludedPath && window.location.pathname === '/') {
      console.log('🚀 PWA launch detected at root - redirecting to splashscreen');
      window.history.replaceState({}, '', '/splashscreen?pwa=true');
    }
  }, []);

  // Initialize analytics and SEO tracking
  React.useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <LocationProvider>
            <CartProvider>
              <CanteenProvider>
                <FavoritesProvider>
                  <NotificationProvider>
                    <SEOHead />
                    <PerformanceOptimizer />
                    <InstallPWA />
                    <Router>
                      <Switch>
                        <Route path="/" component={PartnerLandingPage} />
                        <Route path="/splashscreen" component={SplashScreen} />
                        <Route path="/onboarding" component={OnboardingScreen} />
                        <Route path="/login" component={LoginScreen} />
                        <Route path="/auth/callback" component={OAuthCallback} />
                        <Route path="/api/auth/google/callback" component={OAuthCallback} />
                        <Route path="/profile-setup" component={ProfileSetupScreen} />
                        <Route path="/profile/edit">
                          <MaintenanceWrapper>
                            <ProtectedRoute requireAuth={true}>
                              <ProfileEditPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/app">
                          <MaintenanceWrapper>
                            <ProtectedRoute requireAuth={true}>
                              <AppPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/dish/:dishId">
                          <MaintenanceWrapper>
                            <ProtectedRoute requireAuth={true}>
                              <DishDetailPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/checkout">
                          <MaintenanceWrapper>
                            <ProtectedRoute requireAuth={true}>
                              <CheckoutPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/payment-callback" component={PaymentCallbackPage} />
                        <Route path="/retry-payment" component={RetryPaymentPage} />
                        <Route path="/order-status/:orderId" component={OrderStatusPage} />
                        <Route path="/order-detail/:orderId">
                          <MaintenanceWrapper>
                            <ProtectedRoute requireAuth={true}>
                              <OrderDetailPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/canteen-order-detail/:orderId">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRole={UserRole.CANTEEN_OWNER}>
                              <CanteenOrderDetailPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/reviews">
                          <MaintenanceWrapper>
                            <ProtectedRoute requireAuth={true}>
                              <UserReviewsPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/notifications">
                          <ProtectedRoute requireAuth={true}>
                            <NotificationsPage />
                          </ProtectedRoute>
                        </Route>
                        <Route path="/payment-methods">
                          <ProtectedRoute requireAuth={true}>
                            <PaymentMethodsPage />
                          </ProtectedRoute>
                        </Route>
                        <Route path="/search">
                          <MaintenanceWrapper>
                            <ProtectedRoute requireAuth={true}>
                              <SearchPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/privacy-policy" component={PrivacyPolicyPage} />
                        <Route path="/terms-conditions" component={TermsConditionsPage} />
                        <Route path="/table/:restaurantId/:tableNumber/:hash" component={TableAccessPage} />
                        <Route path="/canteen-owner">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRole="canteen_owner">
                              <CanteenOwnerDashboard />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/canteen-owner-dashboard/:canteenId">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRole="canteen_owner">
                              <CanteenOwnerDashboard />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/canteen-owner-dashboard/:canteenId/counters">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRole="canteen_owner">
                              <CanteenOwnerCounterSelectionWrapper />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/canteen-owner-dashboard/:canteenId/counter/:counterId">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRole="canteen_owner">
                              <CounterInterfaceWrapper />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminDashboard />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/college-admin">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <CollegeAdminDashboard />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/college-admin/students">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <StudentsPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/college-admin/staff">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <StaffPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/college-admin/users">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <CollegeUsersPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/college-admin/canteens">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <CollegeCanteensPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/college-admin/canteen/:id/monitor">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <CollegeCanteenMonitor />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/college-admin/reports">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <CollegeReportsPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/college-admin/settings">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <CollegeSettingsPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/edit-admin-access/:userId">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <AdminLayout><EditAdminAccessPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/add-new-admin">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AddNewAdminPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/analytics">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminAnalyticsPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/reports">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminReportsPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/user-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminUserManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/organization-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminOrganizationManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/organization/:organizationId">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><OrganizationAdminPanel /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/college-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminCollegeManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/system-settings">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminSystemSettingsPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/canteen-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><CanteenManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/restaurant-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><RestaurantManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/payment-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminPaymentManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/notification-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminNotificationManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/content-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminContentManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/coupon-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminCouponManagement /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/challenge-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminChallengeManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/feedback-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminFeedbackManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/review-management">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminReviewManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/admin-access">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminAccessPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/database">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminDatabasePage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/login-issues">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AdminLoginIssues /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/payout-requests">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.SUPER_ADMIN]}>
                              <AdminLayout><PayoutRequestManagementPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>

                        {/* Canteen Admin Routes */}
                        <Route path="/admin/canteen/:canteenId/:page?">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <CanteenAdminWrapper />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/canteen/:canteenId/counter/:counterId">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <CounterInterfaceWrapper />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/quick-picks">
                          <MaintenanceWrapper>
                            <ProtectedRoute requireAuth={true}>
                              <ViewAllQuickPicksPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/help-support" component={HelpSupportPage} />
                        <Route path="/about" component={AboutPage} />
                        <Route path="/feedback">
                          <MaintenanceWrapper>
                            <ProtectedRoute requireAuth={true}>
                              <FeedbackPage />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>

                        <Route path="/admin/user-management/send-email">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <AdminLayout><SendEmailPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/user-management/add-loyalty-points">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <AdminLayout><AddLoyaltyPointsPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/user-management/apply-discount">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <AdminLayout><ApplyDiscountPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/user-management/send-warning">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <AdminLayout><SendWarningPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/user-management/export-data">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <AdminLayout><ExportUserDataPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/admin/user-management/import-users">
                          <MaintenanceWrapper allowAdminAccess={true}>
                            <ProtectedRoute requiredRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                              <AdminLayout><ImportUsersPage /></AdminLayout>
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/rate-review">
                          <ProtectedRoute requireAuth={true}>
                            <RateReviewPage />
                          </ProtectedRoute>
                        </Route>
                        <Route path="/barcode-scanner">
                          <ProtectedRoute requireAuth={true}>
                            <BarcodeScannerPage />
                          </ProtectedRoute>
                        </Route>
                        <Route path="/delivery-portal">
                          <MaintenanceWrapper>
                            <ProtectedRoute requiredRole={UserRole.DELIVERY_PERSON}>
                              <DeliveryPersonPortal />
                            </ProtectedRoute>
                          </MaintenanceWrapper>
                        </Route>
                        <Route path="/index" component={Index} />
                        <Route path="/test" component={TestPage} />
                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        <Route component={NotFound} />
                      </Switch>
                    </Router>
                  </NotificationProvider>
                </FavoritesProvider>
              </CanteenProvider>
            </CartProvider>
          </LocationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
