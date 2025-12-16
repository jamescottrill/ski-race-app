import { tableStyles, teamTableLayout } from './PdfStyles';
import { getFormattedDate } from './DateUtils';
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
import {round} from './MathFx';
// pdfMake.vfs = pdfFonts.pdfMake.vfs;

pdfMake.tableLayouts = {
  teamLayout: teamTableLayout
};

const resultsTeamPdf = (raceDetails, finished, dsqTeams) => {
  const agg = [];
  finished.forEach((row, index) => {
    row.racers.forEach((racer, idx) => {
      const result = [];
      if (idx === 0) {
        result.push(row.position);
        result.push(row.time);
        result.push(row.teamName);
      } else {
        result.push(null);
        result.push(null);
        result.push(null);
      }
      result.push(racer.title);
      result.push(`${racer.lastName.toUpperCase()} ${racer.firstName}`);
      result.push(racer.run1Time);
      if (idx === 0) {
        result.push(round(row.points));
      } else {
        result.push(null);
      }
      agg.push(result);
    });
  });
  const docDefinition = {
    content: [
      { text: raceDetails.competition_name, style: 'header' },
      { text: raceDetails.competition_description, style: 'subheader' },
      { text: raceDetails.race_name, style: 'subheader' },
      { text: 'Official Results', style: 'subheader' },
      {
        layout: 'teamLayout',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Position', style: 'tableHeader' },
              { text: 'Total Time', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Individual Time', style: 'tableHeader' },
              { text: 'Points', style: 'tableHeader' },
            ],
            ...agg,
          ],
        },
      },
      { text: 'Disqualified Teams', style: 'subheader' },
    ],
    styles: tableStyles,
    pageMargins: [40, 50, 40, 50],
  };
  for (const team of dsqTeams) {
    docDefinition.content.push({ text: team.teamName, style: 'text' });
  }

  const pdfDoc = pdfMake.createPdf(docDefinition);

  // Use Electron's dialog to choose save location
  pdfDoc.getBuffer((buffer) => {
    const formattedDate = getFormattedDate();
    const raceName = raceDetails.race_name.replace(/[^a-zA-Z0-9]/g, '_'); // Replace non-alphanumeric characters with underscores
    const defaultFileName = `${formattedDate}_TEAM_RESULTS_${raceName.toUpperCase()}.pdf`;
    window.electronAPI
      .savePDF(buffer, defaultFileName)
      .then((filePath) => {
        if (filePath) {
          console.log('PDF saved successfully to:', filePath);
        } else {
          console.log('PDF save cancelled.');
        }
      })
      .catch((err) => {
        console.error('Error saving PDF:', err);
      });
  });
};

export { resultsTeamPdf };
