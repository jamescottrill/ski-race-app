import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Users, 
  User,
  Medal,
  ArrowLeft,
  ChartBar,
  Award
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

function ResultsPageNew() {
  const { competitionId } = useParams();
  const [competitionName, setCompetitionName] = useState('');
  const navigate = useNavigate();
  const handleBack = useBackButton();

  useEffect(() => {
    const fetchCompetitionDetails = async () => {
      const query = 'SELECT competition_name FROM competitions WHERE id = ?';
      const params = [competitionId];

      try {
        const result = await window.api.select(query, params);
        setCompetitionName(result[0].competition_name);
      } catch (error) {
        console.error('Failed to fetch competition details:', error);
      }
    };

    fetchCompetitionDetails();
  }, [competitionId]);

  const resultCategories = [
    {
      title: 'Individual Results',
      description: 'View individual competitor standings and times',
      icon: User,
      color: 'primary',
      onClick: () => navigate(`/competition/${competitionId}/results/individual`),
    },
    {
      title: 'Team Results',
      description: 'View team standings and combined scores',
      icon: Users,
      color: 'success',
      onClick: () => navigate(`/competition/${competitionId}/results/team`),
    },
    {
      title: 'Race Results',
      description: 'View results by individual races',
      icon: Trophy,
      color: 'warning',
      onClick: () => navigate(`/competition/${competitionId}/results/races`),
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
        title={competitionName || 'Competition Results'}
        subtitle="View competition standings and race outcomes"
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

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total Races</p>
              <p className="text-2xl font-bold text-primary-700">--</p>
            </div>
            <Trophy className="w-8 h-8 text-primary-300" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Competitors</p>
              <p className="text-2xl font-bold text-success">--</p>
            </div>
            <User className="w-8 h-8 text-success/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Teams</p>
              <p className="text-2xl font-bold text-info">--</p>
            </div>
            <Users className="w-8 h-8 text-info/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Medals Awarded</p>
              <p className="text-2xl font-bold text-warning">--</p>
            </div>
            <Medal className="w-8 h-8 text-warning/30" />
          </div>
        </Card>
      </div>

      {/* Result Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {resultCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Card
              key={category.title}
              interactive
              className="group cursor-pointer"
              onClick={category.onClick}
            >
              <CardContent>
                <div className={cn(
                  'w-16 h-16 rounded-lg flex items-center justify-center mb-4 transition-all duration-300',
                  getColorClasses(category.color)
                )}>
                  <Icon className="w-8 h-8" />
                </div>
                
                <h3 className="text-lg font-semibold text-neutral-900 mb-2 group-hover:text-primary-700 transition-colors">
                  {category.title}
                </h3>
                <p className="text-sm text-neutral-600">
                  {category.description}
                </p>

                <div className="mt-4 flex items-center text-primary-600 group-hover:text-primary-700">
                  <span className="text-sm font-medium">View Results</span>
                  <ChartBar className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}

export default ResultsPageNew;