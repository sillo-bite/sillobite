import { Badge } from "@/components/ui/badge";
import { Printer, AlertCircle } from "lucide-react";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";

/**
 * Minimal printer status indicator component
 * Shows Connected or Not Connected based on local helper status
 */
export default function PrinterStatus() {
  const { isConnected, isLoading } = usePrinterStatus();

  const getStatus = () => {
    if (isLoading) {
      return { 
        icon: Printer, 
        text: "Checking...", 
        variant: "secondary" as const 
      };
    }
    if (isConnected) {
      return { 
        icon: Printer, 
        text: "Connected", 
        variant: "default" as const 
      };
    }
    return { 
      icon: AlertCircle, 
      text: "Not Connected", 
      variant: "destructive" as const 
    };
  };

  const status = getStatus();
  const Icon = status.icon;

  return (
    <Badge 
      variant={status.variant} 
      className="flex items-center space-x-1 text-xs"
      title={isConnected ? "Local printer helper is available" : "Local printer helper is not available"}
    >
      <Icon className="w-3 h-3" />
      <span>{status.text}</span>
    </Badge>
  );
}


