import { calculateCategory } from './CompetitorManagement';
import { getFormattedDate } from './DateUtils';
import { tableStyles, dnfTable, dsqTable } from './PdfStyles';

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
  const runDetailsSection = [
    {
      columns: [
        { width: 'auto', text: 'Venue: ' },
        { width: '*', text: raceDetails.venue },
        { width: 'auto', text: 'Date: ' },
        { width: '*', text: new Date(raceDetails.race_date).toLocaleString('default', { day: "numeric", month: 'long', year: "numeric" }) },
      ],
      columnGap: 10,
    },
    {
      columns: [
        { width: 'auto', text: 'Course Name: ' },
        { width: 'auto', text: raceDetails.course_name },
      ],
      columnGap: 10,
      margin: [0, 0, 0, 10],
    },
    {
      columns: [
        { width: '*', text: 'Jury', style: 'subheader' },
        { width: '*', text: 'Technical Data', style: 'subheader' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100,  text: 'TD: ', style: 'key' },
        { width: '*', text: raceDetails.tech_delegate.trim() || 'N/A', style: 'text' },
        { width: 120, text: 'Start Height (m): ', style: 'key' },
        { width: '*', text: raceDetails.start_altitude, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Referee: ', style: 'key' },
        { width: '*', text: raceDetails.referee.trim() || 'N/A', style: 'text' },
        { width: 120, text: 'Finish Height (m): ', style: 'key' },
        { width: '*', text: raceDetails.finish_altitude, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Assistant Referee: ', style: 'key' },
        { width: '*', text: raceDetails.asst_referee.trim() || 'N/A', style: 'text' },
        { width: 120, text: 'Vertical Difference (m): ', style: 'key' },
        { width: '*', text: raceDetails.altitude_difference, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Chief of Race: ', style: 'key' },
        { width: '*', text: raceDetails.chief_of_race.trim()  || 'N/A', style: 'text' },
        { width: 120, text: 'Homologation: ', style: 'key' },
        { width: '*', text: raceDetails.homologation, style: 'text' },
      ],
      columnGap: 5,
      margin: [0, 0, 0, 20],
    },
    {
      columns: [
        { width: '*', text: 'First Run', style: 'subheader' },
        { width: '*', text: 'Second run', style: 'subheader' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Course Setter: ', style: 'key' },
        { width: '*', text: raceDetails.course_setter_1, style: 'text' },
        { width: '*', text: raceDetails.course_setter_2, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Number of Gates: ', style: 'key' },
        { width: '*', text: raceDetails.run1_number_gates , style: 'text' },
        { width: '*', text: raceDetails.run2_number_gates, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Turning Gates: ', style: 'key' },
        { width: '*', text: raceDetails.run1_turning_gates , style: 'text' },
        { width: '*', text: raceDetails.run2_turning_gates, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Start Time: ', style: 'key' },
        { width: '*', text: raceDetails.run1_start_time, style: 'text' },
        { width: '*', text: raceDetails.run2_start_time, style: 'text' },
      ],
      columnGap: 5,
      margin: [0, 0, 0, 20],
    },
    {
      columns: [
        { width: 100, text: 'Forerunners: ', style: 'key' },
        { width: 10, text: 'A: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_a.trim() , style: 'text' },
        { width: 10, text: 'A: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_2_a.trim(), style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: '', style: 'key' },
        { width: 10, text: 'B: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_b.trim() , style: 'text' },
        { width: 10, text: 'B: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_2_b.trim(), style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: '', style: 'key' },
        { width: 10, text: 'C: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_c.trim() , style: 'text' },
        { width: 10, text: 'C: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_2_c.trim(), style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: '', style: 'key' },
        { width: 10, text: 'D: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_d.trim() , style: 'text' },
        { width: 10, text: 'D: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_2_d.trim(), style: 'text' },
      ],
      columnGap: 5,
      margin: [0, 0, 0, 20],
    },
    {
      columns: [
        { width: 'auto', text: 'Weather: ', style: 'key' },
        { width: 'auto', text: raceDetails.weather, style: 'text' },
        { width: 'auto', text: 'Snow: ', style: 'key' },
        { width: 'auto', text: raceDetails.snow, style: 'text' },
        { width: 'auto', text: 'Temperature: ', style: 'key' },
        { width: 'auto', text: 'Start: ', style: 'key' },
        { width: 'auto', text: raceDetails.temp_start, style: 'text' },
        { width: 'auto', text: 'Finish: ', style: 'key' },
        { width: 'auto', text: raceDetails.temp_finish, style: 'text' },
      ],
      columnGap: 10,
    },
  ];

  const content = [
    ...header,
    // ...runDetailsSection,
    ...runDetailsSection,
    // Results
    {
      layout: 'lightHorizontalLines',
      style: 'table',
      table: {
        headerRows: 1,
        widths: [
          20,
          20,
          30,
          '*',
          55,
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
      dnfTable(dns1),
    );
  }

  // DNF 1
  if (dnf1.length > 0) {
    content.push(
      { text: 'Did Not Finish 1st Run', style: 'subheaderLeft' },
      dnfTable(dnf1),
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
      dnfTable(dns2),
    );
  }

  // DNF 2
  if (dnf2.length > 0) {
    content.push(
      { text: 'Did Not Finish 2nd Run', style: 'subheaderLeft' },
      dnfTable(dnf2),
    );
  }

  // DSQ 2
  if (dsq2.length > 0) {
    content.push(
      { text: 'Disqualified 2nd Run', style: 'subheaderLeft' },
      dsqTable(dsq2),
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
