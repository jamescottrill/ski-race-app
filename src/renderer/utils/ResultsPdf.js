import pdfMake from 'pdfmake/build/pdfmake';
// const { vfsFonts } = require('pdfmake/build/vfs_fonts');
import { calculateCategory } from './CompetitorManagement';
import { tableStyles } from './PdfStyles';
import { getFormattedDate } from './DateUtils';
import { handlePdfError, showSuccess } from './ErrorHandler';

// pdfMake.vfs = vfsFonts.pdfMake.vfs;

const resultsPdf = (raceDetails, finished, dns1, dnf1, dsq1) => {
  try {
  const runDetailsSection = [
    {
      columns: [
        { width: 'auto', text: 'Venue: ' },
        { width: '*', text: raceDetails.venue },
        { width: 'auto', text: 'Date: ' },
        {
          width: '*',
          text: new Date(raceDetails.race_date).toLocaleString('default', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
        },
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
        { width: 100, text: 'TD: ', style: 'key' },
        {
          width: '*',
          text: raceDetails.tech_delegate.trim() || 'N/A',
          style: 'text',
        },
        { width: 120, text: 'Start Height (m): ', style: 'key' },
        { width: '*', text: raceDetails.start_altitude, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Referee: ', style: 'key' },
        {
          width: '*',
          text: raceDetails.referee.trim() || 'N/A',
          style: 'text',
        },
        { width: 120, text: 'Finish Height (m): ', style: 'key' },
        { width: '*', text: raceDetails.finish_altitude, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Assistant Referee: ', style: 'key' },
        {
          width: '*',
          text: raceDetails.asst_referee.trim() || 'N/A',
          style: 'text',
        },
        { width: 120, text: 'Vertical Difference (m): ', style: 'key' },
        { width: '*', text: raceDetails.altitude_difference, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Chief of Race: ', style: 'key' },
        {
          width: '*',
          text: raceDetails.chief_of_race.trim() || 'N/A',
          style: 'text',
        },
        { width: 120, text: 'Homologation: ', style: 'key' },
        { width: '*', text: raceDetails.homologation, style: 'text' },
      ],
      columnGap: 5,
      margin: [0, 0, 0, 20],
    },
    {
      columns: [{ width: '*', text: 'First Run', style: 'subheader' }],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Course Setter: ', style: 'key' },
        {
          width: '*',
          text: raceDetails.course_setter_1 || 'TBC',
          style: 'text',
        },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Number of Gates: ', style: 'key' },
        {
          width: '*',
          text: raceDetails.run1_number_gates || 'TBC',
          style: 'text',
        },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Turning Gates: ', style: 'key' },
        {
          width: '*',
          text: raceDetails.run1_turning_gates || 'TBC',
          style: 'text',
        },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: 'Start Time: ', style: 'key' },
        {
          width: '*',
          text: raceDetails.run1_start_time || 'TBC',
          style: 'text',
        },
      ],
      columnGap: 5,
      margin: [0, 0, 0, 20],
    },
    {
      columns: [
        { width: 100, text: 'Forerunners: ', style: 'key' },
        { width: 10, text: 'A: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_a.trim(), style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: '', style: 'key' },
        { width: 10, text: 'B: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_b.trim(), style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: '', style: 'key' },
        { width: 10, text: 'C: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_c.trim(), style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: '', style: 'key' },
        { width: 10, text: 'D: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_d.trim(), style: 'text' },
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
  const docDefinition = {
    content: [
      { text: raceDetails.competition_name, style: 'header' },
      { text: raceDetails.competition_description, style: 'subheader' },
      { text: raceDetails.race_name, style: 'subheader' },
      { text: 'Official Results', style: 'subheader' },
      ...runDetailsSection,
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
          ],
          body: [
            [
              { text: 'Position', style: 'tableHeader' },
              { text: 'Start No', style: 'tableHeader' },
              { text: 'Rank', style: 'tableHeader' },
              { text: 'Name', style: 'tableHeader' },
              { text: 'Team', style: 'tableHeader' },
              { text: 'Class', style: 'tableHeader' },
              { text: 'Time', style: 'tableHeader' },
              { text: 'Race Points', style: 'tableHeader' },
            ],
            ...(finished || []).map((competitor, index) => [
              competitor.position,
              competitor.bibNumber,
              competitor.title,
              `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
              competitor.team,
              calculateCategory(competitor),
              competitor.run1Time,
              competitor.seedPoints,
            ]),
          ],
        },
      },
      // DNS 1
      { text: 'Did not start 1st run', style: 'subheader' },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*'],
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
      // DNF 1
      { text: 'Did not finish 1st run', style: 'subheader' },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', '*'],
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
      // DSQ 1
      { text: 'Disqualified 1st run', style: 'subheader' },
      {
        layout: 'lightHorizontalLines',
        style: 'table',
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
              `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
              competitor.team,
              competitor.run1DsqGate,
            ]),
          ],
        },
      },
    ],
    styles: tableStyles,
    pageMargins: [40, 50, 40, 50],
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);

  // Use Electron's dialog to choose save location
  pdfDoc.getBuffer((buffer) => {
    try {
      const formattedDate = getFormattedDate();
      const raceName = raceDetails.race_name.replace(/[^a-zA-Z0-9]/g, '_');
      const defaultFileName = `${formattedDate}_RESULTS_${raceName.toUpperCase()}.pdf`;
      window.electronAPI
        .savePDF(buffer, defaultFileName)
        .then((result) => {
          if (result.success) {
            showSuccess('Results PDF saved successfully');
          }
        })
        .catch((err) => {
          handlePdfError('results', err);
        });
    } catch (error) {
      handlePdfError('results', error);
    }
  });
  } catch (error) {
    handlePdfError('results', error);
  }
};

export { resultsPdf };
