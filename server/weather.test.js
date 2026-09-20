import { describe, test, expect, vi } from 'vitest';
import { conditionFromWmo, createWeatherService, MOLNDAL } from './weather.js';

describe('WMO weather code mapping', () => {
  test('maps the common codes to game conditions', () => {
    expect(conditionFromWmo(0)).toBe('clear');
    expect(conditionFromWmo(1)).toBe('clear');
    expect(conditionFromWmo(2)).toBe('clouds');
    expect(conditionFromWmo(3)).toBe('overcast');
    expect(conditionFromWmo(45)).toBe('fog');
    expect(conditionFromWmo(61)).toBe('rain');
    expect(conditionFromWmo(80)).toBe('rain');
    expect(conditionFromWmo(71)).toBe('snow');
    expect(conditionFromWmo(85)).toBe('snow');
    expect(conditionFromWmo(95)).toBe('thunder');
  });

  test('unknown codes fall back to clouds', () => {
    expect(conditionFromWmo(999)).toBe('clouds');
    expect(conditionFromWmo(undefined)).toBe('clouds');
  });
});

function openMeteoResponse(current) {
  return { ok: true, status: 200, json: async () => ({ current }) };
}
const CURRENT = { temperature_2m: 11.4, weather_code: 61, wind_speed_10m: 21.3, is_day: 1 };

// Routes fake responses by URL so one fetch mock can serve weather, IP-geo and reverse-geocode
function fakeFetch({ ipGeo, reverse, weather = CURRENT, failIpGeo = false } = {}) {
  const calls = [];
  const fn = vi.fn(async (url) => {
    calls.push(url);
    if (url.includes('open-meteo')) return openMeteoResponse(weather);
    if (url.includes('ipapi.co')) {
      if (failIpGeo) throw new Error('geo down');
      return { ok: true, status: 200, json: async () => ipGeo };
    }
    if (url.includes('bigdatacloud')) return { ok: true, status: 200, json: async () => reverse };
    throw new Error('unexpected url ' + url);
  });
  fn.calls = calls;
  return fn;
}

describe('weather service', () => {
  test('with no coordinates it uses Mölndal', async () => {
    const fetchFn = fakeFetch();
    const svc = createWeatherService({ fetchFn, now: () => 1000 });
    const report = await svc.get({});
    const url = fetchFn.calls.find(u => u.includes('open-meteo'));
    expect(url).toContain(`latitude=${MOLNDAL.latitude}`);
    expect(report).toMatchObject({ condition: 'rain', temperature: 11, windSpeed: 21, isDay: true, place: 'Mölndal', stale: false });
  });

  test('uses the player coordinates when given, rounded to ~1 km, and names the place', async () => {
    const fetchFn = fakeFetch({ reverse: { city: 'Uppsala', locality: 'Fålhagen' } });
    const svc = createWeatherService({ fetchFn, now: () => 1000 });
    const report = await svc.get({ lat: 59.858123, lon: 17.638456 });
    const url = fetchFn.calls.find(u => u.includes('open-meteo'));
    expect(url).toContain('latitude=59.86');
    expect(url).toContain('longitude=17.64');
    expect(report.place).toBe('Uppsala');
    expect(fetchFn.calls.some(u => u.includes('ipapi.co'))).toBe(false);
  });

  test('never locates the player by IP, even when one is passed', async () => {
    const fetchFn = fakeFetch({ ipGeo: { city: 'Luleå', latitude: 65.5848, longitude: 22.1547 } });
    const svc = createWeatherService({ fetchFn, now: () => 1000 });

    const report = await svc.get({ ip: '203.0.113.7' });

    expect(fetchFn.calls.some(u => u.includes('ipapi.co'))).toBe(false);
    expect(fetchFn.calls.find(u => u.includes('open-meteo'))).toContain(`latitude=${MOLNDAL.latitude}`);
    expect(report.place).toBe('Mölndal');
  });

  test('rejects nonsense coordinates', async () => {
    const fetchFn = fakeFetch();
    const svc = createWeatherService({ fetchFn, now: () => 1000 });
    const report = await svc.get({ lat: 999, lon: 'abc' });
    expect(report.place).toBe('Mölndal');
    // Missing query params arrive as null; they must not become (0, 0) in the Atlantic
    expect((await svc.get({ lat: null, lon: null })).place).toBe('Mölndal');
    expect((await svc.get({ lat: '', lon: '' })).place).toBe('Mölndal');
  });

  test('caches per location for the TTL, then refreshes', async () => {
    const fetchFn = fakeFetch();
    let t = 0;
    const svc = createWeatherService({ fetchFn, now: () => t, ttlMs: 600000 });
    await svc.get({}); await svc.get({});
    expect(fetchFn.calls.filter(u => u.includes('open-meteo')).length).toBe(1);
    await svc.get({ lat: 59.86, lon: 17.64 });
    expect(fetchFn.calls.filter(u => u.includes('open-meteo')).length).toBe(2);
    t = 600001;
    await svc.get({});
    expect(fetchFn.calls.filter(u => u.includes('open-meteo')).length).toBe(3);
  });

  test('keeps serving the last report (marked stale) when the upstream fails', async () => {
    let fail = false;
    const fetchFn = vi.fn(async (url) => {
      if (fail) throw new Error('network');
      return openMeteoResponse({ temperature_2m: 5, weather_code: 71, wind_speed_10m: 3, is_day: 1 });
    });
    let t = 0;
    const svc = createWeatherService({ fetchFn, now: () => t, ttlMs: 1000 });
    expect((await svc.get({})).condition).toBe('snow');
    fail = true;
    t = 5000;
    const report = await svc.get({});
    expect(report.condition).toBe('snow');
    expect(report.stale).toBe(true);
  });

  test('returns a clear-sky default when there has never been a successful fetch', async () => {
    const svc = createWeatherService({ fetchFn: vi.fn().mockRejectedValue(new Error('down')), now: () => 0 });
    const report = await svc.get({});
    expect(report.condition).toBe('clear');
    expect(report.stale).toBe(true);
  });
});
