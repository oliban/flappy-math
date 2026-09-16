import { describe, test, expect, beforeEach } from 'vitest';
import { createSkins, SKINS, DEFAULT_SKIN_ID } from './skins.js';

describe('Skins', () => {
  let skins;

  beforeEach(() => {
    skins = createSkins();
  });

  describe('catalog', () => {
    test('every skin has a unique id, a name and bird colors', () => {
      const ids = SKINS.map(s => s.id);
      expect(new Set(ids).size).toBe(SKINS.length);

      SKINS.forEach(skin => {
        expect(skin.name).toBeTruthy();
        expect(skin.colors).toMatchObject({
          bodyLight: expect.any(String),
          body: expect.any(String),
          bodyDark: expect.any(String),
          outline: expect.any(String),
          wing: expect.any(String),
          beak: expect.any(String),
          beakDark: expect.any(String)
        });
      });
    });

    test('there is more than one skin to unlock', () => {
      expect(SKINS.length).toBeGreaterThan(1);
    });
  });

  describe('starting state', () => {
    test('only the default skin is unlocked', () => {
      expect(skins.isUnlocked(DEFAULT_SKIN_ID)).toBe(true);
      expect(skins.getUnlocked()).toHaveLength(1);
      expect(skins.unlockedCount()).toBe(1);
    });

    test('the default skin is selected', () => {
      expect(skins.getSelectedId()).toBe(DEFAULT_SKIN_ID);
      expect(skins.getSelected().colors).toBeTruthy();
    });

    test('getAll reports lock state for each skin', () => {
      const all = skins.getAll();

      expect(all).toHaveLength(SKINS.length);
      expect(all[0].unlocked).toBe(true);
      expect(all[1].unlocked).toBe(false);
    });
  });

  describe('unlocking', () => {
    test('unlockNext unlocks skins in catalog order', () => {
      const unlocked = skins.unlockNext();

      expect(unlocked.id).toBe(SKINS[1].id);
      expect(skins.isUnlocked(SKINS[1].id)).toBe(true);
      expect(skins.unlockedCount()).toBe(2);
    });

    test('unlocking does not change the selected skin', () => {
      skins.unlockNext();

      expect(skins.getSelectedId()).toBe(DEFAULT_SKIN_ID);
    });

    test('returns null once everything is unlocked', () => {
      for (let i = 1; i < SKINS.length; i++) {
        expect(skins.unlockNext()).not.toBeNull();
      }

      expect(skins.unlockNext()).toBeNull();
      expect(skins.hasLockedSkins()).toBe(false);
    });

    test('hasLockedSkins is true while rewards remain', () => {
      expect(skins.hasLockedSkins()).toBe(true);
    });
  });

  describe('selection', () => {
    test('can select an unlocked skin', () => {
      skins.unlockNext();

      expect(skins.select(SKINS[1].id)).toBe(true);
      expect(skins.getSelectedId()).toBe(SKINS[1].id);
    });

    test('cannot select a locked skin', () => {
      expect(skins.select(SKINS[1].id)).toBe(false);
      expect(skins.getSelectedId()).toBe(DEFAULT_SKIN_ID);
    });

    test('cannot select an unknown skin', () => {
      expect(skins.select('does-not-exist')).toBe(false);
      expect(skins.getSelectedId()).toBe(DEFAULT_SKIN_ID);
    });
  });

  describe('persistence', () => {
    test('exports and re-imports unlocked skins and selection', () => {
      skins.unlockNext();
      skins.select(SKINS[1].id);

      const restored = createSkins();
      restored.import(skins.export());

      expect(restored.isUnlocked(SKINS[1].id)).toBe(true);
      expect(restored.getSelectedId()).toBe(SKINS[1].id);
    });

    test('ignores missing or malformed data', () => {
      skins.import(null);
      skins.import({ unlocked: 'nope', selected: 42 });

      expect(skins.unlockedCount()).toBe(1);
      expect(skins.getSelectedId()).toBe(DEFAULT_SKIN_ID);
    });

    test('drops unknown skin ids from saved data', () => {
      skins.import({ unlocked: [DEFAULT_SKIN_ID, 'ghost-bird'], selected: 'ghost-bird' });

      expect(skins.unlockedCount()).toBe(1);
      expect(skins.getSelectedId()).toBe(DEFAULT_SKIN_ID);
    });

    test('keeps the default skin unlocked even if saved data omits it', () => {
      skins.import({ unlocked: [], selected: null });

      expect(skins.isUnlocked(DEFAULT_SKIN_ID)).toBe(true);
    });

    test('falls back to the default when the saved selection is locked', () => {
      skins.import({ unlocked: [DEFAULT_SKIN_ID], selected: SKINS[1].id });

      expect(skins.getSelectedId()).toBe(DEFAULT_SKIN_ID);
    });
  });
});
