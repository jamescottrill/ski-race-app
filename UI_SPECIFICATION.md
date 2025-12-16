# British Army Ski Race Application - UI Specification Document

## Executive Summary

This document provides a comprehensive specification for redesigning the user interface of the British Army Ski Race calculator application. The application manages ski racing competitions, including competitor registration, race management, results recording, and comprehensive reporting. The current implementation uses Material-UI components with Tailwind CSS. This specification maintains all existing functionality while providing guidance for modernising the interface.

## Application Overview

### Purpose
A desktop application (Electron-based) for managing British Army ski racing competitions, handling everything from competitor registration through to final results and team scoring.

### Core User Workflows
1. **Competition Setup** - Create and configure competitions
2. **Competitor Management** - Register, edit, and manage competitors and teams
3. **Race Configuration** - Set up individual races with technical parameters
4. **Results Recording** - Enter race times and manage DNF/DSQ status
5. **Reporting** - Generate PDF reports for start lists, results, and seed lists

## Global UI Requirements

### Layout Structure
- **Application Frame**: Desktop application with native window controls
- **Navigation**: Persistent sidebar navigation (collapsible)
- **Content Area**: Main content area with consistent header/breadcrumb
- **Modals**: Overlay modals for quick data entry
- **Responsive**: Should work on various screen sizes (minimum 1024x768)

### Design Principles
- **Clarity**: Clear visual hierarchy and intuitive navigation
- **Efficiency**: Quick data entry with minimal clicks
- **Consistency**: Uniform patterns across all screens
- **Feedback**: Clear validation and success/error states
- **Accessibility**: Keyboard navigation and screen reader support

## Screen Specifications

### 1. Landing & Competition Management

#### 1.1 Landing Page (`/`)
**Purpose**: Entry point for selecting or creating competitions

**Layout Requirements**:
- Centered container with application branding/logo
- Dropdown selector for existing competitions
- Prominent "Create New Competition" button
- Optional: Recent competitions quick access

**Components**:
- Competition selector (dropdown/combobox)
- Primary action button
- Navigation button to selected competition

#### 1.2 Create Competition (`/new-competition`)
**Purpose**: Create new competition instances

**Layout Requirements**:
- Simple centered form
- Clear field labels and help text
- Cancel and Create action buttons

**Form Fields**:
- Competition Name (text input, required)
- Competition Description (textarea, optional)

#### 1.3 Competition Dashboard (`/competition/:id`)
**Purpose**: Main hub for competition management

**Layout Requirements**:
- Grid layout with 4 main action cards/tiles
- Competition name displayed prominently
- "Change Competition" button in header

**Action Cards**:
1. **Competitors** - Icon + label, click to manage
2. **Races** - Icon + label, click to manage
3. **Results** - Icon + label, click to view
4. **Seed List** - Icon + label, click to generate

### 2. Competitor Management

#### 2.1 Competitor Hub (`/competition/:id/competitor/manage`)
**Purpose**: Central navigation for competitor operations

**Layout Requirements**:
- Grid or list of action buttons/cards
- Back navigation to competition dashboard

**Actions**:
- Register Individual Competitor
- Bulk Upload Competitors
- Edit Competitors
- View All Competitors
- View Teams

#### 2.2 View Competitors (`/competition/:id/competitor/list`)
**Purpose**: Display and manage all registered competitors

**Table Requirements**:
- Sortable columns
- Pagination controls (10/25/50/100 rows)
- Search/filter capability
- Edit action per row

**Table Columns**:
- First Name
- Last Name
- Gender
- Rank/Title
- Team/Regiment
- Category (Junior/Senior/Veteran)
- Actions (Edit button)

#### 2.3 Register/Edit Competitor Form
**Purpose**: Add new or edit existing competitors

**Layout Requirements**:
- Multi-section form with logical grouping
- Clear section headers
- Responsive grid layout for fields

**Form Sections**:

**Personal Information**:
- First Name (required)
- Last Name (required)
- Title/Rank (dropdown)
- Date of Birth (date picker)
- Gender (radio/dropdown)
- Country (dropdown)
- Service Number (text)

**Competition Details**:
- Regiment/Team (autocomplete with "Add New" option)
- Army Seed Points (number)
- Corps Seed Points (number)

**Categories** (checkboxes):
- Novice
- Reservist
- Female (auto-set from gender)
- Age categories (auto-calculated):
  - Junior (Under 21)
  - Senior (21-35)
  - Veteran (Over 35)

