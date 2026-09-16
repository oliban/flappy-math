export const STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver',
  HIGHSCORES: 'highscores'
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

    showHighscores() {
      if (currentState === STATES.MENU || currentState === STATES.GAME_OVER) {
        currentState = STATES.HIGHSCORES;
      }
    },

    returnToMenu() {
      if (currentState !== STATES.MENU) {
        currentState = STATES.MENU;
      }
    }
  };
}
