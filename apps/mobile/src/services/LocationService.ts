import Constants from 'expo-constants';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from '../utils/uuid';
import {
  sendTelemetry,
  sanitizeTelemetryPayload,
  GPS_INTERVAL_MS,
  type TelemetryPayload,
} from './SyncService';
import { insertPendingEvent, flushPendingEvents, getPendingCount } from './StorageService';

const DEFAULT_VEHICLE_ID = 'a0000000-0000-4000-8000-000000000001';
const DEFAULT_DEVICE_ID = 'c0000000-0000-4000-8000-000000000001';

type PendingListener = (count: number) => void;

export class LocationService {
  private watchSubscription: Location.LocationSubscription | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private pendingListeners: PendingListener[] = [];

  async startTracking(): Promise<void> {
    const { status: foreground } = await Location.requestForegroundPermissionsAsync();
    if (foreground !== 'granted') {
      throw new Error('Permiso de ubicación denegado');
    }

    // Expo Go uses its own Info.plist — background keys from app.json are not applied.
    // Foreground tracking is enough for the demo; use a dev build for background GPS.
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (!isExpoGo) {
      await Location.requestBackgroundPermissionsAsync();
    }

    this.watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: GPS_INTERVAL_MS,
        distanceInterval: 10,
      },
      (location) => this.handleLocation(location),
    );

    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void this.syncPending();
      }
    });
  }

  stopTracking(): void {
    this.watchSubscription?.remove();
    this.netInfoUnsubscribe?.();
  }

  onPendingChange(listener: PendingListener): () => void {
    this.pendingListeners.push(listener);
    return () => {
      this.pendingListeners = this.pendingListeners.filter((l) => l !== listener);
    };
  }

  private async handleLocation(location: Location.LocationObject): Promise<void> {
    const { coords } = location;
    const speedMs = coords.speed;
    const payload = sanitizeTelemetryPayload({
      event_id: randomUUID(),
      device_id: DEFAULT_DEVICE_ID,
      vehicle_id: DEFAULT_VEHICLE_ID,
      timestamp: new Date().toISOString(),
      lat: coords.latitude,
      lng: coords.longitude,
      speed_kmh:
        speedMs != null && speedMs >= 0 ? speedMs * 3.6 : undefined,
      heading:
        coords.heading != null && coords.heading >= 0 && coords.heading <= 360
          ? coords.heading
          : undefined,
    });

    const sent = await sendTelemetry(payload);
    if (!sent) {
      await insertPendingEvent(payload);
      await this.notifyPendingCount();
    }
  }

  private async syncPending(): Promise<void> {
    await flushPendingEvents(async (payload) => {
      return sendTelemetry(payload as TelemetryPayload);
    });
    await this.notifyPendingCount();
  }

  private async notifyPendingCount(): Promise<void> {
    const count = await getPendingCount();
    this.pendingListeners.forEach((l) => l(count));
  }
}
