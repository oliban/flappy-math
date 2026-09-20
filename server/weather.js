// Weather for the start page.
//
// The server does the fetching: the browser never talks to the weather
// provider, is never asked for its location, and a shared cache means one
// upstream call serves every player looking at the same place.

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

// Where the game looks by default. No prompting, no geolocation.
export const DEFAULT_LOCATION = Object.freeze({
  name: 'Mölndal',
  latitude: 57.6554,
  longitude: 12.0134
});

export const DEFAULT_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;
const MAX_QUERY_LENGTH = 60;
const MAX_PLACES = 8;
const MAX_WMO_CODE = 99;

function isLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function parseCurrentWeather(body) {
  const current = body && body.current;
  if (!current || typeof current !== 'object') return null;

  const temperature = Number(current.temperature_2m);
  const code = Number(current.weather_code);
  const windSpeed = Number(current.wind_speed_10m);

  if (!Number.isFinite(temperature)) return null;
  if (!Number.isFinite(code) || code < 0 || code > MAX_WMO_CODE) return null;

  return {
    temperature: Math.round(temperature * 10) / 10,
    code: Math.round(code),
    windSpeed: Number.isFinite(windSpeed) ? Math.round(windSpeed * 10) / 10 : 0,
    isDay: current.is_day === undefined ? true : Boolean(Number(current.is_day))
  };
}

export function parsePlaces(body) {
  const results = body && Array.isArray(body.results) ? body.results : [];

  return results
    .map(place => {
      if (!place || typeof place !== 'object') return null;

      const latitude = Number(place.latitude);
      const longitude = Number(place.longitude);
      const name = typeof place.name === 'string' ? place.name.trim().slice(0, 60) : '';

      if (!name || !isLatitude(latitude) || !isLongitude(longitude)) return null;

      return {
        name,
        country: typeof place.country === 'string' ? place.country.slice(0, 60) : '',
        region: typeof place.admin1 === 'string' ? place.admin1.slice(0, 60) : '',
        latitude,
        longitude
      };
    })
    .filter(Boolean)
    .slice(0, MAX_PLACES);
}

// Cache key: coordinates rounded to ~1km, so nearby players share one entry.
function cacheKey(latitude, longitude) {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

export function createWeatherService({
  fetchFn = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  weatherUrl = OPEN_METEO_FORECAST,
  geocodingUrl = OPEN_METEO_GEOCODING,
  ttlMs = DEFAULT_TTL_MS,
  timeoutMs = REQUEST_TIMEOUT_MS,
  now = () => Date.now()
} = {}) {
  const cache = new Map();   // key -> { weather, fetchedAt }
  const inFlight = new Map(); // key -> Promise, so bursts share one upstream call

  async function fetchJson(url) {
    if (typeof fetchFn !== 'function') return { ok: false, error: 'unavailable' };

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await fetchFn(url, { signal: controller ? controller.signal : undefined });
      if (!response || !response.ok) return { ok: false, error: 'upstream' };

      return { ok: true, body: await response.json() };
    } catch (e) {
      return { ok: false, error: 'upstream' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchWeather(location) {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,weather_code,wind_speed_10m,is_day',
      timezone: 'auto'
    });

    const result = await fetchJson(`${weatherUrl}?${params.toString()}`);
    if (!result.ok) return { ok: false, error: result.error };

    const weather = parseCurrentWeather(result.body);
    if (!weather) return { ok: false, error: 'upstream' };

    return { ok: true, weather: { ...weather, location } };
  }

  return {
    async getWeather(requested = {}) {
      const latitude = Number(requested.latitude);
      const longitude = Number(requested.longitude);
      const useRequested = isLatitude(latitude) && isLongitude(longitude);

      const location = useRequested
        ? {
            name: typeof requested.name === 'string' && requested.name.trim()
              ? requested.name.trim().slice(0, 60)
              : `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
            latitude,
            longitude
          }
        : { ...DEFAULT_LOCATION };

      const key = cacheKey(location.latitude, location.longitude);
      const cached = cache.get(key);

      if (cached && now() - cached.fetchedAt < ttlMs) {
        return { ok: true, weather: cached.weather, cached: true };
      }

      if (!inFlight.has(key)) {
        inFlight.set(key, fetchWeather(location).finally(() => inFlight.delete(key)));
      }

      const result = await inFlight.get(key);

      if (result.ok) {
        cache.set(key, { weather: result.weather, fetchedAt: now() });
        return { ok: true, weather: result.weather, cached: false };
      }

      // Upstream is unhappy: a slightly old reading beats no reading at all.
      if (cached) {
        return { ok: true, weather: cached.weather, cached: true, stale: true };
      }

      return { ok: false, error: result.error || 'upstream' };
    },

    async searchPlaces(query) {
      const trimmed = typeof query === 'string' ? query.trim().slice(0, MAX_QUERY_LENGTH) : '';
      if (!trimmed) return { ok: false, error: 'invalid-query' };

      const params = new URLSearchParams({
        name: trimmed,
        count: String(MAX_PLACES),
        format: 'json'
      });

      const result = await fetchJson(`${geocodingUrl}?${params.toString()}`);
      if (!result.ok) return { ok: false, error: result.error };

      return { ok: true, places: parsePlaces(result.body) };
    },

    // Exposed for tests and for a future admin/debug view.
    cacheSize() {
      return cache.size;
    }
  };
}
