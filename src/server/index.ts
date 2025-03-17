import { WebSocketServer } from 'ws';
import http from 'http';
import { createSocketServer } from './network';
import { setupGameLogic } from './logic';

// Create a basic HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('WebSocket server running');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Initialize game logic system
const { gameLogic, sessionManager } = setupGameLogic();

// Initialize socket server
const socketServer = createSocketServer(wss, sessionManager, gameLogic);

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SERVER: WebSocket server running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('SERVER: Shutting down...');
  gameLogic.stopUpdateLoop();
  socketServer.shutdown();
  server.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
