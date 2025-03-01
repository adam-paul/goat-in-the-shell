# Goat In The Shell - AI Backend

This is the FastAPI backend for the "Goat In The Shell" game, handling AI-powered text commands and WebSocket communication for multiplayer functionality.

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

Main WebSocket endpoint for multiplayer games. The `lobby_code` is a unique identifier for the game session, and `player_role` can be one of:
- `goat`: Player controlling the goat character
- `prompter`: Player controlling the command terminal
- `spectator`: Observer who can watch the game but not participate

For single player mode, use `SINGLEPLAYER` as the lobby code and `goat` as the player role.

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

### WebSocket Integration

For WebSocket connections from your frontend:

```javascript
function connectToLobby(lobbyCode, playerRole) {
  const ws = new WebSocket(`wss://your-railway-url/ws/${lobbyCode}/${playerRole}`);
  
  ws.onopen = () => {
    console.log(`Connected to lobby ${lobbyCode} as ${playerRole}`);
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);
    
    // Handle different message types
    switch (data.type) {
      case 'system_message':
        console.log('System message:', data.message);
        break;
      case 'command_result':
        console.log('Command result:', data.result);
        break;
      case 'game_state':
        console.log('Game state update:', data.player_state);
        break;
      case 'ai_command':
        console.log('AI command:', data.result);
        break;
    }
  };
  
  ws.onclose = () => {
    console.log('Connection closed');
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
}

// For single player mode
const singlePlayerWs = connectToLobby('SINGLEPLAYER', 'goat');

// For multiplayer mode
const goatWs = connectToLobby('ABCDEF', 'goat');
const prompterWs = connectToLobby('ABCDEF', 'prompter');
``` 