// POST /functions/v1/ping: check the API key, report the app's state and
// learn the meeting the key is bound to. The app calls it for "Test
// connection" and once a minute while a competition is publishable.
import {
  authenticate,
  registerInstallation,
  serviceClient,
} from '../_shared/auth.ts';
import {
  error,
  json,
  MAX_BATCH_EVENTS,
  MAX_BODY_BYTES,
  precheck,
  SUPPORTED_SCHEMA_VERSIONS,
} from '../_shared/http.ts';

interface PingBody {
  installation_id?: string;
  app_version?: string;
  schema_version?: number;
  hostname?: string;
  outbox_pending?: number;
  last_event_id?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const early = precheck(req);
  if (early) return early;

  const client = serviceClient();
  const auth = await authenticate(req, client);
  if (auth instanceof Response) return auth;

  let body: PingBody = {};
  const text = await req.text();
  if (text.trim().length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      return error(400, 'malformed_json', 'The body is not valid JSON');
    }
  }

  if (
    typeof body.installation_id === 'string' &&
    UUID.test(body.installation_id)
  ) {
    const registration = await registerInstallation(client, auth, {
      installation_id: body.installation_id,
      app_version: body.app_version ?? null,
      schema_version: body.schema_version ?? null,
      hostname: body.hostname ?? null,
      outbox_pending: Number.isFinite(body.outbox_pending)
        ? body.outbox_pending!
        : null,
    });
    if (registration) return registration;
  }

  const { data: meeting, error: meetingError } = await client
    .from('meetings')
    .select('id, slug, name, level, season_id, timezone, is_published')
    .eq('id', auth.meetingId)
    .single();
  if (meetingError || !meeting) {
    return error(
      500,
      'meeting_lookup_failed',
      meetingError?.message ?? 'meeting missing',
      {
        retryable: true,
      },
    );
  }

  return json(200, {
    ok: true,
    meeting,
    supported_schema_versions: SUPPORTED_SCHEMA_VERSIONS,
    max_batch_events: MAX_BATCH_EVENTS,
    max_body_bytes: MAX_BODY_BYTES,
    server_time: new Date().toISOString(),
  });
});
