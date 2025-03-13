// Physics constants
export const PHYSICS = {
  GRAVITY: 0.8,
  PLAYER_MOVE_FORCE: 0.008,
  PLAYER_JUMP_FORCE: 0.016,
  GROUND_FRICTION: 0.01,
  AIR_FRICTION: 0.05,
  RESTITUTION: 0.2
};

// Game dimensions
export const GAME_DIMENSIONS = {
  WIDTH: 800,
  HEIGHT: 600
};

// Network configurations
export const NETWORK = {
  DEFAULT_SERVER_PORT: 3001,
  DEFAULT_CLIENT_PORT: 5173,
  WEBSOCKET_PATH: 'ws',
  UPDATE_RATE: 60 // Updates per second
};

// Player configurations
export const PLAYER = {
  DEFAULT_POSITION: { x: 100, y: 100 },
  WIDTH: 30,
  HEIGHT: 50,
  MOVE_SPEED: 5,
  JUMP_FORCE: 10
};

// Item configurations
export const ITEMS = {
  PLATFORM: {
    DEFAULT_WIDTH: 100,
    DEFAULT_HEIGHT: 20,
    MAX_WIDTH: 300,
    MAX_HEIGHT: 50
  },
  SPIKE: {
    SIZE: 30
  },
  OSCILLATOR: {
    DEFAULT_WIDTH: 100,
    DEFAULT_HEIGHT: 20,
    DEFAULT_AMPLITUDE_Y: 100,
    MAX_AMPLITUDE: 200,
    FREQUENCY: 0.001
  },
  DART_WALL: {
    WIDTH: 20,
    HEIGHT: 200,
    DART_SPEED: 5,
    DART_INTERVAL: 3000 // ms between dart firing
  }
};

// Game status transitions
export const GAME_STATUS_TRANSITIONS = {
  tutorial: ['modeSelect'],
  modeSelect: ['lobby', 'select'],
  lobby: ['playing', 'modeSelect'],
  select: ['placement'],
  placement: ['playing'],
  playing: ['win', 'gameover'],
  win: ['reset'],
  gameover: ['reset'],
  reset: ['select', 'placement']
};

// Message types
export const MESSAGE_TYPES = {
  INITIAL_STATE: 'INITIAL_STATE',
  STATE_UPDATE: 'STATE_UPDATE',
  PLAYER_INPUT: 'PLAYER_INPUT',
  PLACE_ITEM: 'PLACE_ITEM',
  START_GAME: 'START_GAME',
  JOIN_LOBBY: 'JOIN_LOBBY',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  AI_COMMAND: 'AI_COMMAND',
  COMMAND_RESULT: 'COMMAND_RESULT',
  EVENT: 'EVENT',
  ERROR: 'ERROR',
  PING: 'PING',
  PONG: 'PONG',
  REQUEST_INITIAL_STATE: 'REQUEST_INITIAL_STATE'
};

// Event types
export const EVENT_TYPES = {
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  GAME_STARTED: 'GAME_STARTED',
  ROUND_COMPLETE: 'ROUND_COMPLETE',
  ITEM_PLACED: 'ITEM_PLACED',
  PLAYER_DEATH: 'PLAYER_DEATH',
  PLAYER_WIN: 'PLAYER_WIN'
};

// Error codes
export const ERROR_CODES = {
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_STATE: 'INVALID_STATE',
  INVALID_PLACEMENT: 'INVALID_PLACEMENT',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

export default {
  PHYSICS,
  GAME_DIMENSIONS,
  NETWORK,
  PLAYER,
  ITEMS,
  GAME_STATUS_TRANSITIONS,
  MESSAGE_TYPES,
  EVENT_TYPES,
  ERROR_CODES
};