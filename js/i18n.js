// Internationalization / Translations

const translations = {
  en: {
    // Menu
    title: 'Flappy Math',
    subtitle: 'Master your times tables!',
    selectTable: 'Select Times Table',
    speedLevel: 'Speed Level',
    startGame: 'Start Game',
    pressToStart: 'Press SPACE or click to start',
    best: 'Best',

    // HUD
    table: 'Table',
    speed: 'Speed',
    streak: 'Streak',
    lives: 'Lives',

    // Game Over
    gameOver: 'Game Over',
    finalScore: 'Final Score',
    bestStreak: 'Best Streak',
    pressToContinue: 'SPACE to continue',

    // Mastery
    mastered: 'MASTERED!',
    tableAt: 'table',
    speedLevelAt: 'Speed Level',
    correctInRow: '10 correct answers in a row!',

    // Language
    language: 'Language',
  },

  sv: {
    // Menu
    title: 'Flappy Matte',
    subtitle: 'Bli mästare på multiplikation!',
    selectTable: 'Välj Multiplikationstabell',
    speedLevel: 'Hastighetsnivå',
    startGame: 'Starta Spel',
    pressToStart: 'Tryck MELLANSLAG eller klicka för att starta',
    best: 'Bäst',

    // HUD
    table: 'Tabell',
    speed: 'Hastighet',
    streak: 'Svit',
    lives: 'Liv',

    // Game Over
    gameOver: 'Spelet Slut',
    finalScore: 'Slutpoäng',
    bestStreak: 'Bästa Svit',
    pressToContinue: 'MELLANSLAG för att fortsätta',

    // Mastery
    mastered: 'BEMÄSTRAD!',
    tableAt: 'tabell',
    speedLevelAt: 'Hastighetsnivå',
    correctInRow: '10 rätt svar i rad!',

    // Language
    language: 'Språk',
  }
};

let currentLanguage = 'en';

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('flappy-math-language', lang);
  }
}

export function getLanguage() {
  return currentLanguage;
}

export function t(key) {
  return translations[currentLanguage][key] || translations.en[key] || key;
}

export function getAvailableLanguages() {
  return [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'sv', name: 'Svenska', flag: '🇸🇪' }
  ];
}

// Load saved language preference
export function initLanguage() {
  const saved = localStorage.getItem('flappy-math-language');
  if (saved && translations[saved]) {
    currentLanguage = saved;
  }
}
