# Goat in the Shell

A multiplayer platformer game with server-authoritative architecture where you control a goat navigating through challenging levels while avoiding deadly obstacles. The game features a unique AI-powered command terminal for dynamic obstacle placement.

## Architecture Migration 

The project has been refactored from a client-centric architecture to a server-authoritative multiplayer system:

- **Client**: Handles rendering and input capture
- **Server**: Runs game physics and logic using Matter.js
- **WebSockets**: Real-time communication between client and server

## Concept

This game is a challenging 2D platformer where you:

1. **Control a Goat**: Navigate from the starting point (bottom left) to the endpoint (top right)
2. **Avoid Obstacles**: Dart traps, spikes, and gaps can instantly end your game
3. **Build the Level**: Place platforms and obstacles using direct selection or AI commands
4. **Master Platforming**: Jump between platforms and navigate around obstacles
5. **Progress Through Rounds**: Each round adds new challenges with a countdown timer
6. **Play with Friends**: Connect with other players in multiplayer mode

## Environment Variables

This project requires environment variables for both the frontend and backend:

1. Copy the `.env.example` file to a new file named `.env`:
   ```
   cp .env.example .env
   ```

2. Update the `.env` file with your credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   ```

3. These environment variables are automatically loaded by Vite and the backend.

## Current Features

- Responsive platformer mechanics with goat character movement and jumping
- Server-authoritative physics using Matter.js
- Procedurally generated goat and level graphics
- Multiple obstacles: dart traps, spikes, platforms, and gaps
- AI-powered command terminal for dynamic obstacle placement
- Round-based gameplay with countdown timer
- Three death conditions: dart hit (tranquilized effect), spike contact, falling through gaps
- Item placement system: platforms, spikes, oscillators, shields, dart walls
- Multiplayer support with lobbies
- Win and lose conditions with appropriate feedback
- Interactive UI with modals for deaths, tutorials, and item selection

## Technologies Used

- React 19
- TypeScript
- Phaser 3 for client-side rendering
- Matter.js for server-side physics
- Express.js and WebSockets for server
- Vite for build tool
- OpenAI API (GPT-4o) for command processing

## Project Structure

```
src/
├── client/              # Client-side application code
│   ├── rendering/       # Display and visualization systems
│   ├── input/           # User input capture and processing
│   ├── store/           # Client-side state management
│   ├── components/      # React UI components
│   └── network/         # Client-server communication
├── server/              # Server-side code
│   ├── physics/         # Authoritative physics engine (Matter.js)
│   ├── logic/           # Game rules and mechanics
│   ├── game-state/      # World state management
│   └── network/         # Client communication
└── shared/              # Code used by both client and server
    ├── types/           # TypeScript type definitions
    ├── constants/       # Shared configuration values
    └── utils/           # Common utility functions
api/                     # Python FastAPI for AI integration
```

## Installation and Setup

```bash
# Install dependencies
npm install

# Run both client and server in development mode
npm run dev:all

# Run client only
npm run dev

# Run server only
npm run server:dev

# Build for production
npm run build

# Run linting
npm run lint

# Start the AI API backend (from the api directory)
cd api
pip install -r requirements.txt
uvicorn main:app --reload
```

## Controls

- **Left/Right Arrow Keys**: Move the goat
- **Spacebar** or **Up Arrow**: Jump
- **Terminal**: Type commands to place obstacles
- **Item Selection Panel**: Select and place items manually
- **Reset Button**: Restart the game after winning or losing

## Game Mechanics

### Server-Authoritative Physics
- All game physics and state managed on server
- Client-side prediction and reconciliation for smooth gameplay
- Anti-cheat protection through server validation

### The Goat
- Custom animated goat character with running and standing animations
- Smooth movement with proper physics

### Dart Traps
- Vertical wall barriers shoot sets of three darts horizontally
- Darts fire every 3 seconds from walls visible on screen
- Precise collision detection with smaller hitbox for fair gameplay

### Level Design
- Round-based gameplay with placement and playing phases
- Multiple platform sections with escalating difficulty
- Strategic positioning of wall barriers and dart traps

### AI Command Terminal
- Natural language commands to place obstacles
- Integration with GPT-4o for command processing
- Real-time obstacle placement based on player position

### Multiplayer
- Join lobbies with friends
- Synchronized gameplay across clients
- Real-time updates and interactions

## Roadmap

1. Complete server-client integration
2. Add more types of obstacles (moving platforms, disappearing tiles)
3. Implement multiple levels with different themes
4. Add collectible items (carrots for health/score)
5. Create power-ups (temporary dart immunity, double jump)
6. Add a level editor for custom challenges

## License

MIT