import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid4 } from 'uuid';
import { ArrowLeft, Trophy, Calendar, MapPin, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  TextField,
  PageContainer,
  PageHeader,
} from '../design-system';
import { useBackButton } from '../utils/navigation';

function CreateCompetitionPageNew() {
  const [competitionName, setCompetitionName] = useState('');
  const [competitionDescription, setCompetitionDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleBack = useBackButton();

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!competitionName.trim()) {
      toast.error('Competition name is required');
      return;
    }

    setLoading(true);
    const id = uuid4();
    const query = `
      INSERT INTO competitions (id, competition_name, competition_description)
      VALUES (?, ?, ?)
    `;
    const params = [id, competitionName, competitionDescription];

    try {
      const result = await window.api.insert(query, params);
      if (result.success) {
        toast.success('Competition created successfully!');
        navigate(`/competition/${id}`);
      } else {
        toast.error('Failed to create competition: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating competition:', error);
      toast.error('An error occurred while creating the competition');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-alpine-ice via-neutral-50 to-primary-50">
      <PageContainer maxWidth="lg">
        <PageHeader
          title="Create New Competition"
          subtitle="Set up a new ski racing competition"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Competition Details</CardTitle>
                <CardDescription>
                  Enter the basic information for your new competition
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <TextField
                    label="Competition Name"
                    placeholder="e.g., Army Championships 2024"
                    value={competitionName}
                    onChange={(e) => setCompetitionName(e.target.value)}
                    required
                    fullWidth
                    leftIcon={<Trophy className="w-4 h-4 text-neutral-500" />}
                    helperText="This will be displayed throughout the application"
                  />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      Description
                    </label>
                    <textarea
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm
                        transition-all duration-200 placeholder:text-neutral-400
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        hover:border-neutral-400"
                      rows={4}
                      placeholder="e.g., Annual British Army Alpine Ski Championships including GS, SL, and SG races"
                      value={competitionDescription}
                      onChange={(e) => setCompetitionDescription(e.target.value)}
                    />
                    <p className="text-sm text-neutral-500">
                      Optional: Provide additional details about the competition
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={loading}
                      leftIcon={<Save className="w-4 h-4" />}
                      fullWidth
                    >
                      Create Competition
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={handleBack}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Quick Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Setup Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Create Competition</p>
                    <p className="text-xs text-neutral-600">You are here</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Register Competitors</p>
                    <p className="text-xs text-neutral-600">Add athletes and teams</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Create Races</p>
                    <p className="text-xs text-neutral-600">Set up individual events</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center text-sm font-semibold">
                    4
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Record Results</p>
                    <p className="text-xs text-neutral-600">Enter race times</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-primary-50 border-primary-200">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Calendar className="w-5 h-5 text-primary-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-primary-900">Season 2024</p>
                    <p className="text-xs text-primary-700 mt-1">
                      Remember to configure race dates and venues after creating the competition
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Info */}
            <Card className="bg-neutral-50 border-neutral-200">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <MapPin className="w-5 h-5 text-neutral-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Venue Settings</p>
                    <p className="text-xs text-neutral-600 mt-1">
                      Individual race venues can be configured when creating each race
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

export default CreateCompetitionPageNew;