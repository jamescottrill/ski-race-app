import pdfMake from 'pdfmake/build/pdfmake';
import { calculateCategory } from './CompetitorManagement';
import { getFormattedDate } from './DateUtils';
import { tableStyles } from './PdfStyles';
import { showSuccess } from './ErrorHandler';

// const { vfsFonts } = require('pdfmake/build/vfs_fonts');

// pdfMake.vfs = vfsFonts.pdfMake.vfs;

const secondRunStartListPdf = (raceDetails, startList) => {
  const docDefinition = {
    content: [
      { text: raceDetails.competition_name, style: 'header' },
      { text: raceDetails.competition_description, style: 'subheader' },
      { text: raceDetails.race_name, style: 'subheader' },
      { text: 'Start List', style: 'subheader' },
      {
        columns: [
          { width: 'auto', text: 'Venue: ' },
          { width: 'auto', text: raceDetails.venue },
          { width: '*', text: '' },
          { width: 'auto', text: raceDetails.race_date },
        ],
        columnGap: 10,
      },
      {
        columns: [
          { width: 'auto', text: 'Course Name: ' },
          { width: 'auto', text: raceDetails.course_name },
        ],
        columnGap: 10,
      },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', '*', 55, 'auto',],
          body: [
            [
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Bib No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
              { text: 'Class', style: 'tableHeader' },
            ],
            ...(startList || []).map((competitor, index) => [
              index + 1,
              competitor.bibNumber,
              competitor.title,
              `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
              competitor.team,
              calculateCategory(competitor),
            ]),
          ],
        },
      },
    ],
    styles: tableStyles,
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);

  // Use Electron's dialog to choose save location
  pdfDoc.getBuffer((buffer) => {
    const formattedDate = getFormattedDate();
    const raceName = raceDetails.race_name.replace(/[^a-zA-Z0-9]/g, '_');
    const defaultFileName = `${formattedDate}_START_LIST_${raceName.toUpperCase()}_RUN_2.pdf`;
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

export { secondRunStartListPdf };
