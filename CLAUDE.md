# Development Guidelines for Goat in the Shell

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript checks first)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npx tsc --noEmit` - Run TypeScript type checking

## Code Style
- **Imports**: Sort imports by: React/library imports, absolute imports, relative imports
- **TypeScript**: Use explicit types for function parameters and return values
- **Components**: Functional components with React hooks
- **Naming**: camelCase for variables/functions, PascalCase for components/classes
- **Error Handling**: Use try/catch blocks and handle errors gracefully
- **Phaser**: Organize game code in separate scene classes
- **Formatting**: 2 space indentation, single quotes, semicolons required
- **State Management**: Use React hooks for UI, Phaser's state system for game logic
- **Safety**: Enable strict TypeScript checking, avoid any types

## Game Features
- **Player Character**: A goat with custom-drawn graphics and animations
- **Game Logic**: Phaser-based platformer with physics, collisions, and custom hitboxes
- **Sound Effects**: Programmatically generated audio for goat bleating
- **Dart Traps**: Vertical walls shoot tranquilizer darts that cause game over if they hit the goat
- **Game States**: Playing, Win, Game Over (tranquilized), and Reset states with proper handling

## Additional Notes
- The project uses Phaser 3 for game development within a React application
- Follow ESLint recommended rules for both JavaScript and TypeScript
- Game assets are procedurally generated using Phaser's graphics API
- Game uses custom event system to communicate between Phaser and React
- Dart shooting occurs every 3 seconds from visible walls, with 3 darts per wall