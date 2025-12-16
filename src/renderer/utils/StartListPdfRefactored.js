import BasePdfGenerator from './BasePdfGenerator';
import { calculateCategory } from './CompetitorManagement';
import { getFormattedDate } from './DateUtils';

/**
 * Generates PDF for race start lists
 * Refactored to use BasePdfGenerator
 */
class StartListPdfGenerator extends BasePdfGenerator {
  generate(raceDetails, startList, womensStartList) {
    const content = [];

    // Add header
    content.push(...this.createHeader(
      `${raceDetails.race_name} - Start List`,
      raceDetails.competition_name
    ));

    // Add race details
    content.push(...this.createRaceDetailsSection(raceDetails));

    // Add jury and technical data
    content.push(...this.createJuryAndTechnicalSection(raceDetails));

    // Add run sections if available
    if (raceDetails.run1_course_setter) {
      content.push(...this.createRunSection(1, {
        course_setter: raceDetails.run1_course_setter,
        gates: raceDetails.run1_number_gates,
        turning_gates: raceDetails.run1_turning_gates,
        start_time: raceDetails.run1_start_time,
        forerunners: [
          raceDetails.run1_forerunner_1,
          raceDetails.run1_forerunner_2,
          raceDetails.run1_forerunner_3,
          raceDetails.run1_forerunner_4,
        ].filter(Boolean),
      }));
    }

    // Add main start list
    content.push(this.createStartListTable(startList, 'Start List'));

    // Add women's start list if separate
    if (womensStartList && womensStartList.length > 0) {
      content.push({ text: '', pageBreak: 'after' });
      content.push(...this.createHeader(
        `${raceDetails.race_name} - Women's Start List`,
        raceDetails.competition_name
      ));
      content.push(this.createStartListTable(womensStartList, "Women's Start List"));
    }

    // Add footer
    content.push(this.createFooter());

    // Generate filename
    const date = getFormattedDate(new Date());
    const filename = `${date}_START_LIST_${raceDetails.race_name.replace(/ /g, '_')}.pdf`;

    // Generate PDF
    this.generatePdf(content, filename);
  }

  createStartListTable(startList, title) {
    const headers = ['Bib', 'Name', 'YOB', 'Team', 'Cat', 'Seed Points'];
    
    const rows = startList.map((competitor) => {
      const category = calculateCategory(competitor.dob);
      return [
        { text: competitor.bib_number || '', alignment: 'center' },
        { text: `${competitor.last_name}, ${competitor.first_name}` },
        { text: competitor.dob ? new Date(competitor.dob).getFullYear() : '' },
        { text: competitor.team_name || competitor.regiment || '' },
        { text: category },
        { text: competitor.seed_points?.toFixed(2) || '2000.00', alignment: 'right' },
      ];
    });

    return [
      { text: title, style: 'subheader', margin: [0, 20, 0, 10] },
      this.createTable(headers, rows, [40, '*', 40, '*', 40, 60]),
    ];
  }
}

// Export function for backward compatibility
export const startListPdf = (raceDetails, startList, womensStartList) => {
  const generator = new StartListPdfGenerator();
  generator.generate(raceDetails, startList, womensStartList);
};

export default StartListPdfGenerator;