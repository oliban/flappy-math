// Localized character names. English names are generated from word lists in
// avatars.js, so Swedish is produced by translating the parts: titles,
// adjectives (definite form), species (definite form) and compound surnames.
// The 41 retro heroes and the 8 starters have hand-written Swedish names.
import { t } from './i18n.js';

const TITLES_SV = {
  King: 'Kung', Queen: 'Drottning', Prince: 'Prins', Princess: 'Prinsessan',
  Sir: 'Sir', Dame: 'Dam', Wizard: 'Trollkarlen', Mage: 'Magikern',
  Captain: 'Kapten', Admiral: 'Amiral', Chef: 'Kocken', Baker: 'Bagaren',
  Astro: 'Astro', Commander: 'Kommendör', Major: 'Major', Chief: 'Hövding', Viking: 'Viking',
  Mister: 'Herr', Lady: 'Fru', Baron: 'Baron', Ninja: 'Ninja', Shadow: 'Skuggan',
  Angel: 'Ängeln', Saint: 'Sankt', Super: 'Super', Mighty: 'Mäktiga', Little: 'Lilla', Wild: 'Vilda',
  DJ: 'DJ', Pilot: 'Pilot', Party: 'Party'
};

const ADJECTIVES_SV = {
  Brave: 'tappra', Sleepy: 'sömniga', Speedy: 'snabba', Mighty: 'mäktiga', Jolly: 'glada', Tiny: 'pyttelilla',
  Clever: 'kluriga', Fluffy: 'fluffiga', Bouncy: 'studsiga', Sneaky: 'smygande', Sparkly: 'glittriga',
  Grumpy: 'sura', Cheeky: 'fräcka', Gentle: 'snälla', Wild: 'vilda', Lucky: 'lyckliga', Dizzy: 'yra', Cosmic: 'kosmiska'
};

const SPECIES_SV = {
  Bird: 'Fågeln', Cat: 'Katten', Frog: 'Grodan', Penguin: 'Pingvinen', Owl: 'Ugglan', Fox: 'Räven',
  Bear: 'Björnen', Bunny: 'Kaninen', Pup: 'Valpen', Mouse: 'Musen', Piggy: 'Grisen', Fish: 'Fisken',
  Octopus: 'Bläckfisken', Ghost: 'Spöket', Robot: 'Roboten', Slime: 'Slemmet', Dragon: 'Draken',
  Bee: 'Biet', Cactus: 'Kaktusen', Star: 'Stjärnan'
};

const SURNAMES_SV = {
  Frostpaw: 'Frosttass', Whiskerton: 'Morrhårsson', Bumblebottom: 'Humlebak', Puddlejump: 'Pölhopp',
  Sparkletail: 'Glittersvans', Thunderhoof: 'Dunderhov', Mossyfoot: 'Mossfot', Jellybean: 'Gelébönan',
  Snugglesworth: 'Kramgo', Featherfluff: 'Fjäderdun', Brightwing: 'Ljusvinge', Stormbeard: 'Stormskägg',
  Goldscale: 'Guldfjäll', Quickfin: 'Snabbfena', Mooncheek: 'Månkind', Honeydew: 'Honungsdagg',
  Cloudhopper: 'Molnhoppare', Starwhisker: 'Stjärnmorrhår', Pebblenose: 'Stennos', Wigglesby: 'Vickeby',
  Bubblefin: 'Bubbelfena', Tinkerbolt: 'Mecklaskruv', Fizzlepop: 'Pyspoff', Sugarplum: 'Sockerplommon',
  Rainbowtail: 'Regnbågssvans', Marshmallow: 'Marshmallow', Dewdrop: 'Daggdroppe', Twinklefoot: 'Blinkfot',
  Copperclaw: 'Kopparklo', Silverbeak: 'Silvernäbb', Velvetpaw: 'Sammetstass', Snowdrift: 'Snödriva',
  Sunbeam: 'Solstråle', Cinnamon: 'Kanel', Peppercorn: 'Pepparkorn', Glimmerhorn: 'Glimmerhorn',
  Wobblekins: 'Vinglis', Dandelion: 'Maskros', Buttercup: 'Smörblomma', Nightsky: 'Natthimmel'
};

