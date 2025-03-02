# Goat In The Shell - AI Backend

This is the FastAPI backend for the "Goat In The Shell" game, handling AI-powered text commands and lobby management for multiplayer functionality.

## Important: Dual-Server Architecture

As of the latest update, this server now only handles:
1. Lobby management (player connections, role assignments)
2. AI command processing

All game state synchronization, physics, and real-time gameplay is now handled by a separate Node.js game server. Players will connect to both servers:

1. **FastAPI Server (this server)**: For initial lobby setup and AI processing
2. **Node.js Game Server**: For real-time game state and physics

See the MULTIPLAYER.md file in the project root for implementation details on the dual-server architecture.

## Local Setup

1. Ensure you have Python 3.8+ installed
2. Set up the virtual environment:
   ```bash
   cd api
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ```

## Running Locally

Start the API server:

```bash
cd api
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

The API will be available at http://localhost:8000 with both HTTP and WebSocket endpoints.

## Deployment to Railway

### Important Notes for Railway Deployment

1. Make sure to set the `OPENAI_API_KEY` environment variable in Railway's dashboard.

2. When deploying to Railway:
   - Set the root directory to `/api` in your Railway project settings
   - Railway will automatically detect the Procfile or nixpacks.toml for build and start commands

3. The deployment should use the following files:
   - `nixpacks.toml` - Defines the build and start process
   - `Procfile` - Alternative to nixpacks.toml
   - `requirements.txt` - Lists all dependencies
   - `runtime.txt` - Specifies the Python version

## API Endpoints

### GET /

Returns a welcome message to confirm the API is running.

### GET /health

Returns a simple status check to verify the API is operational.

### POST /command

Process a text command and return an AI-generated response.

**Request Body:**
```json
{
  "command": "your text command here"
}
```

**Response:**
```json
{
  "response": "AI-generated response",
  "success": true,
  "parameter_modifications": [
    {
      "parameter": "gravity",
      "normalized_value": 0.5
    }
  ]
}
```

### GET /parameters

Get information about all available parameters.

### GET /create-lobby

Create a new multiplayer lobby and return the lobby code.

### GET /check-lobby/{lobby_code}

Check if a lobby exists and get information about it.

### GET /websocket-status

Get information about active WebSocket connections and lobbies.

### GET /ai-command

Generate a random AI command for single player mode.

## WebSocket Endpoints

### /ws-test

A simple ping-pong test endpoint for verifying WebSocket functionality.

### /ws/{lobby_code}/{player_role}

WebSocket endpoint for lobby management. The `lobby_code` is a unique identifier for the game session, and `player_role` can be one of:
- `goat`: Player controlling the goat character
- `prompter`: Player controlling the command terminal
- `spectator`: Observer who can watch the game but not participate

**Note:** This WebSocket endpoint now only handles:
- Initial lobby connections
- Player role assignment and validation
- Generating session tokens for game server authentication
- AI command processing

All game state synchronization (player positions, item placement, etc.) is now handled by the Node.js game server.

## Development

- The API uses FastAPI for the web framework
- WebSockets for real-time multiplayer functionality
- OpenAI's API is used for processing text commands
- Environment variables are managed with python-dotenv

## Testing WebSockets

A WebSocket test client is included to verify the server is working correctly:

```bash
# Run all tests
python test_websocket.py --all

# Test basic WebSocket functionality
python test_websocket.py

# Test multiplayer connection as a specific role
python test_websocket.py --multiplayer --role goat --lobby TEST123

# Test single player mode
python test_websocket.py --singleplayer
```

## Integration with Frontend

### REST API Integration

To call the API from your frontend:

```javascript
async function sendCommand(command) {
  const response = await fetch('https://your-railway-url/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command }),
  });
  
  return await response.json();
}
```

### Dual WebSocket Integration

For connecting to both servers from your frontend:

```javascript
// 1. First connect to the FastAPI lobby server
function connectToLobby(lobbyCode, playerRole) {
  const ws = new WebSocket(`wss://your-railway-url/ws/${lobbyCode}/${playerRole}`);
  
  ws.onopen = () => {
    console.log(`Connected to lobby server ${lobbyCode} as ${playerRole}`);
  };
  
  let sessionToken = null;
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received from lobby server:', data);
    
    // Handle different message types
    switch (data.type) {
      case 'welcome':
        // Save session token for game server authentication
        sessionToken = data.session_id;
        // Now connect to game server
        connectToGameServer(lobbyCode, playerRole, sessionToken);
        break;
      case 'system_message':
        console.log('System message:', data.message);
        break;
      case 'command_result':
        console.log('Command result:', data.result);
        break;
      // Note: game_state and other game events now come from the game server
    }
  };
  
  ws.onclose = () => {
    console.log('Lobby server connection closed');
  };
  
  ws.onerror = (error) => {
    console.error('Lobby server WebSocket error:', error);
  };
  
  return ws;
}

// 2. Then connect to the Node.js game server
function connectToGameServer(lobbyCode, playerRole, sessionToken) {
  // Connect to game server with Socket.io
  const gameServer = io('your-game-server-url');
  
  // Authenticate with session token from lobby server
  gameServer.on('connect', () => {
    console.log(`Connected to game server`);
    
    // Join lobby with authentication token
    gameServer.emit('join-game', {
      lobbyCode,
      playerRole,
      sessionToken
    });
  });
  
  // Handle game events from game server
  gameServer.on('game-state', (data) => {
    console.log('Game state update:', data);
    // Update game rendering with new state
  });
  
  gameServer.on('disconnect', () => {
    console.log('Game server connection closed');
  });
  
  return gameServer;
}

// For multiplayer mode
const lobbyConnection = connectToLobby('ABCDEF', 'goat');
// Game server connection will be made after receiving welcome message with session token
``` 