// Canvas base dimensions (height is fixed, width adapts to viewport)
export const BASE_HEIGHT = 600;
export const BASE_WIDTH = 800; // Minimum width, will expand for wider screens

// Bird physics
export const GRAVITY = 0.025;
export const FLAP_VELOCITY = -1.8;
export const BIRD_SIZE = 30;
export const BIRD_X = 150;

// Pipe settings
export const PIPE_WIDTH = 70;
export const PIPE_GAP_HEIGHT = 120;
export const PIPE_SPAWN_INTERVAL = 4000; // ms
export const PIPE_CAP_HEIGHT = 25;

// Speed settings
export const BASE_SPEED = 0.75;
export const SPEED_INCREMENT = 0.15;

// Game settings
export const INITIAL_LIVES = 3;
export const MASTERY_STREAK = 10;

// Multiplication table and speed bounds
export const MIN_TABLE = 2;
export const MAX_TABLE = 12;
export const MIN_SPEED = 1;
export const MAX_SPEED = 99;
