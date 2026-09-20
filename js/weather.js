// Weather shown on the start page.
//
// The browser only ever talks to our own server, which does the fetching and
// caching. Nothing here asks for the player's location: the game shows Mölndal
// until the player opens the weather text and picks somewhere else.

import { LOCATION_KEY } from './storage.js';

export const DEFAULT_TIMEOUT = 6000;

// WMO weather codes, grouped the way a player would describe the sky.
const WEATHER_GROUPS = [
  { codes: [0], icon: '☀️', nightIcon: '🌙', key: 'weatherClear' },
  { codes: [1], icon: '🌤️', nightIcon: '🌙', key: 'weatherMostlyClear' },
  { codes: [2], icon: '⛅', key: 'weatherPartlyCloudy' },
  { codes: [3], icon: '☁️', key: 'weatherOvercast' },
  { codes: [45, 48], icon: '🌫️', key: 'weatherFog' },
  { codes: [51, 53, 55, 56, 57], icon: '🌦️', key: 'weatherDrizzle' },
  { codes: [61, 63, 65, 66, 67], icon: '🌧️', key: 'weatherRain' },
  { codes: [71, 73, 75, 77], icon: '🌨️', key: 'weatherSnow' },
  { codes: [80, 81, 82], icon: '🌦️', key: 'weatherShowers' },
  { codes: [85, 86], icon: '🌨️', key: 'weatherSnowShowers' },
  { codes: [95, 96, 99], icon: '⛈️', key: 'weatherThunder' }
];

export function describeWeather(code, isDay = true) {
  const group = WEATHER_GROUPS.find(entry => entry.codes.includes(Number(code)));
  if (!group) return { icon: '🌡️', key: 'weatherUnknown' };

  return {
    icon: !isDay && group.nightIcon ? group.nightIcon : group.icon,
    key: group.key
  };
}

function parsePlace(place) {
  if (!place || typeof place !== 'object') return null;

  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) return null;
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;

  return {
    name: typeof place.name === 'string' ? place.name.slice(0, 60) : '',
    country: typeof place.country === 'string' ? place.country.slice(0, 60) : '',
    region: typeof place.region === 'string' ? place.region.slice(0, 60) : '',
    latitude,
    longitude
  };
}

function parseReading(body) {
  const reading = body && body.weather;
  if (!reading || typeof reading !== 'object') return null;

  const temperature = Number(reading.temperature);
  if (!Number.isFinite(temperature)) return null;

  const location = parsePlace(reading.location) || { name: '', latitude: 0, longitude: 0 };

  return {
    temperature,
    code: Number(reading.code),
    windSpeed: Number(reading.windSpeed) || 0,
    isDay: reading.isDay !== false,
    location
  };
}

export function createWeatherClient({
  fetchFn = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  baseUrl = '/api',
  timeout = DEFAULT_TIMEOUT
} = {}) {
  async function request(path) {
    if (typeof fetchFn !== 'function') return { ok: false, error: 'unavailable' };

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;

    try {
      const response = await fetchFn(`${baseUrl}${path}`, {
        signal: controller ? controller.signal : undefined
      });

      if (!response || !response.ok) return { ok: false, error: 'unavailable' };

      return { ok: true, body: await response.json() };
    } catch (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'offline' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    // location is null for the default (Mölndal), handled entirely server-side.
    async fetchWeather(location = null) {
      const params = new URLSearchParams();
      if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
        params.set('lat', String(location.latitude));
        params.set('lon', String(location.longitude));
        if (location.name) params.set('name', location.name);
      }

      const query = params.toString();
      const result = await request(`/weather${query ? `?${query}` : ''}`);
      if (!result.ok) return { ok: false, error: result.error };

      const weather = parseReading(result.body);
      if (!weather) return { ok: false, error: 'unavailable' };

      return { ok: true, weather };
    },

    async searchPlaces(query) {
      const trimmed = typeof query === 'string' ? query.trim() : '';
      if (!trimmed) return { ok: false, error: 'invalid-query', places: [] };

      const result = await request(`/weather/search?q=${encodeURIComponent(trimmed)}`);
      if (!result.ok) return { ok: false, error: result.error, places: [] };

      const places = Array.isArray(result.body && result.body.places)
        ? result.body.places.map(parsePlace).filter(Boolean)
        : [];

      return { ok: true, places };
    }
  };
}

// Remembers a location the player picked. Null means "use the default".
export function createLocationStore(storage = window.localStorage) {
  return {
    load() {
      try {
        const raw = storage.getItem(LOCATION_KEY);
        if (!raw) return null;

        return parsePlace(JSON.parse(raw));
      } catch (e) {
        return null;
      }
    },

    save(location) {
      const place = parsePlace(location);
      if (!place) return false;

      try {
        storage.setItem(LOCATION_KEY, JSON.stringify(place));
      } catch (e) {
        console.warn('Failed to save location:', e);
      }
      return true;
    },

    clear() {
      try {
        storage.removeItem(LOCATION_KEY);
      } catch (e) {
        console.warn('Failed to clear location:', e);
      }
    }
  };
}
