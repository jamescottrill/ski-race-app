import type { ZodType } from 'zod';

export const SYNC_SCHEMA_VERSION: 1;
export const MAX_EVENTS_PER_BATCH: 500;

export type EntityType =
  | 'meeting'
  | 'competitor'
  | 'competitor_merge'
  | 'meeting_entry'
  | 'team'
  | 'team_members'
  | 'race'
  | 'race_run'
  | 'start_list'
  | 'result'
  | 'race_scores'
  | 'seed_list_snapshot'
  | 'standings_snapshot'
  | 'cpp'
  | 'final_seed_list'
  | 'snapshot_marker';

export type SyncOperation = 'upsert' | 'delete';
export type RaceType = 'SL' | 'GS' | 'SG' | 'DH' | 'AC';
export type RaceStatus =
  | 'scheduled'
  | 'live'
  | 'provisional'
  | 'official'
  | 'cancelled';
export type StandingsKind = 'individual' | 'team' | 'princess_marina';

export const ENTITY_TYPES: readonly EntityType[];
export const OPERATIONS: readonly SyncOperation[];
export const RACE_TYPES: readonly RaceType[];
export const RACE_STATUSES: readonly RaceStatus[];
export const STANDINGS_KINDS: readonly StandingsKind[];

export interface SyncEvent {
  event_id: number;
  entity_type: EntityType;
  operation: SyncOperation;
  key: Record<string, unknown>;
  data: Record<string, unknown> | null;
  occurred_at: string;
}

export interface SyncEnvelope {
  installation_id: string;
  meeting_id: string;
  schema_version: 1;
  app_version: string;
  hostname?: string;
  events: SyncEvent[];
}

export const entitySchemas: Record<EntityType, { key: ZodType; data: ZodType }>;
export const eventSchema: ZodType<SyncEvent>;
export const envelopeSchema: ZodType<SyncEnvelope>;
export function validateEvent(event: unknown): SyncEvent;
export function validateEnvelope(envelope: unknown): SyncEnvelope;
