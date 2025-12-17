import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // 404 Error: User attempted to access non-existent route
    // Location tracking for analytics purposes
  }, [location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-6">Oops! Page not found</p>
        <Button 
          onClick={() => setLocation("/")}
          variant="default"
        >
          Return to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