#### 2.4 Bulk Upload (`/competition/:id/competitor/bulk`)
**Purpose**: Import multiple competitors via CSV

**Layout Requirements**:
- File upload area (drag & drop support)
- Preview table of uploaded data
- Validation messages
- Import progress indicator

**Features**:
- CSV template download link
- Column mapping interface
- Error highlighting in preview
- Success/failure summary

### 3. Race Management

#### 3.1 Race List (`/competition/:id/race`)
**Purpose**: View and manage all races in competition

**Table Requirements**:
- Sortable by date/type
- Clear status indicators
- Action buttons per row

**Table Columns**:
- Race Name
- Race Type (SL/GS/SG/DH/AC)
- Team Race (Yes/No indicator)
- Date
- Venue
- Number of Runs
- Actions (View, Results)

**Additional Elements**:
- "New Race" button (prominent)
- Filter by race type/status

#### 3.2 Create/Edit Race Form
**Purpose**: Configure race parameters

**Layout Requirements**:
- Tabbed or sectioned form
- Logical grouping of related fields
- Clear save/cancel actions

**Form Sections**:

**Basic Information**:
- Race Name (required)
- Race Type (dropdown: Slalom/Giant Slalom/Super G/Downhill/Alpine Combined)
- Race Date (date picker)
- Venue (text)
- Course Name (text)

**Race Configuration** (checkboxes):
- Individual Race
- Team Race
- Seeding Race
- Training Race
- Women Separate Start

**Technical Details**:
- Number of Runs (1 or 2)
- Start Altitude (number)
- Finish Altitude (number)
- Homologation Number (text)

**Conditions**:
- Start Temperature (number + °C)
- Finish Temperature (number + °C)
- Weather (dropdown/text)
- Snow Condition (dropdown/text)

**Officials** (autocomplete with "Add New Person" option):
- Chief of Race
- Technical Delegate
- Referee
- Assistant Referee

#### 3.3 Race Details (`/competition/:id/race/:raceId`)
**Purpose**: View race information and access race operations

**Layout Requirements**:
- Header with race name and key info
- Action button group
- Information display sections

**Action Buttons**:
- Generate/View Start List
- Manage Teams (if team race)
- Edit Race
- Record Results

**Information Display**:
- All race configuration data (read-only)
- Officials list
- Race statistics (if results recorded)

#### 3.4 Start List Generation (`/competition/:id/race/:raceId/start-list`)
**Purpose**: Generate and manage race start order

**Layout Requirements**:
- Current seed list display
- Start order configuration options
- Preview before generation
- PDF export button

**Features**:
- Automatic ordering by seed points
- Manual adjustment capability
- Bib number assignment
- Special handling for second runs (reverse order of top 30)

### 4. Results Recording

#### 4.1 Record Results (`/competition/:id/race/:raceId/results/edit`)
**Purpose**: Enter race times and status

**Layout Requirements**:
- Tabbed interface for multiple runs
- Sticky header with course info
- Scrollable results table
- Save progress indicator

**Tabs**:
- Run 1
- Run 2 (if applicable)
- Results (calculated)
- Team Results (if team race)

**Per Run Section**:

**Course Information**:
- Course Setter (autocomplete)
- Number of Gates (number)
- Turning Gates (number)
- Start Time (time picker)
- Forerunners 1-4 (autocomplete)

**Results Table**:
- Bib Number (read-only)
- Competitor Name (read-only)
- Time Entry (MM:SS.SS format)
- Status (dropdown: Finished/DNS/DNF/DSQ/NS)
- Gate (number, if DSQ)
- DSQ Reason (text, if DSQ)

**Features**:
- Auto-calculation of run differentials
- Keyboard navigation between time fields
- Bulk status update
- Auto-save functionality

### 5. Results Display

#### 5.1 Results Hub (`/competition/:id/results`)
**Purpose**: Navigate to different result views

**Layout Requirements**:
- Card/button grid for result types
- Clear icons and labels

**Options**:
- Individual Results
- Team Results
- Race Results

#### 5.2 Individual Results (`/competition/:id/results/individual`)
**Purpose**: Display overall individual standings

**Layout Requirements**:
- Multiple tables for categories
- PDF export buttons per table
- Summary statistics

**Tables** (each with Position, Rank, Name, Team, Points):
- Overall Results
- Female Results
- Junior Results (Under 21)
- Senior Results (21-35)
- Veteran Results (Over 35)
- Novice Results

