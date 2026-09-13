/**
 * Pure helpers for the race results CSV importer.
 *
 * Nothing here touches the DOM or the database, so the parsing, validation
 * and statement-building logic can be unit tested directly. The page is
 * responsible only for collecting input and executing the returned
 * operations in a single transaction.
 */

export const STATUS_CODES = ['DNF', 'DSQ', 'DNS', 'NS'];

const isNumeric = (value) => /^\d+(\.\d+)?$/.test(value);

/**
 * Parse one time cell from the CSV.
 *
 * Accepts seconds ("83.45"), minutes:seconds ("1:23.45"), a comma as the
 * decimal separator, or a status code. Returns:
 *   null                              empty cell, nothing to import
 *   { status: 'DNF', time: null }     a status code
 *   { status: null, time: 83.45 }     a time in seconds
 *   { error: '...' }                  a cell that cannot be interpreted
 */
export function parseTime(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim().toUpperCase();
  if (str === '') return null;
  if (STATUS_CODES.includes(str)) return { status: str, time: null };

  const cleaned = str.replace(',', '.');
  let seconds;
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    if (parts.length !== 2 || !parts.every(isNumeric)) {
      return { error: `"${raw}" is not a time (use seconds or mm:ss.xx)` };
    }
    seconds = Number(parts[0]) * 60 + Number(parts[1]);
  } else if (isNumeric(cleaned)) {
    seconds = Number(cleaned);
  } else {
    return { error: `"${raw}" is not a time (use seconds or mm:ss.xx)` };
  }

  if (seconds <= 0) return { error: `"${raw}" is not a positive time` };
  return { status: null, time: Math.round(seconds * 100) / 100 };
}

/**
 * Build one preview row per CSV row: the matched competitor, the values to
 * write for each run, and any problems that stop the row importing.
 *
 * A mapped status column overrides the parsed status for every run in the
 * row, and a non-finish status always clears the time so a partial split
 * can never be stored as a finishing time.
 */
export function buildImportRows({
  csvData,
  columnMapping,
  importMode,
  selectedRun,
  competitors,
}) {
  const bibToCompetitor = new Map(
    competitors.map((c) => [Number(c.bib_number), c]),
  );
  const firstRowForBib = new Map();
  const relevantRuns = importMode === 'single' ? [Number(selectedRun)] : [1, 2];

  const timeColumnForRun = (runNumber) => {
    if (importMode === 'single')
      return columnMapping.time || columnMapping.time1;
    return runNumber === 1 ? columnMapping.time1 : columnMapping.time2;
  };

  return csvData.map((row, index) => {
    const rowNumber = index + 2; // 1-based, after the header line
    const problems = [];

    const rawBib = row[columnMapping.bib];
    const bib = /^\s*\d+\s*$/.test(String(rawBib ?? '')) ? Number(rawBib) : NaN;
    const competitor = Number.isNaN(bib) ? undefined : bibToCompetitor.get(bib);
    if (Number.isNaN(bib)) {
      problems.push(`Bib "${rawBib ?? ''}" is not a number`);
    } else if (!competitor) {
      problems.push(`No competitor with bib ${bib} in this race`);
    } else if (firstRowForBib.has(bib)) {
      problems.push(
        `Bib ${bib} already appears on row ${firstRowForBib.get(bib)}`,
      );
    } else {
      firstRowForBib.set(bib, rowNumber);
    }

    let statusOverride = null;
    const rawStatus = columnMapping.status
      ? row[columnMapping.status]
      : undefined;
    if (
      rawStatus !== undefined &&
      rawStatus !== null &&
      String(rawStatus).trim() !== ''
    ) {
      const code = String(rawStatus).trim().toUpperCase();
      if (STATUS_CODES.includes(code)) {
        statusOverride = code;
      } else {
        problems.push(
          `Status "${rawStatus}" is not one of ${STATUS_CODES.join(', ')}`,
        );
      }
    }

    const runs = {};
    relevantRuns.forEach((runNumber) => {
      const column = timeColumnForRun(runNumber);
      const parsed = column ? parseTime(row[column]) : null;
      if (parsed && parsed.error) {
        problems.push(`Run ${runNumber}: ${parsed.error}`);
      } else {
        const status = statusOverride || (parsed && parsed.status) || null;
        const time = status ? null : ((parsed && parsed.time) ?? null);
        if (time !== null || status !== null)
          runs[runNumber] = { time, status };
      }
    });
    if (Object.keys(runs).length === 0 && problems.length === 0) {
      problems.push('No time or status to import');
    }

    return {
      rowIndex: index,
      rowNumber,
      bib: Number.isNaN(bib) ? String(rawBib ?? '') : bib,
      competitor,
      competitorName: competitor
        ? `${competitor.last_name}, ${competitor.first_name}`
        : 'Not found',
      runs,
      problems,
      importable: problems.length === 0,
    };
  });
}

/**
 * Flatten the importable rows into one entry per competitor and run, in the
 * shape the results.importBatch operation expects.
 */
export function buildImportPayload(rows) {
  return rows.flatMap((row) =>
    Object.entries(row.runs).map(([runNumber, { time, status }]) => ({
      racerId: row.competitor.competitor_id,
      runNumber: Number(runNumber),
      time,
      status,
    })),
  );
}
