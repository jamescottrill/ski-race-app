# @awsa/sync-contract

Version 1 of the store-and-forward contract between the desktop app's sync
outbox and the central results service.

- `SYNC_SCHEMA_VERSION`: the contract version every batch declares.
- `ENTITY_TYPES`: what an event can describe; keys use the server vocabulary
  (`service_number`, `race_id`, `run_number`, `team_id`, ...). The meeting is
  identified once in the envelope, never in a key.
- `envelopeSchema`, `eventSchema`, `entitySchemas`: zod schemas. An upsert
  carries the full row (or whole collection) as it stands after the write, so
  replaying any batch converges; a delete carries the key only.
- `validateEvent(event)` and `validateEnvelope(envelope)`: throw with a
  readable message when something is off.
- `fixtures/batch.v1.json`: a reference batch exercising every entity type the
  app emits today. The app's tests serialise real events against this shape and
  the server's tests apply it.

The package is CommonJS so the Electron main process, its Jest suite and the
web tooling can all load it without a build step.
