# British Army Ski Race - Design System

## Overview

This design system provides a comprehensive visual language for the British Army Ski Race application, combining military precision with alpine aesthetics to create an interface that is both professional and contextually appropriate.

## Design Principles

### 1. **Clarity in Conditions**
Interfaces must be readable in varying light conditions, from bright snow glare to dim indoor venues.

### 2. **Efficiency First**
Optimise for rapid data entry and minimal clicks, as users often work in cold conditions with gloves.

### 3. **Military Precision**
Reflect the disciplined, organised nature of military operations through structured layouts and clear hierarchies.

### 4. **Alpine Context**
Incorporate subtle visual elements that connect to the mountain environment without compromising functionality.

### 5. **Robust Reliability**
Ensure the interface remains functional and accessible even in challenging field conditions.

## Visual Identity

### Logo & Branding
- Primary mark: British Army crest with alpine elements
- Secondary mark: Simplified ski race icon
- Application icon: Shield with crossed skis

### Colour System

#### Primary Palette
```
Navy Deep    #0A1628 - Primary brand, headers
Navy Blue    #1E3A5F - Navigation, primary actions  
Royal Blue   #2C5282 - Links, active states
Sky Blue     #4A90E2 - Hover states, selections
Ice Blue     #E1F0FF - Backgrounds, subtle highlights
```

#### Semantic Colours
```
Success Green  #10B981 - Completed, valid, finish
Warning Amber  #F59E0B - Caution, DNS, pending
Danger Red     #EF4444 - Errors, DNF, DSQ
Info Blue      #3B82F6 - Information, hints
```

#### Competition Colours
```
Gold    #FFB800 - 1st place, premium features
Silver  #C0C0C0 - 2nd place, secondary elements
Bronze  #CD7F32 - 3rd place, tertiary elements
```

### Typography

#### Font Hierarchy
- **Display**: Inter 700, 36-48px - Major headings
- **Heading**: Inter 600, 24-30px - Page titles
- **Subheading**: Inter 600, 18-20px - Section headers
- **Body**: Inter 400, 14-16px - Standard text
- **Caption**: Inter 400, 12px - Secondary information
- **Mono**: JetBrains Mono 400, 14px - Times, codes

#### Usage Guidelines
- Line height: 1.5 for body text, 1.2 for headings
- Letter spacing: -0.02em for headings, normal for body
- Maximum line length: 65 characters for optimal reading

## Component Patterns

### Layout Structure

#### Application Shell
```
┌─────────────────────────────────────┐
│ TopBar (Competition Context)        │
├──────┬──────────────────────────────┤
│ Side │                              │
│ Nav  │  Main Content Area           │
│      │                              │
│      │  ┌────────────────────┐      │
│      │  │ Page Container     │      │
│      │  │                    │      │
│      │  └────────────────────┘      │
└──────┴──────────────────────────────┘
```

#### Responsive Breakpoints
- Mobile: 320px - 767px (Minimal/Emergency use)
- Tablet: 768px - 1023px (Portable devices)
- Desktop: 1024px - 1439px (Standard laptops)
- Wide: 1440px+ (External monitors)

### Navigation Patterns

#### Primary Navigation (Sidebar)
- Icon + Label format
- Collapsible sections
- Active state indication
- Keyboard accessible

#### Secondary Navigation (Tabs)
- Horizontal tab bar
- Clear active indicator
- Swipe support on touch

#### Breadcrumbs
- Hierarchical path display
- Clickable parent levels
- Current page non-clickable

### Data Display

#### Tables
- Sticky header on scroll
- Sortable columns
- Row hover states
- Inline actions
- Pagination controls
- Density options (Compact/Normal/Comfortable)

#### Cards
- Elevated surface (subtle shadow)
- Clear header section
- Action footer when needed
- Consistent padding (16px/24px)

#### Lists
- Clear item separation
- Hover states
- Selection indicators
- Batch action support

### Form Patterns

#### Input Fields
- Clear labels above fields
- Placeholder for examples
- Error messages below
- Helper text when needed
- Required field indicators (*)

#### Field States
- Default: Border #E2E8F0
- Focus: Border #2C5282, shadow
- Error: Border #EF4444, message
- Disabled: Background #F3F4F6
- Success: Border #10B981

