import os
import json
import random
import asyncio
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize OpenAI client with error handling
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.warning("OPENAI_API_KEY environment variable not set or empty!")

try:
    client = OpenAI(api_key=api_key)
    logger.info("OpenAI client initialized successfully")
except Exception as e:
    logger.error(f"Error initializing OpenAI client: {str(e)}")
    # Create a dummy client that will be replaced with proper error handling
    client = None

# Parameter modification schema
class ParameterModification(BaseModel):
    parameter: str
    normalized_value: float

# Obstacle placement schema
class ObstaclePlacement(BaseModel):
    obstacle_type: str

# Define game parameters context for the system prompt
PARAMETER_CONTEXT = """
You can modify the following game parameters using normalized values between -1 and 1:

- gravity: Controls how quickly objects fall (0 = normal, -1 = half gravity, 1 = double gravity)
- dart_speed: Controls how fast darts move horizontally (0 = normal, -1 = slower, 1 = faster)
- dart_frequency: Controls how often darts are fired (0 = every 3 seconds, -1 = less frequent, 1 = more frequent)
- dart_wall_height: Controls the height of dart walls (0 = normal, -1 = shorter, 1 = taller)
- platform_height: Controls the height of platforms (0 = normal, -1 = thinner, 1 = thicker)
- platform_width: Controls the width of platforms (0 = normal, -1 = narrower, 1 = wider)
- spike_height: Controls the height of spike platforms (0 = normal, -1 = shorter, 1 = taller)
- spike_width: Controls the width of spike platforms (0 = normal, -1 = narrower, 1 = wider)
- oscillator_height: Controls the height of oscillating platforms (0 = normal, -1 = thinner, 1 = thicker)
- oscillator_width: Controls the width of oscillating platforms (0 = normal, -1 = narrower, 1 = wider)
- shield_height: Controls the height of shield blocks (0 = normal, -1 = shorter, 1 = taller)
- shield_width: Controls the width of shield blocks (0 = normal, -1 = narrower, 1 = wider)
- gap_width: Controls the width of gaps between ground segments (0 = normal, -1 = narrower, 1 = wider)
- tilt: Controls the angle (tilt) of platforms in degrees (0 = flat, -1 = tilted left, 1 = tilted right)

When a user asks to modify game parameters (e.g., "make gravity stronger", "slow down the darts"), respond with:
1. A brief natural language explanation of the changes
2. A structured parameter_modifications array with the appropriate changes

Example commands and responses:

User: "Make the gravity weaker"
Response: "Reducing gravity by 30%. The goat will now jump higher and fall more slowly."
Parameter modifications: [{"parameter": "gravity", "normalized_value": -0.3}]

User: "Speed up the darts and make platforms wider"
Response: "Increasing dart speed by 40% and making platforms 50% wider."
Parameter modifications: [{"parameter": "dart_speed", "normalized_value": 0.4}, {"parameter": "platform_width", "normalized_value": 0.5}]

User: "Make everything more challenging"
Response: "Creating a more challenging environment with stronger gravity, faster darts, and narrower platforms."
Parameter modifications: [{"parameter": "gravity", "normalized_value": 0.3}, {"parameter": "dart_speed", "normalized_value": 0.4}, {"parameter": "platform_width", "normalized_value": -0.3}]
"""

# Main system prompt for the AI
SYSTEM_PROMPT = f"""
You are the AI assistant for 'Goat In The Shell', a challenging platformer game where the player controls a goat navigating obstacles.

The game features:
- A goat character that can jump and move left/right
- Platforms for the goat to navigate
- Dart traps that shoot tranquilizer darts (cause game over if they hit the goat)
- Spike platforms that cause game over on contact
- Oscillating (moving) platforms
- Shield blocks that can block darts
- Gaps that the goat can fall through (causing game over)

{PARAMETER_CONTEXT}

Players use a terminal to enter commands, which you interpret to control the game. Be helpful, concise, and creative.
"""

