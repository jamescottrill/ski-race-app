// eslint-disable no-nested-ternary
import React, { useEffect, useState } from 'react';
import { Card, CardContent, DataTable, Badge, Button, Tabs, TabsList, TabsTrigger, TabsContent } from '../design-system';
import OtherResultTable from './DnsTable';
import { resultsTwoPdf } from '../utils/ResultsTwoPdf';
import { getRaceDetails } from '../utils/RaceDetails';
import { convertRaceTime } from '../utils/TimeUtils';
import ResultTable from './ResultTable';

const raceQuery = `
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
               run2 AS (SELECT race_id,
                               racer_id,
                               ROUND(race_time, 2) AS race_time,
                               COALESCE(is_dsq, FALSE) AS is_dsq,
                               COALESCE(is_dnf, FALSE) AS is_dnf,
                               COALESCE(is_dns, FALSE) AS is_dns,
                               COALESCE(is_ns, FALSE) AS is_ns,
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
                               run1.is_ns                                                                AS run_1_ns,
                               run2.is_ns                                                                AS run_2_ns,
                               run1.dsq_gate                                                             AS run_1_dsq_gate,
                               run2.dsq_gate                                                             AS run_2_dsq_gate,
                               run1.dsq_reason                                                           AS run_1_dsq_reason,
                               run2.dsq_reason                                                           AS run_2_dsq_reason,
                               CASE WHEN run1.is_dns OR run2.is_dns THEN 1 ELSE 0 END                   AS is_dns,
                               CASE WHEN run1.is_dnf OR run2.is_dnf THEN 1 ELSE 0 END                   AS is_dnf,
                               CASE WHEN run1.is_dsq OR run2.is_dsq THEN 1 ELSE 0 END                   AS is_dsq,
                               p.first_name,
                               p.last_name,
                               cc.title,
                               rc.bib_number,
                               cc.regiment AS team,
                               f.factor                                                                  AS factor,
                               MIN(COALESCE(run1.race_time, 9999) + COALESCE(run2.race_time, 9999))
                                   OVER (ORDER BY run1.race_id)                                          AS mintime,
                               cc.is_novice,
                               p.gender,
                               cc.is_junior,
                               cc.is_senior,
                               cc.is_veteran,
                               cc.is_reserve,
                               RANK() OVER (PARTITION BY run1.race_id ORDER BY rc.seed_points)      AS seed_order
                        FROM run1
                               LEFT JOIN run2 ON run1.racer_id = run2.racer_id
                               JOIN people p ON p.id = run1.racer_id
                               JOIN race_competitor rc ON run1.race_id = rc.race_id AND run1.racer_id = rc.racer_id
                               JOIN competition_competitor cc ON cc.racer_id = p.id AND cc.competition_id = run1.competition_id
                               JOIN races r ON r.race_id = run1.race_id
                               JOIN factors f ON f.race = r.race_type
               )
          SELECT
            *,
            ROUND((total_time - mintime) / mintime * factor, 2) AS seed_points,
            RANK() OVER (ORDER BY total_time) AS position
          FROM data
          ORDER BY total_time
        `;

