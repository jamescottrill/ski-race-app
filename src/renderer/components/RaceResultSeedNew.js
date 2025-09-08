// eslint-disable no-nested-ternary
import React, { useEffect, useState } from 'react';
import { Card, CardContent, DataTable, Badge, Button } from '../design-system';
import OtherResultTable from './DnsTable';
import { resultsSeedPdf } from '../utils/ResultsSeedPdf';
import { getRaceDetails } from '../utils/RaceDetails';
import { convertRaceTime } from '../utils/TimeUtils';
import { seedResults } from '../queries/SeedResults';

export default function RaceResultSeedNew({ raceId, competitionId }) {
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
        run1Time: result.run_1_time
          ? convertRaceTime(result.run_1_time)
          : result.run_1_dns
            ? 'DNS'
            : result.run_1_dnf
              ? 'DNF'
              : result.run_1_dsq
                ? 'DSQ'
                : '',
        run2Time: result.run_2_time
          ? convertRaceTime(result.run_2_time)
          : result.run_2_dns
            ? 'DNS'
            : result.run_2_dnf
              ? 'DNF'
              : result.run_2_dsq
                ? 'DSQ'
                : '',
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
      obj.totalTime = obj.completed
        ? convertRaceTime((result.run_1_time + result.run_2_time).toFixed(2))
        : '';
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

  // Define columns for main results DataTable
  const columns = [
    {
      accessorKey: 'position',
      header: 'Position',
      cell: ({ row }) => (
        <div className="text-center font-medium">{row.original.position}</div>
      ),
    },
    {
      accessorKey: 'bibNumber',
      header: 'Start Number',
      cell: ({ row }) => (
        <div className="text-center">{row.original.bibNumber}</div>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Rank',
      cell: ({ row }) => (
        <div className="text-center">{row.original.title}</div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.lastName.toUpperCase()} {row.original.firstName}
        </div>
      ),
    },
    {
      accessorKey: 'team',
      header: 'Team',
      cell: ({ row }) => (
        <div className="text-center">{row.original.team}</div>
      ),
    },
    {
      accessorKey: 'run1Time',
      header: 'Time First Run',
      cell: ({ row }) => (
        <div className="text-center">
          {['DNS', 'DNF', 'DSQ'].includes(row.original.run1Time) ? (
            <Badge variant={
              row.original.run1Time === 'DNS' ? 'warning' : 
              row.original.run1Time === 'DNF' ? 'danger' : 
              'info'
            }>
              {row.original.run1Time}
            </Badge>
          ) : (
            row.original.run1Time
          )}
        </div>
      ),
    },
    {
      accessorKey: 'run2Time',
      header: 'Time Second Run',
      cell: ({ row }) => (
        <div className="text-center">
          {['DNS', 'DNF', 'DSQ'].includes(row.original.run2Time) ? (
            <Badge variant={
              row.original.run2Time === 'DNS' ? 'warning' : 
              row.original.run2Time === 'DNF' ? 'danger' : 
              'info'
            }>
              {row.original.run2Time}
            </Badge>
          ) : (
            row.original.run2Time
          )}
        </div>
      ),
    },
    {
      accessorKey: 'totalTime',
      header: 'Total Time',
      cell: ({ row }) => (
        <div className="text-center font-medium">{row.original.totalTime}</div>
      ),
    },
    {
      accessorKey: 'points1',
      header: 'Points First Run',
      cell: ({ row }) => (
        <div className="text-center">{row.original.points1}</div>
      ),
    },
    {
      accessorKey: 'points2',
      header: 'Points Second Run',
      cell: ({ row }) => (
        <div className="text-center">{row.original.points2}</div>
      ),
    },
    {
      accessorKey: 'finalSeed',
      header: 'Best Points',
      cell: ({ row }) => (
        <div className="text-center font-medium">{row.original.finalSeed}</div>
      ),
    },
  ];

  // Define columns for DNS/DNF/DSQ tables
  const otherResultsColumns = [
    {
      accessorKey: 'bibNumber',
      header: 'Start Number',
      cell: ({ row }) => (
        <div className="text-center">{row.original.bibNumber}</div>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Rank',
      cell: ({ row }) => (
        <div className="text-center">{row.original.title}</div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.lastName.toUpperCase()} {row.original.firstName}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {data.length > 0 && (
        <Card>
          <CardContent>
            <DataTable
              columns={columns}
              data={data}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {data.length === 0 && (
        <Card>
          <CardContent>
            <div className="text-center py-8 text-neutral-600">
              No Competitors found, make sure you&apos;ve marked the previous run as
              finished.
            </div>
          </CardContent>
        </Card>
      )}
      {run1Dns.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">DNS Run 1</h2>
            <DataTable
              columns={otherResultsColumns}
              data={run1Dns}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {run1Dnf.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">DNF Run 1</h2>
            <DataTable
              columns={otherResultsColumns}
              data={run1Dnf}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {run1Dsq.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">DSQ Run 1</h2>
            <DataTable
              columns={otherResultsColumns}
              data={run1Dsq}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {run2Dns.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">DNS Run 2</h2>
            <DataTable
              columns={otherResultsColumns}
              data={run2Dns}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {run2Dnf.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">DNF Run 2</h2>
            <DataTable
              columns={otherResultsColumns}
              data={run2Dnf}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {run2Dsq.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">DSQ Run 2</h2>
            <DataTable
              columns={otherResultsColumns}
              data={run2Dsq}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      <div className="flex justify-center">
        <Button onClick={generatePDF}>
          Download PDF
        </Button>
      </div>
    </div>
  );
}