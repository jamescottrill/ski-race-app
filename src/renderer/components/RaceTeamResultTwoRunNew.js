// eslint-disable no-nested-ternary
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, DataTable, Badge, Button } from '../design-system';
import OtherResultTable from './DnsTable';
import { convertRaceTime } from '../utils/TimeUtils';
import { resultsTeamPdf } from '../utils/ResultsTeamPdf';
import { getRaceDetails } from '../utils/RaceDetails';

const TEAM_CATEGORIES = {
  REGIMENTAL: 'regimental',
  CORPS_OPEN: 'corps_open',
  CORPS_WOMEN: 'corps_women',
};

const getCategoryLabel = (category) => {
  switch (category) {
    case TEAM_CATEGORIES.REGIMENTAL:
      return 'Regimental';
    case TEAM_CATEGORIES.CORPS_OPEN:
      return 'Corps Open';
    case TEAM_CATEGORIES.CORPS_WOMEN:
      return 'Corps Women';
    default:
      return 'All';
  }
};

const getTeamCategory = (team) => {
  if (team.is_corps === 1 || team.is_corps === true) {
    if (team.is_female === 1 || team.is_female === true) {
      return TEAM_CATEGORIES.CORPS_WOMEN;
    }
    return TEAM_CATEGORIES.CORPS_OPEN;
  }
  return TEAM_CATEGORIES.REGIMENTAL;
};