const HERO_NAMES_SV = {
  'Gus Fixit': 'Gösta Fixare', 'Wanda Wrenchly': 'Wanda Skiftnyckel', 'Fern Quiverleaf': 'Fern Kogerblad',
  'Zapper Volt': 'Zappe Volt', 'Puffle Plum': 'Puffe Plommon', 'Mango Chestthump': 'Mango Bröstdunk',
  'Princess Petunia Pufftail': 'Prinsessan Petunia Pufsvans', 'Grumbleshell': 'Mullerskal', 'Morel Capwell': 'Murkel Hattson',
  'Ace Emberpaw': 'Ess Glödtass', 'Vega Starhunter': 'Vega Stjärnjägare', 'Mint Munchasaurus': 'Mint Mumsosaurus',
  'Giggles Sheetwick': 'Fnitter Lakansson', 'Bashful Peekwick': 'Blyga Tittut', 'Tundra Mallory': 'Tundra Klubbis',
  'Rocco Jabsworth': 'Rocco Jabbsson', 'Turbo Trotter': 'Turbo Travare', 'Twinkle Dewwing': 'Blinka Daggvinge',
  'Sir Waddleston': 'Sir Vaggelsson', 'Bolt Beepsworth': 'Bult Pipsson', 'Lumen Moonwhisker': 'Lumen Månmorrhår',
  'Ricochet Rex': 'Rikoschett Rex', 'Dash Quillfoot': 'Dash Fjäderfot', 'Sparkwing Ember': 'Gnistvinge Glöd',
  'Captain Wispbeard': 'Kapten Dimskägg', 'Commander Bruin': 'Kommendör Nalle', 'Kunai Purrsley': 'Kunai Spinnsson',
  'Chef Flapjack': 'Kocken Pannkaka', 'Bjorn Frostmane': 'Björn Frostman', 'Master Squeakwan': 'Mästare Pipwan',
  'Digger Boondock': 'Grävar-Bo', 'Porkchop Skyrider': 'Kotletta Skyryttare', 'Prickles Von Spike': 'Taggis von Tagg',
  'Gloop Xandar': 'Gloop Xandar', 'Queen Buzzabella': 'Drottning Surrabella', 'Sage Hootspell': 'Visa Hoatroll',
  'DJ Inkwell': 'DJ Bläckhorn', 'Captain Twinkleton': 'Kapten Blinkelsson', 'Sparrow Hoodwink': 'Sparv Huvlur',
  'Piston Punchbot': 'Kolv Slagbot', 'Rexley Vroom': 'Rexley Vrom'
};

// Translates a generated English name ("Pinto the Cosmic Cat") into Swedish.
export function translateGeneratedName(name, lang) {
  if (lang !== 'sv') return name;
  const words = name.split(' ');
  const out = [];
  if (TITLES_SV[words[0]] && words.length > 1) out.push(TITLES_SV[words.shift()]);
  const theIndex = words.indexOf('the');
  if (theIndex >= 0) {
    const first = words.slice(0, theIndex).join(' ');
    const rest = words.slice(theIndex + 1);           // [Adj?, Species]
    const species = rest[rest.length - 1];
    const adj = rest.length > 1 ? rest[0] : null;
    out.push(first);
    if (adj) out.push('den', ADJECTIVES_SV[adj] || adj.toLowerCase());
    out.push(SPECIES_SV[species] || species);
  } else {
    out.push(...words.map(w => SURNAMES_SV[w] || w));
  }
  return out.join(' ');
}

export function characterName(avatar, lang) {
  if (!avatar) return '';
  if (lang !== 'sv') return avatar.name;
  const starterKey = `avatar_${avatar.id}`;
  const starter = t(starterKey);
  if (starter !== starterKey) return starter;
  if (HERO_NAMES_SV[avatar.name]) return HERO_NAMES_SV[avatar.name];
  return translateGeneratedName(avatar.name, 'sv');
}
