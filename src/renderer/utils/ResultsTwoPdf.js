import { calculateCategory } from './CompetitorManagement';
import { getFormattedDate } from './DateUtils';
import { tableStyles} from './PdfStyles';

const resultsTwoPdf = (
  raceDetails,
  finished,
  dns1,
  dnf1,
  dsq1,
  dns2,
  dnf2,
  dsq2,
) => {
  const header = [
    { text: raceDetails.competition_name, style: 'header' },
    { text: raceDetails.competition_description, style: 'subheader' },
    { text: raceDetails.race_name, style: 'subheader' },
    { text: 'Official Results', style: 'subheader' },
  ];

  // const runDetailsSection = [
  //   { text: 'First Run', style: 'subheaderLeft' },
  //   {
  //     columns: [
  //       { text: 'Course Setter: ', bold: true },
  //       { text: raceDetails.firstRun.courseSetter },
  //       { text: 'Number of Gates: ', bold: true },
  //       { text: raceDetails.firstRun.numberOfGates },
  //       { text: 'Start Time: ', bold: true },
  //       { text: raceDetails.firstRun.startTime },
  //     ],
  //   },
  //   { text: 'Second Run', style: 'subheaderLeft', margin: [0, 10, 0, 0] },
  //   {
  //     columns: [
  //       { text: 'Course Setter: ', bold: true },
  //       { text: raceDetails.secondRun.courseSetter },
  //       { text: 'Number of Gates: ', bold: true },
  //       { text: raceDetails.secondRun.numberOfGates },
  //       { text: 'Start Time: ', bold: true },
  //       { text: raceDetails.secondRun.startTime },
  //     ],
  //   },
  // ];

  const content = [
    ...header,
    // ...runDetailsSection,
    {
      columns: [
        { width: 'auto', text: 'Venue: ' },
        { width: 'auto', text: raceDetails.venue },
        { width: 'auto', text: 'Date: ' },
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
      columns: [
        { width: 'auto', text: 'Weather: ' },
        { width: 'auto', text: raceDetails.weather },
        { width: 'auto', text: 'Snow: ' },
        { width: 'auto', text: raceDetails.snow },
        { width: 'auto', text: 'Temperature: ' },
        { width: 'auto', text: 'Start: ' },
        { width: 'auto', text: raceDetails.temp_start },
        { width: 'auto', text: 'Finish: ' },
        { width: 'auto', text: raceDetails.temp_finish },
      ],
      columnGap: 10,
    },
    // Results
    {
      layout: 'lightHorizontalLines',
      style: 'table',
      table: {
        headerRows: 1,
        widths: [
          'auto',
          'auto',
          'auto',
          'auto',
          'auto',
          'auto',
          'auto',
          'auto',
          'auto',
          'auto',
        ],
        body: [
          [
            { text: 'Pos', style: 'tableHeader' },
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
          ...(finished || []).map((competitor) => [
            competitor.position,
            competitor.bibNumber,
            competitor.title,
            `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
            competitor.team,
            calculateCategory(competitor),
            competitor.run1Time,
            competitor.run2Time,
            competitor.totalTime,
            competitor.seedPoints,
          ]),
        ],
      },
    },
  ];

  // DNS 1
  if (dns1.length > 0) {
    content.push(
      { text: 'Did Not Start 1st Run', style: 'subheaderLeft' },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', 'auto'],
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
              `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
              competitor.team,
            ]),
          ],
        },
      },
    );
  }

  // DNF 1
  if (dnf1.length > 0) {
    content.push(
      { text: 'Did Not Finish 1st Run', style: 'subheaderLeft' },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', 'auto'],
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
              `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
              competitor.team,
            ]),
          ],
        },
      },
    );
  }

  // DSQ 1
  if (dsq1.length > 0) {
    content.push(
      { text: 'Disqualified 1st Run', style: 'subheaderLeft' },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', 'auto', 'auto'],
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
              `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
              competitor.team,
              competitor.run1DsqGate,
            ]),
          ],
        },
      },
    );
  }

  // DNS 2
  if (dns2.length > 0) {
    content.push(
      { text: 'Did Not Start 2nd Run', style: 'subheaderLeft' },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', 'auto'],
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
              `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
              competitor.team,
            ]),
          ],
        },
      },
    );
  }

  // DNF 2
  if (dnf2.length > 0) {
    content.push(
      { text: 'Did Not Finish 2nd Run', style: 'subheaderLeft' },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', 'auto'],
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
              `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
              competitor.team,
            ]),
          ],
        },
      },
    );
  }

  // DSQ 2
  if (dsq2.length > 0) {
    content.push(
      { text: 'Disqualified 2nd Run', style: 'subheaderLeft' },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
              { text: 'Gate No.', style: 'tableHeader' },
            ],
            ...(dsq2 || []).map((competitor) => [
              competitor.bibNumber,
              competitor.title,
              `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
              competitor.team,
              competitor.run2DsqGate,
            ]),
          ],
        },
      },
    );
  }

  // Create the PDF document
  const docDefinition = {
    content,
    styles: tableStyles,
    pageMargins: [40, 50, 40, 50],
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);



  // Save the PDF
  pdfDoc.getBuffer((buffer) => {
    const formattedDate = getFormattedDate();
    const raceName = raceDetails.race_name.replace(/[^a-zA-Z0-9]/g, '_'); // Replace non-alphanumeric characters with underscores
    const defaultFileName = `${formattedDate}_RESULTS_${raceName.toUpperCase()}.pdf`;
    window.electronAPI
      .savePDF(buffer, defaultFileName)
      .then((filePath) => {
        if (filePath) {
          alert(`PDF saved successfully to: ${filePath}`);
        } else {
          alert('PDF save cancelled.');
        }
      })
      .catch((err) => {
        console.error('Error saving PDF:', err);
      });
  });
};

export { resultsTwoPdf };
