import React from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import PaymentCounter from "@/components/payment/PaymentCounter";
import StoreMode from "./StoreMode";
import KotMode from "./KotMode";

export default function CounterInterfaceWrapper() {
  // Handle both owner dashboard and admin routes
  const [ownerMatch, ownerParams] = useRoute("/canteen-owner-dashboard/:canteenId/counter/:counterId");
  const [adminMatch, adminParams] = useRoute("/admin/canteen/:canteenId/counter/:counterId");
  
  const params = ownerParams || adminParams;
  const match = ownerMatch || adminMatch;
  
  console.log('🔍 CounterInterfaceWrapper - Route match:', match);
  console.log('🔍 CounterInterfaceWrapper - Params:', params);
  
  const canteenId = params?.canteenId;
  const counterId = params?.counterId;
  
  console.log('🔍 CounterInterfaceWrapper - Canteen ID:', canteenId);
  console.log('🔍 CounterInterfaceWrapper - Counter ID:', counterId);
  
  if (!canteenId || !counterId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Missing canteen ID or counter ID</p>
          <p className="text-sm text-muted-foreground mt-2">
            Canteen ID: {canteenId || 'undefined'} | Counter ID: {counterId || 'undefined'}
          </p>
        </div>
      </div>
    );
  }

  // Fetch counter details to determine type
  const { data: counter, isLoading, error } = useQuery({
    queryKey: ['/api/counters', counterId],
    queryFn: async () => {
      console.log('🔍 CounterInterfaceWrapper fetching counter details for:', counterId);
      const result = await apiRequest(`/api/counters/${counterId}`);
      console.log('🔍 CounterInterfaceWrapper counter details response:', result);
      return result;
    },
    enabled: !!counterId,
  });

  console.log('🔍 CounterInterfaceWrapper query state:', { 
    isLoading, 
    error, 
    counter, 
    counterType: counter?.type,
    enabled: !!counterId 
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !counter) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Failed to load counter details</p>
        </div>
      </div>
    );
  }

  // Render appropriate component based on counter type
  console.log('🔍 CounterInterfaceWrapper rendering component for counter type:', counter.type);
  
  if (counter.type === 'payment') {
    console.log('🔍 CounterInterfaceWrapper rendering PaymentCounter');
    return <PaymentCounter counterId={counterId} canteenId={canteenId} />;
  } else if (counter.type === 'store') {
    console.log('🔍 CounterInterfaceWrapper rendering StoreMode');
    return <StoreMode counterId={counterId} canteenId={canteenId} />;
  } else if (counter.type === 'kot') {
    console.log('🔍 CounterInterfaceWrapper rendering KotMode');
    return <KotMode counterId={counterId} canteenId={canteenId} />;
  } else {
    console.log('🔍 CounterInterfaceWrapper unknown counter type:', counter.type);
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Unknown counter type: {counter.type}</p>
        </div>
      </div>
    );
  }
}
