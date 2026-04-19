/**
 * Tiny fetch wrapper. Sends cookies (credentials: include) and the Origin
 * header that the server's CSRF middleware checks on state-changing requests.
 * Errors throw an ApiError with the parsed body.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = opts;
  const url = new URL(path.startsWith('http') ? path : `/api${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });
  const ct = res.headers.get('content-type') ?? '';
  const payload = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload && (payload as { error?: { message?: string } }).error?.message) ||
      `Request failed: ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }
  return (payload && typeof payload === 'object' && 'data' in payload
    ? (payload as { data: T }).data
    : (payload as T));
}
