import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
            return {
                "response": f"Error processing command: {str(e)}",
                "success": False
            } 