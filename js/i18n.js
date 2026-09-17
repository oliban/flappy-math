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

    // Daily table
    tableOfTheDay: 'Table of the day',
    everyonePlaysToday: 'Everyone plays the same table today',
    newTableIn: 'New table in',
    practice: 'Practice',
    practiceAnyTable: 'Practice any table',
    todaysTable: "Today's table",
    todayShort: 'today',

    // Highscores
    highscores: 'Highscores',
    localTab: 'My Best',
    globalTab: 'Global',
    allTables: 'All tables',
    noScoresYet: 'No scores yet - play a round!',
    loadingScores: 'Loading...',
    globalUnavailable: 'Global list unavailable',
    globalOffline: 'Could not reach the global list',
    back: 'Back',
    you: 'You',
    colRank: '#',
    colScore: 'Score',
    setName: 'Set name',
    changeName: 'Change name',
    nameTitle: 'Your name',
    nameHint: 'Shown on the global highscore list',
    save: 'Save',
    cancel: 'Cancel',
    globalRank: 'Global rank',
    sendingScore: 'Sending score...',
    nameNeeded: 'Add a name to join the global list',

    // Rewards
    newRecord: 'NEW RECORD!',
    personalBest: 'Personal best',
    previousBest: 'Previous best',
    yourBest: 'Your best',
    skinUnlocked: 'New bird unlocked!',
    birds: 'Birds',
    lockedBird: 'Beat your own record to unlock',

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

    // Daily table
    tableOfTheDay: 'Dagens tabell',
    everyonePlaysToday: 'Alla spelar samma tabell idag',
    newTableIn: 'Ny tabell om',
    practice: 'Träna',
    practiceAnyTable: 'Träna valfri tabell',
    todaysTable: 'Dagens tabell',
    todayShort: 'idag',

    // Highscores
    highscores: 'Topplista',
    localTab: 'Mina Bästa',
    globalTab: 'Global',
    allTables: 'Alla tabeller',
    noScoresYet: 'Inga poäng än - spela en runda!',
    loadingScores: 'Laddar...',
    globalUnavailable: 'Global lista otillgänglig',
    globalOffline: 'Kunde inte nå globala listan',
    back: 'Tillbaka',
    you: 'Du',
    colRank: '#',
    colScore: 'Poäng',
    setName: 'Ange namn',
    changeName: 'Byt namn',
    nameTitle: 'Ditt namn',
    nameHint: 'Visas på den globala topplistan',
    save: 'Spara',
    cancel: 'Avbryt',
    globalRank: 'Global placering',
    sendingScore: 'Skickar poäng...',
    nameNeeded: 'Ange ett namn för globala listan',

    // Rewards
    newRecord: 'NYTT REKORD!',
    personalBest: 'Personbästa',
    previousBest: 'Tidigare bästa',
    yourBest: 'Ditt bästa',
    skinUnlocked: 'Ny fågel upplåst!',
    birds: 'Fåglar',
    lockedBird: 'Slå ditt eget rekord för att låsa upp',

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
