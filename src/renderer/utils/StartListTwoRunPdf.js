import pdfMake from 'pdfmake/build/pdfmake';
import { calculateCategory } from './CompetitorManagement';
import { getFormattedDate } from './DateUtils';
import { tableStyles } from './PdfStyles';
import { showSuccess } from './ErrorHandler';

// const { vfsFonts } = require('pdfmake/build/vfs_fonts');

// pdfMake.vfs = vfsFonts.pdfMake.vfs;

const startListTwoRunPdf = (raceDetails, startList, womensStartList) => {
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
          text: raceDetails?.tech_delegate || 'N/A',
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
          text: raceDetails.referee || 'N/A',
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
          text: raceDetails?.asst_referee || 'N/A',
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
          text: raceDetails.chief_of_race || 'N/A',
          style: 'text',
        },
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
        {
          width: '*',
          text: raceDetails.run1_number_gates || 'TBC',
          style: 'text',
        },
        {
          width: '*',
          text: raceDetails.run2_number_gates || 'TBC',
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
        {
          width: '*',
          text: raceDetails.run2_turning_gates || 'TBC',
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
        {
          width: '*',
          text: raceDetails.run2_start_time || 'TBC',
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
        { width: '*', text: raceDetails.forerunner_1_a, style: 'text' },
        { width: 10, text: 'A: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_2_a, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: '', style: 'key' },
        { width: 10, text: 'B: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_b, style: 'text' },
        { width: 10, text: 'B: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_2_b, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: '', style: 'key' },
        { width: 10, text: 'C: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_c, style: 'text' },
        { width: 10, text: 'C: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_2_c, style: 'text' },
      ],
      columnGap: 5,
    },
    {
      columns: [
        { width: 100, text: '', style: 'key' },
        { width: 10, text: 'D: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_1_d, style: 'text' },
        { width: 10, text: 'D: ', style: 'key' },
        { width: '*', text: raceDetails.forerunner_2_d, style: 'text' },
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
      { text: 'Start List', style: 'subheader' },
      ...runDetailsSection,
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
              { text: 'Class', style: 'tableHeader' },
            ],
            ...(startList || []).map((competitor, index) => [
              index + 1,
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
    const defaultFileName = `${formattedDate}_START_LIST_${raceName.toUpperCase()}.pdf`;
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

export { startListTwoRunPdf };
