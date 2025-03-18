Goat in the Shell Architectural Refactor PRD
This document outlines a phased refactor plan to address the architectural issues in the "Goat in the Shell" video game codebase, focusing on eliminating overlapping state mechanics, duplicate code, and conflicting sources of truth. The goal is to align the codebase with the intended client-server architecture where the server is the authoritative source of truth for game state and physics, while the client handles rendering, user input, and optimistic updates. The refactor aims to reduce complexity, delete unnecessary code, and improve maintainability.
Below are the top 3 architectural fixes identified, presented in a Product Requirements Document (PRD) format with detailed action items for each phase.
1. Consolidate Game State Management
Problem
The current codebase has overlapping state management between the client (src/client/store/gameStore.ts) and server (src/server/game-state/GameSessionManager.ts), with both maintaining versions of the game state (UniversalGameState). This leads to duplication and potential inconsistencies, as the client sometimes drives state transitions (e.g., handlePlaceItem in gameStore.ts) while the server should be authoritative. Files like src/client/App.tsx also handle state transitions locally, bypassing the server.
Goal
Centralize game state management on the server, ensuring the client only reflects server-provided state via WebSocket updates, reducing duplicate logic and enforcing a single source of truth.
Action Items
Phase 1: Define and Enforce Server-Driven State
Objective: Ensure all game state transitions originate from the server.
Tasks:
Update src/server/game-state/GameSessionManager.ts:
Enhance transitionTo method to validate and broadcast all state changes using GAME_EVENTS.GAME_STATE_CHANGED.
Remove client-side state transition logic from src/client/store/gameStore.ts for handlePlaceItem, handleContinueToNextRound, and resetGame, replacing with server requests via requestGameStateTransition.
Modify src/client/network/SocketServer.ts:
Ensure handleStateTransition processes all transition requests and broadcasts results to all clients in the session.
Update broadcastGameState to include the full UniversalGameState on every state change.
Remove Client-Side State Manipulation:
In src/client/App.tsx, remove direct calls to setGameStatus in handleGameModeSelect and handleCancelLobby, replacing with requestGameStateTransition calls via useSocket.
Delete setGameStatus from gameStore.ts public API, keeping only requestGameStateTransition.
Files Affected:
src/server/game-state/GameSessionManager.ts
src/client/store/gameStore.ts
src/client/network/SocketServer.ts
src/client/App.tsx
Deletion: Remove approximately 50 lines of duplicate state logic from gameStore.ts.
Phase 2: Synchronize Client State
Objective: Ensure client state mirrors server state without local modifications.
Tasks:
Update src/client/store/gameStore.ts:
Modify updateGameState to fully replace local gameState with server-provided UniversalGameState, removing any local overrides.
Remove gameStatus as a separate field, deriving it from gameState.gameStatus.
Enhance src/client/network/SocketEvents.ts:
Ensure forwardToGameEventBus for STATE_UPDATE and INITIAL_STATE events triggers updateGameState in the store.
Refactor src/client/rendering/GameRenderer.tsx:
Update to use gameState directly from store, removing local state assumptions.
Files Affected:
src/client/store/gameStore.ts
src/client/network/SocketEvents.ts
src/client/rendering/GameRenderer.tsx
Deletion: Eliminate ~30 lines of redundant state handling in GameRenderer.tsx.
2. Unify Physics Implementation
Problem
Physics is implemented on both client (src/client/rendering/BasicGameScene.ts) and server (src/server/physics/PhysicsEngineInstance.ts), using different engines (Phaser Arcade vs. Matter.js). This causes synchronization issues, as seen in PositionDebug output (src/client/components/PositionDebug.tsx), where client and server positions diverge. Duplicate physics logic also exists, such as collision handling in both files.
Goal
Consolidate physics on the server using Matter.js, with the client using server-provided positions for rendering, eliminating client-side physics and reducing codebase size.
Action Items
Phase 1: Remove Client-Side Physics
Objective: Disable client-side physics simulation in Phaser.
Tasks:
Update src/client/rendering/BasicGameScene.ts:
Remove physics.add and setupPhysics calls, replacing with direct position updates from server state.
Delete collision handlers (handleEndPointCollision, handleDeathZoneCollision, handleSpikeCollision).
Remove update method’s physics-related code, keeping only rendering updates.
Modify src/client/rendering/GameRenderer.tsx:
Update Phaser config to disable Arcade physics (physics field removed).
Files Affected:
src/client/rendering/BasicGameScene.ts
src/client/rendering/GameRenderer.tsx
Deletion: Remove ~200 lines of physics code from BasicGameScene.ts.
Phase 2: Enhance Server Physics
Objective: Ensure server physics accurately handles all game mechanics.
Tasks:
Update src/server/physics/PhysicsEngineInstance.ts:
Refine applyPlayerForces to match original client behavior (e.g., exact jump velocity of -500/30).
Add oscillator movement logic to registerItemWithPhysics using Matter.js constraints.
Enhance collision detection for shields and spikes, ensuring consistent behavior.
Sync with src/server/game-state/GameSessionManager.ts:
Update update to call physics.update with correct delta time.
Files Affected:
src/server/physics/PhysicsEngineInstance.ts
src/server/game-state/GameSessionManager.ts
Phase 3: Optimize State Broadcasting
Objective: Ensure client receives accurate position updates.
Tasks:
Update src/server/network/SocketServer.ts:
Increase BROADCAST_INTERVAL to 16ms (~60fps) for smoother updates.
Ensure broadcastGameState sends full player positions and velocities.
Refactor src/client/rendering/BasicGameScene.ts:
Update updateGameState to interpolate player positions using server data.
Files Affected:
src/server/network/SocketServer.ts
src/client/rendering/BasicGameScene.ts
3. Streamline Event Handling
Problem
Event handling is duplicated across the client event bus (src/client/utils/GameEventBus.ts), server event bus (src/server/game-state/GameEvents.ts), and WebSocket messaging (src/client/network/SocketEvents.ts, src/server/network/SocketServer.ts). This leads to overlapping logic (e.g., ITEM_PLACED handling in multiple files) and inconsistent communication flows.
Goal
Unify event handling through WebSocket messages, leveraging the server as the central event dispatcher, reducing client-side event complexity and deleting redundant code.
Action Items
Phase 1: Centralize Event Dispatching
Objective: Route all game events through server WebSocket messages.
Tasks:
Update src/server/network/SocketServer.ts:
Enhance handlePlaceItem to broadcast ITEM_PLACED events to all clients.
Add handlers for PLAYER_DEATH, PLAYER_WIN, and GAME_STATUS_CHANGE in handleMessage.
Modify src/server/game-state/GameSessionManager.ts:
Update handlePlayerDeath and handlePlayerWin to emit events via WebSocket, not local bus.
Files Affected:
src/server/network/SocketServer.ts
src/server/game-state/GameSessionManager.ts
Phase 2: Simplify Client Event Handling
Objective: Reduce client-side event bus usage to UI-only events.
Tasks:
Update src/client/network/SocketEvents.ts:
Remove redundant ITEM_PLACED handling, relying on STATE_UPDATE.
Simplify forwardToGameEventBus to only trigger UI updates (e.g., GAME_STATUS_CHANGE).
Refactor src/client/store/gameStore.ts:
Remove GAME_EVENTS.ITEM_PLACEMENT subscription, relying on server ITEM_PLACED.
Update src/client/rendering/BasicGameScene.ts:
Remove ITEM_PLACED subscription, using SERVER_STATE_UPDATE for rendering.
Files Affected:
src/client/network/SocketEvents.ts
src/client/store/gameStore.ts
src/client/rendering/BasicGameScene.ts
Deletion: Remove ~100 lines of duplicate event handling code.
Phase 3: Remove Redundant Server Event Bus
Objective: Eliminate server-side event bus where possible.
Tasks:
Update src/server/game-state/GameSessionManager.ts:
Replace gameEvents.publish calls with direct WebSocket broadcasts via SocketServer.
Delete setupEventListeners and related code.
Delete src/server/game-state/GameEvents.ts:
Remove file as it’s no longer needed with WebSocket centralization.
Files Affected:
src/server/game-state/GameSessionManager.ts
src/server/game-state/GameEvents.ts (deleted)
Deletion: Remove entire GameEvents.ts file (~100 lines).
