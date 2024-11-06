const tableStyles = {
  header: {
    fontSize: 18,
    bold: true,
    margin: [0, 0, 0, 5],
    alignment: 'center',
  },
  subheader: {
    fontSize: 15,
    bold: true,
    margin: [0, 0, 0, 5],
    alignment: 'center',
  },
  subheaderLeft: {
    fontSize: 15,
    bold: true,
    margin: [0, 0, 0, 5],
    alignment: 'left',
  },
  tableHeader: {
    bold: true,
  },
  table: {
    padding: [0, 5, 0, 15],
    fontSize: 9,
  },
};

const dnfTable = (data) => {
  return {
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
        ...(data || []).map((competitor) => [
          competitor.bibNumber,
          competitor.title,
          `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
          competitor.team,
        ]),
      ],
    },
  };
};

const dsqTable = (data) => {
  return {
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
        ...(data || []).map((competitor) => [
          competitor.bibNumber,
          competitor.title,
          `${competitor.lastName.toUpperCase()} ${competitor.firstName}`,
          competitor.team,
          competitor.run2DsqGate,
        ]),
      ],
    },
  }
}

export { tableStyles, dnfTable, dsqTable };
