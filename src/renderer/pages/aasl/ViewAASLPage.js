import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Trash2,
  Download
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  TextField,
  DataTable,
  Badge,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { getAllAASLEntries, getAASLSeasons, deleteAASLBySeason } from '../../utils/AASLManagement';
import {hashServiceNumber} from '../../utils/hashUtils';
import toast from 'react-hot-toast';

export default function ViewAASLPage() {
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [entries, setEntries] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filteredEntries, setFilteredEntries] = useState([]);

  useEffect(() => {
    const fetchSeasons = async () => {
      const seasonList = await getAASLSeasons();
      setSeasons(seasonList);
      if (seasonList.length > 0) {
        setSelectedSeason(seasonList[0]);
      }
    };
    fetchSeasons();
  }, []);

  useEffect(() => {
    const fetchEntries = async () => {
      if (!selectedSeason) return;
      setLoading(true);
      const data = await getAllAASLEntries(selectedSeason);
      setEntries(data);
      setLoading(false);
    };
    fetchEntries();
  }, [selectedSeason]);

  useEffect(() => {
    const filterEntries = async () => {
      if (!searchTerm) {
        setFilteredEntries(entries);
        return;
      }
      const search = searchTerm.toLowerCase();
      const hashedSearch = await hashServiceNumber(search);
      const filtered = entries.filter(entry => (
        entry.first_name?.toLowerCase().includes(search) ||
        entry.last_name?.toLowerCase().includes(search) ||
        entry.service_number === hashedSearch
      ));
      setFilteredEntries(filtered);
    };
    filterEntries();
  }, [entries, searchTerm]);

  const handleDeleteSeason = async () => {
    if (!selectedSeason) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete all AASL entries for season ${selectedSeason}? This cannot be undone.`
    );

    if (confirmed) {
      const result = await deleteAASLBySeason(selectedSeason);
      if (result.success) {
        toast.success(`Deleted ${result.deleted} entries`);
        const updatedSeasons = seasons.filter(s => s !== selectedSeason);
        setSeasons(updatedSeasons);
        setSelectedSeason(updatedSeasons[0] || '');
        setEntries([]);
      } else {
        toast.error('Failed to delete entries');
      }
    }
  };

  const columns = [
    {
      header: 'Pos',
      accessorKey: 'position',
      cell: ({ row }) => row.index + 1
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => `${row.original.last_name?.toUpperCase() || ''}, ${row.original.first_name || ''}`
    },
    {
      header: 'Gender',
      accessorKey: 'gender',
      cell: ({ row }) => (
        <Badge variant={row.original.gender === 'F' ? 'warning' : 'primary'}>
          {row.original.gender || '-'}
        </Badge>
      )
    },
    {
      header: 'Category',
      accessorKey: 'category'
    },
    {
      header: 'Seed Points',
      accessorKey: 'seed_points',
      cell: ({ row }) => (
        <span className="font-mono font-medium">
          {row.original.seed_points?.toFixed(2) || '-'}
        </span>
      )
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="View AASL"
        subtitle="Browse Army Alpine Seed List entries"
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Season</label>
                <select
                  className="px-3 py-2 border border-neutral-300 rounded-md text-sm min-w-32"
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                >
                  {seasons.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 max-w-sm">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search by name or service number..."
                    className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-md text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSeason}
                leftIcon={<Trash2 className="w-4 h-4" />}
                className="text-danger-600 hover:bg-danger-50"
                disabled={!selectedSeason}
              >
                Delete Season
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-neutral-600">Loading...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-600">
                {entries.length === 0
                  ? 'No AASL entries for this season'
                  : 'No entries match your search'}
              </p>
            </div>
          ) : (
            <>
              <DataTable
                data={filteredEntries}
                columns={columns}
              />
              <p className="text-sm text-neutral-600 mt-4">
                Showing {filteredEntries.length} of {entries.length} entries
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
