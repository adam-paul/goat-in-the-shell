# Platformer Challenge

A 2D platformer game built with React, TypeScript, and Phaser.js where one player needs to get from point A to point B while avoiding obstacles.

## Concept

This game is a single-screen 2D platformer with two roles:

1. **Player**: Controls a character that needs to get from the starting point (green) to the endpoint (red)
2. **Prompter**: Will use AI to generate obstacles and barriers in real-time to challenge the player

## Current MVP Features

- Basic platformer mechanics with player movement and jumping
- Start and end points
- Simple platform layout
- Reset functionality
- Basic UI with instructions

## Planned Features

- AI-powered obstacle generation
- Multiple levels with increasing difficulty
- Different types of obstacles (platforms, spikes, moving elements)
- Score tracking based on completion time
- Multiplayer functionality

## Technologies Used

- React 19
- TypeScript
- Phaser 3 for game engine
- Vite for build tool

## Installation and Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## Controls

- **Left/Right Arrow Keys**: Move the player
- **Spacebar**: Jump
- **Reset Button**: Restart the game

## Project Structure

- `/src/game/scenes`: Phaser game scenes
- `/src/components`: React components including prompter controls
- `/public/assets`: Game assets and resources

## Roadmap

1. Implement AI-powered obstacle generation
2. Add multiple level designs
3. Enhance graphics and animations
4. Add sound effects and music
5. Implement multiplayer functionality

## License

MIT
