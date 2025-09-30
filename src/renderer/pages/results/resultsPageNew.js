import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  User,
  ArrowLeft,
  Calendar,
  MapPin
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

function ResultsPageNew() {
  const { competitionId } = useParams();
  const [races, setRaces] = useState([]);
  const [competitionName, setCompetitionName] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const handleBack = useBackButton();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch competition name
        const compQuery = 'SELECT competition_name FROM competitions WHERE id = ?';
        const compResult = await window.api.select(compQuery, [competitionId]);
        setCompetitionName(compResult[0].competition_name);

        // Fetch races
        const racesQuery = `
          SELECT
            r.race_id,
            r.race_name,
            r.race_date,
            r.venue,
            r.is_seeding,
            r.is_team,
            COUNT(DISTINCT rc.racer_id) as participant_count
          FROM races r
          LEFT JOIN race_competitor rc ON r.race_id = rc.race_id AND r.competition_id = rc.competition_id
          WHERE r.competition_id = ?
            AND NOT r.is_training
          GROUP BY r.race_id, r.race_name, r.race_date, r.venue, r.is_seeding, r.is_team
          ORDER BY r.race_date ASC
        `;
        const racesResult = await window.api.select(racesQuery, [competitionId]);
        setRaces(racesResult);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [competitionId]);

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Loading..." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`${competitionName} - Results`}
        subtitle="View race results and standings"
        actions={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/competition/${competitionId}/results/individual`)}
              leftIcon={<User className="w-4 h-4" />}
            >
              Overall Standings
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/competition/${competitionId}/results/team`)}
              leftIcon={<Users className="w-4 h-4" />}
            >
              Team Standings
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

      {races.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-600">
                No races found for this competition.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {races.map((race) => (
            <Card
              key={race.race_id}
              interactive
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/competition/${competitionId}/race/${race.race_id}/results`)}
            >
              <CardContent>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                      {race.race_name}
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      {race.is_seeding && (
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-info/10 text-info rounded">
                          Seeding Race
                        </span>
                      )}
                      {race.is_team && (
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-success/10 text-success rounded">
                          Team Race
                        </span>
                      )}
                    </div>
                  </div>
                  <Trophy className="w-6 h-6 text-primary-600 flex-shrink-0" />
                </div>

                <div className="space-y-2 text-sm text-neutral-600">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Date:</span>
                    <span>
                      {new Date(race.race_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Venue:</span>
                    <span>{race.venue}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Participants:</span>
                    <span>{race.participant_count || 0}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <span className="text-sm font-medium text-primary-600">
                    View Results →
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export default ResultsPageNew;