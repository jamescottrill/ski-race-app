// eslint-disable no-nested-ternary
import React, { useEffect, useState } from 'react';
import { Card, CardContent, DataTable, Badge, Button } from '../design-system';
import OtherResultTable from './DnsTable';
import { convertRaceTime } from '../utils/TimeUtils';
import { resultsTeamPdf } from '../utils/ResultsTeamPdf';
import { getRaceDetails } from '../utils/RaceDetails';

export default function RaceTeamResultTwoRunNew({
  raceId,
  competitionId,
}) {
  const [data, setData] = useState([]);
  const [dnfTeams, setDnfTeams] = useState([]);
  const [raceDetails, setRaceDetails] = useState([]);

  const initRaceDetails = async () => {
    const details = await getRaceDetails(raceId, competitionId);
    setRaceDetails(details);
  };

  const initialData = async () => {
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
                          COALESCE(is_ns, FALSE) AS is_ns
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
                          CASE WHEN run1.is_ns OR run2.is_ns THEN 1 ELSE 0 END                     AS is_ns,
                          CASE WHEN run1.is_dns OR run2.is_dns THEN 1 ELSE 0 END                   AS is_dns,
                          CASE WHEN run1.is_dnf OR run2.is_dnf THEN 1 ELSE 0 END                   AS is_dnf,
                          CASE WHEN run1.is_dsq OR run2.is_dsq THEN 1 ELSE 0 END                   AS is_dsq,
                          p.first_name,
                          p.last_name,
                          cc.title,
                          rc.bib_number,
                          ct.team_name,
                          f.factor                                                                  AS factor,
                          MIN(COALESCE(run1.race_time, 9999) + COALESCE(run2.race_time, 9999))
                              OVER (ORDER BY run1.race_id)                                          AS mintime
                   FROM run1
                          LEFT JOIN run2 ON run1.racer_id = run2.racer_id
                          JOIN people p ON p.id = run1.racer_id
                          JOIN race_competitor rc ON run1.race_id = rc.race_id AND run1.racer_id = rc.racer_id
                          JOIN competition_competitor cc ON cc.racer_id = p.id AND cc.competition_id = run1.competition_id
                          JOIN races r ON r.race_id = run1.race_id
                          JOIN factors f ON f.race = r.race_type
                          LEFT JOIN competition_team_members ctm on p.id = ctm.racer_id AND ctm.competition_id = run1.competition_id AND ctm.race_id = run1.race_id
                          LEFT JOIN competition_team ct on ctm.team_id = ct.team_id AND ctm.competition_id = ct.competition_id
                       WHERE NOT COALESCE(ct.is_corps, FALSE) AND NOT COALESCE(ct.is_female, FALSE)
          )
     SELECT
       *,
       ROUND((total_time - mintime) / mintime * factor, 2) AS seed_points,
       RANK() OVER (ORDER BY total_time) AS position,
       (SELECT COALESCE(ct2.is_hc, 0) FROM competition_team ct2
        JOIN competition_team_members ctm2 ON ct2.team_id = ctm2.team_id AND ct2.competition_id = ctm2.competition_id
        WHERE ctm2.racer_id = data.racer_id AND ctm2.race_id = data.race_id LIMIT 1) AS is_hc
     FROM data
     ORDER BY total_time
   `;
    const raceQueryValues = [raceId, raceId];
    let results = [];
    try {
      results = await window.api.select(raceQuery, raceQueryValues);
      console.log(results);
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
        run1Ns: result.is_ns,
        run1Dns: result.run_1_dns,
        run2Dns: result.run_2_dns,
        run1Dsq: result.run_1_dsq,
        run2Dsq: result.run_2_dsq,
        run1Dnf: result.run_1_dnf,
        run2Dnf: result.run_2_dnf,
        completed:
          !result.run_1_dns &&
          !result.run_1_dnf &&
          !result.run_1_dsq &&
          !result.run_2_dns &&
          !result.run_2_dnf &&
          !result.run_2_dsq &&
          !result.is_ns,
        totalTime: convertRaceTime(result.total_time),
        totalTimeSecs: result.total_time,
        firstName: result.first_name,
        lastName: result.last_name,
        title: result.title,
        teamName: result.team_name,
        seedPoints: result.seed_points,
        bibNumber: result.bib_number,
        position: result.position,
        gender: result.gender,
        is_novice: result.is_novice,
        is_junior: result.is_junior,
        is_senior: result.is_senior,
        is_veteran: result.is_veteran,
        is_reserve: result.is_reserve,
        isHc: Boolean(result.is_hc),
      };
    });
    const finished = mapped
      .filter((e) => {
        return e.completed;
      });
    console.log(mapped);

    const teamResults = [];
    const dnfTeams = [];
    const teamNames = mapped.map(r => r.teamName).filter((teamName, index, self) => {
      return self.indexOf(teamName) === index && teamName !== null;
    });
    teamNames.forEach((teamName) => {
      const sortedRacers = finished.filter((r) => r.teamName === teamName).sort((a, b) => a.points - b.points);
      const topNRacers = sortedRacers.slice(0, 3);
      if (sortedRacers.length < 3) {
        dnfTeams.push({ teamName });
        return;
      }
      const topNPoints = topNRacers.reduce((acc, curr) => acc + curr.seedPoints, 0);
      const topNTimesSecs = topNRacers.reduce((acc, curr) => acc + curr.totalTimeSecs, 0);
      const topNTimes = convertRaceTime(topNTimesSecs);
      const isHc = topNRacers.length > 0 && topNRacers[0].isHc;
      const teamResult = { teamName, racers: topNRacers, points: topNPoints, time: topNTimes, isHc };
      teamResults.push(teamResult);
    });
    teamResults.sort((a, b) => a.points - b.points);
    let position = 1;
    teamResults.forEach((result) => {
      if (result.isHc) {
        result.position = '';
      } else {
        result.position = position;
        position += 1;
      }
    });
    setData(teamResults);
    setDnfTeams(dnfTeams);
  };

  useEffect(() => {
    initialData();
    initRaceDetails().catch(console.error);
  }, [raceId, competitionId]);

  const generatePDF = () => {
    resultsTeamPdf(
      raceDetails,
      data,
      dnfTeams
    );
  };

  // Define columns for team results DataTable
  const teamResultsColumns = [
    {
      accessorKey: 'position',
      header: 'Position',
      cell: ({ row, table }) => {
        const teamData = row.original;
        // Only show position for the first racer in the team
        return (
          <div className="text-center font-medium">
            {teamData.position}
          </div>
        );
      },
    },
    {
      accessorKey: 'time',
      header: 'Total Time',
      cell: ({ row }) => (
        <div className="text-center font-medium">{row.original.time}</div>
      ),
    },
    {
      accessorKey: 'teamName',
      header: 'Team',
      cell: ({ row }) => (
        <div className="text-center font-medium">{row.original.teamName}</div>
      ),
    },
    {
      accessorKey: 'racers',
      header: 'Racers',
      cell: ({ row }) => (
        <div className="space-y-1">
          {row.original.racers.map((racer, idx) => (
            <div key={idx} className="text-sm border-b last:border-b-0 pb-1 last:pb-0">
              <div className="flex justify-between items-center">
                <span className="font-medium">{racer.title}</span>
                <span>{racer.lastName.toUpperCase()} {racer.firstName}</span>
                <span className="text-neutral-600">{racer.totalTime}</span>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'points',
      header: 'Race Points',
      cell: ({ row }) => (
        <div className="text-center font-medium">{row.original.points}</div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {data.length > 0 && (
        <Card>
          <CardContent>
            <DataTable
              columns={teamResultsColumns}
              data={data}
              showPagination={true}
              pageSize={50}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
      {dnfTeams.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-4 text-center">Disqualified Teams</h2>
            <div className="space-y-2">
              {dnfTeams.map((row, index) => (
                <div key={index} className="text-center py-2 border-b last:border-b-0">
                  {row.teamName}
                </div>
              ))}
            </div>
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

      <div className="flex justify-center">
        <Button onClick={generatePDF}>
          Download PDF
        </Button>
      </div>
    </div>
  );
}
