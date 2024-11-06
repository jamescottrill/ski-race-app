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
import { resultsSeedPdf } from '../utils/ResultsSeedPdf';
import { getRaceDetails } from '../utils/RaceDetails';
import { convertRaceTime } from '../utils/TimeUtils';
import { seedResults} from '../queries/SeedResults';

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
    const raceQueryValues = [raceId, raceId];
    let results = [];
    try {
      results = await window.api.select(seedResults, raceQueryValues);
    } catch (e) {
      console.error('Failed to fetch competitors:', e);
      return;
    }
    const mapped = results.map((result) => {
      const obj = {
        id: `${result.racer_id}/results`,
        racerId: result.racer_id,
        raceId: result.raceId,
        run1Time: result.run_1_time ? convertRaceTime(result.run_1_time) : result.run_1_dns ? "DNS" : result.run_1_dnf ? "DNF" : result.run_1_dsq ? "DSQ" : "",
        run2Time: result.run_2_time ? convertRaceTime(result.run_2_time) : result.run_2_dns ? "DNS" : result.run_2_dnf ? "DNF" : result.run_2_dsq ? "DSQ" : "",
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
        completed1:
          !result.run_1_dns &&
          !result.run_1_dnf &&
          !result.run_1_dsq &&
          result.run_1_time,
        completed2:
          !result.run_2_dns &&
          !result.run_2_dnf &&
          !result.run_2_dsq &&
          result.run_2_time,
        firstName: result.first_name,
        lastName: result.last_name,
        title: result.title,
        team: result.team,
        points1: result.seed_1,
        points2: result.seed_2,
        bibNumber: result.bib_number,
        position: result.position,
        finalSeed: result.overall_seed,
      };
      obj.completed = obj.completed1 && obj.completed2;
      obj.totalTime = obj.completed ? convertRaceTime(Math.round(result.run_1_time + result.run_2_time,2)) : '';
      return obj;
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
        return e.completed1 || e.completed2;
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
    resultsSeedPdf(
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
                <TableCell align="center">Points First Run</TableCell>
                <TableCell align="center">Points Second Run</TableCell>
                <TableCell align="center">Best Points</TableCell>
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
                  <TableCell align="center">{row.points1}</TableCell>
                  <TableCell align="center">{row.points2}</TableCell>
                  <TableCell align="center">{row.finalSeed}</TableCell>
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
