import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Trophy, 
  ChartBar, 
  ListOrdered,
  ArrowLeft,
  UserPlus,
  Calendar,
  FileText,
  Activity
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  cn
} from '../design-system';

function CompetitionManagementPageNew() {
  const { competitionId } = useParams();
  const [competitionName, setCompetitionName] = useState('');
  const [stats, setStats] = useState({
    competitors: 0,
    races: 0,
    completedRaces: 0,
    teams: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompetitionDetails();
    fetchCompetitionStats();
  }, [competitionId]);

  const fetchCompetitionDetails = async () => {
    const query = 'SELECT competition_name FROM competitions WHERE id = ?';
    const params = [competitionId];

    try {
      const result = await window.api.select(query, params);
      if (result && result[0]) {
        setCompetitionName(result[0].competition_name);
      } else {
        console.error('Competition not found');
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to fetch competition details:', error);
      navigate('/');
    }
  };

  const fetchCompetitionStats = async () => {
    try {
      // Get competitor count
      const competitorQuery = 'SELECT COUNT(*) as count FROM competition_competitor WHERE competition_id = ?';
      const competitorResult = await window.api.select(competitorQuery, [competitionId]);
      
      // Get race count
      const raceQuery = 'SELECT COUNT(*) as total, SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) as completed FROM races WHERE competition_id = ?';
      const raceResult = await window.api.select(raceQuery, [competitionId]);
      
      // Get team count
      const teamQuery = 'SELECT COUNT(*) as count FROM competition_team WHERE competition_id = ?';
      const teamResult = await window.api.select(teamQuery, [competitionId]);
      
      setStats({
        competitors: competitorResult[0]?.count || 0,
        races: raceResult[0]?.total || 0,
        completedRaces: raceResult[0]?.completed || 0,
        teams: teamResult[0]?.count || 0
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const navigationCards = [
    {
      title: 'Competitors',
      description: 'Manage athlete registration and teams',
      icon: Users,
      color: 'primary',
      stats: `${stats.competitors} registered`,
      onClick: () => navigate(`/competition/${competitionId}/competitor/manage`),
      quickActions: [
        { label: 'Register', icon: UserPlus, path: `/competition/${competitionId}/competitor/new` },
        { label: 'View All', icon: Users, path: `/competition/${competitionId}/competitor/list` }
      ]
    },
    {
      title: 'Races',
      description: 'Configure races and start lists',
      icon: Trophy,
      color: 'success',
      stats: `${stats.races} races`,
      onClick: () => navigate(`/competition/${competitionId}/race`),
      quickActions: [
        { label: 'New Race', icon: Calendar, path: `/competition/${competitionId}/race/new` },
        { label: 'View Races', icon: Trophy, path: `/competition/${competitionId}/race` }
      ]
    },
    {
      title: 'Results',
      description: 'View and export race results',
      icon: ChartBar,
      color: 'warning',
      stats: `${stats.completedRaces} completed`,
      onClick: () => navigate(`/competition/${competitionId}/results`),
      quickActions: [
        { label: 'Individual', icon: Activity, path: `/competition/${competitionId}/results/individual` },
        { label: 'Teams', icon: Users, path: `/competition/${competitionId}/results/team` }
      ]
    },
    {
      title: 'Seed List',
      description: 'Generate and manage seed rankings',
      icon: ListOrdered,
      color: 'info',
      stats: 'Auto-calculated',
      onClick: () => navigate(`/competition/${competitionId}/seed-list/generate`),
      quickActions: [
        { label: 'Generate', icon: FileText, path: `/competition/${competitionId}/seed-list/generate` },
        { label: 'Export', icon: FileText, path: `/competition/${competitionId}/seed-list/generate` }
      ]
    },
  ];

  const getColorClasses = (color) => {
    const colors = {
      primary: 'bg-primary-100 text-primary-700 group-hover:bg-primary-700 group-hover:text-white',
      success: 'bg-success/10 text-success group-hover:bg-success group-hover:text-white',
      warning: 'bg-warning/10 text-warning group-hover:bg-warning group-hover:text-white',
      info: 'bg-info/10 text-info group-hover:bg-info group-hover:text-white',
    };
    return colors[color] || colors.primary;
  };

  return (
    <PageContainer>
      <PageHeader
        title={competitionName || 'Competition Dashboard'}
        subtitle="Manage all aspects of your competition"
        actions={
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Change Competition
          </Button>
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary-700">{stats.competitors}</p>
              <p className="text-sm text-neutral-600">Competitors</p>
            </div>
            <Users className="w-8 h-8 text-primary-300" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-success">{stats.races}</p>
              <p className="text-sm text-neutral-600">Total Races</p>
            </div>
            <Trophy className="w-8 h-8 text-success/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-warning">{stats.completedRaces}</p>
              <p className="text-sm text-neutral-600">Completed</p>
            </div>
            <ChartBar className="w-8 h-8 text-warning/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-info">{stats.teams}</p>
              <p className="text-sm text-neutral-600">Teams</p>
            </div>
            <Users className="w-8 h-8 text-info/30" />
          </div>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {navigationCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              interactive
              className="group cursor-pointer overflow-hidden"
              onClick={card.onClick}
            >
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      'p-3 rounded-lg transition-all duration-300',
                      getColorClasses(card.color)
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-sm text-neutral-500">{card.stats}</span>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-neutral-900 mb-2 group-hover:text-primary-700 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-neutral-600 mb-4">
                    {card.description}
                  </p>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    {card.quickActions.map((action, idx) => {
                      const ActionIcon = action.icon;
                      return (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(action.path);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors"
                        >
                          <ActionIcon className="w-3 h-3" />
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Hover effect bar */}
                <div className={cn(
                  'h-1 w-full transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300',
                  card.color === 'primary' && 'bg-primary-700',
                  card.color === 'success' && 'bg-success',
                  card.color === 'warning' && 'bg-warning',
                  card.color === 'info' && 'bg-info'
                )} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity (Optional) */}
      <Card className="mt-8">
        <CardContent>
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 bg-success rounded-full" />
              <span className="text-neutral-600">Competition created and configured</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 bg-primary-500 rounded-full" />
              <span className="text-neutral-600">{stats.competitors} competitors registered</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 bg-warning rounded-full" />
              <span className="text-neutral-600">{stats.races} races scheduled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default CompetitionManagementPageNew;