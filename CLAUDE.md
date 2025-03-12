# Development Guidelines for Goat in the Shell

## Commands
- `npm run dev` - Start client development server
- `npm run server:dev` - Start server development with auto-reload
- `npm run dev:all` - Start both client and server in development mode
- `npm run build` - Build for production (runs TypeScript checks first)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm start` - Start production server on PORT env var (defaults to 3000)
- `npx tsc --noEmit` - Run TypeScript type checking

## Technologies
- React 19 with TypeScript
- Phaser 3 for client-side rendering
- Matter.js for server-side physics
- Express.js and WebSockets for server communication
- Vite for build tool
- FastAPI backend for AI integration
- OpenAI API (GPT-4o) for AI commands

## Code Style
- **Imports**: Sort imports by: React/library imports, absolute imports, relative imports
- **TypeScript**: Use explicit types for function parameters and return values
- **Components**: Functional components with React hooks
- **Naming**: camelCase for variables/functions, PascalCase for components/classes
- **Error Handling**: Use try/catch blocks and handle errors gracefully
- **Server Code**: Keep server modules focused and smaller than 300 lines
- **Formatting**: 2 space indentation, single quotes, semicolons required
- **State Management**: Use Zustand for client state, server-side authoritative state
- **Safety**: Enable strict TypeScript checking, avoid any types

## Project Structure
- `/src/client/components`: React UI components (modals, controls, panels)
- `/src/client/rendering`: Client-side rendering with Phaser
- `/src/client/input`: User input handling
- `/src/client/network`: Client-side network communication
- `/src/server/physics`: Server-side physics with Matter.js
- `/src/server/logic`: Game rules and mechanics
- `/src/server/game-state`: World state management
- `/src/server/network`: Server-side network communication
- `/src/shared`: Types and constants shared between client and server
- `/api`: FastAPI backend with AI integration
- `/public/assets`: Game assets and resources

## Game Features
- **Player Character**: A goat with custom-drawn graphics and animations
- **Server-Authoritative Physics**: Matter.js-based physics on server for consistent gameplay
- **Client-Side Rendering**: Visualization using Phaser
- **Multiplayer Support**: Real-time gameplay with other players
- **Dart Traps**: Vertical walls shoot tranquilizer darts that cause game over if they hit the goat
- **Game States**: Select, Placement, Playing, Win, Game Over (tranquilized/spike/fall), Reset
- **Round-based Gameplay**: Progressive rounds with countdown timer
- **Item Placement**: Platform, spike, oscillator, shield, dart wall placement
- **AI Command Terminal**: Natural language commands to place obstacles using GPT-4o

## Additional Notes
- Game assets are procedurally generated using Phaser's graphics API
- Network communication uses WebSockets for real-time updates
- Server runs on port 3001, client on port 5173 (Vite default)
- Dart shooting occurs every 3 seconds from visible walls, with 3 darts per wall
- Environment variables required for OpenAI API integration
- Three death conditions: dart hit (tranquilized), spike contact, falling through gaps
- Client-server communication is message-based with defined protocol in shared/types