import pdfMake from 'pdfmake/build/pdfmake';
// const { vfsFonts } = require('pdfmake/build/vfs_fonts');
import { calculateCategory } from './CompetitorManagement';

// pdfMake.vfs = vfsFonts.pdfMake.vfs;

const startListPdf = (raceDetails, finished, dns1, dnf1, dsq1, dns2, dnf2, dsq2) => {

  const docDefinition = {
    content: [
      { text: raceDetails.competition_name, style: 'header' },
      { text: raceDetails.competition_description, style: 'subheader' },
      { text: raceDetails.race_name, style: 'subheader' },
      { text: 'Official Results', style: 'subheader' },
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
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*', 'auto'],
          body: [
            [
              { text: 'Position', style: 'tableHeader' },
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
              { text: 'Class', style: 'tableHeader' },
              { text: 'Time 1st Run', style: 'tableHeader' },
              { text: 'Time 2nd Run', style: 'tableHeader' },
              { text: 'Total Time', style: 'tableHeader' },
              { text: 'Race Points', style: 'tableHeader' },
            ],
            ...(finished || []).map((competitor, index) => [
              competitor.position,
              competitor.bibNumber,
              competitor.title,
              `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
              competitor.team,
              calculateCategory(competitor),
              competitor.run1Time,
              competitor.run2Time,
              competitor.totalTime,
              competitor.seedPoints,
            ]),
          ],
          layout: 'lightHorizontalLines',
        },
      },
      // DNS 1
      { text: 'Did not start 1st run', style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*', 'auto'],
          body: [
            [
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
            ],
            ...(dns1 || []).map((competitor) => [
              competitor.bibNumber,
              competitor.title,
              `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
              competitor.team,
            ]),
          ],
          layout: 'lightHorizontalLines',
        },
      },
      // DNF 1
      { text: 'Did not finish 1st run', style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*', 'auto'],
          body: [
            [
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
            ],
            ...(dnf1 || []).map((competitor) => [
              competitor.bibNumber,
              competitor.title,
              `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
              competitor.team,
            ]),
          ],
          layout: 'lightHorizontalLines',
        },
      },
      // DSQ 1
      { text: 'Disqualified 1st run', style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*', 'auto'],
          body: [
            [
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
              { text: 'Gate No', style: 'tableHeader' },
            ],
            ...(dsq1 || []).map((competitor) => [
              competitor.bibNumber,
              competitor.title,
              `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
              competitor.team,
              competitor.run1DsqGate,
            ]),
          ],
          layout: 'lightHorizontalLines',
        },
      },
      // DNS 2
      { text: 'Did not start 2nd run', style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*', 'auto'],
          body: [
            [
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
            ],
            ...(dns2 || []).map((competitor) => [
              competitor.bibNumber,
              competitor.title,
              `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
              competitor.team,
            ]),
          ],
          layout: 'lightHorizontalLines',
        },
      },
      // DNF 2
      { text: 'Did not finish 2nd run', style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*', 'auto'],
          body: [
            [
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
            ],
            ...(dnf2 || []).map((competitor) => [
              competitor.bibNumber,
              competitor.title,
              `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
              competitor.team,
            ]),
          ],
          layout: 'lightHorizontalLines',
        },
      },
      // DSQ 2
      { text: 'Disqualified 2nd run', style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*', 'auto'],
          body: [
            [
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
              { text: 'Gate No.', style: 'tableHeader' },
            ],
            ...(dsq1 || []).map((competitor) => [
              competitor.bibNumber,
              competitor.title,
              `${competitor.last_name.toUpperCase()} ${competitor.first_name}`,
              competitor.team,
              competitor.run2DsqGate,
            ]),
          ],
          layout: 'lightHorizontalLines',
        },
      },
    ],
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5], alignment: 'center' },
      subheader: { fontSize: 15, bold: true, margin: [0, 0, 0, 5], alignment: 'center' },
      title: { fontSize: 14, bold: true, margin: [0, 0, 0, 5], alignment: 'center' },
      section: { fontSize: 12, bold: true, margin: [0, 0, 0, 5], alignment: 'center' },
      text: { fontSize: 10, margin: [0, 2, 0, 2] },
      tableHeader: {
        bold: true,
      },
    },
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);

  // Use Electron's dialog to choose save location
  pdfDoc.getBuffer((buffer) => {
    window.electronAPI
      .savePDF(buffer)
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

export { startListPdf };
