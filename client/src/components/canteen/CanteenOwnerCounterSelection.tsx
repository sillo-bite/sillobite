import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Store, 
  CreditCard, 
  ArrowRight, 
  Settings,
  Users,
  Clock,
  CheckCircle
} from 'lucide-react';

interface Counter {
  id: string;
  name: string;
  code: string;
  counterId: string;
  canteenId: string;
  type: 'payment' | 'store' | 'kot';
  createdAt: Date;
}

interface CanteenOwnerCounterSelectionProps {
  canteenId: string;
}

export default function CanteenOwnerCounterSelection({ canteenId }: CanteenOwnerCounterSelectionProps) {
  const [, setLocation] = useLocation();
  const [selectedCounter, setSelectedCounter] = useState<string | null>(null);

  // Set page title
  useEffect(() => {
    document.title = "Counter Selection | KIT-CANTEEN Owner Dashboard";
  }, []);

  // Fetch counters for this canteen
  const { data: countersData, isLoading, error } = useQuery({
    queryKey: ['/api/counters', canteenId],
    queryFn: () => apiRequest(`/api/counters?canteenId=${canteenId}`),
    enabled: !!canteenId,
  });

  // Fetch canteen info
  const { data: canteenData } = useQuery({
    queryKey: ['/api/system-settings/canteens', canteenId],
    queryFn: () => apiRequest(`/api/system-settings/canteens/${canteenId}`),
    enabled: !!canteenId,
  });

  // Extract counters from the API response (API now returns counters directly, not wrapped in items)
  // Filter out payment counters if pay at counter is disabled
  const allCounters = countersData || [];
  const counters = allCounters.filter((counter: Counter) => {
    // If pay at counter is disabled, hide payment counters
    if (counter.type === 'payment' && canteenData?.payAtCounterEnabled === false) {
      return false;
    }
    return true;
  });
  
  // Debug logging
  console.log('🔍 Counter Selection - Counters Data:', countersData);
  console.log('🔍 Counter Selection - Canteen Data:', canteenData);
  console.log('🔍 Counter Selection - Pay at Counter Enabled:', canteenData?.payAtCounterEnabled);
  console.log('🔍 Counter Selection - Filtered Counters Array:', counters);
  console.log('🔍 Counter Selection - Loading:', isLoading);
  console.log('🔍 Counter Selection - Error:', error);

  const handleCounterSelect = (counter: Counter) => {
    setSelectedCounter(counter.id);
    // Navigate to the appropriate counter interface
    setLocation(`/canteen-owner-dashboard/${canteenId}/counter/${counter.id}`);
  };

  const handleMainPanel = () => {
    // Navigate to main canteen owner dashboard
    setLocation(`/canteen-owner-dashboard/${canteenId}`);
  };

  const getCounterIcon = (type: string) => {
    return type === 'payment' ? CreditCard : Store;
  };

  const getCounterDescription = (type: string) => {
    return type === 'payment' 
      ? 'Process payments and manage orders'
      : 'Manage orders and track store operations';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Failed to load counters</p>
          <Button onClick={() => window.location.reload()} className="mt-2">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <div className="flex-1 overflow-hidden flex flex-col container mx-auto px-6 py-6">
        {/* Header */}
        <div className="text-center mb-6 flex-shrink-0">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            Welcome to {canteenData?.name || 'Canteen'} Management
          </h1>
        </div>

        {/* Main Content Area - Uses flexbox to fit content */}
        <div className="flex-1 overflow-hidden flex flex-col gap-6">
          {/* Main Panel Option */}
          <div className="flex-shrink-0 flex justify-center md:justify-start">
            <Button 
              onClick={handleMainPanel}
              variant="outline"
              size="lg"
              className="flex items-center space-x-2 border-2 hover:bg-primary/10 hover:border-primary/40 transition-all shadow-sm"
            >
              <Settings className="h-5 w-5" />
              <span>Go to Main Panel</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Counters and Stats - Flex layout to fit both */}
          <div className="flex-1 overflow-hidden flex flex-col gap-6 min-h-0">
            {/* Counters Section */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2 flex-shrink-0">
                <Store className="h-6 w-6" />
                <span>Available Counters</span>
              </h2>
              
              {counters.length === 0 ? (
                <Card className="flex-1">
                  <CardContent className="flex flex-col items-center justify-center h-full py-12">
                    <Store className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Counters Available</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      No counters have been created for this canteen yet. 
                      Contact your administrator to set up counters.
                    </p>
                    <Button onClick={handleMainPanel} variant="outline">
                      Go to Main Panel Instead
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {counters.map((counter: Counter) => {
                      const IconComponent = getCounterIcon(counter.type);
                      const isSelected = selectedCounter === counter.id;
                      
                      return (
                        <Card 
                          key={counter.id} 
                          className={`cursor-pointer transition-all hover:shadow-lg ${
                            isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'
                          }`}
                          onClick={() => handleCounterSelect(counter)}
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center space-x-3 flex-1 min-w-0">
                                <div className={`p-2 rounded-lg flex-shrink-0 ${
                                  counter.type === 'payment' 
                                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary' 
                                    : 'bg-success/10 text-success dark:bg-success/20 dark:text-success'
                                }`}>
                                  <IconComponent className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <CardTitle className="text-base mb-1 break-words">{counter.name}</CardTitle>
                                  <div className="text-sm text-muted-foreground">
                                    Code: <Badge variant="secondary">{counter.code}</Badge>
                                  </div>
                                </div>
                              </div>
                              <Badge variant={counter.type === 'payment' ? 'default' : 'outline'} className="flex-shrink-0">
                                {counter.type === 'payment' ? 'Payment' : counter.type === 'store' ? 'Store' : 'KOT'}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <p className="text-sm text-muted-foreground">
                                {getCounterDescription(counter.type)}
                              </p>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-muted-foreground">
                                  {new Date(counter.createdAt).toLocaleDateString()}
                                </div>
                                <Button 
                                  size="sm" 
                                  className="flex items-center space-x-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCounterSelect(counter);
                                  }}
                                >
                                  <span>Open</span>
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
