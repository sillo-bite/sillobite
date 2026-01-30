import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Mail, Phone, RefreshCw } from "lucide-react";
interface BlockedUser {
  id: string | number;
  name: string;
  email: string;
  role: string;
}

interface BlockedUserScreenProps {
  user: BlockedUser;
  onRetryLogin: () => void;
}

export default function BlockedUserScreen({ user, onRetryLogin }: BlockedUserScreenProps) {
  const [isChecking, setIsChecking] = useState(false);

  // Get the original role (remove blocked_ prefix)
  const originalRole = user.role?.startsWith('blocked_')
    ? user.role.replace('blocked_', '')
    : user.role;

  const checkUnblockStatus = async () => {
    setIsChecking(true);
    try {
      const response = await fetch(`/api/users/${user.id}/validate`);
      if (response.ok) {
        const data = await response.json();
        if (data.userExists && data.user.role && !data.user.role.startsWith('blocked_')) {
          onRetryLogin();
        } else {
        }
      }
    } catch (error) {
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-red-200 dark:border-red-800">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-red-800 dark:text-red-200">
            Account Blocked
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200 text-center mb-2">
              Your account has been temporarily blocked by the administrators.
            </p>
            <div className="text-xs text-red-600 dark:text-red-400 space-y-1">
              <div><strong>Account:</strong> {user.name}</div>
              <div><strong>Email:</strong> {user.email}</div>
              <div><strong>Role:</strong> {originalRole?.charAt(0).toUpperCase() + originalRole?.slice(1)}</div>
            </div>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Why was I blocked?</p>
                <p>Accounts may be blocked for policy violations, security concerns, or administrative reasons.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
              <Mail className="w-4 h-4 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">What can I do?</p>
                <p>Contact the administrators to appeal this decision or get more information about the block.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
              <Phone className="w-4 h-4 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Need immediate help?</p>
                <p>Contact support for urgent matters or account recovery assistance.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={checkUnblockStatus}
              disabled={isChecking}
              className="w-full"
              variant="outline"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Checking Status...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check if Unblocked
                </>
              )}
            </Button>

            <Button
              onClick={() => window.location.href = 'mailto:sillobite.production@gmail.com?subject=Account%20Blocked%20Appeal'}
              className="w-full"
              variant="default"
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          </div>

          <div className="text-xs text-center text-muted-foreground border-t pt-4">
            <p>If you believe this is a mistake, please contact our support team.</p>
            <p className="mt-1 font-mono text-xs">User ID: {user.id}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}