# Additional prompt for AI single player mode
AI_SINGLE_PLAYER_PROMPT = f"""
You are the AI prompter for 'Goat In The Shell' single player mode. Your job is to generate challenging commands that will make the gameplay more interesting for the player who is controlling the goat.

Generate a command that will either:
1. Place an obstacle (platform, dart wall, spike, oscillator, or shield)
2. Modify game parameters to change the difficulty

Be creative and unpredictable. Mix obstacle placement with parameter changes to provide variety. Your objective is to make the game challenging but not impossible.

{PARAMETER_CONTEXT}

In addition to parameter modifications, you can place these obstacles:
- "platform" - A stable platform for the goat to jump on
- "dart_wall" - A wall that shoots darts that can tranquilize the goat
- "spike" - A dangerous platform that causes game over on contact
- "oscillator" - A moving platform that oscillates horizontally
- "shield" - A block that can protect the goat from darts
"""

# Function definition for OpenAI's function calling
PARAMETER_MODIFICATION_FUNCTION = {
    "name": "modify_parameters",
    "description": "Modify game parameters based on user commands",
    "parameters": {
        "type": "object",
        "properties": {
            "response": {
                "type": "string",
                "description": "A natural language explanation of the parameter changes"
            },
            "parameter_modifications": {
                "type": "array",
                "description": "List of parameter modifications to apply",
                "items": {
                    "type": "object",
                    "properties": {
                        "parameter": {
                            "type": "string",
                            "description": "The parameter to modify",
                            "enum": [
                                "gravity", "dart_speed", "dart_frequency", "dart_wall_height",
                                "platform_height", "platform_width", "spike_height", "spike_width",
                                "oscillator_height", "oscillator_width", "shield_height", "shield_width",
                                "gap_width", "tilt"
                            ]
                        },
                        "normalized_value": {
                            "type": "number",
                            "description": "The normalized value between -1 and 1 to set the parameter to",
                            "minimum": -1,
                            "maximum": 1
                        }
                    },
                    "required": ["parameter", "normalized_value"]
                }
            }
        },
        "required": ["response", "parameter_modifications"]
    }
}

# Function definition for obstacle placement
OBSTACLE_PLACEMENT_FUNCTION = {
    "name": "place_obstacle",
    "description": "Place an obstacle in the game",
    "parameters": {
        "type": "object",
        "properties": {
            "response": {
                "type": "string",
                "description": "A natural language explanation of the obstacle being placed"
            },
            "obstacle_type": {
                "type": "string",
                "description": "The type of obstacle to place",
                "enum": ["platform", "dart_wall", "spike", "oscillator", "shield"]
            },
            "parameter_modifications": {
                "type": "array",
                "description": "Optional parameter modifications to apply along with the obstacle",
                "items": {
                    "type": "object",
                    "properties": {
                        "parameter": {
                            "type": "string",
                            "description": "The parameter to modify",
                            "enum": [
                                "gravity", "dart_speed", "dart_frequency", "dart_wall_height",
                                "platform_height", "platform_width", "spike_height", "spike_width",
                                "oscillator_height", "oscillator_width", "shield_height", "shield_width",
                                "gap_width", "tilt"
                            ]
                        },
                        "normalized_value": {
                            "type": "number",
                            "description": "The normalized value between -1 and 1 to set the parameter to",
                            "minimum": -1,
                            "maximum": 1
                        }
                    },
                    "required": ["parameter", "normalized_value"]
                }
            }
        },
        "required": ["response", "obstacle_type"]
    }
}

# Cache for single player AI commands to avoid repeated calls in a short time
class CommandCache:
    """Simple cache for AI-generated commands in single player mode."""
    
    def __init__(self, capacity=20):
        self.capacity = capacity
        self.cache = []
        self.last_accessed = {}
    
    def add(self, command):
        """Add a command to the cache."""
        if command in self.cache:
            return
        
        if len(self.cache) >= self.capacity:
            # Remove least recently used command
            lru_command = min(self.last_accessed.keys(), key=lambda k: self.last_accessed[k])
            self.cache.remove(lru_command)
            del self.last_accessed[lru_command]
        
        self.cache.append(command)
        self.last_accessed[command] = time.time()
    
    def get_random(self):
        """Get a random command from the cache."""
        if not self.cache:
            return None
        
        command = random.choice(self.cache)
        self.last_accessed[command] = time.time()
        return command

# Initialize command cache
command_cache = CommandCache()

# Predefined single player commands for fallback
FALLBACK_COMMANDS = [
    "place a platform ahead of the player",
    "add a dart wall",
    "create a spike platform",
    "add an oscillating platform",
    "place a shield block",
    "increase gravity by 20%",
    "make darts faster",
    "slow down dart frequency",
    "make platforms narrower",
    "tilt platforms to the right",
    "make spikes taller",
    "increase gap width",
    "create obstacles ahead of the player",
    "place multiple dart walls",
    "make the level more challenging"
]

