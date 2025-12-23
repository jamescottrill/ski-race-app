import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  List,
  ArrowLeft,
  Users,
  TrendingUp,
  Calendar
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { getAASLSeasons, getAASLStats } from '../../utils/AASLManagement';

export default function AASLManagementPage() {
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const seasonList = await getAASLSeasons();
      setSeasons(seasonList);
      if (seasonList.length > 0) {
        setSelectedSeason(seasonList[0]);
        const seasonStats = await getAASLStats(seasonList[0]);
        setStats(seasonStats);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      if (selectedSeason) {
        const seasonStats = await getAASLStats(selectedSeason);
        setStats(seasonStats);
      }
    };
    fetchStats();
  }, [selectedSeason]);

  return (
    <PageContainer>
      <PageHeader
        title="Army Alpine Seed List"
        subtitle="Manage AASL data for seeding and CPP calculations"
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

      <div className="grid grid-cols-3 gap-6 mb-6">
        <Card
          className="cursor-pointer hover:border-primary-500 transition-colors"
          onClick={() => navigate('/aasl/import')}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Upload className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Import AASL</h3>
              <p className="text-sm text-neutral-600">Import from Excel file</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary-500 transition-colors"
          onClick={() => navigate('/aasl/view')}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-success-100 rounded-lg">
              <List className="w-6 h-6 text-success-600" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">View AASL</h3>
              <p className="text-sm text-neutral-600">Browse seed list entries</p>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-neutral-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-neutral-400" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Generate AASL</h3>
              <p className="text-sm text-neutral-600">Coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {seasons.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-neutral-900">Season Statistics</h3>
              <select
                className="px-3 py-2 border border-neutral-300 rounded-md text-sm"
                value={selectedSeason || ''}
                onChange={(e) => setSelectedSeason(e.target.value)}
              >
                {seasons.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </div>

            {stats && (
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-2 text-neutral-600 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Total Skiers</span>
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
                </div>

                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-2 text-neutral-600 mb-1">
                    <span className="text-sm">Male / Female</span>
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {stats.male} / {stats.female}
                  </p>
                </div>

                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-2 text-neutral-600 mb-1">
                    <span className="text-sm">Best Points</span>
                  </div>
                  <p className="text-2xl font-bold text-success-600">
                    {stats.best_points?.toFixed(2) || '-'}
                  </p>
                </div>

                <div className="p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-2 text-neutral-600 mb-1">
                    <span className="text-sm">Average Points</span>
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {stats.avg_points?.toFixed(2) || '-'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {seasons.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">No AASL Data</h3>
            <p className="text-neutral-600 mb-4">
              Import an AASL Excel file to get started.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/aasl/import')}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Import AASL
            </Button>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
