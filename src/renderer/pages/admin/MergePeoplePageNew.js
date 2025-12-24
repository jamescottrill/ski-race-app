import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Search,
  GitMerge,
  Trash2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  Badge,
  Input,
} from '../../design-system';

export default function MergePeoplePageNew() {
  const navigate = useNavigate();

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceId, setSourceId] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [searchSource, setSearchSource] = useState('');
  const [searchTarget, setSearchTarget] = useState('');
  const [preview, setPreview] = useState(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    fetchPeople();
  }, []);

  useEffect(() => {
    if (sourceId) {
      fetchPreview(sourceId);
    } else {
      setPreview(null);
    }
  }, [sourceId]);

  const fetchPeople = async () => {
    try {
      const result = await window.api.select(
        `SELECT id, first_name, last_name FROM people ORDER BY last_name, first_name`
      );
      setPeople(result);
    } catch (error) {
      console.error('Failed to fetch people:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async (srcId) => {
    try {
      const counts = {};

      const racerTables = [
        { table: 'competition_competitor', column: 'racer_id', label: 'Competition entries' },
        { table: 'competition_team_members', column: 'racer_id', label: 'Team memberships' },
        { table: 'race_competitor', column: 'racer_id', label: 'Race entries' },
        { table: 'race_results', column: 'racer_id', label: 'Race results' },
        { table: 'competition_final_seed_list', column: 'racer_id', label: 'Seed list entries' },
        { table: 'aasl', column: 'service_number', label: 'AASL entries' },
      ];

      for (const { table, column, label } of racerTables) {
        const result = await window.api.select(
          `SELECT COUNT(*) as count FROM ${table} WHERE ${column} = ?`,
          [srcId]
        );
        counts[label] = result[0].count;
      }

      // Count official roles
      const raceOfficials = ['chief_of_race', 'tech_delegate', 'referee', 'asst_referee'];
      let officialCount = 0;
      for (const col of raceOfficials) {
        const result = await window.api.select(
          `SELECT COUNT(*) as count FROM races WHERE ${col} = ?`,
          [srcId]
        );
        officialCount += result[0].count;
      }

      const runOfficials = ['course_setter', 'forerunner_a', 'forerunner_b', 'forerunner_c', 'forerunner_d'];
      for (const col of runOfficials) {
        const result = await window.api.select(
          `SELECT COUNT(*) as count FROM race_run WHERE ${col} = ?`,
          [srcId]
        );
        officialCount += result[0].count;
      }

      counts['Official assignments'] = officialCount;

      setPreview(counts);
    } catch (error) {
      console.error('Failed to fetch preview:', error);
    }
  };

  const handleMerge = async () => {
    if (!sourceId || !targetId) return;

    const sourcePerson = people.find((p) => p.id === sourceId);
    const targetPerson = people.find((p) => p.id === targetId);

    const confirmed = window.confirm(
      `Are you sure you want to merge "${sourcePerson.first_name} ${sourcePerson.last_name}" (${sourceId}) into "${targetPerson.first_name} ${targetPerson.last_name}" (${targetId})?\n\nThis will transfer all records and delete the source person. This cannot be undone.`
    );

    if (!confirmed) return;

    setMerging(true);

    try {
      // Update racer references
      const racerTables = [
        'competition_competitor',
        'competition_team_members',
        'race_competitor',
        'race_results',
        'competition_final_seed_list',
      ];

      for (const table of racerTables) {
        await window.api.insert(
          `UPDATE ${table} SET racer_id = ? WHERE racer_id = ?`,
          [targetId, sourceId]
        );
      }

      // Update AASL (uses service_number)
      await window.api.insert(
        `UPDATE aasl SET service_number = ? WHERE service_number = ?`,
        [targetId, sourceId]
      );

      // Update official references in races
      const raceOfficials = ['chief_of_race', 'tech_delegate', 'referee', 'asst_referee'];
      for (const col of raceOfficials) {
        await window.api.insert(
          `UPDATE races SET ${col} = ? WHERE ${col} = ?`,
          [targetId, sourceId]
        );
      }

      // Update official references in race_run
      const runOfficials = ['course_setter', 'forerunner_a', 'forerunner_b', 'forerunner_c', 'forerunner_d'];
      for (const col of runOfficials) {
        await window.api.insert(
          `UPDATE race_run SET ${col} = ? WHERE ${col} = ?`,
          [targetId, sourceId]
        );
      }

      // Delete source person
      await window.api.delete(`DELETE FROM people WHERE id = ?`, [sourceId]);

      alert('People merged successfully!');

      // Reset and refresh
      setSourceId(null);
      setTargetId(null);
      setPreview(null);
      await fetchPeople();
    } catch (error) {
      console.error('Merge failed:', error);
      alert('Failed to merge: ' + error.message);
    } finally {
      setMerging(false);
    }
  };

  const filteredSourcePeople = useMemo(() => {
    if (!searchSource.trim()) return people;
    const term = searchSource.toLowerCase();
    return people.filter(
      (p) =>
        p.last_name?.toLowerCase().includes(term) ||
        p.first_name?.toLowerCase().includes(term) ||
        p.id?.toString().includes(term)
    );
  }, [people, searchSource]);

  const filteredTargetPeople = useMemo(() => {
    if (!searchTarget.trim()) return people;
    const term = searchTarget.toLowerCase();
    return people.filter(
      (p) =>
        p.last_name?.toLowerCase().includes(term) ||
        p.first_name?.toLowerCase().includes(term) ||
        p.id?.toString().includes(term)
    );
  }, [people, searchTarget]);

  const sourcePerson = people.find((p) => p.id === sourceId);
  const targetPerson = people.find((p) => p.id === targetId);

  const totalRecords = preview
    ? Object.values(preview).reduce((sum, count) => sum + count, 0)
    : 0;

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-500">Loading...</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Merge Duplicate People"
        subtitle="Combine two people records into one"
        actions={
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Home
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Source Person (to be removed) */}
        <Card>
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-danger" />
                <h3 className="font-semibold">Source (Remove)</h3>
              </div>
              {sourceId && (
                <Badge variant="danger">
                  {sourcePerson?.last_name}, {sourcePerson?.first_name}
                </Badge>
              )}
            </div>
            <Input
              placeholder="Search by name or service number..."
              value={searchSource}
              onChange={(e) => setSearchSource(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <CardContent noPadding>
            <div className="max-h-80 overflow-y-auto">
              {filteredSourcePeople.length === 0 ? (
                <div className="p-4 text-center text-neutral-500">
                  No people found
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-neutral-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-neutral-600">Name</th>
                      <th className="text-left p-3 text-sm font-medium text-neutral-600">Service No</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSourcePeople.map((person) => (
                      <tr
                        key={person.id}
                        className={`border-t border-neutral-100 cursor-pointer hover:bg-neutral-50 ${
                          sourceId === person.id ? 'bg-danger/10' : ''
                        } ${targetId === person.id ? 'opacity-50' : ''}`}
                        onClick={() => {
                          if (targetId !== person.id) {
                            setSourceId(sourceId === person.id ? null : person.id);
                          }
                        }}
                      >
                        <td className="p-3 font-medium">
                          {person.last_name}, {person.first_name}
                        </td>
                        <td className="p-3 text-neutral-600">{person.id}</td>
                        <td className="p-3">
                          {sourceId === person.id && (
                            <Check className="w-4 h-4 text-danger" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Target Person (to keep) */}
        <Card>
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-success" />
                <h3 className="font-semibold">Target (Keep)</h3>
              </div>
              {targetId && (
                <Badge variant="success">
                  {targetPerson?.last_name}, {targetPerson?.first_name}
                </Badge>
              )}
            </div>
            <Input
              placeholder="Search by name or service number..."
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <CardContent noPadding>
            <div className="max-h-80 overflow-y-auto">
              {filteredTargetPeople.length === 0 ? (
                <div className="p-4 text-center text-neutral-500">
                  No people found
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-neutral-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-neutral-600">Name</th>
                      <th className="text-left p-3 text-sm font-medium text-neutral-600">Service No</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTargetPeople.map((person) => (
                      <tr
                        key={person.id}
                        className={`border-t border-neutral-100 cursor-pointer hover:bg-neutral-50 ${
                          targetId === person.id ? 'bg-success/10' : ''
                        } ${sourceId === person.id ? 'opacity-50' : ''}`}
                        onClick={() => {
                          if (sourceId !== person.id) {
                            setTargetId(targetId === person.id ? null : person.id);
                          }
                        }}
                      >
                        <td className="p-3 font-medium">
                          {person.last_name}, {person.first_name}
                        </td>
                        <td className="p-3 text-neutral-600">{person.id}</td>
                        <td className="p-3">
                          {targetId === person.id && (
                            <Check className="w-4 h-4 text-success" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Merge Preview */}
      <Card>
        <div className="p-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold">Merge Preview</h3>
          </div>
        </div>
        <CardContent>
          {!sourceId && !targetId ? (
            <div className="text-center py-8 text-neutral-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
              <p>Select a source person (to remove) and a target person (to keep)</p>
            </div>
          ) : !sourceId ? (
            <div className="text-center py-8 text-neutral-500">
              <p>Select a source person to see what records will be transferred</p>
            </div>
          ) : !targetId ? (
            <div className="py-4">
              <div className="flex items-center gap-2 mb-4 text-warning">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Select a target person to merge into</span>
              </div>
              {preview && (
                <div className="space-y-2">
                  <p className="text-sm text-neutral-600 mb-2">
                    Records that will be transferred from{' '}
                    <strong>
                      {sourcePerson?.last_name}, {sourcePerson?.first_name} ({sourceId})
                    </strong>
                    :
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(preview).map(([label, count]) => (
                      <div
                        key={label}
                        className="flex justify-between items-center bg-neutral-50 px-3 py-2 rounded"
                      >
                        <span className="text-sm text-neutral-600">{label}</span>
                        <Badge variant={count > 0 ? 'primary' : 'default'}>{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="text-center">
                  <div className="text-sm text-neutral-500 mb-1">Source (Remove)</div>
                  <div className="font-semibold text-danger">
                    {sourcePerson?.last_name}, {sourcePerson?.first_name}
                  </div>
                  <div className="text-sm text-neutral-500">{sourceId}</div>
                </div>
                <GitMerge className="w-8 h-8 text-primary-500" />
                <div className="text-center">
                  <div className="text-sm text-neutral-500 mb-1">Target (Keep)</div>
                  <div className="font-semibold text-success">
                    {targetPerson?.last_name}, {targetPerson?.first_name}
                  </div>
                  <div className="text-sm text-neutral-500">{targetId}</div>
                </div>
              </div>

              {preview && (
                <div className="mb-6">
                  <p className="text-sm text-neutral-600 mb-2">Records to transfer:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(preview).map(([label, count]) => (
                      <div
                        key={label}
                        className="flex justify-between items-center bg-neutral-50 px-3 py-2 rounded"
                      >
                        <span className="text-sm text-neutral-600">{label}</span>
                        <Badge variant={count > 0 ? 'primary' : 'default'}>{count}</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-neutral-500">
                    Total: {totalRecords} record(s) will be transferred
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <Button
                  variant="danger"
                  size="lg"
                  onClick={handleMerge}
                  disabled={merging}
                  leftIcon={<GitMerge className="w-5 h-5" />}
                >
                  {merging ? 'Merging...' : 'Merge People'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
