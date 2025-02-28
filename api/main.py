from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from openai import OpenAI
from ai_handler import AIHandler

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize FastAPI app
app = FastAPI(title="Goat In The Shell AI Backend")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request model
class CommandRequest(BaseModel):
    command: str

# Define response model
class CommandResponse(BaseModel):
    response: str
    success: bool

@app.get("/")
async def root():
    return {"message": "Welcome to the Goat In The Shell AI Backend"}

@app.post("/command", response_model=CommandResponse)
async def process_command(request: CommandRequest):
    try:
        # Process the command using the AI handler
        result = await AIHandler.process_command(request.command)
        
        return CommandResponse(
            response=result["response"],
            success=result["success"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Later we'll add OpenAI integration here

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 