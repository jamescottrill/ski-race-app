# Pages Remaining to Migrate

## Migration Status Overview

### ✅ Already Migrated (3 pages)
1. **Landing Page** → `landingPageNew.js`
2. **Competition Management** → `competitionManagementPageNew.js`  
3. **Create Competition** → `createCompetitionNew.js`

### 📋 Pages Still Using Material-UI (20 pages)

## Priority 1: Competitor Management (6 pages)
Critical for competition setup and athlete registration.

1. **ManageCompetitorsPage** (`/competitor/manage`)
   - Hub page with navigation buttons
   - Simple to migrate - just buttons and layout

2. **RegisterCompetitorPage** (`/competitor/new`) ⭐
   - Complex form with autocomplete
   - Uses CompetitorForm component
   - High user interaction

3. **ViewCompetitorsPage** (`/competitor/list`) ⭐
   - Large data table with pagination
   - Edit actions per row
   - Search/filter functionality

4. **EditCompetitorsPage** (`/competitor/edit`)
   - Bulk edit interface
   - Table with inline editing

5. **EditCompetitorPage** (`/competitor/:id/edit`)
   - Individual competitor edit form
   - Similar to RegisterCompetitor

6. **UploadCompetitorsPage** (`/competitor/bulk`)
   - CSV file upload
   - Preview table
   - Validation display

## Priority 2: Race Management (8 pages)
Core functionality for race configuration and results.

7. **RaceLandingPage** (`/race`) ⭐
   - List of all races
   - Table with actions
   - New race button

8. **CreateRacePage** (`/race/new`) ⭐
   - Complex multi-section form
   - Race configuration
   - Officials assignment

9. **EditRacePage** (`/race/:id/edit`)
   - Same as CreateRace but edit mode
   - Pre-filled form data

10. **RaceDetailsPage** (`/race/:id`)
    - Read-only race information
    - Action buttons for operations

11. **GenerateStartList** (`/race/:id/start-list`) ⭐
    - Start order configuration
    - Bib number assignment
    - PDF generation

12. **GenerateStartListTeam** (team variant)
    - Team-specific start list
    - Similar to above

13. **RecordRaceResultsPage** (`/race/:id/results/edit`) ⭐
    - Critical time entry interface
    - Tabbed for multiple runs
    - Complex data entry

14. **RaceResultsPage** (`/race/:id/results`)
    - Display race results
    - Export functionality

15. **RaceTeamManagement** (`/race/:id/teams`)
    - Team assignment for races
    - Drag-drop interface

## Priority 3: Results & Reporting (3 pages)
Display and export competition results.

16. **ResultsPage** (`/results`)
    - Navigation hub for results
    - Simple button layout

17. **Individual Results** (`/results/individual`)
    - Competition-wide individual standings
    - Multiple category tables
    - PDF export

18. **Team Results** (`/results/team`)
    - Team standings and scoring
    - Category filtering
    - PDF export

## Priority 4: Other Pages (2 pages)

19. **TeamListPage** (`/team/list`)
    - Team management interface
    - Create/edit teams
    - Member assignment

20. **GenerateSeedList** (`/seed-list/generate`)
    - Seed list calculation
    - Race selection
    - PDF generation

## Migration Complexity Analysis

### 🟢 Simple (Quick wins - 1-2 hours each)
- ManageCompetitorsPage (hub with buttons)
- ResultsPage (navigation hub)
- RaceDetailsPage (read-only display)

### 🟡 Medium (3-4 hours each)
- RaceLandingPage (table with actions)
- ViewCompetitorsPage (data table)
- TeamListPage (team management)
- Individual/Team Results (multiple tables)

### 🔴 Complex (4-6 hours each)
- RegisterCompetitorPage (complex form)
- CreateRacePage (multi-section form)
- RecordRaceResultsPage (time entry interface)
- GenerateStartList (configuration UI)
- UploadCompetitorsPage (file upload)

## Recommended Migration Order

### Phase 4a: Quick Wins (1 day)
1. ManageCompetitorsPage
2. ResultsPage  
3. RaceDetailsPage
4. RaceLandingPage

### Phase 4b: Core Forms (2 days)
5. RegisterCompetitorPage
6. CreateRacePage
7. EditRacePage
8. EditCompetitorPage

### Phase 4c: Data Tables (2 days)
9. ViewCompetitorsPage
10. RecordRaceResultsPage
11. Individual Results
12. Team Results

### Phase 4d: Advanced Features (2 days)
13. GenerateStartList
14. UploadCompetitorsPage
15. TeamListPage
16. RaceTeamManagement

### Phase 4e: Final Pages (1 day)
17. EditCompetitorsPage
18. RaceResultsPage
19. GenerateSeedList
20. GenerateStartListTeam

## Components Still Using Material-UI

### High Usage Components
- **CompetitorForm** - Used in multiple pages
- **RaceForm** - Used in create/edit race
- **ResultTable** - Used in results display
- **PersonModal** - Quick person creation
- **TeamModal** - Team creation/edit

### These Need Migration First
Before migrating pages that use them, these shared components should be converted to the new design system.

## Summary

- **Total Pages**: 23
- **Migrated**: 3 (13%)
- **Remaining**: 20 (87%)
- **Estimated Time**: 8-10 days for complete migration

## Next Steps

1. **Start with Quick Wins**: Get 4 simple pages done quickly for momentum
2. **Migrate Shared Components**: Convert CompetitorForm and RaceForm
3. **Focus on User Journey**: Prioritize pages in the main workflow
4. **Test as You Go**: Ensure each migration maintains functionality