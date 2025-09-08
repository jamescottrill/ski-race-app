#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Template for simple navigation pages
const simplePageTemplate = (pageName, title, subtitle, navItems) => `import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function ${pageName}New() {
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  return (
    <PageContainer>
      <PageHeader
        title="${title}"
        subtitle="${subtitle}"
        actions={
          <Button
            variant="outline"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        }
      />
      
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-neutral-500">Page implementation in progress</p>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}`;

// Pages to migrate with basic template
const pagesToMigrate = [
  // Competitor pages
  {
    old: 'EditCompetitorsPage',
    path: 'src/renderer/pages/competitor/',
    title: 'Edit Competitors',
    subtitle: 'Manage competitor details'
  },
  {
    old: 'EditCompetitorPage', 
    path: 'src/renderer/pages/competitor/',
    title: 'Edit Competitor',
    subtitle: 'Update competitor information'
  },
  {
    old: 'UploadCompetitorsPage',
    path: 'src/renderer/pages/competitor/',
    title: 'Upload Competitors',
    subtitle: 'Bulk import from CSV'
  },
  
  // Race pages
  {
    old: 'CreateRacePage',
    path: 'src/renderer/pages/race/',
    title: 'Create Race',
    subtitle: 'Configure new race event'
  },
  {
    old: 'EditRacePage',
    path: 'src/renderer/pages/race/',
    title: 'Edit Race',
    subtitle: 'Update race configuration'
  },
  {
    old: 'RaceDetailsPage',
    path: 'src/renderer/pages/race/',
    title: 'Race Details',
    subtitle: 'View race information'
  },
  {
    old: 'GenerateStartList',
    path: 'src/renderer/pages/race/',
    title: 'Generate Start List',
    subtitle: 'Create race start order'
  },
  {
    old: 'GenerateStartListTeam',
    path: 'src/renderer/pages/race/',
    title: 'Team Start List',
    subtitle: 'Generate team race start order'
  },
  {
    old: 'RecordRaceResultsPage',
    path: 'src/renderer/pages/race/',
    title: 'Record Results',
    subtitle: 'Enter race times'
  },
  {
    old: 'RaceResultsPage',
    path: 'src/renderer/pages/race/',
    title: 'Race Results',
    subtitle: 'View race outcomes'
  },
  {
    old: 'RaceTeamManagement',
    path: 'src/renderer/pages/race/',
    title: 'Team Management',
    subtitle: 'Manage race teams'
  },
  
  // Results pages
  {
    old: 'individual',
    path: 'src/renderer/pages/results/',
    title: 'Individual Results',
    subtitle: 'View individual standings'
  },
  
  // Team pages
  {
    old: 'TeamListPage',
    path: 'src/renderer/pages/team/',
    title: 'Teams',
    subtitle: 'View all teams'
  }
];

// Create new page files
pagesToMigrate.forEach(page => {
  const newFileName = page.old + 'New.js';
  const filePath = path.join(page.path, newFileName);
  const content = simplePageTemplate(page.old, page.title, page.subtitle);
  
  fs.writeFileSync(filePath, content);
  console.log(`Created ${filePath}`);
});

// Update route files
const routeFiles = [
  'src/renderer/routes/CompetitorRoutes.js',
  'src/renderer/routes/RaceRoutes.js',
  'src/renderer/routes/ResultsRoutes.js',
  'src/renderer/routes/TeamRoutes.js'
];

routeFiles.forEach(routeFile => {
  if (fs.existsSync(routeFile)) {
    let content = fs.readFileSync(routeFile, 'utf8');
    
    // Update imports and component usage
    pagesToMigrate.forEach(page => {
      // Check if this page belongs to this route file
      if (routeFile.toLowerCase().includes(page.path.split('/')[3])) {
        // Update import
        const importRegex = new RegExp(`import ${page.old} from '.*${page.old}'`, 'g');
        const newImport = `import ${page.old}New from '../pages/${page.path.replace('src/renderer/pages/', '')}${page.old}New'`;
        content = content.replace(importRegex, newImport);
        
        // Update component usage
        const usageRegex = new RegExp(`<${page.old}`, 'g');
        content = content.replace(usageRegex, `<${page.old}New`);
        
        const elementRegex = new RegExp(`element={${page.old}}`, 'g');
        content = content.replace(elementRegex, `element={${page.old}New}`);
      }
    });
    
    // Write updated route file
    const newRouteFile = routeFile.replace('.js', 'New.js');
    fs.writeFileSync(newRouteFile, content);
    console.log(`Updated ${newRouteFile}`);
  }
});

console.log('Batch migration complete!');