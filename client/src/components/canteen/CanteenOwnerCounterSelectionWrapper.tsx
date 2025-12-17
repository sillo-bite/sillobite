import React from "react";
import { useRoute } from "wouter";
import CanteenOwnerCounterSelection from "./CanteenOwnerCounterSelection";

export default function CanteenOwnerCounterSelectionWrapper() {
  const [match, params] = useRoute("/canteen-owner-dashboard/:canteenId/counters");
  
  const canteenId = params?.canteenId;
  
  if (!canteenId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Missing canteen ID</p>
        </div>
      </div>
    );
  }

  return <CanteenOwnerCounterSelection canteenId={canteenId} />;
}
