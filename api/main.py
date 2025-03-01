from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
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

# This is used when running the app directly
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting uvicorn server")
    port = int(os.getenv("PORT", "8000"))
    logger.info(f"Using port: {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True) 