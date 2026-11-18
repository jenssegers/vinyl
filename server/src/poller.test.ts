import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Display } from '../../shared/display.ts';
import { Poller } from './poller.ts';
import { setScreen } from './screen.ts';
import { getPlayback, type Playback } from './spotify/client.ts';
import { SpotifyError } from './spotify/errors.ts';

vi.mock('./spotify/client.ts', () => ({ getPlayback: vi.fn() }));
vi.mock('./screen.ts', () => ({ setScreen: vi.fn() }));

const POLL_INTERVAL_MS = 2000;

const track = {
  id: 'track-1',
  name: 'So What',
  artist: 'Miles Davis',
  albumArt: 'https://i.scdn.co/image/kind-of-blue',
};

// The test environment allows devices matching "kitchen".
const kitchen = { id: 'device-1', name: 'Kitchen', type: 'Speaker' };
const phone = { id: 'device-2', name: 'Phone', type: 'Smartphone' };

const playing: Playback = { isPlaying: true, track, device: kitchen };
const paused: Playback = { isPlaying: false, track, device: kitchen };

let poller: Poller;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getPlayback).mockReset();
  vi.mocked(setScreen).mockClear();
  poller = new Poller();
});

afterEach(() => {
  poller.stop();
  vi.useRealTimers();
});

/** Starts polling and answers each poll with the next response, one poll interval apart. */
async function pollEach(responses: (Playback | null)[]): Promise<void> {
  for (const response of responses) vi.mocked(getPlayback).mockResolvedValueOnce(response);

  poller.start();
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * (responses.length - 1));
}

describe('Poller', () => {
  it.each<{ name: string; responses: (Playback | null)[]; display: Display; screen: string }>([
    {
      name: 'a playing track',
      responses: [playing],
      display: { kind: 'playing', track },
      screen: 'on',
    },
    { name: 'nothing active', responses: [null], display: { kind: 'off' }, screen: 'off' },
    {
      name: 'a pause while playing',
      responses: [playing, paused],
      display: { kind: 'paused', track },
      screen: 'on',
    },
    {
      name: 'a paused track while off, which does not wake the screen',
      responses: [null, paused],
      display: { kind: 'off' },
      screen: 'off',
    },
    {
      name: 'a device that is not allowed',
      responses: [{ ...playing, device: phone }],
      display: { kind: 'off' },
      screen: 'off',
    },
    {
      name: 'playback that stops',
      responses: [playing, null],
      display: { kind: 'off' },
      screen: 'off',
    },
  ])('shows $name', async ({ responses, display, screen }) => {
    await pollEach(responses);

    expect(poller.getState()).toEqual(display);
    expect(setScreen).toHaveBeenLastCalledWith(screen);
  });

  it('turns off once paused for the pause timeout', async () => {
    vi.mocked(getPlayback).mockResolvedValueOnce(playing).mockResolvedValue(paused);
    poller.start();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    await vi.advanceTimersByTimeAsync(8000);
    expect(poller.getState().kind).toBe('paused');

    await vi.advanceTimersByTimeAsync(4000);
    expect(poller.getState()).toEqual({ kind: 'off' });
    expect(setScreen).toHaveBeenLastCalledWith('off');
  });

  it.each([
    {
      error: new SpotifyError('authorization-failed', 'token request failed: 400'),
      message: 'Spotify login expired',
    },
    {
      error: new SpotifyError('rate-limited', 'spotify API error: 429'),
      message: 'Spotify rate limit',
    },
    {
      error: new DOMException('The operation timed out.', 'TimeoutError'),
      message: 'Connection timeout',
    },
    { error: new TypeError('fetch failed'), message: 'Network error' },
  ])('shows "$message" after three failures in a row, backing off', async ({ error, message }) => {
    vi.mocked(getPlayback).mockRejectedValue(error);
    poller.start();

    // Backs off 4s, then 8s, before the third attempt.
    await vi.advanceTimersByTimeAsync(4000);
    expect(getPlayback).toHaveBeenCalledTimes(2);
    expect(poller.getState()).toEqual({ kind: 'off' });

    await vi.advanceTimersByTimeAsync(8000);
    expect(getPlayback).toHaveBeenCalledTimes(3);
    expect(poller.getState()).toEqual({ kind: 'error', message });
    expect(setScreen).toHaveBeenLastCalledWith('on');
  });

  it('keeps a single poll loop when a command arrives during a poll', async () => {
    let answerFirstPoll: (playback: Playback) => void = () => {};
    vi.mocked(getPlayback)
      .mockReturnValueOnce(new Promise((resolve) => (answerFirstPoll = resolve)))
      .mockResolvedValue(playing);

    poller.start();
    poller.refreshSoon();
    answerFirstPoll(paused);

    // The command polls again soon after the poll in flight, then the interval resumes.
    await vi.advanceTimersByTimeAsync(400);
    expect(getPlayback).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(getPlayback).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(getPlayback).toHaveBeenCalledTimes(4);
  });
});
