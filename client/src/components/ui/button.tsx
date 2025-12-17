import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Food app specific variants
        food: "gradient-primary text-primary-foreground hover:opacity-90 shadow-button font-semibold",
        cart: "bg-success text-success-foreground hover:bg-success/90 font-semibold shadow-lg hover:shadow-xl ring-2 ring-success/20 hover:ring-success/40 border border-success/30 dark:border-success/50 active:scale-[0.98] active:shadow-md transition-all duration-200",
        offer: "bg-warning text-warning-foreground hover:bg-warning/90 font-medium",
        minimal: "bg-accent text-accent-foreground hover:bg-accent/80 border border-border",
        // Partner landing page variants
        hero: "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 shadow-[0_0_40px_-8px_rgba(99,102,241,0.3)] hover:shadow-[0_8px_20px_-6px_rgba(99,102,241,0.4)]",
        "hero-outline": "border-2 border-primary/20 bg-transparent text-primary hover:bg-primary/5 hover:border-primary/40",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-8",
        icon: "h-10 w-10",
        // Food app specific sizes
        hero: "h-12 px-6 text-base",
        mobile: "h-12 px-4 text-base rounded-lg",
        // Partner landing page sizes
        xl: "h-14 rounded-xl px-10 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      onPointerUp,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"

    const handlePointerUp = React.useCallback(
      (event: React.PointerEvent<HTMLButtonElement>) => {
        // Preserve any consumer-supplied handler first
        onPointerUp?.(event)
        if (event.defaultPrevented) return

        const pointerType = event.pointerType
        // Blur to clear touch/press highlight for pointer interactions (not keyboard)
        if (
          (pointerType === "touch" ||
            pointerType === "pen" ||
            pointerType === "mouse") &&
          event.currentTarget instanceof HTMLElement
        ) {
          event.currentTarget.blur()
        }
      },
      [onPointerUp]
    )

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onPointerUp={handlePointerUp}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
