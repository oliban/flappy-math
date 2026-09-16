const HIGHSCORE_STORAGE_KEY = 'flappy-math-highscores';
export const MAX_ENTRIES = 10;

export function createHighscores(storage = window.localStorage) {
  let entries = [];

  function load() {
    try {
      const raw = storage.getItem(HIGHSCORE_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      entries = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to load highscores:', e);
      entries = [];
    }
  }

  function save() {
    try {
      storage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('Failed to save highscores:', e);
    }
  }

  load();

  return {
    list() {
      return entries.map(e => ({ ...e }));
    },

    // Returns the 1-based rank of the new entry, or null if it did not place.
    add(entry) {
      if (!entry || !(entry.score > 0)) return null;

      const record = { ...entry, date: new Date().toISOString() };
      // Insert after all entries with score >= new score (earlier wins ties)
      let index = entries.findIndex(e => e.score < record.score);
      if (index === -1) index = entries.length;
      if (index >= MAX_ENTRIES) return null;

      entries.splice(index, 0, record);
      entries = entries.slice(0, MAX_ENTRIES);
      save();
      return index + 1;
    }
  };
}

export function formatEntryDate(iso, locale = undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
