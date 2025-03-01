#!/usr/bin/env python3
"""
WebSocket Test Client for Goat in the Shell multiplayer backend

This script provides a simple way to test the WebSocket functionality of the backend.
Run this script while the FastAPI server is running to verify WebSocket connectivity.

Usage:
  python test_websocket.py [--url ws://localhost:8000/ws-test]
"""

import asyncio
import json
import argparse
import websockets
import logging
import time
import sys
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

async def test_basic_connection(url):
    """Test the basic WebSocket test endpoint with ping-pong."""
    logger.info(f"Connecting to {url}")
    
    try:
        async with websockets.connect(url) as websocket:
            logger.info("Connection established!")
            
            # Wait for initial greeting
            response = await websocket.recv()
            response_data = json.loads(response)
            logger.info(f"Received greeting: {response_data}")
            
            # Send ping messages every second
            for i in range(5):
                ping_message = {
                    "type": "ping",
                    "message": f"Ping #{i+1}",
                    "timestamp": time.time()
                }
                
                logger.info(f"Sending: {ping_message}")
                await websocket.send(json.dumps(ping_message))
                
                # Wait for response
                response = await websocket.recv()
                response_data = json.loads(response)
                
                # Calculate roundtrip time
                roundtrip = time.time() - response_data.get("timestamp", time.time())
                logger.info(f"Received: {response_data}")
                logger.info(f"Round-trip time: {roundtrip*1000:.2f}ms")
                
                await asyncio.sleep(1)
            
            logger.info("Basic connection test completed successfully!")
            
    except Exception as e:
        logger.error(f"Error in WebSocket connection: {str(e)}")
        return False
    
    return True

async def test_multiplayer_connection(lobby_code="TEST", role="spectator"):
    """Test connection to the multiplayer WebSocket endpoint."""
    url = f"ws://localhost:8000/ws/{lobby_code}/{role}"
    logger.info(f"Connecting to multiplayer endpoint: {url}")
    
    try:
        async with websockets.connect(url) as websocket:
            logger.info(f"Multiplayer connection established as {role} in lobby {lobby_code}!")
            
            # Wait for system message
            response = await websocket.recv()
            response_data = json.loads(response)
            logger.info(f"Received system message: {response_data}")
            
            # Send ping message
            ping_message = {
                "type": "ping",
                "timestamp": time.time()
            }
            
            logger.info(f"Sending ping to multiplayer server")
            await websocket.send(json.dumps(ping_message))
            
            # Wait for pong response
            response = await websocket.recv()
            response_data = json.loads(response)
            logger.info(f"Received response: {response_data}")
            
            # Send player state update if testing as goat
            if role == "goat":
                state_message = {
                    "type": "player_state",
                    "data": {
                        "position": {"x": 100, "y": 200},
                        "velocity": {"x": 5, "y": 0},
                        "isOnGround": True
                    },
                    "timestamp": time.time()
                }
                
                logger.info(f"Sending player state update")
                await websocket.send(json.dumps(state_message))
                
                # Wait for a moment to see if any responses come
                await asyncio.sleep(1)
            
            # Send command if testing as prompter
            if role == "prompter":
                command_message = {
                    "type": "command",
                    "command": "make gravity stronger",
                    "timestamp": time.time()
                }
                
                logger.info(f"Sending command")
                await websocket.send(json.dumps(command_message))
                
                # Wait for command response
                response = await websocket.recv()
                response_data = json.loads(response)
                logger.info(f"Received command response: {response_data}")
            
            # Keep the connection open a bit longer to receive any broadcasts
            await asyncio.sleep(3)
            
            logger.info("Multiplayer connection test completed!")
            
    except Exception as e:
        logger.error(f"Error in multiplayer WebSocket connection: {str(e)}")
        return False
    
    return True

