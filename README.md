# Flappy Math

A Flappy Bird-style game for practicing multiplication tables. Fly through pipes by choosing the correct answer to math problems.

## How to Play

**Controls:**
- Press **Space** or **Click** to flap and fly upward
- Use **Arrow keys** or **Number keys** to select multiplication table (2-12) and speed level in the menu
- Press **Escape** to return to menu

**Objective:**
- Each pipe has 3 gaps with different answer options
- Fly through the gap showing the correct answer to the displayed multiplication problem
- Get 10 correct answers in a row to master a table at the current speed level
- Avoid hitting pipes or choosing wrong answers (costs a life)
- You have 3 lives per game

## Features

- Multiplication tables 2x through 12x
- Adjustable speed levels (1-99)
- Progress tracking with best speed saved per table
- Mastery system: 10 correct in a row unlocks higher speeds
- Multi-language support (English, Swedish)
- LocalStorage persistence for progress
- Smooth bird physics with gravity and flap mechanics

## Setup

```bash
# Install dependencies
npm install

# Start local development server
npx serve .
```

Then open `http://localhost:3000` in your browser.

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
