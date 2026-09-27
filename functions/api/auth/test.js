// POST /api/auth/test
import {
  checkRateLimit,
  isOriginAllowed,
  jsonResponse,
  parseJsonBody,
  spotifyApiRequest,
} from '../../_shared.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  if (!(await checkRateLimit(env, ip))) {
    return jsonResponse({ error: 'Too many requests. Please slow down.' }, 429);
  }

  if (!isOriginAllowed(request, env)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403);
  }

  let body;
  try {
    body = await parseJsonBody(request);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Invalid request payload' }, 400);
  }

  const { accessToken } = body;

  if (!accessToken || typeof accessToken !== 'string') {
    return jsonResponse({ error: 'Missing required field: accessToken' }, 400);
  }

  let profileResponse;
  try {
    profileResponse = await spotifyApiRequest('/v1/me', accessToken.trim());
  } catch (err) {
    return jsonResponse({ error: err.message || 'Failed to fetch Spotify profile' }, 500);
  }

  return jsonResponse({
    success: profileResponse.status === 200,
    status: profileResponse.status,
    profile: profileResponse.data,
  });
}