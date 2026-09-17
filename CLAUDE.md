# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies (dev only)
npm start            # Run the game + highscore API (http://localhost:8080)
npx serve .          # Static-only dev server (global highscores unavailable)
npm test             # Run tests (watch mode)
npm test -- --run    # Run tests once
```

## Architecture

Flappy Math is an HTML5 Canvas game for practicing multiplication tables.

**Core Loop:** Bird flies right, pipes have 3 answer gaps, player flies through correct answer.

**Key Modules:**
- `js/game.js` - Main loop, orchestrates updates and rendering
- `js/state.js` - Game state machine (menu → playing → gameOver, plus highscores)
- `js/bird.js` - Bird physics (gravity, flap)
- `js/pipe.js` - Pipes with 3 answer gaps
- `js/math.js` - Problem generation (correct + plausible wrong answers)
- `js/collision.js` - Bird vs gap/pipe detection
- `js/scoring.js` - Score, streak, lives
- `js/progress.js` - Mastery tracking per table/speed
- `js/storage.js` - LocalStorage persistence (one factory per stored document)
- `js/highscores.js` - Local highscore list and personal bests per table
- `js/skins.js` - Bird skins, unlocked by beating a personal best
- `js/confetti.js` - Confetti particles for the new-record celebration
- `js/dailyTable.js` - Date-seeded table of the day (deterministic, shared)
- `js/globalScores.js` - Client for the shared leaderboard API
- `js/player.js` - Player name used on the global list
- `server/server.js` - Static file + API server (Node stdlib only)
- `server/scores.js` - Global leaderboard store: validation, ranking, capping
- `server/rateLimit.js` - Per-IP submission limiting

**Highscores:**
- One list per table (plus an all-tables view); the local list (LocalStorage)
  holds the top 20 runs and a personal best per table
- Beating a local personal best plays `sounds/fanfare.wav`, fires confetti and
  unlocks the next bird skin - the only reward path
- Global list lives on the server (`DATA_DIR/scores.json`), one best run per
  player per table, and degrades to an "unavailable" message when offline

**Daily Table:**
- The main mode plays the table of the day, seeded from the local calendar date
  so every player gets the same table and a reload cannot reroll it
- Practice mode (`menuView === 'practice'`) is where any table can be picked
- The table rolls over at local midnight without a reload

**Progression System:**
- Tables 1×-12×, all accessible in practice mode
- Integer speed levels (1, 2, 3...) per table
- Mastery = 10 correct answers in a row at a speed
- Best speed per table saved to LocalStorage

## Superpowers Workflow

Use these skills throughout development:

| When | Skill |
|------|-------|
| New feature or design decision | `superpowers:brainstorming` |
| Any implementation | `superpowers:test-driven-development` |
| Bug or test failure | `superpowers:systematic-debugging` |
| Before claiming done | `superpowers:verification-before-completion` |
| After completing a phase | `superpowers:requesting-code-review` |
| Responding to feedback | `superpowers:receiving-code-review` |
| Independent parallel tasks | `superpowers:subagent-driven-development` |
| Phase complete, ready to merge | `superpowers:finishing-a-development-branch` |

## Testing

- TDD for all game logic
- Test files mirror source: `math.js` → `math.test.js`
- Don't test Canvas rendering, only logic
