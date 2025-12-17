import React from "react";
import { useRoute } from "wouter";
import CanteenAdminLayout from "./CanteenAdminLayout";
import CanteenAdminOverview from "./CanteenAdminOverview";
import CanteenAdminAnalytics from "./CanteenAdminAnalytics";
import CanteenAdminMenuManagement from "./CanteenAdminMenuManagement";
import CanteenAdminOrdersManagement from "./CanteenAdminOrdersManagement";
import CanteenAdminPaymentManagement from "./CanteenAdminPaymentManagement";
import CanteenAdminNotificationManagement from "./CanteenAdminNotificationManagement";
import CanteenAdminReviewManagement from "./CanteenAdminReviewManagement";
import CanteenAdminCouponManagement from "./CanteenAdminCouponManagement";
import CanteenAdminCounterManagement from "./CanteenAdminCounterManagement";
import CanteenAdminContentManagement from "./CanteenAdminContentManagement";
import PrintAgentManagement from "./PrintAgentManagement";

export default function CanteenAdminWrapper() {
  const [match, params] = useRoute("/admin/canteen/:canteenId/:page?");
  
  const canteenId = params?.canteenId;
  
  if (!canteenId) {
    return <div>Loading...</div>;
  }
  
  const renderPage = () => {
    const page = params?.page;
    
    switch (page) {
      case 'analytics':
        return <CanteenAdminAnalytics canteenId={canteenId} />;
      case 'menu':
        return <CanteenAdminMenuManagement canteenId={canteenId} />;
      case 'orders':
        return <CanteenAdminOrdersManagement canteenId={canteenId} />;
      case 'payments':
        return <CanteenAdminPaymentManagement canteenId={canteenId} />;
      case 'notifications':
        return <CanteenAdminNotificationManagement canteenId={canteenId} />;
      case 'reviews':
        return <CanteenAdminReviewManagement canteenId={canteenId} />;
      case 'coupons':
        return <CanteenAdminCouponManagement canteenId={canteenId} />;
      case 'counters':
        return <CanteenAdminCounterManagement canteenId={canteenId} />;
      case 'content':
        return <CanteenAdminContentManagement canteenId={canteenId} />;
      case 'print-agents':
        return <PrintAgentManagement canteenId={canteenId} />;
      default:
        return <CanteenAdminOverview canteenId={canteenId} />;
    }
  };

  return (
    <CanteenAdminLayout canteenId={canteenId}>
      {renderPage()}
    </CanteenAdminLayout>
  );
}