async def test_singleplayer_connection():
    """Test connection to the single player AI mode."""
    url = f"ws://localhost:8000/ws/SINGLEPLAYER/goat"
    logger.info(f"Connecting to single player endpoint: {url}")
    
    try:
        async with websockets.connect(url) as websocket:
            logger.info(f"Single player connection established!")
            
            # Wait for system message
            response = await websocket.recv()
            response_data = json.loads(response)
            logger.info(f"Received system message: {response_data}")
            
            # Wait for AI command (should arrive within 5 seconds)
            logger.info("Waiting for AI command...")
            
            # Set a timeout to prevent hanging indefinitely
            try:
                # Wait for AI command with timeout
                response = await asyncio.wait_for(websocket.recv(), timeout=10)
                response_data = json.loads(response)
                logger.info(f"Received AI command: {response_data}")
                
                # Simulate player state updates
                for i in range(3):
                    state_message = {
                        "type": "player_state",
                        "data": {
                            "position": {"x": 100 + i*50, "y": 200},
                            "velocity": {"x": 5, "y": 0},
                            "isOnGround": True
                        },
                        "timestamp": time.time()
                    }
                    
                    logger.info(f"Sending player state update #{i+1}")
                    await websocket.send(json.dumps(state_message))
                    await asyncio.sleep(1)
                
                # Simulate game event (e.g., player reaching goal)
                event_message = {
                    "type": "game_event",
                    "data": {
                        "event_type": "win",
                        "timestamp": time.time()
                    }
                }
                
                logger.info("Sending game win event")
                await websocket.send(json.dumps(event_message))
                
                # Wait for a moment to see if any responses come
                await asyncio.sleep(3)
                
            except asyncio.TimeoutError:
                logger.warning("Timeout waiting for AI command")
            
            logger.info("Single player connection test completed!")
            
    except Exception as e:
        logger.error(f"Error in single player WebSocket connection: {str(e)}")
        return False
    
    return True

async def run_all_tests():
    """Run all WebSocket tests."""
    logger.info("=== Starting WebSocket Tests ===")
    logger.info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("-------------------------------")
    
    # Test basic connection
    logger.info("\n1. Testing basic WebSocket connection")
    basic_success = await test_basic_connection("ws://localhost:8000/ws-test")
    
    # Test multiplayer connection as spectator
    logger.info("\n2. Testing multiplayer connection as spectator")
    multi_spectator_success = await test_multiplayer_connection("TEST", "spectator")
    
    # Test multiplayer connection as goat
    logger.info("\n3. Testing multiplayer connection as goat")
    multi_goat_success = await test_multiplayer_connection("TEST2", "goat")
    
    # Test multiplayer connection as prompter
    logger.info("\n4. Testing multiplayer connection as prompter")
    multi_prompter_success = await test_multiplayer_connection("TEST3", "prompter")
    
    # Test single player connection
    logger.info("\n5. Testing single player connection")
    singleplayer_success = await test_singleplayer_connection()
    
    # Summarize results
    logger.info("\n=== Test Results ===")
    logger.info(f"Basic WebSocket Test: {'✅ PASS' if basic_success else '❌ FAIL'}")
    logger.info(f"Multiplayer (Spectator): {'✅ PASS' if multi_spectator_success else '❌ FAIL'}")
    logger.info(f"Multiplayer (Goat): {'✅ PASS' if multi_goat_success else '❌ FAIL'}")
    logger.info(f"Multiplayer (Prompter): {'✅ PASS' if multi_prompter_success else '❌ FAIL'}")
    logger.info(f"Single Player: {'✅ PASS' if singleplayer_success else '❌ FAIL'}")
    
    # Check WebSocket status endpoint
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8000/websocket-status") as response:
                status = await response.json()
                logger.info("\nWebSocket Server Status:")
                logger.info(f"  Active Connections: {status['active_connections']}")
                logger.info(f"  Active Lobbies: {status['active_lobbies']}")
                
                if status["lobbies"]:
                    logger.info("  Lobbies:")
                    for lobby in status["lobbies"]:
                        logger.info(f"    {lobby['code']}: {lobby['connections']} connections | " +
                                  f"Goat: {'✓' if lobby['has_goat'] else '✗'} | " +
                                  f"Prompter: {'✓' if lobby['has_prompter'] else '✗'}")
    except Exception as e:
        logger.error(f"Error checking WebSocket status: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test WebSocket functionality for Goat in the Shell")
    parser.add_argument("--url", default="ws://localhost:8000/ws-test", help="WebSocket URL to test")
    parser.add_argument("--all", action="store_true", help="Run all tests")
    parser.add_argument("--multiplayer", action="store_true", help="Test multiplayer connection")
    parser.add_argument("--singleplayer", action="store_true", help="Test single player connection")
    parser.add_argument("--role", default="spectator", choices=["goat", "prompter", "spectator"], 
                        help="Role to use for multiplayer test")
    parser.add_argument("--lobby", default="TEST", help="Lobby code to use for multiplayer test")
    
    args = parser.parse_args()
    
    if args.all:
        asyncio.run(run_all_tests())
    elif args.multiplayer:
        asyncio.run(test_multiplayer_connection(args.lobby, args.role))
    elif args.singleplayer:
        asyncio.run(test_singleplayer_connection())
    else:
        asyncio.run(test_basic_connection(args.url))