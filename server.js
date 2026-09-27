import http from 'node:http';
import https from 'node:https';
import { URL, URLSearchParams, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(path.join(__dirname, 'public'));

// In-memory store for pending OAuth flows, keyed by state parameter.
// Each entry stores { clientId, clientSecret, redirectUri, scopes, createdAt }.
// Entries are cleaned up after use or after 10 minutes.
const pendingFlows = new Map();

// In-memory rate limiting map: ip -> { count, resetTime }
const rateLimits = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

function checkRateLimit(ip) {
  const now = Date.now();
  let clientLimit = rateLimits.get(ip);
  if (!clientLimit || now > clientLimit.resetTime) {
    clientLimit = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimits.set(ip, clientLimit);
    return true;
  }
  if (clientLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  clientLimit.count += 1;
  return true;
}

// Clean up stale flows and rate limits every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, flow] of pendingFlows) {
    if (now - flow.createdAt > 10 * 60 * 1000) {
      pendingFlows.delete(state);
    }
  }
  for (const [ip, data] of rateLimits) {
    if (now > data.resetTime) {
      rateLimits.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Serves a static file from the public directory with secure MIME types and CSP.
 * Sanitizes the file path to prevent directory traversal attacks.
 */
function serveStaticFile(res, requestedPath) {
  // Normalize and resolve the path to prevent traversal
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  const resolvedPath = path.resolve(filePath);

  // Strict directory boundary check
  if (!resolvedPath.startsWith(PUBLIC_DIR + path.sep) && resolvedPath !== PUBLIC_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(resolvedPath);
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
  };

  fs.readFile(resolvedPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://i.scdn.co https://*.scdn.co; connect-src 'self';",
    });
    res.end(data);
  });
}

/**
 * Parses JSON body from an incoming request with size limits.
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    const MAX_SIZE = 16 * 1024; // 16KB limit

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_SIZE) {
        reject(new Error('Request body exceeded size limit (16KB)'));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Makes an HTTPS POST request to Spotify's token endpoint.
 */
