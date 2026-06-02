import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { LocationService } from '../services/LocationService';
import { useLocationStore } from '../store/useLocationStore';

const BOGOTA_REGION: Region = {
  latitude: 4.6097,
  longitude: -74.0817,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export function DriverMapScreen() {
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<Region>(BOGOTA_REGION);
  const [locating, setLocating] = useState(true);
  const serviceRef = useRef<LocationService | null>(null);
  const { pendingCount, isTracking, setPendingCount, setTracking } = useLocationStore();

  useEffect(() => {
    serviceRef.current = new LocationService();
    const unsub = serviceRef.current.onPendingChange(setPendingCount);
    return () => {
      unsub();
      serviceRef.current?.stopTracking();
    };
  }, [setPendingCount]);

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then(async ({ status }) => {
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
      setLocating(false);
    });
  }, []);

  async function toggleTracking() {
    if (isTracking) {
      serviceRef.current?.stopTracking();
      setTracking(false);
      return;
    }

    try {
      await serviceRef.current?.startTracking();
      setTracking(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar tracking');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>FleetPortal Driver</Text>
        <Text style={styles.title}>Mi ruta</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statPill, isTracking ? styles.statPillLive : styles.statPillIdle]}>
            <View style={[styles.dot, isTracking && styles.dotLive]} />
            <Text style={styles.statText}>{isTracking ? 'En vivo' : 'Detenido'}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>Cola</Text>
            <Text style={styles.statValue}>{pendingCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.mapWrapper}>
        {locating && (
          <View style={styles.mapOverlay}>
            <ActivityIndicator size="large" color="#34d399" />
            <Text style={styles.mapOverlayText}>Obteniendo ubicación…</Text>
          </View>
        )}
        <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion}>
          <Marker
            coordinate={{ latitude: region.latitude, longitude: region.longitude }}
            title="Tu posición"
          />
        </MapView>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, isTracking && styles.buttonStop]}
        onPress={toggleTracking}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>
          {isTracking ? '■  Detener tracking' : '▶  Iniciar tracking'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#34d399',
    opacity: 0.9,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#f8fafc', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statPillLive: {
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(6, 78, 59, 0.35)',
  },
  statPillIdle: { borderColor: 'rgba(148, 163, 184, 0.2)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#64748b' },
  dotLive: { backgroundColor: '#34d399' },
  statText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  statLabel: { color: '#64748b', fontSize: 11, textTransform: 'uppercase' },
  statValue: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  mapWrapper: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  map: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mapOverlayText: { color: '#94a3b8', fontSize: 14 },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(127, 29, 29, 0.5)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  errorText: { color: '#fecaca', fontSize: 13, textAlign: 'center' },
  button: {
    margin: 16,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonStop: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
});
