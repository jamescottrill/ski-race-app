import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Trash2,
  User,
  Shield,
  Calendar,
  Hash,
  AlertCircle
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

function EditCompetitorPageNew() {
  const { competitionId, competitorId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    title: '',
    birthYear: '',
    country: 'GBR',
    serviceNumber: '',
    gender: 'M',
    arrivalSeed: 2000,
    armySeed: '',
    isNovice: false,
    isJunior: false,
    isSenior: false,
    isVeteran: false,
    isReserve: false,
    regiment: '',
  });


  const fetchCompetitorDetails = async () => {
    if (!competitorId) return;

    setLoading(true);
    try {
      // Fetch person details
      const personQuery = `
        SELECT p.first_name, p.last_name, p.birth_year, p.country, p.id AS service_number, p.gender,
               cc.arrival_corps_seed, cc.arrival_army_seed, cc.is_novice, cc.is_junior, cc.is_senior,
               cc.is_veteran, cc.is_reserve, cc.regiment, cc.title
        FROM people p
        INNER JOIN competition_competitor cc ON p.id = cc.racer_id
        WHERE p.id = ? AND cc.competition_id = ?
      `;

      const result = await window.api.select(personQuery, [competitorId, competitionId]);

      if (result && result.length > 0) {
        const competitor = result[0];
        setFormData({
          firstName: competitor.first_name || '',
          lastName: competitor.last_name || '',
          title: competitor.title || '',
          birthYear: competitor.birth_year || '',
          country: competitor.country || 'GBR',
          serviceNumber: competitor.service_number || '',
          gender: competitor.gender || 'M',
          arrivalSeed: competitor.arrival_seed || 2000,
          armySeed: competitor.army_seed || '',
          isNovice: competitor.is_novice === 1,
          isJunior: competitor.is_junior === 1,
          isSenior: competitor.is_senior === 1,
          isVeteran: competitor.is_veteran === 1,
          isReserve: competitor.is_reserve === 1,
          regiment: competitor.regiment || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch competitor details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitorDetails();
  }, [competitorId, competitionId]);

  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });

    if (name === 'birthYear') {
      const currentYear = new Date().getFullYear();
      const birthYear = parseInt(value);
      const age = currentYear - birthYear;

      setFormData(prev => ({
        ...prev,
        isJunior: birthYear >= 2004,
        isSenior: birthYear <= 2003 && birthYear > 1991,
        isVeteran: birthYear <= 1991,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const personQuery = `
        UPDATE people
        SET first_name = ?, last_name = ?, birth_year = ?, country = ?, gender = ?
        WHERE id = ?
      `;
      const personParams = [
        formData.firstName,
        formData.lastName,
        formData.birthYear,
        formData.country,
        formData.gender,
        competitorId,
      ];

      if (formData.serviceNumber !== competitorId) {
        const peopleQuery = `UPDATE people SET id = ? WHERE id = ?`;
        await window.api.insert(peopleQuery, [formData.serviceNumber, competitorId]);
        const queries = [];
        for (const table of [
          'competition_team_members',
          'race_results',
          'race_competitor',
          'competition_competitor',
          'competition_final_seed_list',
        ]) {
          const query = `UPDATE ${table} SET racer_id = ? WHERE racer_id = ?`;
          queries.push(window.api.insert(query, [formData.serviceNumber, competitorId]));
        }
        await Promise.all(queries);
      }

      await window.api.insert(personQuery, personParams);

      // Update competitor details
      const competitorQuery = `
        UPDATE competition_competitor
        SET arrival_corps_seed = ?, arrival_army_seed = ?, is_novice = ?, is_junior = ?,
            is_senior = ?, is_veteran = ?, is_reserve = ?, regiment = ?, title = ?
        WHERE racer_id = ? AND competition_id = ?
      `;
      const competitorParams = [
        formData.arrivalSeed,
        formData.armySeed || null,
        formData.isNovice ? 1 : 0,
        formData.isJunior ? 1 : 0,
        formData.isSenior ? 1 : 0,
        formData.isVeteran ? 1 : 0,
        formData.isReserve ? 1 : 0,
        formData.regiment,
        formData.title,
        competitorId,
        competitionId,
      ];

      await window.api.insert(competitorQuery, competitorParams);
      navigate(-1);
    } catch (error) {
      console.error('Failed to update competitor:', error);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to remove this competitor from the competition?')) {
      try {
        const query = `DELETE FROM competition_competitor WHERE racer_id = ? AND competition_id = ?`;
        await window.api.delete(query, [competitorId, competitionId]);

        const query2 = `DELETE FROM competition_team_members WHERE racer_id = ? AND competition_id = ?`;
        await window.api.delete(query2, [competitorId, competitionId]);

        navigate(-1);
      } catch (error) {
        console.error('Failed to delete competitor:', error);
      }
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <PageHeader
          title="Edit Competitor"
          subtitle="Loading competitor details..."
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
        <Card>
          <CardContent>
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">Loading...</div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Edit Competitor"
        subtitle={`${formData.firstName} ${formData.lastName}`}
        actions={
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={handleDelete}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Remove from Competition
            </Button>
            <Button
              variant="outline"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit}>
                {/* Personal Details */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5 text-primary-600" />
                      Personal Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        label="First Name"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                      />
                      <TextField
                        label="Last Name"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                      />
                      <TextField
                        label="Rank/Title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        placeholder="e.g., Capt, Lt, Sgt"
                      />
                      <SimpleSelect
                        label="Gender"
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                      >
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </SimpleSelect>
                      <TextField
                        label="Birth Year"
                        name="birthYear"
                        type="number"
                        value={formData.birthYear}
                        onChange={handleInputChange}
                        placeholder="e.g., 1995"
                        min="1900"
                        max={new Date().getFullYear()}
                        required
                      />
                      <TextField
                        label="Service Number"
                        name="serviceNumber"
                        value={formData.serviceNumber}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Military Details */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary-600" />
                      Military Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        label="Regiment/Unit"
                        name="regiment"
                        value={formData.regiment}
                        onChange={handleInputChange}
                        placeholder="e.g., Royal Engineers"
                      />
                      <SimpleSelect
                        label="Country"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                      >
                        <option value="GBR">Great Britain</option>
                        <option value="USA">United States</option>
                        <option value="CAN">Canada</option>
                        <option value="FRA">France</option>
                        <option value="GER">Germany</option>
                        <option value="ITA">Italy</option>
                        <option value="AUT">Austria</option>
                        <option value="SUI">Switzerland</option>
                      </SimpleSelect>
                    </div>
                  </div>

                  {/* Competition Categories */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <Hash className="w-5 h-5 text-primary-600" />
                      Competition Categories
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        label="Arrival Seed Points"
                        name="arrivalSeed"
                        type="number"
                        value={formData.arrivalSeed}
                        onChange={handleInputChange}
                      />
                      <TextField
                        label="Army Seed Points"
                        name="armySeed"
                        type="number"
                        value={formData.armySeed}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <Checkbox
                        label="Novice"
                        name="isNovice"
                        checked={formData.isNovice}
                        onChange={handleInputChange}
                      />
                      <Checkbox
                        label="Junior (Under 20)"
                        name="isJunior"
                        checked={formData.isJunior}
                        onChange={handleInputChange}
                        disabled
                      />
                      <Checkbox
                        label="Senior (20-34)"
                        name="isSenior"
                        checked={formData.isSenior}
                        onChange={handleInputChange}
                        disabled
                      />
                      <Checkbox
                        label="Veteran (35+)"
                        name="isVeteran"
                        checked={formData.isVeteran}
                        onChange={handleInputChange}
                        disabled
                      />
                      <Checkbox
                        label="Reserve"
                        name="isReserve"
                        checked={formData.isReserve}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Info Sidebar */}
        <div className="col-span-1">
          <Card className="sticky top-4">
            <CardContent>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Edit Guidelines</h3>
              <div className="space-y-4 text-sm">
                <div className="p-3 bg-info/10 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-info mt-0.5" />
                    <div>
                      <p className="font-medium text-info">Age Categories</p>
                      <p className="text-neutral-600 mt-1">
                        Age categories are automatically calculated based on date of birth and cannot be edited manually.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-warning/10 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                    <div>
                      <p className="font-medium text-warning">Removing Competitor</p>
                      <p className="text-neutral-600 mt-1">
                        This only removes them from this competition, not from the system.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

export default EditCompetitorPageNew;
