(() => {
  'use strict';

  // --- Scopes Data Definition (Official Spotify Web API Scopes) ---
  const SPOTIFY_SCOPES = [
    // Playback & Streaming
    { id: 'user-read-playback-state', name: 'user-read-playback-state', category: 'playback', desc: 'Read current playback state (devices, shuffle, repeat)' },
    { id: 'user-modify-playback-state', name: 'user-modify-playback-state', category: 'playback', desc: 'Control playback (play, pause, skip, seek, volume)' },
    { id: 'user-read-currently-playing', name: 'user-read-currently-playing', category: 'playback', desc: 'Read currently playing track or episode' },
    { id: 'app-remote-control', name: 'app-remote-control', category: 'playback', desc: 'Remote control Spotify playback on other devices' },
    { id: 'streaming', name: 'streaming', category: 'playback', desc: 'Stream audio via Spotify Web Playback SDK' },

    // Playlists & Images
    { id: 'playlist-read-private', name: 'playlist-read-private', category: 'playlists', desc: 'Read private playlists created by the user' },
    { id: 'playlist-read-collaborative', name: 'playlist-read-collaborative', category: 'playlists', desc: 'Read collaborative playlists' },
    { id: 'playlist-modify-public', name: 'playlist-modify-public', category: 'playlists', desc: 'Create and edit public playlists' },
    { id: 'playlist-modify-private', name: 'playlist-modify-private', category: 'playlists', desc: 'Create and edit private playlists' },
    { id: 'ugc-image-upload', name: 'ugc-image-upload', category: 'playlists', desc: 'Upload custom cover images to playlists' },

    // Listening History & Personalization
    { id: 'user-top-read', name: 'user-top-read', category: 'readonly', desc: 'Read top artists and top tracks calculated by Spotify' },
    { id: 'user-read-recently-played', name: 'user-read-recently-played', category: 'readonly', desc: 'Read recently played tracks history' },
    { id: 'user-read-playback-position', name: 'user-read-playback-position', category: 'readonly', desc: 'Read position in episodes and podcasts' },

    // Library
    { id: 'user-library-read', name: 'user-library-read', category: 'playlists', desc: 'Read saved songs and albums (Liked Songs)' },
    { id: 'user-library-modify', name: 'user-library-modify', category: 'playlists', desc: 'Save or remove songs and albums from library' },

    // User Profile & Follow
    { id: 'user-read-email', name: 'user-read-email', category: 'readonly', desc: 'Read user account email address' },
    { id: 'user-read-private', name: 'user-read-private', category: 'readonly', desc: 'Read user subscription type (Premium/Free) and country' },
    { id: 'user-follow-read', name: 'user-follow-read', category: 'readonly', desc: 'Read list of followed artists and users' },
    { id: 'user-follow-modify', name: 'user-follow-modify', category: 'playlists', desc: 'Follow or unfollow artists and other users' }
  ];

  // --- State Variables ---
  let currentTokens = null;
  let activeClientId = '';
  let activeClientSecret = '';
  let tokenCountdownInterval = null;
  let activeTab = 'env';

  // --- DOM Elements ---
  const authForm = document.getElementById('authForm');
  const inputClientId = document.getElementById('clientId');
  const inputClientSecret = document.getElementById('clientSecret');
  const inputRedirectUri = document.getElementById('redirectUri');
  const btnToggleSecret = document.getElementById('btnToggleSecret');
  const btnCopyRedirectUri = document.getElementById('btnCopyRedirectUri');
  const btnSubmit = document.getElementById('btnSubmit');

  const scopesListContainer = document.getElementById('scopesListContainer');
  const btnToggleScopeList = document.getElementById('btnToggleScopeList');
  const scopeCountLabel = document.getElementById('scopeCountLabel');
  const scopeToggleIcon = document.getElementById('scopeToggleIcon');
  const presetChips = document.querySelectorAll('.preset-chip');

  const terminalBody = document.getElementById('terminalBody');
  const statusPill = document.getElementById('statusPill');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const btnClearLogs = document.getElementById('btnClearLogs');

  const resultsCard = document.getElementById('resultsCard');
  const resRefreshToken = document.getElementById('resRefreshToken');
  const resAccessToken = document.getElementById('resAccessToken');
  const resTokenType = document.getElementById('resTokenType');
  const resExpiresIn = document.getElementById('resExpiresIn');
  const resScopeCount = document.getElementById('resScopeCount');
  const tokenExpiryBadge = document.getElementById('tokenExpiryBadge');
  const btnCopyRefreshToken = document.getElementById('btnCopyRefreshToken');
  const btnCopyAccessToken = document.getElementById('btnCopyAccessToken');
  const btnTestProfile = document.getElementById('btnTestProfile');
  const btnTestRefresh = document.getElementById('btnTestRefresh');

  const userProfileBadge = document.getElementById('userProfileBadge');
  const userAvatar = document.getElementById('userAvatar');
  const userDisplayName = document.getElementById('userDisplayName');
  const userMetaDetails = document.getElementById('userMetaDetails');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const codeSnippetContent = document.getElementById('codeSnippetContent');
  const btnCopyCodeSnippet = document.getElementById('btnCopyCodeSnippet');

  const helpModal = document.getElementById('helpModal');
  const btnHelpGuide = document.getElementById('btnHelpGuide');
  const helpClientId = document.getElementById('helpClientId');
  const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
  const toastContainer = document.getElementById('toastContainer');

  // --- Initialize Dynamic Redirect URI from Hostname ---
  if (window.location.host) {
    inputRedirectUri.value = `${window.location.protocol}//${window.location.host}/callback`;
  }

  // --- Build Scopes Checkbox UI Safely ---
  function renderScopesCheckboxes() {
    scopesListContainer.replaceChildren();

    SPOTIFY_SCOPES.forEach((scope) => {
      const itemLabel = document.createElement('label');
      itemLabel.className = 'scope-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'scopes';
      checkbox.value = scope.id;
      checkbox.checked = true; // Default selected

      checkbox.addEventListener('change', updateSelectedScopeCount);

      const textDiv = document.createElement('div');
      textDiv.className = 'scope-item-text';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'scope-name';
      nameSpan.textContent = scope.name;

      const descSpan = document.createElement('span');
      descSpan.className = 'scope-desc';
      descSpan.textContent = scope.desc;

      textDiv.appendChild(nameSpan);
      textDiv.appendChild(descSpan);

      itemLabel.appendChild(checkbox);
      itemLabel.appendChild(textDiv);

      scopesListContainer.appendChild(itemLabel);
    });

    updateSelectedScopeCount();
  }

  function getSelectedScopes() {
    const checked = scopesListContainer.querySelectorAll('input[name="scopes"]:checked');
    return Array.from(checked).map((el) => el.value);
  }

  function updateSelectedScopeCount() {
    const totalSelected = getSelectedScopes().length;
    scopeCountLabel.textContent = `${totalSelected} of ${SPOTIFY_SCOPES.length} Scopes Selected`;
  }

  function applyScopePreset(presetKey) {
    const checkboxes = scopesListContainer.querySelectorAll('input[name="scopes"]');
    checkboxes.forEach((cb) => {
      const scopeData = SPOTIFY_SCOPES.find((s) => s.id === cb.value);
      if (!scopeData) return;

      if (presetKey === 'all') {
        cb.checked = true;
      } else if (presetKey === 'playback') {
        cb.checked = scopeData.category === 'playback';
      } else if (presetKey === 'playlists') {
        cb.checked = scopeData.category === 'playlists' || scopeData.category === 'playback';
      } else if (presetKey === 'readonly') {
        cb.checked = scopeData.category === 'readonly';
      } else if (presetKey === 'none') {
        cb.checked = false;
      }
    });

    updateSelectedScopeCount();
  }

  // --- Verbose Logger Engine ---
  function getTimestamp() {
    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
  }

  function addLog(level, message, payload = null) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${getTimestamp()}]`;

    const badgeSpan = document.createElement('span');
    badgeSpan.className = `log-badge badge-${level.toLowerCase()}`;
    badgeSpan.textContent = level;

    const msgContainer = document.createElement('div');
    msgContainer.className = 'log-msg';

    const msgText = document.createElement('span');
    msgText.textContent = message;
    msgContainer.appendChild(msgText);

    if (payload !== null) {
      const payloadPre = document.createElement('div');
      payloadPre.className = 'log-payload';
      if (typeof payload === 'object') {
        payloadPre.textContent = JSON.stringify(payload, null, 2);
      } else {
        payloadPre.textContent = String(payload);
      }
      msgContainer.appendChild(payloadPre);
    }

    entry.appendChild(timeSpan);
    entry.appendChild(badgeSpan);
    entry.appendChild(msgContainer);

    terminalBody.appendChild(entry);
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  function setStatus(status, text) {
    statusPill.className = `status-pill status-${status}`;
    statusPill.textContent = text;
  }

  function maskString(str, visibleChars = 4) {
    if (!str || str.length <= visibleChars * 2) return '••••••••';
    return `${str.slice(0, visibleChars)}...${str.slice(-visibleChars)}`;
  }

  // --- Toast Notification ---
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3000);
  }

  async function copyToClipboard(text, label = 'Text') {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard!`, 'success');
    } catch {
      showToast(`Failed to copy ${label}`, 'error');
    }
  }

  // --- Live Token Expiry Countdown ---
  function startExpiryCountdown(expiresInSeconds) {
    if (tokenCountdownInterval) clearInterval(tokenCountdownInterval);

    let remaining = expiresInSeconds;
    const updateDisplay = () => {
      if (remaining <= 0) {
        tokenExpiryBadge.textContent = 'Expired';
        tokenExpiryBadge.style.background = 'var(--accent-rose)';
        tokenExpiryBadge.style.color = '#fff';
        resExpiresIn.textContent = '0 seconds (Expired)';
        clearInterval(tokenCountdownInterval);
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      tokenExpiryBadge.textContent = `Valid for ${mins}m ${secs}s`;
      resExpiresIn.textContent = `${remaining} seconds (~${mins} mins)`;
      remaining -= 1;
    };

    updateDisplay();
    tokenCountdownInterval = setInterval(updateDisplay, 1000);
  }

  // --- Code Snippet Generators ---
  function updateCodeSnippets() {
    if (!currentTokens) return;

    const clientId = activeClientId || 'YOUR_SPOTIFY_CLIENT_ID';
    const clientSecret = activeClientSecret || 'YOUR_SPOTIFY_CLIENT_SECRET';
    const refreshToken = currentTokens.refresh_token || 'YOUR_SPOTIFY_REFRESH_TOKEN';
    const redirectUri = inputRedirectUri.value.trim();

    let snippet = '';

    if (activeTab === 'env') {
      snippet = `# Spotify API Credentials
SPOTIFY_CLIENT_ID=${clientId}
SPOTIFY_CLIENT_SECRET=${clientSecret}
SPOTIFY_REFRESH_TOKEN=${refreshToken}
SPOTIFY_REDIRECT_URI=${redirectUri}
`;
    } else if (activeTab === 'nodejs') {
      snippet = `// Node.js (ESM / Node 18+) - Auto Refresh Access Token
import { URLSearchParams } from 'node:url';

const CLIENT_ID = '${clientId}';
const CLIENT_SECRET = '${clientSecret}';
const REFRESH_TOKEN = '${refreshToken}';

async function getAccessToken() {
  const basicAuth = Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString('base64');
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': \`Basic \${basicAuth}\`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(\`Failed to refresh token: \${JSON.stringify(data)}\`);
  }
  
  return data.access_token; // Fresh 1-hour access token
}

// Example usage: Fetch current user profile
async function fetchMyProfile() {
  const accessToken = await getAccessToken();
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': \`Bearer \${accessToken}\` }
  });
  const profile = await res.json();
  console.log('Spotify Profile:', profile.display_name, profile.id);
}

fetchMyProfile();
`;
    } else if (activeTab === 'python') {
      snippet = `# Python 3 (requests) - Auto Refresh Access Token
import requests
import base64

CLIENT_ID = '${clientId}'
CLIENT_SECRET = '${clientSecret}'
REFRESH_TOKEN = '${refreshToken}'

def get_access_token():
    auth_header = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    
    response = requests.post(
        "https://accounts.spotify.com/api/token",
        headers={
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data={
            "grant_type": "refresh_token",
            "refresh_token": REFRESH_TOKEN
        }
    )
    
    if response.status_code != 200:
        raise Exception(f"Token refresh failed: {response.text}")
        
    return response.json().get("access_token")

# Example: Get User Profile
def main():
    token = get_access_token()
    res = requests.get(
        "https://api.spotify.com/v1/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    print("Logged in as:", res.json().get("display_name"))

if __name__ == "__main__":
    main()
`;
    } else if (activeTab === 'curl') {
      const basic = btoa(`${clientId}:${clientSecret}`);
      snippet = `# Refresh Access Token using cURL
curl -X POST https://accounts.spotify.com/api/token \\
  -H "Authorization: Basic ${basic}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=${refreshToken}"
`;
    }

    const codeEl = document.createElement('code');
    codeEl.textContent = snippet;
    codeSnippetContent.replaceChildren(codeEl);
  }

  // --- Display Generated Results ---
  function displayResults(tokens) {
    currentTokens = tokens;
    resultsCard.style.display = 'block';

    resRefreshToken.textContent = tokens.refresh_token || '(No new refresh token returned - use previous one)';
    resAccessToken.textContent = tokens.access_token || '-';
    resTokenType.textContent = tokens.token_type || 'Bearer';

    const scopeArray = (tokens.scope || '').split(' ').filter(Boolean);
    resScopeCount.textContent = `${scopeArray.length} scopes`;

    startExpiryCountdown(tokens.expires_in || 3600);
    updateCodeSnippets();

    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // --- Start OAuth Flow ---
  async function startOAuthFlow() {
    const clientId = inputClientId.value.trim();
    const clientSecret = inputClientSecret.value.trim();
    const redirectUri = inputRedirectUri.value.trim();
    const selectedScopes = getSelectedScopes().join(' ');

    if (!clientId) {
      showToast('Please enter your Client ID', 'error');
      inputClientId.focus();
      return;
    }
    if (!clientSecret) {
      showToast('Please enter your Client Secret', 'error');
      inputClientSecret.focus();
      return;
    }

    activeClientId = clientId;
    activeClientSecret = clientSecret;

    // Reset Terminal & UI
    setStatus('active', 'CONNECTING');
    btnSubmit.disabled = true;

    addLog('INFO', '==================================================');
    addLog('INFO', 'Initiating OAuth 2.0 Authorization Code Flow...');
    addLog('INFO', `Client ID       : ${maskString(clientId, 6)}`);
    addLog('INFO', `Client Secret   : ${maskString(clientSecret, 4)} (Masked for privacy)`);
    addLog('INFO', `Redirect URI    : ${redirectUri}`);
    addLog('INFO', `Scopes (${selectedScopes ? selectedScopes.split(' ').length : 0}) : ${selectedScopes || 'None'}`);

    try {
      addLog('HTTP', 'Sending flow initialization to backend (POST /api/auth/start)...');
      const startRes = await fetch('/api/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientSecret,
          redirectUri,
          scopes: selectedScopes,
        }),
      });

      const startData = await startRes.json();

      if (!startRes.ok || !startData.success) {
        throw new Error(startData.error || 'Failed to initiate authorization');
      }

      addLog('SUCCESS', `CSRF State generated: ${startData.state.slice(0, 16)}...`);
      addLog('OAUTH', 'Opening Spotify Authorization dialog for user consent...');

      setStatus('active', 'AWAITING USER');

      // Open OAuth consent popup window
      const popupWidth = 520;
      const popupHeight = 700;
      const left = window.screen.width / 2 - popupWidth / 2;
      const top = window.screen.height / 2 - popupHeight / 2;

      const popup = window.open(
        startData.authUrl,
        'SpotifyAuthPopup',
        `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,status=no,menubar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        addLog('WARN', 'Popup blocked by browser. Redirecting full page...');
        window.location.href = startData.authUrl;
        return;
      }

      addLog('INFO', 'Awaiting Spotify consent callback...');

      // Polling interval in case user manually closes popup without approving
      const popupCheckInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupCheckInterval);
          if (statusPill.textContent === 'AWAITING USER') {
            setStatus('idle', 'IDLE');
            btnSubmit.disabled = false;
            addLog('WARN', 'Spotify authorization window was closed before completion.');
          }
        }
      }, 1000);

    } catch (err) {
      setStatus('error', 'ERROR');
      btnSubmit.disabled = false;
      addLog('ERROR', `Flow initialization error: ${err.message}`);
      showToast(err.message, 'error');
    }
  }

  // --- Exchange Authorization Code for Tokens ---
  async function handleAuthorizationCode(code, state) {
    setStatus('active', 'EXCHANGING');
    addLog('SUCCESS', `Spotify Authorization Code received: ${maskString(code, 6)}`);
    addLog('INFO', `Validating CSRF State: ${state.slice(0, 16)}...`);
    addLog('HTTP', 'Calling Spotify Token Endpoint (POST /api/auth/exchange)...');
    addLog('INFO', 'Payload: grant_type=authorization_code & Basic Auth (Base64 Encoded Client Credentials)');

    try {
      const res = await fetch('/api/auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          state,
          clientId: activeClientId,
          clientSecret: activeClientSecret,
          redirectUri: inputRedirectUri.value.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = (data.details && data.details.error_description) || data.error || 'Token exchange failed';
        throw new Error(errorMsg);
      }

      const tokens = data.tokens;
      setStatus('success', 'SUCCESS');
      btnSubmit.disabled = false;

      addLog('SUCCESS', '🎉 REFRESH TOKEN SUCCESSFULLY GENERATED!');
      addLog('OAUTH', `Refresh Token : ${tokens.refresh_token}`);
      addLog('OAUTH', `Access Token  : ${maskString(tokens.access_token, 12)}`);
      addLog('INFO', `Token Type    : ${tokens.token_type}`);
      addLog('INFO', `Expires In    : ${tokens.expires_in} seconds (1 Hour)`);
      addLog('INFO', `Granted Scope : ${tokens.scope}`);

      displayResults(tokens);
      showToast('Refresh Token generated successfully!', 'success');

    } catch (err) {
      setStatus('error', 'ERROR');
      btnSubmit.disabled = false;
      addLog('ERROR', `Token exchange error: ${err.message}`);
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  // --- Listen to postMessage from Callback Popup ---
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) return;

    if (event.data && event.data.type === 'SPOTIFY_AUTH_CALLBACK') {
      if (event.data.error) {
        setStatus('error', 'DENIED');
        btnSubmit.disabled = false;
        addLog('ERROR', `Authorization Denied by Spotify: ${event.data.errorDescription || event.data.error}`);
        showToast(`Spotify Auth Error: ${event.data.error}`, 'error');
        return;
      }

      if (event.data.code && event.data.state) {
        handleAuthorizationCode(event.data.code, event.data.state);
      }
    }
  });

  // --- Test Access Token (GET /v1/me) ---
  async function testAccessToken() {
    if (!currentTokens || !currentTokens.access_token) {
      showToast('No valid Access Token available yet', 'error');
      return;
    }

    addLog('HTTP', 'Testing Access Token: GET https://api.spotify.com/v1/me ...');
    btnTestProfile.disabled = true;

    try {
      const res = await fetch('/api/auth/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: currentTokens.access_token }),
      });

      const data = await res.json();
      btnTestProfile.disabled = false;

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify Spotify profile');
      }

      const p = data.profile;
      addLog('SUCCESS', `✅ Access Token is VALID! Spotify User: ${p.display_name} (ID: ${p.id})`);
      addLog('INFO', 'Spotify Account Details:', {
        name: p.display_name,
        id: p.id,
        email: p.email ? maskString(p.email, 3) : 'N/A',
        product: p.product || 'Free/Premium',
        country: p.country || 'N/A',
        followers: p.followers ? p.followers.total : 0,
        spotifyUrl: p.external_urls ? p.external_urls.spotify : ''
      });

      // Update User Badge in UI
      userDisplayName.textContent = p.display_name || p.id;
      userMetaDetails.textContent = `Type: ${(p.product || 'Standard').toUpperCase()} • Country: ${p.country || '-'} • Followers: ${p.followers ? p.followers.total : 0}`;

      if (p.images && p.images.length > 0) {
        userAvatar.src = p.images[0].url;
        userAvatar.style.display = 'block';
      } else {
        userAvatar.style.display = 'none';
      }

      userProfileBadge.style.display = 'flex';
      showToast(`Token valid! Logged in as ${p.display_name}`, 'success');

    } catch (err) {
      btnTestProfile.disabled = false;
      addLog('ERROR', `Access Token test failed: ${err.message}`);
      showToast(`Token test failed: ${err.message}`, 'error');
    }
  }

  // --- Test Refresh Token (POST grant_type=refresh_token) ---
  async function testRefreshToken() {
    if (!currentTokens || !currentTokens.refresh_token) {
      showToast('No Refresh Token available', 'error');
      return;
    }

    addLog('HTTP', 'Testing Refresh Token grant (POST /api/auth/refresh)...');
    btnTestRefresh.disabled = true;

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activeClientId,
          clientSecret: activeClientSecret,
          refreshToken: currentTokens.refresh_token,
        }),
      });

      const data = await res.json();
      btnTestRefresh.disabled = false;

      if (!res.ok || !data.success) {
        throw new Error((data.details && data.details.error_description) || data.error || 'Refresh failed');
      }

      const freshTokens = data.tokens;
      addLog('SUCCESS', '🔄 REFRESH TOKEN WORKS PERFECTLY! Minted fresh Access Token.');
      addLog('INFO', `New Access Token: ${maskString(freshTokens.access_token, 12)} (Valid for ${freshTokens.expires_in}s)`);

      // Update current access token
      currentTokens.access_token = freshTokens.access_token;
      currentTokens.expires_in = freshTokens.expires_in;
      if (freshTokens.refresh_token) {
        currentTokens.refresh_token = freshTokens.refresh_token;
      }

      displayResults(currentTokens);
      showToast('Refresh Token verified successfully!', 'success');

    } catch (err) {
      btnTestRefresh.disabled = false;
      addLog('ERROR', `Refresh Token test failed: ${err.message}`);
      showToast(`Refresh failed: ${err.message}`, 'error');
    }
  }

  // --- Setup Event Listeners ---
  function initEventListeners() {
    // Form submission
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      startOAuthFlow();
    });

    // Manual Code Exchange Handler
    const inputManualCallbackUrl = document.getElementById('inputManualCallbackUrl');
    const btnManualExchange = document.getElementById('btnManualExchange');

    if (btnManualExchange && inputManualCallbackUrl) {
      btnManualExchange.addEventListener('click', () => {
        const rawInput = inputManualCallbackUrl.value.trim();
        if (!rawInput) {
          showToast('Please paste a callback URL or code first', 'error');
          return;
        }

        let code = rawInput;
        let state = 'manual_state';

        if (rawInput.includes('?')) {
          try {
            const urlObj = new URL(rawInput);
            code = urlObj.searchParams.get('code') || rawInput;
            state = urlObj.searchParams.get('state') || 'manual_state';
          } catch {
            // Raw code pasted
          }
        }

        const clientId = inputClientId.value.trim();
        const clientSecret = inputClientSecret.value.trim();

        if (!clientId || !clientSecret) {
          showToast('Please enter your Client ID & Client Secret above', 'error');
          inputClientId.focus();
          return;
        }

        activeClientId = clientId;
        activeClientSecret = clientSecret;

        addLog('INFO', 'Manual Code Exchange triggered...');
        handleAuthorizationCode(code, state);
      });
    }

    // Toggle Secret Visibility
    btnToggleSecret.addEventListener('click', () => {
      const isPassword = inputClientSecret.type === 'password';
      inputClientSecret.type = isPassword ? 'text' : 'password';
      btnToggleSecret.setAttribute('title', isPassword ? 'Hide Secret' : 'Show Secret');
    });

    // Copy Redirect URI
    btnCopyRedirectUri.addEventListener('click', () => {
      copyToClipboard(inputRedirectUri.value, 'Redirect URI');
    });

    // Copy Refresh Token
    btnCopyRefreshToken.addEventListener('click', () => {
      if (currentTokens && currentTokens.refresh_token) {
        copyToClipboard(currentTokens.refresh_token, 'Refresh Token');
      }
    });

    // Copy Access Token
    btnCopyAccessToken.addEventListener('click', () => {
      if (currentTokens && currentTokens.access_token) {
        copyToClipboard(currentTokens.access_token, 'Access Token');
      }
    });

    // Copy Code Snippet
    btnCopyCodeSnippet.addEventListener('click', () => {
      const codeText = codeSnippetContent.textContent;
      if (codeText) {
        copyToClipboard(codeText, 'Code Snippet');
      }
    });

    // Copy Verbose Logs
    btnCopyLogs.addEventListener('click', () => {
      const lines = Array.from(terminalBody.querySelectorAll('.log-entry')).map((el) => el.textContent.trim());
      if (lines.length > 0) {
        copyToClipboard(lines.join('\n'), 'Verbose Logs');
      } else {
        showToast('Console log is empty', 'error');
      }
    });

    // Clear Verbose Logs
    btnClearLogs.addEventListener('click', () => {
      terminalBody.replaceChildren();
      addLog('INFO', 'Console logs cleared.');
    });

    // Toggle Scopes Accordion
    btnToggleScopeList.addEventListener('click', () => {
      const isHidden = scopesListContainer.style.display === 'none';
      scopesListContainer.style.display = isHidden ? 'grid' : 'none';
      scopeToggleIcon.textContent = isHidden ? '▲' : '▼';
    });

    // Scope Presets
    presetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        presetChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        applyScopePreset(chip.getAttribute('data-preset'));
      });
    });

    // Code Snippet Tabs
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab');
        updateCodeSnippets();
      });
    });

    // Token Test Buttons
    btnTestProfile.addEventListener('click', testAccessToken);
    btnTestRefresh.addEventListener('click', testRefreshToken);

    // Help Modal
    btnHelpGuide.addEventListener('click', () => helpModal.classList.add('open'));
    helpClientId.addEventListener('click', () => helpModal.classList.add('open'));
    btnCloseHelpModal.addEventListener('click', () => helpModal.classList.remove('open'));
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) helpModal.classList.remove('open');
    });

    // Check for recovered tokens from full redirect flow
    try {
      const saved = sessionStorage.getItem('spotify_tokens_pending');
      if (saved) {
        sessionStorage.removeItem('spotify_tokens_pending');
        const parsed = JSON.parse(saved);
        if (parsed.refresh_token || parsed.access_token) {
          addLog('SUCCESS', 'Recovered tokens from previous redirect session.');
          displayResults(parsed);
          setStatus('success', 'SUCCESS');
        }
      }
    } catch {
      // ignore
    }
  }

  // --- Initial Boot ---
  renderScopesCheckboxes();
  initEventListeners();

  // Initial welcome verbose logs
  addLog('INFO', 'Spotify API Refresh Token Generator ready.');
  addLog('INFO', 'Please enter your Spotify Client ID & Client Secret in the form.');
  addLog('INFO', `Redirect Callback URL configured to: ${inputRedirectUri.value}`);
})();
