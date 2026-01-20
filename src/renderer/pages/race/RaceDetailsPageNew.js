import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  ArrowLeft,
  Edit,
  Calendar,
  MapPin,
  Users,
  Timer,
  Trash2,
  Upload,
  ClipboardEdit
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function RaceDetailsPageNew() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [raceDetails, setRaceDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRaceDetails();
  }, [raceId]);

  const fetchRaceDetails = async () => {
    try {
      const query = `
        SELECT
          r.*,
          CONCAT(cor.first_name, ' ', cor.last_name) AS cor_name,
          CONCAT(ref.first_name, ' ', ref.last_name) AS ref_name,
          CONCAT(td.first_name, ' ', td.last_name) AS td_name
        FROM races r
        LEFT JOIN people cor ON r.chief_of_race = cor.id
        LEFT JOIN people ref ON r.referee = ref.id
        LEFT JOIN people td ON r.tech_delegate = td.id
        WHERE race_id = ? AND competition_id = ?
      `;
      const result = await window.api.select(query, [raceId, competitionId]);
      if (result.length > 0) {
        setRaceDetails(result[0]);
      }
    } catch (error) {
      console.error('Failed to fetch race details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this race?')) {
      try {
        const operations = [
          { type: 'delete', query: 'DELETE FROM race_results WHERE race_id = ?', params: [raceId] },
          { type: 'delete', query: 'DELETE FROM race_run WHERE race_id = ?', params: [raceId] },
          { type: 'delete', query: 'DELETE FROM race_competitor WHERE race_id = ?', params: [raceId] },
          { type: 'delete', query: 'DELETE FROM races WHERE race_id = ?', params: [raceId] },
        ];
        await window.api.transaction(operations);
        navigate(`/competition/${competitionId}/race`);
      } catch (error) {
        console.error('Failed to delete race:', error);
      }
    }
  };

  if (loading || !raceDetails) {
    return (
      <PageContainer>
        <PageHeader title="Loading..." />
        <Card><CardContent>Loading race details...</CardContent></Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={raceDetails.race_name}
        subtitle={`${raceDetails.race_type} • ${raceDetails.venue || 'TBD'}`}
        actions={
          <div className="flex gap-3">
            <Button variant="primary" onClick={() => navigate(`/competition/${competitionId}/race/${raceId}/start-list`)}>
              Start List
            </Button>
            <Button variant="warning" onClick={() => navigate(`/competition/${competitionId}/race/${raceId}/results/edit`)} leftIcon={<ClipboardEdit className="w-4 h-4" />}>
              Record Results
            </Button>
            <Button variant="success" onClick={() => navigate(`/competition/${competitionId}/race/${raceId}/results`)}>
              View Results
            </Button>
            <Button variant="outline" onClick={() => navigate(`/competition/${competitionId}/race/${raceId}/results/import`)} leftIcon={<Upload className="w-4 h-4" />}>
              Import Results
            </Button>
            {raceDetails?.is_team === 1 && (
              <Button variant="outline" onClick={() => navigate(`/competition/${competitionId}/race/${raceId}/teams`)} leftIcon={<Users className="w-4 h-4" />}>
                Manage Teams
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(`/competition/${competitionId}/race/${raceId}/edit`)} leftIcon={<Edit className="w-4 h-4" />}>
              Edit
            </Button>
            <Button variant="danger" onClick={handleDelete} leftIcon={<Trash2 className="w-4 h-4" />}>
              Delete
            </Button>
            <Button variant="outline" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardContent>
            <h3 className="font-semibold mb-4">Race Information</h3>
            <dl className="space-y-2">
              <div><dt className="text-sm text-neutral-500">Type</dt><dd className="font-medium">{raceDetails.race_type}</dd></div>
              <div><dt className="text-sm text-neutral-500">Date</dt><dd className="font-medium">{raceDetails.race_date || 'TBD'}</dd></div>
              <div><dt className="text-sm text-neutral-500">Venue</dt><dd className="font-medium">{raceDetails.venue || 'TBD'}</dd></div>
              <div><dt className="text-sm text-neutral-500">Runs</dt><dd className="font-medium">{raceDetails.number_runs}</dd></div>
              {raceDetails.is_team ? <Badge variant="primary">Team Race</Badge> : null}
              {raceDetails.is_training ? <Badge variant="info">Training</Badge> : null}
              {raceDetails.is_seeding ? <Badge variant="primary">Seeding Race</Badge> : null}
              {raceDetails.women_separate ? <Badge variant="info">Separate Women</Badge> : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h3 className="font-semibold mb-4">Officials</h3>
            <dl className="space-y-2">
              <div><dt className="text-sm text-neutral-500">Chief of Race</dt><dd className="font-medium">{raceDetails.cor_name || 'TBD'}</dd></div>
              <div><dt className="text-sm text-neutral-500">Technical Delegate</dt><dd className="font-medium">{raceDetails.td_name || 'TBD'}</dd></div>
              <div><dt className="text-sm text-neutral-500">Referee</dt><dd className="font-medium">{raceDetails.ref_name || 'TBD'}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
