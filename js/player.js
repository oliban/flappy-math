import { AVATARS, DEFAULT_AVATAR_ID } from './avatars.js';

const PLAYER_STORAGE_KEY = 'flappy-math-player';
export const MAX_NAME_LENGTH = 12;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

// Strips control characters, collapses whitespace and trims to a safe length.
// Shared with the leaderboard server, so names are cleaned the same way everywhere.
export function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
}

export function createPlayerProfile(storage = window.localStorage) {
  let name = '';
  let avatarId = DEFAULT_AVATAR_ID;

  function load() {
    try {
      const raw = storage.getItem(PLAYER_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.name === 'string') name = data.name;
      if (AVATARS.some(a => a.id === data.avatar)) avatarId = data.avatar;
    } catch (e) {
      console.warn('Failed to load player profile:', e);
    }
  }

  function save() {
    try {
      storage.setItem(PLAYER_STORAGE_KEY, JSON.stringify({ name, avatar: avatarId }));
    } catch (e) {
      console.warn('Failed to save player profile:', e);
    }
  }

  load();

  return {
    getName() { return name; },
    hasName() { return name.length > 0; },
    setName(value) {
      name = sanitizeName(String(value ?? ''));
      save();
    },
    getAvatarId() { return avatarId; },
    setAvatar(id) {
      if (AVATARS.some(a => a.id === id)) {
        avatarId = id;
        save();
      }
    }
  };
}
