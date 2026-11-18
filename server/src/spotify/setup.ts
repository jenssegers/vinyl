/**
 * One-shot CLI that connects Spotify on first run.
 * Run: pnpm setup:spotify
 */
import http from 'node:http';
import { intro, log, outro, spinner } from '@clack/prompts';
import open from 'open';
import { config } from '../config.ts';
import { createAuthorization, exchangeAuthorizationCode } from './auth.ts';
import { loadTokens } from './tokens.ts';

const CALLBACK_PATH = new URL(config.redirectUri).pathname;

intro('Vinyl: Spotify setup');

// Already connected: refreshing keeps the tokens valid, so there is nothing to do.
if (loadTokens()) {
  outro(`Already connected. Delete ${config.tokensPath} to connect again.`);
  process.exit(0);
}

const authorization = createAuthorization();
const spin = spinner();

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', config.redirectUri);
  if (url.pathname !== CALLBACK_PATH) {
    response.writeHead(404).end();
    return;
  }

  // Spotify redirects back with either a code or an error.
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (error || !code || url.searchParams.get('state') !== authorization.state) {
    spin.stop('Authorization failed.');
    log.error(error ?? 'Invalid state or missing code');
    response.writeHead(400).end('<p>Authorization failed, check your terminal.</p>');
    process.exit(1);
  }

  spin.message('Exchanging code for tokens...');
  try {
    await exchangeAuthorizationCode(code, authorization.verifier);
  } catch (exchangeError) {
    spin.stop('Token exchange failed.');
    log.error(String(exchangeError));
    response.writeHead(500).end('<p>Token exchange failed, check your terminal.</p>');
    process.exit(1);
  }

  response
    .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    .end('<h1>✓ Connected</h1><p>You can close this tab.</p>');

  spin.stop('Spotify connected.');
  outro('Run pnpm start to begin.');
  server.close(() => process.exit(0));
});

server.listen(config.setupPort, '127.0.0.1', async () => {
  log.info(`Redirect URI registered in your Spotify app: ${config.redirectUri}`);
  log.info(`Open this URL in a browser to authorize:\n${authorization.url}`);
  // On the Pi over SSH there is no browser to open; the URL above covers that case.
  await open(authorization.url).catch(() => {});
  spin.start('Waiting for authorization...');
});
