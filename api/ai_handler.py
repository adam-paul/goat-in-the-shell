import os
import json
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