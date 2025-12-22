import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  ArrowLeft,
  Save,
  Calendar,
  MapPin,
  Users,
  Timer,
  Mountain
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  TextField,
  SimpleSelect,
  Checkbox,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { v4 as uuid4 } from 'uuid';

export default function CreateRacePageNew() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();

  const [formData, setFormData] = useState({
    raceName: '',
    raceType: 'Slalom',
    isIndividual: true,
    isTeam: false,
    isTraining: false,
    isSeeding: false,
    womenSeparate: false,
    numberRuns: 2,
    venue: '',
    courseName: '',
    raceDate: '',
    chiefOfRace: '',
    techDelegate: '',
    referee: '',
    asstReferee: '',
    tempStart: '',
    tempFinish: '',
    snow: '',
    weather: '',
    homologation: '',
    startAltitude: '',
    finishAltitude: '',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const raceId = uuid4();
    const query = `
      INSERT INTO races (
        race_id, competition_id, race_name, race_type, is_individual, is_team,
        is_training, is_seeding, women_separate, number_runs,
        venue, course_name, race_date, chief_of_race, tech_delegate,
        referee, asst_referee, temp_start, temp_finish, snow,
        weather, homologation, start_altitude, finish_altitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      raceId,
      competitionId,
      formData.raceName,
      formData.raceType,
      formData.isIndividual ? 1 : 0,
      formData.isTeam ? 1 : 0,
      formData.isTraining ? 1 : 0,
      formData.isSeeding ? 1 : 0,
      formData.womenSeparate ? 1 : 0,
      formData.numberRuns,
      formData.venue,
      formData.courseName,
      formData.raceDate || null,
      formData.chiefOfRace,
      formData.techDelegate,
      formData.referee,
      formData.asstReferee,
      formData.tempStart,
      formData.tempFinish,
      formData.snow,
      formData.weather,
      formData.homologation,
      formData.startAltitude,
      formData.finishAltitude,
    ];

    try {
      await window.api.insert(query, params);

      // Create race_run entries for each run
      const numRuns = parseInt(formData.numberRuns, 10) || 1;
      for (let runNumber = 1; runNumber <= numRuns; runNumber++) {
        const runId = `${raceId}-run-${runNumber}`;
        const runQuery = `
          INSERT INTO race_run (competition_id, race_id, run_id, run_number, is_complete)
          VALUES (?, ?, ?, ?, 0)
        `;
        await window.api.insert(runQuery, [competitionId, raceId, runId, runNumber]);
      }

      navigate(`/competition/${competitionId}/race/${raceId}`);
    } catch (error) {
      console.error('Failed to create race:', error);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Create New Race"
        subtitle="Configure race details and settings"
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

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary-600" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label="Race Name"
                    name="raceName"
                    value={formData.raceName}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Men's Giant Slalom"
                  />
                  <SimpleSelect
                    label="Race Type"
                    name="raceType"
                    value={formData.raceType}
                    onChange={handleChange}
                    required
                  >
                    <option value="SL">Slalom</option>
                    <option value="GS">Giant Slalom</option>
                    <option value="SG">Super G</option>
                    <option value="DH">Downhill</option>
                  </SimpleSelect>
                  <SimpleSelect
                    label="Number of Runs"
                    name="numberRuns"
                    value={formData.numberRuns}
                    onChange={handleChange}
                    required
                  >
                    <option value={1}>1 Run</option>
                    <option value={2}>2 Runs</option>
                  </SimpleSelect>
                  <TextField
                    label="Race Date"
                    name="raceDate"
                    type="date"
                    value={formData.raceDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <Checkbox
                    label="Team Race"
                    name="isTeam"
                    checked={formData.isTeam}
                    onChange={handleChange}
                  />
                  <Checkbox
                    label="Training"
                    name="isTraining"
                    checked={formData.isTraining}
                    onChange={handleChange}
                  />
                  <Checkbox
                    label="Seeding Race"
                    name="isSeeding"
                    checked={formData.isSeeding}
                    onChange={handleChange}
                  />
                  <Checkbox
                    label="Separate Women"
                    name="womenSeparate"
                    checked={formData.womenSeparate}
                    onChange={handleChange}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Location Details */}
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-600" />
                  Location Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label="Venue"
                    name="venue"
                    value={formData.venue}
                    onChange={handleChange}
                    placeholder="e.g., Whistler Mountain"
                  />
                  <TextField
                    label="Course Name"
                    name="courseName"
                    value={formData.courseName}
                    onChange={handleChange}
                    placeholder="e.g., Dave Murray Downhill"
                  />
                  <TextField
                    label="Start Altitude (m)"
                    name="altStart"
                    type="number"
                    value={formData.altStart}
                    onChange={handleChange}
                  />
                  <TextField
                    label="Finish Altitude (m)"
                    name="altFinish"
                    type="number"
                    value={formData.altFinish}
                    onChange={handleChange}
                  />
                  <TextField
                    label="Homologation"
                    name="homologation"
                    value={formData.homologation}
                    onChange={handleChange}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Officials */}
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  Race Officials
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label="Chief of Race"
                    name="chiefOfRace"
                    value={formData.chiefOfRace}
                    onChange={handleChange}
                  />
                  <TextField
                    label="Technical Delegate"
                    name="techDelegate"
                    value={formData.techDelegate}
                    onChange={handleChange}
                  />
                  <TextField
                    label="Referee"
                    name="referee"
                    value={formData.referee}
                    onChange={handleChange}
                  />
                  <TextField
                    label="Assistant Referee"
                    name="asstReferee"
                    value={formData.asstReferee}
                    onChange={handleChange}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardContent>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Mountain className="w-5 h-5 text-primary-600" />
                  Course Conditions
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label="Temperature Start (°C)"
                    name="tempStart"
                    type="number"
                    value={formData.tempStart}
                    onChange={handleChange}
                  />
                  <TextField
                    label="Temperature Finish (°C)"
                    name="tempFinish"
                    type="number"
                    value={formData.tempFinish}
                    onChange={handleChange}
                  />
                  <SimpleSelect
                    label="Snow Condition"
                    name="snow"
                    value={formData.snow}
                    onChange={handleChange}
                  >
                    <option value="">Select...</option>
                    <option value="Powder">Powder</option>
                    <option value="Packed">Packed</option>
                    <option value="Hard">Hard</option>
                    <option value="Ice">Ice</option>
                    <option value="Spring">Spring</option>
                    <option value="Variable">Variable</option>
                  </SimpleSelect>
                  <SimpleSelect
                    label="Weather"
                    name="weather"
                    value={formData.weather}
                    onChange={handleChange}
                  >
                    <option value="">Select...</option>
                    <option value="Sunny">Sunny</option>
                    <option value="Partly Cloudy">Partly Cloudy</option>
                    <option value="Cloudy">Cloudy</option>
                    <option value="Snowing">Snowing</option>
                    <option value="Fog">Fog</option>
                    <option value="Rain">Rain</option>
                    <option value="Wind">Wind</option>
                  </SimpleSelect>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="col-span-1">
            <Card className="sticky top-4">
              <CardContent>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Race Configuration</h3>
                <div className="space-y-4 text-sm">
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Trophy className="w-4 h-4 text-primary-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-primary-700">Race Types</p>
                        <p className="text-neutral-600 mt-1">
                          Select the appropriate discipline. This affects scoring and seeding calculations.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-info/10 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Timer className="w-4 h-4 text-info mt-0.5" />
                      <div>
                        <p className="font-medium text-info">Number of Runs</p>
                        <p className="text-neutral-600 mt-1">
                          Slalom and GS typically have 2 runs. Speed events usually have 1 run.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-warning/10 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Users className="w-4 h-4 text-warning mt-0.5" />
                      <div>
                        <p className="font-medium text-warning">Team Races</p>
                        <p className="text-neutral-600 mt-1">
                          Team races combine individual times for team scoring.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Create Race
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleBack}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}
