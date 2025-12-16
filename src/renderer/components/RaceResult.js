// eslint-disable no-nested-ternary
import React, { useEffect, useState } from 'react';
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import OtherResultTable from './DnsTable';
import { convertRaceTime } from '../utils/TimeUtils';
import { resultsPdf } from '../utils/ResultsPdf';
import { getRaceDetails } from '../utils/RaceDetails';
import ResultTable from './ResultTable';

const raceQueryOneRun = `
          WITH factors AS (SELECT 730 AS factor, 'SL' AS race
                           UNION ALL
                           SELECT 1010 AS factor, 'GS' AS race
                           UNION ALL
                           SELECT 1190 AS factor, 'SG' AS race
                           UNION ALL
                           SELECT 1250 AS factor, 'DH' AS race
                           UNION ALL
                           SELECT 1360 AS factor, 'AC' AS race),
               run1 AS (SELECT race_id,
                               racer_id,
                               ROUND(race_time, 2) AS race_time,
                               COALESCE(is_dsq, FALSE) AS is_dsq,
                               COALESCE(is_dnf, FALSE) AS is_dnf,
                               COALESCE(is_dns, FALSE) AS is_dns,
                               COALESCE(is_ns, FALSE) AS is_ns,
                               dsq_gate,
                               dsq_reason,
                               competition_id
                        FROM race_results rr
                        WHERE TRUE
                          AND run_number = 1
                          AND race_id = ?),
               data AS (SELECT run1.racer_id,
                               run1.race_id,
                               run1.race_time AS run_1_time,
                               run1.is_dns AS run_1_dns,
                               run1.is_dsq AS run_1_dsq,
                               run1.is_dnf AS run_1_dnf,
                               run1.is_ns AS is_ns,
                               run1.is_dnf AS is_dnf,
                               run1.is_dns AS is_dns,
                               run1.is_dsq AS is_dsq,
                               run1.dsq_gate AS run_1_dsq_gate,
                               run1.dsq_reason AS run_1_dsq_reason,
                               p.first_name,
                               p.last_name,
                               cc.title,
                               rc.bib_number,
                               cc.regiment AS team,
                               f.factor AS factor,
                               p.gender,
                               cc.is_novice,
                               cc.is_junior,
                               cc.is_veteran,
                               cc.is_reserve,
                               cc.is_senior,
                               RANK() OVER (PARTITION BY run1.race_id ORDER BY rc.seed_points)      AS seed_order,
                               MIN(COALESCE(run1.race_time, 9999))
                                   OVER (ORDER BY run1.race_id) AS mintime
                        FROM run1
                               LEFT JOIN people p ON p.id = run1.racer_id
                               LEFT JOIN race_competitor rc ON run1.race_id = rc.race_id
                                                                 AND run1.racer_id = rc.racer_id
                               LEFT JOIN competition_competitor cc ON cc.racer_id = run1.racer_id AND cc.competition_id = run1.competition_id
                               LEFT JOIN races r ON r.race_id = run1.race_id
                               LEFT JOIN factors f ON f.race = r.race_type
                        )
          SELECT
            *,
            ROUND((run_1_time - mintime) / mintime * factor, 2) AS seed_points,
            RANK() OVER (ORDER BY run_1_time NULLS LAST) AS position
          FROM data
          ORDER BY run_1_time NULLS LAST, bib_number
        `;

