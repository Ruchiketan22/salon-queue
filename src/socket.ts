import { io, Socket } from 'socket.io-client';

// Use environment variable or current origin (avoids hardcoded localhost)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});
