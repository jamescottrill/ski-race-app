import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  Input,
  Select,
  Checkbox
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function CreateTeamPageNew() {
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  const [formData, setFormData] = useState({
    team_name: '',
    is_corps: false,
    is_reserve: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
      const teamId = uuidv4();

      await window.api.insert(
        `INSERT INTO competition_team (competition_id, team_id, team_name, is_corps, is_reserve)
         VALUES (?, ?, ?, ?, ?)`,
        [
          competitionId,
          teamId,
          formData.team_name.trim(),
          formData.is_corps ? 1 : 0,
          formData.is_reserve ? 1 : 0,
        ]
      );

      navigate(`/competition/${competitionId}/team/list`);
    } catch (err) {
      console.error('Failed to create team:', err);
      setError('Failed to create team. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Create Team"
        subtitle="Register a new team for this competition"
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
                  autoFocus
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Enter the team identifier (e.g., unit abbreviation + team letter)
                </p>
              </div>

              <div className="flex gap-6">
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
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-neutral-200">
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                {saving ? 'Creating...' : 'Create Team'}
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

      <Card className="max-w-2xl mt-6">
        <CardContent>
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-neutral-900">About Team Registration</h3>
              <p className="text-sm text-neutral-600 mt-1">
                Teams are registered at the competition level. Team captains can then assign
                different racers to each team for individual races (e.g., different line-ups
                for Slalom vs Giant Slalom).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
