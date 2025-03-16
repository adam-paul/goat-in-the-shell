1. PlayerRegistry: Source of truth for all player data
2. GameInstanceManager: Source of truth for instance management
3. GameInstance: Owner of state, state machine, AND physics for that instance
4. PhysicsEngineInstance: Instance-specific, manages only physics for one instance
