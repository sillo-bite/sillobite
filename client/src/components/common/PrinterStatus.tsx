import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, AlertCircle, RefreshCw } from "lucide-react";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";

/**
 * Printer status indicator component with manual retry
 * Shows Connected or Not Connected based on local helper status
 * Includes a manual retry button to check status on demand
 */
export default function PrinterStatus() {
  const { isConnected, isLoading, retry, error } = usePrinterStatus();

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
    <div className="flex items-center gap-2">
      <Badge 
        variant={status.variant} 
        className="flex items-center space-x-1 text-xs"
        title={isConnected ? "Local printer helper is available" : isLoading ? "Checking printer status..." : `Printer error: ${error}`}
      >
        <Icon className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
        <span>{status.text}</span>
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={retry}
        disabled={isLoading}
        className="h-6 w-6 p-0"
        title="Retry printer connection"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}




