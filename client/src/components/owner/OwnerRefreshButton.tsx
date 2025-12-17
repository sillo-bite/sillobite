import { RefreshCw } from "lucide-react";
import OwnerButton from "./OwnerButton";
import { cn } from "@/lib/utils";

interface OwnerRefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * OwnerRefreshButton
 * 
 * Standardized refresh button for Owner Dashboard pages.
 * - Uses OwnerButton with icon variant
 * - Shows spinning animation when loading
 * - Automatically disabled while loading
 * - Consistent icon size across all pages
 */
export default function OwnerRefreshButton({
  onRefresh,
  loading = false,
  disabled = false,
  className,
}: OwnerRefreshButtonProps) {
  return (
    <OwnerButton
      variant="icon"
      size="icon"
      onClick={onRefresh}
      disabled={disabled || loading}
      isLoading={loading}
      className={className}
      icon={
        <RefreshCw
          className={cn(
            "w-4 h-4",
            loading && "animate-spin-slow"
          )}
        />
      }
    />
  );
}






