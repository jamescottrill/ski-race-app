# British Army Ski Race Application - UI Migration Plan

## Executive Summary

This document outlines the migration strategy for modernising the UI of the British Army Ski Race application while maintaining all existing functionality. The migration will transform the current Material-UI based interface into a modern, cohesive design system that reflects the application's military context and alpine environment.

## Context & Requirements

### Application Purpose
- **Primary Function**: Manage British Army ski racing competitions
- **Core Operations**: Competitor registration, race timing, results calculation, team scoring
- **Output**: Official race documents, start lists, and results PDFs

### User Profile
- **Primary Users**: Race officials, timekeepers, competition organisers
- **Technical Level**: Mixed (from basic to advanced)
- **Environment**: Indoor venues, ski lodges, outdoor timing huts
- **Conditions**: Cold weather, potential glove use, varying lighting

### Usage Locations
- **Alpine Resorts**: European ski resorts (Alps)
- **Military Facilities**: British Army sports centres
- **Field Conditions**: Temporary race offices, outdoor timing stations

## Design System Specification

### Brand Identity

#### Colour Palette
```css
/* Primary Colours - Military Heritage */
--color-primary-900: #0A1628;      /* Deep Navy (Primary) */
--color-primary-700: #1E3A5F;      /* Navy Blue */
--color-primary-500: #2C5282;      /* Royal Blue */
--color-primary-300: #4A90E2;      /* Sky Blue */
--color-primary-100: #E1F0FF;      /* Ice Blue */

/* Secondary Colours - Alpine Theme */
--color-alpine-white: #FFFFFF;     /* Snow White */
--color-alpine-ice: #F0F9FF;       /* Glacier Ice */
--color-alpine-shadow: #64748B;    /* Mountain Shadow */
--color-alpine-rock: #475569;      /* Alpine Rock */

/* Accent Colours - Competition */
--color-gold: #FFB800;              /* Gold Medal */
--color-silver: #C0C0C0;            /* Silver Medal */
--color-bronze: #CD7F32;            /* Bronze Medal */
--color-success: #10B981;          /* Finish/Success */
--color-danger: #EF4444;            /* DSQ/DNF */
--color-warning: #F59E0B;           /* DNS/Caution */

/* System Colours */
--color-background: #FAFBFC;       /* App Background */
--color-surface: #FFFFFF;          /* Card/Panel Background */
--color-border: #E2E8F0;           /* Borders */
--color-text-primary: #1A202C;     /* Primary Text */
--color-text-secondary: #64748B;   /* Secondary Text */
--color-text-disabled: #CBD5E1;    /* Disabled Text */
```

#### Typography
```css
/* Font Stack */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;

/* Font Sizes */
--text-xs: 0.75rem;     /* 12px - Captions */
--text-sm: 0.875rem;    /* 14px - Secondary text */
--text-base: 1rem;      /* 16px - Body text */
--text-lg: 1.125rem;    /* 18px - Emphasis */
--text-xl: 1.25rem;     /* 20px - Subsection headers */
--text-2xl: 1.5rem;     /* 24px - Section headers */
--text-3xl: 1.875rem;   /* 30px - Page titles */
--text-4xl: 2.25rem;    /* 36px - Major headings */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

#### Spacing System
```css
/* Spacing Scale (8px base) */
--space-0: 0;
--space-1: 0.25rem;    /* 4px */
--space-2: 0.5rem;     /* 8px */
--space-3: 0.75rem;    /* 12px */
--space-4: 1rem;       /* 16px */
--space-5: 1.25rem;    /* 20px */
--space-6: 1.5rem;     /* 24px */
--space-8: 2rem;       /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
--space-16: 4rem;      /* 64px */
```

### Component Architecture

#### Layout Components
1. **AppShell**: Main application wrapper with consistent header/sidebar
2. **PageContainer**: Standard page wrapper with breadcrumbs
3. **ContentCard**: Elevated surface for content sections
4. **GridLayout**: Responsive grid system for forms and cards

#### Navigation Components
1. **TopBar**: Application header with competition context
2. **SideNav**: Collapsible navigation with icon support
3. **Breadcrumbs**: Hierarchical navigation indicator
4. **TabBar**: Section navigation within pages

#### Data Display Components
1. **DataTable**: High-performance virtualised table
2. **StatCard**: Key metric display cards
3. **ResultsList**: Optimised results display
4. **TimerDisplay**: Race time formatting

#### Form Components
1. **TextField**: Standard text input with validation
2. **Select**: Dropdown with search capability
3. **DateTimePicker**: Combined date/time selection
4. **AutoComplete**: Type-ahead with database integration
5. **NumberInput**: Formatted number entry

#### Action Components
1. **Button**: Primary/Secondary/Tertiary variants
2. **IconButton**: Compact action buttons
3. **FAB**: Floating action button for primary actions
4. **ActionMenu**: Grouped actions dropdown

## Migration Strategy

### Phase 1: Foundation (Week 1)

#### 1.1 Setup & Dependencies
```bash
# Remove Material-UI gradually
npm uninstall @mui/material @mui/icons-material @emotion/react @emotion/styled

