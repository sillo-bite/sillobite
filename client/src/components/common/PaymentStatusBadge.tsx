import { Badge } from "@/components/ui/badge";
import { getPaymentStatusColor, getPaymentStatusLabel } from "@/utils/orderStatus";

interface PaymentStatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Reusable badge component for displaying payment status
 */
export default function PaymentStatusBadge({ status, className = "" }: PaymentStatusBadgeProps) {
  return (
    <Badge className={`${getPaymentStatusColor(status)} ${className}`}>
      {getPaymentStatusLabel(status)}
    </Badge>
  );
}

