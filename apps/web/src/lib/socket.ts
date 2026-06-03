'use client';

import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;
let connectionListener: ((connected: boolean) => void) | undefined;

const MAX_BACKOFF_MS = 30000;
const BASE_BACKOFF_MS = 5000;

function ensureSocket(): Socket {
  if (socket) return socket;

  socket = io(WS_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: BASE_BACKOFF_MS,
    reconnectionDelayMax: MAX_BACKOFF_MS,
  });

  socket.on('connect', () => {
    connectionListener?.(true);
  });

  socket.on('disconnect', () => {
    connectionListener?.(false);
  });

  return socket;
}

export function getSocket(onConnectionChange?: (connected: boolean) => void): Socket {
  const instance = ensureSocket();

  if (onConnectionChange) {
    connectionListener = onConnectionChange;
    queueMicrotask(() => {
      onConnectionChange(instance.connected);
    });
  }

  return instance;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  connectionListener = undefined;
}
