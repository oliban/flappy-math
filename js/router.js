// Tiny URL router: lets people bookmark / share the highscore page.
// Supported: /#highscores, /#topplista, /highscores

export const HIGHSCORES_ROUTE = 'highscores';
export const GALLERY_ROUTE = 'gallery';

const ROUTES = [
  { route: HIGHSCORES_ROUTE, aliases: ['highscores', 'highscore', 'topplista'] },
  { route: GALLERY_ROUTE, aliases: ['gallery', 'galleri', 'characters'] }
];

export function routeFromLocation({ pathname = '/', hash = '' } = {}) {
  const fromHash = hash.replace(/^#\/?/, '').toLowerCase();
  const fromPath = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  for (const { route, aliases } of ROUTES) {
    if (aliases.includes(fromHash) || aliases.includes(fromPath)) return route;
  }
  return null;
}
