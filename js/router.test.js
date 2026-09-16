import { describe, test, expect } from 'vitest';
import { routeFromLocation, HIGHSCORES_ROUTE, GALLERY_ROUTE } from './router.js';

describe('router', () => {
  test('hash #highscores opens the highscore page', () => {
    expect(routeFromLocation({ pathname: '/', hash: '#highscores' })).toBe(HIGHSCORES_ROUTE);
  });

  test('path /highscores opens the highscore page', () => {
    expect(routeFromLocation({ pathname: '/highscores', hash: '' })).toBe(HIGHSCORES_ROUTE);
    expect(routeFromLocation({ pathname: '/highscores/', hash: '' })).toBe(HIGHSCORES_ROUTE);
  });

  test('swedish alias #topplista also works', () => {
    expect(routeFromLocation({ pathname: '/', hash: '#topplista' })).toBe(HIGHSCORES_ROUTE);
  });

  test('is case-insensitive', () => {
    expect(routeFromLocation({ pathname: '/', hash: '#HighScores' })).toBe(HIGHSCORES_ROUTE);
  });

  test('anything else is the default route', () => {
    expect(routeFromLocation({ pathname: '/', hash: '' })).toBeNull();
    expect(routeFromLocation({ pathname: '/', hash: '#foo' })).toBeNull();
  });
});

describe('gallery route', () => {
  test('#gallery opens the secret gallery', () => {
    expect(routeFromLocation({ pathname: '/', hash: '#gallery' })).toBe(GALLERY_ROUTE);
    expect(routeFromLocation({ pathname: '/gallery', hash: '' })).toBe(GALLERY_ROUTE);
    expect(routeFromLocation({ pathname: '/', hash: '#galleri' })).toBe(GALLERY_ROUTE);
  });
});
