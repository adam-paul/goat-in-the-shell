# Development Guidelines for Goat in the Shell

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production (runs TypeScript checks first)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm start` - Start production server on PORT env var (defaults to 3000)
- `npx tsc --noEmit` - Run TypeScript type checking

## Technologies
- React 19 with TypeScript
- Phaser 3 for game engine
- Vite for build tool
- Supabase for backend services (requires environment variables)
- FastAPI backend for AI integration
- OpenAI API (GPT-4o) for AI commands

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

## Project Structure
- `/src/components`: React UI components (modals, controls, panels)
- `/src/game/scenes`: Phaser game scenes with game logic
- `/api`: FastAPI backend with AI integration
- `/public/assets`: Game assets and resources

## Game Features
- **Player Character**: A goat with custom-drawn graphics and animations
- **Game Logic**: Phaser-based platformer with physics, collisions, and custom hitboxes
- **Sound Effects**: Programmatically generated audio for goat bleating
- **Dart Traps**: Vertical walls shoot tranquilizer darts that cause game over if they hit the goat
- **Game States**: Select, Placement, Playing, Win, Game Over (tranquilized/spike/fall), Reset
- **Round-based Gameplay**: Progressive rounds with countdown timer
- **Item Placement**: Platform, spike, oscillator, shield, dart wall placement
- **AI Command Terminal**: Natural language commands to place obstacles using GPT-4o

## Additional Notes
- Game assets are procedurally generated using Phaser's graphics API
- Game uses custom event system to communicate between Phaser and React
- Dart shooting occurs every 3 seconds from visible walls, with 3 darts per wall
- Environment variables required for Supabase and OpenAI API integration
- Three death conditions: dart hit (tranquilized), spike contact, falling through gaps