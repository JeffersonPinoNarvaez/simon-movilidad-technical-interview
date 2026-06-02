'use client';

import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;
let reconnectAttempt = 0;

const MAX_BACKOFF_MS = 30000;
const BASE_BACKOFF_MS = 5000;

export function getSocket(onConnectionChange?: (connected: boolean) => void): Socket {
  if (socket?.connected) return socket;

  socket = io(WS_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: BASE_BACKOFF_MS,
    reconnectionDelayMax: MAX_BACKOFF_MS,
  });

  socket.on('connect', () => {
    reconnectAttempt = 0;
    onConnectionChange?.(true);
  });

  socket.on('disconnect', () => {
    reconnectAttempt += 1;
    onConnectionChange?.(false);
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