function RaceResultOneRun({ raceId, competitionId }) {
  const [raceDetails, setRaceDetails] = useState([]);
  const [data, setData] = useState([]);
  const [run1Dnf, setRun1Dnf] = useState([]);
  const [run1Dns, setRun1Dns] = useState([]);
  const [run1Dsq, setRun1Dsq] = useState([]);

  const initialData = async () => {
    const rd = await getRaceDetails(raceId, competitionId);
    setRaceDetails(rd);

    const raceQueryValues = [raceId];
    let results = [];
    try {
      results = await window.api.select(raceQueryOneRun, raceQueryValues);
    } catch (e) {
      console.error('Failed to fetch competitors:', e);
      return;
    }
    const mapped = results.map((result) => {
      return {
        id: `${result.racer_id}/results`,
        racerId: result.racer_id,
        raceId: result.raceId,
        run1Time: convertRaceTime(result.run_1_time),
        run1Dns: result.run_1_dns,
        run1Dsq: result.run_1_dsq,
        run1Dnf: result.run_1_dnf,
        run1Ns: result.is_ns,
        run1DsqGate: result.run_1_dsq_gate,
        run1DsqReason: result.run_1_dsq_reason,
        completed: !result.run_1_dns && !result.run_1_dnf && !result.run_1_dsq && !result.is_ns,
        firstName: result.first_name,
        lastName: result.last_name,
        title: result.title,
        team: result.team,
        seedPoints: result.seed_points,
        bibNumber: result.bib_number,
        position: result.position,
        gender: result.gender,
        is_novice: result.is_novice,
        is_junior: result.is_junior,
        is_senior: result.is_senior,
        is_veteran: result.is_veteran,
        is_reserve: result.is_reserve,
      };
    });
    const r1Dnf = mapped
      .filter((e) => {
        return e.run1Dnf;
      })
      .sort(function (a, b) {
        return a.bibNumber - b.bibNumber;
      });
    setRun1Dnf(r1Dnf);
    const r1Dns = mapped
      .filter((e) => {
        return e.run1Dns || e.run1Ns;
      })
      .sort(function (a, b) {
        return a.bibNumber - b.bibNumber;
      });
    setRun1Dns(r1Dns);
    const r1Dsq = mapped
      .filter((e) => {
        return e.run1Dsq;
      })
      .sort(function (a, b) {
        return a.bibNumber - b.bibNumber;
      });
    setRun1Dsq(r1Dsq);
    const finished = mapped
      .filter((e) => {
        return e.completed;
      })
      .sort(function (a, b) {
        return a.position - b.position;
      });
    setData(finished);
  };

  useEffect(() => {
    initialData();
  });
  const generatePDF = () => {
    resultsPdf(raceDetails, data, run1Dns, run1Dnf, run1Dsq);
  };

  return (
    <>
      {data.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Position</TableCell>
                <TableCell align="center">Start Number</TableCell>
                <TableCell align="center">Rank</TableCell>
                <TableCell align="center">Name</TableCell>
                <TableCell align="center">Team</TableCell>
                <TableCell align="center">Time First Run</TableCell>
                <TableCell align="center">Seed Points</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell align="center">{row.position}</TableCell>
                  <TableCell align="center">{row.bibNumber}</TableCell>
                  <TableCell align="center">{row.title}</TableCell>
                  <TableCell align="center">
                    {row.lastName.toUpperCase()} {row.firstName}
                  </TableCell>
                  <TableCell align="center">{row.team}</TableCell>
                  <TableCell align="center">{row.run1Time}</TableCell>
                  <TableCell align="center">{row.seedPoints}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {data.length === 0 && (
        <div>
          No Competitors found, make sure you&apos;ve marked the previous run as
          finished.
        </div>
      )}
      {run1Dns.length > 0 && (
        <>
          <h1>DNS Run 1</h1>
          <TableContainer component={Paper}>
            <OtherResultTable data={run1Dns} />
          </TableContainer>
        </>
      )}
      {run1Dnf.length > 0 && (
        <>
          <h1>DNF Run 1</h1>
          <TableContainer>
            <OtherResultTable data={run1Dnf} />
          </TableContainer>
        </>
      )}
      {run1Dsq.length > 0 && (
        <>
          <h1>DSQ Run 1</h1>
          <TableContainer>
            <OtherResultTable data={run1Dsq} />
          </TableContainer>
        </>
      )}
      {data.length > 0 && (
        <>
          <h1>Junior Results</h1>
          <TableContainer>
            <ResultTable data={data.filter((e) => e.is_junior).slice(0, 3)} />
          </TableContainer>
        </>
      )}
      {data.length > 0 && (
        <>
          <h1>Novice Results</h1>
          <TableContainer>
            <ResultTable data={data.filter((e) => e.is_novice).slice(0, 3)} />
          </TableContainer>
        </>
      )}
      {data.length > 0 && (
        <>
          <h1>Veteran Results</h1>
          <TableContainer>
            <ResultTable data={data.filter((e) => e.is_veteran).slice(0, 3)} />
          </TableContainer>
        </>
      )}
      {data.length > 0 && (
        <>
          <h1>Female Results</h1>
          <TableContainer>
            <ResultTable
              data={data.filter((e) => e.gender === 'F').slice(0, 3)}
            />
          </TableContainer>
        </>
      )}
      {data.length > 0 && (
        <>
          <h1>Open Results</h1>
          <TableContainer>
            <ResultTable data={data.slice(0, 3)} />
          </TableContainer>
        </>
      )}
      <Button variant="contained" onClick={generatePDF}>
        Download PDF
      </Button>
    </>
  );
}

export { RaceResultOneRun, raceQueryOneRun };
