import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  List, 
  ArrowLeft,
  Download,
  Shuffle,
  Users,
  Trophy,
  X
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge,
  Input,
  Label,
  Checkbox
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { fetchSeedList } from '../../utils/FetchSeedList';
import { startListPdf } from '../../utils/StartListPdf';
import { getRaceDetails } from '../../utils/RaceDetails';
import { shuffleArray } from '../../utils/GenericUtils';
import { handleDatabaseError, showSuccess } from '../../utils/ErrorHandler';

export default function GenerateStartListTeamNew() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [seedList, setSeedList] = useState([]);
  const [struckOutCompetitors, setStruckOutCompetitors] = useState({});
  const [startList, setStartList] = useState(null);
  const [womenStartList, setWomenStartList] = useState(null);
  const [startListExists, setStartListExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [raceDetails, setRaceDetails] = useState({
    women_separate: false,
    randomise_top: 15,
    randomise_top_women: 5,
    number_runs: 1,
  });

  function refreshPage(){
    navigate(`/competition/${competitionId}/race/${raceId}/team-start-list`);
  }

  const getFetchSeedList = async () => {
    let completedRaces;
    completedRaces = await window.api.select(
      `SELECT DISTINCT rr.race_id AS raceId FROM race_results rr INNER JOIN races r ON r.race_id = rr.race_id  WHERE rr.competition_id = ? AND NOT r.is_training ORDER BY r.race_date ASC`,
      [competitionId],
    );
    if (completedRaces.length > 3) {
      completedRaces = await window.api.select(
        `SELECT DISTINCT rr.race_id AS raceId FROM race_results rr INNER JOIN races r ON r.race_id = rr.race_id  WHERE rr.competition_id = ? AND NOT r.is_training AND NOT r.is_seeding ORDER BY r.race_date ASC`,
        [competitionId],
      );
    }
    const seedlist = await fetchSeedList(
      competitionId,
      completedRaces.map((e) => e.raceId),
    );
    setSeedList(seedlist);
  };

  const fetchRaceDetails = async () => {
    const details = await getRaceDetails(raceId, competitionId);
    setRaceDetails(details);
  };

  const getStartList = async () => {
    const query = `
    SELECT
      p.id AS racer_id, p.first_name, p.last_name, p.gender, rc.bib_number,
      cc.is_reserve, cc.is_junior, cc.is_senior, cc.is_veteran, cc.title,
      cc.is_veteran, cc.is_female, cc.is_novice, seed_points, cc.regiment AS team
      FROM race_competitor rc
    INNER JOIN people p ON rc.racer_id = p.id
    INNER JOIN competition_competitor cc ON rc.racer_id = cc.racer_id AND rc.competition_id = cc.competition_id
--     LEFT JOIN competition_team_members ctm ON ctm.competition_id = rc.competition_id AND ctm.racer_id = rc.racer_id
--     LEFT JOIN competition_team ct ON ct.team_id = ctm.team_id AND ct.competition_id = ctm.competition_id
    WHERE rc.competition_id = ? AND rc.race_id = ?
--     AND NOT COALESCE(ct.is_female, FALSE)
--     AND NOT COALESCE(ct.is_hc, FALSE)
    ORDER BY bib_number
    `;
    const results = await window.api.select(query, [competitionId, raceId]);
    if (results && results.length > 0) {
      setStartList(results);
      setStartListExists(true);
    }
    setLoading(false);
  };

  const generateStart = async () => {
    const activeCompetitors = seedList.filter(
      (competitor) => !struckOutCompetitors[competitor.racer_id],
    );
    let menStartList = [];
    let tmpWomenStartList = [];

    if (raceDetails.women_separate) {
      // Handle separate start lists for men and women
      let topMenCompetitors = activeCompetitors
        .filter((competitor) => competitor.gender === 'M')
        .slice(0, raceDetails.randomise_top);

      let topWomenCompetitors = activeCompetitors
        .filter((competitor) => competitor.gender === 'F')
        .slice(0, raceDetails.randomise_top_women);

      topMenCompetitors = shuffleArray(topMenCompetitors);
      topWomenCompetitors = shuffleArray(topWomenCompetitors);

      menStartList = [
        ...topMenCompetitors,
        ...activeCompetitors
          .filter((competitor) => competitor.gender === 'M')
          .slice(raceDetails.randomise_top),
      ];
      tmpWomenStartList = [
        ...topWomenCompetitors,
        ...activeCompetitors
          .filter((competitor) => competitor.gender === 'F')
          .slice(raceDetails.randomise_top_women),
      ];
    } else {
      // Combined start list
      let topCompetitors = activeCompetitors.slice(
        0,
        raceDetails.randomise_top,
      );
      topCompetitors = shuffleArray(topCompetitors);
      menStartList = [
        ...topCompetitors,
        ...activeCompetitors.slice(raceDetails.randomise_top),
      ];
    }
    setStartList(menStartList);
    setWomenStartList(raceDetails.women_separate ? tmpWomenStartList : null);
  };

  const handleStrikeOut = (racerId) => {
    setStruckOutCompetitors((prev) => ({
      ...prev,
      [racerId]: !prev[racerId],
    }));
  };

  const handleDownloadPDF = async () => {
    await startListPdf(raceDetails, startList, womenStartList);
  };

  // Builds the insert operations for one list; the caller runs all lists in
  // a single transaction so a failure can't leave a half-saved start list
  const buildSaveOperations = (list) => {
    const query = `
      INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number, seed_points)
      VALUES (?, ?, ?, ?, ?);
    `;
    const raceQuery = `
      INSERT INTO race_results (competition_id, race_id, racer_id, run_number)
      VALUES (?, ?, ?, 1);
    `;
    return list.flatMap((competitor, i) => [
      {
        type: 'insert',
        query,
        params: [
          competitionId,
          raceId,
          competitor.racer_id,
          i + 1,
          competitor.seed_points,
        ],
      },
      {
        type: 'insert',
        query: raceQuery,
        params: [competitionId, raceId, competitor.racer_id],
      },
    ]);
  };

  const deleteStartList = async () => {
    try {
      await window.api.transaction([
        {
          type: 'delete',
          query: `DELETE FROM race_competitor WHERE competition_id = ? AND race_id = ?`,
          params: [competitionId, raceId],
        },
        {
          type: 'delete',
          query: `DELETE FROM race_results WHERE competition_id = ? AND race_id = ?`,
          params: [competitionId, raceId],
        },
      ]);
      showSuccess('Start list deleted successfully.');
      setStartListExists(false);
      await getFetchSeedList();
    } catch (error) {
      handleDatabaseError('delete start list', error);
    }
  };

  const handleSaveStartList = async () => {
    try {
      const operations = womenStartList
        ? [...buildSaveOperations(startList), ...buildSaveOperations(womenStartList)]
        : buildSaveOperations(startList);
      await window.api.transaction(operations);
      showSuccess('Start list saved successfully.');
    } catch (error) {
      handleDatabaseError('save start list', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchRaceDetails();
      await getFetchSeedList();
      await getStartList();
    };
    init().catch(console.error);
  }, [competitionId, raceId]);

  const columns = [
    {
      header: 'Bib',
      accessorKey: 'bib_number',
      cell: ({ row }) => (
        <Badge variant="primary" className="font-mono">
          {row.original.bib_number || row.index + 1}
        </Badge>
      )
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.last_name}, {row.original.first_name}
            {row.original.title && <span className="ml-2 text-neutral-500">{row.original.title}</span>}
          </div>
          <div className="text-xs text-neutral-500">{row.original.team}</div>
        </div>
      )
    },
    {
      header: 'Gender',
      accessorKey: 'gender',
      cell: ({ row }) => (
        <Badge variant={row.original.gender === 'F' ? 'secondary' : 'outline'}>
          {row.original.gender}
        </Badge>
      )
    },
    {
      header: 'Seed Points',
      accessorKey: 'seed_points',
      cell: ({ row }) => (
        <span className="font-mono">
          {row.original.seed_points ? row.original.seed_points.toFixed(2) : '0.00'}
        </span>
      )
    }
  ];

  const seedListColumns = [
    {
      header: 'Strike Out',
      id: 'strikeout',
      cell: ({ row }) => (
        <Checkbox
          checked={struckOutCompetitors[row.original.racer_id] || false}
          onCheckedChange={() => handleStrikeOut(row.original.racer_id)}
        />
      )
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div className={struckOutCompetitors[row.original.racer_id] ? 'line-through opacity-50' : ''}>
          <div className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </div>
          <div className="text-xs text-neutral-500">{row.original.team}</div>
        </div>
      )
    },
    {
      header: 'Gender',
      accessorKey: 'gender',
      cell: ({ row }) => (
        <Badge variant={row.original.gender === 'F' ? 'secondary' : 'outline'}>
          {row.original.gender}
        </Badge>
      )
    },
    {
      header: 'Seed Points',
      accessorKey: 'seed_points',
      cell: ({ row }) => (
        <span className={`font-mono ${struckOutCompetitors[row.original.racer_id] ? 'line-through opacity-50' : ''}`}>
          {row.original.seed_points ? row.original.seed_points.toFixed(2) : '0.00'}
        </span>
      )
    }
  ];

  if (startListExists) {
    return (
      <PageContainer>
        <PageHeader
          title="Team Race Start List"
          subtitle={`Race ${raceId}`}
          actions={
            <div className="flex gap-3">
              <Button 
                variant="primary" 
                onClick={handleDownloadPDF}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download PDF
              </Button>
              <Button 
                variant="destructive" 
                onClick={deleteStartList}
                leftIcon={<X className="w-4 h-4" />}
              >
                Delete Start List
              </Button>
              <Button
                variant="outline"
                onClick={handleBack}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
            </div>
          }
        />

        <div className="space-y-6">
          {raceDetails.women_separate && womenStartList && womenStartList.length > 0 && (
            <Card>
              <CardContent>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-pink-600" />
                  Women's Start List
                </h3>
                <DataTable columns={columns} data={womenStartList} pageSize={50} />
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" />
                {raceDetails.women_separate ? "Men's Start List" : "Start List"}
              </h3>
              {loading ? (
                <div className="text-center py-8">Loading start list...</div>
              ) : startList && startList.length > 0 ? (
                <DataTable columns={columns} data={startList} pageSize={50} />
              ) : (
                <div className="text-center py-8 text-neutral-500">
                  No start list exists
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Generate Team Race Start List"
        subtitle={`Race ${raceId} - ${raceDetails.women_separate ? 'Separate Women\'s Start' : 'Mixed Start'}`}
        actions={
          <Button
            variant="outline"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary-600" />
              Competitors
            </h3>
            <div className="mb-4 space-y-3">
              <div>
                <Label htmlFor="randomise_top">Top X to Randomise</Label>
                <Input
                  id="randomise_top"
                  type="number"
                  value={raceDetails.randomise_top}
                  onChange={(e) => setRaceDetails(prev => ({
                    ...prev,
                    randomise_top: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
              {raceDetails.women_separate !== 0 && (
                <div>
                  <Label htmlFor="randomise_top_women">Top X Women to Randomise</Label>
                  <Input
                    id="randomise_top_women"
                    type="number"
                    value={raceDetails.randomise_top_women}
                    onChange={(e) => setRaceDetails(prev => ({
                      ...prev,
                      randomise_top_women: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
              )}
            </div>
            {loading ? (
              <div className="text-center py-8">Loading seed list...</div>
            ) : (
              <DataTable 
                columns={seedListColumns} 
                data={seedList}
                pageSize={20}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h3 className="font-semibold mb-4">Actions</h3>
            <Button
              variant="primary"
              onClick={generateStart}
              className="w-full mb-4"
              leftIcon={<List className="w-4 h-4" />}
            >
              Generate Start List
            </Button>
            
            {startList && (
              <>
                <Button
                  variant="success"
                  onClick={handleSaveStartList}
                  className="w-full mb-4"
                >
                  Save Start List
                </Button>
                
                <div className="space-y-4">
                  {raceDetails.women_separate && womenStartList && (
                    <div>
                      <h4 className="font-medium mb-2">Women's Start List Preview</h4>
                      <div className="max-h-48 overflow-y-auto border rounded p-2">
                        {womenStartList.map((competitor, index) => (
                          <div key={competitor.racer_id} className="text-sm py-1">
                            Bib {index + 1}: {competitor.first_name} {competitor.last_name} ({competitor.seed_points.toFixed(2)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium mb-2">
                      {raceDetails.women_separate ? "Men's Start List Preview" : "Start List Preview"}
                    </h4>
                    <div className="max-h-48 overflow-y-auto border rounded p-2">
                      {startList.map((competitor, index) => (
                        <div key={competitor.racer_id} className="text-sm py-1">
                          Bib {index + 1}: {competitor.first_name} {competitor.last_name} ({competitor.seed_points.toFixed(2)})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            <p className="text-sm text-neutral-600 mt-4">
              Strike out competitors who won't be racing, then generate the start list.
              The top {raceDetails.randomise_top} competitors will be randomised.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}