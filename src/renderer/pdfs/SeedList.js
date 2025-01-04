import * as pdfMake from 'pdfmake/build/pdfmake';
import { calculateCategory } from '../utils/CompetitorManagement';
import { getFormattedDate } from '../utils/DateUtils';
import { tableStyles } from '../utils/PdfStyles';


const generatePDF = (seedList, races) => {
  let title = 'Initial Seed List';
  if (races.length > 0) {
    title = `Seed List after ${races.length} Race${races.length > 1 ? 's' : ''}`;
  }

  const tableColumns = (r) => {
    const base = [
      { text: 'Pos', style: 'tableHeader' },
      { text: 'Rank', style: 'tableHeader' },
      { text: 'Name', style: 'tableHeader' },
      { text: 'Team', style: 'tableHeader' },
      { text: 'Class', style: 'tableHeader' },
    ];
    r.forEach((race) => {
      base.push({ text: race.text, style: 'tableHeader' });
    });
    base.push({ text: 'Overall Points', style: 'tableHeader' });
    return base;
  };

  const tableWidths = (r) => {
    const base = [25, 30, 'auto', 80, 30];
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
        style: 'table',
        layout: 'lightHorizontalLines',
        table: {
          headerRows: 1,
          widths: tableWidths(races),
          body: [tableColumns(races), ...competitorRows(seedList, races)],
        },
      },
    ],
    styles: tableStyles,
  };
  const pdfDoc = pdfMake.createPdf(docDefinition);
  // Use Electron's dialog to choose save location
  pdfDoc.getBuffer((buffer) => {
    const formattedDate = getFormattedDate();
    const defaultFileName = `${formattedDate}_SEED_LIST_AFTER_${races.length}_RACES.pdf`;
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

export { generatePDF };
