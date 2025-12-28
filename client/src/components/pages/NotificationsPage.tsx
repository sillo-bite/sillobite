import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, Smartphone, Clock, BellOff, Loader2, TestTube, AlertCircle, Settings, Info } from "lucide-react";
import { useWebPushNotifications } from "@/hooks/useWebPushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { showLocalTestNotification } from "@/utils/webPushNotifications";
import { useTheme } from "@/contexts/ThemeContext";
export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    promotions: false,
    soundEnabled: true,
    vibration: true
  });

  // Web Push Notifications hook
  const {
    isInitialized,
    isSubscribed,
    subscriptionId,
    permission,
    isLoading,
    error,
    requestPermission,
    unsubscribe,
    sendTestNotification,
    canSubscribe,
    canUnsubscribe,
    supportsNotifications,
  } = useWebPushNotifications(user?.id?.toString(), user?.role);

  const updateNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Handle local test notification for Android troubleshooting
  const handleLocalTestNotification = async () => {
    try {
      const success = await showLocalTestNotification();
      if (success) {
        }
    } catch (error: any) {
      }
  };

  // Handle Android diagnostic check
  const handleAndroidDiagnostic = () => {
    const isAndroid = /android/i.test(navigator.userAgent);
    const isChrome = /chrome/i.test(navigator.userAgent);
    const isFirefox = /firefox/i.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    
    let diagnosticMessage = "Android Notification Diagnostic:\n\n";
    diagnosticMessage += `Device: ${isAndroid ? '✓ Android' : '✗ Not Android'}\n`;
    diagnosticMessage += `Browser: ${isChrome ? '✓ Chrome' : isFirefox ? '✓ Firefox' : '? Other browser'}\n`;
    diagnosticMessage += `PWA Mode: ${isPWA ? '✓ Installed as PWA' : '✗ Browser mode'}\n`;
    diagnosticMessage += `Permission: ${permission}\n\n`;
    
    if (isAndroid && !isPWA) {
      diagnosticMessage += "SOLUTION: Install as PWA for banner notifications!\n";
      diagnosticMessage += "1. Open browser menu (3 dots)\n";
      diagnosticMessage += "2. Select 'Add to Home Screen'\n";
      diagnosticMessage += "3. Open the app from your home screen\n";
      diagnosticMessage += "4. Test notifications again\n\n";
    }
    
    if (isAndroid) {
      diagnosticMessage += "Additional Android Settings:\n";
      diagnosticMessage += "• Settings > Apps > [This App] > Notifications\n";
      diagnosticMessage += "• Enable 'Show as pop-up' or 'Alert style'\n";
      diagnosticMessage += "• Set importance to 'High'\n";
      diagnosticMessage += "• Disable 'Do Not Disturb' or add exception\n";
    }
    
    console.log(diagnosticMessage);
  };

  // Handle PWA install prompt
  const handleInstallPWA = () => {
    // Check if PWA install prompt is available
    if ('beforeinstallprompt' in window) {
      } else {
      }
  };

  const getStatusBadge = () => {
    if (!isInitialized) return <Badge variant="secondary">Initializing...</Badge>;
    if (isSubscribed) return <Badge variant="default">Active</Badge>;
    if (permission === 'denied') return <Badge variant="destructive">Blocked</Badge>;
    return <Badge variant="outline">Inactive</Badge>;
  };

  const getStatusText = () => {
    if (error) return `Error: ${error}`;
    if (!isInitialized) return 'Initializing Web Push notifications...';
    if (isSubscribed && subscriptionId) return `Subscribed (ID: ${subscriptionId.slice(0, 8)}...)`;
    if (permission === 'denied') return 'Notifications blocked by device settings';
    return 'Not subscribed to notifications';
  };

  return (
    <div className={`min-h-screen ${
      'bg-background'
    }`}>
      {/* Header */}
      <div className="bg-purple-600 px-4 pt-12 pb-6 rounded-b-2xl shadow-lg">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20 transition-all duration-200 rounded-full" 
            onClick={() => {
              // Check if we came from Profile
              const fromProfile = sessionStorage.getItem('navigationFrom') === 'profile';
              
              if (fromProfile) {
                // Keep the flag so AppPage knows we're coming back from Notifications
                // Navigate back to Profile view
                // Make sure to set location first, then dispatch event so AppPage is mounted
                setLocation("/app");
                // Use setTimeout to ensure AppPage is mounted before dispatching event
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToProfile', {}));
                }, 0);
              } else {
                // Use history-based back navigation
                setLocation("/app");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
                }, 0);
              }
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Notification Preferences */}
        <div className="space-y-4">
          <h2 className={`text-lg font-semibold ${
            resolvedTheme === 'dark' ? 'text-purple-500' : 'text-purple-600'
          }`}>Notification Preferences</h2>
          
          <Card className={`${
            resolvedTheme === 'dark' 
              ? 'bg-black border-gray-800' 
              : 'bg-white border-gray-200'
          } shadow-lg`}>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${
                      resolvedTheme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-100'
                    } rounded-lg flex items-center justify-center`}>
                      <Bell className={`w-5 h-5 ${
                        resolvedTheme === 'dark' ? 'text-purple-500' : 'text-purple-600'
                      }`} />
                    </div>
                    <div>
                      <p className={`font-medium ${
                        resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                      }`}>Order Updates</p>
                      <p className={`text-sm ${
                        resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>Get notified about your order status</p>
                    </div>
                  </div>
                  <Switch 
                    variant="purple"
                    checked={notifications.orderUpdates}
                    onCheckedChange={() => updateNotification('orderUpdates')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${
                      resolvedTheme === 'dark' ? 'bg-orange-500/10' : 'bg-orange-100'
                    } rounded-lg flex items-center justify-center`}>
                      <Clock className={`w-5 h-5 ${
                        resolvedTheme === 'dark' ? 'text-orange-500' : 'text-orange-600'
                      }`} />
                    </div>
                    <div>
                      <p className={`font-medium ${
                        resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                      }`}>Promotions & Offers</p>
                      <p className={`text-sm ${
                        resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>Special deals and discounts</p>
                    </div>
                  </div>
                  <Switch 
                    variant="purple"
                    checked={notifications.promotions}
                    onCheckedChange={() => updateNotification('promotions')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Push Notifications */}
        <div className="space-y-4">
          <h2 className={`text-lg font-semibold ${
            resolvedTheme === 'dark' ? 'text-purple-500' : 'text-purple-600'
          }`}>Push Notifications</h2>
          
          <Card className={`${
            resolvedTheme === 'dark' 
              ? 'bg-black border-gray-800' 
              : 'bg-white border-gray-200'
          } shadow-lg`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 ${
                    resolvedTheme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-100'
                  } rounded-lg flex items-center justify-center`}>
                    {isSubscribed ? (
                      <Bell className={`w-5 h-5 ${
                        resolvedTheme === 'dark' ? 'text-purple-500' : 'text-purple-600'
                      }`} />
                    ) : (
                      <BellOff className={`w-5 h-5 ${
                        resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                    )}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${
                      resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                    }`}>Push Notifications</h3>
                    <p className={`text-sm ${
                      resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {getStatusText()}
                    </p>
                  </div>
                </div>
                {getStatusBadge()}
              </div>

            {!supportsNotifications ? (
              <div className={`flex items-center space-x-3 p-3 ${
                resolvedTheme === 'dark' 
                  ? 'bg-purple-900/20 border-purple-800' 
                  : 'bg-purple-50 border-purple-200'
              } rounded-lg`}>
                <AlertCircle className={`w-5 h-5 ${
                  resolvedTheme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                } flex-shrink-0`} />
                <div>
                  <p className={`font-semibold ${
                    resolvedTheme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  }`}>Not Supported</p>
                  <p className={`text-sm ${
                    resolvedTheme === 'dark' ? 'text-purple-300' : 'text-purple-500'
                  }`}>
                    Your browser doesn't support push notifications
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {canSubscribe && (
                    <Button
                      onClick={requestPermission}
                      disabled={isLoading}
                      size="sm"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Bell className="w-4 h-4 mr-2" />
                      )}
                      Enable Notifications
                    </Button>
                  )}

                  {canUnsubscribe && (
                    <Button
                      onClick={unsubscribe}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <BellOff className="w-4 h-4 mr-2" />
                      )}
                      Disable Notifications
                    </Button>
                  )}

                  {isSubscribed && subscriptionId && (
                    <Button
                      onClick={sendTestNotification}
                      variant="ghost"
                      size="sm"
                    >
                      <TestTube className="w-4 h-4 mr-2" />
                      Send Test
                    </Button>
                  )}
                </div>

                {permission === 'denied' && (
                  <div className={`p-3 ${
                    resolvedTheme === 'dark' 
                      ? 'bg-purple-900/20 border-purple-800' 
                      : 'bg-purple-50 border-purple-200'
                  } rounded-lg mb-4`}>
                    <p className={`text-sm ${
                      resolvedTheme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                    }`}>
                      Notifications are blocked. Please enable them in your device settings or browser.
                    </p>
                  </div>
                )}

                {error && (
                  <div className={`p-3 ${
                    resolvedTheme === 'dark' 
                      ? 'bg-purple-900/20 border-purple-800' 
                      : 'bg-purple-50 border-purple-200'
                  } rounded-lg mb-4`}>
                    <p className={`text-sm ${
                      resolvedTheme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                    }`}>
                      {error}
                    </p>
                  </div>
                )}

                <div className={`text-xs ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Powered by Web Push API with VAPID keys
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </div>


        {/* App Settings */}
        <div className="space-y-4">
          <h2 className={`text-lg font-semibold ${
            resolvedTheme === 'dark' ? 'text-purple-500' : 'text-purple-600'
          }`}>App Settings</h2>
          
          <Card className={`${
            resolvedTheme === 'dark' 
              ? 'bg-black border-gray-800' 
              : 'bg-white border-gray-200'
          } shadow-lg`}>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${
                      resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                    }`}>Sound</p>
                    <p className={`text-sm ${
                      resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>Play sound for notifications</p>
                  </div>
                  <Switch 
                    variant="purple"
                    checked={notifications.soundEnabled}
                    onCheckedChange={() => updateNotification('soundEnabled')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${
                      resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                    }`}>Vibration</p>
                    <p className={`text-sm ${
                      resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>Vibrate for notifications</p>
                  </div>
                  <Switch 
                    variant="purple"
                    checked={notifications.vibration}
                    onCheckedChange={() => updateNotification('vibration')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Notifications */}
        {isSubscribed && (
          <div className="space-y-4">
            <h2 className={`text-lg font-semibold ${
              resolvedTheme === 'dark' ? 'text-purple-500' : 'text-purple-600'
            }`}>Test Notifications</h2>
            
            <Card className={`${
              resolvedTheme === 'dark' 
                ? 'bg-black border-gray-800' 
                : 'bg-white border-gray-200'
            } shadow-lg`}>
              <CardContent className="p-4">
                <p className={`text-sm ${
                  resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                } mb-4`}>
                  Test different types of notifications to ensure they work properly on your device
                </p>
              <div className="space-y-4">
                <Button 
                  onClick={sendTestNotification} 
                  disabled={isLoading || !isSubscribed}
                  variant="outline" 
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  Send Server Push Test
                </Button>
                
                <Button 
                  onClick={handleLocalTestNotification} 
                  disabled={permission !== 'granted'}
                  variant="outline" 
                  className="w-full"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Android Banner Test
                </Button>

                {/android/i.test(navigator.userAgent) && (
                  <>
                    <Button 
                      onClick={handleAndroidDiagnostic} 
                      variant="outline" 
                      className="w-full"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Android Diagnostic
                    </Button>
                    
                    {!window.matchMedia('(display-mode: standalone)').matches && (
                      <Button 
                        onClick={handleInstallPWA} 
                        variant="default" 
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Smartphone className="w-4 h-4 mr-2" />
                        Install as App (Recommended)
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Android Troubleshooting Section */}
        {isSubscribed && /android/i.test(navigator.userAgent) && (
          <Card className={`${
            resolvedTheme === 'dark' 
              ? 'bg-orange-900/20 border-orange-800' 
              : 'bg-orange-50 border-orange-200'
          } shadow-lg`}>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Info className={`w-5 h-5 ${
                  resolvedTheme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                } mt-1 flex-shrink-0`} />
                <div className="flex-1">
                  <h3 className={`font-semibold ${
                    resolvedTheme === 'dark' ? 'text-orange-200' : 'text-orange-800'
                  } mb-2`}>
                    Android Notification Tips
                  </h3>
                  <div className={`text-sm ${
                    resolvedTheme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                  } space-y-2`}>
                    <p>
                      If notifications only appear in your notification tray (not as banners):
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><strong>Install as PWA:</strong> Add app to Home Screen for better notification support</li>
                      <li><strong>Check Do Not Disturb:</strong> Disable DND mode or allow this app</li>
                      <li><strong>Notification Importance:</strong> Set to "High" in Android Settings &gt; Apps</li>
                      <li><strong>Banner Style:</strong> Enable "Show as pop-up" or "Alert style"</li>
                      <li><strong>App Battery:</strong> Disable battery optimization for this app</li>
                    </ul>
                    <div className={`mt-3 pt-2 ${
                      resolvedTheme === 'dark' ? 'border-orange-700' : 'border-orange-200'
                    }`}>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`${
                          resolvedTheme === 'dark' 
                            ? 'text-orange-200 border-orange-600 hover:bg-orange-800' 
                            : 'text-orange-800 border-orange-300 hover:bg-orange-100'
                        }`}
                        onClick={() => {
                          // Open Android notification settings if possible
                          }}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        View Settings Guide
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}