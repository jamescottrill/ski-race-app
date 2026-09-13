// Response helpers and the limits the contract advertises.
export const MAX_BODY_BYTES = 1_048_576;
export const MAX_BATCH_EVENTS = 500;
export const SUPPORTED_SCHEMA_VERSIONS = [1];

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export function error(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return json(status, { error: code, message, ...extra }, headers);
}

/** Reject anything but a JSON POST within the size limit, else null. */
export function precheck(req: Request): Response | null {
  if (req.method !== 'POST') {
    return error(
      405,
      'method_not_allowed',
      'POST a JSON body',
      {},
      { allow: 'POST' },
    );
  }
  const length = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return error(
      413,
      'body_too_large',
      `The body may not exceed ${MAX_BODY_BYTES} bytes`,
      {
        max_body_bytes: MAX_BODY_BYTES,
      },
    );
  }
  return null;
}
