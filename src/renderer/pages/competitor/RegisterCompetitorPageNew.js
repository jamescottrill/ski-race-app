import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserPlus,
  ArrowLeft,
  Search,
  Save,
  Shield,
  Calendar,
  Hash,
  Users
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  TextField,
  SimpleSelect,
  SearchableSelect,
  Checkbox,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { hashServiceNumber } from '../../utils/hashUtils';

function RegisterCompetitorPageNew() {
  const handleBack = useBackButton();
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const [existingCompetitors, setExistingCompetitors] = useState([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    title: '',
    birthYear: '',
    country: 'GBR',
    serviceNumber: '',
    gender: 'M',
    // arrivalSeed: 2000,
    armySeed: '',
    isNovice: false,
    isJunior: false,
    isSenior: false,
    isVeteran: false,
    isReserve: false,
    regiment: '',
  });

  const fetchExistingCompetitors = async () => {
    const query = `
      SELECT p.id, p.first_name, p.last_name, p.id AS service_number
      FROM people p
      LEFT JOIN competition_competitor cc ON p.id = cc.racer_id
      WHERE cc.competition_id != ? OR cc.competition_id IS NULL
    `;
    const params = [competitionId];

    try {
      const result = await window.api.select(query, params);
      setExistingCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    }
  };

  const fetchCompetitorDetails = async (competitorId) => {
    const query = `
      SELECT first_name, last_name, birth_year, country, id AS service_number, gender
      FROM people WHERE id = ?
    `;
    try {
      const result = await window.api.select(query, [competitorId]);
      if (result && result.length > 0) {
        const competitor = result[0];
        const ageCategory = calculateAgeCategory(competitor.birth_year);
        setFormData({
          ...formData,
          firstName: competitor.first_name,
          lastName: competitor.last_name,
          birthYear: competitor.birth_year,
          country: competitor.country || 'GBR',
          serviceNumber: competitor.service_number,
          gender: competitor.gender || 'M',
          ...ageCategory,
        });
      }
    } catch (error) {
      console.error('Failed to fetch competitor details:', error);
    }
  };

  const calculateAgeCategory = (birthYear) => {
    const currentYear = new Date().getFullYear();
    const age = currentYear - parseInt(birthYear, 10);

    return {
      isJunior: age < 20,
      isSenior: age >= 20 && age < 35,
      isVeteran: age >= 35,
    };
  };

  useEffect(() => {
    fetchExistingCompetitors();
  }, [competitionId]);

  useEffect(() => {
    if (selectedCompetitorId) {
      fetchCompetitorDetails(selectedCompetitorId);
    }
  }, [selectedCompetitorId]);

  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });

    if (name === 'birthYear') {
      const ageCategory = calculateAgeCategory(value);
      setFormData(prev => ({ ...prev, ...ageCategory }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let racerId;

    if (selectedCompetitorId) {
      racerId = selectedCompetitorId;
    } else {
      // Hash the service number to use as the id
      racerId = await hashServiceNumber(formData.serviceNumber);
      if (!racerId) {
        alert('Service number is required');
        return;
      }

      // Check if service number already exists (using hashed id)
      const existingPerson = await window.api.select(
        'SELECT id, first_name, last_name FROM people WHERE id = ?',
        [racerId],
      );
      if (existingPerson.length > 0) {
        const person = existingPerson[0];
        alert(
          `A person with this service number already exists: ${person.first_name} ${person.last_name}`,
        );
        return;
      }

      const personQuery = `
        INSERT INTO people (id, first_name, last_name, birth_year, country, gender)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const personParams = [
        racerId,
        formData.firstName,
        formData.lastName,
        formData.birthYear,
        formData.country,
        formData.gender,
      ];

      try {
        await window.api.insert(personQuery, personParams);
      } catch (error) {
        console.error('Failed to create person:', error);
        return;
      }
    }

    // Calculate age category from birth year
    const { isJunior, isSenior, isVeteran } = formData.birthYear
      ? calculateAgeCategory(formData.birthYear)
      : { isJunior: false, isSenior: true, isVeteran: false };

    // Register competitor
    const competitorQuery = `
      INSERT INTO competition_competitor (
        competition_id, racer_id, arrival_corps_seed, arrival_army_seed,
        is_novice, is_junior, is_senior, is_veteran, is_reserve, is_female,
        regiment, title
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const competitorParams = [
      competitionId,
      racerId,
      formData.arrivalSeed || null,
      formData.armySeed || null,
      formData.isNovice ? 1 : 0,
      isJunior ? 1 : 0,
      isSenior ? 1 : 0,
      isVeteran ? 1 : 0,
      formData.isReserve ? 1 : 0,
      formData.gender === 'F' ? 1 : 0,
      formData.regiment,
      formData.title,
    ];

    try {
      await window.api.insert(competitorQuery, competitorParams);
      navigate(-1);
    } catch (error) {
      console.error('Failed to register competitor:', error);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Register Competitor"
        subtitle="Add a new athlete to the competition"
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

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit}>
                {/* Existing Competitor Selection */}
                <div className="mb-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select Existing Competitor (Optional)
                  </label>
                  <SearchableSelect
                    value={selectedCompetitorId}
                    onChange={(value) => setSelectedCompetitorId(value)}
                    placeholder="Create New Competitor"
                    searchPlaceholder="Search for competitor..."
                    emptyText="No competitors found."
                    options={[
                      { value: '', label: 'Create New Competitor' },
                      ...existingCompetitors.map((competitor) => ({
                        value: competitor.id,
                        label: `${competitor.first_name} ${competitor.last_name}`,
                      })),
                    ]}
                  />
                </div>

                {/* Personal Details */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">Personal Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        label="First Name"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                        disabled={!!selectedCompetitorId}
                      />
                      <TextField
                        label="Last Name"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                        disabled={!!selectedCompetitorId}
                      />
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
                        disabled={!!selectedCompetitorId}
                      >
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </SimpleSelect>
                    </div>
                  </div>

                  {/* Military Details */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">Military Details</h3>
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
                        disabled={!!selectedCompetitorId}
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
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">Competition Categories</h3>
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
                      Register Competitor
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Help Sidebar */}
        <div className="col-span-1">
          <Card className="sticky top-4">
            <CardContent>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Registration Guide</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="flex items-center gap-2 text-primary-700 font-medium mb-2">
                    <Search className="w-4 h-4" />
                    Existing Competitors
                  </div>
                  <p className="text-neutral-600">
                    Search for competitors already in the system to avoid duplicates.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-primary-700 font-medium mb-2">
                    <Calendar className="w-4 h-4" />
                    Age Categories
                  </div>
                  <p className="text-neutral-600">
                    Age categories are automatically calculated based on date of birth.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-primary-700 font-medium mb-2">
                    <Hash className="w-4 h-4" />
                    Seed Points
                  </div>
                  <p className="text-neutral-600">
                    Default arrival seed is 2000. Army seed is optional and based on previous performance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

export default RegisterCompetitorPageNew;