#### 5.3 Team Results (`/competition/:id/results/team`)
**Purpose**: Display team standings

**Table Requirements**:
- Team rankings
- Member listings
- Points breakdown
- Category filters (Corps/Reserve/Female)

### 6. Seed List Management

#### 6.1 Generate Seed List (`/competition/:id/seed-list`)
**Purpose**: Calculate and display competitor seedings

**Layout Requirements**:
- Race selection interface
- Seed list calculation options
- Results table with export

**Features**:
- Select races to include
- View seed point calculations
- Handle penalties and special cases
- PDF export with timestamp

### 7. Team Management

#### 7.1 Team List (`/competition/:id/team/list`)
**Purpose**: View and manage teams

**Table Requirements**:
- Team name and member count
- Category indicators
- Edit actions

**Table Columns**:
- Team Name
- Number of Members
- Corps (Yes/No)
- Female (Yes/No)
- Reserve (Yes/No)
- HC/Non-competing (Yes/No)
- Actions (Edit)

#### 7.2 Team Modal (Create/Edit)
**Purpose**: Manage team composition

**Layout Requirements**:
- Team information fields
- Member selection interface
- Category checkboxes

**Fields**:
- Team Name (required)
- Team Categories (checkboxes):
  - Corps Team
  - Female Team
  - Reserve Team
  - HC (Non-competing)
- Member Selection:
  - Available competitors list
  - Selected members list
  - Add/Remove buttons
  - Member count display

## Component Specifications

### Reusable UI Components

#### Navigation Components
- **Sidebar**: Collapsible navigation with sections for Competitors and Races
- **Breadcrumb**: Path indicator showing current location
- **Back Button**: Consistent navigation to previous screen

#### Form Components
- **Text Input**: With label, validation, and error states
- **Number Input**: With increment/decrement controls
- **Date Picker**: Calendar interface
- **Time Picker**: For race times (MM:SS.SS format)
- **Dropdown/Select**: With search capability for long lists
- **Autocomplete**: With "Add New" option for persons
- **Checkbox**: For boolean flags
- **Radio Group**: For exclusive selections
- **File Upload**: With drag-and-drop support

#### Data Display Components
- **Data Table**: Sortable, paginated, with actions
- **Card**: For action items and summaries
- **Tab Container**: For multi-section interfaces
- **Modal Dialog**: For quick data entry
- **Alert/Toast**: For success/error feedback
- **Loading Spinner**: For async operations
- **Empty State**: When no data available

#### Action Components
- **Primary Button**: Main actions (Create, Save)
- **Secondary Button**: Alternative actions (Cancel, Back)
- **Icon Button**: For inline actions (Edit, Delete)
- **Floating Action Button**: For primary page actions
- **Button Group**: For related actions

### Modal Specifications

#### Person Modal
**Purpose**: Quick person creation from any autocomplete field

**Fields**:
- First Name (required)
- Last Name (required)
- Title/Rank (optional)
- Gender (optional)

#### Team Selection Modal
**Purpose**: Assign competitor to team

**Features**:
- List of available teams
- Create new team option
- Search/filter capability

## Data Tables Structure

### Standard Table Features
- **Sorting**: Click column headers to sort
- **Pagination**: Bottom controls with row count options
- **Selection**: Checkbox selection for bulk operations
- **Actions**: Row-level action buttons
- **Export**: PDF/CSV export options
- **Search**: Global or column-specific filtering
- **Responsive**: Horizontal scroll on small screens

### Table States
- **Loading**: Skeleton or spinner
- **Empty**: Helpful message and action
- **Error**: Error message with retry option
- **Filtered**: Show active filters with clear option

## Form Validation & Error Handling

### Validation Rules
- **Required Fields**: Marked with asterisk
- **Format Validation**: Times (MM:SS.SS), dates, numbers
- **Range Validation**: Seed points, temperatures
- **Unique Constraints**: Competition names, bib numbers
- **Cross-field Validation**: Start/finish times, age categories

### Error Display
- **Field-level**: Red border with error message below
- **Form-level**: Summary at top of form
- **Toast/Snackbar**: For save errors
- **Modal**: For critical errors

### Success Feedback
- **Toast/Snackbar**: Brief success message
- **Redirect**: To logical next screen
- **Visual Confirmation**: Green checkmark or highlight

## PDF Export Requirements

### Start Lists
- Competition header with logo
- Race information block
- Competitor table with bib numbers
- Officials section
- Footer with timestamp

