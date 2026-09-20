import { describe, test, expect, vi } from 'vitest';
import { createWeatherClient, describeWeather, createLocationStore } from './weather.js';

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function clientWith(fetchFn) {
  return createWeatherClient({ fetchFn, baseUrl: '/api' });
}

const READING = {
  temperature: 12.7,
  code: 61,
  windSpeed: 3.5,
  isDay: true,
  location: { name: 'Mölndal', latitude: 57.6554, longitude: 12.0134 }
};

describe('describeWeather', () => {
  test('maps clear sky to a sun by day and a moon by night', () => {
    expect(describeWeather(0, true).icon).toBe('☀️');
    expect(describeWeather(0, false).icon).toBe('🌙');
  });

  test('maps the WMO groups to sensible icons', () => {
    expect(describeWeather(3).key).toBe('weatherOvercast');
    expect(describeWeather(48).key).toBe('weatherFog');
    expect(describeWeather(53).key).toBe('weatherDrizzle');
    expect(describeWeather(65).key).toBe('weatherRain');
    expect(describeWeather(73).key).toBe('weatherSnow');
    expect(describeWeather(81).key).toBe('weatherShowers');
    expect(describeWeather(95).key).toBe('weatherThunder');
  });

  test('falls back for an unknown code', () => {
    expect(describeWeather(1234).key).toBe('weatherUnknown');
    expect(describeWeather(undefined).key).toBe('weatherUnknown');
  });

  test('always returns an icon', () => {
    for (let code = 0; code <= 99; code++) {
      expect(describeWeather(code).icon).toBeTruthy();
    }
  });
});

describe('WeatherClient.fetchWeather', () => {
  test('asks our own server, not a weather provider', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ weather: READING }));
    await clientWith(fetchFn).fetchWeather();

    const url = fetchFn.mock.calls[0][0];
    expect(url).toContain('/api/weather');
    expect(url).not.toContain('http');
  });

  test('sends no coordinates when no location is saved', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ weather: READING }));
    const result = await clientWith(fetchFn).fetchWeather();

    expect(fetchFn.mock.calls[0][0]).not.toContain('lat=');
    expect(result.ok).toBe(true);
    expect(result.weather.location.name).toBe('Mölndal');
  });

  test('sends the saved location when there is one', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ weather: READING }));
    await clientWith(fetchFn).fetchWeather({ name: 'Stockholm', latitude: 59.3293, longitude: 18.0686 });

    const url = fetchFn.mock.calls[0][0];
    expect(url).toContain('lat=59.3293');
    expect(url).toContain('lon=18.0686');
    expect(url).toContain('name=Stockholm');
  });

  test('reports offline when the request fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));

    expect(await clientWith(fetchFn).fetchWeather()).toEqual({ ok: false, error: 'offline' });
  });

  test('reports a timeout when the request is aborted', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const fetchFn = vi.fn().mockRejectedValue(abortError);

    expect((await clientWith(fetchFn).fetchWeather()).error).toBe('timeout');
  });

  test('reports an error when the server cannot reach the provider', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ error: 'upstream' }, false, 503));

    expect((await clientWith(fetchFn).fetchWeather()).ok).toBe(false);
  });

  test('rejects a reading without a usable temperature', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      weather: { ...READING, temperature: 'mild' }
    }));

    expect((await clientWith(fetchFn).fetchWeather()).ok).toBe(false);
  });

  test('keeps a missing location name usable', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      weather: { ...READING, location: { latitude: 1, longitude: 2 } }
    }));

    const result = await clientWith(fetchFn).fetchWeather();
    expect(result.ok).toBe(true);
    expect(typeof result.weather.location.name).toBe('string');
  });
});

describe('WeatherClient.searchPlaces', () => {
  test('queries our own server', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      places: [{ name: 'Stockholm', country: 'Sweden', region: '', latitude: 59.3, longitude: 18.1 }]
    }));

    const result = await clientWith(fetchFn).searchPlaces('stockholm');

    expect(fetchFn.mock.calls[0][0]).toContain('/api/weather/search?q=stockholm');
    expect(result.places[0].name).toBe('Stockholm');
  });

  test('does not call out for a blank query', async () => {
    const fetchFn = vi.fn();
    const result = await clientWith(fetchFn).searchPlaces('   ');

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'invalid-query', places: [] });
  });

  test('drops malformed places from the response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      places: [{ name: 'Good', latitude: 1, longitude: 2 }, { name: 'Bad', latitude: 'x' }, null]
    }));

    const result = await clientWith(fetchFn).searchPlaces('any');
    expect(result.places).toHaveLength(1);
  });

  test('reports failure without throwing', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));

    expect(await clientWith(fetchFn).searchPlaces('x')).toMatchObject({ ok: false, places: [] });
  });
});

describe('LocationStore', () => {
  function makeStore() {
    const data = {};
    return createLocationStore({
      getItem: key => data[key] ?? null,
      setItem: (key, value) => { data[key] = value; },
      removeItem: key => { delete data[key]; }
    });
  }

  test('starts with no saved location, meaning the default', () => {
    expect(makeStore().load()).toBeNull();
  });

  test('saves and reloads a chosen location', () => {
    const store = makeStore();
    store.save({ name: 'Stockholm', latitude: 59.3293, longitude: 18.0686 });

    expect(store.load()).toMatchObject({ name: 'Stockholm', latitude: 59.3293, longitude: 18.0686 });
  });

  test('refuses a location without usable coordinates', () => {
    const store = makeStore();

    expect(store.save({ name: 'Nowhere', latitude: 'x', longitude: 2 })).toBe(false);
    expect(store.load()).toBeNull();
  });

  test('clear goes back to the default location', () => {
    const store = makeStore();
    store.save({ name: 'Stockholm', latitude: 59.3, longitude: 18.1 });
    store.clear();

    expect(store.load()).toBeNull();
  });

  test('ignores corrupted saved data', () => {
    const data = { 'flappy-math-location': 'not json{{' };
    const store = createLocationStore({
      getItem: key => data[key] ?? null,
      setItem: (key, value) => { data[key] = value; },
      removeItem: key => { delete data[key]; }
    });

    expect(store.load()).toBeNull();
  });

  test('survives storage that throws', () => {
    const store = createLocationStore({
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); }
    });

    expect(store.load()).toBeNull();
    expect(() => store.clear()).not.toThrow();
  });
});
