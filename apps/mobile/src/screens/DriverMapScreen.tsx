import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
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
        <Text style={styles.title}>Mi ruta</Text>
        <Text style={styles.subtitle}>
          {isTracking ? 'Enviando telemetría' : 'Tracking detenido'} · Pendientes: {pendingCount}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion}>
          <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} title="Tu posición" />
        </MapView>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={toggleTracking}>
        <Text style={styles.buttonText}>{isTracking ? 'Detener tracking' : 'Iniciar tracking'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  mapContainer: { flex: 1, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  error: { color: '#f87171', paddingHorizontal: 16, marginTop: 8 },
  button: {
    backgroundColor: '#16a34a',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
