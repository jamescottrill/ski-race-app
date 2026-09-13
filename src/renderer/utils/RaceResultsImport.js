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
 * Build the operation list for window.api.transaction from the importable
 * rows: make sure each run row exists, then upsert one race_results row per
 * competitor and run. The caller executes the list as one transaction, so a
 * failure part-way writes nothing.
 */
export function buildImportOperations({ competitionId, raceId, rows }) {
  const runNumbers = new Set();
  rows.forEach((row) =>
    Object.keys(row.runs).forEach((n) => runNumbers.add(Number(n))),
  );

  const operations = [...runNumbers]
    .sort((a, b) => a - b)
    .map((runNumber) => ({
      type: 'insert',
      query: `INSERT OR IGNORE INTO race_run (competition_id, race_id, run_id, run_number, is_complete)
              VALUES (?, ?, ?, ?, 0)`,
      params: [competitionId, raceId, `${raceId}-run-${runNumber}`, runNumber],
    }));

  rows.forEach((row) => {
    Object.entries(row.runs).forEach(([runNumber, { time, status }]) => {
      operations.push({
        type: 'insert',
        // DSQ gate/reason are kept only while the row stays DSQ, matching
        // what the results-entry page does when a status changes
        query: `INSERT INTO race_results
                  (competition_id, race_id, run_number, racer_id, race_time, is_dnf, is_dsq, is_dns, is_ns)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(competition_id, race_id, run_number, racer_id)
                DO UPDATE SET
                  race_time = excluded.race_time,
                  is_dnf = excluded.is_dnf,
                  is_dsq = excluded.is_dsq,
                  is_dns = excluded.is_dns,
                  is_ns = excluded.is_ns,
                  dsq_gate = CASE WHEN excluded.is_dsq = 1 THEN race_results.dsq_gate ELSE NULL END,
                  dsq_reason = CASE WHEN excluded.is_dsq = 1 THEN race_results.dsq_reason ELSE NULL END`,
        params: [
          competitionId,
          raceId,
          Number(runNumber),
          row.competitor.competitor_id,
          time,
          status === 'DNF' ? 1 : 0,
          status === 'DSQ' ? 1 : 0,
          status === 'DNS' ? 1 : 0,
          status === 'NS' ? 1 : 0,
        ],
      });
    });
  });

  return operations;
}