class AIHandler:
    """Handler for AI-related operations using OpenAI."""
    
    @staticmethod
    async def process_command(command: str) -> dict:
        """
        Process a text command using OpenAI and return a structured response.
        
        Args:
            command: The text command from the user
            
        Returns:
            A dictionary containing the AI response, success flag, and parameter modifications
        """
        try:
            # Check if client is properly initialized
            if client is None:
                return {
                    "response": "AI service is currently unavailable. Please check the server configuration.",
                    "success": False,
                    "parameter_modifications": []
                }
                
            # Call OpenAI API to process the command with function calling
            response = client.chat.completions.create(
                model="gpt-4o",  # Using GPT-4o for best results
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": command}
                ],
                tools=[{"type": "function", "function": PARAMETER_MODIFICATION_FUNCTION}],
                tool_choice="auto",
                max_tokens=500,
                temperature=0.7,
            )
            
            # Extract the response and any parameter modifications
            message = response.choices[0].message
            parameter_modifications = []
            
            # Check if there's a function call
            if message.tool_calls:
                # Extract function arguments (parameter modifications)
                for tool_call in message.tool_calls:
                    if tool_call.function.name == "modify_parameters":
                        try:
                            args = json.loads(tool_call.function.arguments)
                            ai_response = args.get("response", "")
                            parameter_mods = args.get("parameter_modifications", [])
                            
                            # Validate each parameter modification
                            for mod in parameter_mods:
                                if not isinstance(mod, dict):
                                    continue
                                
                                param = mod.get("parameter")
                                value = mod.get("normalized_value")
                                
                                if param and isinstance(value, (int, float)):
                                    # Ensure value is between -1 and 1
                                    normalized_value = max(-1.0, min(1.0, float(value)))
                                    parameter_modifications.append({
                                        "parameter": param,
                                        "normalized_value": normalized_value
                                    })
                        except json.JSONDecodeError:
                            logger.error(f"Failed to parse function arguments: {tool_call.function.arguments}")
                            ai_response = message.content or "I understood your request but couldn't process the parameters correctly."
            else:
                # No function call, just use the content
                ai_response = message.content
            
            # Log the parameter modifications
            if parameter_modifications:
                logger.info(f"Parameter modifications: {parameter_modifications}")
            
            return {
                "response": ai_response,
                "success": True,
                "parameter_modifications": parameter_modifications
            }
            
        except Exception as e:
            logger.error(f"Error processing command: {str(e)}")
            return {
                "response": f"Error processing command: {str(e)}",
                "success": False,
                "parameter_modifications": []
            }
    
    @staticmethod
    async def generate_single_player_command() -> dict:
        """
        Generate a random command for single player AI mode.
        
        Returns:
            A dictionary containing the command, response, success flag, and parameter modifications or obstacle info
        """
        try:
            # Check if there's a cached command we can use
            cached_command = command_cache.get_random()
            if cached_command and random.random() < 0.7:  # 70% chance to use cache
                logger.info(f"Using cached command: {cached_command}")
                return await AIHandler.process_command(cached_command)
            
            # Check if client is properly initialized
            if client is None:
                # Use a fallback command if AI is unavailable
                fallback = random.choice(FALLBACK_COMMANDS)
                logger.warning(f"AI unavailable, using fallback command: {fallback}")
                
                # For fallback commands, we create a simple response
                if "platform" in fallback:
                    return {
                        "response": "Creating a platform for the goat to jump on.",
                        "success": True,
                        "obstacle_type": "platform",
                        "parameter_modifications": []
                    }
                elif "dart" in fallback:
                    return {
                        "response": "Adding a dart wall to increase the challenge.",
                        "success": True,
                        "obstacle_type": "dart_wall",
                        "parameter_modifications": []
                    }
                elif "spike" in fallback:
                    return {
                        "response": "Placing a dangerous spike platform.",
                        "success": True,
                        "obstacle_type": "spike",
                        "parameter_modifications": []
                    }
                elif "oscillat" in fallback:
                    return {
                        "response": "Creating a moving oscillator platform.",
                        "success": True,
                        "obstacle_type": "oscillator",
                        "parameter_modifications": []
                    }
                elif "shield" in fallback:
                    return {
                        "response": "Adding a shield block to protect from darts.",
                        "success": True,
                        "obstacle_type": "shield",
                        "parameter_modifications": []
                    }
                else:
                    # For parameter modifications, randomly adjust one parameter
                    param = random.choice([
                        "gravity", "dart_speed", "dart_frequency", "platform_width", "tilt"
                    ])
                    value = random.uniform(-0.5, 0.5)  # Random value between -0.5 and 0.5
                    return {
                        "response": f"Adjusting {param} to change the difficulty.",
                        "success": True,
                        "parameter_modifications": [{
                            "parameter": param,
                            "normalized_value": value
                        }]
                    }
            
            # Decide whether to place an obstacle or modify parameters
            if random.random() < 0.7:  # 70% chance to place an obstacle
                # Generate a random obstacle placement command
                tools = [{"type": "function", "function": OBSTACLE_PLACEMENT_FUNCTION}]
                tool_choice = {"type": "function", "function": {"name": "place_obstacle"}}
            else:
                # Generate a random parameter modification command
                tools = [{"type": "function", "function": PARAMETER_MODIFICATION_FUNCTION}]
                tool_choice = {"type": "function", "function": {"name": "modify_parameters"}}
            
            # Call OpenAI API to generate a random command
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": AI_SINGLE_PLAYER_PROMPT},
                    {"role": "user", "content": "Generate a random command to make the game more challenging."}
                ],
                tools=tools,
                tool_choice=tool_choice,
                max_tokens=200,
                temperature=0.9,  # Higher temperature for more variety
            )
            
            # Extract the response and process it
            message = response.choices[0].message
            
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    try:
                        args = json.loads(tool_call.function.arguments)
                        
                        if tool_call.function.name == "place_obstacle":
                            # Process obstacle placement
                            obstacle_type = args.get("obstacle_type", "platform")
                            ai_response = args.get("response", f"Placing a {obstacle_type}")
                            parameter_mods = args.get("parameter_modifications", [])
                            
                            # Add the command to the cache if it's good
                            command_to_cache = f"place a {obstacle_type}"
                            command_cache.add(command_to_cache)
                            
                            # Validate parameter modifications if any
                            validated_mods = []
                            for mod in parameter_mods:
                                if not isinstance(mod, dict):
                                    continue
                                
                                param = mod.get("parameter")
                                value = mod.get("normalized_value")
                                
                                if param and isinstance(value, (int, float)):
                                    normalized_value = max(-1.0, min(1.0, float(value)))
                                    validated_mods.append({
                                        "parameter": param,
                                        "normalized_value": normalized_value
                                    })
                            
                            return {
                                "response": ai_response,
                                "success": True,
                                "obstacle_type": obstacle_type,
                                "parameter_modifications": validated_mods
                            }
                            
                        elif tool_call.function.name == "modify_parameters":
                            # Process parameter modification
                            ai_response = args.get("response", "Modifying game parameters")
                            parameter_mods = args.get("parameter_modifications", [])
                            
                            # Add the response to the cache
                            if ai_response and len(ai_response) < 100:
                                command_cache.add(ai_response)
                            
                            # Validate parameter modifications
                            validated_mods = []
                            for mod in parameter_mods:
                                if not isinstance(mod, dict):
                                    continue
                                
                                param = mod.get("parameter")
                                value = mod.get("normalized_value")
                                
                                if param and isinstance(value, (int, float)):
                                    normalized_value = max(-1.0, min(1.0, float(value)))
                                    validated_mods.append({
                                        "parameter": param,
                                        "normalized_value": normalized_value
                                    })
                            
                            return {
                                "response": ai_response,
                                "success": True,
                                "parameter_modifications": validated_mods
                            }
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse function arguments: {tool_call.function.arguments}")
            
            # Fallback if no valid tool call was processed
            fallback = random.choice(FALLBACK_COMMANDS)
            logger.warning(f"No valid tool call generated, using fallback: {fallback}")
            return await AIHandler.process_command(fallback)
            
        except Exception as e:
            logger.error(f"Error generating AI command: {str(e)}")
            # Use a simple fallback in case of error
            obstacle_types = ["platform", "dart_wall", "spike", "oscillator", "shield"]
            obstacle_type = random.choice(obstacle_types)
            return {
                "response": f"Placing a {obstacle_type} to challenge the player.",
                "success": True,
                "obstacle_type": obstacle_type,
                "parameter_modifications": []
            } 