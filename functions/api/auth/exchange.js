// POST /api/auth/exchange
import {
  checkRateLimit,
  isOriginAllowed,
  jsonResponse,
  parseJsonBody,
  consumeFlow,
  spotifyTokenRequest,
} from '../../_shared.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  if (!(await checkRateLimit(env, ip))) {
    return jsonResponse({ error: 'Too many requests. Please slow down.' }, 429);
  }

  if (!isOriginAllowed(request)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403);
  }

  let body;
  try {
    body = await parseJsonBody(request);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Invalid request payload' }, 400);
  }

  const { code, state } = body;

  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    return jsonResponse({ error: 'Missing required parameters: code, state' }, 400);
  }

  // One-time use: consumeFlow reads and deletes from KV atomically-ish.
  // Fallback to body-supplied credentials if the KV entry expired or was never set
  // (e.g. manual testing without hitting /api/auth/start first).
  const flow = (await consumeFlow(env, state.trim())) || {
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    redirectUri: body.redirectUri,
  };

  if (!flow || !flow.clientId || !flow.clientSecret || !flow.redirectUri) {
    return jsonResponse(
      {
        error: 'State parameter is invalid, expired, or missing flow credentials. Please initiate a new authorization flow.',
      },
      400
    );
  }

  let tokenResponse;
  try {
    tokenResponse = await spotifyTokenRequest(
      {
        grant_type: 'authorization_code',
        code: code.trim(),
        redirect_uri: flow.redirectUri,
      },
      flow.clientId,
      flow.clientSecret
    );
  } catch (err) {
    return jsonResponse({ error: err.message || 'Token exchange failed' }, 500);
  }

  if (tokenResponse.status !== 200) {
    return jsonResponse(
      { error: 'Spotify token exchange rejected', details: tokenResponse.data },
      tokenResponse.status
    );
  }

  return jsonResponse({
    success: true,
    tokens: tokenResponse.data,
    clientId: flow.clientId,
    redirectUri: flow.redirectUri,
  });
}
