from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import logging
from dotenv import load_dotenv
from ai_handler import AIHandler

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

# Define response model
class CommandResponse(BaseModel):
    response: str
    success: bool

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
        return CommandResponse(
            response=result["response"],
            success=result["success"]
        )
    except Exception as e:
        logger.error(f"Error processing command: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Later we'll add OpenAI integration here

# This is used when running the app directly
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting uvicorn server")
    port = int(os.getenv("PORT", "8000"))
    logger.info(f"Using port: {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True) 