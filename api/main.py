from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import logging
import json
import uuid
import asyncio
import random
import time
from dotenv import load_dotenv
from ai_handler import AIHandler, ParameterModification

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
logger.info("Environment variables loaded")
logger.info(f"Current working directory: {os.getcwd()}")

# Initialize FastAPI app
app = FastAPI(title="Goat In The Shell AI Backend")
logger.info("FastAPI app initialized")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS middleware added")

# Define request model
class CommandRequest(BaseModel):
    command: str

# Define response model with parameter modifications
class CommandResponse(BaseModel):
    response: str
    success: bool
    parameter_modifications: List[ParameterModification] = []

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.lobby_codes: Dict[str, str] = {}  # Map connection ID to lobby code
        self.player_roles: Dict[str, str] = {}  # Map connection ID to player role
        self.last_activity: Dict[str, float] = {}  # Track last activity timestamp for lobbies
        self.lobby_info: Dict[str, Dict] = {}  # Store metadata for lobbies
        logger.info("WebSocket connection manager initialized")

    async def connect(self, websocket: WebSocket, lobby_code: str, player_role: str):
        await websocket.accept()
        conn_id = str(id(websocket))
        
        # Create lobby if it doesn't exist
        if lobby_code not in self.active_connections:
            self.active_connections[lobby_code] = []
            self.lobby_info[lobby_code] = {
                "created_at": asyncio.get_event_loop().time(),
                "player_count": 0,
                "has_goat": False,
                "has_prompter": False
            }
            logger.info(f"Created new lobby: {lobby_code}")
        
        # Check if role is already taken in this lobby
        if player_role == "goat" and self.lobby_info[lobby_code]["has_goat"]:
            await websocket.close(code=1000, reason="Goat role already taken in this lobby")
            logger.warning(f"Connection rejected: Goat role already taken in lobby {lobby_code}")
            return False
        
        if player_role == "prompter" and self.lobby_info[lobby_code]["has_prompter"]:
            await websocket.close(code=1000, reason="Prompter role already taken in this lobby")
            logger.warning(f"Connection rejected: Prompter role already taken in lobby {lobby_code}")
            return False
            
        # Add connection to lobby
        self.active_connections[lobby_code].append(websocket)
        self.lobby_codes[conn_id] = lobby_code
        self.player_roles[conn_id] = player_role
        self.lobby_info[lobby_code]["player_count"] += 1
        
        # Update role flags
        if player_role == "goat":
            self.lobby_info[lobby_code]["has_goat"] = True
        elif player_role == "prompter":
            self.lobby_info[lobby_code]["has_prompter"] = True
        
        # Update activity timestamp
        self.last_activity[lobby_code] = asyncio.get_event_loop().time()
        
        logger.info(f"Client connected to lobby {lobby_code} as {player_role}")
        
        # Create lobby info object
        lobby_info = {
            "code": lobby_code,
            "player_count": self.lobby_info[lobby_code]["player_count"],
            "has_goat": self.lobby_info[lobby_code]["has_goat"],
            "has_prompter": self.lobby_info[lobby_code]["has_prompter"]
        }
        
        # Notify all clients in the lobby about the new connection
        await self.broadcast(
            lobby_code,
            {
                "type": "system_message",
                "message": f"Player joined as {player_role}",
                "lobby_info": lobby_info
            }
        )
        
        # Also send a more specific player_joined message
        await self.broadcast(
            lobby_code,
            {
                "type": "player_joined",
                "data": lobby_info,
                "player_role": player_role
            }
        )
        return True

    async def disconnect(self, websocket: WebSocket):
        conn_id = str(id(websocket))
        lobby_code = self.lobby_codes.get(conn_id)
        player_role = self.player_roles.get(conn_id)
        
        if lobby_code:
            # Remove connection from active connections
            if lobby_code in self.active_connections and websocket in self.active_connections[lobby_code]:
                self.active_connections[lobby_code].remove(websocket)
                
                # Update lobby info
                self.lobby_info[lobby_code]["player_count"] -= 1
                if player_role == "goat":
                    self.lobby_info[lobby_code]["has_goat"] = False
                elif player_role == "prompter":
                    self.lobby_info[lobby_code]["has_prompter"] = False
                
                # Clean up empty lobbies
                if not self.active_connections[lobby_code]:
                    del self.active_connections[lobby_code]
                    if lobby_code in self.last_activity:
                        del self.last_activity[lobby_code]
                    if lobby_code in self.lobby_info:
                        del self.lobby_info[lobby_code]
                    logger.info(f"Removed empty lobby: {lobby_code}")
                else:
                    # Notify remaining clients about the disconnection
                    await self.broadcast(
                        lobby_code,
                        {
                            "type": "system_message",
                            "message": f"Player ({player_role}) disconnected",
                            "lobby_info": {
                                "code": lobby_code,
                                "player_count": self.lobby_info[lobby_code]["player_count"],
                                "has_goat": self.lobby_info[lobby_code]["has_goat"],
                                "has_prompter": self.lobby_info[lobby_code]["has_prompter"]
                            }
                        }
                    )
            
            # Clean up connection mappings
            if conn_id in self.lobby_codes:
                del self.lobby_codes[conn_id]
            if conn_id in self.player_roles:
                del self.player_roles[conn_id]
                
            logger.info(f"Client disconnected from lobby {lobby_code} (role: {player_role})")

    async def broadcast(self, lobby_code: str, message: dict):
        """Broadcast a message to all connections in a lobby."""
        if lobby_code in self.active_connections:
            for connection in self.active_connections[lobby_code]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to client in lobby {lobby_code}: {str(e)}")
            
            # Update activity timestamp
            self.last_activity[lobby_code] = asyncio.get_event_loop().time()

    async def send_personal(self, websocket: WebSocket, message: dict):
        """Send a message to a specific client."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message to client: {str(e)}")

    def get_connection_info(self, websocket: WebSocket):
        """Get lobby code and player role for a connection."""
        conn_id = str(id(websocket))
        lobby_code = self.lobby_codes.get(conn_id)
        player_role = self.player_roles.get(conn_id)
        return lobby_code, player_role

    def generate_lobby_code(self, length: int = 6) -> str:
        """Generate a unique lobby code."""
        while True:
            # Generate a code using uppercase letters and numbers
            code = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=length))
            if code not in self.active_connections:
                return code
    
    async def cleanup_inactive_lobbies(self, max_idle_time: float = 3600):
        """Remove lobbies that have been inactive for too long."""
        current_time = asyncio.get_event_loop().time()
        lobbies_to_remove = []
        
        for lobby_code, last_time in self.last_activity.items():
            if current_time - last_time > max_idle_time:
                lobbies_to_remove.append(lobby_code)
        
        for lobby_code in lobbies_to_remove:
            # Notify clients before removing
            if lobby_code in self.active_connections:
                await self.broadcast(
                    lobby_code,
                    {
                        "type": "system_message",
                        "message": "Lobby closed due to inactivity"
                    }
                )
                
                # Close all connections in this lobby
                for connection in self.active_connections[lobby_code]:
                    try:
                        await connection.close(code=1000, reason="Lobby closed due to inactivity")
                    except Exception as e:
                        logger.error(f"Error closing connection: {str(e)}")
                
                # Remove lobby and related data
                del self.active_connections[lobby_code]
                if lobby_code in self.lobby_info:
                    del self.lobby_info[lobby_code]
                
                logger.info(f"Removed inactive lobby: {lobby_code}")
            
            # Remove from activity tracking
            if lobby_code in self.last_activity:
                del self.last_activity[lobby_code]

# Initialize the connection manager
manager = ConnectionManager()

# Background task to clean up inactive lobbies
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(periodic_cleanup())
    asyncio.create_task(websocket_heartbeat())
    logger.info("WebSocket server initialized and ready for connections")
    logger.info("WebSocket endpoints available at: ws://localhost:8000/ws/{lobby_code}/{player_role}")
    logger.info("To verify WebSocket functionality, connect with lobby_code='test' and player_role='spectator'")

async def periodic_cleanup():
    """Periodically clean up inactive lobbies."""
    while True:
        await asyncio.sleep(3600)  # Check once per hour
        await manager.cleanup_inactive_lobbies()
        logger.info("Performed inactive lobby cleanup")

async def websocket_heartbeat():
    """Log WebSocket connection status periodically."""
    while True:
        active_connections = sum(len(connections) for connections in manager.active_connections.values())
        active_lobbies = len(manager.active_connections)
        logger.info(f"WebSocket Status: {active_connections} active connections across {active_lobbies} lobbies")
        
        # Log details about each lobby
        for lobby_code, connections in manager.active_connections.items():
            if lobby_code in manager.lobby_info:
                info = manager.lobby_info[lobby_code]
                logger.info(f"  Lobby {lobby_code}: {len(connections)} connections | " +
                           f"Goat: {'✓' if info.get('has_goat', False) else '✗'} | " +
                           f"Prompter: {'✓' if info.get('has_prompter', False) else '✗'}")
        
        await asyncio.sleep(60)  # Log status every minute

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": "Welcome to the Goat In The Shell AI Backend"}

@app.get("/health")
async def health():
    logger.info("Health check endpoint accessed")
    return {"status": "ok"}

@app.post("/command", response_model=CommandResponse)
async def process_command(request: CommandRequest):
    logger.info(f"Command received: {request.command}")
    try:
        # Process the command using the AI handler
        result = await AIHandler.process_command(request.command)
        
        logger.info("Command processed successfully")
        if result.get("parameter_modifications"):
            logger.info(f"Parameter modifications: {result['parameter_modifications']}")
        
        return CommandResponse(
            response=result["response"],
            success=result["success"],
            parameter_modifications=result.get("parameter_modifications", [])
        )
    except Exception as e:
        logger.error(f"Error processing command: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/parameters")
async def get_parameters():
    """
    Get information about all available parameters.
    """
    parameters = [
        {"key": "gravity", "description": "Controls how quickly objects fall", "range": "(-1 = half gravity, 1 = double gravity)"},
        {"key": "dart_speed", "description": "Controls how fast darts move", "range": "(-1 = slower, 1 = faster)"},
        {"key": "dart_frequency", "description": "Controls how often darts are fired", "range": "(-1 = less frequent, 1 = more frequent)"},
        {"key": "dart_wall_height", "description": "Controls the height of dart walls", "range": "(-1 = shorter, 1 = taller)"},
        {"key": "platform_height", "description": "Controls the height of platforms", "range": "(-1 = thinner, 1 = thicker)"},
        {"key": "platform_width", "description": "Controls the width of platforms", "range": "(-1 = narrower, 1 = wider)"},
        {"key": "spike_height", "description": "Controls the height of spike platforms", "range": "(-1 = shorter, 1 = taller)"},
        {"key": "spike_width", "description": "Controls the width of spike platforms", "range": "(-1 = narrower, 1 = wider)"},
        {"key": "oscillator_height", "description": "Controls the height of oscillating platforms", "range": "(-1 = thinner, 1 = thicker)"},
        {"key": "oscillator_width", "description": "Controls the width of oscillating platforms", "range": "(-1 = narrower, 1 = wider)"},
        {"key": "shield_height", "description": "Controls the height of shield blocks", "range": "(-1 = shorter, 1 = taller)"},
        {"key": "shield_width", "description": "Controls the width of shield blocks", "range": "(-1 = narrower, 1 = wider)"},
        {"key": "gap_width", "description": "Controls the width of gaps between ground segments", "range": "(-1 = narrower, 1 = wider)"},
        {"key": "tilt", "description": "Controls the angle (tilt) of platforms in degrees", "range": "(-1 = tilted left, 1 = tilted right)"}
    ]
    
    return {"parameters": parameters}

# Create a new lobby
@app.get("/create-lobby")
async def create_lobby():
    lobby_code = manager.generate_lobby_code()
    return {"lobby_code": lobby_code}

# Check if a lobby exists
@app.get("/check-lobby/{lobby_code}")
async def check_lobby(lobby_code: str):
    exists = lobby_code in manager.active_connections
    player_count = 0
    has_goat = False
    has_prompter = False
    
    if exists and lobby_code in manager.lobby_info:
        info = manager.lobby_info[lobby_code]
        player_count = info.get("player_count", 0)
        has_goat = info.get("has_goat", False)
        has_prompter = info.get("has_prompter", False)
    
    return {
        "exists": exists,
        "player_count": player_count,
        "has_goat": has_goat,
        "has_prompter": has_prompter
    }

# Check WebSocket server status
@app.get("/websocket-status")
async def websocket_status():
    """
    Get information about active WebSocket connections and lobbies.
    Useful for verifying that the WebSocket server is running correctly.
    """
    active_connections = sum(len(connections) for connections in manager.active_connections.values())
    active_lobbies = len(manager.active_connections)
    
    # Get details about each lobby
    lobbies = []
    for lobby_code, connections in manager.active_connections.items():
        if lobby_code in manager.lobby_info:
            info = manager.lobby_info[lobby_code]
            lobbies.append({
                "code": lobby_code,
                "connections": len(connections),
                "has_goat": info.get("has_goat", False),
                "has_prompter": info.get("has_prompter", False),
                "created_at": info.get("created_at", 0)
            })
    
    logger.info(f"WebSocket status check: {active_connections} connections across {active_lobbies} lobbies")
    
    return {
        "active_connections": active_connections,
        "active_lobbies": active_lobbies,
        "lobbies": lobbies,
        "websocket_server_running": True,
        "websocket_endpoint": "/ws/{lobby_code}/{player_role}",
        "test_connection": "To test WebSocket functionality, connect to /ws/TEST/spectator"
    }

# Endpoint for single player AI commands
@app.get("/ai-command")
async def get_ai_command():
    """
    Generate a random AI command for single player mode.
    Returns a command, response text, and any parameter modifications or obstacle placements.
    """
    try:
        result = await AIHandler.generate_single_player_command()
        logger.info(f"Generated AI command: {result}")
        return result
    except Exception as e:
        logger.error(f"Error generating AI command: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Simple WebSocket test endpoint
@app.websocket("/ws-test")
async def websocket_test(websocket: WebSocket):
    """A simple ping-pong endpoint for testing WebSocket functionality."""
    await websocket.accept()
    logger.info("WebSocket test connection established")
    
    try:
        # Send initial greeting
        await websocket.send_json({"message": "WebSocket test connection established", "type": "greeting"})
        
        # Ping-pong loop
        ping_count = 0
        while True:
            # Wait for a message
            data = await websocket.receive_json()
            ping_count += 1
            
            # Echo back the message with a count
            response = {
                "type": "pong",
                "message": f"Received: {data}",
                "ping_count": ping_count,
                "timestamp": time.time()
            }
            
            logger.info(f"WebSocket test ping-pong {ping_count}: {data}")
            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        logger.info("WebSocket test connection closed")
    except Exception as e:
        logger.error(f"WebSocket test error: {str(e)}")

# WebSocket endpoint for game communication
@app.websocket("/ws/{lobby_code}/{player_role}")
async def websocket_endpoint(websocket: WebSocket, lobby_code: str, player_role: str):
    if player_role not in ["goat", "prompter", "spectator"]:
        await websocket.close(code=1000, reason="Invalid player role")
        return
    
    connection_success = await manager.connect(websocket, lobby_code, player_role)
    if not connection_success:
        return  # Connection was rejected
        
    # Generate a session ID that can be used to authenticate with the game server
    session_id = str(uuid.uuid4())
    logger.info(f"Player {player_role} connected to lobby {lobby_code} with session ID: {session_id}")
    
    # Send welcome message with session information
    await manager.send_personal(websocket, {
        "type": "welcome",
        "message": f"Connected to lobby {lobby_code} as {player_role}",
        "session_id": session_id,
        "lobby_info": {
            "code": lobby_code,
            "player_count": manager.lobby_info[lobby_code]["player_count"] if lobby_code in manager.lobby_info else 0,
            "has_goat": manager.lobby_info[lobby_code]["has_goat"] if lobby_code in manager.lobby_info else False,
            "has_prompter": manager.lobby_info[lobby_code]["has_prompter"] if lobby_code in manager.lobby_info else False,
        }
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Get connection information
            current_lobby, current_role = manager.get_connection_info(websocket)
            logger.info(f"Received message from {current_role} in lobby {current_lobby}: {data.get('type', 'unknown')}")
            
            # Process message based on type
            message_type = data.get("type")
            
            if message_type == "start_game":
                # Only prompter (host) can start the game
                if current_role != "prompter":
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "Only host can start the game"
                    })
                    continue
                
                # Check if both players are in the lobby
                if current_lobby in manager.lobby_info and manager.lobby_info[current_lobby]["has_goat"] and manager.lobby_info[current_lobby]["has_prompter"]:
                    # Broadcast lobby readiness status - Game server will handle actual game start
                    await manager.broadcast(current_lobby, {
                        "type": "lobby_ready",
                        "message": "Lobby ready to start game"
                    })
                    logger.info(f"Lobby {current_lobby} ready - players can connect to game server")
                else:
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "Cannot ready lobby: need both goat and prompter players"
                    })
            
            elif message_type == "command":
                if current_role != "prompter" and current_role != "spectator":
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "Only prompter can send commands"
                    })
                    continue
                
                # Process the command
                command = data.get("command", "")
                try:
                    result = await AIHandler.process_command(command)
                    
                    # Send the command result back to the requester only
                    # Game server will handle distributing game effects
                    await manager.send_personal(websocket, {
                        "type": "command_result",
                        "result": result
                    })
                except Exception as e:
                    logger.error(f"Error processing command: {str(e)}")
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": f"Error processing command: {str(e)}"
                    })
            
            elif message_type == "ping":
                # Get current lobby information
                lobby_info = {}
                if current_lobby in manager.lobby_info:
                    lobby_info = {
                        "code": current_lobby,
                        "player_count": manager.lobby_info[current_lobby]["player_count"],
                        "has_goat": manager.lobby_info[current_lobby]["has_goat"],
                        "has_prompter": manager.lobby_info[current_lobby]["has_prompter"]
                    }
                
                # Respond to ping requests with a pong message and lobby info
                await manager.send_personal(websocket, {
                    "type": "pong",
                    "timestamp": data.get("timestamp", 0),
                    "lobby_info": lobby_info
                })
                
                # If the ping specifically requests lobby info, also send a system message
                if data.get("requestLobbyInfo"):
                    await manager.send_personal(websocket, {
                        "type": "system_message",
                        "message": "Lobby status update",
                        "lobby_info": lobby_info
                    })
            
            elif message_type == "get_session_token":
                # Generate a session token for game server authentication
                token = str(uuid.uuid4())
                await manager.send_personal(websocket, {
                    "type": "session_token",
                    "token": token,
                    "expires": time.time() + 3600  # Token valid for 1 hour
                })
                logger.info(f"Generated session token for player in lobby {current_lobby}")
            
            else:
                # Unknown message type - inform client that game state messages should go to game server
                logger.warning(f"Unsupported message type: {message_type}")
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": f"This server only handles lobby management and AI commands. Game state messages should be sent to the game server."
                })
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        await manager.disconnect(websocket)
    
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await manager.disconnect(websocket)

# Add a validation endpoint for the game server to use
@app.get("/validate-session/{lobby_code}/{session_id}")
async def validate_session(lobby_code: str, session_id: str):
    """
    Validate a session ID for the game server.
    Game server will call this to verify that a player is allowed to join a game.
    """
    # Simple validation - in a real implementation, we would check against stored session IDs
    is_valid = len(session_id) == 36  # Simple UUID validation
    
    # Check if lobby exists
    lobby_exists = lobby_code in manager.active_connections
    
    return {
        "valid": is_valid and lobby_exists,
        "lobby_code": lobby_code,
        "message": "Session validated" if (is_valid and lobby_exists) else "Invalid session or lobby",
        "player_count": len(manager.active_connections.get(lobby_code, [])),
        "has_goat": manager.lobby_info.get(lobby_code, {}).get("has_goat", False),
        "has_prompter": manager.lobby_info.get(lobby_code, {}).get("has_prompter", False)
    }

# Add an endpoint to forward AI commands to the game server
@app.post("/forward-command")
async def forward_command(request: CommandRequest):
    """
    Process an AI command and forward the results to the game server.
    Game server will call this when it receives commands from the prompter.
    """
    try:
        result = await AIHandler.process_command(request.command)
        return result
    except Exception as e:
        logger.error(f"Error processing forwarded command: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# This is used when running the app directly
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting uvicorn server")
    port = int(os.getenv("PORT", "8000"))
    logger.info(f"Using port: {port}")
    logger.info("NOTE: This server now only handles lobby management and AI commands.")
    logger.info("Game state synchronization will be handled by the Node.js game server.")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)