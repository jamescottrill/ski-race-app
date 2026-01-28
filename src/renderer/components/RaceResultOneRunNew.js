// eslint-disable no-nested-ternary
import React, { useEffect, useState } from 'react';
import { Card, CardContent, DataTable, Badge, Button } from '../design-system';
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

function RaceResultOneRunNew({ raceId, competitionId }) {
  const [raceDetails, setRaceDetails] = useState([]);
  const [data, setData] = useState([]);
  const [run1Dnf, setRun1Dnf] = useState([]);
  const [run1Dns, setRun1Dns] = useState([]);
  const [run1Dsq, setRun1Dsq] = useState([]);
  const [activeTab, setActiveTab] = useState('women');

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
  }, [raceId, competitionId]);

  const generatePDF = (gender = null) => {
    if (gender) {
      const genderLabel = gender === 'F' ? 'Women' : 'Men';
      const genderRaceDetails = {
        ...raceDetails,
        race_name: `${raceDetails.race_name} - ${genderLabel}`,
      };
      const genderData = data
        .filter((e) => e.gender === gender)
        .map((e, i) => ({ ...e, position: i + 1 }));
      const genderRun1Dns = run1Dns.filter((e) => e.gender === gender);
      const genderRun1Dnf = run1Dnf.filter((e) => e.gender === gender);
      const genderRun1Dsq = run1Dsq.filter((e) => e.gender === gender);
      resultsPdf(genderRaceDetails, genderData, genderRun1Dns, genderRun1Dnf, genderRun1Dsq);
    } else {
      resultsPdf(raceDetails, data, run1Dns, run1Dnf, run1Dsq);
    }
  };

  const generateAllGenderPDFs = () => {
    generatePDF('F');
    generatePDF('M');
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
        <div className="text-center">{row.original.run1Time}</div>
      ),
    },
    {
      accessorKey: 'seedPoints',
      header: 'Seed Points',
      cell: ({ row }) => (
        <div className="text-center">{row.original.seedPoints}</div>
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

  // Define columns for category results
  const categoryColumns = [
    {
      accessorKey: 'bibNumber',
      header: 'Bib',
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
      accessorKey: 'position',
      header: 'Position',
      cell: ({ row, table }) => {
        const rowIndex = table.getSortedRowModel().rows.findIndex(r => r.id === row.id);
        return <div className="text-center">{rowIndex + 1}</div>;
      },
    },
  ];

  const renderResultsForGender = (gender, genderLabel) => {
    const genderData = data
      .filter((e) => e.gender === gender)
      .map((e, i) => ({ ...e, position: i + 1 }));
    const genderRun1Dns = run1Dns.filter((e) => e.gender === gender);
    const genderRun1Dnf = run1Dnf.filter((e) => e.gender === gender);
    const genderRun1Dsq = run1Dsq.filter((e) => e.gender === gender);

    return (
      <div className="space-y-6">
        {genderData.length > 0 && (
          <Card>
            <CardContent>
              <DataTable
                columns={columns}
                data={genderData}
                showPagination
                pageSize={50}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderData.length === 0 && (
          <Card>
            <CardContent>
              <div className="text-center py-8 text-neutral-600">
                No {genderLabel} competitors found.
              </div>
            </CardContent>
          </Card>
        )}
        {genderRun1Dns.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">DNS Run 1</h2>
              <DataTable
                columns={otherResultsColumns}
                data={genderRun1Dns}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderRun1Dnf.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">DNF Run 1</h2>
              <DataTable
                columns={otherResultsColumns}
                data={genderRun1Dnf}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderRun1Dsq.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">DSQ Run 1</h2>
              <DataTable
                columns={otherResultsColumns}
                data={genderRun1Dsq}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderData.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">Junior Results</h2>
              <DataTable
                columns={categoryColumns}
                data={genderData.filter((e) => e.is_junior).slice(0, 3)}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderData.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">Novice Results</h2>
              <DataTable
                columns={categoryColumns}
                data={genderData.filter((e) => e.is_novice).slice(0, 3)}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderData.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">Veteran Results</h2>
              <DataTable
                columns={categoryColumns}
                data={genderData.filter((e) => e.is_veteran).slice(0, 3)}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderData.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">Open Results</h2>
              <DataTable
                columns={categoryColumns}
                data={genderData.slice(0, 3)}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderMixedResults = () => (
    <div className="space-y-6">
      {data.length > 0 && (
        <Card>
          <CardContent>
            <DataTable
              columns={columns}
              data={data}
              showPagination={true}
              pageSize={50}
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
      {data.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Junior Results</h2>
            <DataTable
              columns={categoryColumns}
              data={data.filter((e) => e.is_junior).slice(0, 3)}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {data.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Novice Results</h2>
            <DataTable
              columns={categoryColumns}
              data={data.filter((e) => e.is_novice).slice(0, 3)}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {data.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Veteran Results</h2>
            <DataTable
              columns={categoryColumns}
              data={data.filter((e) => e.is_veteran).slice(0, 3)}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {data.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Female Results</h2>
            <DataTable
              columns={categoryColumns}
              data={data.filter((e) => e.gender === 'F').slice(0, 3)}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {data.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Open Results</h2>
            <DataTable
              columns={categoryColumns}
              data={data.slice(0, 3)}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );

  if (raceDetails?.women_separate) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'women' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('women')}
            >
              Women
            </Button>
            <Button
              variant={activeTab === 'men' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('men')}
            >
              Men
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => generatePDF(activeTab === 'women' ? 'F' : 'M')}>
              Download {activeTab === 'women' ? "Women's" : "Men's"} Results PDF
            </Button>
            <Button variant="outline" onClick={generateAllGenderPDFs}>
              Download All Individual PDFs
            </Button>
          </div>
        </div>
        {activeTab === 'women' && renderResultsForGender('F', 'women')}
        {activeTab === 'men' && renderResultsForGender('M', 'men')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-4">
        <Button onClick={() => generatePDF()}>
          Download PDF
        </Button>
      </div>
      {renderMixedResults()}
    </div>
  );
}

export default RaceResultOneRunNew;
export { raceQueryOneRun };