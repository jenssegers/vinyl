/**
 * One-shot CLI for first-run Spotify auth.
 * Run: npm run setup:spotify
 */
import crypto from 'node:crypto';
import http from 'node:http';
import { intro, log, outro, spinner } from '@clack/prompts';
import open from 'open';
import { config } from './config';
import { loadTokens, saveTokens } from './tokens';

const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ?? `http://127.0.0.1:${config.setupPort}/auth/callback`;

const SCOPES = 'user-read-currently-playing user-read-playback-state';

intro('Vinyl — Spotify setup');

if (loadTokens()) {
  outro('Already connected. Delete ~/.config/vinyl/tokens.json to re-authenticate.');
  process.exit(0);
}

const verifier = crypto.randomBytes(64).toString('base64url').slice(0, 128);
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const state = crypto.randomBytes(16).toString('hex');

const authUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    client_id: config.spotifyClientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });

const spin = spinner();

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${config.setupPort}`);
  if (url.pathname !== '/auth/callback') {
    response.writeHead(404).end();
    return;
  }

  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (error || !code || returnedState !== state) {
    spin.stop('Authorization failed.');
    log.error(error ?? 'Invalid state or missing code');
    response.writeHead(400).end('<p>Authorization failed — check your terminal.</p>');
    process.exit(1);
  }

  spin.message('Exchanging code for tokens...');

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: config.spotifyClientId,
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    spin.stop('Token exchange failed.');
    log.error(errorBody);
    response.writeHead(500).end('<p>Token exchange failed — check your terminal.</p>');
    process.exit(1);
  }

  const data = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });

  response
    .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    .end('<h1>✓ Connected</h1><p>You can close this tab.</p>');

  spin.stop('Spotify connected.');
  outro('Run npm start to begin.');
  server.close(() => process.exit(0));
});

server.listen(config.setupPort, '127.0.0.1', async () => {
  log.info(`Redirect URI registered in your Spotify app: ${REDIRECT_URI}`);
  log.info(`Open this URL in a browser to authorize:\n${authUrl}`);
  await open(authUrl).catch(() => {});
  spin.start('Waiting for authorization...');
});
