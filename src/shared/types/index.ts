// src/shared/types/index.ts
// Central type definitions for the game

// ==================
// Game State Types
// ==================

/**
 * Possible states of the game
 */
export type GameStatus = 'tutorial' | 'modeSelect' | 'lobby' | 'win' | 'playing' | 'reset' | 'gameover' | 'select' | 'placement';

/**
 * Different ways that the player can die
 */
export type DeathType = 'dart' | 'spike' | 'fall' | null;

/**
 * Types of items that can be placed in the game
 */
export type ItemType = 'platform' | 'spike' | 'moving' | 'shield' | 'dart_wall';

/**
 * Options for obstacles that can be placed by the prompter
 */
export interface ItemOption {
  type: ItemType;
  name: string;
  description: string;
  color: string;
}

// ==================
// Game Mode Types
// ==================

/**
 * Game mode options using consistent naming
 */
export type GameMode = 'single_player' | 'multiplayer';

/**
 * Player roles in multiplayer mode
 */
export type PlayerRole = 'goat' | 'prompter';

// ==================
// Parameter System Types
// ==================

/**
 * Game parameter definition
 */
export interface GameParameter {
  key: string;
  defaultValue: number;
  currentValue: number;
  normalizedValue: number;
  min: number;
  max: number;
  description: string;
}

/**
 * Parameter change event
 */
export interface ParameterChangeEvent extends CustomEvent {
  detail: {
    key: string;
    currentValue: number;
    normalizedValue: number;
    description: string;
  }
}

/**
 * Parameter change listener function signature
 */
export type ParameterChangeListener = (newValue: number, normalizedValue: number, parameter: GameParameter) => void;

// ==================
// AI Service Types
// ==================

/**
 * Parameter modification from AI commands
 */
export interface ParameterModification {
  parameter: string;
  normalized_value: number;
}

/**
 * AI command response structure
 */
export interface CommandResponse {
  response: string;
  success: boolean;
  parameter_modifications: ParameterModification[];
}

/**
 * AI command request structure
 */
export interface CommandRequest {
  command: string;
}

// ==================
// Network Protocol Types
// ==================

/**
 * Base message interface for client-server communication
 */
export interface NetworkMessage {
  type: string;
  payload?: any;
  timestamp?: number;
}

/**
 * Client to server state update message
 */
export interface ClientStateMessage extends NetworkMessage {
  type: 'client_state';
  payload: {
    input?: {
      left?: boolean;
      right?: boolean;
      up?: boolean;
      down?: boolean;
      jump?: boolean;
    };
    position?: {
      x: number;
      y: number;
    };
  };
}

/**
 * Server to client state update message
 */
export interface ServerStateMessage extends NetworkMessage {
  type: 'server_state';
  payload: {
    players: Record<string, {
      position: { x: number; y: number };
      velocity: { x: number; y: number };
      isOnGround: boolean;
    }>;
    obstacles: Array<{
      id: string;
      type: ItemType;
      position: { x: number; y: number };
    }>;
    gameStatus: GameStatus;
    deathType?: DeathType;
  };
}

/**
 * Parameter update message
 */
export interface ParameterUpdateMessage extends NetworkMessage {
  type: 'parameter_update';
  payload: {
    parameter: string;
    value: number;
    normalizedValue: number;
  };
}

/**
 * AI command message
 */
export interface CommandMessage extends NetworkMessage {
  type: 'command';
  payload: {
    command: string;
  };
}

/**
 * Command result message
 */
export interface CommandResultMessage extends NetworkMessage {
  type: 'command_result';
  payload: {
    response: string;
    success: boolean;
    type?: string;
    x?: number;
    y?: number;
    parameter_modifications?: ParameterModification[];
  };
}

// ==================
// Component Prop Types
// ==================

/**
 * Props for GameRenderer component
 */
export interface GameRendererProps {
  gameState: any;  // Will be refined as we develop the state structure
  onInputChange: (input: any) => void;
}

/**
 * Props for GameModeSelection component
 */
export interface GameModeSelectionProps {
  onSelectMode: (mode: GameMode, lobbyCode?: string) => void;
}

/**
 * Props for DeathModal component
 */
export interface DeathModalProps {
  deathType: 'dart' | 'spike' | 'fall';
  onContinue: () => void;
}

/**
 * Props for ItemSelectionPanel component
 */
export interface ItemSelectionPanelProps {
  onSelectItem: (itemType: ItemType) => void;
}

/**
 * Props for LobbyWaitingScreen component
 */
export interface LobbyWaitingScreenProps {
  lobbyCode: string;
  playerRole: PlayerRole;
  onCancel: () => void;
}

/**
 * Props for PrompterControls component
 */
export interface PrompterControlsProps {
  onPlaceObstacle: (type: string, x: number, y: number) => void;
  disabled: boolean;
}

/**
 * Props for TutorialModal component
 */
export interface TutorialModalProps {
  onStart: () => void;
}

// ==================
// Global Extensions
// ==================

declare global {
  interface Window {
    playerPosition?: {
      x: number;
      y: number;
      isOnGround?: boolean;
    };
  }
}

// Export default empty object to make this a module
export default {};