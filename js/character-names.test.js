import { describe, test, expect } from 'vitest';
import { characterName, translateGeneratedName } from './character-names.js';
import { AVATARS, getAvatar } from './avatars.js';

describe('generated name translation', () => {
  test('title + first name', () => {
    expect(translateGeneratedName('Captain Bubbles', 'sv')).toBe('Kapten Bubbles');
    expect(translateGeneratedName('Princess Gizmo Starwhisker', 'sv')).toBe('Prinsessan Gizmo Stjärnmorrhår');
  });

  test('first name + species', () => {
    expect(translateGeneratedName('Pixel the Bird', 'sv')).toBe('Pixel Fågeln');
    expect(translateGeneratedName('Noodle the Star', 'sv')).toBe('Noodle Stjärnan');
  });

  test('first name + adjective + species uses the definite adjective form', () => {
    expect(translateGeneratedName('Pinto the Cosmic Cat', 'sv')).toBe('Pinto den kosmiska Katten');
    expect(translateGeneratedName('Ginger the Clever Fox', 'sv')).toBe('Ginger den kluriga Räven');
  });

  test('first name + surname translates the compound surname', () => {
    expect(translateGeneratedName('Frosty Starwhisker', 'sv')).toBe('Frosty Stjärnmorrhår');
    expect(translateGeneratedName('Wild Otto Twinklefoot', 'sv')).toBe('Vilda Otto Blinkfot');
  });

  test('english is returned unchanged', () => {
    expect(translateGeneratedName('Pinto the Cosmic Cat', 'en')).toBe('Pinto the Cosmic Cat');
  });
});

describe('characterName across the whole roster', () => {
  test('every character has a Swedish name with no English glue words left', () => {
    for (const a of AVATARS) {
      const sv = characterName(a, 'sv');
      expect(sv.length, a.id).toBeGreaterThan(1);
      expect(sv, a.id).not.toMatch(/\bthe\b/);
      expect(sv, a.id).not.toMatch(/\b(King|Queen|Prince|Princess|Dame|Wizard|Mage|Captain|Admiral|Chef|Baker|Commander|Chief|Mister|Lady|Shadow|Angel|Saint|Little|Wild)\b/);
    }
  });

  test('swedish names are unique across the roster', () => {
    const names = new Set(AVATARS.map(a => characterName(a, 'sv')));
    expect(names.size).toBe(AVATARS.length);
  });

  test('starters use the translated animal names and heroes have hand-written names', () => {
    expect(characterName(getAvatar('fox'), 'sv')).toBe('Räv');
    expect(characterName(getAvatar('fox'), 'en')).toBe('Fox');
    const hero = AVATARS.find(a => a.set === 'retro-heroes');
    expect(characterName(hero, 'sv')).not.toBe(hero.name);
  });

  test('english names are the roster names', () => {
    for (const a of AVATARS.slice(8, 20)) expect(characterName(a, 'en')).toBe(a.name);
  });
});
