import { SocketProvider, useSocket } from './SocketProvider';
import socketEvents from './SocketEvents';

// Initialize socket events with the socket from the provider
export function initializeSocketEvents(socket: WebSocket) {
  socketEvents.initialize(socket);
}

export {
  SocketProvider,
  useSocket
};