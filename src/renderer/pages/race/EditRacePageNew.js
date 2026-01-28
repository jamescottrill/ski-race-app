import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Calendar, MapPin, Users, Clock, Flag } from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  Input,
  Label,
  SimpleSelect,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import PersonSelect from '../../components/PersonSelect';

export default function EditRacePageNew() {
  const navigate = useNavigate();
  const { competitionId, raceId } = useParams();
  const handleBack = useBackButton();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');

  // Form state
  const [formData, setFormData] = useState({
    race_name: '',
    race_type: 'Giant Slalom',
    race_date: '',
    venue: '',
    number_runs: '2',
    is_individual: true,
    is_team: false,
    is_training: false,
    is_seeding: false,
    women_separate: false,
    flip_count: '15',
    flip_count_women: '5',
    chief_of_race: '',
    tech_delegate: '',
    referee: '',
    asst_referee: '',
    snow: '',
    weather: '',
    temp_start: '',
    temp_finish: '',
    course_name: '',
    start_altitude: '',
    finish_altitude: '',
    homologation: ''
    // Note: course_setter, number_of_gates, and forerunners are stored per run in race_run table
  });

  useEffect(() => {
    fetchRaceData();
  }, [raceId]);

  const fetchRaceData = async () => {
    try {
      const query = `SELECT * FROM races WHERE race_id = ? AND competition_id = ?`;
      const result = await window.api.select(query, [raceId, competitionId]);

      if (result.length > 0) {
        const race = result[0];
        setFormData({
          race_name: race.race_name || '',
          race_type: race.race_type || 'GS',
          race_date: race.race_date || '',
          venue: race.venue || '',
          number_runs: race.number_runs?.toString() || '2',
          is_individual: race.is_individual === 1,
          is_team: race.is_team === 1,
          is_training: race.is_training === 1,
          is_seeding: race.is_seeding === 1,
          women_separate: race.women_separate === 1,
          flip_count: race.flip_count?.toString() || '15',
          flip_count_women: race.flip_count_women?.toString() || '5',
          chief_of_race: race.chief_of_race?.toString() || '',
          tech_delegate: race.tech_delegate?.toString() || '',
          referee: race.referee?.toString() || '',
          asst_referee: race.asst_referee?.toString() || '',
          snow: race.snow || '',
          weather: race.weather || '',
          temp_start: race.temp_start || '',
          temp_finish: race.temp_finish || '',
          course_name: race.course_name || '',
          start_altitude: race.start_altitude || '',
          finish_altitude: race.finish_altitude || '',
          homologation: race.homologation || ''
          // Note: course_setter, number_of_gates, and forerunners are loaded from race_run table
        });
      }
    } catch (error) {
      console.error('Failed to fetch race data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const updateQuery = `
        UPDATE races SET
          race_name = ?,
          race_type = ?,
          race_date = ?,
          venue = ?,
          number_runs = ?,
          is_individual = ?,
          is_team = ?,
          is_training = ?,
          is_seeding = ?,
          women_separate = ?,
          flip_count = ?,
          flip_count_women = ?,
          chief_of_race = ?,
          tech_delegate = ?,
          referee = ?,
          asst_referee = ?,
          snow = ?,
          weather = ?,
          temp_start = ?,
          temp_finish = ?,
          course_name = ?,
          start_altitude = ?,
          finish_altitude = ?,
          homologation = ?
        WHERE race_id = ? AND competition_id = ?
      `;

      await window.api.insert(updateQuery, [
        formData.race_name,
        formData.race_type,
        formData.race_date,
        formData.venue,
        parseInt(formData.number_runs, 10),
        formData.is_individual ? 1 : 0,
        formData.is_team ? 1 : 0,
        formData.is_training ? 1 : 0,
        formData.is_seeding ? 1 : 0,
        formData.women_separate ? 1 : 0,
        parseInt(formData.flip_count, 10) || 15,
        parseInt(formData.flip_count_women, 10) || 5,
        formData.chief_of_race,
        formData.tech_delegate,
        formData.referee,
        formData.asst_referee,
        formData.snow,
        formData.weather,
        formData.temp_start,
        formData.temp_finish,
        formData.course_name,
        formData.start_altitude,
        formData.finish_altitude,
        formData.homologation,
        raceId,
        competitionId,
      ]);

      navigate(`/competition/${competitionId}/race/${raceId}`);
    } catch (error) {
      console.error('Failed to update race:', error);
      alert('Failed to update race. Please try again.');
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Loading..." />
        <Card><CardContent>Loading race details...</CardContent></Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Edit Race"
        subtitle={`Update ${formData.race_name}`}
        actions={
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleSubmit}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Cancel
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="officials">Officials</TabsTrigger>
            <TabsTrigger value="venue">Venue Details</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Card>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="race_name" required>Race Name</Label>
                    <Input
                      id="race_name"
                      name="race_name"
                      value={formData.race_name}
                      onChange={handleInputChange}
                      placeholder="e.g., Giant Slalom"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="race_type" required>Race Type</Label>
                    <SimpleSelect
                      id="race_type"
                      name="race_type"
                      value={formData.race_type}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="GS">Giant Slalom</option>
                      <option value="SL">Slalom</option>
                      <option value="SG">Super-G</option>
                      <option value="DH">Downhill</option>
                      <option value="AC">Alpine Combined</option>
                    </SimpleSelect>
                  </div>

                  <div>
                    <Label htmlFor="race_date">Race Date</Label>
                    <Input
                      id="race_date"
                      name="race_date"
                      type="date"
                      value={formData.race_date}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div>
                    <Label htmlFor="venue">Venue</Label>
                    <Input
                      id="venue"
                      name="venue"
                      value={formData.venue}
                      onChange={handleInputChange}
                      placeholder="e.g., Val d'Isère"
                      leftIcon={<MapPin className="w-4 h-4 text-neutral-400" />}
                    />
                  </div>

                  <div>
                    <Label htmlFor="number_runs">Number of Runs</Label>
                    <SimpleSelect
                      id="number_runs"
                      name="number_runs"
                      value={formData.number_runs}
                      onChange={handleInputChange}
                    >
                      <option value="1">1 Run</option>
                      <option value="2">2 Runs</option>
                    </SimpleSelect>
                  </div>

                  <div>
                    <Label htmlFor="flip_count">Flip Count</Label>
                    <Input
                      id="flip_count"
                      name="flip_count"
                      type="number"
                      value={formData.flip_count}
                      onChange={handleInputChange}
                      placeholder="15"
                      min="1"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Top N bibs randomised in Run 1, reversed in Run 2</p>
                  </div>

                  {formData.women_separate && (
                    <div>
                      <Label htmlFor="flip_count_women">Flip Count (Women)</Label>
                      <Input
                        id="flip_count_women"
                        name="flip_count_women"
                        type="number"
                        value={formData.flip_count_women}
                        onChange={handleInputChange}
                        placeholder="5"
                        min="1"
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label>Race Format</Label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="is_individual"
                        checked={formData.is_individual}
                        onChange={handleInputChange}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm">Individual Race</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="is_team"
                        checked={formData.is_team}
                        onChange={handleInputChange}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm">Team Race</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="is_training"
                        checked={formData.is_training}
                        onChange={handleInputChange}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm">Training Run</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="is_seeding"
                        checked={formData.is_seeding}
                        onChange={handleInputChange}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm">Seeding Race</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="women_separate"
                        checked={formData.women_separate}
                        onChange={handleInputChange}
                        className="rounded border-neutral-300"
                      />
                      <span className="text-sm">Separate Women's Category</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="officials">
            <Card>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <PersonSelect
                    label="Chief of Race"
                    value={formData.chief_of_race}
                    onChange={(value) => handleInputChange({ target: { name: 'chief_of_race', value } })}
                    placeholder="Select Chief of Race..."
                  />
                  <PersonSelect
                    label="Technical Delegate"
                    value={formData.tech_delegate}
                    onChange={(value) => handleInputChange({ target: { name: 'tech_delegate', value } })}
                    placeholder="Select Technical Delegate..."
                  />
                  <PersonSelect
                    label="Referee"
                    value={formData.referee}
                    onChange={(value) => handleInputChange({ target: { name: 'referee', value } })}
                    placeholder="Select Referee..."
                  />
                  <PersonSelect
                    label="Assistant Referee"
                    value={formData.asst_referee}
                    onChange={(value) => handleInputChange({ target: { name: 'asst_referee', value } })}
                    placeholder="Select Assistant Referee..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="venue">
            <Card>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="course_name">Course Name</Label>
                    <Input
                      id="course_name"
                      name="course_name"
                      value={formData.course_name}
                      onChange={handleInputChange}
                      placeholder="e.g., Face de Bellevarde"
                    />
                  </div>

                  <div>
                    <Label htmlFor="homologation">Homologation Number</Label>
                    <Input
                      id="homologation"
                      name="homologation"
                      value={formData.homologation}
                      onChange={handleInputChange}
                      placeholder="FIS number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="start_altitude">Start Altitude (m)</Label>
                    <Input
                      id="start_altitude"
                      name="start_altitude"
                      type="number"
                      value={formData.start_altitude}
                      onChange={handleInputChange}
                      placeholder="e.g., 2550"
                    />
                  </div>

                  <div>
                    <Label htmlFor="finish_altitude">Finish Altitude (m)</Label>
                    <Input
                      id="finish_altitude"
                      name="finish_altitude"
                      type="number"
                      value={formData.finish_altitude}
                      onChange={handleInputChange}
                      placeholder="e.g., 1850"
                    />
                  </div>

                  <div className="col-span-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Run-specific details (gates, course setter, forerunners) are configured separately for each race run.
                        Use the Race Runs management page to set these details.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conditions">
            <Card>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="snow">Snow Condition</Label>
                    <Input
                      id="snow"
                      name="snow"
                      value={formData.snow}
                      onChange={handleInputChange}
                      placeholder="e.g., Hard, Compact, Soft, Wet, Powder"
                    />
                  </div>

                  <div>
                    <Label htmlFor="weather">Weather</Label>
                    <Input
                      id="weather"
                      name="weather"
                      value={formData.weather}
                      onChange={handleInputChange}
                      placeholder="e.g., Sunny, Cloudy, Snow, Rain"
                    />
                  </div>

                  <div>
                    <Label htmlFor="temp_start">Temperature at Start (°C)</Label>
                    <Input
                      id="temp_start"
                      name="temp_start"
                      type="number"
                      value={formData.temp_start}
                      onChange={handleInputChange}
                      placeholder="e.g., -5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="temp_finish">Temperature at Finish (°C)</Label>
                    <Input
                      id="temp_finish"
                      name="temp_finish"
                      type="number"
                      value={formData.temp_finish}
                      onChange={handleInputChange}
                      placeholder="e.g., -2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </PageContainer>
  );
}
