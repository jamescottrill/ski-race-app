import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  UserPlus, 
  Upload, 
  UserCog, 
  Users, 
  UsersRound,
  ArrowLeft,
  FileUp,
  Edit3,
  Eye
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

function ManageCompetitorsPageNew() {
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  const navigationCards = [
    {
      title: 'Register Competitor',
      description: 'Add a new athlete to the competition',
      icon: UserPlus,
      color: 'primary',
      onClick: () => navigate(`/competition/${competitionId}/competitor/new`),
    },
    {
      title: 'Bulk Upload',
      description: 'Import multiple competitors from CSV',
      icon: Upload,
      color: 'success',
      onClick: () => navigate(`/competition/${competitionId}/competitor/bulk`),
    },
    {
      title: 'Edit Competitors',
      description: 'Modify competitor details',
      icon: UserCog,
      color: 'warning',
      onClick: () => navigate(`/competition/${competitionId}/competitor/edit`),
    },
    {
      title: 'View Competitors',
      description: 'Browse all registered athletes',
      icon: Eye,
      color: 'info',
      onClick: () => navigate(`/competition/${competitionId}/competitor/list`),
    },
    {
      title: 'View Teams',
      description: 'Manage team compositions',
      icon: UsersRound,
      color: 'primary',
      onClick: () => navigate(`/competition/${competitionId}/team/list`),
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
        title="Competitor Management"
        subtitle="Register and manage competition participants"
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {navigationCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              interactive
              className="group cursor-pointer"
              onClick={card.onClick}
            >
              <CardContent>
                <div className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-all duration-300',
                  getColorClasses(card.color)
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                
                <h3 className="text-lg font-semibold text-neutral-900 mb-2 group-hover:text-primary-700 transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-neutral-600">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}

export default ManageCompetitorsPageNew;