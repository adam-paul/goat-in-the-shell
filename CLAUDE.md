# Development Guidelines for dynamite-hack

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

## Additional Notes
- The project uses Phaser 3 for game development within a React application
- Follow ESLint recommended rules for both JavaScript and TypeScript