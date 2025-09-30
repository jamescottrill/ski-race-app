import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Download, Trophy } from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { fetchSeedList } from '../../utils/FetchSeedList';
import { generatePDF } from '../../pdfs/SeedList';

export default function IndividualResultsNew() {
  const [races, setRaces] = useState([]);
  const [selectedRaces, setSelectedRaces] = useState([]);
  const [seedList, setSeedList] = useState([]);
  const [junior, setJunior] = useState([]);
  const [veteran, setVeteran] = useState([]);
  const [novice, setNovice] = useState([]);
  const [female, setFemale] = useState([]);
  const [loading, setLoading] = useState(true);
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  const seedListPdf = () => {
    generatePDF(seedList, races);
  };

  const completedRaces = async () => {
    const query = `
        SELECT
          DISTINCT rr.race_id AS id, r.race_name AS text, r.race_date AS raceDate, r.is_seeding AS isSeeding
        FROM race_run rr
          INNER JOIN races r ON r.race_id = rr.race_id
        WHERE rr.competition_id = ?
          AND NOT r.is_training
          AND rr.is_complete
          AND r.is_individual
        ORDER BY r.race_date ASC`;
    const res = await window.api.select(query, [competitionId]);
    setRaces(res);
    setSelectedRaces(res.map((e) => e.id));
    return res;
  };

  useEffect(() => {
    const fetchList = async () => {
      try {
        setLoading(true);
        const initialRaces = await completedRaces();

        if (initialRaces.length === 0) {
          setLoading(false);
          return;
        }

        let data;
        if (initialRaces.length > 3) {
          data = await fetchSeedList(
            competitionId,
            initialRaces.filter((e) => !e.isSeeding).map((e) => e.id),
          );
        } else {
          data = await fetchSeedList(
            competitionId,
            initialRaces.map((e) => e.id),
          );
        }
        data = data.filter((e) => {
          for (const race of initialRaces) {
            if (e[race.id] === null) {
              return false;
            }
          }
          return true;
        });
        setNovice(data.filter((e) => e.is_novice));
        setJunior(data.filter((e) => e.is_junior));
        setVeteran(data.filter((e) => e.is_veteran));
        setFemale(data.filter((e) => e.gender === 'F'));
        setSeedList(data);
      } catch (error) {
        console.error('Failed to fetch individual results:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [competitionId]);

  const createColumns = (raceList) => {
    const baseColumns = [
      {
        header: 'Position',
        accessorKey: 'position',
        cell: ({ row, table }) => {
          const position = table.getSortedRowModel().rows.indexOf(row) + 1;
          return <div className="font-bold">{position}</div>;
        }
      },
      {
        header: 'Rank',
        accessorKey: 'title',
        cell: ({ row }) => row.original.title || '-'
      },
      {
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="font-medium">{row.original.last_name?.toUpperCase()} {row.original.first_name}
          </div>
        )
      },
      {
        header: 'Team',
        accessorKey: 'team_name',
        cell: ({ row }) => row.original.team_name || '-'
      }
    ];

    const raceColumns = raceList
      .filter((e) => selectedRaces.includes(e.id))
      .map((race) => ({
        header: race.text,
        accessorKey: race.id.toString(),
        cell: ({ row }) => (
          <div className="text-center font-mono">
            {row.original[race.id] || ''}
          </div>
        )
      }));

    const totalColumn = {
      header: 'Total Points',
      accessorKey: 'total_points',
      cell: ({ row }) => {
        // Calculate sum of all race points
        const total = raceList
          .filter((e) => selectedRaces.includes(e.id))
          .reduce((sum, race) => {
            const points = row.original[race.id];
            return sum + (points ? parseFloat(points) : 0);
          }, 0);

        return (
          <div className="text-center font-bold">
            {total}
          </div>
        );
      }
    };

    return [...baseColumns, ...raceColumns, totalColumn];
  };

  if (loading) {
    return (
      <PageContainer>
        <PageHeader
          title="Individual Results"
          subtitle="Overall competition standings"
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
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-neutral-200 rounded w-1/4 mx-auto"></div>
                <div className="h-4 bg-neutral-200 rounded w-1/2 mx-auto"></div>
                <div className="h-4 bg-neutral-200 rounded w-3/4 mx-auto"></div>
              </div>
              <p className="text-neutral-500 mt-4">Loading results...</p>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (selectedRaces.length === 0) {
    return (
      <PageContainer>
        <PageHeader
          title="Individual Results"
          subtitle="Overall competition standings"
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
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-600">
                You need at least one individual race completed to see the results.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Individual Results"
        subtitle="Overall competition standings"
        actions={
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={seedListPdf}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Download PDF
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

      {/* Overall Results */}
      {seedList.length > 0 && (
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-lg font-semibold mb-4">Overall Results</h2>
            <DataTable
              columns={createColumns(races)}
              data={seedList}
              pageSize={50}
            />
          </CardContent>
        </Card>
      )}

      {/* Female Results */}
      {female.length > 0 && (
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-lg font-semibold mb-4">Female Results</h2>
            <DataTable
              columns={createColumns(races)}
              data={female}
              pageSize={20}
            />
          </CardContent>
        </Card>
      )}

      {/* Junior Results */}
      {junior.length > 0 && (
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-lg font-semibold mb-4">Junior Results</h2>
            <DataTable
              columns={createColumns(races)}
              data={junior}
              pageSize={20}
            />
          </CardContent>
        </Card>
      )}

      {/* Veteran Results */}
      {veteran.length > 0 && (
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-lg font-semibold mb-4">Veteran Results</h2>
            <DataTable
              columns={createColumns(races)}
              data={veteran}
              pageSize={20}
            />
          </CardContent>
        </Card>
      )}

      {/* Novice Results */}
      {novice.length > 0 && (
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-lg font-semibold mb-4">Novice Results</h2>
            <DataTable
              columns={createColumns(races)}
              data={novice}
              pageSize={20}
            />
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
