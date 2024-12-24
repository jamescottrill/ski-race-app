import * as pdfMake from 'pdfmake/build/pdfmake';
import { calculateCategory } from '../utils/CompetitorManagement';


const generatePDF = (seedList, races) => {
  let title = 'Initial Seed List';
  if (races.length > 0) {
    title = `Seed List after ${races.length} Race${races.length > 1 ? 's' : ''}`;
  }

  const tableColumns = (r) => {
    const base = [
      { text: 'Position', style: 'tableHeader' },
      { text: 'Rank', style: 'tableHeader' },
      { text: 'Name', style: 'tableHeader' },
      { text: 'Team', style: 'tableHeader' },
      { text: 'Competitor', style: 'tableHeader' },
    ];
    r.forEach((race) => {
      base.push({ text: race.text, style: 'tableHeader' });
    });
    base.push({ text: 'Overall Seed Points', style: 'tableHeader' });
    return base;
  };

  const tableWidths = (r) => {
    const base = ['auto', 'auto', 'auto', 'auto', 'auto'];
    r.forEach(() => {
      base.push('auto');
    });
    base.push('auto');
    return base;
  };

  const competitorRows = (competitors, r) => {
    const results = [];
    competitors.forEach((competitor) => {
      const output = [
        competitor.position,
        competitor.title,
        `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
        competitor.team_name,
        calculateCategory(competitor),
      ];
      r.forEach((race) => {
        output.push(competitor[race.id]);
      });
      output.push(competitor.seed_points);
      results.push(output);
    });
    return results;
  };

  const docDefinition = {
    content: [
      { text: title, style: 'header' },
      {
        table: {
          headerRows: 1,
          widths: tableWidths(races),
          body: [tableColumns(races), ...competitorRows(seedList, races)],
        },
      },
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 20],
      },
      tableHeader: {
        bold: true,
      },
    },
  };
  const pdfDoc = pdfMake.createPdf(docDefinition);
  // Use Electron's dialog to choose save location
  pdfDoc.getBuffer((buffer) => {
    window.electronAPI
      .savePDF(buffer, 'Test')
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

export { generatePDF };
