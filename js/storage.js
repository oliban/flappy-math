const STORAGE_KEY = 'flappy-math-progress';

export function createStorage(localStorage = window.localStorage) {
  return {
    save(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to save progress:', e);
      }
    },

    load() {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return null;
        return JSON.parse(data);
      } catch (e) {
        console.warn('Failed to load progress:', e);
        return null;
      }
    }
  };
}
