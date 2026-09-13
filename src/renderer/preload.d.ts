import { ElectronHandler } from '../main/preload';

interface DatabaseOperation {
  type: 'select' | 'insert' | 'delete';
  query: string;
  params?: any[];
}

interface DatabaseAPI {
  select: (query: string, params?: any[]) => Promise<any[]>;
  insert: (
    query: string,
    params?: any[],
  ) => Promise<{ success: true; id: number }>;
  delete: (query: string, params?: any[]) => Promise<{ changes: number }>;
  transaction: (
    operations: DatabaseOperation[],
  ) => Promise<{ success: true; results: any[] }>;
  /** Run a named operation from src/main/operations atomically */
  operation: (name: string, payload?: Record<string, unknown>) => Promise<any>;
}

interface ElectronAPI {
  savePDF: (
    buffer: ArrayBuffer,
    defaultFileName: string,
  ) => Promise<
    { success: true; filePath: string } | { success: false; cancelled: true }
  >;
}

export type SyncState =
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error'
  | 'auth_error'
  | 'disabled';

export interface CompetitionSyncStatus {
  state: SyncState;
  pending: number;
  dead: number;
  synced: number;
  lastSuccessAt: string | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  halted: boolean;
}

/** Status per local competition id */
export type SyncStatus = Record<string, CompetitionSyncStatus>;

export interface SyncSettings {
  serverUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  syncEnabled: boolean;
  remoteMeetingId: string | null;
  level: string | null;
  season: string | null;
}

export interface SyncLogEntry {
  id: number;
  entity_type: string;
  entity_key: string;
  op: 'upsert' | 'delete';
  payload: string | null;
  source_operation: string;
  snapshot_id: string | null;
  status: 'pending' | 'synced' | 'dead' | 'superseded';
  attempts: number;
  last_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
}

export type ConnectionTest =
  | {
      ok: true;
      meeting: Record<string, unknown>;
      supportedSchemaVersions: number[];
    }
  | { ok: false; offline?: boolean; status?: number; error: string };

interface SyncAPI {
  getSettings: (competitionId: string) => Promise<SyncSettings>;
  setSettings: (
    competitionId: string,
    patch: { serverUrl?: string; apiKey?: string; syncEnabled?: boolean },
  ) => Promise<SyncSettings>;
  testConnection: (
    competitionId: string,
    overrides?: { serverUrl?: string; apiKey?: string },
  ) => Promise<ConnectionTest>;
  syncNow: (competitionId: string) => Promise<CompetitionSyncStatus | null>;
  publishAll: (competitionId: string) => Promise<{
    success: true;
    snapshotId: string;
    counts: Record<string, number>;
  }>;
  getStatus: () => Promise<SyncStatus>;
  getLog: (
    competitionId: string,
    options?: { status?: string; limit?: number; beforeId?: number },
  ) => Promise<SyncLogEntry[]>;
  retryEvents: (
    competitionId: string,
    ids: number[],
  ) => Promise<{ changed: number }>;
  discardEvents: (
    competitionId: string,
    ids: number[],
  ) => Promise<{ changed: number }>;
  /** Subscribe to status pushes; returns the unsubscribe function */
  onStatus: (callback: (status: SyncStatus) => void) => () => void;
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronHandler;
    api: DatabaseAPI;
    electronAPI: ElectronAPI;
    sync: SyncAPI;
  }
}

export {};
