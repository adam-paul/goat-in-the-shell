# AI Parameter System Implementation Plan

This document outlines the step-by-step implementation plan for integrating an AI-driven parameter system into Goat in the Shell, allowing dynamic modification of game elements through natural language commands.

## Core Concept

Create a parameter mapping system that normalizes values between -1 and 1, where:
- 0 represents current default values
- -1 represents half of default value
- 1 represents twice the default value

## Phase 1: Parameter Mapping System

### 1.1 Create Parameter Interface (Frontend)
- [x] Create `/src/game/parameters/ParameterMap.ts` to define parameter interfaces
- [x] Implement normalization functions (convertToNormalizedValue, convertFromNormalizedValue)
- [x] Define default values for all parameters
- [x] Add TypeScript types for parameter objects

```typescript
// Sample structure
export interface GameParameter {
  key: string;
  defaultValue: number;
  currentValue: number;
  normalizedValue: number; // Between -1 and 1
  min: number;
  max: number;
  description: string;
}

export const GAME_PARAMETERS: Record<string, GameParameter> = {
  gravity: {
    key: 'gravity',
    defaultValue: 300,
    currentValue: 300,
    normalizedValue: 0,
    min: 150,
    max: 600,
    description: 'Controls how quickly objects fall'
  },
  // ... other parameters
};
```

### 1.2 Parameter Update System
- [x] Create `/src/game/parameters/ParameterManager.ts` for parameter state management
- [x] Implement observer pattern for parameter changes
- [x] Add methods to update parameters (updateParameter, resetParameters)
- [x] Create event system for parameter change notifications

## Phase 2: Backend AI Integration

### 2.1 Enhance AI System Prompt
- [x] Update `/api/ai_handler.py` with comprehensive parameter context
- [x] Define all available parameters with descriptions in the system prompt
- [x] Explain the normalized value system (-1 to 1) in the system prompt
- [x] Add example parameter modifications and expected outputs

```python
# Sample system prompt addition
PARAMETER_CONTEXT = """
You can modify the following game parameters using normalized values between -1 and 1:
- gravity: Controls how quickly objects fall (0 = normal, -1 = half gravity, 1 = double gravity)
- dart_speed: Controls dart projectile speed (0 = normal, -1 = slower, 1 = faster)
...

When a user asks to modify game parameters, respond with both a natural language explanation
and a structured parameter_modifications array with the appropriate changes.
"""
```

### 2.2 Structure AI Response Format
- [x] Define a JSON schema for parameter modifications
- [x] Update the AI handler to request structured format outputs from GPT-4o
- [x] Include function calling or JSON mode to ensure consistent response formatting

```python
# Sample response schema
class ParameterModification:
    parameter: str
    normalized_value: float  # Between -1 and 1
    
class CommandResponse:
    response: str  # Natural language explanation
    success: bool
    parameter_modifications: List[ParameterModification] = []
```

### 2.3 Response Processing
- [x] Parse the structured LLM response in the backend
- [x] Validate parameter keys and normalized values
- [x] Add logging for parameter modification requests
- [x] Implement error handling for unexpected LLM responses

### 2.4 API Endpoint Enhancement
- [x] Update `/api/main.py` to handle parameter modification responses
- [x] Forward validated parameter modifications to the frontend
- [x] Add proper error handling and status codes
- [x] Create test cases for parameter modification scenarios

## Phase 3: Frontend Integration

### 3.1 API Client Implementation
- [x] Create `/src/services/AIService.ts` for API communication
- [x] Define TypeScript interfaces for parameter modifications that match backend schemas
- [x] Implement command sending with proper error handling and loading states
- [x] Add parameter validation before sending to backend

```typescript
// Sample API client with parameter modification support
interface ParameterModification {
  parameter: string;
  normalized_value: number;
}

interface CommandResponse {
  response: string;
  success: boolean;
  parameter_modifications: ParameterModification[];
}

async function sendCommand(command: string): Promise<CommandResponse> {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  });
  
  if (!response.ok) {
    throw new Error('Failed to process command');
  }
  
  return response.json();
}
```

### 3.2 Command Terminal Enhancement
- [x] Update `/src/components/PrompterControls.tsx` to use the AIService
- [x] Process parameter modifications from AI responses
- [x] Forward parameter changes to ParameterManager
- [x] Display AI responses and parameter changes in command history
- [x] Add loading state during API calls

### 3.3 Parameter Change Events
- [x] Create a parameter change event system between React and Phaser
- [x] Implement event listeners in React components for parameter changes
- [x] Add handlers for parameter reset and batch updates
- [x] Connect the command terminal to the parameter system

### 3.4 Parameter Visualization
- [x] Create a parameter status component to show active modifications
- [x] Add visual indicators for parameter changes (e.g., color coding, icons)
- [x] Implement a compact display of current parameter values
- [x] Add parameter reset controls

## Phase 4: Game Integration

### 4.1 Phaser Scene Integration
- [ ] Modify `/src/game/scenes/GameScene.ts` to consume parameters
- [ ] Update physics system to use parameter values
- [ ] Implement real-time parameter updating
- [ ] Add event listeners for parameter changes from ParameterManager

```typescript
// Example integration in GameScene
private initPhysics(): void {
  const gravity = ParameterManager.getParameter('gravity').currentValue;
  this.physics.world.setBounds(0, 0, this.game.config.width, this.game.config.height);
  this.physics.world.gravity.set(0, gravity);
  
  // Subscribe to parameter changes
  ParameterManager.onParameterChanged('gravity', (newValue) => {
    this.physics.world.gravity.set(0, newValue);
  });
}
```

### 4.2 Asset Generation Enhancement
- [ ] Update obstacle creation functions to use parameters
- [ ] Modify dart system to use dart_speed and dart_frequency
- [ ] Enhance platform generation with dynamic height/width
- [ ] Implement tilt mechanics for platforms

### 4.3 Testing and Calibration
- [ ] Test all parameters for appropriate min/max values
- [ ] Calibrate parameter effects for gameplay balance
- [ ] Create test scenarios for each parameter
- [ ] Document parameter effects for user guidance

## Phase 5: Polish and Documentation

### 5.1 User Experience
- [ ] Add parameter change animations
- [ ] Implement parameter reset UI
- [ ] Create parameter visualization dashboard
- [ ] Add parameter presets for quick configuration

### 5.2 Error Handling
- [ ] Add graceful degradation for parameter failures
- [ ] Implement parameter validation safeguards
- [ ] Create user-friendly error messages
- [ ] Add logging for parameter changes

### 5.3 Documentation
- [ ] Update in-game tutorial for parameter commands
- [ ] Create parameter reference guide
- [ ] Document API endpoints for parameters
- [ ] Add developer documentation for extending parameters

## Implementation Timeline

1. **Week 1**: Phase 1 - Parameter Mapping System
2. **Week 2**: Phase 2 - Backend AI Integration
3. **Week 3**: Phase 3 - Frontend Integration
4. **Week 4**: Phase 4 - Game Integration
5. **Week 5**: Phase 5 - Polish and Documentation

## Testing Strategy

1. **Unit Tests**: Individual parameter functions
2. **Integration Tests**: AI response to parameter commands
3. **End-to-End Tests**: Complete flow from command to game effect
4. **User Testing**: Gather feedback on parameter effects and balance

## Future Extensions

- Add more complex parameters (e.g., time dilation, visual effects)
- Implement parameter combinations for special effects
- Create AI-driven scenario generation based on parameters
- Add parameter profiles for different difficulty levels