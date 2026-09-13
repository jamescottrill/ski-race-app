import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  TextField,
  SimpleSelect,
  PageContainer,
  PageHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../design-system';
import { useBackButton } from '../utils/navigation';
import * as operations from '../api/operations';
import {
  COMPETITION_LEVELS,
  COMPETITION_LEVEL_LABELS,
} from '../../shared/competition';
import PublishingSettings from '../components/sync/PublishingSettings';

const EMPTY_DETAILS = {
  competition_name: '',
  competition_description: '',
  level: '',
  season: '',
  start_date: '',
  end_date: '',
  venue: '',
};

const TABS = ['details', 'publishing'];

// The form binds to strings; the database stores blanks as null
const toFormValues = (row) =>
  Object.fromEntries(
    Object.keys(EMPTY_DETAILS).map((key) => [key, row[key] ?? '']),
  );

/** The competition's place on the championship ladder. */
function DetailsSettings({ competitionId }) {
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDetails = useCallback(async () => {
    const rows = await window.api.select(
      `SELECT competition_name, competition_description, level, season,
              start_date, end_date, venue
       FROM competitions WHERE id = ?`,
      [competitionId],
    );
    if (!rows || rows.length === 0) {
      throw new Error('Competition not found');
    }
    setDetails(toFormValues(rows[0]));
  }, [competitionId]);

  useEffect(() => {
    const load = async () => {
      try {
        await loadDetails();
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loadDetails]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setDetails((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!details.competition_name.trim()) {
      toast.error('Competition name is required');
      return;
    }
    setSaving(true);
    try {
      await operations.updateCompetition({ competitionId, fields: details });
      toast.success('Competition details saved');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          The level and season place this competition on the championship ladder
          and are sent to the central results service.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <TextField
            label="Competition Name"
            name="competition_name"
            value={details.competition_name}
            onChange={handleChange}
            required
            fullWidth
            disabled={loading}
          />
          <TextField
            label="Description"
            name="competition_description"
            value={details.competition_description}
            onChange={handleChange}
            fullWidth
            disabled={loading}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SimpleSelect
              label="Level"
              name="level"
              value={details.level}
              onChange={handleChange}
              required
              disabled={loading}
            >
              <option value="">Select...</option>
              {COMPETITION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {COMPETITION_LEVEL_LABELS[level]}
                </option>
              ))}
            </SimpleSelect>
            <TextField
              label="Season"
              name="season"
              value={details.season}
              onChange={handleChange}
              required
              placeholder="2025-26"
              helperText="Seasons run from 1 July to 30 June"
              disabled={loading}
            />
            <TextField
              label="Start Date"
              name="start_date"
              type="date"
              value={details.start_date}
              onChange={handleChange}
              disabled={loading}
            />
            <TextField
              label="End Date"
              name="end_date"
              type="date"
              value={details.end_date}
              onChange={handleChange}
              disabled={loading}
            />
            <TextField
              label="Venue"
              name="venue"
              value={details.venue}
              onChange={handleChange}
              placeholder="e.g., Serre Chevalier"
              disabled={loading}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={loading}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Competition settings in two tabs: the details that place the competition
 * on the championship ladder, and publishing to the central results
 * service. The tab is kept in the query string so links can open either.
 */
function CompetitionSettingsPage() {
  const { competitionId } = useParams();
  const handleBack = useBackButton();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = TABS.includes(requested) ? requested : 'details';

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="Competition Settings"
        subtitle="Details and publishing"
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

      <Tabs
        value={tab}
        onValueChange={(next) => setSearchParams({ tab: next })}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="publishing">Publishing</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <DetailsSettings competitionId={competitionId} />
        </TabsContent>
        <TabsContent value="publishing">
          {window.sync ? (
            <PublishingSettings competitionId={competitionId} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-600">
                  Sync is not available in this build.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

export default CompetitionSettingsPage;
