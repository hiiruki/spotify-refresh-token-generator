// POST /api/auth/start
import {
  checkRateLimit,
  isOriginAllowed,
  jsonResponse,
  parseJsonBody,
  storeFlow,
  generateState,
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

  const { clientId, clientSecret, redirectUri, scopes } = body;

  if (!clientId || typeof clientId !== 'string' || clientId.trim().length === 0) {
    return jsonResponse({ error: 'Client ID is required.' }, 400);
  }
  if (!clientSecret || typeof clientSecret !== 'string' || clientSecret.trim().length === 0) {
    return jsonResponse({ error: 'Client Secret is required.' }, 400);
  }
  if (!redirectUri || typeof redirectUri !== 'string') {
    return jsonResponse({ error: 'Redirect URI is required.' }, 400);
  }

  const cleanClientId = clientId.trim();
  const cleanClientSecret = clientSecret.trim();
  const cleanRedirectUri = redirectUri.trim();
  const cleanScopes = scopes && typeof scopes === 'string' ? scopes.trim() : '';

  const state = generateState(32);

  await storeFlow(env, state, {
    clientId: cleanClientId,
    clientSecret: cleanClientSecret,
    redirectUri: cleanRedirectUri,
    scopes: cleanScopes,
    createdAt: Date.now(),
  });

  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: cleanClientId,
    scope: cleanScopes,
    redirect_uri: cleanRedirectUri,
    state,
    show_dialog: 'true',
  });

  const authUrl = `https://accounts.spotify.com/authorize?${authParams.toString()}`;

  return jsonResponse({
    success: true,
    authUrl,
    state,
    redirectUri: cleanRedirectUri,
    scopeCount: cleanScopes ? cleanScopes.split(' ').length : 0,
  });
}