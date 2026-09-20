// Current weather via Open-Meteo (free, no API key).
// Location is Mölndal unless the player has opted in and the browser sent
// coordinates (rounded to ~1 km). The player is never located behind their
// back - no IP lookup, no prompt.
// Everything is cached in memory so upstreams are hit at most every TTL.

export const MOLNDAL = { latitude: 57.6554, longitude: 12.0134, name: 'Mölndal' };
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const GEO_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_KEYS = 2000;

// WMO weather interpretation codes → the handful of conditions the game can draw
export function conditionFromWmo(code) {
  const c = Number(code);
  if (c === 0 || c === 1) return 'clear';
  if (c === 2) return 'clouds';
  if (c === 3) return 'overcast';
  if (c === 45 || c === 48) return 'fog';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95 && c <= 99) return 'thunder';
  return 'clouds';
}

export function roundCoord(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function validCoords(lat, lon) {
  if (lat === null || lat === undefined || lat === '' || lon === null || lon === undefined || lon === '') return false;
  const la = Number(lat);
  const lo = Number(lon);
  return Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
}

function boundedSet(map, key, value) {
  if (map.size >= MAX_CACHE_KEYS) map.delete(map.keys().next().value);
  map.set(key, value);
}

export function createWeatherService({
  fetchFn = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  now = () => Date.now(),
  ttlMs = DEFAULT_TTL_MS,
  fallback = MOLNDAL
} = {}) {
  const weatherCache = new Map();  // coordKey -> { report, fetchedAt, inflight }
  const nameCache = new Map();     // coordKey -> { name, at }

  const headers = { headers: { Accept: 'application/json', 'User-Agent': 'flappy-math/1.0' } };

  async function getJson(url) {
    const res = await fetchFn(url, headers);
    if (!res || !res.ok) throw new Error(`HTTP ${res && res.status} for ${url}`);
    return res.json();
  }

  async function placeName(lat, lon) {
    const key = `${lat},${lon}`;
    const cached = nameCache.get(key);
    if (cached && now() - cached.at < GEO_TTL_MS) return cached.name;
    let name = null;
    try {
      const body = await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sv`);
      name = (body && (body.city || body.locality || body.principalSubdivision)) || null;
      if (typeof name !== 'string' || !name) name = null;
    } catch (e) {
      name = null;
    }
    boundedSet(nameCache, key, { name, at: now() });
    return name;
  }

  function emptyReport(place) {
    return { condition: 'clear', temperature: null, windSpeed: 0, isDay: true, place, stale: true, fetchedAt: null };
  }

  async function fetchWeather(location) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto`;
    const body = await getJson(url);
    const cur = body && body.current;
    if (!cur) throw new Error('weather upstream: no current block');
    const t = Number(cur.temperature_2m);
    const wind = Number(cur.wind_speed_10m);
    return {
      condition: conditionFromWmo(cur.weather_code),
      temperature: Number.isFinite(t) ? Math.round(t) : null,
      windSpeed: Number.isFinite(wind) ? Math.round(wind) : 0,
      isDay: cur.is_day === 1 || cur.is_day === true,
      place: location.name,
      stale: false,
      fetchedAt: new Date(now()).toISOString()
    };
  }

  // Coordinates only ever arrive because the player asked for their own weather.
  async function resolveLocation({ lat, lon }) {
    if (!validCoords(lat, lon)) return { ...fallback };

    const latitude = roundCoord(lat);
    const longitude = roundCoord(lon);
    const name = (await placeName(latitude, longitude)) || fallback.name;
    return { latitude, longitude, name };
  }

  return {
    async get({ lat, lon } = {}) {
      const location = await resolveLocation({ lat, lon });
      const key = `${location.latitude},${location.longitude}`;
      let entry = weatherCache.get(key);
      if (entry && entry.report && now() - entry.fetchedAt <= ttlMs) return { ...entry.report, place: location.name };
      if (!fetchFn) return entry && entry.report ? { ...entry.report, place: location.name, stale: true } : emptyReport(location.name);
      if (!entry) { entry = { report: null, fetchedAt: -Infinity, inflight: null }; boundedSet(weatherCache, key, entry); }
      if (!entry.inflight) {
        entry.inflight = fetchWeather(location)
          .then(report => { entry.report = report; entry.fetchedAt = now(); return report; })
          .catch(() => {
            entry.fetchedAt = now(); // back off a full TTL before retrying a failing upstream
            return entry.report ? { ...entry.report, stale: true } : emptyReport(location.name);
          })
          .finally(() => { entry.inflight = null; });
      }
      const report = await entry.inflight;
      return { ...report, place: location.name };
    }
  };
}
