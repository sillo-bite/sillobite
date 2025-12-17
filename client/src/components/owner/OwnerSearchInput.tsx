import { InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import OwnerInput from "./OwnerInput";
import OwnerButton from "./OwnerButton";
import { cn } from "@/lib/utils";

interface OwnerSearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  onClear?: () => void;
  showClearButton?: boolean;
  containerClassName?: string;
}

/**
 * OwnerSearchInput
 * 
 * Search input with icon and optional clear button.
 */
export default function OwnerSearchInput({
  value,
  onClear,
  showClearButton = true,
  containerClassName,
  className,
  ...props
}: OwnerSearchInputProps) {
  const hasValue = value && String(value).length > 0;

  return (
    <div className={cn("relative", containerClassName)}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        <Search className="w-4 h-4" />
      </div>
      <OwnerInput
        type="search"
        value={value}
        className={cn("pl-9 pr-9", className)}
        {...props}
      />
      {showClearButton && hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}






