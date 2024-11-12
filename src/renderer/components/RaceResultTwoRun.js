// eslint-disable no-nested-ternary
import React, { useEffect, useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
} from '@mui/material';
import OtherResultTable from './DnsTable';
import { resultsTwoPdf } from '../utils/ResultsTwoPdf';
import { getRaceDetails } from '../utils/RaceDetails';
import { convertRaceTime } from '../utils/TimeUtils';

export default function RaceResultTwoRun({ raceId, competitionId }) {
  const [data, setData] = useState([]);
  const [run1Dnf, setRun1Dnf] = useState([]);
  const [run1Dns, setRun1Dns] = useState([]);
  const [run1Dsq, setRun1Dsq] = useState([]);
  const [run2Dnf, setRun2Dnf] = useState([]);
  const [run2Dns, setRun2Dns] = useState([]);
  const [run2Dsq, setRun2Dsq] = useState([]);
  const [raceDetails, setRaceDetails] = useState([]);



  const initialData = async () => {
    const raceQuery = `
          WITH factors AS (SELECT 730 AS factor, 'SL' AS race
                           UNION ALL
                           SELECT 1010 AS factor, 'GS' AS race
                           UNION ALL
                           SELECT 1130 AS factor, 'SG' AS race
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
                               dsq_gate,
                               dsq_reason
                        FROM race_results rr
                        WHERE TRUE
                          AND run_number = 1
                          AND race_id = ?),
               run2 AS (SELECT race_id,
                               racer_id,
                               ROUND(race_time, 2) AS race_time,
                               COALESCE(is_dsq, FALSE) AS is_dsq,
                               COALESCE(is_dnf, FALSE) AS is_dnf,
                               COALESCE(is_dns, FALSE) AS is_dns,
                               dsq_gate,
                               dsq_reason
                        FROM race_results rr
                        WHERE TRUE
                          AND run_number = 2
                          AND race_id = ?),
               data AS (SELECT run1.racer_id,
                               run1.race_id,
                               run1.race_time                                                            AS run_1_time,
                               run2.race_time                                                            AS run_2_time,
                               ROUND(COALESCE(run1.race_time, 9999) + COALESCE(run2.race_time, 9999), 2) AS total_time,
                               run1.is_dns                                                               AS run_1_dns,
                               run2.is_dns                                                               AS run_2_dns,
                               run1.is_dsq                                                               AS run_1_dsq,
                               run2.is_dsq                                                               AS run_2_dsq,
                               run1.is_dnf                                                               AS run_1_dnf,
                               run2.is_dnf                                                               AS run_2_dnf,
                               run1.dsq_gate                                                             AS run_1_dsq_gate,
                               run2.dsq_gate                                                             AS run_2_dsq_gate,
                               run1.dsq_reason                                                           AS run_1_dsq_reason,
                               run2.dsq_reason                                                           AS run_2_dsq_reason,
                               p.first_name,
                               p.last_name,
                               cc.title,
                               rc.bib_number,
                               cc.team,
                               f.factor                                                                  AS factor,
                               MIN(COALESCE(run1.race_time, 9999) + COALESCE(run2.race_time, 9999))
                                   OVER (ORDER BY run1.race_id)                                          AS mintime
                        FROM run1
                               LEFT JOIN run2 ON run1.racer_id = run2.racer_id
                               JOIN people p ON p.id = run1.racer_id
                               JOIN race_competitor rc ON run1.race_id = rc.race_id AND run1.racer_id = rc.racer_id
                               JOIN competition_competitor cc ON cc.racer_id = p.id
                               JOIN races r ON r.race_id = run1.race_id
                               JOIN factors f ON f.race = r.race_type)
          SELECT
            *,
            ROUND((total_time - mintime) / mintime * factor, 2) AS seed_points,
            RANK() OVER (ORDER BY total_time) AS position
          FROM data
          ORDER BY total_time
        `;
    const raceQueryValues = [raceId, raceId];
    let results = [];
    try {
      results = await window.api.select(raceQuery, raceQueryValues);
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
        run2Time: convertRaceTime(result.run_2_time),
        run1Dns: result.run_1_dns,
        run2Dns: result.run_2_dns,
        run1Dsq: result.run_1_dsq,
        run2Dsq: result.run_2_dsq,
        run1Dnf: result.run_1_dnf,
        run2Dnf: result.run_2_dnf,
        run1DsqGate: result.run_1_dsq_gate,
        run2DsqGate: result.run_2_dsq_gate,
        run1DsqReason: result.run_1_dsq_reason,
        run2DsqReason: result.run_2_dsq_reason,
        completed:
          !result.run_1_dns &&
          !result.run_1_dnf &&
          !result.run_1_dsq &&
          !result.run_2_dns &&
          !result.run_2_dnf &&
          !result.run_2_dsq,
        totalTime: convertRaceTime(result.total_time),
        firstName: result.first_name,
        lastName: result.last_name,
        title: result.title,
        team: result.team,
        seedPoints: result.seed_points,
        bibNumber: result.bib_number,
        position: result.position,
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
        return e.run1Dns;
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
    const r2Dnf = mapped
      .filter((e) => {
        return e.run2Dnf;
      })
      .sort(function (a, b) {
        return a.bibNumber - b.bibNumber;
      });
    setRun2Dnf(r2Dnf);
    const r2Dns = mapped
      .filter((e) => {
        return e.run2Dns;
      })
      .sort(function (a, b) {
        return a.bibNumber - b.bibNumber;
      });
    setRun2Dns(r2Dns);
    const r2Dsq = mapped
      .filter((e) => {
        return e.run2Dsq;
      })
      .sort(function (a, b) {
        return a.bibNumber - b.bibNumber;
      });
    setRun2Dsq(r2Dsq);
    const finished = mapped
      .filter((e) => {
        return e.completed;
      })
      .sort(function (a, b) {
        return a.position - b.position;
      });
    setData(finished);
  };

  const initRaceDetails = async () => {
    const details = await getRaceDetails(raceId, competitionId);
    setRaceDetails(details);
  };

  useEffect(() => {
    // const init = async () => {
    //   await initialData();
    //   await initRaceDetails();
    // };
    initialData().catch(console.error);
    initRaceDetails().catch(console.error);
    // init();
    // init().catch(console.error);
  }, [raceId, competitionId]);

  const generatePDF = () => {
    resultsTwoPdf(
      raceDetails,
      data,
      run1Dns,
      run1Dnf,
      run1Dsq,
      run2Dns,
      run2Dnf,
      run2Dsq,
    );
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
                <TableCell align="center">Time Second Run</TableCell>
                <TableCell align="center">Total Time</TableCell>
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
                  <TableCell align="center">{row.run2Time}</TableCell>
                  <TableCell align="center">{row.totalTime}</TableCell>
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
      {run2Dns.length > 0 && (
        <>
          <h1>DNS Run 2</h1>
          <TableContainer>
            <OtherResultTable data={run2Dns} />
          </TableContainer>
        </>
      )}
      {run2Dnf.length > 0 && (
        <>
          <h1>DNF Run 2</h1>
          <TableContainer>
            <OtherResultTable data={run2Dnf} />
          </TableContainer>
        </>
      )}
      {run2Dsq.length > 0 && (
        <>
          <h1>DSQ Run 2</h1>
          <TableContainer>
            <OtherResultTable data={run2Dsq} />
          </TableContainer>
        </>
      )}
      <Button variant="contained" onClick={generatePDF}>
        Download PDF
      </Button>
    </>
  );
}
