// Client for /api/weather. Always resolves: offline means default (clear) weather.

export const WEATHER_CONDITIONS = ['clear', 'clouds', 'overcast', 'fog', 'rain', 'snow', 'thunder'];
export const DEFAULT_WEATHER = { condition: 'clear', temperature: null, windSpeed: 0, isDay: true, place: 'Mölndal' };

export function parseWeather(body) {
  if (!body || typeof body !== 'object') return { ...DEFAULT_WEATHER };
  const t = Number(body.temperature);
  const wind = Number(body.windSpeed);
  return {
    condition: WEATHER_CONDITIONS.includes(body.condition) ? body.condition : DEFAULT_WEATHER.condition,
    temperature: Number.isFinite(t) ? Math.round(t) : null,
    windSpeed: Number.isFinite(wind) && wind >= 0 ? Math.round(wind) : 0,
    isDay: typeof body.isDay === 'boolean' ? body.isDay : true,
    place: typeof body.place === 'string' && body.place ? body.place : DEFAULT_WEATHER.place
  };
}

export function createWeatherClient({
  fetchFn = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  url = '/api/weather',
  override = null      // e.g. ?weather=snow for testing the visuals
} = {}) {
  return {
    // coords: optional { lat, lon } from the browser; rounded to ~1 km before leaving the device
    async fetch(coords = null) {
      if (override && WEATHER_CONDITIONS.includes(override)) {
        console.info(`[weather] using ?weather=${override} override`);
        return { ...DEFAULT_WEATHER, condition: override, isDay: override !== 'night' };
      }
      if (!fetchFn) { console.warn('[weather] fetch unavailable, using default clear sky'); return { ...DEFAULT_WEATHER }; }
      try {
        let target = url;
        if (coords && Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lon))) {
          const lat = (Math.round(Number(coords.lat) * 100) / 100).toFixed(2);
          const lon = (Math.round(Number(coords.lon) * 100) / 100).toFixed(2);
          target = `${url}?lat=${lat}&lon=${lon}`;
        }
        console.info(`[weather] GET ${target}${coords ? ' (browser coordinates)' : ' (server decides: IP lookup, else Mölndal)'}`);
        const res = await fetchFn(target, { headers: { Accept: 'application/json' } });
        if (!res || !res.ok) {
          console.warn(`[weather] ${target} answered HTTP ${res && res.status}. Is the game served by the Node server (npm start)? A static server has no /api. Falling back to clear sky.`);
          return { ...DEFAULT_WEATHER };
        }
        const body = await res.json();
        const parsed = parseWeather(body);
        console.info('[weather] server report:', body, '→ in game:', parsed);
        return parsed;
      } catch (e) {
        console.warn('[weather] request failed, falling back to clear sky:', e && e.message);
        return { ...DEFAULT_WEATHER };
      }
    }
  };
}
