/**
  Cloudflare Pages Function Handler for Spotify OAuth API Endpoints
  Handles:
  - POST /api/auth/start
  - POST /api/auth/exchange
  - POST /api/auth/refresh
  - POST /api/auth/test
*/

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestPost({ request }) {
  const url = new URL(request.url);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  // --- /api/auth/start ---
  if (url.pathname === '/api/auth/start') {
    const { clientId, clientSecret, redirectUri, scopes } = body;

    if (!clientId || !clientSecret || !redirectUri) {
      return jsonResponse({ error: 'Missing required fields: clientId, clientSecret, redirectUri' }, 400);
    }

    // Generate random hex state for CSRF protection
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const state = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');

    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId.trim(),
      scope: (scopes || '').trim(),
      redirect_uri: redirectUri.trim(),
      state: state,
      show_dialog: 'true',
    });

    const authUrl = `https://accounts.spotify.com/authorize?${authParams.toString()}`;

    return jsonResponse({
      success: true,
      authUrl,
      state,
      redirectUri: redirectUri.trim(),
    });
  }

  // --- /api/auth/exchange ---
  if (url.pathname === '/api/auth/exchange') {
    const { code, clientId, clientSecret, redirectUri } = body;

    if (!code || !clientId || !clientSecret || !redirectUri) {
      return jsonResponse({ error: 'Missing required fields for exchange' }, 400);
    }

    const authHeader = btoa(`${clientId.trim()}:${clientSecret.trim()}`);
    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code.trim(),
      redirect_uri: redirectUri.trim(),
    });

    try {
      const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`,
        },
        body: postData.toString(),
      });

      const tokenData = await spotifyRes.json();

      if (!spotifyRes.ok) {
        return jsonResponse({ error: 'Spotify token exchange rejected', details: tokenData }, spotifyRes.status);
      }

      return jsonResponse({ success: true, tokens: tokenData });
    } catch (err) {
      return jsonResponse({ error: err.message || 'Token exchange request failed' }, 500);
    }
  }

  // --- /api/auth/refresh ---
  if (url.pathname === '/api/auth/refresh') {
    const { clientId, clientSecret, refreshToken } = body;

    if (!clientId || !clientSecret || !refreshToken) {
      return jsonResponse({ error: 'Missing required fields for token refresh' }, 400);
    }

    const authHeader = btoa(`${clientId.trim()}:${clientSecret.trim()}`);
    const postData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken.trim(),
    });

    try {
      const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`,
        },
        body: postData.toString(),
      });

      const tokenData = await spotifyRes.json();

      if (!spotifyRes.ok) {
        return jsonResponse({ error: 'Token refresh failed', details: tokenData }, spotifyRes.status);
      }

      return jsonResponse({ success: true, tokens: tokenData });
    } catch (err) {
      return jsonResponse({ error: err.message || 'Token refresh request failed' }, 500);
    }
  }

  // --- /api/auth/test ---
  if (url.pathname === '/api/auth/test') {
    const { accessToken } = body;

    if (!accessToken) {
      return jsonResponse({ error: 'Missing accessToken' }, 400);
    }

    try {
      const profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken.trim()}`,
        },
      });

      const profileData = await profileRes.json();
      return jsonResponse({
        success: profileRes.ok,
        status: profileRes.status,
        profile: profileData,
      });
    } catch (err) {
      return jsonResponse({ error: err.message || 'Failed to fetch user profile' }, 500);
    }
  }

  return jsonResponse({ error: 'Not Found' }, 404);
}
