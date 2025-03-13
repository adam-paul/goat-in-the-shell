import { SocketProvider, useSocket } from './SocketProvider';
import socketEvents, { useSocketEvents } from './SocketEvents';

// Initialize socket events with the socket from the provider
export function initializeSocketEvents(socket: WebSocket) {
  socketEvents.initialize(socket);
}

export {
  SocketProvider,
  useSocket,
  useSocketEvents
};