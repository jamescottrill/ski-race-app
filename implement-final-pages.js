#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const implementations = {
  'src/renderer/pages/results/individualNew.js': `import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Medal,
  ArrowLeft,
  Clock,
  User,
  Timer
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function IndividualResultsNew() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [results, setResults] = useState([]);
  const [raceDetails, setRaceDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRaceDetails();
    fetchResults();
  }, [raceId, competitionId]);

  const fetchRaceDetails = async () => {
    try {
      const query = \`
        SELECT race_name, race_type, number_runs, venue, race_date
        FROM races 
        WHERE race_id = ? AND competition_id = ?
      \`;
      const result = await window.api.select(query, [raceId, competitionId]);
      if (result.length > 0) {
        setRaceDetails(result[0]);
      }
    } catch (error) {
      console.error('Failed to fetch race details:', error);
    }
  };

  const fetchResults = async () => {
    try {
      const query = \`
        SELECT 
          rr.competitor_id,
          p.first_name,
          p.last_name,
          cc.bib_number,
          cc.regiment,
          rr.run_1_time,
          rr.run_2_time,
          rr.total_time,
          rr.dnf_run_1,
          rr.dnf_run_2,
          rr.dsq_run_1,
          rr.dsq_run_2,
          rr.points
        FROM race_results rr
        INNER JOIN people p ON rr.competitor_id = p.id
        INNER JOIN competition_competitor cc ON p.id = cc.racer_id AND cc.competition_id = ?
        WHERE rr.race_id = ?
        ORDER BY 
          CASE 
            WHEN rr.dnf_run_1 = 1 OR rr.dnf_run_2 = 1 THEN 999999
            WHEN rr.dsq_run_1 = 1 OR rr.dsq_run_2 = 1 THEN 999998
            ELSE COALESCE(rr.total_time, rr.run_1_time)
          END
      \`;
      const result = await window.api.select(query, [competitionId, raceId]);
      
      // Add position numbers
      let position = 1;
      const resultsWithPosition = result.map((row, index) => {
        const hasDNF = row.dnf_run_1 || row.dnf_run_2;
        const hasDSQ = row.dsq_run_1 || row.dsq_run_2;
        
        if (hasDNF || hasDSQ) {
          return { ...row, position: '-' };
        }
        
        return { ...row, position: index + 1 };
      });
      
      setResults(resultsWithPosition);
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return '--:--';
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(2);
    return \`\${minutes}:\${seconds.padStart(5, '0')}\`;
  };

  const columns = [
    {
      header: 'Pos',
      accessorKey: 'position',
      cell: ({ row }) => {
        const position = row.original.position;
        if (position === 1) {
          return (
            <div className="flex items-center gap-2">
              <div className="font-bold text-xl text-yellow-600">{position}</div>
              <Trophy className="w-5 h-5 text-yellow-600" />
            </div>
          );
        } else if (position === 2) {
          return (
            <div className="flex items-center gap-2">
              <div className="font-bold text-xl text-gray-500">{position}</div>
              <Medal className="w-5 h-5 text-gray-500" />
            </div>
          );
        } else if (position === 3) {
          return (
            <div className="flex items-center gap-2">
              <div className="font-bold text-xl text-orange-600">{position}</div>
              <Medal className="w-5 h-5 text-orange-600" />
            </div>
          );
        }
        return <div className="font-semibold text-lg">{position}</div>;
      },
    },
    {
      header: 'Bib',
      accessorKey: 'bib_number',
      cell: ({ row }) => (
        <div className="font-mono">{row.original.bib_number || '-'}</div>
      ),
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </div>
          <div className="text-xs text-neutral-500">{row.original.regiment}</div>
        </div>
      ),
    },
    {
      header: 'Run 1',
      accessorKey: 'run_1_time',
      cell: ({ row }) => {
        if (row.original.dnf_run_1) return <Badge variant="danger">DNF</Badge>;
        if (row.original.dsq_run_1) return <Badge variant="danger">DSQ</Badge>;
        return <span className="font-mono">{formatTime(row.original.run_1_time)}</span>;
      },
    },
    ...(raceDetails?.number_runs === 2 ? [{
      header: 'Run 2',
      accessorKey: 'run_2_time',
      cell: ({ row }) => {
        if (row.original.dnf_run_2) return <Badge variant="danger">DNF</Badge>;
        if (row.original.dsq_run_2) return <Badge variant="danger">DSQ</Badge>;
        return <span className="font-mono">{formatTime(row.original.run_2_time)}</span>;
      },
    }] : []),
    {
      header: 'Total Time',
      accessorKey: 'total_time',
      cell: ({ row }) => {
        const hasDNF = row.original.dnf_run_1 || row.original.dnf_run_2;
        const hasDSQ = row.original.dsq_run_1 || row.original.dsq_run_2;
        
        if (hasDNF) return <Badge variant="danger">DNF</Badge>;
        if (hasDSQ) return <Badge variant="danger">DSQ</Badge>;
        
        const time = row.original.total_time || row.original.run_1_time;
        return (
          <span className="font-mono font-bold text-lg">
            {formatTime(time)}
          </span>
        );
      },
    },
    {
      header: 'Points',
      accessorKey: 'points',
      cell: ({ row }) => (
        <span className="font-bold">{row.original.points || 0}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Loading..." />
        <Card><CardContent>Loading results...</CardContent></Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Individual Results"
        subtitle={\`\${raceDetails?.race_name || 'Race'} • \${raceDetails?.venue || 'TBD'}\`}
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

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Competitors</p>
              <p className="text-2xl font-bold text-primary-700">{results.length}</p>
            </div>
            <User className="w-8 h-8 text-primary-300" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Finishers</p>
              <p className="text-2xl font-bold text-success">
                {results.filter(r => !r.dnf_run_1 && !r.dnf_run_2 && !r.dsq_run_1 && !r.dsq_run_2).length}
              </p>
            </div>
            <Trophy className="w-8 h-8 text-success/30" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">DNF/DSQ</p>
              <p className="text-2xl font-bold text-danger">
                {results.filter(r => r.dnf_run_1 || r.dnf_run_2 || r.dsq_run_1 || r.dsq_run_2).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-danger/30" />
          </div>
        </Card>
      </div>
      
      <Card>
        <CardContent noPadding>
          <DataTable columns={columns} data={results} pageSize={100} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}`,

  'src/renderer/pages/race/RaceTeamManagementNew.js': `import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  ArrowLeft,
  Plus,
  Trash2,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge,
  SimpleSelect,
  Label
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function RaceTeamManagementNew() {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [teams, setTeams] = useState([]);
  const [availableCompetitors, setAvailableCompetitors] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
    fetchAvailableCompetitors();
  }, [competitionId]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamMembers(selectedTeam);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    try {
      const query = \`
        SELECT 
          ct.team_id,
          ct.team_name,
          ct.team_type,
          COUNT(DISTINCT ctm.racer_id) as member_count
        FROM competition_team ct
        LEFT JOIN competition_team_members ctm ON ct.team_id = ctm.team_id
        WHERE ct.competition_id = ?
        GROUP BY ct.team_id, ct.team_name, ct.team_type
        ORDER BY ct.team_name
      \`;
      const result = await window.api.select(query, [competitionId]);
      setTeams(result);
      if (result.length > 0 && !selectedTeam) {
        setSelectedTeam(result[0].team_id);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId) => {
    try {
      const query = \`
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          cc.bib_number,
          cc.regiment
        FROM competition_team_members ctm
        INNER JOIN people p ON ctm.racer_id = p.id
        INNER JOIN competition_competitor cc ON p.id = cc.racer_id AND cc.competition_id = ?
        WHERE ctm.team_id = ?
        ORDER BY p.last_name, p.first_name
      \`;
      const result = await window.api.select(query, [competitionId, teamId]);
      setTeamMembers(result);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    }
  };

  const fetchAvailableCompetitors = async () => {
    try {
      const query = \`
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          cc.bib_number,
          cc.regiment
        FROM people p
        INNER JOIN competition_competitor cc ON p.id = cc.racer_id
        WHERE cc.competition_id = ?
        AND p.id NOT IN (
          SELECT racer_id FROM competition_team_members 
          WHERE team_id IN (SELECT team_id FROM competition_team WHERE competition_id = ?)
        )
        ORDER BY p.last_name, p.first_name
      \`;
      const result = await window.api.select(query, [competitionId, competitionId]);
      setAvailableCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch available competitors:', error);
    }
  };

  const handleAddMember = async (competitorId) => {
    if (!selectedTeam) return;
    
    try {
      await window.api.insert(
        'INSERT INTO competition_team_members (team_id, racer_id) VALUES (?, ?)',
        [selectedTeam, competitorId]
      );
      await fetchTeamMembers(selectedTeam);
      await fetchAvailableCompetitors();
    } catch (error) {
      console.error('Failed to add team member:', error);
    }
  };

  const handleRemoveMember = async (competitorId) => {
    if (!selectedTeam) return;
    
    try {
      await window.api.delete(
        'DELETE FROM competition_team_members WHERE team_id = ? AND racer_id = ?',
        [selectedTeam, competitorId]
      );
      await fetchTeamMembers(selectedTeam);
      await fetchAvailableCompetitors();
    } catch (error) {
      console.error('Failed to remove team member:', error);
    }
  };

  const memberColumns = [
    {
      header: 'Bib',
      accessorKey: 'bib_number',
      cell: ({ row }) => (
        <Badge variant="primary">{row.original.bib_number || '-'}</Badge>
      )
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </div>
          <div className="text-xs text-neutral-500">{row.original.regiment}</div>
        </div>
      )
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="danger"
          onClick={() => handleRemoveMember(row.original.id)}
          leftIcon={<UserMinus className="w-3 h-3" />}
        >
          Remove
        </Button>
      )
    }
  ];

  const availableColumns = [
    {
      header: 'Bib',
      accessorKey: 'bib_number',
      cell: ({ row }) => (
        <Badge variant="default">{row.original.bib_number || '-'}</Badge>
      )
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.first_name} {row.original.last_name}
          </div>
          <div className="text-xs text-neutral-500">{row.original.regiment}</div>
        </div>
      )
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="primary"
          onClick={() => handleAddMember(row.original.id)}
          leftIcon={<UserPlus className="w-3 h-3" />}
        >
          Add
        </Button>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Race Team Management"
        subtitle="Manage teams for this race"
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
      
      <div className="mb-6">
        <Card>
          <CardContent>
            <Label htmlFor="team-select">Select Team</Label>
            <SimpleSelect
              id="team-select"
              value={selectedTeam || ''}
              onChange={(e) => setSelectedTeam(e.target.value)}
            >
              <option value="">Select a team</option>
              {teams.map(team => (
                <option key={team.team_id} value={team.team_id}>
                  {team.team_name} ({team.member_count} members)
                </option>
              ))}
            </SimpleSelect>
          </CardContent>
        </Card>
      </div>

      {selectedTeam && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-500" />
                Team Members ({teamMembers.length})
              </h3>
              <DataTable 
                columns={memberColumns} 
                data={teamMembers} 
                pageSize={10}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-success" />
                Available Competitors ({availableCompetitors.length})
              </h3>
              <DataTable 
                columns={availableColumns} 
                data={availableCompetitors} 
                pageSize={10}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}`,

  'src/renderer/pages/race/GenerateStartListTeamNew.js': `import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Users, 
  ArrowLeft,
  Download,
  Shuffle
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function GenerateStartListTeamNew() {
  const { competitionId, raceId } = useParams();
  const handleBack = useBackButton();
  const [startList, setStartList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateTeamStartList();
  }, [competitionId]);

  const generateTeamStartList = async () => {
    try {
      // Get teams with their best seed points
      const query = \`
        SELECT 
          ct.team_id,
          ct.team_name,
          ct.team_type,
          MIN(COALESCE(cc.army_seed, cc.arrival_seed, 9999)) as best_seed,
          COUNT(ctm.racer_id) as team_size
        FROM competition_team ct
        LEFT JOIN competition_team_members ctm ON ct.team_id = ctm.team_id
        LEFT JOIN competition_competitor cc ON ctm.racer_id = cc.racer_id AND cc.competition_id = ?
        WHERE ct.competition_id = ?
        GROUP BY ct.team_id, ct.team_name, ct.team_type
        ORDER BY MIN(COALESCE(cc.army_seed, cc.arrival_seed, 9999))
      \`;
      const result = await window.api.select(query, [competitionId, competitionId]);
      
      // Add start order
      const withStartOrder = result.map((team, index) => ({
        ...team,
        startOrder: index + 1
      }));
      
      setStartList(withStartOrder);
    } catch (error) {
      console.error('Failed to generate team start list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRandomizeTop = () => {
    if (startList.length === 0) return;
    
    const topTeams = startList.slice(0, Math.min(15, startList.length));
    const restTeams = startList.slice(Math.min(15, startList.length));
    
    // Fisher-Yates shuffle for top teams
    const shuffled = [...topTeams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Re-assign start orders
    const newList = [...shuffled, ...restTeams].map((team, index) => ({
      ...team,
      startOrder: index + 1
    }));
    
    setStartList(newList);
  };

  const columns = [
    {
      header: 'Start #',
      accessorKey: 'startOrder',
      cell: ({ row }) => <div className="font-bold text-lg">{row.original.startOrder}</div>
    },
    {
      header: 'Team Name',
      accessorKey: 'team_name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary-500" />
          <span className="font-medium">{row.original.team_name}</span>
        </div>
      )
    },
    {
      header: 'Type',
      accessorKey: 'team_type',
      cell: ({ row }) => {
        const type = row.original.team_type;
        const variant = type === 'Alpine' ? 'primary' : type === 'Nordic' ? 'info' : 'default';
        return <Badge variant={variant}>{type || 'General'}</Badge>;
      }
    },
    {
      header: 'Team Size',
      accessorKey: 'team_size',
      cell: ({ row }) => (
        <Badge variant="default">{row.original.team_size} members</Badge>
      )
    },
    {
      header: 'Best Seed',
      accessorKey: 'best_seed',
      cell: ({ row }) => (
        <span className="font-mono">
          {row.original.best_seed === 9999 ? '-' : row.original.best_seed}
        </span>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Generate Team Start List"
        subtitle="Team starting order based on best seed points"
        actions={
          <div className="flex gap-3">
            <Button 
              variant="primary" 
              leftIcon={<Shuffle className="w-4 h-4" />}
              onClick={handleRandomizeTop}
            >
              Randomize Top 15
            </Button>
            <Button variant="outline" leftIcon={<Download className="w-4 h-4" />}>
              Export PDF
            </Button>
            <Button variant="outline" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          </div>
        }
      />
      
      <Card>
        <CardContent noPadding>
          {loading ? (
            <div className="p-8 text-center">Loading teams...</div>
          ) : startList.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-600">No teams available for this competition</p>
            </div>
          ) : (
            <DataTable columns={columns} data={startList} pageSize={50} />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}`,

  'src/renderer/pages/competitor/EditCompetitorsPageNew.js': `import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  ArrowLeft,
  Search,
  Edit2,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button,
  DataTable,
  Badge,
  Input,
  Label
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function EditCompetitorsPageNew() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [competitors, setCompetitors] = useState([]);
  const [filteredCompetitors, setFilteredCompetitors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitors();
  }, [competitionId]);

  useEffect(() => {
    const filtered = competitors.filter(comp => {
      const searchLower = searchTerm.toLowerCase();
      return (
        comp.first_name?.toLowerCase().includes(searchLower) ||
        comp.last_name?.toLowerCase().includes(searchLower) ||
        comp.bib_number?.toString().includes(searchLower) ||
        comp.regiment?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredCompetitors(filtered);
  }, [searchTerm, competitors]);

  const fetchCompetitors = async () => {
    try {
      const query = \`
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          p.date_of_birth,
          p.gender,
          cc.bib_number,
          cc.regiment,
          cc.team,
          cc.arrival_corps_seed,
          cc.arrival_army_seed
        FROM people p
        INNER JOIN competition_competitor cc ON p.id = cc.racer_id
        WHERE cc.competition_id = ?
        ORDER BY cc.bib_number, p.last_name, p.first_name
      \`;
      const result = await window.api.select(query, [competitionId]);
      setCompetitors(result);
      setFilteredCompetitors(result);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (competitor) => {
    setEditingId(competitor.id);
    setEditForm({
      first_name: competitor.first_name,
      last_name: competitor.last_name,
      bib_number: competitor.bib_number,
      regiment: competitor.regiment,
      team: competitor.team,
      arrival_corps_seed: competitor.arrival_corps_seed,
      arrival_army_seed: competitor.arrival_army_seed
    });
  };

  const handleSave = async () => {
    try {
      // Update person table
      await window.api.update(
        'UPDATE people SET first_name = ?, last_name = ? WHERE id = ?',
        [editForm.first_name, editForm.last_name, editingId]
      );
      
      // Update competition_competitor table
      await window.api.update(
        \`UPDATE competition_competitor 
         SET bib_number = ?, regiment = ?, team = ?, 
             arrival_corps_seed = ?, arrival_army_seed = ?
         WHERE racer_id = ? AND competition_id = ?\`,
        [
          editForm.bib_number,
          editForm.regiment,
          editForm.team,
          editForm.arrival_corps_seed,
          editForm.arrival_army_seed,
          editingId,
          competitionId
        ]
      );
      
      setEditingId(null);
      await fetchCompetitors();
    } catch (error) {
      console.error('Failed to save competitor:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleDelete = async (competitor) => {
    if (window.confirm(\`Are you sure you want to remove \${competitor.first_name} \${competitor.last_name} from this competition?\`)) {
      try {
        await window.api.delete(
          'DELETE FROM competition_competitor WHERE racer_id = ? AND competition_id = ?',
          [competitor.id, competitionId]
        );
        await fetchCompetitors();
      } catch (error) {
        console.error('Failed to delete competitor:', error);
        alert('Failed to delete competitor. They may have race results.');
      }
    }
  };

  const columns = [
    {
      header: 'Bib',
      accessorKey: 'bib_number',
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Input
              type="number"
              value={editForm.bib_number}
              onChange={(e) => setEditForm({...editForm, bib_number: e.target.value})}
              className="w-20"
            />
          );
        }
        return <Badge variant="primary">{row.original.bib_number || '-'}</Badge>;
      }
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <div className="flex gap-2">
              <Input
                value={editForm.first_name}
                onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                placeholder="First"
                className="w-32"
              />
              <Input
                value={editForm.last_name}
                onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                placeholder="Last"
                className="w-32"
              />
            </div>
          );
        }
        return (
          <div>
            <div className="font-medium">
              {row.original.first_name} {row.original.last_name}
            </div>
            <div className="text-xs text-neutral-500">
              {row.original.gender} • {row.original.date_of_birth}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Regiment',
      accessorKey: 'regiment',
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Input
              value={editForm.regiment}
              onChange={(e) => setEditForm({...editForm, regiment: e.target.value})}
              className="w-40"
            />
          );
        }
        return <span className="text-sm">{row.original.regiment}</span>;
      }
    },
    {
      header: 'Team',
      accessorKey: 'team',
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Input
              value={editForm.team}
              onChange={(e) => setEditForm({...editForm, team: e.target.value})}
              className="w-32"
            />
          );
        }
        return row.original.team ? (
          <Badge variant="info">{row.original.team}</Badge>
        ) : '-';
      }
    },
    {
      header: 'Seeds',
      accessorKey: 'seeds',
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <div className="flex gap-2">
              <Input
                type="number"
                value={editForm.arrival_corps_seed}
                onChange={(e) => setEditForm({...editForm, arrival_corps_seed: e.target.value})}
                placeholder="Corps"
                className="w-20"
              />
              <Input
                type="number"
                value={editForm.arrival_army_seed}
                onChange={(e) => setEditForm({...editForm, arrival_army_seed: e.target.value})}
                placeholder="Army"
                className="w-20"
              />
            </div>
          );
        }
        return (
          <div className="text-sm">
            <span className="font-mono">
              C: {row.original.arrival_corps_seed || '-'} / 
              A: {row.original.arrival_army_seed || '-'}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleSave}
                leftIcon={<Save className="w-3 h-3" />}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingId(null)}
                leftIcon={<X className="w-3 h-3" />}
              >
                Cancel
              </Button>
            </div>
          );
        }
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEdit(row.original)}
              leftIcon={<Edit2 className="w-3 h-3" />}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDelete(row.original)}
              leftIcon={<Trash2 className="w-3 h-3" />}
            >
              Remove
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Edit Competitors"
        subtitle="Manage competitor details for this competition"
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
      
      <Card className="mb-6">
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Competitors</Label>
              <Input
                id="search"
                placeholder="Search by name, bib, or regiment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-neutral-400" />}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent noPadding>
          {loading ? (
            <div className="p-8 text-center">Loading competitors...</div>
          ) : filteredCompetitors.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-600">
                {searchTerm ? 'No competitors match your search' : 'No competitors registered'}
              </p>
            </div>
          ) : (
            <DataTable columns={columns} data={filteredCompetitors} pageSize={20} />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}`
};

// Write all implementations
Object.entries(implementations).forEach(([filePath, content]) => {
  fs.writeFileSync(filePath, content);
  console.log(`Implemented ${filePath}`);
});

console.log('All remaining pages implemented!');