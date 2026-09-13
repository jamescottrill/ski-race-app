import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card,
  CardContent,
  Button,
  Badge,
  DataTable,
  SimpleSelect,
  PageContainer,
  PageHeader,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import * as syncApi from '../../api/sync';
import {
  LOG_STATUS_TONES,
  formatDateTime,
  summariseKey,
  prettyPayload,
  entityLabel,
} from '../../utils/syncPresentation';

const PAGE = 100;
const STATUS_FILTERS = ['pending', 'synced', 'dead', 'superseded'];

// Column definitions live outside the component (the callbacks are injected
// through a factory) so React sees stable cell components between renders
function buildColumns({ onRetry, onDiscard, onView }) {
  function StatusCell({ row }) {
    return (
      <Badge variant={LOG_STATUS_TONES[row.original.status] || 'default'}>
        {row.original.status}
      </Badge>
    );
  }
  function ActionsCell({ row }) {
    const event = row.original;
    return (
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => onView(event)}>
          Payload
        </Button>
        {event.status === 'dead' && (
          <>
            <Button variant="outline" size="sm" onClick={() => onRetry(event)}>
              Retry
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDiscard(event)}>
              Discard
            </Button>
          </>
        )}
      </div>
    );
  }
  return [
    { accessorKey: 'id', header: 'Id' },
    {
      accessorKey: 'created_at',
      header: 'Time',
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
    {
      accessorKey: 'entity_type',
      header: 'Entity',
      cell: ({ row }) => entityLabel(row.original.entity_type),
    },
    {
      accessorKey: 'entity_key',
      header: 'Key',
      cell: ({ row }) =>
        summariseKey(row.original.entity_type, row.original.entity_key),
    },
    { accessorKey: 'op', header: 'Op' },
    { accessorKey: 'status', header: 'Status', cell: StatusCell },
    { accessorKey: 'attempts', header: 'Attempts' },
    {
      accessorKey: 'last_error',
      header: 'Last error',
      cell: ({ row }) => (
        <span className="text-xs text-danger">
          {row.original.last_error || ''}
        </span>
      ),
    },
    { id: 'actions', header: '', cell: ActionsCell },
  ];
}

/** The outbox for one competition: what has gone, what is waiting, what failed. */
function SyncLogPage() {
  const { competitionId } = useParams();
  const handleBack = useBackButton();
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [discarding, setDiscarding] = useState(null);

  const fetchPage = useCallback(
    async (beforeId) => {
      const options = { limit: PAGE };
      if (statusFilter) options.status = statusFilter;
      if (beforeId) options.beforeId = beforeId;
      return syncApi.getSyncLog(competitionId, options);
    },
    [competitionId, statusFilter],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchPage();
      setRows(page);
      setExhausted(page.length < PAGE);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!window.sync) return;
    reload();
  }, [reload]);

  const loadMore = async () => {
    if (rows.length === 0) return;
    setLoading(true);
    try {
      const page = await fetchPage(rows[rows.length - 1].id);
      setRows((current) => [...current, ...page]);
      setExhausted(page.length < PAGE);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const retry = async (event) => {
    try {
      await syncApi.retrySyncEvents(competitionId, [event.id]);
      toast.success(`Event ${event.id} queued again`);
      await reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const confirmDiscard = async () => {
    const event = discarding;
    setDiscarding(null);
    try {
      await syncApi.discardSyncEvents(competitionId, [event.id]);
      toast.success(`Event ${event.id} discarded`);
      await reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = useMemo(
    () =>
      buildColumns({
        onRetry: retry,
        onDiscard: setDiscarding,
        onView: setViewing,
      }),
    // retry closes over competitionId and reload; both are stable per page
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [competitionId, reload],
  );

  if (!window.sync) {
    return (
      <PageContainer>
        <PageHeader title="Sync Log" />
        <p className="text-sm text-neutral-600">
          Sync is not available in this build.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Sync Log"
        subtitle="Every change queued for the central results service"
        actions={
          <>
            <Button
              variant="outline"
              onClick={reload}
              loading={loading}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="max-w-xs">
            <SimpleSelect
              label="Show"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All events</option>
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </SimpleSelect>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-600">
              {loading ? 'Loading...' : 'No events to show.'}
            </p>
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              showPagination={false}
              pageSize={rows.length}
              className="w-full"
            />
          )}
          {!exhausted && rows.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={loadMore} loading={loading}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={Boolean(viewing)} onOpenChange={() => setViewing(null)}>
        <ModalContent size="xl">
          <ModalHeader>
            <ModalTitle>
              Event {viewing ? viewing.id : ''}:{' '}
              {viewing ? entityLabel(viewing.entity_type) : ''}
            </ModalTitle>
            <ModalDescription>
              {viewing
                ? `${viewing.op} · ${summariseKey(viewing.entity_type, viewing.entity_key)} · ${viewing.source_operation}`
                : ''}
            </ModalDescription>
          </ModalHeader>
          <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-neutral-50 p-3 text-xs">
            {viewing ? prettyPayload(viewing.payload) : ''}
          </pre>
        </ModalContent>
      </Modal>

      <Modal
        open={Boolean(discarding)}
        onOpenChange={() => setDiscarding(null)}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>
              Discard event {discarding ? discarding.id : ''}?
            </ModalTitle>
            <ModalDescription>
              The change stays in this database but is never sent to the
              service. Use Publish everything later if it should get there after
              all.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter className="mt-6">
            <Button variant="outline" onClick={() => setDiscarding(null)}>
              Keep
            </Button>
            <Button variant="danger" onClick={confirmDiscard}>
              Discard
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </PageContainer>
  );
}

export default SyncLogPage;
