import * as pdfMake from 'pdfmake/build/pdfmake';
import { calculateCategory } from '../utils/CompetitorManagement';
import { getFormattedDate } from '../utils/DateUtils';
import { tableStyles } from '../utils/PdfStyles';
import { showSuccess } from '../utils/ErrorHandler';


const generatePDF = (seedList, races, title=null, hasInitialColumn=false) => {
  let pageTitle = title;
  if (!title) {
    pageTitle = 'Initial Seed List';
    if (races.length > 0) {
      pageTitle = `Seed List after ${races.length} Race${races.length > 1 ? 's' : ''}`;
    }
  }

  const tableColumns = (r, hasInitial) => {
    const base = [
      { text: 'Pos', style: 'tableHeader' },
      { text: 'Rank', style: 'tableHeader' },
      { text: 'Name', style: 'tableHeader' },
      { text: 'Team', style: 'tableHeader' },
      { text: 'Class', style: 'tableHeader' },
    ];
    // Add Initial column if no seeding race exists
    if (hasInitial) {
      base.push({ text: 'Initial', style: 'tableHeader' });
    }
    r.forEach((race) => {
      base.push({ text: race.text, style: 'tableHeader' });
    });
    base.push({ text: 'Overall Points', style: 'tableHeader' });
    return base;
  };

  const tableWidths = (r, hasInitial) => {
    const base = [15, 20, 'auto', 50, 20];
    // Add width for Initial column if present
    if (hasInitial) {
      base.push('auto');
    }
    r.forEach(() => {
      base.push('auto');
    });
    base.push('auto');
    return base;
  };

  const competitorRows = (competitors, r, hasInitial) => {
    const results = [];
    competitors.forEach((competitor) => {
      const output = [
        competitor.position,
        competitor.title,
        `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
        competitor.team_name,
        calculateCategory(competitor),
      ];
      // Add Initial value if column is present
      if (hasInitial) {
        output.push(
          competitor.initial != null
            ? Math.round(competitor.initial * 100, 2) / 100
            : '-',
        );
      }
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
      { text: pageTitle, style: 'header' },
      {
        style: 'table',
        layout: 'lightHorizontalLines',
        columnGap: 0,
        table: {
          headerRows: 1,
          widths: tableWidths(races, hasInitialColumn),
          body: [tableColumns(races, hasInitialColumn), ...competitorRows(seedList, races, hasInitialColumn)],
        },
      },
    ],
    styles: tableStyles,
    pageMargins: [10, 50, 10, 50],
  };
  const pdfDoc = pdfMake.createPdf(docDefinition);
  // Use Electron's dialog to choose save location
  pdfDoc.getBuffer((buffer) => {
    const formattedDate = getFormattedDate();
    const defaultFileName = title
      ? `${formattedDate}_${title.toUpperCase().replace(' ', '_')}.pdf`
      : `${formattedDate}_SEED_LIST_AFTER_${races.length}_RACES.pdf`;
    window.electronAPI
      .savePDF(buffer, defaultFileName)
      .then((r) => {
          if (r.success) {
            showSuccess(`PDF saved successfully to: ${r.filePath}`);
          } else {
            alert('PDF save cancelled.');
          }
        })
      .catch((err) => {
        console.error('Error saving PDF:', err);
      });
  });
};

export { generatePDF };
