# Goat in the Shell

A 2D platformer game built with React, TypeScript, and Phaser.js where you control a goat navigating through a challenging level while avoiding deadly darts. The game features a unique AI-powered command terminal for dynamic obstacle placement.

## Concept

This game is a challenging 2D platformer where you:

1. **Control a Goat**: Navigate from the starting point (bottom left) to the endpoint (top right)
2. **Avoid Obstacles**: Dart traps, spikes, and gaps can instantly end your game
3. **Build the Level**: Place platforms and obstacles using direct selection or AI commands
4. **Master Platforming**: Jump between platforms and navigate around obstacles
5. **Progress Through Rounds**: Each round adds new challenges with a countdown timer

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

3. These environment variables are automatically loaded by Vite and the FastAPI backend.

## Current Features

- Responsive platformer mechanics with goat character movement and jumping
- Procedurally generated goat and level graphics
- Multiple obstacles: dart traps, spikes, platforms, and gaps
- AI-powered command terminal for dynamic obstacle placement
- Round-based gameplay with countdown timer
- Three death conditions: dart hit (tranquilized effect), spike contact, falling through gaps
- Item placement system: platforms, spikes, oscillators, shields, dart walls
- Win and lose conditions with appropriate feedback
- Interactive UI with modals for deaths, tutorials, and item selection

## Technologies Used

- React 19
- TypeScript
- Phaser 3 for game engine
- Vite for build tool
- Supabase for backend services
- FastAPI for AI integration backend
- OpenAI API (GPT-4o) for command processing

## Installation and Setup

```bash
# Install frontend dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Start the API backend (from the api directory)
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

## Project Structure

- `/src/game/scenes`: Phaser game scenes with game logic
- `/src/components`: React components including modals and controls
- `/public/assets`: Game assets and resources
- `/api`: FastAPI backend for AI command processing

## Game Mechanics

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

## Roadmap

1. Add more types of obstacles (moving platforms, disappearing tiles)
2. Implement multiple levels with different themes
3. Add collectible items (carrots for health/score)
4. Create power-ups (temporary dart immunity, double jump)
5. Add a level editor for custom challenges

## License

MIT