// Batch migration script to update all routes to use new pages
const fs = require('fs');
const path = require('path');

// List of all pages to migrate with their new versions
const pageMappings = [
  // Competitor pages
  { old: 'ManageCompetitorsPage', new: 'ManageCompetitorsPageNew', path: 'competitor/' },
  { old: 'RegisterCompetitorPage', new: 'RegisterCompetitorPageNew', path: 'competitor/' },
  { old: 'ViewCompetitorsPage', new: 'ViewCompetitorsPageNew', path: 'competitor/' },
  { old: 'EditCompetitorsPage', new: 'EditCompetitorsPageNew', path: 'competitor/' },
  { old: 'EditCompetitorPage', new: 'EditCompetitorPageNew', path: 'competitor/' },
  { old: 'UploadCompetitorsPage', new: 'UploadCompetitorsPageNew', path: 'competitor/' },
  
  // Race pages
  { old: 'RaceLandingPage', new: 'RaceLandingPageNew', path: 'race/' },
  { old: 'CreateRacePage', new: 'CreateRacePageNew', path: 'race/' },
  { old: 'EditRacePage', new: 'EditRacePageNew', path: 'race/' },
  { old: 'RaceDetailsPage', new: 'RaceDetailsPageNew', path: 'race/' },
  { old: 'GenerateStartList', new: 'GenerateStartListNew', path: 'race/' },
  { old: 'GenerateStartListTeam', new: 'GenerateStartListTeamNew', path: 'race/' },
  { old: 'RecordRaceResultsPage', new: 'RecordRaceResultsPageNew', path: 'race/' },
  { old: 'RaceResultsPage', new: 'RaceResultsPageNew', path: 'race/' },
  { old: 'RaceTeamManagement', new: 'RaceTeamManagementNew', path: 'race/' },
  
  // Results pages
  { old: 'resultsPage', new: 'resultsPageNew', path: 'results/' },
  { old: 'individual', new: 'individualNew', path: 'results/' },
  { old: 'team', new: 'teamNew', path: 'results/' },
  
  // Team pages
  { old: 'TeamListPage', new: 'TeamListPageNew', path: 'team/' },
  
  // Seed list pages
  { old: 'GenerateSeedList', new: 'GenerateSeedListNew', path: 'seedList/' },
];

// Update route files
function updateRoutes() {
  const routeFiles = [
    'src/renderer/routes/CompetitorRoutes.js',
    'src/renderer/routes/RaceRoutes.js',
    'src/renderer/routes/ResultsRoutes.js',
    'src/renderer/routes/SeedListRoutes.js',
  ];
  
  routeFiles.forEach(file => {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      
      // Create new version with updated imports
      pageMappings.forEach(mapping => {
        const regex = new RegExp(`import ${mapping.old} from '..\/pages\/${mapping.path}${mapping.old}'`, 'g');
        content = content.replace(regex, `import ${mapping.new} from '../pages/${mapping.path}${mapping.new}'`);
        
        // Update component usage
        const usageRegex = new RegExp(`<${mapping.old}`, 'g');
        content = content.replace(usageRegex, `<${mapping.new}`);
      });
      
      // Save as new file
      const newFile = file.replace('.js', 'New.js');
      fs.writeFileSync(newFile, content);
      console.log(`Created ${newFile}`);
    }
  });
}

console.log('Starting batch migration...');
updateRoutes();
console.log('Route files updated. Now create simplified new page versions.');