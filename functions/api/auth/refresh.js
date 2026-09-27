// POST /api/auth/refresh
import {
  checkRateLimit,
  isOriginAllowed,
  jsonResponse,
  parseJsonBody,
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

  const { clientId, clientSecret, refreshToken } = body;

  if (!clientId || !clientSecret || !refreshToken) {
    return jsonResponse(
      { error: 'Missing required fields: clientId, clientSecret, refreshToken' },
      400
    );
  }

  let tokenResponse;
  try {
    tokenResponse = await spotifyTokenRequest(
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken.trim(),
      },
      clientId.trim(),
      clientSecret.trim()
    );
  } catch (err) {
    return jsonResponse({ error: err.message || 'Token refresh failed' }, 500);
  }

  if (tokenResponse.status !== 200) {
    return jsonResponse({ error: 'Token refresh failed', details: tokenResponse.data }, tokenResponse.status);
  }

  return jsonResponse({ success: true, tokens: tokenResponse.data });
}
