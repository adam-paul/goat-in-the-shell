# Goat In The Shell - AI Backend

This is the FastAPI backend for the "Goat In The Shell" game, handling AI-powered text commands.

## Setup

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

## Running the API

Start the API server:

```bash
cd api
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

The API will be available at http://localhost:8000

## API Endpoints

### GET /

Returns a welcome message to confirm the API is running.

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
  const response = await fetch('http://localhost:8000/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command }),
  });
  
  return await response.json();
}
``` 