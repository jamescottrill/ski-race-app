/**
 * @jest-environment node
 */
const { createClient, NetworkError } = require('../main/sync/client');

const response = ({ status = 200, body = {}, headers = {} }) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

describe('sync client', () => {
  it('posts the envelope as JSON with the API key header', async () => {
    const fetchImpl = jest.fn(async () =>
      response({ body: { accepted_up_to_event_id: 3 } }),
    );
    const client = createClient({
      fetchImpl,
      serverUrl: 'https://abc.supabase.co/',
      apiKey: 'awsa_key',
      appVersion: '0.2.0',
    });
    const result = await client.pushBatch({ events: [] });
    expect(result).toEqual({
      ok: true,
      status: 200,
      body: { accepted_up_to_event_id: 3 },
      retryAfterMs: null,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://abc.supabase.co/functions/v1/ingest');
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-key']).toBe('awsa_key');
    expect(init.headers['x-app-version']).toBe('0.2.0');
    expect(JSON.parse(init.body)).toEqual({ events: [] });
    await client.ping({ hostname: 'x' });
    expect(fetchImpl.mock.calls[1][0]).toBe(
      'https://abc.supabase.co/functions/v1/ping',
    );
  });

  it('turns a rejected fetch or a timeout into a NetworkError', async () => {
    const failing = createClient({
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
      serverUrl: 'https://abc.supabase.co',
      apiKey: 'k',
    });
    await expect(failing.ping()).rejects.toThrow(NetworkError);
    await expect(failing.ping()).rejects.toThrow('ECONNREFUSED');

    const hanging = createClient({
      fetchImpl: (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
      serverUrl: 'https://abc.supabase.co',
      apiKey: 'k',
      timeoutMs: 10,
    });
    await expect(hanging.ping()).rejects.toThrow('no answer within 10 ms');
  });

  it('treats a 2xx without JSON as being offline (captive portal)', async () => {
    const client = createClient({
      fetchImpl: async () => response({ body: '<html>Sign in</html>' }),
      serverUrl: 'https://abc.supabase.co',
      apiKey: 'k',
    });
    await expect(client.pushBatch({})).rejects.toThrow(NetworkError);
  });

  it('returns non-2xx answers with their body and any retry hint', async () => {
    const limited = createClient({
      fetchImpl: async () =>
        response({ status: 429, body: { retry_after_seconds: 30 } }),
      serverUrl: 'https://abc.supabase.co',
      apiKey: 'k',
    });
    expect(await limited.pushBatch({})).toMatchObject({
      ok: false,
      status: 429,
      retryAfterMs: 30000,
    });
    const headerOnly = createClient({
      fetchImpl: async () =>
        response({ status: 429, body: '', headers: { 'retry-after': '5' } }),
      serverUrl: 'https://abc.supabase.co',
      apiKey: 'k',
    });
    expect(await headerOnly.pushBatch({})).toMatchObject({
      ok: false,
      status: 429,
      body: null,
      retryAfterMs: 5000,
    });
    const gateway = createClient({
      fetchImpl: async () => response({ status: 502, body: 'Bad gateway' }),
      serverUrl: 'https://abc.supabase.co',
      apiKey: 'k',
    });
    expect(await gateway.pushBatch({})).toEqual({
      ok: false,
      status: 502,
      body: null,
      retryAfterMs: null,
    });
  });
});