# Install modern UI framework
npm install @radix-ui/react-primitives
npm install @radix-ui/react-icons
npm install clsx class-variance-authority
npm install @tanstack/react-table
npm install framer-motion
npm install react-hot-toast
```

#### 1.2 Design System Implementation
- Create `/src/renderer/design-system/` directory
- Implement core tokens (colours, typography, spacing)
- Create base component primitives
- Set up CSS-in-JS or CSS modules architecture

#### 1.3 Layout Migration
- Replace Material-UI Container with custom AppShell
- Update Layout.js to new design system
- Migrate Sidebar to new navigation component
- Implement responsive breakpoints

### Phase 2: Core Components (Week 2)

#### 2.1 Form Components
Priority order:
1. TextField (used in all forms)
2. Select/Dropdown (race type, categories)
3. AutoComplete (competitor selection)
4. DateTimePicker (race dates)
5. NumberInput (seed points, times)

#### 2.2 Data Display
Priority order:
1. DataTable (competitor lists, results)
2. Card components (action cards, stat displays)
3. List components (race lists, team lists)
4. Empty states and loading states

#### 2.3 Navigation
1. Update routing structure
2. Implement new breadcrumb system
3. Create tab navigation component
4. Add keyboard navigation support

### Phase 3: Page Migration (Weeks 3-4)

#### 3.1 Critical Path Pages (Week 3)
1. **Landing Page** → Modern dashboard
2. **Competition Management** → Card-based hub
3. **Competitor Registration** → Streamlined form
4. **Race Creation** → Multi-step wizard
5. **Results Recording** → Optimised data entry

#### 3.2 Secondary Pages (Week 4)
1. **View Competitors** → Enhanced table view
2. **Team Management** → Drag-drop interface
3. **Start List Generation** → Preview system
4. **Results Display** → Tabbed categories
5. **Seed List** → Calculation visualisation

### Phase 4: Enhancement (Week 5)

#### 4.1 Performance Optimisation
- Implement virtual scrolling for large lists
- Add progressive loading for images
- Optimise bundle size with code splitting
- Add service worker for offline capability

#### 4.2 Accessibility
- WCAG AA compliance audit
- Keyboard navigation testing
- Screen reader compatibility
- High contrast mode support

#### 4.3 Polish
- Micro-animations and transitions
- Loading skeletons
- Error boundaries
- Toast notifications

## Component Library Selection

### Recommended: Radix UI + Tailwind CSS
**Rationale**:
- Unstyled primitives allow complete design control
- Excellent accessibility out of the box
- Small bundle size
- Works well with existing Tailwind setup

### Alternative Options:
1. **Ant Design** - Comprehensive but opinionated
2. **Chakra UI** - Good balance of features and customisation
3. **Arco Design** - Modern with good data components

## Implementation Roadmap

### Week 1: Foundation
- [ ] Set up design system structure
- [ ] Create colour and typography tokens
- [ ] Implement base layout components
- [ ] Create component documentation

### Week 2: Core Components
- [ ] Build form component library
- [ ] Create data display components
- [ ] Implement navigation system
- [ ] Add storybook for component testing

### Week 3: Critical Pages
- [ ] Migrate landing and competition pages
- [ ] Update competitor registration flow
- [ ] Modernise race creation process
- [ ] Optimise results recording interface

### Week 4: Complete Migration
- [ ] Update remaining pages
- [ ] Ensure feature parity
- [ ] Fix edge cases and bugs
- [ ] Performance testing

### Week 5: Polish & Launch
- [ ] Accessibility audit
- [ ] Performance optimisation
- [ ] User acceptance testing
- [ ] Documentation update

## Migration Checklist

### Pre-Migration
- [x] Backup current codebase
- [x] Document all existing functionality
- [x] Create refactored utilities
- [ ] Set up component library
- [ ] Create design tokens

### During Migration
- [ ] Maintain backward compatibility
- [ ] Test each component in isolation
- [ ] Ensure data flow unchanged
- [ ] Preserve all business logic
- [ ] Keep PDF generation working

### Post-Migration
- [ ] Full regression testing
- [ ] Performance benchmarking
- [ ] Accessibility validation
- [ ] User training materials
- [ ] Update documentation

## Risk Mitigation

### Technical Risks
1. **Data Loss**: Maintain all database operations unchanged
2. **Feature Break**: Component-by-component migration
3. **Performance**: Profile and optimise iteratively
4. **Compatibility**: Test on target hardware

### User Experience Risks
1. **Learning Curve**: Gradual rollout with training
2. **Muscle Memory**: Keep key workflows similar
3. **Field Conditions**: Test in cold/outdoor environments

## Success Metrics

### Performance Targets
- Page load: < 1 second
- Data table render: < 100ms for 1000 rows
- Form submission: < 500ms response
- PDF generation: < 2 seconds

### Quality Metrics
- Zero data calculation errors
- 100% feature parity
- WCAG AA compliance
- 95% test coverage

### User Metrics
- Task completion time: 20% improvement
- Error rate: 50% reduction
- User satisfaction: > 4.5/5

## File Structure

```
src/renderer/
├── design-system/
│   ├── tokens/
│   │   ├── colours.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── breakpoints.ts
│   ├── components/
│   │   ├── primitives/
│   │   ├── forms/
│   │   ├── display/
│   │   ├── navigation/
│   │   └── feedback/
│   ├── layouts/
│   │   ├── AppShell.tsx
│   │   ├── PageContainer.tsx
│   │   └── GridLayout.tsx
│   └── utils/
│       ├── cn.ts
│       └── variants.ts
├── features/
│   ├── competition/
│   ├── competitor/
│   ├── race/
│   ├── results/
│   └── teams/
└── app/
    ├── routes/
    ├── hooks/
    └── providers/
```

## Next Steps

1. **Review and Approve**: Confirm migration plan with stakeholders
2. **Environment Setup**: Configure development environment
3. **Component Library**: Install and configure chosen framework
4. **Design Tokens**: Implement design system foundation
5. **Pilot Component**: Migrate one simple component as proof of concept
6. **Iterate**: Refine approach based on pilot results

---

*This migration plan ensures a smooth transition to a modern UI while preserving all critical functionality. The phased approach minimises risk and allows for continuous testing and refinement.*