// Per-meeting API keys: the desktop app sends the plaintext in x-api-key; the
// database holds only its SHA-256 and counts requests per minute.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { error } from './http.ts';

export interface KeyContext {
  keyId: string;
  meetingId: string;
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Resolve the key in the request to its meeting, counting the request.
 * Returns a ready error response when the key is missing, unknown, revoked
 * or over its rate limit. The key itself is never logged.
 */
export async function authenticate(
  req: Request,
  client: SupabaseClient,
): Promise<KeyContext | Response> {
  const key = req.headers.get('x-api-key')?.trim();
  if (!key) {
    return error(
      401,
      'missing_api_key',
      'Send the meeting API key in the x-api-key header',
    );
  }
  const hex = await sha256Hex(key);
  const { data, error: rpcError } = await client.rpc('touch_api_key', {
    p_key_hash: `\\x${hex}`,
  });
  if (rpcError) {
    return error(500, 'auth_failed', rpcError.message, { retryable: true });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return error(
      401,
      'invalid_api_key',
      'This API key is not recognised or has been revoked',
    );
  }
  if (!row.allowed) {
    const seconds = Number(row.retry_after_seconds) || 60;
    return error(
      429,
      'rate_limited',
      'Too many requests for this key; try again shortly',
      { retry_after_seconds: seconds },
      { 'retry-after': String(seconds) },
    );
  }
  return { keyId: row.key_id, meetingId: row.meeting_id };
}

/**
 * Make sure the installation is registered for this meeting. An installation
 * id already bound to another meeting is refused rather than re-pointed.
 */
export async function registerInstallation(
  client: SupabaseClient,
  context: KeyContext,
  fields: {
    installation_id: string;
    app_version?: string | null;
    schema_version?: number | null;
    hostname?: string | null;
    outbox_pending?: number | null;
  },
): Promise<Response | null> {
  const { data: existing, error: lookupError } = await client
    .from('installations')
    .select('meeting_id')
    .eq('id', fields.installation_id)
    .maybeSingle();
  if (lookupError) {
    return error(500, 'installation_lookup_failed', lookupError.message, {
      retryable: true,
    });
  }
  if (existing && existing.meeting_id !== context.meetingId) {
    return error(
      403,
      'installation_bound_elsewhere',
      'This installation is registered to a different meeting',
    );
  }
  const { error: upsertError } = await client.from('installations').upsert(
    {
      id: fields.installation_id,
      meeting_id: context.meetingId,
      api_key_id: context.keyId,
      app_version: fields.app_version ?? null,
      schema_version: fields.schema_version ?? null,
      hostname: fields.hostname ?? null,
      outbox_pending: fields.outbox_pending ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (upsertError) {
    return error(500, 'installation_register_failed', upsertError.message, {
      retryable: true,
    });
  }
  return null;
}
