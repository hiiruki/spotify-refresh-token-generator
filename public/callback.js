(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  const errorDescription = urlParams.get('error_description');

  const statusTitle = document.getElementById('statusTitle');
  const statusMessage = document.getElementById('statusMessage');
  const statusSpinner = document.getElementById('statusSpinner');
  const badgeContainer = document.getElementById('statusBadgeContainer');

  function showBadge(text, isError) {
    badgeContainer.replaceChildren();
    const badge = document.createElement('span');
    badge.className = isError ? 'status-badge error' : 'status-badge success';
    badge.textContent = text;
    badgeContainer.appendChild(badge);
  }

  if (error) {
    if (statusSpinner) statusSpinner.style.display = 'none';
    statusTitle.textContent = 'Authentication Denied / Failed';
    statusMessage.textContent = errorDescription || error || 'Spotify authorization was declined or cancelled.';
    showBadge('Failed: ' + error, true);

    if (window.opener) {
      try {
        window.opener.postMessage(
          {
            type: 'SPOTIFY_AUTH_CALLBACK',
            error: error,
            errorDescription: errorDescription || error,
            state: state,
          },
          window.location.origin
        );
      } catch {
        // Opener inaccessible
      }
      setTimeout(() => window.close(), 2500);
    }
    return;
  }

  if (!code || !state) {
    if (statusSpinner) statusSpinner.style.display = 'none';
    statusTitle.textContent = 'Missing Parameters';
    statusMessage.textContent = 'No authorization code or state found in redirect query parameters.';
    showBadge('Invalid Request', true);
    return;
  }

  // If opened via popup window (with window.opener)
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(
        {
          type: 'SPOTIFY_AUTH_CALLBACK',
          code: code,
          state: state,
        },
        window.location.origin
      );

      if (statusSpinner) statusSpinner.style.display = 'none';
      statusTitle.textContent = 'Authentication Successful!';
      statusMessage.textContent = 'Authorization code received. This window will close automatically...';
      showBadge('Success', false);

      setTimeout(() => {
        window.close();
      }, 700);
      return;
    } catch (err) {
      // In case postMessage fails, proceed to fallback
    }
  }

  // Fallback: If opened in a regular tab without window.opener
  statusTitle.textContent = 'Exchanging Authorization Code...';
  statusMessage.textContent = 'Exchanging code for Spotify tokens directly...';

  fetch('/api/auth/exchange', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, state }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (statusSpinner) statusSpinner.style.display = 'none';
      if (data.success && data.tokens) {
        statusTitle.textContent = 'Tokens Generated Successfully!';
        statusMessage.textContent = 'Redirecting back to generator dashboard...';
        showBadge('Tokens Ready', false);

        // Store tokens securely in sessionStorage for immediate recovery
        try {
          sessionStorage.setItem('spotify_tokens_pending', JSON.stringify(data.tokens));
        } catch {
          // ignore storage error
        }

        setTimeout(() => {
          window.location.href = '/?recovered=1';
        }, 1200);
      } else {
        statusTitle.textContent = 'Token Exchange Failed';
        statusMessage.textContent = data.error || 'An error occurred while exchanging tokens.';
        showBadge('Error', true);
      }
    })
    .catch((err) => {
      if (statusSpinner) statusSpinner.style.display = 'none';
      statusTitle.textContent = 'Connection Error';
      statusMessage.textContent = err.message || 'Failed to connect to local server.';
      showBadge('Network Error', true);
    });
})();
