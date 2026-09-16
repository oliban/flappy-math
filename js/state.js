export const STATES = {
  MENU: 'menu',
  PROFILE: 'profile',
  HIGHSCORES: 'highscores',
  GALLERY: 'gallery',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver'
};

export function createGameState() {
  let currentState = STATES.MENU;

  return {
    current() {
      return currentState;
    },

    startGame() {
      if (currentState === STATES.MENU) {
        currentState = STATES.PLAYING;
      }
    },

    endGame() {
      if (currentState === STATES.PLAYING) {
        currentState = STATES.GAME_OVER;
      }
    },

    openProfile() {
      if (currentState === STATES.MENU) {
        currentState = STATES.PROFILE;
      }
    },

    openHighscores() {
      if (currentState === STATES.MENU || currentState === STATES.GAME_OVER) {
        currentState = STATES.HIGHSCORES;
      }
    },

    openGallery() {
      if (currentState === STATES.MENU) {
        currentState = STATES.GALLERY;
      }
    },

    returnToMenu() {
      if (currentState !== STATES.MENU) {
        currentState = STATES.MENU;
      }
    }
  };
}