#### Form Layouts
- Single column on mobile
- Two column on desktop for related fields
- Logical grouping with sections
- Progressive disclosure for complex forms

### Feedback Patterns

#### Loading States
- Skeleton screens for layouts
- Spinners for actions
- Progress bars for uploads
- Shimmer effects for content

#### Empty States
- Clear illustration or icon
- Explanatory message
- Action button when applicable

#### Error Handling
- Toast notifications for system errors
- Inline validation for forms
- Error boundaries for crashes
- Retry mechanisms

## Interaction Patterns

### Click/Touch Targets
- Minimum 44x44px for touch
- 32x32px for mouse
- Clear hover states
- Active/pressed feedback

### Keyboard Navigation
- Tab order follows visual flow
- Focus indicators visible
- Escape to cancel
- Enter to confirm
- Arrow keys for navigation

### Gestures (Touch Devices)
- Swipe for navigation
- Pull to refresh
- Long press for context menu
- Pinch to zoom (where applicable)

## Motion & Animation

### Timing
- Micro: 100-200ms (hovers, state changes)
- Macro: 200-400ms (page transitions, modals)
- Slow: 400-600ms (complex animations)

### Easing
- Standard: cubic-bezier(0.4, 0, 0.2, 1)
- Decelerate: cubic-bezier(0, 0, 0.2, 1)
- Accelerate: cubic-bezier(0.4, 0, 1, 1)

### Animation Principles
- Purpose over decoration
- Consistent direction
- Respect reduced motion preferences
- No animation in data entry areas

## Accessibility Standards

### WCAG Compliance
- Target: WCAG 2.1 Level AA
- Colour contrast: 4.5:1 minimum
- Large text: 3:1 minimum
- Focus indicators: Always visible

### Screen Reader Support
- Semantic HTML structure
- ARIA labels where needed
- Announce dynamic changes
- Skip navigation links

### Keyboard Support
- All interactive elements reachable
- Logical tab order
- No keyboard traps
- Standard shortcuts supported

## Platform Considerations

### Desktop (Primary)
- Optimised for 1920x1080
- Mouse-first interactions
- Keyboard shortcuts
- Multi-window support

### Tablet (Secondary)
- Touch-optimised controls
- Larger tap targets
- Simplified navigation
- Portrait/landscape support

### Field Conditions
- High contrast mode available
- Large text option
- Simplified input methods
- Offline capability

## Implementation Guidelines

### CSS Architecture
```scss
// Use CSS custom properties for theming
:root {
  --color-primary: #0A1628;
  --space-unit: 8px;
  --radius-default: 4px;
}

// Component classes with BEM
.race-card {
  &__header {}
  &__content {}
  &__footer {}
  
  &--featured {}
  &--disabled {}
}
```

### Component Structure
```tsx
// Consistent component patterns
interface ComponentProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}
```

### Testing Requirements
- Visual regression testing
- Accessibility audits
- Performance monitoring
- Cross-browser validation

## Usage Examples

### Page Layout
```tsx
<AppShell>
  <TopBar title="Competition Name" />
  <SideNav>
    <NavSection title="Competitors">
      <NavItem icon={UserIcon} label="Manage" />
    </NavSection>
  </SideNav>
  <PageContainer>
    <PageHeader 
      title="Race Results"
      breadcrumbs={[...]}
    />
    <ContentCard>
      {/* Page content */}
    </ContentCard>
  </PageContainer>
</AppShell>
```

### Form Example
```tsx
<Form onSubmit={handleSubmit}>
  <FormSection title="Competitor Details">
    <FormRow>
      <TextField 
        label="First Name"
        required
        error={errors.firstName}
      />
      <TextField 
        label="Last Name"
        required
        error={errors.lastName}
      />
    </FormRow>
  </FormSection>
  <FormActions>
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary" type="submit">Save</Button>
  </FormActions>
</Form>
```

## Maintenance & Evolution

### Version Control
- Semantic versioning for design tokens
- Change log for component updates
- Deprecation warnings
- Migration guides

### Documentation
- Component library (Storybook)
- Usage guidelines
- Code examples
- Best practices

### Contribution
- Design review process
- Component proposal template
- Testing requirements
- Accessibility checklist

---

*This design system is a living document that evolves with the application's needs while maintaining consistency and quality.*