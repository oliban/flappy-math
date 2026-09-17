// One mascot animal per multiplication table, with a small memory hook that
// ties the animal to the number (eight arms → 8×). The mascot is drawn with
// the roster's plainest character of that body type.
import { AVATARS } from './avatars.js';

// Prefer a hat-less character so the mascot reads as "the animal", not a costume
function plainCharacter(base) {
  const list = AVATARS.filter(a => a.base === base);
  const preferred = list.find(a => a.hat === 'none' || a.hat === undefined) || list[0];
  return preferred ? preferred.id : 'bird';
}

export const TABLE_MASCOTS = {
  1:  { base: 'mouse',   hook: { en: 'One tiny mouse',            sv: 'En liten mus' } },
  2:  { base: 'bird',    hook: { en: 'Two wings',                 sv: 'Två vingar' } },
  3:  { base: 'frog',    hook: { en: 'Hop, hop, hop!',            sv: 'Hopp, hopp, hopp!' } },
  4:  { base: 'dog',     hook: { en: 'Four paws',                 sv: 'Fyra tassar' } },
  5:  { base: 'star',    hook: { en: 'Five points',               sv: 'Fem uddar' } },
  6:  { base: 'bug',     hook: { en: 'Six legs',                  sv: 'Sex ben' } },
  7:  { base: 'rabbit',  hook: { en: 'Lucky number seven',        sv: 'Lyckotalet sju' } },
  8:  { base: 'octopus', hook: { en: 'Eight arms',                sv: 'Åtta armar' } },
  9:  { base: 'cat',     hook: { en: 'Nine lives',                sv: 'Nio liv' } },
  10: { base: 'robot',   hook: { en: 'Beep! 1 0 in robot talk',   sv: 'Pip! 1 0 på robotspråk' } },
  11: { base: 'penguin', hook: { en: 'Eleven in the football team', sv: 'Elva i fotbollslaget' } },
  12: { base: 'owl',     hook: { en: 'Awake till twelve at night', sv: 'Vaken till tolv på natten' } }
};

for (const mascot of Object.values(TABLE_MASCOTS)) {
  mascot.avatarId = plainCharacter(mascot.base);
}

export function getTableMascot(table) {
  return TABLE_MASCOTS[table] || TABLE_MASCOTS[1];
}
