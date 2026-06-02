import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { IWebSocketGateway } from '../../application/ports/index.js';
import type { Logger } from 'pino';

export class SocketIoGateway implements IWebSocketGateway {
  private io: SocketServer | null = null;

  constructor(private readonly logger: Logger) {}

  attach(httpServer: HttpServer): void {
    this.io = new SocketServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.io.on('connection', (socket) => {
      this.logger.info({ socketId: socket.id }, 'WebSocket client connected');
      socket.on('disconnect', () => {
        this.logger.info({ socketId: socket.id }, 'WebSocket client disconnected');
      });
    });
  }

  emitVehicleUpdate(payload: Record<string, unknown>): void {
    this.io?.emit('vehicle:update', payload);
  }

  emitAlert(payload: Record<string, unknown>): void {
    this.io?.emit('alert:new', payload);
  }

  emitVehicleOffline(vehicleId: string): void {
    this.io?.emit('vehicle:offline', { vehicleId });
  }
}
