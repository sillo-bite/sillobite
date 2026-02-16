import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, AlertCircle, CheckCircle, Clock, CreditCard } from 'lucide-react';
import { useWebPushNotifications } from '@/hooks/useWebPushNotifications';

interface NotificationPermissionDialogProps {
  isOpen: boolean;
  onClose: (granted: boolean) => void;
  userId?: string;
  userRole?: string;
}

export default function NotificationPermissionDialog({
  isOpen,
  onClose,
  userId,
  userRole
}: NotificationPermissionDialogProps) {
  const [isEnabling, setIsEnabling] = useState(false);

  const {
    requestPermission,
    supportsNotifications,
    permission
  } = useWebPushNotifications(userId, userRole);

  const handleEnableNotifications = async () => {
    setIsEnabling(true);
    try {
      await requestPermission();
      // Give a moment for the notification permission to be processed
      setTimeout(() => {
        const isGranted = Notification.permission === 'granted';
        onClose(isGranted);
      }, 500);
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      onClose(false);
    } finally {
      setIsEnabling(false);
    }
  };

  const handleSkip = () => {
    onClose(false);
  };

  if (!supportsNotifications) {
    return null; // Don't show dialog if notifications aren't supported
  }

  // Don't show if already granted permission
  if (permission === 'granted') {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto rounded-lg border border-[#333333] bg-black dark:bg-black animate-in fade-in-0 zoom-in-95 duration-300 shadow-xl">
        <DialogHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center animate-in zoom-in-95 duration-500 delay-100 shadow-lg shadow-primary/50">
            <Bell className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-500 delay-200">
            <DialogTitle className="text-xl font-bold text-white">
              Enable Notifications
            </DialogTitle>
            <DialogDescription className="text-sm text-[#A6A6A6]">
              Get updates on order status
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-3 p-3 bg-[#2E2E2E] rounded-lg border border-[#333333] animate-in slide-in-from-left-4 fade-in-0 duration-500 delay-200 hover:bg-[#2E2E2E]/80 transition-colors">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 animate-in zoom-in-95 duration-300 delay-300">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm">Order Confirmed</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-[#2E2E2E] rounded-lg border border-[#333333] animate-in slide-in-from-left-4 fade-in-0 duration-500 delay-300 hover:bg-[#2E2E2E]/80 transition-colors">
              <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0 animate-in zoom-in-95 duration-300 delay-400">
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm">Ready for Pickup</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-[#2E2E2E] rounded-lg border border-[#333333] animate-in slide-in-from-left-4 fade-in-0 duration-500 delay-400 hover:bg-[#2E2E2E]/80 transition-colors">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 animate-in zoom-in-95 duration-300 delay-500">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm">Payment Updates</p>
              </div>
            </div>
          </div>

          {permission === 'denied' && (
            <div className="flex items-start space-x-3 p-3 bg-red-950/30 border border-red-800/40 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-400">
                <p className="font-semibold mb-2">Notifications blocked</p>
                <p>Enable in browser settings</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col space-y-2 pt-4">
          {permission !== 'denied' && (
            <Button
              onClick={handleEnableNotifications}
              disabled={isEnabling}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-all duration-200 animate-in slide-in-from-bottom-4 fade-in-0 duration-500 delay-500 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/30"
              data-testid="button-enable-notifications"
            >
              {isEnabling ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-2 animate-pulse" />
                  Enable Notifications
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleSkip}
            className="w-full h-11 border-[#333333] bg-[#2E2E2E] text-[#A6A6A6] hover:bg-[#2E2E2E]/80 hover:text-white transition-all duration-200 animate-in slide-in-from-bottom-4 fade-in-0 duration-500 delay-600 hover:scale-[1.02] active:scale-[0.98]"
            data-testid="button-skip-notifications"
          >
            <BellOff className="w-4 h-4 mr-2" />
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}