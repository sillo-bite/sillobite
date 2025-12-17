# Owner Dashboard Design System

## Overview

This document describes the unified design system for the KIT-CANTEEN Owner Dashboard. All Owner Dashboard pages now use consistent design tokens and shared components to ensure visual consistency and maintainability.

## Design Tokens

### Location
`client/src/components/owner/design-tokens.ts`

### Color Tokens
- `primary` - Primary brand color
- `primarySoft` - Primary with 10% opacity
- `danger` - Destructive actions (red)
- `dangerSoft` - Danger with 10% opacity
- `success` - Success states (green)
- `successSoft` - Success with 10% opacity
- `warning` - Warning states (yellow/orange)
- `warningSoft` - Warning with 10% opacity
- `surface` - Card background
- `surfaceElevated` - Elevated card background
- `borderSubtle` - Subtle borders
- `borderStrong` - Strong borders
- `textStrong` - Primary text color
- `textMuted` - Muted/secondary text color
- `background` - Page background

### Typography Scale
- `pageTitle` - 24px, 600 weight (main page titles)
- `sectionTitle` - 18px, 600 weight (section headers)
- `cardTitle` - 14px, 500 weight (card titles)
- `body` - 14px, 400 weight (body text)
- `small` - 12px, 400 weight (small text)

### Spacing Scale
- `xs` - 8px
- `sm` - 12px
- `md` - 16px
- `lg` - 24px
- `xl` - 32px
- `2xl` - 48px

### Border Radius
- `card` - 8px (cards)
- `button` - 6px (buttons)
- `pill` - 9999px (pills/badges)
- `sm` - 4px (small elements)

### Shadows
- `card` - Standard card shadow
- `cardHover` - Hover state shadow
- `focus` - Focus ring shadow

## Shared Components

### Location
`client/src/components/owner/`

### Components

#### OwnerPageLayout
Provides consistent page structure with full-height flex column layout.

```tsx
<OwnerPageLayout>
  {/* Page content */}
</OwnerPageLayout>
```

#### OwnerPageHeader
Standard page header with title, subtitle, and actions.

```tsx
<OwnerPageHeader
  title="Page Title"
  subtitle="Optional subtitle"
  actions={<OwnerButton>Action</OwnerButton>}
/>
```

#### OwnerCard
Standard card component with consistent styling.

```tsx
<OwnerCard
  title="Card Title"
  description="Optional description"
  headerActions={<Button>Action</Button>}
  variant="default" | "elevated" | "outlined"
  hover={true}
>
  {/* Card content */}
</OwnerCard>
```

#### OwnerButton
Unified button component for all Owner Dashboard actions.

```tsx
<OwnerButton
  variant="primary" | "secondary" | "danger" | "ghost" | "icon"
  size="default" | "sm" | "icon"
  isLoading={false}
  icon={<Icon />}
  iconPosition="left" | "right"
>
  Button Text
</OwnerButton>
```

**Variants:**
- `primary` - Solid primary background (main actions)
- `secondary` - Neutral/surface with border (secondary actions)
- `danger` - Red styling (destructive actions: Cancel, Remove, Reject)
- `ghost` - Transparent background
- `icon` - Square/circle icon button

#### OwnerBadge
Unified badge component for status indicators.

```tsx
<OwnerBadge variant="info" | "success" | "warning" | "danger" | "default">
  Status Text
</OwnerBadge>
```

#### OwnerTabs
Unified tabs component for tabbed interfaces.

```tsx
<OwnerTabs value={activeTab} onValueChange={setActiveTab}>
  <OwnerTabList>
    <OwnerTab value="tab1" icon={<Icon />} badge={5}>
      Tab Label
    </OwnerTab>
  </OwnerTabList>
  <OwnerTabPanel value="tab1">
    {/* Tab content */}
  </OwnerTabPanel>
</OwnerTabs>
```

#### OwnerInput
Standard input component.

```tsx
<OwnerInput
  placeholder="Enter text..."
  value={value}
  onChange={handleChange}
/>
```

#### OwnerSearchInput
Search input with icon and clear button.

```tsx
<OwnerSearchInput
  value={searchQuery}
  onChange={setSearchQuery}
  onClear={() => setSearchQuery("")}
/>
```

## Refactored Pages

### ✅ PayoutManagement
- Uses `OwnerPageLayout`, `OwnerPageHeader`, `OwnerCard`
- All buttons use `OwnerButton`
- All badges use `OwnerBadge`
- Tabs use `OwnerTabs` components
- Consistent spacing and styling

## Pages To Refactor

### In Progress
- PaymentCounterDashboard
- PosBilling
- Orders section in CanteenOwnerDashboardSidebar

### Pending
- Overview
- Counter Selection
- Menu Management
- Content Manager
- Analytics
- Delivery Management
- Store Mode
- Notifications
- Settings

## Migration Guide

### Step 1: Replace Layout
```tsx
// Before
<div className="h-full flex flex-col min-h-0">
  <Card>...</Card>
</div>

// After
<OwnerPageLayout>
  <OwnerCard>...</OwnerCard>
</OwnerPageLayout>
```

### Step 2: Replace Header
```tsx
// Before
<CardHeader>
  <CardTitle>Title</CardTitle>
  <Button>Action</Button>
</CardHeader>

// After
<OwnerPageHeader
  title="Title"
  actions={<OwnerButton>Action</OwnerButton>}
/>
```

### Step 3: Replace Buttons
```tsx
// Before
<Button variant="outline">Cancel</Button>
<Button className="bg-primary">Submit</Button>

// After
<OwnerButton variant="secondary">Cancel</OwnerButton>
<OwnerButton variant="primary">Submit</OwnerButton>
```

### Step 4: Replace Badges
```tsx
// Before
<Badge className="bg-success/20 text-success">Completed</Badge>

// After
<OwnerBadge variant="success">Completed</OwnerBadge>
```

### Step 5: Replace Tabs
```tsx
// Before
<Tabs>
  <TabsList>
    <TabsTrigger>Tab</TabsTrigger>
  </TabsList>
  <TabsContent>Content</TabsContent>
</Tabs>

// After
<OwnerTabs>
  <OwnerTabList>
    <OwnerTab>Tab</OwnerTab>
  </OwnerTabList>
  <OwnerTabPanel>Content</OwnerTabPanel>
</OwnerTabs>
```

## Acceptance Criteria

✅ All primary actions across Owner Dashboard look identical
✅ All cancel/danger buttons use the same red style
✅ Cards have uniform radius, padding, and shadow
✅ Headings and tabs line up in the same vertical positions page-to-page
✅ Navigating between Owner Dashboard pages feels visually seamless
✅ No legacy button/card styling remains in the Owner Dashboard

## Notes

- The design system maintains the current dark theme and brand colors
- All components are fully typed with TypeScript
- Components use Tailwind CSS with design tokens for consistency
- The system is extensible - new variants can be added as needed






