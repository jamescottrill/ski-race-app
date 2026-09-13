import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Wifi, RefreshCw, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  TextField,
  Checkbox,
  Badge,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '../../design-system';
import * as syncApi from '../../api/sync';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import {
  describeSyncStatus,
  describeSyncDetail,
} from '../../utils/syncPresentation';
import { COMPETITION_LEVEL_LABELS } from '../../../shared/competition';

const levelLabel = (level) => COMPETITION_LEVEL_LABELS[level] || level || '';

/** The confirmation shown before a full snapshot is queued. */
function PublishEverythingModal({ open, onOpenChange, onConfirm, busy }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Publish everything now?</ModalTitle>
          <ModalDescription>
            Every competitor, team, race, start list and result in this
            competition is queued for the central results service. Anything
            already sent is sent again, which is safe. Use this when switching
            sync on part-way through a meeting or after the service was reset.
          </ModalDescription>
        </ModalHeader>
        <ModalFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={busy}>
            Publish everything
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Where the service and the app disagree about the meeting
function meetingMismatches(meeting, settings) {
  const mismatches = [];
  if (!meeting || !settings) return mismatches;
  if (settings.level && meeting.level && meeting.level !== settings.level) {
    mismatches.push(
      `the service lists this meeting as ${levelLabel(meeting.level)}, the app as ${levelLabel(settings.level)}`,
    );
  }
  if (settings.season && meeting.season && meeting.season !== settings.season) {
    mismatches.push(
      `the service has season ${meeting.season}, the app ${settings.season}`,
    );
  }
  return mismatches;
}

/** Server URL, API key, the sync switch and the live status for one competition. */
function PublishingSettings({ competitionId }) {
  const navigate = useNavigate();
  const status = useSyncStatus(competitionId);
  const [settings, setSettings] = useState(null);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  const applySettings = useCallback((next) => {
    setSettings(next);
    setServerUrl(next.serverUrl || '');
    setApiKey('');
  }, []);

  useEffect(() => {
    let active = true;
    syncApi
      .getSyncSettings(competitionId)
      .then((next) => {
        if (active) applySettings(next);
        return next;
      })
      .catch((error) => toast.error(error.message));
    return () => {
      active = false;
    };
  }, [competitionId, applySettings]);

  const patchSettings = async (patch) => {
    const next = await syncApi.setSyncSettings(competitionId, patch);
    applySettings(next);
    return next;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // A blank key field keeps the stored key
      await patchSettings({ serverUrl, ...(apiKey ? { apiKey } : {}) });
      toast.success('Publishing settings saved');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await syncApi.testConnection(competitionId, {
        serverUrl,
        ...(apiKey ? { apiKey } : {}),
      });
      setTestResult(result);
      if (result.ok) {
        toast.success(`Connected to ${result.meeting.name}`);
        // The test stores the remote meeting id; pick it up
        setSettings(await syncApi.getSyncSettings(competitionId));
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      setTestResult({ ok: false, error: error.message });
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSyncEnabled = async (event) => {
    const enabled = event.target.checked;
    try {
      await patchSettings({ syncEnabled: enabled });
      if (enabled) setPublishOpen(true);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePublishAll = async () => {
    setPublishing(true);
    try {
      const result = await syncApi.publishAll(competitionId);
      const total = Object.values(result.counts || {}).reduce(
        (sum, count) => sum + count,
        0,
      );
      toast.success(`Queued ${total} events for the results service`);
      setPublishOpen(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncingNow(true);
    try {
      await syncApi.syncNow(competitionId);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingNow(false);
    }
  };

  const summary = describeSyncStatus(status);
  const meeting = testResult && testResult.ok ? testResult.meeting : null;
  const mismatches = meetingMismatches(meeting, settings);
  const hasKey = Boolean(apiKey || (settings && settings.hasApiKey));
  const syncEnabled = Boolean(settings && settings.syncEnabled);
  const urlChanged = Boolean(settings && settings.serverUrl !== serverUrl);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Central results service</CardTitle>
          <CardDescription>
            The meeting API key is issued by the organisers in the admin area
            and pasted here once. It is stored on this computer only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            label="Server URL"
            name="serverUrl"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder="https://example.supabase.co"
            fullWidth
          />
          {urlChanged && (
            <button
              type="button"
              className="text-sm text-primary-700 underline"
              onClick={() => setServerUrl(settings.serverUrl || '')}
            >
              Undo the URL change
            </button>
          )}
          <TextField
            label="Meeting API key"
            name="apiKey"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              settings && settings.hasApiKey
                ? `Key ending in ${settings.apiKeyHint || '····'} is stored; paste a new one to replace it`
                : 'Paste the key from the admin area'
            }
            fullWidth
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              loading={testing}
              disabled={!serverUrl || !hasKey}
              leftIcon={<Wifi className="w-4 h-4" />}
            >
              Test connection
            </Button>
          </div>

          {testResult && !testResult.ok && (
            <p className="text-sm text-danger">
              {testResult.offline
                ? `Could not reach the service: ${testResult.error}`
                : testResult.error}
            </p>
          )}
          {meeting && (
            <Card className="bg-neutral-50 border-neutral-200">
              <CardContent className="pt-6 space-y-2">
                <p className="text-sm font-medium text-neutral-900">
                  {meeting.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary">{levelLabel(meeting.level)}</Badge>
                  {meeting.season && (
                    <Badge variant="info">Season {meeting.season}</Badge>
                  )}
                  <Badge variant={meeting.is_published ? 'success' : 'default'}>
                    {meeting.is_published
                      ? 'Visible on the public site'
                      : 'Not yet public'}
                  </Badge>
                </div>
                {mismatches.length > 0 && (
                  <p className="text-sm text-warning">
                    Check the details: {mismatches.join('; ')}.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync</CardTitle>
          <CardDescription>
            While sync is on, every change reaches the service as soon as there
            is a connection. Whether the meeting is visible to the public is
            switched on by the organisers in the admin area.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Checkbox
            label="Sync this competition to the central results service"
            checked={syncEnabled}
            onChange={handleSyncEnabled}
            disabled={!settings}
          />
          <div className="flex items-center gap-3">
            <Badge variant={summary.tone}>{summary.label}</Badge>
            <span className="text-sm text-neutral-600">
              {describeSyncDetail(status)}
            </span>
          </div>
          {status && status.lastError && (
            <p className="text-sm text-danger">{status.lastError}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleSyncNow}
              loading={syncingNow}
              disabled={!syncEnabled}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Sync now
            </Button>
            <Button
              variant="outline"
              onClick={() => setPublishOpen(true)}
              disabled={!syncEnabled}
              leftIcon={<UploadCloud className="w-4 h-4" />}
            >
              Publish everything
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(`/competition/${competitionId}/sync/log`)}
            >
              View sync log
            </Button>
          </div>
        </CardContent>
      </Card>

      <PublishEverythingModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onConfirm={handlePublishAll}
        busy={publishing}
      />
    </div>
  );
}

export default PublishingSettings;
