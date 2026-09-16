import { describe, test, expect, beforeEach, vi } from 'vitest';

// Fresh module per test so the module-level language state starts clean
async function loadI18n(savedLanguage) {
  vi.resetModules();
  globalThis.localStorage = {
    getItem: (k) => (k === 'flappy-math-language' ? savedLanguage : null),
    setItem: () => {}
  };
  return import('./i18n.js');
}

describe('i18n defaults', () => {
  beforeEach(() => { vi.resetModules(); });

  test('Swedish is the default language', async () => {
    const i18n = await loadI18n(null);
    i18n.initLanguage();
    expect(i18n.getLanguage()).toBe('sv');
    expect(i18n.t('title')).toBe('Flappy Matte');
  });

  test('a saved language preference still wins', async () => {
    const i18n = await loadI18n('en');
    i18n.initLanguage();
    expect(i18n.getLanguage()).toBe('en');
  });

  test('missing Swedish keys fall back to English, then to the key', async () => {
    const i18n = await loadI18n(null);
    expect(i18n.t('no_such_key')).toBe('no_such_key');
  });
});
