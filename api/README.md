# Goat In The Shell - AI Backend

This is the FastAPI backend for the "Goat In The Shell" game, handling AI-powered text commands.

## Local Setup

1. Ensure you have Python 3.8+ installed
2. Set up the virtual environment:
   ```bash
   cd api
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ```

## Running Locally

Start the API server:

```bash
cd api
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

The API will be available at http://localhost:8000

## Deployment to Railway

### Important Notes for Railway Deployment

1. Make sure to set the `OPENAI_API_KEY` environment variable in Railway's dashboard.

2. When deploying to Railway:
   - Set the root directory to `/api` in your Railway project settings
   - Railway will automatically detect the Procfile or nixpacks.toml for build and start commands

3. The deployment should use the following files:
   - `nixpacks.toml` - Defines the build and start process
   - `Procfile` - Alternative to nixpacks.toml
   - `requirements.txt` - Lists all dependencies
   - `runtime.txt` - Specifies the Python version

## API Endpoints

### GET /

Returns a welcome message to confirm the API is running.

### GET /health

Returns a simple status check to verify the API is operational.

### POST /command

Process a text command and return an AI-generated response.

**Request Body:**
```json
{
  "command": "your text command here"
}
```

**Response:**
```json
{
  "response": "AI-generated response",
  "success": true
}
```

## Development

- The API uses FastAPI for the web framework
- OpenAI's API is used for processing text commands
- Environment variables are managed with python-dotenv

## Integration with Frontend

To call the API from your frontend:

```javascript
async function sendCommand(command) {
  const response = await fetch('https://your-railway-url/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command }),
  });
  
  return await response.json();
}
``` 