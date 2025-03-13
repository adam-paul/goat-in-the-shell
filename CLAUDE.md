# Development Guidelines for Goat in the Shell

## Restrictions
- UNDER ABSOLUTELY NO CIRCUMSTANCES ARE YOU EVER EVER EVER ALLOWED TO IMPLEMENT FALLBACK MECHANISMS OF ANY KIND 
- NEVER IMPLEMENT FALLBACK LOGIC
- NO FALLBACK OF ANY KIND WHATSOEVER 
- IF I EXPLICITLY ASK YOU TO IMPLEMENT FALLBACK LOGIC, YOU MUST GET CONFIRMATION FROM ME *THREE* TIMES BEFORE YOU ARE ALLOWED TO DO SO
- NEVER, EVER, FOR ANY REASON, IN ANY CIRCUMSTANCE WHATSOEVER, ARE YOU EVER ALLOWED TO IMPLEMENT ANYTHING EVEN RESEMBLING "FALLBACK" "SAFETY" CODE
- IF YOU EVER IMPLEMENT FALLBACK MECHANISMS OR FALLBACK CODE WITHOUT BEING ASKED, MY CODEBASE WILL BE DELETED, I WILL LOSE MY JOB AND POSSIBLY BE KILLED 

## Debugging Best Practices
- **Look for Simple Causes First**: Before adding complex error handling or extensive logging, look for simple structural issues like React StrictMode double mounting or component lifecycle problems
- **Avoid Overengineering Solutions**: Don't add layers of error handling, timeouts, and safeguards when a simple root cause might exist
- **Understand the Full Code Flow**: Follow the complete execution path, including framework behavior like React's rendering lifecycle
- **Pattern Recognition**: Learn to recognize telltale patterns - like repeated initialize/cleanup sequences that might indicate framework behavior rather than code issues
- **Don't Get Lost in Details**: Stepping back to look at the big picture can reveal obvious issues that detailed investigation might miss
- **Question Framework Defaults**: Development tools like React StrictMode can cause unexpected behaviors that don't manifest in production
- **Test Simple Hypotheses**: When facing mysterious issues, test simple solutions (like removing StrictMode) before complex ones
- **Watch for Double Mount Issues**: Especially with hooks that establish connections or subscriptions, React's development behaviors can cause problems

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
