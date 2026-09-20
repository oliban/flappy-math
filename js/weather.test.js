import { describe, test, expect, vi } from 'vitest';
import { createWeatherClient, DEFAULT_WEATHER, WEATHER_CONDITIONS } from './weather.js';

describe('weather client', () => {
  test('fetches /api/weather and keeps only known fields', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ condition: 'rain', temperature: 9, windSpeed: 30, isDay: true, place: 'Mölndal', evil: 'x' }) });
    const w = await createWeatherClient({ fetchFn }).fetch();
    expect(w).toEqual({ condition: 'rain', temperature: 9, windSpeed: 30, isDay: true, place: 'Mölndal' });
  });

  test('unknown conditions and garbage become the default', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ condition: 'lava', temperature: 'hot', windSpeed: -5, isDay: 'yes' }) });
    const w = await createWeatherClient({ fetchFn }).fetch();
    expect(WEATHER_CONDITIONS).toContain(w.condition);
    expect(w.condition).toBe(DEFAULT_WEATHER.condition);
    expect(w.temperature).toBeNull();
    expect(w.windSpeed).toBe(0);
    expect(w.isDay).toBe(true);
  });

  test('a missing temperature stays missing rather than reading 0°', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ condition: 'clear', temperature: null, windSpeed: 0, isDay: true, place: 'Mölndal' })
    });

    const w = await createWeatherClient({ fetchFn }).fetch();

    expect(w.temperature).toBeNull();
  });

  test('offline resolves to the default weather instead of throwing', async () => {
    const w = await createWeatherClient({ fetchFn: vi.fn().mockRejectedValue(new Error('offline')) }).fetch();
    expect(w).toEqual(DEFAULT_WEATHER);
  });

  test('a ?weather=snow override wins for testing', async () => {
    const fetchFn = vi.fn();
    const w = await createWeatherClient({ fetchFn, override: 'snow' }).fetch();
    expect(w.condition).toBe('snow');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('player coordinates', () => {
  test('are sent rounded to two decimals', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ condition: 'clear', place: 'Uppsala', isDay: true }) });
    const w = await createWeatherClient({ fetchFn }).fetch({ lat: 59.858123, lon: 17.638456 });
    expect(fetchFn.mock.calls[0][0]).toBe('/api/weather?lat=59.86&lon=17.64');
    expect(w.place).toBe('Uppsala');
  });

  test('without coordinates the plain endpoint is used', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ condition: 'clear' }) });
    await createWeatherClient({ fetchFn }).fetch();
    expect(fetchFn.mock.calls[0][0]).toBe('/api/weather');
  });
});