### Results
- Competition and race header
- Category separation
- Results table with times/points
- DNS/DNF/DSQ notation
- Team results section (if applicable)

### Seed Lists
- Competition header
- Race inclusion list
- Seed points table
- Penalty indicators
- Generation timestamp

## Performance Considerations

### Data Loading
- **Pagination**: Load data in chunks
- **Lazy Loading**: Load tabs/sections on demand
- **Caching**: Cache competition/competitor data
- **Optimistic Updates**: Update UI before database

### UI Responsiveness
- **Debouncing**: Search and autocomplete inputs
- **Virtual Scrolling**: For long lists
- **Progressive Enhancement**: Core functionality first
- **Skeleton Screens**: While loading

## Accessibility Requirements

### Keyboard Navigation
- **Tab Order**: Logical flow through forms
- **Shortcuts**: Common actions (Save: Ctrl+S)
- **Focus Indicators**: Clear visual focus states
- **Skip Links**: Jump to main content

### Screen Reader Support
- **Semantic HTML**: Proper heading hierarchy
- **ARIA Labels**: For icons and actions
- **Form Labels**: Associated with inputs
- **Status Messages**: Announce changes

### Visual Accessibility
- **Colour Contrast**: WCAG AA compliance
- **Font Sizes**: Minimum 14px body text
- **Interactive Elements**: Minimum 44px touch targets
- **Error Indicators**: Not colour alone

## Technology Recommendations

### Modern UI Libraries to Consider
- **React-based**: Continue with React ecosystem
- **Component Libraries**:
  - Ant Design (comprehensive enterprise components)
  - Chakra UI (modern, accessible)
  - Mantine (feature-rich, modern design)
  - NextUI (modern, animated)
  - Radix UI (unstyled, accessible primitives)

### Styling Approaches
- **CSS-in-JS**: Emotion/Styled Components
- **Utility-first**: Tailwind CSS (already in use)
- **Component Styling**: CSS Modules

### State Management
- **React Context**: For global state
- **React Query/SWR**: For server state
- **Zustand/Jotai**: Lightweight state management

### Form Handling
- **React Hook Form**: Performant forms
- **Formik**: Comprehensive form solution
- **Native HTML5**: With custom validation

## Migration Considerations

### Preserve Functionality
- All existing features must be maintained
- Database schema remains unchanged
- IPC communication patterns preserved
- PDF generation compatibility

### Gradual Migration
- Component-by-component replacement
- Maintain backward compatibility
- Test each screen thoroughly
- Preserve keyboard shortcuts

### Data Migration
- No data structure changes
- Maintain SQLite integration
- Keep existing queries
- Preserve data validation rules

## Appendices

### A. Current Route Structure
```
/                                                 - Landing Page
/new-competition                                  - Create Competition
/competition/:id                                  - Competition Dashboard
/competition/:id/competitor/manage                - Competitor Hub
/competition/:id/competitor/list                  - View Competitors
/competition/:id/competitor/new                   - Register Competitor
/competition/:id/competitor/:competitorId/edit    - Edit Competitor
/competition/:id/competitor/bulk                  - Bulk Upload
/competition/:id/team/list                        - Team List
/competition/:id/race                             - Race List
/competition/:id/race/new                         - Create Race
/competition/:id/race/:raceId                     - Race Details
/competition/:id/race/:raceId/edit                - Edit Race
/competition/:id/race/:raceId/start-list          - Start List
/competition/:id/race/:raceId/teams               - Team Management
/competition/:id/race/:raceId/results             - View Results
/competition/:id/race/:raceId/results/edit        - Record Results
/competition/:id/results                          - Results Hub
/competition/:id/results/individual               - Individual Results
/competition/:id/results/team                     - Team Results
/competition/:id/seed-list                        - Generate Seed List
```

### B. Database Entities
- Competitions
- People (Competitors & Officials)
- Teams
- Races
- Race Results (Run 1 & Run 2)
- Seed Points
- Competition-Competitor Associations
- Competition-Team Associations

### C. Business Rules to Preserve
- Age category calculation from DOB
- Seed point calculation algorithms
- Second run start order (reverse top 30)
- Penalty point application
- Team scoring rules
- DNF/DNS/DSQ handling

---

*This specification provides a complete blueprint for modernising the UI while maintaining all existing functionality. The focus should be on improving user experience, visual consistency, and modern design patterns while preserving the robust functionality that already exists.*