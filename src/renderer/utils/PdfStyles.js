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

const teamTableLayout = {
  hLineWidth: function (i, node) {
    const body = node.table.body[i];
    if (body && body.length > 0) {
      return node.table.body[i][0].text === '' ? 0 : 1;
    }
    return 1
  },
  vLineWidth: function () {
    // No vertical lines
    return 0;
  },
  hLineColor: function (i) {
    // Custom colour for the first horizontal line
    return i === 1 ? 'black' : '#aaa';
  },
  paddingLeft: function (i) {
    return i === 0 ? 0 : 8;
  },
  paddingRight: function (i, node) {
    return (i === node.table.widths.length - 1) ? 0 : 8;
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

export { tableStyles, teamTableLayout, dnfTable, dsqTable };
