# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npx serve .          # Run local dev server
npm test             # Run tests (watch mode)
npm test -- --run    # Run tests once
```

## Architecture

Flappy Math is an HTML5 Canvas game for practicing multiplication tables.

**Core Loop:** Bird flies right, pipes have 3 answer gaps, player flies through correct answer.

**Key Modules:**
- `js/game.js` - Main loop, orchestrates updates and rendering
- `js/state.js` - Game state machine (menu → playing → gameOver)
- `js/bird.js` - Bird physics (gravity, flap)
- `js/pipe.js` - Pipes with 3 answer gaps
- `js/math.js` - Problem generation (correct + plausible wrong answers)
- `js/collision.js` - Bird vs gap/pipe detection
- `js/scoring.js` - Score, streak, lives
- `js/progress.js` - Mastery tracking per table/speed
- `js/storage.js` - LocalStorage persistence

**Progression System:**
- Tables 2×-12×, all accessible from start
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
