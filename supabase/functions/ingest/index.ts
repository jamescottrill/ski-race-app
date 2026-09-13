// POST /functions/v1/ingest: apply one batch of outbox events from the
// desktop app to the meeting the API key belongs to. See
// packages/sync-contract for the envelope and supabase/README.md for the
// error codes the worker relies on.
import {
  authenticate,
  registerInstallation,
  serviceClient,
} from '../_shared/auth.ts';
import { error, json, precheck } from '../_shared/http.ts';
import { type Envelope, validateEnvelope } from '../_shared/envelope.ts';

Deno.serve(async (req: Request) => {
  const early = precheck(req);
  if (early) return early;

  const client = serviceClient();
  const auth = await authenticate(req, client);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(400, 'malformed_json', 'The body is not valid JSON');
  }
  const problem = validateEnvelope(body, auth.meetingId);
  if (problem) {
    return error(
      problem.status,
      problem.code,
      problem.message,
      problem.extra ?? {},
    );
  }
  const envelope = body as Envelope;

  const registration = await registerInstallation(client, auth, {
    installation_id: envelope.installation_id,
    app_version: envelope.app_version ?? null,
    schema_version: envelope.schema_version,
    hostname: envelope.hostname ?? null,
  });
  if (registration) return registration;

  const { data, error: rpcError } = await client.rpc('apply_sync_events', {
    p_installation_id: envelope.installation_id,
    p_meeting_id: auth.meetingId,
    p_schema_version: envelope.schema_version,
    p_events: envelope.events,
  });
  if (rpcError) {
    // The whole batch rolled back; nothing was acknowledged, so the worker retries it
    console.error('apply_sync_events failed', rpcError.code, rpcError.message);
    return error(500, 'apply_failed', rpcError.message, { retryable: true });
  }
  return json(200, data);
});
