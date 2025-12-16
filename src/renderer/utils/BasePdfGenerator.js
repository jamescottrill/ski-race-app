import pdfMake from 'pdfmake/build/pdfmake';
import { getFormattedDate } from './DateUtils';
import { tableStyles } from './PdfStyles';

/**
 * Base class for PDF generation with common functionality
 * Eliminates duplication across all PDF generation utilities
 */
class BasePdfGenerator {
  constructor() {
    this.styles = {
      header: {
        fontSize: 18,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 10],
      },
      subheader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 5],
      },
      key: {
        fontSize: 10,
        bold: true,
      },
      text: {
        fontSize: 10,
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        alignment: 'center',
      },
      ...tableStyles,
    };

    this.defaultPageSettings = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
    };
  }

  /**
   * Creates the standard header for all PDF documents
   */
  createHeader(title, competitionName) {
    return [
      {
        text: competitionName || 'British Army Ski Race',
        style: 'header',
      },
      {
        text: title,
        style: 'subheader',
        alignment: 'center',
        margin: [0, 0, 0, 20],
      },
    ];
  }

  /**
   * Creates the standard race details section
   */
  createRaceDetailsSection(raceDetails) {
    return [
      {
        columns: [
          { width: 'auto', text: 'Venue: ' },
          { width: '*', text: raceDetails.venue || 'N/A' },
          { width: 'auto', text: 'Date: ' },
          {
            width: '*',
            text: raceDetails.race_date
              ? new Date(raceDetails.race_date).toLocaleString('default', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : 'N/A',
          },
        ],
        columnGap: 10,
      },
      {
        columns: [
          { width: 'auto', text: 'Course Name: ' },
          { width: 'auto', text: raceDetails.course_name || 'N/A' },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 10],
      },
    ];
  }

  /**
   * Creates the jury and technical data section
   */
  createJuryAndTechnicalSection(raceDetails) {
    return [
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
            text: (raceDetails.tech_delegate || '').trim() || 'N/A',
            style: 'text',
          },
          { width: 120, text: 'Start Height (m): ', style: 'key' },
          { width: '*', text: raceDetails.start_altitude || 'N/A', style: 'text' },
        ],
        columnGap: 5,
      },
      {
        columns: [
          { width: 100, text: 'Referee: ', style: 'key' },
          {
            width: '*',
            text: (raceDetails.referee || '').trim() || 'N/A',
            style: 'text',
          },
          { width: 120, text: 'Finish Height (m): ', style: 'key' },
          { width: '*', text: raceDetails.finish_altitude || 'N/A', style: 'text' },
        ],
        columnGap: 5,
      },
      {
        columns: [
          { width: 100, text: 'Assistant Referee: ', style: 'key' },
          {
            width: '*',
            text: (raceDetails.asst_referee || '').trim() || 'N/A',
            style: 'text',
          },
          { width: 120, text: 'Vertical Difference (m): ', style: 'key' },
          { 
            width: '*', 
            text: raceDetails.altitude_difference || 
                  (raceDetails.start_altitude && raceDetails.finish_altitude 
                    ? raceDetails.start_altitude - raceDetails.finish_altitude 
                    : 'N/A'), 
            style: 'text' 
          },
        ],
        columnGap: 5,
      },
      {
        columns: [
          { width: 100, text: 'Chief of Race: ', style: 'key' },
          {
            width: '*',
            text: (raceDetails.chief_of_race || '').trim() || 'N/A',
            style: 'text',
          },
          { width: 120, text: 'Homologation: ', style: 'key' },
          { width: '*', text: raceDetails.homologation || 'N/A', style: 'text' },
        ],
        columnGap: 5,
        margin: [0, 0, 0, 20],
      },
    ];
  }

  /**
   * Creates run details section for a specific run
   */
  createRunSection(runNumber, runDetails) {
    const runTitle = runNumber === 1 ? 'First Run' : runNumber === 2 ? 'Second Run' : `Run ${runNumber}`;
    
    const sections = [
      {
        columns: [{ width: '*', text: runTitle, style: 'subheader' }],
        columnGap: 5,
      },
    ];

    if (runDetails.course_setter) {
      sections.push({
        columns: [
          { width: 100, text: 'Course Setter: ', style: 'key' },
          { width: '*', text: runDetails.course_setter, style: 'text' },
          { width: 100, text: 'Gates: ', style: 'key' },
          { width: '*', text: runDetails.gates || 'N/A', style: 'text' },
        ],
        columnGap: 5,
      });
    }

    if (runDetails.turning_gates) {
      sections.push({
        columns: [
          { width: 100, text: 'Turning Gates: ', style: 'key' },
          { width: '*', text: runDetails.turning_gates, style: 'text' },
          { width: 100, text: 'Start Time: ', style: 'key' },
          { width: '*', text: runDetails.start_time || 'N/A', style: 'text' },
        ],
        columnGap: 5,
      });
    }

    if (runDetails.forerunners && runDetails.forerunners.length > 0) {
      sections.push({
        columns: [
          { width: 100, text: 'Forerunners: ', style: 'key' },
          { width: '*', text: runDetails.forerunners.join(', '), style: 'text' },
        ],
        columnGap: 5,
        margin: [0, 0, 0, 10],
      });
    }

    return sections;
  }

  /**
   * Creates the footer with timestamp
   */
  createFooter() {
    return {
      columns: [
        {
          text: `Generated: ${getFormattedDate(new Date())}`,
          alignment: 'right',
          fontSize: 8,
          margin: [0, 20, 0, 0],
        },
      ],
    };
  }

  /**
   * Creates a standard table with headers and rows
   */
  createTable(headers, rows, widths = 'auto') {
    return {
      table: {
        headerRows: 1,
        widths: widths,
        body: [
          headers.map(h => ({ text: h, style: 'tableHeader' })),
          ...rows,
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 10, 0, 10],
    };
  }

  /**
   * Generates the PDF document
   */
  generatePdf(content, filename = 'document.pdf') {
    const docDefinition = {
      ...this.defaultPageSettings,
      content: content,
      styles: this.styles,
    };

    pdfMake.createPdf(docDefinition).download(filename);
  }

  /**
   * Opens the PDF in a new window
   */
  openPdf(content) {
    const docDefinition = {
      ...this.defaultPageSettings,
      content: content,
      styles: this.styles,
    };

    pdfMake.createPdf(docDefinition).open();
  }
}

export default BasePdfGenerator;