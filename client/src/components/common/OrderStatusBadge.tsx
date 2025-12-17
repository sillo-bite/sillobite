import { Badge } from "@/components/ui/badge";
import { getOrderStatusColor, getOrderStatusLabel } from "@/utils/orderStatus";

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Reusable badge component for displaying order status
 */
export default function OrderStatusBadge({ status, className = "" }: OrderStatusBadgeProps) {
  return (
    <Badge className={`${getOrderStatusColor(status)} ${className}`}>
      {getOrderStatusLabel(status)}
    </Badge>
  );
}

