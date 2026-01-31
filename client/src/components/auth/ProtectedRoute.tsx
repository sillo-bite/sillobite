import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthSync } from "@/hooks/useDataSync";
import { Button } from "@/components/ui/button";
import { UserRole } from "@shared/schema";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | string;
  requiredRoles?: (UserRole | string)[];
  requireAuth?: boolean;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredRoles = [],
  requireAuth = true
}: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, hasRole } = useAuthSync();

  // Authentication and role checking logic

  useEffect(() => {
    // Check if authentication is required
    if (requireAuth && !isAuthenticated) {
      setLocation("/login");
      return;
    }

    // Check specific role requirements
    if (requiredRole && !hasRole(requiredRole)) {
      setLocation("/login");
      return;
    }

    // Check multiple role requirements
    if (requiredRoles.length > 0 && !requiredRoles.some(role => hasRole(role))) {
      setLocation("/login");
      return;
    }
  }, [isAuthenticated, user, requiredRole, requiredRoles, requireAuth, hasRole, setLocation]);

  // Return access denied screen immediately if not authorized
  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">Please log in to access this page</p>
          <Button onClick={() => setLocation("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to access this page</p>
          <Button onClick={() => setLocation("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  if (requiredRoles.length > 0 && !requiredRoles.some(role => hasRole(role))) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to access this page</p>
          <Button onClick={() => setLocation("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}