import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { sendTelemetry, GPS_INTERVAL_MS, type TelemetryPayload } from './SyncService';
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

    await Location.requestBackgroundPermissionsAsync();

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
    const payload: TelemetryPayload = {
      event_id: crypto.randomUUID(),
      device_id: DEFAULT_DEVICE_ID,
      vehicle_id: DEFAULT_VEHICLE_ID,
      timestamp: new Date().toISOString(),
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      speed_kmh: location.coords.speed != null ? location.coords.speed * 3.6 : undefined,
      heading: location.coords.heading ?? undefined,
    };

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
