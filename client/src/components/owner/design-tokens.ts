/**
 * Owner Dashboard Design System Tokens
 * 
 * This file defines the design tokens used across all Owner Dashboard pages
 * to ensure visual consistency and maintainability.
 */

// Color Tokens
export const ownerColors = {
  primary: "hsl(var(--primary))",
  primarySoft: "hsl(var(--primary) / 0.1)",
  danger: "hsl(var(--destructive))",
  dangerSoft: "hsl(var(--destructive) / 0.1)",
  success: "hsl(var(--success))",
  successSoft: "hsl(var(--success) / 0.1)",
  warning: "hsl(var(--warning))",
  warningSoft: "hsl(var(--warning) / 0.1)",
  surface: "hsl(var(--card))",
  surfaceElevated: "hsl(var(--card))",
  borderSubtle: "hsl(var(--border))",
  borderStrong: "hsl(var(--border) / 0.5)",
  textStrong: "hsl(var(--foreground))",
  textMuted: "hsl(var(--muted-foreground))",
  background: "hsl(var(--background))",
} as const;

// Typography Scale
export const ownerTypography = {
  pageTitle: {
    fontSize: "1.5rem", // 24px
    lineHeight: "1.75rem", // 28px
    fontWeight: "600",
    letterSpacing: "-0.025em",
  },
  sectionTitle: {
    fontSize: "1.125rem", // 18px
    lineHeight: "1.5rem", // 24px
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: "0.875rem", // 14px
    lineHeight: "1.25rem", // 20px
    fontWeight: "500",
  },
  body: {
    fontSize: "0.875rem", // 14px
    lineHeight: "1.25rem", // 20px
    fontWeight: "400",
  },
  small: {
    fontSize: "0.75rem", // 12px
    lineHeight: "1rem", // 16px
    fontWeight: "400",
  },
} as const;

// Spacing Scale
export const ownerSpacing = {
  xs: "0.5rem", // 8px
  sm: "0.75rem", // 12px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 48px
} as const;

// Border Radius
export const ownerRadius = {
  card: "0.5rem", // 8px
  button: "0.375rem", // 6px
  pill: "9999px",
  sm: "0.25rem", // 4px
} as const;

// Shadows
export const ownerShadows = {
  card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  cardHover: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  focus: "0 0 0 2px hsl(var(--ring))",
} as const;

// Component Heights
export const ownerHeights = {
  button: "2.25rem", // 36px
  buttonSm: "2rem", // 32px
  input: "2.25rem", // 36px
  tab: "2.5rem", // 40px
} as const;

// Z-Index Scale
export const ownerZIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

// Transition Durations
export const ownerTransitions = {
  fast: "150ms",
  normal: "200ms",
  slow: "300ms",
} as const;

// Export all tokens as a single object for convenience
export const ownerDesignTokens = {
  colors: ownerColors,
  typography: ownerTypography,
  spacing: ownerSpacing,
  radius: ownerRadius,
  shadows: ownerShadows,
  heights: ownerHeights,
  zIndex: ownerZIndex,
  transitions: ownerTransitions,
} as const;






