import React, { useState, useEffect } from 'react';
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
      const query = `
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          p.dob as date_of_birth,
          p.gender,
          cc.regiment,
          cc.arrival_corps_seed,
          cc.arrival_army_seed,
          cc.is_novice,
          cc.is_junior,
          cc.is_senior,
          cc.is_veteran,
          cc.is_reserve,
          cc.is_female,
          cc.title
        FROM people p
        INNER JOIN competition_competitor cc ON p.id = cc.racer_id
        WHERE cc.competition_id = ?
        ORDER BY p.last_name, p.first_name
      `;
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
      regiment: competitor.regiment,
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
        `UPDATE competition_competitor 
         SET regiment = ?, 
             arrival_corps_seed = ?, arrival_army_seed = ?
         WHERE racer_id = ? AND competition_id = ?`,
        [
          editForm.regiment,
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
    if (window.confirm(`Are you sure you want to remove ${competitor.first_name} ${competitor.last_name} from this competition?`)) {
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
              {row.original.title && <span className="ml-2 text-neutral-500">({row.original.title})</span>}
            </div>
            <div className="text-xs text-neutral-500">
              {row.original.gender} • DOB: {row.original.date_of_birth || 'Unknown'}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Category',
      accessorKey: 'category',
      cell: ({ row }) => {
        const categories = [];
        if (row.original.is_female) categories.push('F');
        if (row.original.is_junior) categories.push('JR');
        if (row.original.is_senior) categories.push('SR');
        if (row.original.is_veteran) categories.push('VET');
        if (row.original.is_novice) categories.push('NOV');
        if (row.original.is_reserve) categories.push('RES');
        
        return categories.length > 0 ? (
          <div className="flex gap-1">
            {categories.map(cat => (
              <Badge key={cat} variant="secondary" size="sm">{cat}</Badge>
            ))}
          </div>
        ) : <span className="text-neutral-400">-</span>;
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
        return <span className="text-sm">{row.original.regiment || '-'}</span>;
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
}