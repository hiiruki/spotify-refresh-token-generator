// functions/_shared.js
// Shared helpers for all /api/auth/* Pages Functions.
// Not routable itself (underscore prefix), only importable from other functions.

const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute per IP
const FLOW_TTL_SECONDS = 10 * 60; // pending OAuth flow expires after 10 minutes

/**
 * Fixed-window rate limiter backed by KV.
 * Note: KV is eventually consistent, so under heavy concurrent bursts this is
 * "good enough" abuse prevention, not a precise counter. For strict limits,
 * use Cloudflare's dashboard Rate Limiting rules instead/alongside this.
 */
export async function checkRateLimit(env, ip) {
  const windowStart = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SECONDS);
  const key = `ratelimit:${ip}:${windowStart}`;

  const current = await env.OAUTH_KV.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  await env.OAUTH_KV.put(key, String(count + 1), {
    expirationTtl: RATE_LIMIT_WINDOW_SECONDS + 5, // small buffer past the window
  });
  return true;
}

/** Store a pending OAuth flow (client credentials + redirect) keyed by state. */
export async function storeFlow(env, state, flow) {
  await env.OAUTH_KV.put(`flow:${state}`, JSON.stringify(flow), {
    expirationTtl: FLOW_TTL_SECONDS,
  });
}

/** Retrieve and immediately delete a pending flow (one-time use, like the original Map). */
export async function consumeFlow(env, state) {
  const key = `flow:${state}`;
  const raw = await env.OAUTH_KV.get(key);
  if (!raw) return null;
  await env.OAUTH_KV.delete(key);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Reject cross-origin requests. Allowed origin is env.APP_DOMAIN when set
 * (e.g. "spotgen.hiiruki.moe"), otherwise falls back to the request's own origin
 * (covers *.pages.dev preview URLs where APP_DOMAIN isn't set).
 */
export function isOriginAllowed(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // no Origin header (e.g. server-to-server, curl) — allow

  const allowedOrigin = env && env.APP_DOMAIN
    ? `https://${env.APP_DOMAIN}`
    : new URL(request.url).origin;

  return origin === allowedOrigin;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

export async function parseJsonBody(request) {
  const MAX_SIZE = 16 * 1024; // 16KB limit
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
    throw new Error('Request body exceeded size limit (16KB)');
  }
  const text = await request.text();
  if (text.length > MAX_SIZE) {
    throw new Error('Request body exceeded size limit (16KB)');
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON payload');
  }
}

/** POST to Spotify's token endpoint using fetch (Workers-native, replaces node:https). */
export async function spotifyTokenRequest(params, clientId, clientSecret) {
  const body = new URLSearchParams(params).toString();
  const authHeader = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`,
      'User-Agent': 'Spotify-RefreshToken-Generator/1.0',
    },
    body,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: 'raw_response', message: await res.text().catch(() => '') };
  }
  return { status: res.status, data };
}

/** GET a Spotify API endpoint with a bearer token, using fetch. */
export async function spotifyApiRequest(endpoint, accessToken) {
  const res = await fetch(`https://api.spotify.com${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'Spotify-RefreshToken-Generator/1.0',
    },
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: 'raw_response', message: await res.text().catch(() => '') };
  }
  return { status: res.status, data };
}

/** Generate a cryptographically secure random hex string (replaces node:crypto.randomBytes). */
export function generateState(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}