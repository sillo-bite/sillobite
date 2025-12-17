import { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { ownerHeights, ownerRadius } from "./design-tokens";
import { cn } from "@/lib/utils";

interface OwnerInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

/**
 * OwnerInput
 * 
 * Standard input component for Owner Dashboard.
 * Ensures consistent height, border radius, and styling.
 */
export default function OwnerInput({ className, ...props }: OwnerInputProps) {
  return (
    <Input
      className={cn(
        "h-9",
        "rounded-md",
        className
      )}
      style={{
        borderRadius: ownerRadius.button,
        height: ownerHeights.input,
      }}
      {...props}
    />
  );
}






