import { describe, test, expect, vi } from 'vitest';
import { createGlobalScores } from './globalScores.js';

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function clientWith(fetchFn, options = {}) {
  return createGlobalScores({ fetchFn, baseUrl: '/api', ...options });
}

const SERVER_ENTRY = { name: 'Ada', score: 12, table: 4, speed: 3, date: '2026-01-01T00:00:00.000Z' };

describe('GlobalScores', () => {
  describe('fetchTop', () => {
    test('requests the scores endpoint and returns entries', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ entries: [SERVER_ENTRY] }));
      const result = await clientWith(fetchFn).fetchTop();

      expect(result.ok).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({ name: 'Ada', score: 12, table: 4 });

      const url = fetchFn.mock.calls[0][0];
      expect(url).toContain('/api/scores');
    });

    test('passes table and limit as query parameters', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ entries: [] }));
      await clientWith(fetchFn).fetchTop({ table: 7, limit: 5 });

      const url = fetchFn.mock.calls[0][0];
      expect(url).toContain('table=7');
      expect(url).toContain('limit=5');
    });

    test('omits the table parameter when asking for all tables', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ entries: [] }));
      await clientWith(fetchFn).fetchTop({ table: null });

      expect(fetchFn.mock.calls[0][0]).not.toContain('table=');
    });

    test('reports an offline error when the request fails', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));
      const result = await clientWith(fetchFn).fetchTop();

      expect(result).toEqual({ ok: false, error: 'offline', entries: [] });
    });

    test('reports a timeout when the request is aborted', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      const fetchFn = vi.fn().mockRejectedValue(abortError);

      const result = await clientWith(fetchFn).fetchTop();
      expect(result.error).toBe('timeout');
    });

    test('reports a server error on a non-ok response', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
      const result = await clientWith(fetchFn).fetchTop();

      expect(result).toEqual({ ok: false, error: 'server', entries: [] });
    });

    test('reports a server error when the body is not valid JSON', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error('bad json'); }
      });

      const result = await clientWith(fetchFn).fetchTop();
      expect(result.error).toBe('server');
    });

    test('tolerates a response without an entries array', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));
      const result = await clientWith(fetchFn).fetchTop();

      expect(result).toEqual({ ok: true, entries: [] });
    });
  });

  describe('sanitizing server data', () => {
    test('drops entries with an out-of-range table', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
        entries: [SERVER_ENTRY, { ...SERVER_ENTRY, table: 99 }]
      }));

      const result = await clientWith(fetchFn).fetchTop();
      expect(result.entries).toHaveLength(1);
    });

    test('drops entries without a usable score', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
        entries: [{ ...SERVER_ENTRY, score: 'lots' }, null, 'nope']
      }));

      const result = await clientWith(fetchFn).fetchTop();
      expect(result.entries).toEqual([]);
    });

    test('sanitizes names coming from the server', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
        entries: [{ ...SERVER_ENTRY, name: '  Very long player name here  ' }]
      }));

      const result = await clientWith(fetchFn).fetchTop();
      expect(result.entries[0].name).toBe('Very long pl');
    });

    test('replaces a missing name with a placeholder', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
        entries: [{ ...SERVER_ENTRY, name: '' }]
      }));

      const result = await clientWith(fetchFn).fetchTop();
      expect(result.entries[0].name).toBe('???');
    });
  });

  describe('submit', () => {
    const run = { name: 'Ada', score: 9, table: 5, speed: 2, streak: 4 };

    test('posts the run as JSON and returns the global rank', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ rank: 3, entries: [SERVER_ENTRY] }));
      const result = await clientWith(fetchFn).submit(run);

      expect(result.ok).toBe(true);
      expect(result.rank).toBe(3);
      expect(result.entries).toHaveLength(1);

      const [url, options] = fetchFn.mock.calls[0];
      expect(url).toContain('/api/scores');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toMatchObject({ name: 'Ada', score: 9, table: 5 });
    });

    test('does not post a run without a player name', async () => {
      const fetchFn = vi.fn();
      const result = await clientWith(fetchFn).submit({ ...run, name: '  ' });

      expect(fetchFn).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, error: 'no-name' });
    });

    test('reports offline when the post fails', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));
      const result = await clientWith(fetchFn).submit(run);

      expect(result).toEqual({ ok: false, error: 'offline' });
    });

    test('reports a server error on a non-ok response', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, false, 400));
      const result = await clientWith(fetchFn).submit(run);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('server');
    });

    test('returns a null rank when the server does not report one', async () => {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));
      const result = await clientWith(fetchFn).submit(run);

      expect(result).toEqual({ ok: true, rank: null, entries: [] });
    });
  });

  describe('availability', () => {
    test('is disabled when there is no fetch implementation', async () => {
      const client = createGlobalScores({ fetchFn: null });

      expect(client.isAvailable()).toBe(false);
      expect(await client.fetchTop()).toEqual({ ok: false, error: 'unavailable', entries: [] });
      expect(await client.submit({ name: 'Ada', score: 1, table: 2, speed: 1 }))
        .toEqual({ ok: false, error: 'unavailable' });
    });

    test('is available when fetch exists', () => {
      expect(clientWith(vi.fn()).isAvailable()).toBe(true);
    });
  });
});

describe('avatar support', () => {
  test('submit sends the avatar id and fetchTop returns it', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ rank: 1, entries: [{ ...SERVER_ENTRY, avatar: 'fox' }] }));
    const client = clientWith(fetchFn);
    const result = await client.submit({ name: 'Ada', score: 12, table: 4, speed: 3, avatar: 'fox' });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(sent.avatar).toBe('fox');
    expect(result.entries[0].avatar).toBe('fox');
  });

  test('a missing avatar becomes an empty string', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ entries: [SERVER_ENTRY] }));
    const result = await clientWith(fetchFn).fetchTop();
    expect(result.entries[0].avatar).toBe('');
  });
});
