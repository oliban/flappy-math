# Flappy Math

A Flappy Bird-style game for practicing multiplication tables. Fly through pipes by choosing the correct answer to math problems.

## How to Play

**Table of the day:** the game picks one table (1x-12x) per calendar day and
shows it on the start page. It is derived from the date, so it is the same for
everyone that day and does not reroll when you reload; a new one arrives at
local midnight. To drill a specific table, use **Practice** on the start page.

**Controls:**
- Press **Space** or **Click** to flap and fly upward
- Use **Arrow keys** or **Number keys** to select a table (1-12) and the speed level in practice mode
- Press **Escape** to return to menu
- Press **H** (or the 🏆 button) to open the highscore lists

**Objective:**
- Each pipe has 3 gaps with different answer options
- Fly through the gap showing the correct answer to the displayed multiplication problem
- Get 10 correct answers in a row to master a table at the current speed level
- Avoid hitting pipes or choosing wrong answers (costs a life)
- You have 3 lives per game

## Highscores

Every table has its own list. The screen opens on the table you just played and
the arrows step through all tables plus an **All tables** view. Two lists,
reachable from the menu or the game over screen:

- **My Best (local)** - your own runs, stored in LocalStorage, with a personal
  best kept per times table. Beating your own record is what earns rewards.
- **Global** - a shared list served by this app's API, so you can compare with
  friends. It keeps one (best) run per player per table. Set a name from the
  highscore screen to appear on it; without a name you still get the full local
  list. If the server cannot be reached, the global tab says so and the rest of
  the game carries on.

**Reward:** every time you beat your own personal best for a table, a fanfare
plays, confetti fires across the game over screen, and the next bird skin
unlocks and is equipped right away. There are nine birds to collect.

## Features

- A new table of the day, every day, the same for every player
- Practice mode for drilling any table
- Multiplication tables 1x through 12x
- Adjustable speed levels (1-99)
- Progress tracking with best speed saved per table
- Mastery system: 10 correct in a row unlocks higher speeds
- Local and global highscore lists
- Fanfare and confetti when you beat your own record
- Unlockable bird skins as a reward for beating your own scores
- Multi-language support (English, Swedish)
- LocalStorage persistence for progress
- Smooth bird physics with gravity and flap mechanics

## Setup

```bash
# Install dependencies (dev only - the server itself has no dependencies)
npm install

# Start the game and the highscore API
npm start
```

Then open `http://localhost:8080` in your browser. Global scores are written to
`./data/scores.json` (override with `DATA_DIR`), and the port with `PORT`.

`npx serve .` still works for pure front-end work, but the global list will be
unavailable because there is no API behind it.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/scores?table=<2-12>&limit=<1-50>` | Top global scores, optionally for one table |
| `POST` | `/api/scores` | Submit `{ name, score, table, speed, streak }`; responds with the rank |
| `GET`  | `/api/health` | Liveness check |

Submissions are validated and rate limited (20/minute per IP), dates are
assigned server-side, and each table keeps its best 50 entries.

## Deployment

The Fly app serves the game and the API from one Node process. The leaderboard
lives on a volume, so create it once before the first deploy:

```bash
fly volumes create flappy_data --size 1
fly deploy
```

## Testing

```bash
# Run tests in watch mode
npm test

# Run tests once
npm test -- --run
```

## Tech Stack

- HTML5 Canvas
- Vanilla JavaScript (ES Modules)
- Vitest for testing
- No build step required
