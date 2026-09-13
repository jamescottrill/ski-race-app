/**
 * HTTP client for the central results service. Only two calls exist: push a
 * batch of outbox events, and ping to check the key and report status.
 *
 * Anything that stops a JSON answer arriving (a rejected fetch, a timeout, a
 * captive portal answering 200 with an HTML page) is a NetworkError, which the
 * worker treats as "offline": retry later, no event is blamed.
 */
class NetworkError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

function retryAfterMs(response, body) {
  const fromBody = body && Number(body.retry_after_seconds);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody * 1000;
  const header =
    response.headers && typeof response.headers.get === 'function'
      ? Number(response.headers.get('retry-after'))
      : NaN;
  if (Number.isFinite(header) && header > 0) return header * 1000;
  return null;
}

/**
 * @param {{ fetchImpl: (url: string, init?: any) => Promise<any>, serverUrl?: string,
 *   apiKey?: string | null, appVersion?: string, timeoutMs?: number }} options
 */
function createClient({
  fetchImpl,
  serverUrl,
  apiKey,
  appVersion = '',
  timeoutMs = 20000,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('createClient needs a fetch implementation');
  }
  const base = String(serverUrl || '').replace(/\/+$/, '');

  async function post(path, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey || '',
          'x-app-version': appVersion,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      const message =
        error && error.name === 'AbortError'
          ? `no answer within ${timeoutMs} ms`
          : (error && error.message) || String(error);
      throw new NetworkError(message, error);
    } finally {
      clearTimeout(timer);
    }

    let text = '';
    try {
      text = await response.text();
    } catch (error) {
      throw new NetworkError(
        `response body unreadable: ${error.message}`,
        error,
      );
    }
    let body = null;
    let isJson = false;
    if (text) {
      try {
        body = JSON.parse(text);
        isJson = true;
      } catch (error) {
        isJson = false;
      }
    }
    if (response.ok && !isJson) {
      throw new NetworkError(
        'the server answered with something other than JSON (a captive portal?)',
      );
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      retryAfterMs: retryAfterMs(response, body),
    };
  }

  return {
    pushBatch: (envelope) => post('/functions/v1/ingest', envelope),
    ping: (body = {}) => post('/functions/v1/ping', body),
  };
}

module.exports = { createClient, NetworkError };