export default function RaceTeamResultTwoRunNew({
  raceId,
  competitionId,
}) {
  const [allData, setAllData] = useState([]);
  const [allDnfTeams, setAllDnfTeams] = useState([]);
  const [raceDetails, setRaceDetails] = useState([]);
  const [activeCategory, setActiveCategory] = useState(TEAM_CATEGORIES.REGIMENTAL);

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
                          ct.team_id,
                          COALESCE(ct.is_corps, 0) AS is_corps,
                          COALESCE(ct.is_female, 0) AS is_female,
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
        teamId: result.team_id,
        is_corps: result.is_corps,
        is_female: result.is_female,
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

    // Group by team_id to handle teams properly
    const uniqueTeams = [];
    const seenTeamIds = new Set();
    mapped.forEach((r) => {
      if (r.teamId && !seenTeamIds.has(r.teamId)) {
        seenTeamIds.add(r.teamId);
        uniqueTeams.push({
          teamId: r.teamId,
          teamName: r.teamName,
          is_corps: r.is_corps,
          is_female: r.is_female,
        });
      }
    });

    uniqueTeams.forEach((team) => {
      const sortedRacers = finished.filter((r) => r.teamId === team.teamId).sort((a, b) => a.seedPoints - b.seedPoints);

      // Determine required team size based on category
      const category = getTeamCategory(team);
      let requiredMembers = 3; // Regimental default
      if (category === TEAM_CATEGORIES.CORPS_OPEN) {
        requiredMembers = 4;
      } else if (category === TEAM_CATEGORIES.CORPS_WOMEN) {
        requiredMembers = 2;
      }

      const topNRacers = sortedRacers.slice(0, requiredMembers);
      if (sortedRacers.length < requiredMembers) {
        dnfTeams.push({ teamName: team.teamName, category });
        return;
      }
      const topNPoints = topNRacers.reduce((acc, curr) => acc + curr.seedPoints, 0);
      const topNTimesSecs = topNRacers.reduce((acc, curr) => acc + curr.totalTimeSecs, 0);
      const topNTimes = convertRaceTime(topNTimesSecs);
      const isHc = topNRacers.length > 0 && topNRacers[0].isHc;
      const teamResult = {
        teamName: team.teamName,
        teamId: team.teamId,
        category,
        racers: topNRacers,
        points: topNPoints,
        time: topNTimes,
        isHc,
      };
      teamResults.push(teamResult);
    });

    // Sort by points (positions will be calculated per category when filtering)
    teamResults.sort((a, b) => a.points - b.points);
    dnfTeams.sort((a, b) => (a.teamName || '').localeCompare(b.teamName || ''));

    setAllData(teamResults);
    setAllDnfTeams(dnfTeams);
  };

  useEffect(() => {
    initialData();
    initRaceDetails().catch(console.error);
  }, [raceId, competitionId]);

  // Filter and calculate positions per category
  const { data, dnfTeams } = useMemo(() => {
    const filtered = allData.filter((team) => team.category === activeCategory);

    // Calculate positions for this category
    let position = 1;
    const withPositions = filtered.map((team) => {
      const teamCopy = { ...team };
      if (teamCopy.isHc) {
        teamCopy.position = '';
      } else {
        teamCopy.position = position;
        position += 1;
      }
      return teamCopy;
    });

    const filteredDnf = allDnfTeams.filter((team) => team.category === activeCategory);

    return { data: withPositions, dnfTeams: filteredDnf };
  }, [allData, allDnfTeams, activeCategory]);

  const categoryCounts = useMemo(() => ({
    [TEAM_CATEGORIES.REGIMENTAL]: allData.filter((t) => t.category === TEAM_CATEGORIES.REGIMENTAL).length,
    [TEAM_CATEGORIES.CORPS_OPEN]: allData.filter((t) => t.category === TEAM_CATEGORIES.CORPS_OPEN).length,
    [TEAM_CATEGORIES.CORPS_WOMEN]: allData.filter((t) => t.category === TEAM_CATEGORIES.CORPS_WOMEN).length,
  }), [allData]);

  const getDataForCategory = (category) => {
    const filtered = allData.filter((team) => team.category === category);
    let position = 1;
    const withPositions = filtered.map((team) => {
      const teamCopy = { ...team };
      if (teamCopy.isHc) {
        teamCopy.position = '';
      } else {
        teamCopy.position = position;
        position += 1;
      }
      return teamCopy;
    });
    const filteredDnf = allDnfTeams.filter((team) => team.category === category);
    return { data: withPositions, dnfTeams: filteredDnf };
  };

  const generatePDF = () => {
    resultsTeamPdf(
      raceDetails,
      data,
      dnfTeams,
      getCategoryLabel(activeCategory)
    );
  };

  const generateAllPDFs = () => {
    const categories = [TEAM_CATEGORIES.REGIMENTAL, TEAM_CATEGORIES.CORPS_OPEN, TEAM_CATEGORIES.CORPS_WOMEN];
    categories.forEach((category) => {
      const { data: categoryData, dnfTeams: categoryDnfTeams } = getDataForCategory(category);
      if (categoryData.length > 0 || categoryDnfTeams.length > 0) {
        resultsTeamPdf(raceDetails, categoryData, categoryDnfTeams, getCategoryLabel(category));
      }
    });
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
      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant={activeCategory === TEAM_CATEGORIES.REGIMENTAL ? 'primary' : 'outline'}
            onClick={() => setActiveCategory(TEAM_CATEGORIES.REGIMENTAL)}
          >
            Regimental ({categoryCounts[TEAM_CATEGORIES.REGIMENTAL]})
          </Button>
          <Button
            variant={activeCategory === TEAM_CATEGORIES.CORPS_OPEN ? 'primary' : 'outline'}
            onClick={() => setActiveCategory(TEAM_CATEGORIES.CORPS_OPEN)}
          >
            Corps Open ({categoryCounts[TEAM_CATEGORIES.CORPS_OPEN]})
          </Button>
          <Button
            variant={activeCategory === TEAM_CATEGORIES.CORPS_WOMEN ? 'primary' : 'outline'}
            onClick={() => setActiveCategory(TEAM_CATEGORIES.CORPS_WOMEN)}
          >
            Corps Women ({categoryCounts[TEAM_CATEGORIES.CORPS_WOMEN]})
          </Button>
        </div>
        <div className="flex gap-2">
          <Button onClick={generatePDF}>
            Download {getCategoryLabel(activeCategory)} PDF
          </Button>
          <Button variant="outline" onClick={generateAllPDFs}>
            Download All Team PDFs
          </Button>
        </div>
      </div>

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
            <h2 className="text-lg font-semibold mb-4 text-center">Incomplete Teams</h2>
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
      {data.length === 0 && dnfTeams.length === 0 && (
        <Card>
          <CardContent>
            <div className="text-center py-8 text-neutral-600">
              No {getCategoryLabel(activeCategory).toLowerCase()} teams found.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