function spotifyTokenRequest(params, clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(params).toString();
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const options = {
      hostname: 'accounts.spotify.com',
      port: 443,
      path: '/api/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Basic ${authHeader}`,
        'User-Agent': 'Spotify-RefreshToken-Generator/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, data: { error: 'raw_response', message: data } });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Network request to Spotify failed: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Makes an HTTPS GET request to a Spotify API endpoint.
 */
function spotifyApiRequest(endpoint, accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.spotify.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Spotify-RefreshToken-Generator/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, data: { error: 'raw_response', message: data } });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Spotify API request failed: ${err.message}`));
    });

    req.end();
  });
}

/**
 * Sends a JSON response with security headers.
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(JSON.stringify(data));
}

// --- Request Handler ---
const server = http.createServer(async (req, res) => {
  const clientIp = req.socket.remoteAddress || '127.0.0.1';
  if (!checkRateLimit(clientIp)) {
    sendJson(res, 429, { error: 'Too many requests. Please slow down.' });
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  // CORS restriction: only allow self
  const origin = req.headers.origin;
  if (origin && !origin.includes(`127.0.0.1:${PORT}`) && !origin.includes(`localhost:${PORT}`)) {
    sendJson(res, 403, { error: 'Origin not allowed' });
    return;
  }

  // --- API: Start OAuth Flow ---
  if (req.method === 'POST' && url.pathname === '/api/auth/start') {
    try {
      const body = await parseJsonBody(req);
      const { clientId, clientSecret, redirectUri, scopes } = body;

      if (!clientId || typeof clientId !== 'string' || clientId.trim().length === 0) {
        sendJson(res, 400, { error: 'Client ID is required.' });
        return;
      }
      if (!clientSecret || typeof clientSecret !== 'string' || clientSecret.trim().length === 0) {
        sendJson(res, 400, { error: 'Client Secret is required.' });
        return;
      }
      if (!redirectUri || typeof redirectUri !== 'string') {
        sendJson(res, 400, { error: 'Redirect URI is required.' });
        return;
      }

      const cleanClientId = clientId.trim();
      const cleanClientSecret = clientSecret.trim();
      const cleanRedirectUri = redirectUri.trim();
      const cleanScopes = (scopes && typeof scopes === 'string') ? scopes.trim() : '';

      // Generate a cryptographically secure 256-bit state parameter for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');

      // Store flow context server-side mapped by state
      pendingFlows.set(state, {
        clientId: cleanClientId,
        clientSecret: cleanClientSecret,
        redirectUri: cleanRedirectUri,
        scopes: cleanScopes,
        createdAt: Date.now(),
      });

      // Build Spotify OAuth authorization URL
      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: cleanClientId,
        scope: cleanScopes,
        redirect_uri: cleanRedirectUri,
        state: state,
        show_dialog: 'true',
      });

      const authUrl = `https://accounts.spotify.com/authorize?${authParams.toString()}`;

      sendJson(res, 200, {
        success: true,
        authUrl,
        state,
        redirectUri: cleanRedirectUri,
        scopeCount: cleanScopes ? cleanScopes.split(' ').length : 0,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message || 'Invalid request payload' });
    }
    return;
  }

  // --- API: Exchange authorization code for tokens ---
  if (req.method === 'POST' && url.pathname === '/api/auth/exchange') {
    try {
      const body = await parseJsonBody(req);
      const { code, state } = body;

      if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
        sendJson(res, 400, { error: 'Missing required parameters: code, state' });
        return;
      }

      // Retrieve and validate pending flow, or fallback to request body for stateless serverless runtimes
      const flow = pendingFlows.get(state.trim()) || {
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        redirectUri: body.redirectUri,
      };

      if (!flow || !flow.clientId || !flow.clientSecret || !flow.redirectUri) {
        sendJson(res, 400, {
          error: 'State parameter is invalid or missing flow credentials. Please initiate a new authorization flow.',
        });
        return;
      }

      // One-time use: delete from pending store if present
      pendingFlows.delete(state.trim());

      // Exchange the authorization code for tokens
      const tokenResponse = await spotifyTokenRequest(
        {
          grant_type: 'authorization_code',
          code: code.trim(),
          redirect_uri: flow.redirectUri,
        },
        flow.clientId,
        flow.clientSecret
      );

      if (tokenResponse.status !== 200) {
        sendJson(res, tokenResponse.status, {
          error: 'Spotify token exchange rejected',
          details: tokenResponse.data,
        });
        return;
      }

      // Return tokens with flow metadata
      sendJson(res, 200, {
        success: true,
        tokens: tokenResponse.data,
        clientId: flow.clientId,
        redirectUri: flow.redirectUri,
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message || 'Token exchange failed' });
    }
    return;
  }

  // --- API: Refresh an existing token ---
  if (req.method === 'POST' && url.pathname === '/api/auth/refresh') {
    try {
      const body = await parseJsonBody(req);
      const { clientId, clientSecret, refreshToken } = body;

      if (!clientId || !clientSecret || !refreshToken) {
        sendJson(res, 400, { error: 'Missing required fields: clientId, clientSecret, refreshToken' });
        return;
      }

      const tokenResponse = await spotifyTokenRequest(
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken.trim(),
        },
        clientId.trim(),
        clientSecret.trim()
      );

      if (tokenResponse.status !== 200) {
        sendJson(res, tokenResponse.status, {
          error: 'Token refresh failed',
          details: tokenResponse.data,
        });
        return;
      }

      sendJson(res, 200, {
        success: true,
        tokens: tokenResponse.data,
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message || 'Token refresh failed' });
    }
    return;
  }

  // --- API: Test token by fetching user profile ---
  if (req.method === 'POST' && url.pathname === '/api/auth/test') {
    try {
      const body = await parseJsonBody(req);
      const { accessToken } = body;

      if (!accessToken || typeof accessToken !== 'string') {
        sendJson(res, 400, { error: 'Missing required field: accessToken' });
        return;
      }

      const profileResponse = await spotifyApiRequest('/v1/me', accessToken.trim());

      sendJson(res, 200, {
        success: profileResponse.status === 200,
        status: profileResponse.status,
        profile: profileResponse.data,
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message || 'Failed to fetch Spotify profile' });
    }
    return;
  }

  // --- Callback page (handles the redirect from Spotify) ---
  if (req.method === 'GET' && url.pathname === '/callback') {
    serveStaticFile(res, 'callback.html');
    return;
  }

  // --- Serve static files ---
  if (req.method === 'GET') {
    const filePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    serveStaticFile(res, filePath);
    return;
  }

  // --- Fallback ---
  sendJson(res, 404, { error: 'Resource not found' });
});

server.listen(PORT, () => {
  console.log(`\n  =======================================================`);
  console.log(`  🎵 Spotify Refresh Token Generator (Secure Web App)`);
  console.log(`  =======================================================`);
  console.log(`  🚀 Local Server : http://127.0.0.1:${PORT}`);
  console.log(`  🔗 Callback URL : http://127.0.0.1:${PORT}/callback`);
  console.log(`  ℹ️  Ensure your Spotify App has this Redirect URI added!`);
  console.log(`  =======================================================\n`);
});
