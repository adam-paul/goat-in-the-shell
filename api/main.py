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
        
        # Notify all clients in the lobby about the new connection
        await self.broadcast(
            lobby_code,
            {
                "type": "system_message",
                "message": f"Player joined as {player_role}",
                "lobby_info": {
                    "code": lobby_code,
                    "player_count": self.lobby_info[lobby_code]["player_count"],
                    "has_goat": self.lobby_info[lobby_code]["has_goat"],
                    "has_prompter": self.lobby_info[lobby_code]["has_prompter"]
                }
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
    
    # For single player AI mode
    is_single_player = (lobby_code == "SINGLEPLAYER" and player_role == "goat")
    
    connection_success = await manager.connect(websocket, lobby_code, player_role)
    if not connection_success:
        return  # Connection was rejected
        
    # Setup AI command timer for single player mode
    ai_command_task = None
    if is_single_player:
        logger.info("Setting up single player AI command timer")
        
        # Define the AI command timer function
        async def ai_command_timer():
            try:
                # Wait a few seconds before the first command to let the player get ready
                await asyncio.sleep(3)
                
                while True:
                    # Generate AI command
                    try:
                        result = await AIHandler.generate_single_player_command()
                        
                        # Send the AI command to the player
                        await manager.send_personal(websocket, {
                            "type": "ai_command",
                            "result": result
                        })
                        
                        logger.info(f"Sent AI command to single player: {result.get('response', '')}")
                    except Exception as e:
                        logger.error(f"Error in AI command timer: {str(e)}")
                    
                    # Wait 5 seconds before the next command
                    await asyncio.sleep(5)
            except asyncio.CancelledError:
                logger.info("AI command timer cancelled")
            except Exception as e:
                logger.error(f"Unexpected error in AI command timer: {str(e)}")
        
        # Start the AI command timer
        ai_command_task = asyncio.create_task(ai_command_timer())
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Get connection information
            current_lobby, current_role = manager.get_connection_info(websocket)
            logger.info(f"Received message from {current_role} in lobby {current_lobby}: {data.get('type', 'unknown')}")
            
            # Process message based on type
            message_type = data.get("type")
            
            if message_type == "command":
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
                    
                    # Broadcast the command result to everyone in the lobby
                    await manager.broadcast(current_lobby, {
                        "type": "command_result",
                        "result": result,
                        "from_role": current_role
                    })
                except Exception as e:
                    logger.error(f"Error processing command: {str(e)}")
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": f"Error processing command: {str(e)}"
                    })
            
            elif message_type == "player_state":
                if current_role != "goat":
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "Only goat player can send state updates"
                    })
                    continue
                
                # Broadcast player state to everyone else in the lobby
                await manager.broadcast(current_lobby, {
                    "type": "game_state",
                    "player_state": data.get("data", {}),
                    "timestamp": data.get("timestamp", 0)
                })
            
            elif message_type == "place_item":
                if current_role != "prompter" and not is_single_player:
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "Only prompter can place items"
                    })
                    continue
                
                # Broadcast item placement to everyone in the lobby
                await manager.broadcast(current_lobby, {
                    "type": "place_item",
                    "item_data": data.get("data", {}),
                    "from_role": current_role
                })
            
            elif message_type == "game_event":
                # Broadcast game events (win, loss, etc.) to everyone in the lobby
                await manager.broadcast(current_lobby, {
                    "type": "game_event",
                    "event_data": data.get("data", {}),
                    "from_role": current_role
                })
                
                # If the game is over in single player mode, pause the AI commands
                if is_single_player and data.get("event_type") in ["win", "gameover"]:
                    if ai_command_task and not ai_command_task.done():
                        logger.info("Pausing AI commands due to game event")
                        ai_command_task.cancel()
                        
                        # Restart the timer after a delay if the game continues
                        async def restart_ai():
                            await asyncio.sleep(5)  # Wait for 5 seconds
                            nonlocal ai_command_task
                            if not websocket.client_state == WebSocket.DISCONNECTED:
                                logger.info("Restarting AI command timer")
                                ai_command_task = asyncio.create_task(ai_command_timer())
                        
                        asyncio.create_task(restart_ai())
            
            elif message_type == "ping":
                # Respond to ping requests with a pong message
                await manager.send_personal(websocket, {
                    "type": "pong",
                    "timestamp": data.get("timestamp", 0)
                })
            
            else:
                # Unknown message type
                logger.warning(f"Unknown message type: {message_type}")
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        
        # Cancel AI command task if it's running
        if is_single_player and ai_command_task and not ai_command_task.done():
            ai_command_task.cancel()
        
        await manager.disconnect(websocket)
    
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        
        # Cancel AI command task if it's running
        if is_single_player and ai_command_task and not ai_command_task.done():
            ai_command_task.cancel()
        
        await manager.disconnect(websocket)

# This is used when running the app directly
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting uvicorn server")
    port = int(os.getenv("PORT", "8000"))
    logger.info(f"Using port: {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True) 