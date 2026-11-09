// Thin wrapper around fetch for the HustleHub+ API.
// Requests go to /api/... (proxied by Vite in development).
const BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the API. Check that it is running on port 4000.', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok) {
    let message = data?.error || 'Something went wrong.';
    // Validation failures: {error, details:[{field,message}]}
    if (Array.isArray(data?.details) && data.details.length) {
      message = data.details.map((d) => d.message).join('. ');
    }
    if (res.status === 429 && data?.retryAfterSeconds) {
      message += ` Try again in ${data.retryAfterSeconds} seconds.`;
    }
    throw new ApiError(message, res.status);
  }
  return data;
}
