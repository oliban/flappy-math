import { describe, test, expect, vi } from 'vitest';
import {
  createWeatherService,
  parseCurrentWeather,
  parsePlaces,
  DEFAULT_LOCATION
} from './weather.js';

function weatherBody(overrides = {}) {
  return {
    current: {
      temperature_2m: 13.4,
      weather_code: 3,
      wind_speed_10m: 4.2,
      is_day: 1,
      ...overrides
    }
  };
}

function okResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

function service(fetchFn, options = {}) {
  return createWeatherService({
    fetchFn,
    weatherUrl: 'https://weather.test/v1/forecast',
    geocodingUrl: 'https://geo.test/v1/search',
    ...options
  });
}

describe('DEFAULT_LOCATION', () => {
  test('is Mölndal', () => {
    expect(DEFAULT_LOCATION.name).toBe('Mölndal');
    expect(DEFAULT_LOCATION.latitude).toBeCloseTo(57.66, 1);
    expect(DEFAULT_LOCATION.longitude).toBeCloseTo(12.01, 1);
  });
});

describe('parseCurrentWeather', () => {
  test('reads temperature, code and wind', () => {
    expect(parseCurrentWeather(weatherBody())).toEqual({
      temperature: 13.4,
      code: 3,
      windSpeed: 4.2,
      isDay: true
    });
  });

  test('rounds temperature to one decimal', () => {
    expect(parseCurrentWeather(weatherBody({ temperature_2m: 13.44444 })).temperature).toBe(13.4);
  });

  test('treats is_day 0 as night', () => {
    expect(parseCurrentWeather(weatherBody({ is_day: 0 })).isDay).toBe(false);
  });

  test('defaults a missing wind speed to zero', () => {
    expect(parseCurrentWeather(weatherBody({ wind_speed_10m: undefined })).windSpeed).toBe(0);
  });

  test('rejects a body without a current section', () => {
    expect(parseCurrentWeather({})).toBeNull();
    expect(parseCurrentWeather(null)).toBeNull();
  });

  test('rejects a non-numeric temperature', () => {
    expect(parseCurrentWeather(weatherBody({ temperature_2m: 'mild' }))).toBeNull();
  });

  test('rejects an out-of-range weather code', () => {
    expect(parseCurrentWeather(weatherBody({ weather_code: 500 }))).toBeNull();
  });
});

describe('parsePlaces', () => {
  const place = {
    name: 'Mölndal',
    country: 'Sweden',
    admin1: 'Västra Götaland',
    latitude: 57.6554,
    longitude: 12.0134
  };

  test('keeps the fields the game needs', () => {
    expect(parsePlaces({ results: [place] })).toEqual([{
      name: 'Mölndal',
      country: 'Sweden',
      region: 'Västra Götaland',
      latitude: 57.6554,
      longitude: 12.0134
    }]);
  });

  test('returns an empty list when there are no results', () => {
    expect(parsePlaces({})).toEqual([]);
    expect(parsePlaces(null)).toEqual([]);
  });

  test('drops entries with unusable coordinates', () => {
    const places = parsePlaces({
      results: [place, { ...place, latitude: 'north' }, { ...place, longitude: 999 }]
    });

    expect(places).toHaveLength(1);
  });

  test('caps how many places come back', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...place, name: `Place ${i}` }));

    expect(parsePlaces({ results: many }).length).toBeLessThanOrEqual(8);
  });
});

describe('WeatherService.getWeather', () => {
  test('fetches the default location when none is given', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(weatherBody()));
    const result = await service(fetchFn).getWeather();

    expect(result.ok).toBe(true);
    expect(result.weather).toMatchObject({ temperature: 13.4, code: 3 });
    expect(result.weather.location.name).toBe('Mölndal');

    const url = fetchFn.mock.calls[0][0];
    expect(url).toContain('latitude=57.6554');
    expect(url).toContain('longitude=12.0134');
  });

  test('fetches a requested location', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(weatherBody()));
    const result = await service(fetchFn).getWeather({
      latitude: 59.3293, longitude: 18.0686, name: 'Stockholm'
    });

    expect(result.weather.location.name).toBe('Stockholm');
    expect(fetchFn.mock.calls[0][0]).toContain('latitude=59.3293');
  });

  test('serves a second call for the same place from cache', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(weatherBody()));
    const weather = service(fetchFn);

    await weather.getWeather();
    const second = await weather.getWeather();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(second.ok).toBe(true);
    expect(second.cached).toBe(true);
  });

  test('caches per location', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(weatherBody()));
    const weather = service(fetchFn);

    await weather.getWeather();
    await weather.getWeather({ latitude: 59.3293, longitude: 18.0686, name: 'Stockholm' });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('refetches once the cache entry has expired', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(weatherBody()));
    let now = 1000;
    const weather = service(fetchFn, { ttlMs: 60000, now: () => now });

    await weather.getWeather();
    now += 60001;
    await weather.getWeather();

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('reports an error when the upstream fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await service(fetchFn).getWeather();

    expect(result).toMatchObject({ ok: false, error: 'upstream' });
  });

  test('reports an error on a non-ok upstream response', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    expect((await service(fetchFn).getWeather()).ok).toBe(false);
  });

  test('reports an error when the upstream body makes no sense', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ current: { temperature_2m: 'warm' } }));

    expect((await service(fetchFn).getWeather()).ok).toBe(false);
  });

  test('falls back to stale cache when a refresh fails', async () => {
    let now = 1000;
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(okResponse(weatherBody()))
      .mockRejectedValue(new Error('network down'));
    const weather = service(fetchFn, { ttlMs: 1000, now: () => now });

    await weather.getWeather();
    now += 5000;
    const result = await weather.getWeather();

    expect(result.ok).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.weather.temperature).toBe(13.4);
  });

  test('does not hammer the upstream with concurrent calls', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(weatherBody()));
    const weather = service(fetchFn);

    await Promise.all([weather.getWeather(), weather.getWeather(), weather.getWeather()]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('WeatherService.searchPlaces', () => {
  const body = {
    results: [{ name: 'Mölndal', country: 'Sweden', latitude: 57.6554, longitude: 12.0134 }]
  };

  test('looks up a place by name', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse(body));
    const result = await service(fetchFn).searchPlaces('Mölndal');

    expect(result.ok).toBe(true);
    expect(result.places[0].name).toBe('Mölndal');
    expect(fetchFn.mock.calls[0][0]).toContain('name=M%C3%B6lndal');
  });

  test('rejects a blank query without calling the upstream', async () => {
    const fetchFn = vi.fn();
    const result = await service(fetchFn).searchPlaces('   ');

    expect(result).toMatchObject({ ok: false, error: 'invalid-query' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('truncates an absurdly long query', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ results: [] }));
    await service(fetchFn).searchPlaces('x'.repeat(500));

    expect(fetchFn.mock.calls[0][0].length).toBeLessThan(300);
  });

  test('reports an error when the lookup fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));

    expect((await service(fetchFn).searchPlaces('Mölndal')).ok).toBe(false);
  });
});
