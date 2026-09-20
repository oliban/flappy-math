export const PROGRESS_KEY = 'flappy-math-progress';
export const HIGHSCORES_KEY = 'flappy-math-highscores';
export const SKINS_KEY = 'flappy-math-skins';
export const LOCATION_KEY = 'flappy-math-location';

// One factory per stored document - pass the key of the document to persist.
export function createStorage(localStorage = window.localStorage, storageKey = PROGRESS_KEY) {
  return {
    save(data) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (e) {
        console.warn(`Failed to save ${storageKey}:`, e);
      }
    },

    load() {
      try {
        const data = localStorage.getItem(storageKey);
        if (!data) return null;
        return JSON.parse(data);
      } catch (e) {
        console.warn(`Failed to load ${storageKey}:`, e);
        return null;
      }
    }
  };
}
