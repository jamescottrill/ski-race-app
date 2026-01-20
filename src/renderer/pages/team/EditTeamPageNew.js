import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  Input,
  Checkbox
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function EditTeamPageNew() {
  const navigate = useNavigate();
  const { competitionId, teamId } = useParams();
  const handleBack = useBackButton();

  const [formData, setFormData] = useState({
    team_name: '',
    is_corps: false,
    is_reserve: false,
    is_female: false,
    is_hc: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTeam();
  }, [competitionId, teamId]);

  const fetchTeam = async () => {
    try {
      const result = await window.api.select(
        `SELECT team_name, is_corps, is_reserve, is_female, is_hc
         FROM competition_team
         WHERE competition_id = ? AND team_id = ?`,
        [competitionId, teamId]
      );

      if (result.length > 0) {
        const team = result[0];
        setFormData({
          team_name: team.team_name || '',
          is_corps: Boolean(team.is_corps),
          is_reserve: Boolean(team.is_reserve),
          is_female: Boolean(team.is_female),
          is_hc: Boolean(team.is_hc),
        });
      } else {
        setError('Team not found');
      }
    } catch (err) {
      console.error('Failed to fetch team:', err);
      setError('Failed to load team details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.team_name.trim()) {
      setError('Team name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await window.api.insert(
        `UPDATE competition_team
         SET team_name = ?, is_corps = ?, is_reserve = ?, is_female = ?, is_hc = ?
         WHERE competition_id = ? AND team_id = ?`,
        [
          formData.team_name.trim(),
          formData.is_corps ? 1 : 0,
          formData.is_reserve ? 1 : 0,
          formData.is_female ? 1 : 0,
          formData.is_hc ? 1 : 0,
          competitionId,
          teamId
        ]
      );

      navigate(`/competition/${competitionId}/team/list`);
    } catch (err) {
      console.error('Failed to update team:', err);
      setError('Failed to update team. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-500">Loading team details...</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Edit Team"
        subtitle={`Update details for ${formData.team_name}`}
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

      <Card className="max-w-2xl">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Team Name *
                </label>
                <Input
                  value={formData.team_name}
                  onChange={(e) => handleChange('team_name', e.target.value)}
                  placeholder="e.g., HAC A, REME B"
                />
              </div>

              <div className="flex flex-wrap gap-6">
                <Checkbox
                  checked={formData.is_corps}
                  onChange={(e) => handleChange('is_corps', e.target.checked)}
                  label="Corps Team"
                />
                <Checkbox
                  checked={formData.is_reserve}
                  onChange={(e) => handleChange('is_reserve', e.target.checked)}
                  label="Reserve Team"
                />
                <Checkbox
                  checked={formData.is_female}
                  onChange={(e) => handleChange('is_female', e.target.checked)}
                  label="Female Team"
                />
                <Checkbox
                  checked={formData.is_hc}
                  onChange={(e) => handleChange('is_hc', e.target.checked)}
                  label="HC (Hors Concours)"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-neutral-200">
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
