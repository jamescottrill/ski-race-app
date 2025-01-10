import pdfMake from 'pdfmake/build/pdfmake';

const generateSeedList = (seedList) => {
  const docDefinition = {
    content: [
      { text: 'Seed List', style: 'header' },
      {
        table: {
          headerRows: 1,
          widths: [20, 40, '*', 'auto', 'auto'],
          body: [
            [
              { text: 'Position', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
              { text: 'Points', style: 'tableHeader' },
            ],
            ...(seedList || []).map((competitor, index) => [
              index + 1,
              competitor.title,
              `${competitor.first_name} ${competitor.last_name}`,
              competitor.team_name,
              competitor.seed_points,
            ]),
          ],
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

export { generateSeedList };
