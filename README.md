# Goat in the Shell

A 2D platformer game built with React, TypeScript, and Phaser.js where you control a goat navigating through a challenging level while avoiding deadly darts.

## Concept

This game is a challenging 2D platformer where you:

1. **Control a Goat**: Navigate from the starting point (green) to the endpoint (red)
2. **Avoid Dart Traps**: Vertical walls shoot tranquilizer darts that can instantly end your game
3. **Master Platforming**: Jump between platforms and navigate around obstacles

## Current Features

- Responsive platformer mechanics with goat character movement and jumping
- Procedurally generated goat and level graphics
- Dart traps that fire from walls every 3 seconds
- Tranquilizer effect when hit by darts (game over state)
- Restart functionality with nice UI modals
- Custom sound effects
- Win and lose conditions with appropriate feedback

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

- **Left/Right Arrow Keys**: Move the goat
- **Spacebar** or **Up Arrow**: Jump
- **Reset Button**: Restart the game after winning or losing
- In-game restart button when tranquilized

## Project Structure

- `/src/game/scenes`: Phaser game scenes
- `/src/components`: React components including prompter controls
- `/public/assets`: Game assets and resources

## Game Mechanics

### The Goat
- Custom animated goat character with running and standing animations
- Simulated bleat sound when jumping
- Smooth movement with proper physics

### Dart Traps
- Vertical wall barriers shoot sets of three darts horizontally
- Darts only travel left, making right-to-left traversal more dangerous
- Precise collision detection with smaller hitbox for fair gameplay

### Level Design
- Multiple platform sections with escalating difficulty
- Long level requiring careful navigation
- Strategic positioning of wall barriers and dart traps

## Roadmap

1. Add more types of obstacles (moving platforms, disappearing tiles)
2. Implement multiple levels with different themes
3. Add collectible items (carrots for health/score)
4. Create power-ups (temporary dart immunity, double jump)
5. Add a level editor for custom challenges

## License

MIT
