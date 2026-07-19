import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  List,
  ArrowLeft,
  Download,
  Shuffle,
  Users,
  Trophy,
  Save,
  Edit2
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
import { startListTwoRunPdf } from '../../utils/StartListTwoRunPdf';
import { getRaceDetails } from '../../utils/RaceDetails';
import { shuffleArray } from '../../utils/GenericUtils';
import { handleDatabaseError, handlePdfError, showSuccess } from '../../utils/ErrorHandler';
import toast from 'react-hot-toast';

export default function GenerateStartListNew() {
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
    race_name: '',
  });
  const [editMode, setEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  function refreshPage(){
    navigate(`/competition/${competitionId}/race/${raceId}/start-list`);
  }

  const getFetchSeedList = async () => {
    try {
      let completedRaces;
      completedRaces = await window.api.select(
        `SELECT DISTINCT rr.race_id AS raceId
          FROM race_run rr
          INNER JOIN races r ON r.race_id = rr.race_id
          WHERE rr.competition_id = ?
            AND NOT r.is_training
            AND rr.is_complete
          ORDER BY r.race_date ASC`,
        [competitionId],
      );
      if (completedRaces.length > 3) {
        completedRaces = await window.api.select(
          `SELECT
              DISTINCT rr.race_id AS raceId
          FROM race_results rr
          INNER JOIN races r
            ON r.race_id = rr.race_id
          WHERE rr.competition_id = ?
            AND NOT r.is_training
            AND NOT r.is_seeding
          ORDER BY r.race_date ASC`,
          [competitionId],
        );
      }
      const seedlist = await fetchSeedList(
        competitionId,
        completedRaces.map((e) => e.raceId),
      );
      setSeedList(seedlist);
    } catch (error) {
      handleDatabaseError('load seed list', error);
      setSeedList([]);
    }
  };

  const fetchRaceDetails = async () => {
    try {
      const details = await getRaceDetails(raceId, competitionId);
      if (!details) {
        throw new Error('Race details not found');
      }
      setRaceDetails(details);
    } catch (error) {
      handleDatabaseError('load race details', error);
      // Keep default race details
    }
  };

  const getStartList = async () => {
    try {
      const query = `
      SELECT
        p.id AS racer_id, p.first_name, p.last_name, p.gender, rc.bib_number,
        cc.is_reserve, cc.is_junior, cc.is_senior, cc.is_veteran, cc.title,
        cc.is_veteran, cc.is_female, cc.is_novice, seed_points, cc.regiment AS team
        FROM race_competitor rc
      INNER JOIN people p ON rc.racer_id = p.id
      INNER JOIN competition_competitor cc ON rc.racer_id = cc.racer_id AND rc.competition_id = cc.competition_id
--       LEFT JOIN competition_team_members ctm ON ctm.competition_id = rc.competition_id AND ctm.racer_id = rc.racer_id
--       LEFT JOIN competition_team ct ON ct.team_id = ctm.team_id AND ct.competition_id = ctm.competition_id
      WHERE rc.competition_id = ? AND rc.race_id = ?
--       AND NOT COALESCE(ct.is_female, FALSE)
--       AND NOT COALESCE(ct.is_hc, FALSE)
      ORDER BY bib_number
      `;
      const results = await window.api.select(query, [competitionId, raceId]);
      if (results.length > 0) {
        setStartListExists(true);
        if (raceDetails.women_separate) {
          setStartList(results.filter((r) => r.gender === 'M'));
          setWomenStartList(results.filter((r) => r.gender === 'F'));
        } else {
          setStartList(results);
        }
      }
    } catch (error) {
      handleDatabaseError('load start list', error);
      setStartList([]);
      setWomenStartList([]);
    } finally {
      setLoading(false);
    }
  };

  const generateStart = async () => {
    try {
      setLoading(true);

      let filteredSeedList = seedList.filter(
        (competitor) => !struckOutCompetitors[competitor.racer_id],
      );

      // Separate women if needed
      if (raceDetails.women_separate) {
        const womenSeedList = filteredSeedList.filter((c) => c.gender === 'F');
        const menSeedList = filteredSeedList.filter((c) => c.gender === 'M');

        // Process women's list
        if (womenSeedList.length > raceDetails.randomise_top_women) {
          const topWomen = shuffleArray(womenSeedList.slice(0, raceDetails.randomise_top_women));
          const restWomen = womenSeedList.slice(raceDetails.randomise_top_women);
          filteredSeedList = [...topWomen, ...restWomen];
        } else {
          filteredSeedList = shuffleArray(womenSeedList);
        }

        // Process men's list
        if (menSeedList.length > raceDetails.randomise_top) {
          const topMen = shuffleArray(menSeedList.slice(0, raceDetails.randomise_top));
          const restMen = menSeedList.slice(raceDetails.randomise_top);
          const menList = [...topMen, ...restMen];
          filteredSeedList = [...filteredSeedList, ...menList];
        } else {
          filteredSeedList = [...filteredSeedList, ...shuffleArray(menSeedList)];
        }
      } else {
        // Mixed start list
        if (filteredSeedList.length > raceDetails.randomise_top) {
          const topCompetitors = shuffleArray(filteredSeedList.slice(0, raceDetails.randomise_top));
          const restCompetitors = filteredSeedList.slice(raceDetails.randomise_top);
          filteredSeedList = [...topCompetitors, ...restCompetitors];
        } else {
          filteredSeedList = shuffleArray(filteredSeedList);
        }
      }

      // Clear and rebuild the start list in one atomic transaction, so a
      // failure part-way can never leave the race with a missing or
      // partially-written start list
      const operations = [
        {
          type: 'delete',
          query: `DELETE FROM race_competitor WHERE competition_id = ? AND race_id = ?`,
          params: [competitionId, raceId],
        },
        ...filteredSeedList.map((competitor, i) => ({
          type: 'insert',
          query: `INSERT INTO race_competitor (competition_id, race_id, racer_id, bib_number, seed_points)
                  VALUES (?, ?, ?, ?, ?)`,
          params: [
            competitionId,
            raceId,
            competitor.racer_id,
            i + 1,
            competitor.seed_points || 0,
          ],
        })),
      ];

      await window.api.transaction(operations);
      await getStartList();
      showSuccess('Start list generated successfully!');
    } catch (error) {
      handleDatabaseError('generate start list', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStrikeOut = (racerId) => {
    setStruckOutCompetitors((prev) => ({
      ...prev,
      [racerId]: !prev[racerId],
    }));
  };

  const handleBibChange = (list, setList, racerId, newBib) => {
    const bibNumber = parseInt(newBib, 10);
    if (isNaN(bibNumber) || bibNumber < 1) return;

    const newList = [...list];
    const competitorIndex = newList.findIndex(c => c.racer_id === racerId);
    if (competitorIndex === -1) return;

    newList[competitorIndex] = { ...newList[competitorIndex], bib_number: bibNumber };
    newList.sort((a, b) => a.bib_number - b.bib_number);

    setList(newList);
    setHasChanges(true);
  };

  const saveStartListChanges = async () => {
    try {
      setLoading(true);

      const allCompetitors = raceDetails.women_separate
        ? [...(womenStartList || []), ...(startList || [])]
        : (startList || []);

      await window.api.transaction(
        allCompetitors.map((competitor) => ({
          type: 'update',
          query: `UPDATE race_competitor SET bib_number = ? WHERE competition_id = ? AND race_id = ? AND racer_id = ?`,
          params: [competitor.bib_number, competitionId, raceId, competitor.racer_id],
        })),
      );

      setHasChanges(false);
      setEditMode(false);
      showSuccess('Start list order saved!');
    } catch (error) {
      handleDatabaseError('save start list', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      if (raceDetails.number_runs === 2) {
        await startListTwoRunPdf(raceDetails, startList, womenStartList);
      } else {
        await startListPdf(raceDetails, startList, womenStartList);
      }
      showSuccess('PDF generated successfully!');
    } catch (error) {
      handlePdfError('start list', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await fetchRaceDetails();
        await getFetchSeedList();
        await getStartList();
      } catch (error) {
        handleDatabaseError('initialise race page', error);
        setLoading(false);
      }
    };
    init();
  }, [raceId]);

  const getColumns = (list, setList, isEditMode) => [
    {
      header: 'Bib',
      accessorKey: 'bib_number',
      cell: ({ row }) => (
        isEditMode ? (
          <Input
            type="number"
            min="1"
            value={row.original.bib_number}
            onChange={(e) => handleBibChange(list, setList, row.original.racer_id, e.target.value)}
            className="w-16 font-mono text-center"
          />
        ) : (
          <Badge variant="primary" className="font-mono">
            {row.original.bib_number}
          </Badge>
        )
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
      header: 'Category',
      accessorKey: 'category',
      cell: ({ row }) => {
        const categories = [];
        if (row.original.is_female) categories.push('F');
        if (row.original.is_junior) categories.push('J');
        if (row.original.is_senior) categories.push('S');
        if (row.original.is_veteran) categories.push('V');
        if (row.original.is_novice) categories.push('N');
        if (row.original.is_reserve) categories.push('R');

        return (
          <Badge variant="secondary" className="mr-1">
            {categories.join("")}
          </Badge>
        );
      }
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
            {row.original.last_name}, {row.original.first_name}
          </div>
          <div className="text-xs text-neutral-500">{row.original.team}</div>
        </div>
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

  return (
    <PageContainer>
      <PageHeader
        title="Generate Start List"
        subtitle={`${raceDetails.race_name} - ${raceDetails.women_separate ? 'Separate Women\'s Start' : 'Mixed Start'}`}
        actions={
          <div className="flex gap-3">
            {startListExists && (
              <>
                {editMode ? (
                  <>
                    <Button
                      variant="success"
                      onClick={saveStartListChanges}
                      disabled={!hasChanges}
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Save Order
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditMode(false);
                        setHasChanges(false);
                        getStartList();
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setEditMode(true)}
                      leftIcon={<Edit2 className="w-4 h-4" />}
                    >
                      Edit Order
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleDownloadPDF}
                      leftIcon={<Download className="w-4 h-4" />}
                    >
                      Download PDF
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={refreshPage}
                      leftIcon={<Shuffle className="w-4 h-4" />}
                    >
                      Regenerate
                    </Button>
                  </>
                )}
              </>
            )}
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

      {!startListExists ? (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary-600" />
                Seed List
              </h3>
              <div className="mb-4 space-y-3">
                <div>
                  <Label htmlFor="randomise_top">Randomise Top (Men/Mixed)</Label>
                  <Input
                    id="randomise_top"
                    type="number"
                    value={raceDetails.randomise_top}
                    onChange={(e) => setRaceDetails(prev => ({
                      ...prev,
                      randomise_top: parseInt(e.target.value)
                    }))}
                  />
                </div>
                {raceDetails.women_separate && (
                  <div>
                    <Label htmlFor="randomise_top_women">Randomise Top (Women)</Label>
                    <Input
                      id="randomise_top_women"
                      type="number"
                      value={raceDetails.randomise_top_women}
                      onChange={(e) => setRaceDetails(prev => ({
                        ...prev,
                        randomise_top_women: parseInt(e.target.value)
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
                className="w-full"
                leftIcon={<List className="w-4 h-4" />}
              >
                Generate Start List
              </Button>
              <p className="text-sm text-neutral-600 mt-4">
                Strike out competitors who won't be racing, then generate the start list.
                The top {raceDetails.randomise_top} competitors will be randomised.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {raceDetails.women_separate && womenStartList && womenStartList.length > 0 && (
            <Card>
              <CardContent>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-pink-600" />
                  Women's Start List
                </h3>
                <DataTable columns={getColumns(womenStartList, setWomenStartList, editMode)} data={womenStartList} pageSize={50} />
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
                <DataTable columns={getColumns(startList, setStartList, editMode)} data={startList} pageSize={50} />
              ) : (
                <div className="text-center py-8 text-neutral-500">
                  No start list generated yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
