import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, Plus, Trophy, ListOrdered } from 'lucide-react';
import { 
  Button, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../design-system';

function LandingPageNew() {
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    try {
      const query = 'SELECT id, competition_name FROM competitions';
      const result = await window.api.select(query);
      setCompetitions(result);
    } catch (error) {
      console.error('Failed to fetch competitions', error);
    }
  };

  const handleCreateCompetition = () => {
    navigate('/new-competition');
  };

  const handleSelectCompetition = (value) => {
    setSelectedCompetition(value);
    navigate(`/competition/${value}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-alpine-ice via-neutral-50 to-primary-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-100 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-alpine-ice rounded-full opacity-30 blur-3xl" />
      </div>

      {/* Main Content */}
      <Card className="relative w-full max-w-2xl shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary-700 rounded-2xl shadow-lg">
              <Mountain className="w-12 h-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-4xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent">
            British Army Ski Racing
          </CardTitle>
          <CardDescription className="text-lg mt-2 text-neutral-600">
            Alpine Race Scoring & Competition Management
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-neutral-50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-700">{competitions.length}</p>
              <p className="text-xs text-neutral-600">Competitions</p>
            </div>
            <div className="text-center border-x border-neutral-200">
              <p className="text-2xl font-bold text-primary-700">2024</p>
              <p className="text-xs text-neutral-600">Season</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-700">Active</p>
              <p className="text-xs text-neutral-600">Status</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            {/* Create New Competition */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleCreateCompetition}
                leftIcon={<Plus className="w-5 h-5" />}
                className="shadow-lg hover:shadow-xl transition-shadow"
              >
                New Competition
              </Button>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={() => navigate('/aasl')}
                leftIcon={<ListOrdered className="w-5 h-5" />}
                className="shadow-lg hover:shadow-xl transition-shadow"
              >
                Manage AASL
              </Button>
            </div>

            {/* Or Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-surface text-neutral-500">or select existing</span>
              </div>
            </div>

            {/* Select Competition */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-700">
                Select Competition
              </label>
              <Select value={selectedCompetition} onValueChange={handleSelectCompetition}>
                <SelectTrigger className="w-full h-12 text-base">
                  <SelectValue placeholder="Choose a competition to continue" />
                </SelectTrigger>
                <SelectContent>
                  {competitions.length === 0 ? (
                    <div className="p-4 text-center text-neutral-500">
                      No competitions available
                    </div>
                  ) : (
                    competitions.map((competition) => (
                      <SelectItem key={competition.id} value={competition.id}>
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-primary-600" />
                          {competition.competition_name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Footer Info */}
          <div className="pt-4 mt-6 border-t border-neutral-200">
            <p className="text-center text-xs text-neutral-500">
              Version 2.0 • © 2024 British Army Winter Sports Association
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LandingPageNew;