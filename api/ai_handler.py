import os
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

class AIHandler:
    """Handler for AI-related operations using OpenAI."""
    
    @staticmethod
    async def process_command(command: str) -> dict:
        """
        Process a text command using OpenAI and return a structured response.
        
        Args:
            command: The text command from the user
            
        Returns:
            A dictionary containing the AI response and any structured data
        """
        try:
            # Check if client is properly initialized
            if client is None:
                return {
                    "response": "AI service is currently unavailable. Please check the server configuration.",
                    "success": False
                }
                
            # Call OpenAI API to process the command
            response = client.chat.completions.create(
                model="gpt-4o",  # Using GPT-4o for best results
                messages=[
                    {"role": "system", "content": "You are the AI assistant for 'Goat In The Shell', a terminal-based game. Respond to user commands in a helpful, concise manner. Your responses should be informative but brief."},
                    {"role": "user", "content": command}
                ],
                max_tokens=150,
                temperature=0.7,
            )
            
            # Extract the response text
            ai_response = response.choices[0].message.content
            
            return {
                "response": ai_response,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error processing command: {str(e)}")
            return {
                "response": f"Error processing command: {str(e)}",
                "success": False
            } 