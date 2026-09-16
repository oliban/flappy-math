// Canvas base dimensions (height is fixed, width adapts to viewport)
export const BASE_HEIGHT = 600;
export const BASE_WIDTH = 800; // Minimum width, will expand for wider screens
export const GROUND_HEIGHT = 40;          // Grass + soil strip at the bottom
export const GROUND_Y = BASE_HEIGHT - GROUND_HEIGHT; // Top of the grass = the bird's floor

// Bird physics
// Tuned for the fixed 60 Hz step: a flap climbs ~65 px in 0.9 s, and a fall from the
// top gap to the bottom gap takes ~1.8 s, comfortably inside one pipe interval.
export const GRAVITY = 0.05;
export const FLAP_VELOCITY = -2.6;
export const BIRD_SIZE = 30;
export const BIRD_X = 150;

// Pipe settings
export const PIPE_WIDTH = 70;
export const PIPE_GAP_HEIGHT = 120;
export const PIPE_SPAWN_INTERVAL = 4000; // ms
export const PIPE_CAP_HEIGHT = 25;

// Speed: see js/pace.js — pipes cross the screen in a fixed time per level,
// independent of canvas width, so phones and desktops feel the same.

// Game settings
export const INITIAL_LIVES = 3;
export const MASTERY_STREAK = 10;

// Weekly challenge: correct answers needed to move up one speed level
export const HITS_PER_SPEED_LEVEL = 3;
