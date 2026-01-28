import * as pdfMake from 'pdfmake/build/pdfmake';
import { getFormattedDate } from '../utils/DateUtils';
import { tableStyles } from '../utils/PdfStyles';
import { showSuccess } from '../utils/ErrorHandler';

const generateTeamResultsPDF = (teamResults, races, categoryLabel, competitionName = '') => {
  return new Promise((resolve) => {
    const pageTitle = `${competitionName ? competitionName + ' - ' : ''}Team Results - ${categoryLabel}`;

    const tableColumns = (raceList) => {
      const base = [
        { text: 'Pos', style: 'tableHeader' },
        { text: 'Team', style: 'tableHeader' },
        { text: 'Members', style: 'tableHeader' },
      ];
      raceList.forEach((race) => {
        base.push({ text: race.text, style: 'tableHeader' });
      });
      base.push({ text: 'Total Points', style: 'tableHeader' });
      return base;
    };

    const tableWidths = (raceList) => {
      const base = [25, '*', 40];
      raceList.forEach(() => {
        base.push('auto');
      });
      base.push('auto');
      return base;
    };

    const teamRows = (teams, raceList) => {
      return teams.map((team) => {
        const row = [
          team.position,
          team.team_name,
          team.member_count,
        ];
        raceList.forEach((race) => {
          const value = team[race.id];
          row.push(value !== null && value !== undefined ? value.toFixed(2) : '-');
        });
        row.push(team.total_points?.toFixed(2) || '-');
        return row;
      });
    };

    const docDefinition = {
      content: [
        { text: pageTitle, style: 'header' },
        {
          style: 'table',
          layout: 'headerLineOnly',
          columnGap: 0,
          table: {
            headerRows: 1,
            widths: tableWidths(races),
            body: [tableColumns(races), ...teamRows(teamResults, races)],
          },
        },
      ],
      styles: tableStyles,
      pageMargins: [10, 50, 10, 50],
    };

    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.getBuffer((buffer) => {
      const formattedDate = getFormattedDate();
      const categorySlug = categoryLabel.toUpperCase().replace(/\s+/g, '_');
      const defaultFileName = `${formattedDate}_TEAM_RESULTS_${categorySlug}.pdf`;
      window.electronAPI
        .savePDF(buffer, defaultFileName)
        .then((r) => {
          if (r.success) {
            showSuccess(`PDF saved successfully to: ${r.filePath}`);
          }
          resolve(r.success);
        })
        .catch((err) => {
          console.error('Error saving PDF:', err);
          resolve(false);
        });
    });
  });
};

export { generateTeamResultsPDF };