const RaceResultTwoRunNew = ({ raceId, competitionId }) => {
  const [finished, setFinished] = useState([]);
  const [run1Dnf, setRun1Dnf] = useState([]);
  const [run1Dns, setRun1Dns] = useState([]);
  const [run1Dsq, setRun1Dsq] = useState([]);
  const [run2Dnf, setRun2Dnf] = useState([]);
  const [run2Dns, setRun2Dns] = useState([]);
  const [run2Dsq, setRun2Dsq] = useState([]);
  const [raceDetails, setRaceDetails] = useState({});
  const [activeTab, setActiveTab] = useState('women');

  const initialData = async () => {
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
        run1Ns: result.run_1_ns,
        run2Ns: result.run_2_ns,
        run1Dns: result.run_1_dns || result.run_1_ns,
        run2Dns: result.run_2_dns || result.run_2_ns,
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
          !result.run_2_dsq &&
          !result.run_1_ns &&
          !result.run_2_ns,
        totalTime: convertRaceTime(result.total_time),
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
        return e.run2Dns || e.run2Ns;
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
    setFinished(finished);
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

  const generatePDF = (gender = null) => {
    if (gender) {
      const genderLabel = gender === 'F' ? 'Women' : 'Men';
      const genderRaceDetails = {
        ...raceDetails,
        race_name: `${raceDetails.race_name} - ${genderLabel}`,
      };
      const genderFinished = finished
        .filter((e) => e.gender === gender)
        .map((e, i) => ({ ...e, position: i + 1 }));
      const genderRun1Dns = run1Dns.filter((e) => e.gender === gender);
      const genderRun1Dnf = run1Dnf.filter((e) => e.gender === gender);
      const genderRun1Dsq = run1Dsq.filter((e) => e.gender === gender);
      const genderRun2Dns = run2Dns.filter((e) => e.gender === gender);
      const genderRun2Dnf = run2Dnf.filter((e) => e.gender === gender);
      const genderRun2Dsq = run2Dsq.filter((e) => e.gender === gender);
      resultsTwoPdf(
        genderRaceDetails,
        genderFinished,
        genderRun1Dns,
        genderRun1Dnf,
        genderRun1Dsq,
        genderRun2Dns,
        genderRun2Dnf,
        genderRun2Dsq,
      );
    } else {
      resultsTwoPdf(
        raceDetails,
        finished,
        run1Dns,
        run1Dnf,
        run1Dsq,
        run2Dns,
        run2Dnf,
        run2Dsq,
      );
    }
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
      accessorKey: 'run2Time',
      header: 'Time Second Run',
      cell: ({ row }) => (
        <div className="text-center">{row.original.run2Time}</div>
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
      accessorKey: 'seedPoints',
      header: 'Race Points',
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
    const genderFinished = finished
      .filter((e) => e.gender === gender)
      .map((e, i) => ({ ...e, position: i + 1 }));
    const genderRun1Dns = run1Dns.filter((e) => e.gender === gender);
    const genderRun1Dnf = run1Dnf.filter((e) => e.gender === gender);
    const genderRun1Dsq = run1Dsq.filter((e) => e.gender === gender);
    const genderRun2Dns = run2Dns.filter((e) => e.gender === gender);
    const genderRun2Dnf = run2Dnf.filter((e) => e.gender === gender);
    const genderRun2Dsq = run2Dsq.filter((e) => e.gender === gender);

    return (
      <div className="space-y-6">
        {genderFinished.length > 0 && (
          <Card>
            <CardContent>
              <DataTable
                columns={columns}
                data={genderFinished}
                showPagination
                pageSize={50}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderFinished.length === 0 && (
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
        {genderRun2Dns.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">DNS Run 2</h2>
              <DataTable
                columns={otherResultsColumns}
                data={genderRun2Dns}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderRun2Dnf.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">DNF Run 2</h2>
              <DataTable
                columns={otherResultsColumns}
                data={genderRun2Dnf}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderRun2Dsq.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">DSQ Run 2</h2>
              <DataTable
                columns={otherResultsColumns}
                data={genderRun2Dsq}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderFinished.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">Junior Results</h2>
              <DataTable
                columns={categoryColumns}
                data={genderFinished.filter((e) => e.is_junior).slice(0, 3)}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderFinished.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">Novice Results</h2>
              <DataTable
                columns={categoryColumns}
                data={genderFinished.filter((e) => e.is_novice).slice(0, 3)}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderFinished.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">Veteran Results</h2>
              <DataTable
                columns={categoryColumns}
                data={genderFinished.filter((e) => e.is_veteran).slice(0, 3)}
                showPagination={false}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}
        {genderFinished.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold mb-4 text-center">Open Results</h2>
              <DataTable
                columns={categoryColumns}
                data={genderFinished.slice(0, 3)}
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
      {finished.length > 0 && (
        <Card>
          <CardContent>
            <DataTable
              columns={columns}
              data={finished}
              showPagination
              pageSize={50}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {finished.length === 0 && (
        <Card>
          <CardContent>
            <div className="text-center py-8 text-neutral-600">
              No Competitors found, make sure you&apos;ve marked the previous run as finished.
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
      {finished.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Junior Results</h2>
            <DataTable
              columns={categoryColumns}
              data={finished.filter((e) => e.is_junior).slice(0, 3)}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {finished.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Novice Results</h2>
            <DataTable
              columns={categoryColumns}
              data={finished.filter((e) => e.is_novice).slice(0, 3)}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {finished.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Veteran Results</h2>
            <DataTable
              columns={categoryColumns}
              data={finished.filter((e) => e.is_veteran).slice(0, 3)}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {finished.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Female Results</h2>
            <DataTable
              columns={categoryColumns}
              data={finished.filter((e) => e.gender === "F").slice(0, 3)}
              showPagination={false}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {finished.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Open Results</h2>
            <DataTable
              columns={categoryColumns}
              data={finished.slice(0, 3)}
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start border-b mb-4">
            <TabsTrigger value="women">Women</TabsTrigger>
            <TabsTrigger value="men">Men</TabsTrigger>
          </TabsList>
          <TabsContent value="women">
            {renderResultsForGender('F', 'women')}
            <div className="flex justify-center mt-6">
              <Button onClick={() => generatePDF('F')}>
                Download Women&apos;s Results PDF
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="men">
            {renderResultsForGender('M', 'men')}
            <div className="flex justify-center mt-6">
              <Button onClick={() => generatePDF('M')}>
                Download Men&apos;s Results PDF
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderMixedResults()}
      <div className="flex justify-center">
        <Button onClick={generatePDF}>
          Download PDF
        </Button>
      </div>
    </div>
  );
};

export default RaceResultTwoRunNew;
export { raceQuery };
